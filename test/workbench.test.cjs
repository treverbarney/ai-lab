const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Runtime } = require("../orchestrator/runtime.cjs");
const { Workbench } = require("../orchestrator/workbench.cjs");
async function root(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dino-work-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
test("heavy jobs serialize, queued cancellation resolves and stop drains safely", async (t) => {
  const dir = await root(t);
  let live = 0,
    max = 0;
  const runtime = new Runtime({
    root: dir,
    buildRecipe: () => [
      {
        command: process.execPath,
        args: ["-e", "setTimeout(()=>{},150)"],
        cwd: dir,
      },
    ],
  });
  const spawn = runtime.spawnProcess;
  runtime.spawnProcess = (...args) => {
    live++;
    max = Math.max(max, live);
    const child = spawn(...args);
    child.on("close", () => live--);
    return child;
  };
  await runtime.start("cad", "sample");
  assert.equal((await runtime.start("mujoco", "sample")).state, "queued");
  await runtime.jobs.get("cad").done;
  await runtime.jobs.get("mujoco").done;
  assert.equal(max, 1);
  assert.equal(
    runtime.snapshot().find((j) => j.id === "mujoco").state,
    "completed",
  );
  await runtime.start("cad", "sample");
  await runtime.start("minimind", "train");
  await runtime.stop("minimind");
  assert.equal(runtime.jobs.get("minimind").state, "stopped");
  await runtime.close();
});
test("projects preserve copies, validate markup and never execute unapproved requests", async (t) => {
  const dir = await root(t);
  await fs.mkdir(path.join(dir, ".dino", "artifacts"), { recursive: true });
  await fs.writeFile(
    path.join(dir, ".dino", "artifacts", "model.stl"),
    "original",
  );
  const runtime = new Runtime({ root: dir, buildRecipe: () => [] });
  const wb = new Workbench(() => dir, runtime);
  const p = await wb.execute("create", { name: "Bracket" });
  const saved = await wb.execute("save", {
    id: p.id,
    file: "model.stl",
    notes: "review",
  });
  assert.notEqual(saved.artifacts[0], "model.stl");
  await fs.writeFile(
    path.join(dir, ".dino", "artifacts", "model.stl"),
    "replaced",
  );
  assert.equal(
    await fs.readFile(await wb.artifact(saved.artifacts[0]), "utf8"),
    "original",
  );
  await wb.execute("save", {
    id: p.id,
    markup: {
      file: saved.artifacts[0],
      strokes: [
        [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      ],
    },
  });
  await assert.rejects(() =>
    wb.execute("save", {
      id: p.id,
      markup: { file: saved.artifacts[0], strokes: [[[9, 0]]] },
    }),
  );
  const request = await wb.execute("request", {
    project: p.id,
    prompt: "run physics",
  });
  assert.equal(runtime.jobs.size, 0);
  await wb.execute("reject", { id: request.id });
  await assert.rejects(() => wb.execute("approve", { id: request.id }));
  await assert.rejects(() =>
    wb.execute("request", { project: p.id, steps: ["__proto__"] }),
  );
});

test("push subscriptions reject arbitrary endpoints and can be revoked per phone", async (t) => {
  const dir = await root(t);
  const { Notices } = require("../orchestrator/notices.cjs");
  const notices = new Notices(() => dir);
  await assert.rejects(async () =>
    notices.subscribe(
      {
        endpoint: "http://127.0.0.1/private",
        keys: { p256dh: "x", auth: "y" },
      },
      "phone1",
    ),
  );
  const key = await notices.key();
  assert.ok(key.length > 40);
  await notices.subscribe(
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      keys: { p256dh: "x", auth: "y" },
    },
    "phone1",
  );
  assert.equal((await notices.data()).subscriptions.length, 1);
  await notices.remove("phone1");
  assert.equal((await notices.data()).subscriptions.length, 0);
});
