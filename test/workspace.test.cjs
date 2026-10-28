const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const {
  localUrl,
  isWorkspace,
  moduleStatus,
  probe,
  status,
} = require("../desktop/workspace.cjs");
const { neural, engineering, docs } = require("../dashboard/catalog.js");

test("local addresses reject remote hosts, credentials and non-HTTP schemes", () => {
  for (const value of [
    "https://localhost:3002",
    "http://example.com",
    "file:///tmp/x",
    "http://127.0.0.1.evil.test",
    "http://user:pass@localhost",
    "javascript:alert(1)",
    "http://localhost@evil.test",
  ])
    assert.throws(() => localUrl(value));
  assert.equal(localUrl("http://127.0.0.1:3002"), "http://127.0.0.1:3002/");
  assert.equal(localUrl("http://localhost:5173/a"), "http://localhost:5173/a");
  assert.equal(localUrl("http://[::1]:5173"), "http://[::1]:5173/");
});

test("workspace and module checks distinguish empty folders from real checkouts", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-lab-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  assert.equal(await isWorkspace(root), false);
  for (const dir of ["neural", "setup", "orchestrator"])
    await fs.mkdir(path.join(root, dir));
  await fs.writeFile(path.join(root, "README.md"), "# Lab");
  assert.equal(await isWorkspace(root), true);
  const item = neural[0];
  await fs.mkdir(path.join(root, item.path));
  assert.equal(await moduleStatus(root, item), "missing");
  await fs.writeFile(
    path.join(root, item.path, ".git"),
    "gitdir: ../../.git/modules/neural/llm-viz",
  );
  assert.equal(await moduleStatus(root, item), "checked out");
  assert.equal(await moduleStatus(null, item), "missing");
  const results = await status(root, {});
  assert.equal(results.length, 8);
  assert.equal(results[0].checkout, "checked out");
  assert.ok(results.every((x) => x.local === null));
});

test("HTTP probes handle success, failure, unavailable servers and timeouts", async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === "/hang") return;
    res.writeHead(req.url === "/bad" ? 503 : 200);
    res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await probe(url), true);
  assert.equal(await probe(`${url}/bad`), false);
  assert.equal(await probe("http://example.com"), false);
  assert.equal(await probe("http://127.0.0.1:1"), false);
  assert.equal(await probe(`${url}/hang`), false);
});

test("catalog contains fixed HTTPS links, unique IDs and valid bundled docs", async () => {
  const items = [...neural, ...engineering];
  assert.equal(new Set(items.map((x) => x.id)).size, 8);
  for (const item of items) {
    assert.equal(new URL(item.source).protocol, "https:");
    if (item.url) assert.equal(new URL(item.url).protocol, "https:");
  }
  for (const doc of docs) await fs.access(path.join(__dirname, "..", doc.path));
});
