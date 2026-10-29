const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os");
const { Plugins, validate } = require("../plugins/manager.cjs"),
  { catalog, manifest } = require("../integrations/catalog.cjs");
const { Runtime } = require("../orchestrator/runtime.cjs"),
  { PhoneServer } = require("../phone/server.cjs");
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dino-studio-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".dino", "artifacts"), { recursive: true });
  const plugins = new Plugins(() => root);
  return { root, plugins };
}
test("all curated adapters validate and forms cannot replace executable or working directory", () => {
  assert.equal(catalog.length, 11);
  for (const c of catalog) validate(manifest(c));
  const m = manifest(catalog[0]);
  m.actions.start.steps[0].command = "${setting:file}";
  assert.throws(() => validate(m), /only substitute/);
});
test("settings persist separately from package approval and reject escaping artifact handoffs", async (t) => {
  const { root, plugins } = await fixture(t);
  await plugins.import(
    path.join(__dirname, "..", "plugins", "bundled", "netron"),
  );
  const p = (await plugins.list(true))[0];
  await plugins.enable(p.id, p.digest);
  await fs.writeFile(path.join(root, ".dino", "artifacts", "a.onnx"), "model");
  await plugins.saveSettings(p.id, { file: "a.onnx" });
  assert.equal((await plugins.settings(p.id)).file, "a.onnx");
  assert.equal((await plugins.list())[0].enabled, true);
  await assert.rejects(() => plugins.saveSettings(p.id, { file: "../a.onnx" }));
  await assert.rejects(() => plugins.saveSettings(p.id, { command: "python" }));
  const recipe = await plugins.recipe(p.id, "start", {
    settings: { file: "a.onnx" },
  });
  assert.equal(recipe[0].args.at(-1), "a.onnx");
});
test("paired APIs gate views, settings, bounded imports, and sequential reviewed workflows", async (t) => {
  const { root, plugins } = await fixture(t);
  await plugins.import(
    path.join(__dirname, "..", "plugins", "examples", "artifact-report"),
  );
  const p = (await plugins.list(true))[0];
  await plugins.enable(p.id, p.digest);
  const runtime = new Runtime({
    root,
    buildRecipe: (_root, id, action, _urls, options) =>
      plugins.recipe(id, action, options),
  });
  const connections = { snapshot: () => [], disconnect: async () => {} };
  const server = new PhoneServer({
    getRoot: () => root,
    plugins,
    runtime,
    connections,
    urls: () => ({}),
    port: 0,
  });
  await server.start();
  t.after(async () => {
    await server.close();
    await runtime.close();
  });
  const base = "http://127.0.0.1:" + server.port;
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
  assert.equal(
    (await fetch(base + "/views/plugin-artifact-report/")).status,
    401,
  );
  const paired = await post("/api/pair", { key: server.key });
  const cookie = paired.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await post("/api/import", { name: "../bad.onnx", data: "AA==" }, cookie))
      .status,
    400,
  );
  const imported = await post(
    "/api/import",
    { name: "sample.json", data: "e30=" },
    cookie,
  );
  assert.equal(imported.status, 200);
  assert.equal(
    (
      await post(
        "/api/flows",
        { steps: [{ id: p.id, action: "install" }] },
        cookie,
      )
    ).status,
    400,
  );
  const result = await post(
    "/api/flows",
    {
      name: "Inventory check",
      steps: [
        { id: p.id, action: "run" },
        { id: p.id, action: "check" },
      ],
    },
    cookie,
  );
  assert.equal(result.status, 200);
  await Promise.all([...server.flows.tasks]);
  const runs = await server.flows.state();
  assert.equal(runs[0].state, "completed", runs[0].error);
  assert.ok(
    await fs.stat(
      path.join(root, ".dino", "artifacts", "artifact-inventory.json"),
    ),
  );
});

test("paired gateway decodes compressed upstream scripts and strips pairing credentials", async (t) => {
  const http = require("node:http"),
    zlib = require("node:zlib");
  const { EventEmitter } = require("node:events");
  const { root, plugins } = await fixture(t);
  let forwarded;
  const upstream = http.createServer((req, res) => {
    forwarded = req.headers;
    const source =
      "case 0:return R.a.setPyodide({current:null,namespace:null,isLoading:!0}),e.next=3,window.loadPyodide; https://api.github.com/repos/aimhubio/aim/releases";
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Content-Encoding": "gzip",
    });
    res.end(zlib.gzipSync(source));
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => upstream.close(r)));
  const folder = path.join(root, "adapter");
  await fs.mkdir(folder);
  const m = manifest(catalog.find((c) => c.key === "aim"));
  m.view.port = upstream.address().port;
  await fs.writeFile(path.join(folder, "dino-plugin.json"), JSON.stringify(m));
  await plugins.import(folder);
  const p = (await plugins.list(true))[0];
  await plugins.enable(p.id, p.digest);
  const runtime = new EventEmitter();
  runtime.snapshot = () => [];
  runtime.jobs = new Map([[p.id, { state: "running", action: "start" }]]);
  const server = new PhoneServer({
    getRoot: () => root,
    plugins,
    runtime,
    connections: { snapshot: () => [] },
    urls: () => ({}),
    port: 0,
  });
  await server.start();
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.port;
  const pair = await fetch(base + "/api/pair", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ key: server.key }),
  });
  const cookie = pair.headers.get("set-cookie").split(";")[0];
  const response = await fetch(base + "/views/plugin-aim/static/js/main.js", {
    headers: { Cookie: cookie, Authorization: "do-not-forward" },
  });
  const source = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), null);
  assert.match(source, /if\(!window.loadPyodide\)/);
  assert.match(source, /\/api\/integration-release-notes/);
  assert.ok(!forwarded.cookie?.includes("dino_phone"));
  assert.equal(forwarded.authorization, undefined);
  await plugins.disable(p.id);
  assert.equal(
    (await fetch(base + "/views/plugin-aim/", { headers: { Cookie: cookie } }))
      .status,
    400,
  );
});
