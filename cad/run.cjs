const fs = require('node:fs/promises'), path = require('node:path');
const { spawn } = require('node:child_process');
const { python } = require('./recipe.cjs');
const [root, action, revision] = process.argv.slice(2);
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: false });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(Error('Assembly process exited ' + code)));
  });
}
(async () => {
  if (action === 'install') {
    await run(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'venv', path.join(root, '.dino', 'venvs', 'assembly')]);
    await run(python(root), ['-m', 'pip', 'install', 'build123d==0.13.0']);
    await run(python(root), ['-c', 'import build123d; assert build123d.__version__ == "0.13.0"']);
    await fs.writeFile(path.join(root, '.dino', 'venvs', 'assembly', 'dino-ready'), '0.13.0');
    return;
  }
  if (action !== 'build' || !/^[0-9a-f-]{36}$/.test(revision || '')) throw Error('Invalid assembly job.');
  const original = JSON.parse(await fs.readFile(path.join(root, '.dino', 'cad', 'revisions', revision + '.json'), 'utf8'));
  const spec = require('./model.cjs').model(original.parameters);
  if (spec.digest !== original.digest) throw Error('Revision digest mismatch.');
  const bin = path.join(root, '.dino', 'cad', 'bin'); await fs.mkdir(bin, { recursive: true });
  // Scripts must be materialized outside app.asar for the Python interpreter.
  await fs.copyFile(path.join(__dirname, 'build.py'), path.join(bin, 'build.py'));
  const input = path.join(bin, revision + '.json'); await fs.writeFile(input, JSON.stringify(spec));
  try { await fs.access(python(root)); } catch { throw Error('Install the assembly engine from CAD & assembly first.'); }
  await run(python(root), [path.join(bin, 'build.py'), input, path.join(root, '.dino', 'artifacts'), revision]);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
