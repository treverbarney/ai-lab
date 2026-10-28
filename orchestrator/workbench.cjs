const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const actions = {
  plate: { id: "cad", action: "sample", label: "Build sample mounting plate" },
  physics: {
    id: "mujoco",
    action: "sample",
    label: "Run sphere-drop validation",
  },
  train: {
    id: "minimind",
    action: "train",
    label: "Run prepared tiny CPU training",
  },
};
class Workbench {
  constructor(getRoot, runtime) {
    this.getRoot = getRoot;
    this.runtime = runtime;
    this.lock = Promise.resolve();
    this.active = new Set();
  }
  async read() {
    const root = this.getRoot();
    if (!root) throw Error("Connect a repository first.");
    try {
      return JSON.parse(
        await fs.readFile(path.join(root, ".dino", "workbench.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      return { projects: [], requests: [], notifications: [] };
    }
  }
  async update(fn) {
    const work = this.lock.then(async () => {
      const root = this.getRoot();
      const data = await this.read();
      const value = await fn(data);
      await fs.mkdir(path.join(root, ".dino"), { recursive: true });
      const file = path.join(root, ".dino", "workbench.json");
      await fs.writeFile(file + ".tmp", JSON.stringify(data, null, 2));
      await fs.rename(file + ".tmp", file);
      return value;
    });
    this.lock = work.catch(() => {});
    return work;
  }
  async execute(op, input = {}) {
    if (op === "state") {
      const data = await this.read();
      for (const r of data.requests)
        if (r.state === "running" && !this.active.has(r.id))
          r.state = "interrupted";
      return { ...data, jobs: this.runtime.snapshot(), actions };
    }
    if (op === "create")
      return this.update((d) => {
        const name = String(input.name || "")
          .trim()
          .slice(0, 100);
        if (!name) throw Error("Name your project.");
        const project = {
          id: crypto.randomUUID(),
          name,
          notes: "",
          artifacts: [],
          markups: {},
          createdAt: new Date().toISOString(),
        };
        d.projects.push(project);
        return project;
      });
    if (op === "save")
      return this.update(async (d) => {
        const p = d.projects.find((p) => p.id === input.id);
        if (!p) throw Error("Unknown project.");
        if (typeof input.notes === "string")
          p.notes = input.notes.slice(0, 20000);
        if (input.file) {
          const source = await this.artifact(input.file);
          if (!p.artifacts.includes(input.file)) {
            const copy =
              p.id + "-" + crypto.randomUUID().slice(0, 8) + "-" + input.file;
            await fs.copyFile(source, path.join(path.dirname(source), copy));
            p.artifacts.push(copy);
          }
        }
        if (input.markup) {
          const { file, strokes } = input.markup;
          if (!p.artifacts.includes(file))
            throw Error("Attach this artifact first.");
          if (
            !Array.isArray(strokes) ||
            strokes.length > 200 ||
            strokes.some(
              (s) =>
                !Array.isArray(s) ||
                s.length > 2000 ||
                s.some(
                  (pt) =>
                    !Array.isArray(pt) ||
                    pt.length !== 2 ||
                    pt.some(
                      (n) =>
                        typeof n !== "number" ||
                        !Number.isFinite(n) ||
                        n < 0 ||
                        n > 1,
                    ),
                ),
            )
          )
            throw Error("Invalid markup.");
          p.markups[file] = strokes;
        }
        return p;
      });
    if (op === "request")
      return this.update((d) => {
        if (!d.projects.some((p) => p.id === input.project))
          throw Error("Choose a project.");
        const prompt = String(input.prompt || "").slice(0, 4000);
        let choices = input.steps;
        if (!choices) {
          choices = [];
          if (/plate|bracket|cad/i.test(prompt)) choices.push("plate");
          if (/physics|simulat|drop/i.test(prompt)) choices.push("physics");
          if (/train|pretrain/i.test(prompt)) choices.push("train");
        }
        if (
          !Array.isArray(choices) ||
          !choices.length ||
          choices.length > 10 ||
          choices.some((x) => !Object.hasOwn(actions, x))
        )
          throw Error(
            "Use plate, physics, or train. Other requests need a custom reviewed workflow.",
          );
        const request = {
          id: crypto.randomUUID(),
          project: input.project,
          prompt,
          steps: choices,
          state: "awaiting-review",
          createdAt: new Date().toISOString(),
        };
        d.requests.push(request);
        return request;
      });
    if (op === "reject")
      return this.update((d) => {
        const r = d.requests.find((r) => r.id === input.id);
        if (!r || r.state !== "awaiting-review")
          throw Error("Request already reviewed.");
        r.state = "rejected";
        return r;
      });
    if (op === "approve") {
      const request = await this.update((d) => {
        const r = d.requests.find((r) => r.id === input.id);
        if (!r || r.state !== "awaiting-review")
          throw Error("Request already reviewed.");
        r.state = "running";
        return { ...r, root: this.getRoot() };
      });
      this.active.add(request.id);
      this.run(request)
        .catch(() => {})
        .finally(() => this.active.delete(request.id));
      return request;
    }
    if (op === "dismiss")
      return this.update((d) => {
        d.notifications = [];
      });
    throw Error("Unknown workbench operation.");
  }
  async artifact(name) {
    if (
      typeof name !== "string" ||
      path.basename(name) !== name ||
      name.startsWith(".")
    )
      throw Error("Invalid artifact.");
    const base = await fs.realpath(
      path.join(this.getRoot(), ".dino", "artifacts"),
    );
    const file = await fs.realpath(path.join(base, name));
    if (!file.startsWith(base + path.sep)) throw Error("Artifact unavailable.");
    return file;
  }
  async run(request) {
    let failure;
    try {
      for (const key of request.steps) {
        if (this.getRoot() !== request.root) throw Error("Workspace changed.");
        const step = actions[key];
        await this.runtime.start(step.id, step.action);
        let job = this.runtime.jobs.get(step.id);
        await job.done;
        if (job.state !== "completed")
          throw Error(`${step.label}: ${job.state}`);
        await this.update(async (d) => {
          const p = d.projects.find((p) => p.id === request.project);
          for (const name of key === "plate"
            ? [
                "dino-mounting-plate.step",
                "dino-mounting-plate.stl",
                "cad-receipt.json",
              ]
            : key === "physics"
              ? ["dino-drop-test.xml", "mujoco-receipt.json"]
              : []) {
            await this.artifact(name);
            const source = await this.artifact(name);
            const copy =
              p.id + "-" + crypto.randomUUID().slice(0, 8) + "-" + name;
            await fs.copyFile(source, path.join(path.dirname(source), copy));
            p.artifacts.push(copy);
          }
        });
      }
    } catch (e) {
      failure = e.message;
    }
    if (this.getRoot() !== request.root) return;
    await this.update((d) => {
      const r = d.requests.find((r) => r.id === request.id);
      r.state = failure ? "failed" : "completed";
      r.error = failure || null;
      d.notifications.unshift({
        id: crypto.randomUUID(),
        request: r.id,
        title: failure ? "Workflow failed" : "Workflow completed",
        text: failure || r.prompt,
        at: new Date().toISOString(),
      });
      d.notifications = d.notifications.slice(0, 100);
    });
    this.runtime.emit("workflow-finished", {
      title: failure ? "Dino workflow failed" : "Dino workflow completed",
      body: failure || request.prompt,
    });
  }
}
module.exports = { Workbench, actions };
