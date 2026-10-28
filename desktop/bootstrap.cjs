const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isWorkspace } = require("./workspace.cjs");
class Bootstrap {
  constructor({ directory, env, onLog = () => {} }) {
    Object.assign(this, { directory, env, onLog });
    this.child = null;
    this.pending = null;
  }
  async initialize() {
    if (this.pending) return this.pending;
    this.pending = this.clone();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }
  async clone() {
    const target = path.join(this.directory, "workspace");
    if (await isWorkspace(target)) return target;
    await fs.mkdir(this.directory, { recursive: true });
    const temp = await fs.mkdtemp(
      path.join(this.directory, "workspace-setup-"),
    );
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(
          "git",
          [
            "clone",
            "--depth",
            "1",
            "--branch",
            "codex/desktop-launcher",
            "https://github.com/treverbarney/ai-lab.git",
            temp,
          ],
          {
            env: this.env,
            shell: false,
            detached: process.platform !== "win32",
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        this.child = child;
        child.stdout.on("data", (b) => this.onLog(b.toString()));
        child.stderr.on("data", (b) => this.onLog(b.toString()));
        child.once("error", reject);
        child.once("close", (code) =>
          code === 0
            ? resolve()
            : reject(
                new Error(
                  "Workspace setup failed. Check Git/network access and try again, or connect an existing repository.",
                ),
              ),
        );
      });
      await fs.rename(temp, target);
      return target;
    } finally {
      this.child = null;
      await fs.rm(temp, { recursive: true, force: true });
    }
  }
  async close() {
    if (this.child) {
      try {
        if (process.platform === "win32")
          spawn("taskkill", ["/pid", String(this.child.pid), "/T", "/F"], {
            stdio: "ignore",
          }).on("error", () => {});
        else process.kill(-this.child.pid, "SIGTERM");
      } catch {}
    }
    await this.pending?.catch(() => {});
  }
}
module.exports = { Bootstrap };
