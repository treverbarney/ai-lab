const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { tools } = require("../adapters/registry.cjs");
const ACTIONS = new Set([
  "install",
  "start",
  "sample",
  "train",
  "run",
  "check",
]);
const idPattern = /^plugin-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
function text(v, max = 200) {
  if (typeof v !== "string" || !v.trim() || v.length > max || v.includes("\0"))
    throw Error("Invalid plugin text.");
  return v;
}
function command(v) {
  if (!plain(v))
    throw Error("Each command needs command, args and optional cwd.");
  text(v.command, 1000);
  if (
    !Array.isArray(v.args) ||
    v.args.length > 100 ||
    v.args.some(
      (a) => typeof a !== "string" || a.length > 4000 || a.includes("\0"),
    )
  )
    throw Error("Command args must be a bounded array of strings.");
  if (v.cwd !== undefined) text(v.cwd, 1000);
  if (/\$\{setting:/.test(v.command) || /\$\{setting:/.test(v.cwd || ""))
    throw Error("Settings can only substitute command arguments.");
  for (const value of [v.command, ...v.args, v.cwd || ""])
    if (
      /\$\{(?!plugin\}|workspace\}|artifacts\}|node\}|app\}|setting:[a-z][a-zA-Z0-9]*\})/.test(
        value,
      )
    )
      throw Error("Unknown plugin placeholder.");
}
function validateFields(fields) {
  if (!plain(fields) || Object.keys(fields).length > 12)
    throw Error("Invalid settings schema.");
  for (const [key, f] of Object.entries(fields)) {
    if (
      !/^[a-z][a-zA-Z0-9]*$/.test(key) ||
      !plain(f) ||
      !["integer", "text", "artifact", "enum"].includes(f.type)
    )
      throw Error("Invalid setting field.");
    text(f.label, 80);
    if (
      f.type === "integer" &&
      (!Number.isInteger(f.min) || !Number.isInteger(f.max) || f.min > f.max)
    )
      throw Error("Integer settings need a range.");
    if (
      f.type === "artifact" &&
      (!Array.isArray(f.extensions) ||
        f.extensions.some((x) => typeof x !== "string" || !/^\w+$/.test(x)))
    )
      throw Error("Artifact settings need extensions.");
    if (
      f.type === "enum" &&
      (!Array.isArray(f.options) ||
        !f.options.length ||
        f.options.some((x) => typeof x !== "string"))
    )
      throw Error("Enum settings need options.");
  }
}
function validate(m) {
  if (
    !plain(m) ||
    m.schemaVersion !== 1 ||
    !idPattern.test(m.id) ||
    m.id.length > 80 ||
    tools.some((t) => t.id === m.id)
  )
    throw Error("Use schemaVersion 1 and a unique plugin- prefixed id.");
  text(m.name, 80);
  text(m.version, 40);
  text(m.description, 1000);
  if (m.homepage !== undefined) {
    const u = new URL(text(m.homepage, 1000));
    if (u.protocol !== "https:" || u.username || u.password)
      throw Error("Homepage must be an HTTPS address.");
  }
  if (!plain(m.actions) || Object.keys(m.actions).length > 6)
    throw Error("Provide an actions object.");
  for (const [key, action] of Object.entries(m.actions)) {
    if (!ACTIONS.has(key) || !plain(action))
      throw Error("Unsupported plugin action.");
    text(action.label, 80);
    if (
      !Array.isArray(action.steps) ||
      !action.steps.length ||
      action.steps.length > 10
    )
      throw Error("Actions need 1–10 steps.");
    action.steps.forEach(command);
  }
  if (m.settings !== undefined) validateFields(m.settings);
  if (m.resources !== undefined) text(m.resources, 1000);
  if (m.view !== undefined) {
    if (!plain(m.view)) throw Error("Invalid view.");
    if (
      m.view.port !== undefined &&
      (!Number.isInteger(m.view.port) ||
        m.view.port < 1024 ||
        m.view.port > 65535)
    )
      throw Error("Invalid view port.");
    if (
      m.view.path !== undefined &&
      (typeof m.view.path !== "string" ||
        !m.view.path.startsWith("/") ||
        m.view.path.startsWith("//") ||
        /[?#\\]/.test(m.view.path) ||
        m.view.path.includes(".."))
    )
      throw Error("Invalid view path.");
    if (
      !m.view.port &&
      !["/studio/cad.html", "/studio/flows.html"].includes(m.view.path)
    )
      throw Error("Use a supported bundled view or a loopback port.");
  }
  if (m.mcp !== undefined) command(m.mcp);
  if (!Object.keys(m.actions).length && !m.mcp)
    throw Error("Declare at least one action or MCP server.");
  return m;
}
// Hash every package file. Changed scripts, not only changed manifests, need review.
async function inspect(directory) {
  const files = [];
  let bytes = 0;
  async function walk(dir, prefix = "") {
    const entries = (await fs.readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      if (entry.isSymbolicLink())
        throw Error("Plugin packages cannot contain symlinks.");
      const relative = prefix + entry.name;
      if (relative.split("/").length > 8)
        throw Error("Plugin folder is too deep.");
      if (entry.isDirectory())
        await walk(path.join(dir, entry.name), relative + "/");
      else if (entry.isFile()) {
        if (files.length >= 100)
          throw Error(
            "Plugin packages support at most 100 files. Keep engines outside the adapter.",
          );
        const file = path.join(dir, entry.name);
        const stat = await fs.lstat(file);
        bytes += stat.size;
        if (bytes > 10 * 1024 * 1024)
          throw Error(
            "Plugin adapter exceeds 10 MB. Keep upstream projects outside the adapter.",
          );
        const content = await fs.readFile(file);
        files.push({ relative, content });
      } else throw Error("Unsupported plugin file.");
    }
  }
  if (!(await fs.lstat(directory)).isDirectory())
    throw Error("Choose a real plugin directory.");
  await walk(directory);
  const manifest = files.find((f) => f.relative === "dino-plugin.json");
  if (!manifest || manifest.content.length > 32768)
    throw Error("A small dino-plugin.json is required.");
  const data = validate(JSON.parse(manifest.content.toString("utf8")));
  const hash = crypto.createHash("sha256");
  for (const f of files)
    hash
      .update(JSON.stringify([f.relative, f.content.length]))
      .update(f.content);
  return {
    manifest: data,
    digest: hash.digest("hex"),
    files: files.length,
    bytes,
  };
}
class Plugins {
  constructor(getRoot) {
    this.getRoot = getRoot;
    this.lock = Promise.resolve();
  }
  root() {
    const root = this.getRoot();
    if (!root) throw Error("Connect a workspace first.");
    return path.resolve(root);
  }
  async base() {
    const root = this.root();
    const dir = path.join(root, ".dino", "plugins");
    await fs.mkdir(dir, { recursive: true });
    const real = await fs.realpath(dir);
    const workspace = await fs.realpath(root);
    if (!real.startsWith(workspace + path.sep))
      throw Error("Plugin directory must stay inside the workspace.");
    return real;
  }
  async data() {
    try {
      const d = JSON.parse(
        await fs.readFile(
          path.join(this.root(), ".dino", "plugins-state.json"),
          "utf8",
        ),
      );
      if (!plain(d)) throw Error("Invalid plugin approvals.");
      return d;
    } catch (e) {
      if (e.code === "ENOENT") return {};
      throw e;
    }
  }
  mutate(fn) {
    const op = this.lock.then(async () => {
      const data = await this.data();
      const result = await fn(data);
      const target = path.join(this.root(), ".dino", "plugins-state.json");
      await fs.writeFile(target + ".tmp", JSON.stringify(data, null, 2), {
        mode: 0o600,
      });
      await fs.rename(target + ".tmp", target);
      return result;
    });
    this.lock = op.catch(() => {});
    return op;
  }
  async package(id) {
    if (!idPattern.test(id)) throw Error("Unknown plugin.");
    const directory = path.join(await this.base(), id);
    const entry = await inspect(directory);
    if (entry.manifest.id !== id)
      throw Error("Plugin directory and manifest id must match.");
    return { ...entry, directory };
  }
  async list(review = false) {
    if (!this.getRoot()) return [];
    const base = await this.base();
    const data = await this.data();
    const result = [];
    for (const dir of (await fs.readdir(base))
      .filter((n) => idPattern.test(n))
      .sort()) {
      try {
        const p = await this.package(dir);
        const m = p.manifest;
        result.push({
          id: dir,
          name: m.name,
          version: m.version,
          description: m.description,
          homepage: m.homepage,
          settings: m.settings || {},
          resources: m.resources || "Resource use depends on the adapter.",
          view: m.view || null,
          enabled: data[dir] === p.digest,
          changed: Boolean(data[dir] && data[dir] !== p.digest),
          actions: Object.entries(m.actions).map(([id, a]) => ({
            id,
            label: a.label,
          })),
          mcp: Boolean(m.mcp),
          ...(review
            ? { manifest: m, digest: p.digest, files: p.files, bytes: p.bytes }
            : {}),
        });
      } catch (e) {
        result.push({
          id: dir,
          name: dir,
          enabled: false,
          error: e.message,
          actions: [],
        });
      }
    }
    return result;
  }
  async import(directory) {
    const p = await inspect(directory);
    const base = await this.base();
    const destination = path.join(base, p.manifest.id);
    const temp = path.join(base, ".import-" + crypto.randomUUID());
    try {
      await fs.access(destination);
      throw Error(
        "Plugin already exists. Disable and remove it before importing a replacement.",
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    try {
      await fs.cp(directory, temp, { recursive: true, dereference: false });
      const copied = await inspect(temp);
      if (copied.digest !== p.digest)
        throw Error("Plugin changed during import. Try again.");
      await fs.rename(temp, destination);
    } finally {
      await fs.rm(temp, { force: true, recursive: true });
    }
    return p.manifest.id;
  }
  async enable(id, digest) {
    return this.mutate(async (data) => {
      const p = await this.package(id);
      if (digest !== p.digest)
        throw Error("Plugin changed. Review it again before enabling.");
      data[id] = p.digest;
    });
  }
  async disable(id) {
    return this.mutate((data) => {
      delete data[id];
    });
  }
  async remove(id) {
    return this.mutate(async (data) => {
      if (!idPattern.test(id)) throw Error("Unknown plugin.");
      delete data[id];
      await fs.rm(path.join(await this.base(), id), {
        recursive: true,
        force: true,
      });
    });
  }
  async approved(id) {
    const p = await this.package(id);
    if ((await this.data())[id] !== p.digest)
      throw Error(
        "Plugin is disabled or changed. Review and enable it on the host first.",
      );
    return p;
  }
  expand(value, p) {
    const root = this.root();
    return value.replace(
      /\$\{(plugin|workspace|artifacts|node|app)\}/g,
      (_, k) =>
        ({
          plugin: p.directory,
          workspace: root,
          artifacts: path.join(root, ".dino", "artifacts"),
          node: process.execPath,
          app: path.join(__dirname, ".."),
        })[k],
    );
  }
  async step(s, p) {
    const root = await fs.realpath(this.root());
    const cwd = await fs.realpath(
      path.resolve(p.directory, this.expand(s.cwd || "${plugin}", p)),
    );
    if (cwd !== root && !cwd.startsWith(root + path.sep))
      throw Error("Plugin cwd must stay in the workspace.");
    return {
      command: this.expand(s.command, p),
      args: s.args.map((a) => this.expand(a, p)),
      cwd,
    };
  }
  async recipe(id, action, options = {}) {
    const p = await this.approved(id);
    const a = p.manifest.actions[action];
    if (!Object.hasOwn(p.manifest.actions, action) || !a)
      throw Error("Unknown plugin action.");
    await fs.mkdir(path.join(this.root(), ".dino", "artifacts"), {
      recursive: true,
    });
    const values = await this.validateSettings(
      p.manifest,
      options.settings || (await this.settings(id)),
    );
    const steps = a.steps.map((s) => ({
      ...s,
      args: s.args.map((arg) =>
        arg.replace(/\$\{setting:([a-z][a-zA-Z0-9]*)\}/g, (_, key) => {
          if (!Object.hasOwn(values, key))
            throw Error("Unknown setting placeholder.");
          return String(values[key]);
        }),
      ),
    }));
    return Promise.all(steps.map((s) => this.step(s, p)));
  }
  async validateSettings(m, input = {}) {
    if (!plain(input)) throw Error("Settings must be an object.");
    const fields = m.settings || {},
      values = {};
    if (Object.keys(input).some((k) => !Object.hasOwn(fields, k)))
      throw Error("Unknown setting.");
    for (const [key, f] of Object.entries(fields)) {
      const v = input[key] ?? f.default ?? "";
      if (f.type === "integer") {
        if (!Number.isInteger(v) || v < f.min || v > f.max)
          throw Error(f.label + ": value outside allowed range.");
      } else {
        if (
          typeof v !== "string" ||
          v.length > (f.maxLength || 200) ||
          v.includes("\0")
        )
          throw Error("Invalid " + f.label);
        if (f.type === "enum" && !f.options.includes(v))
          throw Error("Invalid option.");
        if (f.type === "artifact" && v) {
          if (
            path.basename(v) !== v ||
            v.startsWith(".") ||
            !f.extensions.includes(path.extname(v).slice(1).toLowerCase())
          )
            throw Error("Choose a compatible artifact.");
          const base = await fs.realpath(
            path.join(this.root(), ".dino", "artifacts"),
          );
          const file = await fs.realpath(path.join(base, v));
          if (
            !file.startsWith(base + path.sep) ||
            !(await fs.stat(file)).isFile()
          )
            throw Error("Artifact unavailable.");
        }
      }
      values[key] = v;
    }
    return values;
  }
  async settings(id) {
    const p = await this.approved(id);
    let saved = {};
    try {
      saved =
        JSON.parse(
          await fs.readFile(
            path.join(this.root(), ".dino", "plugin-settings.json"),
            "utf8",
          ),
        )[id] || {};
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return this.validateSettings(p.manifest, saved);
  }
  async saveSettings(id, values) {
    const p = await this.approved(id);
    const result = await this.validateSettings(p.manifest, values);
    // Serialize settings and approval writes through the same workspace lock.
    const op = this.lock.then(async () => {
      const file = path.join(this.root(), ".dino", "plugin-settings.json");
      let data = {};
      try {
        data = JSON.parse(await fs.readFile(file, "utf8"));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      data[id] = result;
      await fs.writeFile(file + ".tmp", JSON.stringify(data, null, 2));
      await fs.rename(file + ".tmp", file);
      return result;
    });
    this.lock = op.catch(() => {});
    return op;
  }
  async connection(id) {
    const p = await this.approved(id);
    if (!p.manifest.mcp) throw Error("Plugin has no MCP server.");
    return this.step(p.manifest.mcp, p);
  }
}
module.exports = { Plugins, inspect, validate };
