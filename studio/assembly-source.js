import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const $ = s => document.querySelector(s);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
let state, design, selected, dirty = false, previewGeneration = 0, pendingReview, exactKey, refreshTimer;
const hidden = new Set();
function message(text, error = false) { $('#status').textContent = text; $('#status').dataset.error = String(error); }
async function api(data, fusion = false) {
  const response = await fetch('/api/cad' + (fusion ? '/fusion' : ''), { method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'Host request failed.');
  return value;
}
function action(selector, fn) {
  $(selector).addEventListener('click', async event => { const b = event.currentTarget; b.disabled = true; try { await fn(); } catch (e) { message(e.message, true); } finally { b.disabled = false; updateActions(); } });
}
function review(title, rows, approve) {
  $('#review-title').textContent = title; $('#review-content').replaceChildren(...rows);
  pendingReview = approve; $('#review-dialog').showModal();
}
function changeRow(name, before, after) { const n = el('div', undefined, 'change-row'); n.append(el('span', name), el('strong', `${before} → ${after}`)); return n; }
function parameters() {
  const p = { name: $('#name').value, fastener: $('#fastener').value };
  for (const key of Object.keys(state.fields)) p[key] = Number($('#p-' + key).value);
  return p;
}
function fill(p) {
  $('#name').value = p.name; $('#fastener').value = p.fastener;
  for (const key of Object.keys(state.fields)) $('#p-' + key).value = p[key];
}
function updateActions() {
  if (!state) return;
  const active = ['running', 'queued', 'stopping'].includes(state.job?.state);
  $('#build').disabled = active || dirty || !state.current || !state.ready;
  $('#install').disabled = active; $('#install').hidden = state.ready;
  $('#stop').hidden = !active; $('#save').disabled = !dirty && Boolean(state.current);
  $('#save').textContent = state.current ? 'Save revision' : 'Save first revision';
  $('#design-title').textContent = (design?.parameters.name || 'Hinged enclosure') + (dirty ? ' · unsaved' : state.current ? ' · r' + state.current.number : '');
  $('#log').textContent = state.job?.log || 'No job yet.';
}
let viewer;
class AssemblyViewer {
  constructor() {
    this.container = $('#viewport'); this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#18211b'); this.groups = new Map();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 3000); this.camera.up.set(0, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xf2f7eb, 0x46554b, 2.5)); const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(70, -70, 160); this.scene.add(light);
    const grid = new THREE.GridHelper(400, 40, '#53634e', '#303f32'); grid.rotation.x = Math.PI / 2; grid.position.z = -14; this.scene.add(grid);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = false; this.controls.addEventListener('change', () => this.render());
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.container);
    let down;
    this.container.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    this.container.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const b = this.container.getBoundingClientRect(), ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1), this.camera);
      const hit = ray.intersectObjects([...this.groups.values()].filter(g => g.visible), true)[0];
      if (hit) select(hit.object.userData.id);
    });
    this.resize();
  }
  render() { this.renderer.render(this.scene, this.camera); }
  resize() { const w = this.container.clientWidth, h = this.container.clientHeight; if (!w || !h) return; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h, false); this.render(); }
  clear() { for (const group of this.groups.values()) { this.scene.remove(group); group.traverse(n => { n.geometry?.dispose(); n.material?.dispose(); }); } this.groups.clear(); }
  load(model, exact) {
    this.clear(); this.model = model;
    for (const c of model.components) {
      const group = new THREE.Group(); group.userData.component = c; this.groups.set(c.id, group); this.scene.add(group);
      const material = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.55, metalness: c.group === 'hardware' ? 0.5 : 0.05 });
      const data = exact?.meshes.find(m => m.id === c.id);
      if (data) {
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3)); geometry.setIndex(data.triangles); geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material); mesh.userData.id = c.id; group.add(mesh);
      } else for (const p of c.add) {
        const geometry = p.type === 'box' ? new THREE.BoxGeometry(...p.size) : new THREE.CylinderGeometry(p.radius, p.radius, p.length, p.type === 'hex' ? 6 : 24);
        const mesh = new THREE.Mesh(geometry, material.clone());
        if (p.type !== 'box') { if (p.axis === 'x') mesh.rotation.z = Math.PI / 2; else mesh.rotation.x = Math.PI / 2; }
        mesh.position.set(...p.at); mesh.userData.id = c.id; group.add(mesh);
      }
      if (!data) material.dispose();
    }
    this.pose(); this.highlight(selected); this.visibility();
  }
  pose() {
    if (!this.model) return;
    const pivot = new THREE.Vector3(...this.model.joints[0].pivot), angle = Number($('#angle').value) * Math.PI / 180, explode = Number($('#explode').value);
    for (const [id, g] of this.groups) {
      g.rotation.set(0, 0, 0); g.position.set(0, 0, 0);
      if (id === 'lid') { g.rotation.x = angle; const moved = pivot.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), angle); g.position.copy(pivot).sub(moved); g.position.z += explode; }
      else if (id === 'pin') { g.position.x += explode; }
      else if (id.startsWith('screw')) g.position.z += explode * 0.5;
      else if (id.startsWith('nut')) g.position.z -= explode * 0.5;
    }
    this.render();
  }
  highlight(id) { for (const [key, g] of this.groups) g.traverse(n => { if (n.isMesh) { n.material.emissive.set(key === id ? '#324b26' : '#000000'); n.material.emissiveIntensity = 0.7; } }); this.render(); }
  visibility() { for (const [id, g] of this.groups) g.visible = !hidden.has(id); this.render(); }
  fit() { const p = this.model?.parameters || { width: 100, depth: 70, height: 35 }; const scale = Math.max(p.width, p.depth, p.height); this.camera.position.set(scale * 1.45, scale * 1.75, scale * 1.5); this.controls.target.set(0, 0, p.height / 2); this.controls.update(); this.render(); }
  destroy() { this.observer.disconnect(); this.controls.dispose(); this.clear(); this.renderer.dispose(); }
}
function select(id) { selected = id; $('#selection').textContent = design.components.find(c => c.id === id)?.name || 'All components'; viewer?.highlight(id); for (const b of document.querySelectorAll('[data-part]')) b.setAttribute('aria-pressed', String(b.dataset.part === id)); }
function paintModel(m, exact) {
  design = m; $('#part-count').textContent = `${m.components.length} PARTS`; $('#components').replaceChildren();
  for (const c of m.components) {
    const row = el('div', undefined, 'part-row'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = !hidden.has(c.id); checkbox.setAttribute('aria-label', 'Show ' + c.name);
    checkbox.addEventListener('change', () => { if (checkbox.checked) hidden.delete(c.id); else hidden.add(c.id); viewer?.visibility(); });
    const button = el('button', c.name); button.dataset.part = c.id; button.setAttribute('aria-pressed', String(selected === c.id)); button.append(el('small', c.group === 'housing' ? 'PARAMETRIC PART' : 'STANDARD / SIMPLIFIED')); button.addEventListener('click', () => select(c.id));
    row.append(checkbox, button); $('#components').append(row);
  }
  $('#joints').replaceChildren();
  const hinge = el('div', undefined, 'joint-row'); hinge.append(el('strong', 'Base → lid'), el('span', 'Revolute · 0–110° · X axis')); $('#joints').append(hinge);
  const fixed = el('div', undefined, 'joint-row'); fixed.append(el('strong', `${m.joints.length - 1} fixed connections`), el('span', 'Mounting hardware & pin → base')); $('#joints').append(fixed);
  $('#bom').replaceChildren(); for (const r of m.bom) { const tr = el('tr'), td = el('td', r.description); td.append(el('small', r.part)); tr.append(td, el('td', r.quantity), el('td', r.material)); $('#bom').append(tr); }
  $('#bom-count').textContent = m.bom.length + ' LINE ITEMS'; viewer?.load(m, exact);
  $('#preview-label').textContent = exact ? 'EXACT CAD GEOMETRY' : 'DRAFT PREVIEW';
  $('#preview-note').textContent = exact ? 'Exact exported geometry · drag to orbit / pinch to zoom. Angle and explode controls are visual only.' : 'Draft preview omits cuts. Build once for exact geometry, holes, and fit checks.';
  document.body.dataset.exact = String(Boolean(exact)); updateActions();
}
async function preview() {
  const generation = ++previewGeneration;
  try {
    const m = await api({ op: 'preview', parameters: parameters() }); if (generation !== previewGeneration) return;
    dirty = m.digest !== state.current?.digest; exactKey = null; paintModel(m); paintChecks();
    message(dirty ? 'Unsaved dimensions · save a revision before building.' : 'Saved dimensions restored.');
  } catch (e) { dirty = true; updateActions(); $('#build').disabled = true; message(e.message, true); }
}
function check(label, value, bad = false) { const n = el('div', label, 'check' + (bad ? ' fail' : '')); n.append(el('span', value)); return n; }
function download(name, text) { const a = el('a', text); a.href = '/api/download?name=' + encodeURIComponent(name); a.setAttribute('download', name); return a; }
function paintChecks() {
  const result = !dirty && state.result?.digest === design.digest ? state.result : null; $('#checks').replaceChildren(); $('#exports').replaceChildren();
  $('#check-badge').textContent = result ? result.checks.passed ? 'CHECKS PASSED' : 'REVIEW INTERFERENCE' : 'NOT BUILT';
  if (!result) { $('#checks').append(el('p', 'Build this saved revision for exact interference, clearance, and STEP round-trip checks.')); return; }
  const c = result.checks;
  $('#checks').append(check('Static solid interference', c.static_collisions.length ? c.static_collisions.length + ' overlaps' : 'No overlaps', Boolean(c.static_collisions.length)));
  for (const collision of c.static_collisions) {
    const row = el('div', `${collision.a} ↔ ${collision.b}: ${collision.volume_mm3.toFixed(3)} mm³`, 'check fail'), b = el('button', 'Highlight ' + collision.a); b.addEventListener('click', () => select(collision.a)); row.append(b); $('#checks').append(row);
  }
  $('#checks').append(check('Closed lid minimum distance', c.clearances_mm.base_to_lid_closed.toFixed(3) + ' mm'), check('Pin to lid minimum distance', c.clearances_mm.pin_to_lid.toFixed(3) + ' mm'));
  for (const pose of c.sampled_motion) $('#checks').append(check('Hinge at ' + pose.angle_deg + '°', pose.collisions.length ? pose.collisions.length + ' overlaps' : 'No overlaps', Boolean(pose.collisions.length)));
  $('#checks').append(check('STEP export → reimport', result.step_roundtrip.passed ? 'Passed' : 'Failed'), check('Estimated solid mass', result.estimated_mass_g.toFixed(1) + ' g'), el('p', result.mass_note, 'hint'));
  for (const [key, label] of [['step', 'STEP ↗'], ['stl', 'STL ↗'], ['source', 'Editable source ↗'], ['bom', 'BOM CSV ↗']]) $('#exports').append(download(result.files[key], label));
  $('#exports').append(download('assembly-' + result.revision + '-report.json', 'Check report ↗'));
}
function paintHistory() {
  $('#revisions').replaceChildren();
  for (const r of state.revisions) {
    const row = el('div', undefined, 'revision-row'), label = el('div', `r${r.number} · ${r.parameters.name}`); label.append(el('small', `${r.parameters.width} × ${r.parameters.depth} × ${r.parameters.height} mm · ${r.parameters.fastener} · ${new Date(r.at).toLocaleString()}`)); row.append(label);
    if (r.id === state.current.id) row.append(el('span', 'Current'));
    else { const b = el('button', 'Restore as new revision'); b.addEventListener('click', () => review('Restore revision ' + r.number, [el('p', 'Create a new revision with these dimensions. Existing revisions and exports remain available.')], async () => { await api({ op: 'restore', id: r.id, expected: state.current.id }); await refresh(true); message('Restored as a new revision.'); })); row.append(b); }
    $('#revisions').append(row);
  }
}
async function refresh(replace = false) {
  const next = await api();
  if (dirty && !replace && state) { next.current = state.current; next.model = state.model; next.revisions = state.revisions; }
  const changed = next.current?.id !== state?.current?.id;
  state = next;
  if (replace || changed) { previewGeneration++; fill(state.model.parameters); dirty = false; paintModel(state.model); exactKey = null; paintHistory(); }
  updateActions(); paintChecks();
  if (!dirty && state.result && state.result.digest === design.digest && exactKey !== state.result.revision) {
    const key = state.result.revision;
    const r = await fetch('/api/download?name=' + encodeURIComponent(state.result.files.mesh));
    if (!r.ok) throw Error('Exact preview unavailable.'); const data = await r.json();
    if (data.digest !== design.digest || dirty) return;
    paintModel(design, data); exactKey = key;
  }
}
function fusionView(snapshot) {
  $('#fusion-document').replaceChildren(el('h3', snapshot.document.name || 'Active Fusion design'), el('p', `Units: ${snapshot.document.units || 'native'} · ${snapshot.document.design_type || 'design'} · ${snapshot.bodies.length} root bodies`));
  $('#fusion-parameter').replaceChildren(); $('#fusion-parameters').replaceChildren();
  for (const p of snapshot.parameters) {
    const o = el('option', p.name); o.value = p.name; o.dataset.expression = p.expression; $('#fusion-parameter').append(o);
    const row = el('div', p.name, 'parameter-row'); row.append(el('span', p.expression)); $('#fusion-parameters').append(row);
  }
  if (!snapshot.parameters.length) $('#fusion-parameters').append(el('p', 'No user parameters in this design.'));
  $('#fusion-expression').value = snapshot.parameters[0]?.expression || '';
  for (const s of ['#body-a', '#body-b']) { $(s).replaceChildren(); for (const b of snapshot.bodies) { const o = el('option', b.name); o.value = b.name; $(s).append(o); } }
  if (snapshot.bodies.length > 1) $('#body-b').selectedIndex = 1;
}
async function start() {
  try {
    state = await api();
    for (const [key, f] of Object.entries(state.fields)) { const label = el('label', f.label), input = el('input'); input.id = 'p-' + key; input.type = 'number'; input.min = f.min; input.max = f.max; input.step = key === 'gap' || key === 'pinClearance' ? '0.05' : '0.5'; label.append(input); $('#fields').append(label); }
    fill(state.model.parameters); dirty = !state.current;
    try { viewer = new AssemblyViewer(); } catch { $('#viewport').append(el('p', '3D preview unavailable. Enable WebGL; dimensions, exports and checks still work.')); }
    paintModel(state.model); viewer?.fit(); paintHistory(); paintChecks();
    for (const n of document.querySelectorAll('.parameters input,.parameters select')) n.addEventListener('input', () => { dirty = true; previewGeneration++; updateActions(); clearTimeout(refreshTimer); refreshTimer = setTimeout(preview, 180); });
    if (state.current) await refresh();
    message(state.ready ? 'Ready · CAD jobs share the existing low-compute queue.' : 'Preview is ready. Install the CAD engine only when you want exact exports and checks.');
    document.body.dataset.ready = 'true';
    const events = new EventSource('/api/events');
    let lastJob;
    events.addEventListener('jobs', e => {
      const job = JSON.parse(e.data).find(j => j.id === 'cad-assembly'), signature = JSON.stringify(job);
      if (!job || signature === lastJob || document.hidden) return; lastJob = signature;
      refresh().then(() => {
        if (job.state === 'completed') message(job.action === 'install' ? 'CAD engine installed. Save your design, then build.' : 'Build finished. Inspect the checks and download your assembly.');
        else if (job.state === 'failed') message('CAD job failed. Open the job log for details.', true);
      }).catch(e => message(e.message, true));
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh().catch(e => message(e.message, true)); });
    window.addEventListener('beforeunload', () => { events.close(); viewer?.destroy(); });
  } catch (e) { message(e.message + ' Open Phone access in Dino desktop and pair this browser first.', true); }
}
action('#save', async () => { const p = parameters(); await api({ op: 'save', parameters: p, expected: state.current?.id || null }); await refresh(true); message('Revision saved. Ready to build.'); });
action('#install', async () => { await api({ op: 'install' }); await refresh(); message('Installing the isolated CAD engine. Progress is in the job log.'); });
action('#build', async () => { await api({ op: 'build', id: state.current.id }); await refresh(); message('Building exact geometry and checking the assembly…'); });
action('#stop', async () => { await api({ op: 'stop' }); await refresh(); message('CAD job stopped.'); });
action('#reset', async () => { const p = { ...parameters() }; for (const [key, f] of Object.entries(state.fields)) p[key] = f.default; p.fastener = 'M3'; fill(p); await preview(); });
action('#fit', () => viewer?.fit());
function visibility() { for (const row of document.querySelectorAll('.part-row')) row.querySelector('input').checked = !hidden.has(row.querySelector('button').dataset.part); viewer?.visibility(); }
action('#isolate', () => { if (!selected) throw Error('Select a component first.'); for (const c of design.components) if (c.id !== selected) hidden.add(c.id); hidden.delete(selected); visibility(); });
action('#show-all', () => { hidden.clear(); visibility(); });
$('#angle').addEventListener('input', () => { $('#angle-label').textContent = $('#angle').value + '°'; viewer?.pose(); });
$('#explode').addEventListener('input', () => viewer?.pose());
$('#intent-form').addEventListener('submit', async e => {
  e.preventDefault();
  try { const base = parameters(), expected = state.current?.id || null, proposal = await api({ op: 'propose', parameters: base, prompt: $('#intent').value });
    review('Review dimension changes', Object.entries(proposal.changes).map(([k, v]) => changeRow(state.fields[k]?.label || 'Hardware', base[k], v)), async () => { await api({ op: 'save', parameters: proposal.parameters, expected }); await refresh(true); message('Changes saved as a revision. Build to check the new geometry.'); });
  } catch (e) { message(e.message, true); }
});
$('#source-import').addEventListener('change', async () => {
  try {
    const file = $('#source-import').files[0]; if (!file) return;
    if (file.size > 256 * 1024) throw Error('Source JSON is limited to 256 KB.');
    const expected = state.current?.id || null, m = await api({ op: 'import', source: JSON.parse(await file.text()) });
    review('Reopen editable source', [el('p', `${m.parameters.name} · ${m.parameters.width} × ${m.parameters.depth} × ${m.parameters.height} mm · ${m.parameters.fastener}`), el('p', 'Save these parameters as a revision. Geometry is rebuilt by the trusted template; imported construction code is never executed.')], async () => { await api({ op: 'save', parameters: m.parameters, expected }); await refresh(true); message('Source reopened as an editable revision.'); });
  } catch (e) { message(e.message, true); }
  finally { $('#source-import').value = ''; }
});
$('#cancel-review').addEventListener('click', () => { pendingReview = null; $('#review-dialog').close(); });
action('#approve-review', async () => { const fn = pendingReview; pendingReview = null; $('#review-dialog').close(); if (fn) await fn(); });
function tab(fusion) { $('#design-pane').hidden = fusion; $('#fusion-pane').hidden = !fusion; $('#design-tab').setAttribute('aria-selected', String(!fusion)); $('#fusion-tab').setAttribute('aria-selected', String(fusion)); if (!fusion) viewer?.resize(); }
action('#design-tab', () => tab(false)); action('#fusion-tab', () => tab(true));
action('#fusion-connect', async () => { message('Connecting to the Fusion MCP bridge…'); fusionView(await api({ op: 'connect' }, true)); message('Connected to Fusion. Native document loaded.'); });
action('#fusion-refresh', async () => { fusionView(await api({ op: 'snapshot' }, true)); message('Fusion design refreshed.'); });
$('#fusion-parameter').addEventListener('change', () => { $('#fusion-expression').value = $('#fusion-parameter').selectedOptions[0]?.dataset.expression || ''; });
$('#fusion-parameter-form').addEventListener('submit', async e => {
  e.preventDefault(); try {
    const r = await api({ op: 'review', name: $('#fusion-parameter').value, expression: $('#fusion-expression').value }, true);
    review('Apply to ' + r.document.name + '?', [changeRow(r.name, r.before, r.after), el('p', 'This changes the open Fusion design. Review the model in Fusion after applying.')], async () => { const result = await api({ op: 'apply', id: r.id }, true); fusionView(result.snapshot); message('Fusion parameter updated and recomputed.'); });
  } catch (error) { message(error.message, true); }
});
action('#body-info', async () => { $('#fusion-result').textContent = JSON.stringify(await api({ op: 'body', name: $('#body-a').value }, true), null, 2); });
action('#measure', async () => { const result = await api({ op: 'clearance', bodies: [$('#body-a').value, $('#body-b').value] }, true); $('#fusion-result').textContent = JSON.stringify(result, null, 2); });
start();
