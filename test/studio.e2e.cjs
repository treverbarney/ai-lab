const { _electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises"),
  path = require("node:path");
const root = path.join(__dirname, "..");
(async () => {
  const app = await _electron.launch({
    executablePath: require("electron"),
    args: [
      "--no-sandbox",
      "--headless",
      "--ozone-platform=headless",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--user-data-dir=/tmp/dino-studio-e2e-" + process.pid,
      root,
    ],
  });
  const errors = [];
  async function wait(fn) {
    for (let n = 0; n < 200; n++) {
      if (await fn()) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw Error("Condition timed out.");
  }
  try {
    const home = await app.firstWindow();
    home.on("pageerror", (e) => errors.push(e.message));
    const next = app.context().waitForEvent("page");
    await home.evaluate(() => window.lab.openStudio());
    const page = await next;
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("PAGE ERROR", e.message);
    });
    page.on("response", (r) => {
      if (r.status() === 404) console.log("HTTP404", r.url());
    });
    page.on("console", (m) => {
      if (m.type() === "error") console.log("browser:", m.text().slice(0, 200));
    });
    await page.waitForURL("**/studio/index.html");
    await page
      .getByText("Connected · installs and heavy jobs share one queue.", {
        exact: true,
      })
      .waitFor();
    async function api(route, data) {
      return page.evaluate(
        async ({ route, data }) => {
          const r = await fetch("/api/" + route, {
            method: data ? "POST" : "GET",
            headers: data ? { "Content-Type": "application/json" } : {},
            body: data ? JSON.stringify(data) : undefined,
          });
          const v = await r.json();
          if (!r.ok) throw Error(v.error);
          return v;
        },
        { route, data },
      );
    }
    async function job(id, action) {
      await api("plugin-action", { id, action });
      let j;
      for (let n = 0; n < 150; n++) {
        const state = await api("state");
        j = state.jobs.find((j) => j.id === id);
        if (j && !["running", "queued", "stopping"].includes(j.state)) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      assert.equal(j?.state, "completed", j?.log);
      return j;
    }
    // Real runtime checks and experiments, no synthetic successful command fixtures.
    for (const id of ["netron", "marimo", "aim"]) {
      await job("plugin-" + id, "check");
      await job("plugin-" + id, "sample");
    }
    for (const id of ["optuna", "rerun"]) await job("plugin-" + id, "sample");
    console.log(
      "PASS: real Netron/ONNX, marimo lesson, Aim training, Optuna trials and Rerun recording.",
    );
    const viewFailures = [];
    for (const key of ["netron", "marimo", "aim"]) {
      try {
        const id = "plugin-" + key;
        await api("plugin-action", { id, action: "start" });
        await wait(() =>
          page.evaluate(
            async (id) => (await fetch("/views/" + id + "/")).ok,
            id,
          ),
        );
        await page
          .locator("#tool-list")
          .getByRole("button", {
            name: new RegExp(
              "^" +
                (key === "aim"
                  ? "Aim"
                  : key === "netron"
                    ? "Netron"
                    : "marimo"),
            ),
          })
          .click();
        await page
          .getByRole("button", { name: "Open embedded view", exact: true })
          .click();
        const frame = page.frameLocator("#view");
        if (key === "netron")
          await frame
            .getByText("Mul", { exact: true })
            .waitFor({ timeout: 20000 });
        if (key === "marimo")
          await wait(async () =>
            /Learned weight:/.test(await frame.locator("body").innerText()),
          );
        if (key === "aim")
          await frame
            .getByText("Dino CPU regression", { exact: false })
            .first()
            .waitFor({ timeout: 10000 });
        console.log(
          "PASS: embedded " + key + " UI through authenticated proxy.",
        );
      } catch (e) {
        viewFailures.push(key + ": " + e.message);
        console.log("CAUSE", e.message);
        console.log(
          "VIEW FAILURE",
          key,
          (await page.frameLocator("#view").locator("body").innerText()).slice(
            0,
            3500,
          ),
        );
      }
      await page.locator("#close-view").click();
      await api("plugin-action", { id: "plugin-" + key, action: "stop" });
    }
    const cad = "dino-mounting-plate.step";
    await fs.access(path.join(root, ".dino", "artifacts", cad));
    await api("plugin-settings", {
      id: "plugin-cad-viewer",
      values: { file: cad },
    });
    await page
      .locator("#tool-list")
      .getByRole("button", { name: /^Online 3D Viewer/ })
      .click();
    await page
      .getByRole("button", { name: "Open embedded view", exact: true })
      .click();
    try {
      await wait(async () => {
        const text = await page
          .frameLocator("#view")
          .locator("#status")
          .textContent();
        if (text.includes("Could not")) throw Error(text);
        return text.includes("Model ready");
      });
    } catch (e) {
      console.log(
        "CAD FAILURE",
        await page.frameLocator("#view").locator("body").innerText(),
      );
      throw e;
    }
    console.log("PASS: real STEP model rendered with local OCCT WebAssembly.");
    await page.locator("#close-view").click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const upload = await api("import", {
      name: "test-e2e.jsonl",
      data: Buffer.from('{"text":"Dino lab"}\n').toString("base64"),
    });
    assert.ok(upload.name.endsWith("test-e2e.jsonl"));
    await page
      .getByRole("button", { name: "Refresh studio", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Compare training runs", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Approve & run Compare training runs",
        exact: true,
      })
      .click();
    await wait(async () => {
      const list = await api("flows");
      if (["failed", "cancelled"].includes(list[0]?.state))
        throw Error(list[0].error);
      return list[0]?.state === "completed";
    });
    await api("plugin-action", { id: "plugin-aim", action: "stop" });
    await page.goto(
      page.url().replace("/studio/index.html", "/studio/flows.html"),
    );
    await page
      .getByRole("combobox", { name: "Workflow action" })
      .selectOption("plugin-optuna:sample");
    await page.getByRole("button", { name: "Add action", exact: true }).click();
    await page
      .getByRole("button", { name: "Review workflow", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Approve & run workflow", exact: true })
      .click();
    await wait(async () => {
      const list = await api("flows");
      if (["failed", "cancelled"].includes(list[0]?.state))
        throw Error(list[0].error);
      return list[0]?.state === "completed";
    });
    console.log(
      "PASS: mobile-width studio, artifact upload, reviewed template and React Flow execution.",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(viewFailures, []);
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
