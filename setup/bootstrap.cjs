const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.join(__dirname, "..");
for (const args of [
  ["submodule", "sync", "--recursive"],
  ["submodule", "update", "--init", "--recursive"],
]) {
  const result = spawnSync("git", args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.error(
      result.error?.message ||
        "Submodule setup failed. Check Git/network access and rerun npm run setup.",
    );
    process.exit(1);
  }
}
console.log(
  "\nDino Lab sources are ready. Run npm start. Install individual runtimes inside the app when needed.",
);
