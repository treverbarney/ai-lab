const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
function environment() {
  const home = os.homedir();
  const extra =
    process.platform === "win32"
      ? []
      : [
          "/opt/homebrew/bin",
          "/usr/local/bin",
          "/usr/bin",
          "/bin",
          path.join(home, ".local", "bin"),
          path.join(home, ".volta", "bin"),
        ];
  const nvm = path.join(home, ".nvm", "versions", "node");
  try {
    for (const version of fs
      .readdirSync(nvm)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })))
      extra.push(path.join(nvm, version, "bin"));
  } catch {}
  return {
    ...process.env,
    PATH: [...new Set([process.env.PATH, ...extra].filter(Boolean))].join(
      path.delimiter,
    ),
  };
}
module.exports = { environment };
