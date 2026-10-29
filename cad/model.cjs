const crypto = require('node:crypto');
const fields = {
  width: { label: 'Width', unit: 'mm', min: 60, max: 240, default: 100 },
  depth: { label: 'Depth', unit: 'mm', min: 45, max: 180, default: 70 },
  height: { label: 'Height', unit: 'mm', min: 20, max: 100, default: 35 },
  wall: { label: 'Wall / floor', unit: 'mm', min: 2, max: 6, default: 3 },
  lid: { label: 'Lid thickness', unit: 'mm', min: 2, max: 6, default: 3 },
  gap: { label: 'Lid clearance', unit: 'mm', min: 0.1, max: 1.5, default: 0.4 },
  pinClearance: { label: 'Pin radial clearance', unit: 'mm', min: 0.05, max: 0.6, default: 0.2 },
};
const hardware = {
  M3: { diameter: 3, clearance: 3.4, head: 5.5, headHeight: 3, nut: 5.5, nutHeight: 2.4, length: 10, pitch: 0.5 },
  M4: { diameter: 4, clearance: 4.5, head: 7, headHeight: 4, nut: 7, nutHeight: 3.2, length: 12, pitch: 0.7 },
};
function validate(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid design.');
  for (const key of Object.keys(input))
    if (!Object.hasOwn(fields, key) && !['fastener', 'name'].includes(key)) throw Error('Unknown design field: ' + key);
  const p = {};
  for (const [key, f] of Object.entries(fields)) {
    const n = input[key] ?? f.default;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < f.min || n > f.max)
      throw Error(`${f.label} must be ${f.min}–${f.max} ${f.unit}.`);
    p[key] = Math.round(n * 1000) / 1000;
  }
  p.fastener = input.fastener ?? 'M3';
  if (!Object.hasOwn(hardware, p.fastener)) throw Error('Choose M3 or M4 hardware.');
  if (input.name !== undefined && (typeof input.name !== 'string' || input.name.length > 80)) throw Error('Name must be at most 80 characters.');
  p.name = input.name?.trim() || 'Hinged enclosure';
  if (p.wall + hardware[p.fastener].nutHeight > hardware[p.fastener].length - 1)
    throw Error('Wall is too thick for the selected mounting screws and nuts.');
  return p;
}
const box = (size, at) => ({ type: 'box', size, at });
const cylinder = (radius, length, at, axis = 'z') => ({ type: 'cylinder', radius, length, at, axis });
function model(input) {
  const p = validate(input), { width: w, depth: d, height: h, wall: t, lid: l, gap: g } = p;
  const f = hardware[p.fastener], pivot = [0, -d / 2 - 4, h + g], span = w - 16, segment = span / 3;
  const holeR = 1.5 + p.pinClearance, barrelR = 3.5;
  const base = { id: 'base', name: 'Enclosure base', part: 'DINO-ENC-BASE', material: 'PETG (example)', color: '#a4b6a0', group: 'housing', density: 1.27, add: [box([w, d, t], [0, 0, t / 2]), box([t, d, h - t], [-(w - t) / 2, 0, (h + t) / 2]), box([t, d, h - t], [(w - t) / 2, 0, (h + t) / 2]), box([w - 2 * t, t, h - t], [0, -(d - t) / 2, (h + t) / 2]), box([w - 2 * t, t, h - t], [0, (d - t) / 2, (h + t) / 2])], cut: [] };
  for (const x of [-segment, segment]) {
    base.add.push(cylinder(barrelR, segment - g, [x, pivot[1], pivot[2]], 'x'));
    base.add.push(box([segment - g, 5 + t / 2, t], [x, -d / 2 - 1.5 + t / 4, h - t / 2]));
  }
  base.cut.push(cylinder(holeR, w, pivot, 'x'));
  const lid = { id: 'lid', name: 'Hinged lid', part: 'DINO-ENC-LID', material: 'PETG (example)', density: 1.27, color: '#879bab', group: 'housing', moving: true, add: [box([w, d, l], [0, 0, h + g + l / 2]), cylinder(barrelR, segment - g, pivot, 'x'), box([segment - g, 5, l], [0, -d / 2 - 1.5, h + g + l / 2])], cut: [cylinder(holeR, w, pivot, 'x')] };
  const pin = { id: 'pin', name: 'Ø3 hinge pin (cut to length)', part: 'PIN-D3-L' + (span + 2).toFixed(1), material: 'Steel (example)', density: 7.85, color: '#c7cbd0', group: 'hardware', add: [cylinder(1.5, span + 2, pivot, 'x')], cut: [] };
  const components = [base, lid, pin];
  const inset = t + f.head / 2 + 2;
  let index = 0;
  for (const x of [-(w / 2 - inset), w / 2 - inset]) for (const y of [-(d / 2 - inset), d / 2 - inset]) {
    index++;
    base.cut.push(cylinder(f.clearance / 2, t + 2, [x, y, t / 2]));
    components.push({ id: 'screw-' + index, name: p.fastener + ' mounting screw ' + index, part: `${p.fastener}x${f.length}-socket-head-simplified`, material: 'Steel (example)', density: 7.85, color: '#b1b5b8', group: 'hardware', add: [cylinder(f.diameter / 2, f.length, [x, y, t - f.length / 2]), cylinder(f.head / 2, f.headHeight, [x, y, t + f.headHeight / 2])], cut: [] });
    components.push({ id: 'nut-' + index, name: p.fastener + ' nut ' + index, part: `${p.fastener}-hex-nut-simplified`, material: 'Steel (example)', density: 7.85, color: '#a7abad', group: 'hardware', add: [{ type: 'hex', radius: f.nut / Math.sqrt(3), length: f.nutHeight, at: [x, y, -f.nutHeight / 2] }], cut: [cylinder(f.diameter / 2, f.nutHeight + 1, [x, y, -f.nutHeight / 2])] });
  }
  const joints = [{ id: 'hinge', type: 'revolute', parent: 'base', child: 'lid', pivot, axis: [1, 0, 0], limits: [0, 110] }, ...components.filter(c => !['base', 'lid'].includes(c.id)).map(c => ({ id: 'fixed-' + c.id, type: 'fixed', parent: 'base', child: c.id }))];
  const bom = [];
  for (const c of components) {
    const row = bom.find(r => r.part === c.part);
    if (row) row.quantity++;
    else bom.push({ part: c.part, description: c.name.replace(/ \d+$/, ''), quantity: 1, material: c.material });
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
  return { schemaVersion: 1, template: 'hinged-enclosure', units: 'mm', digest, parameters: p, components, joints, bom,
    notes: ['Simplified hardware: no modeled threads, socket recesses, or supplier certification.', 'Hinge pin retention is not modeled. Add a retention method before fabrication.', 'Source JSON retains parameters and joints. STEP does not preserve this construction history.'] };
}
// Bounded intent parser. Unsupported language is rejected instead of guessed or executed.
function propose(current, prompt) {
  if (typeof prompt !== 'string' || prompt.length > 500) throw Error('Use a short dimension request.');
  const aliases = { width: 'width', wider: 'width', depth: 'depth', deeper: 'depth', height: 'height', taller: 'height', wall: 'wall', lid: 'lid', gap: 'gap' };
  const changes = {}, leftovers = prompt.toLowerCase().replace(/\b(width|depth|height|wall|lid|gap)\s*(?:to|=|:)\s*(\d+(?:\.\d+)?)\s*mm\b|\b(wider|deeper|taller)\s+by\s+(\d+(?:\.\d+)?)\s*mm\b|\b(m3|m4)\b/g, (_m, field, value, deltaField, delta, fastener) => {
    const key = aliases[field || deltaField];
    if (fastener) changes.fastener = fastener.toUpperCase();
    else changes[key] = field ? Number(value) : (changes[key] ?? current[key]) + Number(delta);
    return '';
  }).replace(/\b(make|set|the|it|use|and|please|hardware|screws)\b|[,.]/g, '').trim();
  if (!Object.keys(changes).length || leftovers) throw Error('Supported: “width to 120 mm and height to 40 mm”, “wider by 10 mm”, or “use M4 screws”. Other edits use the dimension fields.');
  return { parameters: validate({ ...current, ...changes }), changes };
}
module.exports = { fields, hardware, validate, model, propose };
