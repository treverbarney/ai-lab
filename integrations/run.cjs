const fs = require("node:fs/promises"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const { catalog } = require("./catalog.cjs");
const { resolveCommand } = require("../orchestrator/commands.cjs");
const [key, action, workspace, ...values] = process.argv.slice(2);
const item = catalog.find((c) => c.key === key);
const venv = path.join(workspace || "", ".dino", "venvs", key);
const binary = (name) =>
  path.join(
    venv,
    process.platform === "win32" ? "Scripts" : "bin",
    name + (process.platform === "win32" ? ".exe" : ""),
  );
function run(command, args, cwd = workspace) {
  return new Promise((resolve, reject) => {
    const resolved = resolveCommand(command, args);
    const child = spawn(resolved.command, resolved.args, {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        ELECTRON_SKIP_BINARY_DOWNLOAD: "1",
        RERUN_ANALYTICS_ENABLED: "0",
        AIM_UI_TELEMETRY_ENABLED: "0",
        AIM_DISABLE_TELEMETRY: "1",
      },
      shell: false,
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(Error(`Command failed (${code}): ${command}`)),
    );
  });
}
(async () => {
  if (!item || !item.actions.includes(action))
    throw Error("Unknown integration action.");
  if (item.platform && item.platform !== process.platform + "-" + process.arch)
    throw Error("This integration requires an Apple Silicon Mac.");
  const settings = Object.fromEntries(
    Object.keys(item.fields).map((k, i) => [
      k,
      values[i] ?? item.fields[k].default,
    ]),
  );
  const out = path.join(workspace, ".dino", "artifacts");
  await fs.mkdir(out, { recursive: true });
  const work = path.join(workspace, ".dino", "integrations");
  await fs.mkdir(work, { recursive: true });
  for (const name of ["sample.py", "lesson.py"])
    await fs.copyFile(path.join(__dirname, name), path.join(work, name));
  if (action === "install") {
    if (item.requirements) {
      await run(process.platform === "win32" ? "python" : "python3", [
        "-m",
        "venv",
        venv,
      ]);
      // Keep CPU-only torch on Linux. Other platforms use their native wheels.
      if (key === "rl" && process.platform === "linux")
        await run(binary("python"), [
          "-m",
          "pip",
          "install",
          "torch==2.8.0",
          "--index-url",
          "https://download.pytorch.org/whl/cpu",
        ]);
      await run(binary("python"), [
        "-m",
        "pip",
        "install",
        ...item.requirements,
      ]);
    } else if (key === "kiri") {
      const target = path.join(workspace, "integrations", "upstream", "kiri");
      await run("git", [
        "submodule",
        "update",
        "--init",
        "--",
        "integrations/upstream/kiri",
      ]);
      await run("npm", ["run", "setup"], target);
    } else throw Error("No installation needed.");
    return;
  }
  if (key === "cad-viewer" || key === "workflow") {
    console.log(
      "Browser integration is bundled. Open its view from the studio.",
    );
    return;
  }
  if (key === "kiri") {
    const cwd = path.join(workspace, "integrations", "upstream", "kiri");
    if (action === "check") {
      await fs.access(path.join(cwd, "package.json"));
      console.log("Kiri:Moto checkout present.");
      return;
    }
    // Upstream server accepts --port; loopback enforced by the dedicated launcher.
    await run(
      process.execPath,
      [path.join(__dirname, "kiri-server.cjs"), cwd],
      workspace,
    );
    return;
  }
  if (key === "llama") {
    if (action === "check") {
      await run("llama-server", ["--version"]);
      return;
    }
    if (!settings.file)
      throw Error("Import and select a local GGUF model first.");
    await run("llama-server", [
      "-m",
      path.join(out, settings.file),
      "--host",
      "127.0.0.1",
      "--port",
      "4325",
      "--threads",
      String(settings.threads),
      "--ctx-size",
      "2048",
    ]);
    return;
  }
  if (action === "check") {
    await run(binary("python"), [
      "-c",
      `import importlib.metadata; print(importlib.metadata.version(${JSON.stringify(item.requirements[0].split("==")[0])}))`,
    ]);
    return;
  }
  if (key === "marimo") {
    const notebook = path.join(out, "dino-gradient-lab.py");
    if (action === "sample") {
      await fs.copyFile(path.join(work, "lesson.py"), notebook);
      console.log(
        "Saved dino-gradient-lab.py. Start the lesson to explore live sliders.",
      );
      return;
    }
    await fs
      .access(notebook)
      .catch(() => fs.copyFile(path.join(work, "lesson.py"), notebook));
    await run(binary("python"), [
      "-m",
      "marimo",
      "run",
      notebook,
      "--host",
      "127.0.0.1",
      "--port",
      "4322",
      "--headless",
      "--no-token",
      "--base-url",
      "/views/plugin-marimo",
    ]);
    return;
  }
  if (key === "rerun" && action === "start") {
    const recording = path.join(out, settings.file || "dino-motion.rrd");
    await fs.access(recording);
    await run(binary("rerun"), [
      "--serve-web",
      "--bind",
      "127.0.0.1",
      "--port",
      "9877",
      "--web-viewer-port",
      "4326",
      "--memory-limit",
      "128MB",
      "--server-memory-limit",
      "128MB",
      recording,
    ]);
    return;
  }
  if (key === "aim" && action === "start") {
    await run(binary("aim"), [
      "up",
      "--repo",
      path.join(workspace, ".dino", "experiments"),
      "--host",
      "127.0.0.1",
      "--port",
      "4323",
      "--base-path",
      "/views/plugin-aim",
    ]);
    return;
  }
  if (key === "mlx") {
    if (
      !settings.model ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,159}$/.test(settings.model) ||
      settings.model.includes("..")
    )
      throw Error(
        "Choose a valid model ID first. Weights download only after Run/Train.",
      );
    if (action === "train") {
      if (!settings.file) throw Error("Choose a JSONL artifact first.");
      const dir = path.join(workspace, ".dino", "mlx-data");
      await fs.mkdir(dir, { recursive: true });
      if ((await fs.stat(path.join(out, settings.file))).size > 4 * 1024 * 1024)
        throw Error(
          "Use a training dataset smaller than 4 MB for this profile.",
        );
      const data = (await fs.readFile(path.join(out, settings.file), "utf8"))
        .trim()
        .split("\n");
      if (data.length < 2 || data.length > 1000)
        throw Error("Use 2–1,000 JSONL records for this profile.");
      const records = data.map((line) => {
        const d = JSON.parse(line);
        if (typeof d.text !== "string" || d.text.length > 4000)
          throw Error("Each record needs a short text field.");
        return JSON.stringify({ text: d.text });
      });
      await fs.writeFile(
        path.join(dir, "train.jsonl"),
        records.slice(0, -1).join("\n") + "\n",
      );
      await fs.writeFile(path.join(dir, "valid.jsonl"), records.at(-1) + "\n");
      await run(binary("python"), [
        "-m",
        "mlx_lm.lora",
        "--model",
        settings.model,
        "--train",
        "--data",
        dir,
        "--iters",
        String(settings.steps),
        "--batch-size",
        "1",
        "--num-layers",
        "2",
        "--adapter-path",
        path.join(workspace, ".dino", "mlx-adapter"),
      ]);
    } else
      await run(binary("python"), [
        "-m",
        "mlx_lm.generate",
        "--model",
        settings.model,
        "--prompt",
        settings.prompt,
        "--max-tokens",
        "128",
      ]);
    return;
  }
  await run(binary("python"), [
    path.join(work, "sample.py"),
    key,
    action,
    workspace,
    JSON.stringify(settings),
  ]);
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
