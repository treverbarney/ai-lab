const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { resolveCommand } = require("./commands.cjs");
const { recipe } = require("../adapters/registry.cjs");
class Runtime extends EventEmitter {
  constructor({
    root,
    urls = () => ({}),
    spawnProcess = spawn,
    buildRecipe = recipe,
    env = process.env,
  } = {}) {
    super();
    Object.assign(this, { root, urls, spawnProcess, buildRecipe, env });
    this.jobs = new Map();
    this.starting = new Set();
    this.queue = [];
    this.heavy = null;
    this.closing = false;
    this.draining = Promise.resolve();
  }
  snapshot() {
    return [...this.jobs.values()].map(
      ({ child, stopping, done, finish, root, workspaceRoot, ...job }) => ({
        ...job,
        log: job.log.slice(-30000),
      }),
    );
  }
  log(job, text) {
    job.log = (job.log + text).slice(-30000);
    this.emit("change");
  }
  async start(id, action) {
    const heavy = ["install", "sample", "train"].includes(action);
    if (
      this.queue.some((j) => j.id === id) ||
      this.starting.has(id) ||
      ["running", "stopping"].includes(this.jobs.get(id)?.state)
    )
      throw new Error("This tool already has an active job. Stop it first.");
    if (!heavy) return this.startNow(id, action);
    if (!this.root) throw new Error("Connect a repository first.");
    this.buildRecipe(this.root, id, action, this.urls());
    if (!this.heavy) {
      this.heavy = id;
      try {
        const value = await this.startNow(id, action);
        this.jobs.get(id).done.finally(() => {
          this.heavy = null;
          this.drain();
        });
        return value;
      } catch (e) {
        this.heavy = null;
        this.drain();
        throw e;
      }
    }
    let finish;
    const done = new Promise((resolve) => (finish = resolve));
    const job = {
      id,
      action,
      state: "queued",
      startedAt: new Date().toISOString(),
      log: "Waiting for the heavy-job slot.\n",
      done,
      finish,
      root: this.root,
    };
    this.queue.push(job);
    this.jobs.set(id, job);
    this.emit("change");
    return { id, state: "queued" };
  }
  async drain() {
    if (this.heavy || this.closing) return;
    const next = this.queue.shift();
    if (!next) return;
    if (next.root !== this.root) {
      next.state = "stopped";
      next.finish();
      return this.drain();
    }
    let drainFinished;
    this.draining = new Promise((resolve) => (drainFinished = resolve));
    this.heavy = next.id;
    try {
      await this.startNow(next.id, next.action);
      const job = this.jobs.get(next.id);
      await job.done;
      Object.assign(next, { state: job.state, log: job.log });
    } catch (e) {
      next.state = "failed";
      next.log = e.message;
      this.jobs.set(next.id, next);
    } finally {
      next.finish();
      this.heavy = null;
      drainFinished();
      this.emit("change");
      this.drain();
    }
  }
  async startNow(id, action) {
    if (!this.root) throw new Error("Connect your Dino Lab repository first.");
    const busy = (key) =>
      this.starting.has(key) ||
      ["running", "stopping"].includes(this.jobs.get(key)?.state);
    if (busy(id))
      throw new Error("This tool already has an active job. Stop it first.");
    if (["cad", "mujoco"].includes(id) && busy(id === "cad" ? "mujoco" : "cad"))
      throw new Error(
        "The shared engineering runtime is busy. Finish or stop its current job first.",
      );
    this.starting.add(id);
    try {
      const steps = this.buildRecipe(this.root, id, action, this.urls());
      if (steps[0]) await fs.access(steps[0].cwd);
      if (this.closing) throw Error("Host is stopping.");
      const job = {
        id,
        action,
        state: "running",
        startedAt: new Date().toISOString(),
        log: "",
        exitCode: null,
        child: null,
        stopping: false,
        workspaceRoot: this.root,
      };
      this.jobs.set(id, job);
      this.emit("change");
      job.done = this.run(job, steps);
      return { id, state: job.state };
    } finally {
      this.starting.delete(id);
    }
  }
  async run(job, steps) {
    try {
      for (const step of steps) {
        if (job.stopping) break;
        await fs.access(step.cwd);
        this.log(job, `$ ${step.command} ${step.args.join(" ")}\n`);
        const code = await new Promise((resolve, reject) => {
          const resolved = resolveCommand(step.command, step.args, this.env);
          const child = this.spawnProcess(resolved.command, resolved.args, {
            cwd: step.cwd,
            env: {
              ...this.env,
              ELECTRON_RUN_AS_NODE: "1",
              PYTHONUNBUFFERED: "1",
              SASS_PATH: step.cwd,
              CADGEN_TELEMETRY: "0",
              CADGEN_UPDATE_CHECK: "0",
              OMP_NUM_THREADS: "2",
              OPENBLAS_NUM_THREADS: "2",
              MKL_NUM_THREADS: "2",
            },
            shell: false,
            detached: process.platform !== "win32",
            stdio: ["ignore", "pipe", "pipe"],
          });
          job.child = child;
          child.stdout?.on("data", (b) => this.log(job, b.toString()));
          child.stderr?.on("data", (b) => this.log(job, b.toString()));
          child.once("error", reject);
          child.once("close", resolve);
        });
        job.child = null;
        job.exitCode = code;
        if (code !== 0 && !job.stopping)
          throw new Error(
            `Process exited (${code}). Check the log. Missing commands must be installed on your computer.`,
          );
      }
      job.state = job.stopping ? "stopped" : "completed";
      this.log(job, `\n${job.state === "completed" ? "Done." : "Stopped."}\n`);
    } catch (error) {
      job.state = job.stopping ? "stopped" : "failed";
      this.log(job, `${error.message}\n`);
    } finally {
      job.child = null;
      job.finishedAt = new Date().toISOString();
      this.emit("change");
      this.emit("job-finished", {
        title: `Dino ${job.state}`,
        body: `${job.id}: ${job.action}`,
        job: job.id,
      });
      try {
        const destination = path.join(job.workspaceRoot, ".dino", "receipts");
        await fs.mkdir(destination, { recursive: true });
        const receipt = this.snapshot().find((x) => x.id === job.id);
        const { log, ...metadata } = receipt;
        await fs.writeFile(
          path.join(destination, `${Date.now()}-${job.id}.json`),
          JSON.stringify(metadata, null, 2),
        );
      } catch (error) {
        this.log(job, `Could not save receipt: ${error.message}\n`);
      }
    }
  }
  async stop(id) {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.state === "queued") {
      this.queue = this.queue.filter((j) => j !== job);
      job.state = "stopped";
      job.finish();
      this.emit("change");
      return;
    }
    if (job.state === "stopping") return job.done;
    if (job.state !== "running") return;
    job.stopping = true;
    job.state = "stopping";
    this.emit("change");
    const child = job.child;
    if (!child) return job.done;
    const kill = (force) => {
      try {
        if (process.platform === "win32")
          spawn(
            "taskkill",
            ["/pid", String(child.pid), "/T", ...(force ? ["/F"] : [])],
            { stdio: "ignore", windowsHide: true },
          ).on("error", () => {});
        else process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
      } catch {
        /* Process has already exited. */
      }
    };
    kill(false);
    const timer = setTimeout(() => kill(true), 2500);
    try {
      await job.done;
    } finally {
      clearTimeout(timer);
    }
  }
  async close() {
    this.closing = true;
    try {
      await Promise.all([...this.jobs.keys()].map((id) => this.stop(id)));
      await this.draining;
    } finally {
      this.closing = false;
    }
  }
}
module.exports = { Runtime };
