const fs = require("node:fs");
const path = require("node:path");
// Windows cannot spawn .cmd launchers without a shell. Run the known JS CLI instead.
function resolveCommand(
  command,
  args,
  env = process.env,
  platform = process.platform,
) {
  if (platform !== "win32" || !["npm", "corepack"].includes(command))
    return { command, args };
  const suffix =
    command === "npm"
      ? ["npm", "bin", "npm-cli.js"]
      : ["corepack", "dist", "corepack.js"];
  const dirs = (env.PATH || env.Path || "")
    .split(path.delimiter)
    .filter(Boolean);
  const candidates = [
    command === "npm" ? env.npm_execpath : null,
    ...dirs.map((dir) => path.join(dir, "node_modules", ...suffix)),
  ].filter(Boolean);
  const cli = candidates.find((file) => fs.existsSync(file));
  if (!cli)
    throw new Error(
      `${command} is missing. Install it with your Node.js installation before using this adapter.`,
    );
  return { command: process.execPath, args: [cli, ...args] };
}
module.exports = { resolveCommand };
