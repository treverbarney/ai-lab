const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Runtime } = require("../orchestrator/runtime.cjs");
const { Connections } = require("../orchestrator/mcp.cjs");
const { createServer } = require("../orchestrator/static-server.cjs");
const { recipe } = require("../adapters/registry.cjs");
const waitFor = async (fn) => {
  for (let n = 0; n < 100; n++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("State did not settle");
};
async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dino-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test("adapter recipes use explicit arguments and configured ports", () => {
  const root = path.resolve("fixture");
  const [step] = recipe(root, "llm-viz", "start", {
    "llm-viz": "http://127.0.0.1:6789",
  });
  assert.ok(step.args.includes("6789"));
  assert.ok(!step.args.includes("--shell"));
  assert.throws(() => recipe(root, "unknown", "start"));
  assert.throws(() => recipe(root, "minimind", "start"));
});
test("runtime records real subprocess output, bounded logs and failure receipts", async (t) => {
  const root = await temporary(t);
  const runtime = new Runtime({
    root,
    buildRecipe: () => [
      {
        command: process.execPath,
        args: ["-e", 'console.log("x".repeat(35000));process.exit(3)'],
        cwd: root,
      },
    ],
  });
  await runtime.start("fixture", "sample");
  await waitFor(() => runtime.snapshot()[0]?.state === "failed");
  await runtime.jobs.get("fixture").done;
  const job = runtime.snapshot()[0];
  assert.ok(job.log.length <= 30000);
  assert.equal(job.exitCode, 3);
  assert.match(job.log, /Process exited/);
  const files = await fs.readdir(path.join(root, ".dino", "receipts"));
  assert.equal(files.length, 1);
  const receipt = JSON.parse(
    await fs.readFile(path.join(root, ".dino", "receipts", files[0]), "utf8"),
  );
  assert.equal(receipt.state, "failed");
  assert.ok(!("log" in receipt));
});
test("runtime rejects duplicate starts and stops the owned process", async (t) => {
  const root = await temporary(t);
  const runtime = new Runtime({
    root,
    buildRecipe: () => [
      {
        command: process.execPath,
        args: ["-e", 'console.log("ready");setInterval(()=>{},1000)'],
        cwd: root,
      },
    ],
  });
  t.after(() => runtime.close());
  const start = runtime.start("cad", "start");
  await assert.rejects(() => runtime.start("cad", "start"), /active job/);
  await start;
  await assert.rejects(
    () => runtime.start("mujoco", "install"),
    /shared engineering/,
  );
  await waitFor(() => runtime.snapshot()[0].log.includes("ready"));
  await runtime.stop("cad");
  assert.equal(runtime.snapshot()[0].state, "stopped");
});
test("MCP performs a real handshake, tool discovery, call and disconnect", async (t) => {
  const connections = new Connections();
  t.after(() => connections.close());
  const tools = await connections.connect(
    "fixture",
    {
      command: process.execPath,
      args: [path.join(__dirname, "fixtures", "mcp-server.cjs")],
    },
    __dirname,
  );
  assert.equal(tools[0].name, "echo");
  const response = await connections.call("fixture", "echo", {
    text: "Dino connected",
  });
  assert.equal(response.content[0].text, "Dino connected");
  await assert.rejects(
    () => connections.call("fixture", "unknown", {}),
    /advertised/,
  );
  await connections.disconnect("fixture");
  assert.equal(connections.snapshot().length, 0);
});
test("TensorSpace static server blocks hidden files and escaping symlinks", async (t) => {
  const root = await temporary(t);
  await fs.mkdir(path.join(root, "examples", "lenet"), { recursive: true });
  await fs.writeFile(
    path.join(root, "examples", "lenet", "lenet.html"),
    "Dino layers",
  );
  await fs.writeFile(path.join(root, ".git"), "private");
  await fs.symlink(
    os.tmpdir(),
    path.join(root, "outside"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const server = await createServer(root, 0);
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(base)).text(), "Dino layers");
  assert.equal((await fetch(`${base}/.git`)).status, 403);
  assert.equal((await fetch(`${base}/outside`)).status, 403);
});

test("training preparation bounds records and rejects incompatible datasets", async (t) => {
  const root = await temporary(t);
  const { prepareTraining } = require("../orchestrator/training.cjs");
  const input = path.join(root, "dataset.jsonl");
  await fs.writeFile(
    input,
    Array.from({ length: 50 }, () =>
      JSON.stringify({ text: "x".repeat(3000) }),
    ).join("\n"),
  );
  const result = await prepareTraining(root, input);
  assert.equal(result.records, 32);
  const records = (
    await fs.readFile(
      path.join(root, ".dino", "training", "input.jsonl"),
      "utf8",
    )
  )
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(records.length, 32);
  assert.equal(records[0].text.length, 2048);
  await fs.writeFile(input, JSON.stringify({ instruction: "wrong format" }));
  await assert.rejects(() => prepareTraining(root, input), /text string/);
  const [step] = recipe(root, "minimind", "train");
  assert.ok(step.args.includes("cpu"));
  assert.ok(step.args.includes("64"));
  assert.equal(step.cwd, path.join(root, "neural", "minimind", "trainer"));
});
