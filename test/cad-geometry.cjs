const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { model } = require('../cad/model.cjs'), { python } = require('../cad/recipe.cjs');
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dino-geometry-'));
  try {
    const variants = [{}, { width: 60, depth: 45, height: 20, wall: 2, lid: 2, gap: 0.1, pinClearance: 0.05, fastener: 'M4' }, { width: 180, depth: 120, height: 80, wall: 5, lid: 6, gap: 1.5, pinClearance: 0.6 }];
    for (let i = 0; i < variants.length; i++) await fs.writeFile(path.join(dir, `variant-${i}.json`), JSON.stringify(model(variants[i])));
    const script = `import sys,json\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom build import build,analyze\nfrom build123d import Pos,Box\nfor f in sorted(Path(sys.argv[2]).glob('variant-*.json')):\n s=json.loads(f.read_text());p=build(s);r=analyze(p,s);assert r['passed'],(f.name,r);assert all(len(x.solids())==1 for x in p.values());assert 0 < r['clearances_mm']['base_to_lid_closed'] <= s['parameters']['gap']+1e-5;assert abs(r['clearances_mm']['pin_to_lid']-s['parameters']['pinClearance'])<1e-5;print('PASS',f.name,flush=True)\np['screw-1']=Pos(0,0,s['parameters']['wall']/2)*Box(2,2,2)\nr=analyze(p,s);assert not r['passed'];assert any(x['a']=='base' and x['b']=='screw-1' for x in r['static_collisions']);print('PASS intentional overlap is detected',flush=True)\n`;
    await fs.writeFile(path.join(dir, 'check.py'), script);
    const r = spawnSync(python(path.join(__dirname, '..')), [path.join(dir, 'check.py'), path.join(__dirname, '..', 'cad'), dir], { encoding: 'utf8', timeout: 120000, env: { ...process.env, OMP_NUM_THREADS: '2', OPENBLAS_NUM_THREADS: '2' } });
    process.stdout.write(r.stdout || ''); assert.equal(r.status, 0, r.stderr || r.error?.message);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
