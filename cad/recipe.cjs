const fs = require('node:fs/promises'), path = require('node:path');
const python = root => path.join(root, '.dino', 'venvs', 'assembly', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
async function recipe(root, action, options = {}) {
  const nodeStep = args => ({ command: process.execPath, args: [path.join(__dirname, 'run.cjs'), root, ...args], cwd: root });
  if (action === 'install') return [nodeStep(['install'])];
  if (action !== 'sample' || !/^[0-9a-f-]{36}$/.test(options.revision || '')) throw Error('Unknown assembly job.');
  const spec = JSON.parse(await fs.readFile(path.join(root, '.dino', 'cad', 'revisions', options.revision + '.json'), 'utf8'));
  const validated = require('./model.cjs').model(spec.parameters);
  if (validated.digest !== spec.digest) throw Error('Saved design changed. Save a new revision.');
  return [nodeStep(['build', options.revision])];
}
module.exports = { recipe, python };
