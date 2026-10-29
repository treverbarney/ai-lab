const { _electron } = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs/promises');
const root = path.join(__dirname, '..');
async function wait(fn, timeout = 90000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 200)); } throw Error('Condition timed out'); }
(async () => {
  const app = await _electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', '--headless', '--ozone-platform=headless', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--user-data-dir=/tmp/dino-cad-e2e-' + process.pid, root] });
  const errors = [];
  try {
    const home = await app.firstWindow(); home.on('pageerror', e => errors.push(e.message));
    const next = app.context().waitForEvent('page'); await home.locator('#open-assembly').click();
    const page = await next; page.on('pageerror', e => errors.push(e.message));
    await page.waitForURL('**/studio/assembly.html'); await page.waitForSelector('body[data-ready="true"]');
    assert.equal(await home.locator('#view-toolbar').isVisible(), true);
    assert.equal(await home.locator('#view-title').innerText(), 'Dino CAD & Assembly');
    async function api(data) { return page.evaluate(async data => { const r = await fetch('/api/cad', { method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined }); const v = await r.json(); if (!r.ok) throw Error(v.error); return v; }, data); }
    assert.equal((await fetch(new URL('/api/cad', page.url()))).status, 401);
    assert.ok((await api()).ready, 'Install CAD engine before this acceptance run.');
    await page.locator('#name').fill('Dino enclosure · ' + Date.now().toString().slice(-5));
    await page.locator('#p-width').fill('120'); await page.locator('#fastener').selectOption('M4');
    await page.locator('#save').click();
    await wait(async () => (await api()).current.parameters.fastener === 'M4' && !await page.locator('#build').isDisabled());
    const first = (await api()).current;
    await page.locator('#build').click();
    await wait(async () => { const s = await api(); if (s.job?.state === 'failed') throw Error(s.job.log); return s.result?.revision === first.id; });
    await page.waitForSelector('body[data-exact="true"]');
    assert.match(await page.locator('#check-badge').innerText(), /CHECKS PASSED/);
    let s = await api(); assert.equal(s.result.step_roundtrip.solids, 11); assert.equal(s.result.checks.passed, true);
    const downloaded = {};
    for (const key of ['step', 'stl', 'source', 'bom']) {
      const name = s.result.files[key]; const content = await page.evaluate(async name => { const r = await fetch('/api/download?name=' + encodeURIComponent(name)); if (!r.ok) throw Error('Download failed'); return r.text(); }, name);
      assert.ok(content.length > 50); downloaded[key] = content;
    }
    assert.match(downloaded.step, /ISO-10303-21/); assert.match(downloaded.bom, /M4x12/); assert.equal(JSON.parse(downloaded.source).parameters.width, 120);
    console.log('PASS real desktop → paired CAD UI → queued OpenCascade build → exact geometry → STEP reimport and downloads.');
    await page.getByRole('button', { name: 'Hinged lid', exact: false }).click();
    await page.locator('#isolate').click(); assert.equal(await page.locator('.part-row input:checked').count(), 1);
    await page.locator('#show-all').click(); assert.equal(await page.locator('.part-row input:checked').count(), 11);
    await page.locator('#angle').fill('55'); assert.equal(await page.locator('#angle-label').innerText(), '55°');
    await page.locator('#explode').fill('15'); await page.locator('#fit').click();
    await fs.mkdir(path.join(root, 'dist', 'verification'), { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(root, 'dist', 'verification', 'cad-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(root, 'dist', 'verification', 'cad-phone.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#intent').fill('width to 130 mm and height to 40 mm'); await page.locator('#intent-form button').click();
    await page.locator('#review-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#review-content').innerText(), /120 → 130/);
    assert.equal((await api()).current.id, first.id);
    await page.locator('#approve-review').click(); await wait(async () => (await api()).current.parameters.width === 130);
    assert.equal(await page.locator('#p-width').inputValue(), '130');
    const restored = page.locator('.revision-row').filter({ hasText: 'r' + first.number + ' ·' }).getByRole('button'); await restored.click(); await page.locator('#approve-review').click();
    await wait(async () => (await api()).current.parameters.width === 120);
    await page.reload(); await page.waitForSelector('body[data-ready="true"]'); assert.equal(await page.locator('#p-width').inputValue(), '120');
    await page.locator('#source-import').setInputFiles({ name: 'enclosure-source.json', mimeType: 'application/json', buffer: Buffer.from(downloaded.source) }); await page.locator('#review-dialog').waitFor({ state: 'visible' }); await page.locator('#approve-review').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#fusion-tab').click(); assert.equal(await page.locator('#fusion-pane').isVisible(), true);
    await page.locator('#design-tab').click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log('PASS selection/isolation, hinge/explode, reviewed word edits, revision restore/reload, source reopen, and 390px phone layout.');
    await home.locator('#back-home').click(); assert.equal(await home.locator('#view-toolbar').isVisible(), false);
    assert.deepEqual(errors, []); console.log('PASS return to desktop launcher and no uncaught browser errors. Native Fusion execution is not tested by this script.');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
