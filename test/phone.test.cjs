const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { EventEmitter } = require("node:events");
const { PhoneServer } = require("../phone/server.cjs");
const { PhoneAccess } = require("../phone/access.cjs");
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dino-phone-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".dino", "artifacts"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".dino", "artifacts", "sample.step"),
    "test CAD",
  );
  const calls = [];
  const runtime = new EventEmitter();
  runtime.snapshot = () => [
    { id: "cad", action: "sample", state: "completed", log: "done" },
  ];
  runtime.start = async (id, action) => calls.push({ id, action });
  runtime.stop = async (id) => calls.push({ id, action: "stop" });
  const connections = {
    snapshot: () => [],
    connect: async () => {},
    disconnect: async () => {},
    call: async () => ({ content: [] }),
  };
  const server = new PhoneServer({
    getRoot: () => root,
    runtime,
    connections,
    urls: () => ({}),
    getConnection: () => ({ command: "known", args: [] }),
    launchNative: async () => {},
    port: 0,
  });
  await server.start();
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.port}`;
  const raw = (route, options = {}) =>
    new Promise((resolve, reject) => {
      const text = options.body || "";
      const request = require("node:http").request(
        base + route,
        { method: options.method || "GET", headers: options.headers || {} },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              headers: {
                get: (name) => {
                  const value = response.headers[name.toLowerCase()];
                  return Array.isArray(value) ? value.join(",") : value;
                },
              },
              text: async () => Buffer.concat(chunks).toString(),
              json: async () => JSON.parse(Buffer.concat(chunks).toString()),
            }),
          );
        },
      );
      request.once("error", reject);
      request.end(text);
    });
  const post = (route, value, cookie, extra = {}) =>
    raw(route, {
      method: "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      body: JSON.stringify(value),
    });
  const pair = await post("/api/pair", { key: server.key });
  assert.equal(pair.status, 200);
  const cookie = pair.headers.get("set-cookie").split(";")[0];
  return { server, runtime, base, post, raw, cookie, calls, root };
}
test("phone requires pairing, rejects CSRF and DNS rebinding, and limits actions", async (t) => {
  const { server, base, post, raw, cookie, calls } = await fixture(t);
  assert.equal((await fetch(base + "/api/state")).status, 401);
  assert.equal(
    (await raw("/api/state", { headers: { Host: "evil.test" } })).status,
    403,
  );
  assert.equal(
    (
      await post("/api/action", { id: "cad", action: "sample" }, cookie, {
        Origin: "https://evil.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/action", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  const state = await (
    await fetch(base + "/api/state", { headers: { Cookie: cookie } })
  ).json();
  assert.equal(state.jobs[0].state, "completed");
  assert.ok(!("key" in state));
  assert.equal(
    (await post("/api/action", { id: "cad", action: "sample" }, cookie)).status,
    200,
  );
  assert.deepEqual(calls, [{ id: "cad", action: "sample" }]);
  assert.equal(
    (await post("/api/action", { id: "cad", action: "shell" }, cookie)).status,
    400,
  );
  assert.equal(
    (await post("/api/action", { id: "unknown", action: "sample" }, cookie))
      .status,
    400,
  );
  assert.equal((await post("/api/pair", { key: "incorrect" })).status, 401);
  server.publicOrigin = "https://dino.example.ts.net:8443";
  const secure = await post("/api/pair", { key: server.key }, null, {
    Host: "dino.example.ts.net:8443",
    Origin: "https://dino.example.ts.net:8443",
  });
  assert.match(
    secure.headers.get("set-cookie"),
    /HttpOnly; SameSite=Strict.*Secure/,
  );
});
test("artifact access is authenticated and contained; logout revokes the session", async (t) => {
  const { base, post, cookie, root } = await fixture(t);
  assert.equal(
    (await fetch(base + "/api/download?name=sample.step")).status,
    401,
  );
  const files = await (
    await fetch(base + "/api/files", { headers: { Cookie: cookie } })
  ).json();
  assert.equal(files[0].name, "sample.step");
  assert.equal(
    await (
      await fetch(base + "/api/download?name=sample.step", {
        headers: { Cookie: cookie },
      })
    ).text(),
    "test CAD",
  );
  assert.notEqual(
    (
      await fetch(base + "/api/download?name=..%2Fpackage.json", {
        headers: { Cookie: cookie },
      })
    ).status,
    200,
  );
  if (process.platform !== "win32") {
    const outside = path.join(root, "private.txt");
    await fs.writeFile(outside, "private");
    await fs.symlink(
      outside,
      path.join(root, ".dino", "artifacts", "escape.txt"),
    );
    assert.notEqual(
      (
        await fetch(base + "/api/download?name=escape.txt", {
          headers: { Cookie: cookie },
        })
      ).status,
      200,
    );
  }
  await post("/api/logout", {}, cookie);
  assert.equal(
    (await fetch(base + "/api/state", { headers: { Cookie: cookie } })).status,
    401,
  );
});
test("mobile shell, manifest and icons are public; API responses are never cacheable", async (t) => {
  const { base, cookie } = await fixture(t);
  assert.equal((await fetch(base + "/phone/")).status, 200);
  const manifest = await (
    await fetch(base + "/phone/manifest.webmanifest")
  ).json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/phone/");
  assert.equal((await fetch(base + "/phone/icons/dino-192.png")).status, 200);
  const state = await fetch(base + "/api/state", {
    headers: { Cookie: cookie },
  });
  assert.equal(state.headers.get("cache-control"), "no-store");
  const sw = await (await fetch(base + "/phone/sw.js")).text();
  assert.match(sw, /SHELL.includes/);
});
test("phone access preserves existing Tailscale services and removes only its own root mapping", async () => {
  const phone = new PhoneAccess({
    getRoot: () => null,
    runtime: new EventEmitter(),
    connections: {},
    urls: () => ({}),
    getConnection: () => ({}),
    launchNative: () => {},
  });
  phone.server.server = {};
  phone.server.key = "test";
  phone.server.port = 4317;
  let config = {
    TCP: { 8443: {} },
    Web: {
      "dino.example.ts.net:8443": {
        Handlers: { "/": { Proxy: "http://127.0.0.1:9999" } },
      },
    },
  };
  const commands = [];
  phone.command = async (args) => {
    commands.push(args);
    if (args[0] === "status")
      return JSON.stringify({
        BackendState: "Running",
        Self: { DNSName: "dino.example.ts.net." },
      });
    if (args.includes("status")) return JSON.stringify(config);
    return "";
  };
  await assert.rejects(() => phone.enablePrivate(), /already in use/);
  assert.ok(!commands.some((args) => args.includes("--bg")));
  config = {};
  await phone.enablePrivate();
  assert.ok(commands.some((args) => args.includes("--bg")));
  config = {
    Web: {
      "dino.example.ts.net:8443": {
        Handlers: {
          "/": { Proxy: "http://127.0.0.1:4317" },
          "/other": { Proxy: "http://127.0.0.1:7777" },
        },
      },
    },
  };
  phone.server.close = async () => {
    phone.server.server = null;
  };
  await phone.close();
  assert.ok(
    commands.some(
      (args) => args.includes("--set-path=/") && args.includes("off"),
    ),
  );
  assert.ok(!commands.some((args) => args.includes("reset")));
});


test('unified workspace serves direct routes and only same-origin child views can embed', async t => {
  const {base}=await fixture(t);
  const shell=await fetch(base+'/phone/');
  assert.match(await shell.text(), /workspace.js/);
  assert.equal(shell.headers.get('x-frame-options'),'DENY');
  for (const route of ['/phone/workspace.js','/phone/workspace.css','/phone/embedded.css']) assert.equal((await fetch(base+route)).status,200);
  for (const route of ['/phone/control.html','/workbench/index.html','/studio/assembly.html']) {
    const r=await fetch(base+route);
    assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');
    assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  }
});
test('training preparation requires pairing, preserves good data on errors, and refuses an active run', async t => {
  const {post,cookie,root,runtime,calls}=await fixture(t);
  const data={text:JSON.stringify({text:'Small training example.'})};
  assert.equal((await post('/api/training-data',data)).status,401);
  assert.equal((await post('/api/training-data',data,cookie,{Origin:'https://evil.test'})).status,403);
  const ok=await post('/api/training-data',data,cookie);
  assert.equal(ok.status,200);assert.equal((await ok.json()).records,1);
  const filename=path.join(root,'.dino/training/input.jsonl');
  const original=await fs.readFile(filename,'utf8');
  for (const input of [{text:'invalid JSON'},{text:'{"other":1}'},{text:4},{text:'x'.repeat(1048577)}]) assert.equal((await post('/api/training-data',input,cookie)).status,400);
  assert.equal(await fs.readFile(filename,'utf8'),original);
  runtime.snapshot=()=>[{id:'minimind',state:'running'}];
  assert.equal((await post('/api/training-data',data,cookie)).status,400);
  assert.equal(await fs.readFile(filename,'utf8'),original);
  assert.equal(calls.length,0,'Preparing a dataset must never launch training');
});
