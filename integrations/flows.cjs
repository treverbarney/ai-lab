const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { pluginAction } = require("../plugins/service.cjs");
class Flows {
  constructor(host) {
    this.host = host;
    this.runs = [];
    this.tasks = new Set();
    this.closing = false;
  }
  async submit(input) {
    if (this.closing || this.tasks.size || this.preparing)
      throw Error("A workflow is already active.");
    if (
      !Array.isArray(input.steps) ||
      !input.steps.length ||
      input.steps.length > 8
    )
      throw Error("Use 1–8 steps.");
    this.preparing = true;
    try {
      await this.state();
      const steps = [];
      for (const step of input.steps) {
        const p = await this.host.plugins.approved(step.id);
        if (
          !Object.hasOwn(p.manifest.actions, step.action) ||
          step.action === "install"
        )
          throw Error(
            "Flows may use declared actions; install runtimes separately.",
          );
        steps.push({
          id: step.id,
          action: step.action,
          settings: step.settings
            ? await this.host.plugins.validateSettings(
                p.manifest,
                step.settings,
              )
            : await this.host.plugins.settings(step.id),
          digest: p.digest,
        });
      }
      const run = {
        id: crypto.randomUUID(),
        name: String(input.name || "Dino workflow").slice(0, 100),
        steps,
        state: "running",
        index: 0,
        at: new Date().toISOString(),
      };
      this.runs.unshift(run);
      this.runs = this.runs.slice(0, 30);
      await this.save();
      const task = this.execute(run);
      this.tasks.add(task);
      task.finally(() => this.tasks.delete(task));
      return run;
    } finally {
      this.preparing = false;
    }
  }
  async execute(run) {
    try {
      for (let i = 0; i < run.steps.length; i++) {
        if (run.cancelled || this.closing) throw Error("Workflow cancelled.");
        run.index = i;
        const step = run.steps[i],
          p = await this.host.plugins.approved(step.id);
        if (p.digest !== step.digest)
          throw Error("Plugin changed since this workflow was reviewed.");
        await pluginAction(
          this.host.plugins,
          this.host.runtime,
          this.host.connections,
          step,
        );
        if (step.action !== "start") {
          const job = this.host.runtime.jobs.get(step.id);
          await job.done;
          if (job.state !== "completed")
            throw Error(step.id + ": " + job.state);
        }
        await this.save();
      }
      run.state = "completed";
    } catch (e) {
      run.state = run.cancelled ? "cancelled" : "failed";
      run.error = e.message;
    }
    run.finishedAt = new Date().toISOString();
    await this.save().catch(() => {});
    this.host.runtime.emit("workflow-finished", {
      title: "Dino workflow " + run.state,
      body: run.name,
    });
  }
  async save() {
    const root = this.host.getRoot();
    if (!root) return;
    const file = path.join(root, ".dino", "plugin-flows.json");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(this.runs, null, 2));
  }
  async state() {
    if (!this.runs.length) {
      try {
        this.runs = JSON.parse(
          await fs.readFile(
            path.join(this.host.getRoot(), ".dino", "plugin-flows.json"),
            "utf8",
          ),
        );
        this.runs.forEach((r) => {
          if (r.state === "running") r.state = "interrupted";
        });
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    return this.runs;
  }
  async cancel(id) {
    const run = this.runs.find((r) => r.id === id && r.state === "running");
    if (!run) return;
    run.cancelled = true;
    await this.host.runtime.stop(run.steps[run.index].id);
  }
  async close() {
    this.closing = true;
    for (const r of this.runs)
      if (r.state === "running") await this.cancel(r.id);
    await Promise.allSettled([...this.tasks]);
    this.closing = false;
  }
}
module.exports = { Flows };
