const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Plugins, validate } = require("../plugins/manager.cjs");
const { pluginAction } = require("../plugins/service.cjs");
const { Runtime } = require("../orchestrator/runtime.cjs");
const { Connections } = require("../orchestrator/mcp.cjs");
const { PhoneServer } = require("../phone/server.cjs");
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dino-plugin-"));
  const plugins = new Plugins(() => root);
  const runtime = new Runtime({
    root,
    buildRecipe: (_root, id, action) => plugins.recipe(id, action),
  });
  const connections = new Connections();
  t.after(async () => {
    await runtime.close();
    await connections.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const id = await plugins.import(
    path.join(__dirname, "..", "plugins", "examples", "artifact-report"),
  );
  return { root, plugins, runtime, connections, id };
}
test("import stays disabled; exact-file approval gates real queued jobs and saved artifacts", async (t) => {
  const { root, plugins, runtime, connections, id } = await fixture(t);
  await assert.rejects(
    () => pluginAction(plugins, runtime, connections, { id, action: "run" }),
    /disabled/,
  );
  const review = (await plugins.list(true))[0];
  await assert.rejects(() => plugins.enable(id, "stale"), /changed/);
  await plugins.enable(id, review.digest);
  const inventory = path.join(
    root,
    ".dino",
    "artifacts",
    "artifact-inventory.json",
  );
  await pluginAction(plugins, runtime, connections, {
    id,
    action: "run",
    command: "ignored",
    args: ["ignored"],
  });
  await runtime.jobs.get(id).done;
  assert.equal(runtime.jobs.get(id).state, "completed");
  assert.equal(JSON.parse(await fs.readFile(inventory, "utf8")).count, 0);
  const installed = path.join(root, ".dino", "plugins", id, "report.cjs");
  await fs.appendFile(installed, "\n// new revision\n");
  assert.equal((await plugins.list())[0].changed, true);
  await assert.rejects(() => runtime.start(id, "run"), /disabled or changed/);
  assert.equal((await plugins.list())[0].enabled, false);
  await plugins.remove(id);
  assert.equal((await plugins.list()).length, 0);
  assert.ok(await fs.stat(inventory));
});
test("a queued plugin rechecks approval after a script edit and never executes it", async (t) => {
  const { root, plugins, runtime, id } = await fixture(t);
  const source = path.join(root, "second");
  await fs.mkdir(source);
  await fs.writeFile(
    path.join(source, "dino-plugin.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "plugin-blocker",
      name: "Blocker",
      version: "1",
      description: "Queue fixture",
      actions: {
        run: {
          label: "Run",
          steps: [
            {
              command: process.execPath,
              args: ["-e", "setTimeout(()=>{},300)"],
            },
          ],
        },
      },
    }),
  );
  await plugins.import(source);
  for (const p of await plugins.list(true))
    await plugins.enable(p.id, p.digest);
  await runtime.start("plugin-blocker", "run");
  assert.equal((await runtime.start(id, "run")).state, "queued");
  await fs.appendFile(
    path.join(root, ".dino", "plugins", id, "report.cjs"),
    '\nthrow Error("must not execute");\n',
  );
  const queued = runtime.jobs.get(id);
  await queued.done;
  assert.equal(queued.state, "failed");
  assert.match(queued.log, /disabled or changed/);
  await assert.rejects(() =>
    fs.access(path.join(root, ".dino", "artifacts", "artifact-inventory.json")),
  );
});
test("manifest boundaries reject traversal, escaping working directories and symlinks", async (t) => {
  const { root, plugins, id } = await fixture(t);
  const p = (await plugins.list(true))[0];
  assert.throws(() => validate({ ...p.manifest, id: "../escape" }));
  assert.throws(() =>
    validate({ ...p.manifest, actions: { shell: { label: "No", steps: [] } } }),
  );
  const manifest = path.join(root, ".dino", "plugins", id, "dino-plugin.json");
  p.manifest.actions.check.steps[0].cwd = os.tmpdir();
  await fs.writeFile(manifest, JSON.stringify(p.manifest));
  const changed = (await plugins.list(true))[0];
  await plugins.enable(id, changed.digest);
  await assert.rejects(() => plugins.recipe(id, "check"), /cwd must stay/);
  if (process.platform !== "win32") {
    await fs.symlink(
      path.join(root, "elsewhere"),
      path.join(root, ".dino", "plugins", id, "escape"),
    );
    assert.match((await plugins.list())[0].error, /symlinks/);
    await assert.rejects(
      () => plugins.import(path.join(root, ".dino", "plugins", id)),
      /symlinks/,
    );
  }
});
test("phone can run approved plugins and real MCP calls but cannot change trust or commands", async (t) => {
  const { root, plugins, runtime, connections, id } = await fixture(t);
  // Reference the existing fixture engine externally, keeping the adapter package small.
  const source = path.join(root, "mcp");
  await fs.mkdir(source);
  await fs.writeFile(
    path.join(source, "dino-plugin.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "plugin-echo",
      name: "Echo",
      version: "1",
      description: "MCP fixture",
      actions: {},
      mcp: {
        command: process.execPath,
        args: [path.join(__dirname, "fixtures", "mcp-server.cjs")],
      },
    }),
  );
  await plugins.import(source);
  const server = new PhoneServer({
    getRoot: () => root,
    plugins,
    runtime,
    connections,
    urls: () => ({}),
    port: 0,
  });
  await server.start();
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.port}`;
  const post = (route, data, cookie) =>
    fetch(base + route, {
      method: "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(data),
    });
  assert.equal((await fetch(base + "/api/plugins")).status, 401);
  const pair = await post("/api/pair", { key: server.key });
  const cookie = pair.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await post("/api/plugin-action", { id, action: "run" }, cookie)).status,
    400,
  );
  assert.equal(
    (await post("/api/plugins", { id, enabled: true }, cookie)).status,
    404,
  );
  for (const p of await plugins.list(true))
    await plugins.enable(p.id, p.digest);
  const list = await (
    await fetch(base + "/api/plugins", { headers: { Cookie: cookie } })
  ).json();
  assert.equal(list[0].enabled, true);
  assert.ok(!("manifest" in list[0]));
  assert.ok(!("digest" in list[0]));
  assert.equal(
    (
      await post(
        "/api/plugin-action",
        { id, action: "run", command: "override" },
        cookie,
      )
    ).status,
    200,
  );
  await runtime.jobs.get(id).done;
  assert.equal(runtime.jobs.get(id).state, "completed");
  const connect = await post(
    "/api/plugin-action",
    { id: "plugin-echo", action: "connect" },
    cookie,
  );
  assert.equal(connect.status, 200);
  assert.equal((await connect.json())[0].name, "echo");
  const call = await post(
    "/api/tool",
    { id: "plugin-echo", name: "echo", args: { text: "Dino plugin" } },
    cookie,
  );
  assert.equal((await call.json()).content[0].text, "Dino plugin");
  await plugins.disable("plugin-echo");
  assert.equal(
    (
      await post(
        "/api/tool",
        { id: "plugin-echo", name: "echo", args: { text: "blocked" } },
        cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/plugin-action",
        { id: "plugin-echo", action: "disconnect" },
        cookie,
      )
    ).status,
    200,
  );
});

test("stop and shutdown cancel a plugin while asynchronous recipe approval is in progress", async (t) => {
  const { root } = await fixture(t);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let spawned = false;
  const runtime = new Runtime({
    root,
    buildRecipe: async () => {
      await gate;
      return [
        {
          command: process.execPath,
          args: ["-e", "process.exit(0)"],
          cwd: root,
        },
      ];
    },
    spawnProcess: () => {
      spawned = true;
      throw Error("must not spawn");
    },
  });
  const starting = runtime.start("plugin-pending", "run");
  const rejected = assert.rejects(() => starting, /cancelled/);
  const closing = runtime.close();
  release();
  await closing;
  await rejected;
  assert.equal(spawned, false);
  assert.equal(runtime.starting.size, 0);
});

test("stop immediately after submission prevents a service from escaping cancellation", async (t) => {
  const { root } = await fixture(t);
  const runtime = new Runtime({
    root,
    buildRecipe: () => [
      {
        command: process.execPath,
        args: ["-e", "setInterval(()=>{},1000)"],
        cwd: root,
      },
    ],
  });
  t.after(() => runtime.close());
  await runtime.start("plugin-immediate-stop", "start");
  await runtime.stop("plugin-immediate-stop");
  assert.equal(runtime.jobs.get("plugin-immediate-stop").state, "stopped");
});
