const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { fields, hardware, model, propose } = require('./model.cjs');
const ID = /^[0-9a-f-]{36}$/;
class Cad {
  constructor(host) { this.host = host; this.lock = Promise.resolve(); this.fusionLock = Promise.resolve(); this.reviews = new Map(); }
  root() { const r = this.host.getRoot(); if (!r) throw Error('Connect a repository first.'); return r; }
  dir() { return path.join(this.root(), '.dino', 'cad'); }
  async read() {
    try { return JSON.parse(await fs.readFile(path.join(this.dir(), 'designs.json'), 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw e; return { current: null, revisions: [] }; }
  }
  async state() {
    const d = await this.read();
    const current = d.revisions.find(r => r.id === d.current);
    const job = this.host.runtime.snapshot().find(j => j.id === 'cad-assembly');
    let result = null;
    if (current) {
      try { result = JSON.parse(await fs.readFile(path.join(this.root(), '.dino', 'artifacts', `assembly-${current.id}-report.json`), 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    let ready = false;
    try { await fs.access(require('./recipe.cjs').python(this.root())); ready = (await fs.readFile(path.join(this.root(), '.dino', 'venvs', 'assembly', 'dino-ready'), 'utf8')).trim() === '0.13.0'; } catch {}
    return { fields, hardware, current, revisions: d.revisions.slice().reverse(), model: model(current?.parameters), result, job, ready,
      fusionConnected: this.host.connections.snapshot().some(c => c.id === 'fusion') };
  }
  async save(input) {
    const parameters = model(input.parameters).parameters, root = this.root();
    const task = this.lock.then(async () => {
      if (root !== this.root()) throw Error('Workspace changed.');
      const d = await this.read();
      if ((input.expected ?? null) !== d.current) throw Error('Design changed in another window. Refresh before saving.');
      const m = model(parameters), previous = d.revisions.find(r => r.id === d.current);
      if (previous?.digest === m.digest) return previous;
      if (d.revisions.length >= 200) throw Error('This workspace has 200 revisions. Archive it before adding more.');
      const revision = { id: crypto.randomUUID(), number: d.revisions.length + 1, parameters, digest: m.digest, at: new Date().toISOString() };
      await fs.mkdir(path.join(this.dir(), 'revisions'), { recursive: true });
      await fs.writeFile(path.join(this.dir(), 'revisions', revision.id + '.json'), JSON.stringify(m, null, 2), { flag: 'wx' });
      d.current = revision.id; d.revisions.push(revision);
      const file = path.join(this.dir(), 'designs.json');
      await fs.writeFile(file + '.tmp', JSON.stringify(d, null, 2)); await fs.rename(file + '.tmp', file);
      return revision;
    });
    this.lock = task.catch(() => {}); return task;
  }
  async execute(input) {
    if (input.op === 'preview') return model(input.parameters);
    if (input.op === 'propose') return propose(model(input.parameters).parameters, input.prompt);
    if (input.op === 'import') {
      const source = input.source;
      if (!source || source.schemaVersion !== 1 || source.template !== 'hinged-enclosure') throw Error('Choose a Dino hinged-enclosure source JSON.');
      const m = model(source.parameters);
      if (m.digest !== source.digest) throw Error('Source parameters do not match their digest.');
      return m;
    }
    if (input.op === 'save') return this.save(input);
    if (input.op === 'restore') {
      const d = await this.read(), r = d.revisions.find(r => r.id === input.id);
      if (!r) throw Error('Unknown revision.');
      return this.save({ parameters: r.parameters, expected: input.expected });
    }
    if (input.op === 'build') {
      const d = await this.read();
      if (!ID.test(input.id || '') || !d.revisions.some(r => r.id === input.id)) throw Error('Save a revision before building.');
      return this.host.runtime.start('cad-assembly', 'sample', { revision: input.id });
    }
    if (input.op === 'install') return this.host.runtime.start('cad-assembly', 'install');
    if (input.op === 'stop') { await this.host.runtime.stop('cad-assembly'); return { stopped: true }; }
    throw Error('Unknown CAD operation.');
  }
  async call(name, args = {}) {
    const value = await this.host.connections.call('fusion', name, args);
    const text = value.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') || '';
    if (value.isError) throw Error(text || 'Fusion call failed.');
    try { return JSON.parse(text); } catch { throw Error('Fusion returned an unexpected response.'); }
  }
  async snapshot() {
    // Sequential: the native bridge serializes work on Fusion's main thread.
    const document = await this.call('get_document_info');
    const parameters = await this.call('get_active_design_parameters');
    const bodies = await this.call('list_bodies');
    return { document, parameters: parameters.parameters || parameters, bodies: bodies.bodies || bodies };
  }
  async fusion(input) {
    const task = this.fusionLock.then(() => this.fusionNow(input));
    this.fusionLock = task.catch(() => {}); return task;
  }
  async fusionNow(input) {
    if (input.op === 'connect') {
      await this.host.connections.connect('fusion', this.host.getConnection('fusion'), this.root());
      return this.snapshot();
    }
    if (input.op === 'snapshot') return this.snapshot();
    if (input.op === 'body') {
      if (typeof input.name !== 'string' || input.name.length > 200) throw Error('Choose a body.');
      return this.call('get_body_info', { body_name: input.name });
    }
    if (input.op === 'clearance') {
      if (!Array.isArray(input.bodies) || input.bodies.length !== 2 || input.bodies.some(n => typeof n !== 'string' || n.length > 200) || input.bodies[0] === input.bodies[1]) throw Error('Choose two different bodies.');
      return this.call('measure_clearance', { body1_name: input.bodies[0], body2_name: input.bodies[1] });
    }
    if (input.op === 'review') {
      const snapshot = await this.snapshot();
      const param = snapshot.parameters.find(p => p.name === input.name);
      if (!param || typeof input.expression !== 'string' || !input.expression.trim() || input.expression.length > 200) throw Error('Choose a parameter and enter a Fusion expression.');
      const review = { id: crypto.randomUUID(), root: this.root(), snapshot, name: param.name, before: param.expression, after: input.expression.trim(), expires: Date.now() + 120000 };
      for (const [id, old] of this.reviews) if (old.expires < Date.now()) this.reviews.delete(id);
      if (this.reviews.size >= 30) throw Error('Too many pending changes. Wait two minutes.');
      this.reviews.set(review.id, review);
      return { id: review.id, document: snapshot.document, name: review.name, before: review.before, after: review.after };
    }
    if (input.op === 'apply') {
      const r = this.reviews.get(input.id); this.reviews.delete(input.id);
      if (!r || r.expires < Date.now() || r.root !== this.root()) throw Error('Review expired. Review the change again.');
      const current = await this.snapshot();
      if (JSON.stringify(current) !== JSON.stringify(r.snapshot)) throw Error('Fusion design changed. Refresh and review again.');
      const result = await this.call('update_user_parameter', { parameter_name: r.name, new_expression: r.after });
      await fs.mkdir(path.join(this.dir(), 'fusion-receipts'), { recursive: true });
      await fs.writeFile(path.join(this.dir(), 'fusion-receipts', r.id + '.json'), JSON.stringify({ ...r, result, at: new Date().toISOString() }, null, 2));
      return { result, snapshot: await this.snapshot() };
    }
    throw Error('Unknown Fusion operation.');
  }
}
module.exports = { Cad };
