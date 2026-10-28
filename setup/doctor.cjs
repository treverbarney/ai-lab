const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { resolveCommand } = require("../orchestrator/commands.cjs");
const { tools } = require("../adapters/registry.cjs");
console.log("DINO LAB / environment check\n");
for (const command of [
  "git",
  "node",
  "npm",
  "corepack",
  process.platform === "win32" ? "python" : "python3",
]) {
  let resolved;
  try {
    resolved = resolveCommand(command, ["--version"]);
  } catch {
    console.log(`${command.padEnd(12)} not found`);
    continue;
  }
  const r = spawnSync(resolved.command, resolved.args, {
    encoding: "utf8",
    shell: false,
  });
  console.log(
    `${command.padEnd(12)} ${r.status === 0 ? r.stdout.trim() : "not found — install before using its adapter"}`,
  );
}
for (const tool of tools.filter((t) => t.path))
  console.log(
    `${tool.name.padEnd(24)} ${fs.existsSync(path.join(__dirname, "..", tool.path, ".git")) ? "checked out" : "missing — npm run setup"}`,
  );
