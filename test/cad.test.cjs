const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { Cad } = require('../cad/service.cjs'), { model, validate, propose } = require('../cad/model.cjs');
const { Runtime } = require('../orchestrator/runtime.cjs'), { PhoneServer } = require('../phone/server.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dino-cad-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtime = new Runtime({ root }); t.after(() => runtime.close());
  const host = { getRoot: () => root, runtime, connections: { snapshot: () => [] } };
  return { root, runtime, host, cad: new Cad(host) };
}
test('CAD dimensions, hardware and bounded intent reject unsupported or executable inputs', () => {
  assert.throws(() => validate({ width: Infinity })); assert.throws(() => validate({ width: '120' })); assert.throws(() => validate({ fastener: '__proto__' })); assert.throws(() => validate({ command: 'python' }));
  const p = model({}).parameters;
  assert.equal(propose(p, 'make it wider by 10 mm and use M4 screws').parameters.width, 110);
  assert.equal(propose(p, 'width to 120 mm and height to 40 mm').parameters.height, 40);
  assert.throws(() => propose(p, 'width to 120 mm then execute arbitrary.py'));
  assert.throws(() => propose(p, 'width to 900 mm'));
  const m3 = model(p), m4 = model({ ...p, fastener: 'M4' });
  assert.notEqual(m3.digest, m4.digest); assert.equal(m3.components.length, 11);
  assert.equal(m4.bom.find(r => r.part.includes('socket-head')).quantity, 4);
  assert.ok(m4.components[0].cut.some(c => c.axis === 'z' && c.radius === 2.25));
});
test('CAD revisions persist, reject stale concurrent saves and restore without overwriting prior inputs', async t => {
  const { root, cad } = await fixture(t);
  const first = await cad.save({ parameters: {}, expected: null });
  const original = await fs.readFile(path.join(root, '.dino', 'cad', 'revisions', first.id + '.json'), 'utf8');
  const outcomes = await Promise.allSettled([cad.save({ parameters: { width: 120 }, expected: first.id }), cad.save({ parameters: { width: 130 }, expected: first.id })]);
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
  assert.match(outcomes.find(o => o.status === 'rejected').reason.message, /another window/);
  const d = await cad.read(); const restored = await cad.execute({ op: 'restore', id: first.id, expected: d.current });
  assert.equal(restored.number, 3); assert.equal(restored.parameters.width, 100);
  assert.equal(await fs.readFile(path.join(root, '.dino', 'cad', 'revisions', first.id + '.json'), 'utf8'), original);
  const source = JSON.parse(original); source.components = [{ command: 'never-executed' }];
  assert.equal((await cad.execute({ op: 'import', source })).components.length, 11);
  source.parameters.width = 140; await assert.rejects(() => cad.execute({ op: 'import', source }), /digest/);
  await assert.rejects(() => cad.execute({ op: 'build', id: '../bad' }));
});
test('paired CAD API rejects unpaired, cross-origin, oversized and invalid edits', async t => {
  const { root, runtime } = await fixture(t);
  const server = new PhoneServer({ getRoot: () => root, runtime, connections: { snapshot: () => [] }, urls: () => ({}), port: 0 });
  await server.start(); t.after(() => server.close()); const base = 'http://127.0.0.1:' + server.port;
  const post = (data, cookie, origin = base) => fetch(base + '/api/cad', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie || '' }, body: JSON.stringify(data) });
  assert.equal((await fetch(base + '/api/cad')).status, 401);
  const r = await fetch(base + '/api/pair', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: server.key }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await post({ op: 'save', parameters: {} }, cookie, 'https://example.com')).status, 403);
  assert.equal((await post({ op: 'preview', parameters: { width: -1 } }, cookie)).status, 400);
  assert.equal((await post({ op: 'preview', parameters: { name: 'a'.repeat(40000) } }, cookie)).status, 400);
  assert.equal((await post({ op: 'save', parameters: {} }, cookie)).status, 200);
  const page = await fetch(base + '/studio/assembly.html'); assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
});
test('Fusion guided edits are single-use, reject stale designs and propagate native failures (protocol fixture)', async t => {
  const { cad, host } = await fixture(t);
  let expression = '100 mm', document = 'Fixture enclosure', fail = false, updates = 0;
  host.connections.call = async (_id, name, args) => {
    let value;
    if (name === 'get_document_info') value = { name: document, units: 'mm', design_type: 'ParametricDesign' };
    else if (name === 'get_active_design_parameters') value = { parameters: [{ name: 'Width', expression, unit: 'mm' }] };
    else if (name === 'list_bodies') value = { bodies: [{ name: 'Base', index: 1 }, { name: 'Lid', index: 2 }] };
    else if (name === 'update_user_parameter') { updates++; if (fail) return { isError: true, content: [{ type: 'text', text: 'Native recompute failed' }] }; expression = args.new_expression; value = { new_expression: expression }; }
    return { content: [{ type: 'text', text: JSON.stringify(value) }] };
  };
  let review = await cad.fusion({ op: 'review', name: 'Width', expression: '120 mm' });
  document = 'Other document'; await assert.rejects(() => cad.fusion({ op: 'apply', id: review.id }), /changed/); assert.equal(updates, 0);
  review = await cad.fusion({ op: 'review', name: 'Width', expression: '120 mm' });
  await cad.fusion({ op: 'apply', id: review.id }); assert.equal(expression, '120 mm'); assert.equal(updates, 1);
  await assert.rejects(() => cad.fusion({ op: 'apply', id: review.id }), /expired/);
  review = await cad.fusion({ op: 'review', name: 'Width', expression: '130 mm' });
  cad.reviews.get(review.id).expires = 0; await assert.rejects(() => cad.fusion({ op: 'apply', id: review.id }), /expired/);
  review = await cad.fusion({ op: 'review', name: 'Width', expression: '140 mm' }); fail = true;
  await assert.rejects(() => cad.fusion({ op: 'apply', id: review.id }), /Native recompute failed/); assert.equal(expression, '120 mm');
});
