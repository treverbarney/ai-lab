const path = require("node:path");
const { neural, engineering } = require("../dashboard/catalog.js");
const tools = [...neural, ...engineering];
const venv = (root, name, binary = "python") =>
  path.join(
    root,
    ".dino",
    "venvs",
    name,
    process.platform === "win32" ? "Scripts" : "bin",
    process.platform === "win32" ? `${binary}.exe` : binary,
  );
function baseRecipe(root, id, action, urls = {}) {
  const item = tools.find((x) => x.id === id);
  if (!item) throw new Error("Unknown Dino tool.");
  const python = process.platform === "win32" ? "python" : "python3";
  const node = process.execPath;
  const cwd = item.path ? path.join(root, item.path) : root;
  const step = (command, args, workingDir = cwd) => ({
    command,
    args,
    cwd: workingDir,
  });
  const pip = (name, args) =>
    step(venv(root, name), ["-m", "pip", ...args], root);
  if (action === "install") {
    if (id === "llm-viz") return [step("corepack", ["yarn", "install"])];
    if (id === "transformer-explainer")
      return [
        step("npm", [
          "install",
          "--no-save",
          "--package-lock=false",
          "vite@7.3.7",
        ]),
      ];
    if (id === "tensorspace") return [];
    if (id === "minimind")
      return [
        step(
          python,
          ["-m", "venv", path.join(root, ".dino", "venvs", "minimind")],
          root,
        ),
        pip("minimind", ["install", "-r", path.join(cwd, "requirements.txt")]),
      ];
    if (["cad", "mujoco"].includes(id))
      return [
        step(
          python,
          ["-m", "venv", path.join(root, ".dino", "venvs", "engineering")],
          root,
        ),
        pip("engineering", [
          "install",
          "-r",
          path.join(root, "engineering", "requirements.txt"),
        ]),
      ];
    if (id === "fusion")
      return [
        step("npm", ["install"], path.join(cwd, "mcp-server")),
        step("npm", ["run", "build"], path.join(cwd, "mcp-server")),
      ];
    if (id === "freecad")
      return [
        step(
          python,
          ["-m", "venv", path.join(root, ".dino", "venvs", "freecad")],
          root,
        ),
        pip("freecad", ["install", cwd]),
      ];
    throw new Error(
      "This tool is installed as a native application. Use Connect to select it.",
    );
  }
  const port = String(
    new URL(urls[id] || `http://127.0.0.1:${item.port || 3002}`).port || 80,
  );
  if (action === "start") {
    if (id === "cad")
      return [step(venv(root, "engineering", "cadgen"), ["server"], root)];
    if (id === "llm-viz")
      return [
        step("corepack", [
          "yarn",
          "exec",
          "next",
          "dev",
          "-p",
          port,
          "--hostname",
          "127.0.0.1",
        ]),
      ];
    if (id === "transformer-explainer")
      return [step(node, [path.join(__dirname, "attention.cjs"), cwd, port])];
    if (id === "tensorspace")
      return [
        step(
          node,
          [
            path.join(__dirname, "..", "orchestrator", "static-server.cjs"),
            cwd,
            port,
          ],
          root,
        ),
      ];
    throw new Error(
      "Use the training guide or a connected MCP server for this tool.",
    );
  }
  if (action === "train" && id === "minimind")
    return [
      step(
        venv(root, "minimind"),
        [
          "train_pretrain.py",
          "--device",
          "cpu",
          "--hidden_size",
          "64",
          "--num_hidden_layers",
          "2",
          "--max_seq_len",
          "128",
          "--batch_size",
          "1",
          "--num_workers",
          "0",
          "--accumulation_steps",
          "1",
          "--epochs",
          "1",
          "--log_interval",
          "1",
          "--save_interval",
          "16",
          "--data_path",
          path.join(root, ".dino", "training", "input.jsonl"),
          "--save_dir",
          path.join(root, ".dino", "training", "weights"),
        ],
        path.join(cwd, "trainer"),
      ),
    ];
  if (action === "sample") {
    if (!["cad", "mujoco"].includes(id))
      throw new Error("No sample action for this tool.");
    return [
      step(
        venv(root, "engineering"),
        [
          path.join(root, "engineering", "sample.py"),
          id,
          path.join(root, ".dino", "artifacts"),
        ],
        root,
      ),
    ];
  }
  throw new Error("Unknown Dino action.");
}
function recipe(root, id, action, urls = {}, options = {}) {
  if (id === 'cad-assembly') return require('../cad/recipe.cjs').recipe(root, action, options);
  const steps = baseRecipe(root, id, action, urls);
  const item = tools.find((x) => x.id === id);
  if (action === "install" && item.path)
    steps.unshift({
      command: "git",
      args: ["submodule", "update", "--init", "--recursive", "--", item.path],
      cwd: root,
    });
  return steps;
}
function defaultConnection(root, id) {
  if (id === "cad" && root)
    return { command: venv(root, "engineering", "cadgen"), args: ["mcp"] };
  if (id === "fusion" && root)
    return {
      command: "node",
      args: [
        path.join(
          root,
          "engineering",
          "fusion360-mcp",
          "mcp-server",
          "dist",
          "index.js",
        ),
      ],
    };
  if (id === "freecad" && root)
    return { command: venv(root, "freecad", "freecad-mcp"), args: [] };
  return { command: "", args: [] };
}
module.exports = { tools, recipe, venv, defaultConnection };
