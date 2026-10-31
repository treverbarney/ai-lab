const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  shell,
  dialog,
  session,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const { Runtime } = require("../orchestrator/runtime.cjs");
const { Connections } = require("../orchestrator/mcp.cjs");
const { Plugins } = require("../plugins/manager.cjs");
const { pluginAction } = require("../plugins/service.cjs");
const { recipe } = require("../adapters/registry.cjs");
const { defaultConnection } = require("../adapters/registry.cjs");
const { prepareTraining } = require("../orchestrator/training.cjs");
const { environment } = require("./environment.cjs");
const { Bootstrap } = require("./bootstrap.cjs");
const { PhoneAccess } = require("../phone/access.cjs");
let runtime, connections, bootstrap, phone, plugins;
app.setName("3D AI Learning");
app.setPath("userData", path.join(app.getPath("appData"), "3d-ai-learning"));
const catalog = require("../dashboard/catalog.js");
const workspace = require("./workspace.cjs");
let win,
  view,
  currentUrl,
  settings = {},
  root;
const homeFile = path.join(__dirname, "..", "dashboard", "index.html");
const homeUrl = pathToFileURL(homeFile).href;
const all = [...catalog.neural, ...catalog.engineering, ...catalog.lessons];
const itemById = (id) => {
  const item = all.find((x) => x.id === id);
  if (!item) throw new Error("Unknown tool.");
  return item;
};
const configFile = () => path.join(app.getPath("userData"), "workspace.json");
async function save() {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(configFile(), JSON.stringify(settings, null, 2));
}
function urls() {
  return Object.fromEntries(
    catalog.neural
      .filter((x) => x.port)
      .map((x) => [
        x.id,
        settings.urls?.[x.id] || `http://127.0.0.1:${x.port}/`,
      ]),
  );
}
function closeView() {
  if (view) {
    win.contentView.removeChildView(view);
    view.webContents.close();
    view = null;
  }
  currentUrl = null;
}
function bounds() {
  if (!view) return;
  const [width, height] = win.getContentSize();
  view.setBounds({ x: 0, y: 88, width, height: Math.max(0, height - 88) });
}
function handle(channel, fn) {
  ipcMain.handle(`lab:${channel}`, async (event, ...args) => {
    // Only our top-level dashboard may use privileged APIs.
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== homeUrl
    ) {
      throw new Error("Untrusted sender.");
    }
    return fn(...args);
  });
}
async function showView(id, mode, route = 'home') {
  const workspaceRoutes = ['home','neural','attention','layers','cad','fusion','physics','freecad','training','projects','files','flows','extensions','activity','settings'];
  if (!workspaceRoutes.includes(route)) throw Error('Unknown workspace.');
  let item = [...catalog.neural, ...catalog.lessons].find((x) => x.id === id && x.url);
  if (id === "studio" || id === "assembly" || id === "workspace") item = { name: id === "assembly" ? "Dino CAD & Assembly" : "Dino Integration Studio", url: "local" };
  if (!item || !["hosted", "local"].includes(mode))
    throw new Error("No visualizer available.");
  let url = mode === "local" ? urls()[id] : item.url;
  if (id === "studio" || id === "assembly" || id === "workspace") {
    await phone.start();
    const info = await phone.info();
    url = info.localUrl + "#pair=" + info.key + (id === "workspace" ? "&workspace=" + route : id === "assembly" ? "&cad=1" : "&studio=1");
  }
  if (!url) throw new Error("This tool has no local server configured.");
  if (mode === "local" && !(await workspace.probe(url, 45000)))
    throw new Error(
      "Local server is offline. Start it using the setup commands, then try again.",
    );
  closeView();
  currentUrl = url;
  const child = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: "lab-visualizers",
      backgroundThrottling: true,
    },
  });
  view = child;
  win.contentView.addChildView(child);
  bounds();
  const origin = new URL(url).origin;
  child.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  child.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== origin) event.preventDefault();
  });
  child.webContents.on("will-redirect", (event, target) => {
    if (new URL(target).origin !== origin) event.preventDefault();
  });
  child.webContents.on(
    "did-fail-load",
    (_event, code, description, _url, mainFrame) => {
      if (mainFrame && code !== -3 && view === child) {
        closeView();
        win.webContents.send(
          "lab:view-error",
          `Could not load ${item.name}: ${description}. Use Setup → Demo in browser, or check your connection.`,
        );
      }
    },
  );
  child.webContents.loadURL(url).catch(() => {});
}
async function createWindow() {
  win = new BrowserWindow({
    title: "3D AI Learning",
    icon: path.join(__dirname, "..", "dashboard", "assets", "dino-icon.png"),
    width: 1380,
    height: 920,
    minWidth: 800,
    minHeight: 620,
    backgroundColor: "#171817",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.on("resize", bounds);
  win.on("close", () => {
    closeView();
    runtime?.close().catch(console.error);
    bootstrap?.close().catch(console.error);
    connections?.close().catch(console.error);
    phone?.close().catch(console.error);
  });
  win.on("closed", () => {
    view = null;
    win = null;
  });
  win.once("ready-to-show", () => win.show());
  await win.loadFile(homeFile);
}
app.whenReady().then(async () => {
  try {
    settings = JSON.parse(await fs.readFile(configFile(), "utf8"));
  } catch {
    try {
      settings = JSON.parse(
        await fs.readFile(
          path.join(app.getPath("appData"), "ai-lab-desktop", "workspace.json"),
          "utf8",
        ),
      );
    } catch {
      settings = {};
    }
  }
  const candidate =
    settings.root ||
    (!app.isPackaged
      ? path.join(__dirname, "..")
      : path.join(app.getPath("userData"), "workspace"));
  root = (await workspace.isWorkspace(candidate)) ? candidate : null;
  bootstrap = new Bootstrap({
    directory: app.getPath("userData"),
    env: environment(),
    onLog: (text) => {
      if (win && !win.isDestroyed())
        win.webContents.send("lab:bootstrap-log", text);
    },
  });
  plugins = new Plugins(() => root);
  runtime = new Runtime({
    root,
    urls,
    env: environment(),
    buildRecipe: (workspaceRoot, id, action, localUrls, options) =>
      id.startsWith("plugin-")
        ? plugins.recipe(id, action, options)
        : recipe(workspaceRoot, id, action, localUrls, options),
  });
  connections = new Connections(environment());
  phone = new PhoneAccess({
    plugins,
    port: 4337,
    httpsPort: 8445,
    getRoot: () => root,
    runtime,
    connections,
    urls,
    getConnection: (id) =>
      settings.connections?.[id] || defaultConnection(root, id),
    env: environment(),
    launchNative: async (id) => {
      let target = settings.nativeApps?.[id];
      if (!target && process.platform === "darwin")
        target =
          id === "freecad"
            ? "/Applications/FreeCAD.app"
            : "/Applications/Autodesk Fusion.app";
      if (!target)
        throw new Error(
          "Select this native application in Dino desktop first.",
        );
      try {
        await fs.access(target);
      } catch {
        throw new Error(
          "Native app unavailable. Choose its application path in Dino desktop first.",
        );
      }
      if (process.platform === "linux")
        await new Promise((resolve, reject) => {
          const child = spawn(target, [], { detached: true, stdio: "ignore" });
          child.once("error", reject);
          child.once("spawn", () => {
            child.unref();
            resolve();
          });
        });
      else {
        const error = await shell.openPath(target);
        if (error) throw new Error(error);
      }
    },
  });
  const { Notification } = require("electron");
  runtime.on("job-finished", (value) => {
    if (Notification.isSupported()) new Notification(value).show();
  });
  runtime.on("workflow-finished", (value) => {
    if (Notification.isSupported()) new Notification(value).show();
  });
  let updateTimer;
  runtime.on("change", () => {
    if (updateTimer) return;
    updateTimer = setTimeout(() => {
      updateTimer = null;
      if (win && !win.isDestroyed())
        win.webContents.send("lab:jobs", runtime.snapshot());
    }, 100);
  });
  for (const s of [
    session.defaultSession,
    session.fromPartition("lab-visualizers"),
  ]) {
    s.setPermissionRequestHandler((_webContents, _permission, callback) =>
      callback(false),
    );
    s.setPermissionCheckHandler(() => false);
    s.on("will-download", (event) => event.preventDefault());
  }
  handle("catalog", () => ({
    ...catalog,
    root,
    urls: urls(),
    version: app.getVersion(),
    connections: Object.fromEntries(
      catalog.engineering
        .filter((x) => x.mcp)
        .map((x) => [
          x.id,
          settings.connections?.[x.id] || defaultConnection(root, x.id),
        ]),
    ),
  }));
  handle("workspace-view", route => showView("workspace", "hosted", route));
  handle("studio", () => showView("studio", "hosted"));
  handle("assembly", () => showView("assembly", "hosted"));
  handle("plugins-catalog", () =>
    require("../integrations/catalog.cjs").catalog.map(
      ({ key, name, description, resources }) => ({
        key,
        name,
        description,
        resources,
      }),
    ),
  );
  handle("artifact-import", async () => {
    if (!root) throw Error("Connect a workspace first.");
    const result = await dialog.showOpenDialog(win, {
      title: "Import model, CAD or dataset into Dino artifacts",
      properties: ["openFile"],
      filters: [
        {
          name: "Lab artifacts",
          extensions: [
            "onnx",
            "npy",
            "tflite",
            "pt",
            "pth",
            "gguf",
            "step",
            "stp",
            "iges",
            "igs",
            "fcstd",
            "stl",
            "obj",
            "glb",
            "gltf",
            "ply",
            "off",
            "3mf",
            "json",
            "jsonl",
            "rrd",
          ],
        },
      ],
    });
    if (result.canceled) return null;
    const source = result.filePaths[0],
      folder = path.join(root, ".dino", "artifacts");
    await fs.mkdir(folder, { recursive: true });
    const name =
      require("node:crypto").randomUUID().slice(0, 8) +
      "-" +
      path.basename(source);
    await fs.copyFile(source, path.join(folder, name));
    return name;
  });
  handle("plugins-list", () => plugins.list(true));
  handle("plugins-import", async (example = false) => {
    let directory;
    if (example === true)
      directory = path.join(
        __dirname,
        "..",
        "plugins",
        "examples",
        "artifact-report",
      );
    else if (typeof example === "string") {
      if (
        !require("../integrations/catalog.cjs").catalog.some(
          (c) => c.key === example,
        )
      )
        throw Error("Unknown integration.");
      directory = path.join(__dirname, "..", "plugins", "bundled", example);
    } else {
      const result = await dialog.showOpenDialog(win, {
        title: "Import a Dino plugin folder containing dino-plugin.json",
        properties: ["openDirectory"],
      });
      if (result.canceled) return null;
      directory = result.filePaths[0];
    }
    return plugins.import(directory);
  });
  handle("plugins-enable", (id, digest) => plugins.enable(id, digest));
  handle("plugins-disable", async (id, remove = false) => {
    await plugins.disable(id);
    await runtime.stop(id);
    await connections.disconnect(id);
    if (remove === true) await plugins.remove(id);
  });
  handle("plugins-action", (input) =>
    pluginAction(plugins, runtime, connections, input),
  );
  handle("workbench", (op, input) => phone.server.workbench.execute(op, input));
  handle("workbench-open", async () => {
    await phone.start();
    const info = await phone.info();
    return shell.openExternal(
      info.localUrl + "#pair=" + info.key + "&workbench=1",
    );
  });
  handle("phone-info", () => phone.info());
  handle("phone-start", async () => {
    await phone.start();
    try {
      return await phone.enablePrivate();
    } catch (error) {
      return {
        ...(await phone.info()),
        message:
          "Local preview is ready. Private phone link: " +
          (error.details || error.message),
      };
    }
  });
  handle("phone-private", () => phone.enablePrivate());
  handle("phone-stop", () => phone.close());
  handle("phone-preview", async () => {
    const info = await phone.info();
    if (info.localUrl)
      return shell.openExternal(info.localUrl + "#pair=" + info.key);
  });
  handle("initialize", async () => {
    if (root) return root;
    root = await bootstrap.initialize();
    runtime.root = root;
    settings.root = root;
    await save();
    return root;
  });
  handle("status", () => workspace.status(root, urls()));
  handle("jobs", () => runtime.snapshot());
  handle("training-data", async () => {
    if (runtime.jobs.get("minimind")?.state === "running")
      throw new Error(
        "Stop the current training job before changing its data.",
      );
    const result = await dialog.showOpenDialog(win, {
      title: "Choose JSONL text data for the tiny CPU training profile",
      properties: ["openFile"],
      filters: [{ name: "JSONL text records", extensions: ["jsonl"] }],
    });
    if (result.canceled) return null;
    return prepareTraining(root, result.filePaths[0]);
  });
  handle("run", async (id, action) => {
    if (id === "minimind" && action === "train")
      await fs.access(
        path.join(root || "", ".dino", "training", "input.jsonl"),
      );
    return runtime.start(id, action);
  });
  handle("stop", (id) => runtime.stop(id));
  handle("artifacts", async () => {
    if (!root) throw new Error("Connect your Dino Lab repository first.");
    const destination = path.join(root, ".dino", "artifacts");
    await fs.mkdir(destination, { recursive: true });
    const error = await shell.openPath(destination);
    if (error) throw new Error(error);
  });
  handle("connection-save", async (id, config) => {
    if (!catalog.engineering.some((x) => x.id === id && x.mcp))
      throw new Error("Unknown connection.");
    if (
      !config ||
      typeof config.command !== "string" ||
      !config.command.trim() ||
      !Array.isArray(config.args) ||
      config.args.some((x) => typeof x !== "string")
    )
      throw new Error(
        "Provide an executable and a JSON array of string arguments.",
      );
    await connections.disconnect(id);
    settings.connections = {
      ...settings.connections,
      [id]: { command: config.command, args: config.args },
    };
    await save();
  });
  handle("connection-connect", async (id) => {
    if (!root) throw new Error("Connect your Dino Lab repository first.");
    if (!catalog.engineering.some((x) => x.id === id && x.mcp))
      throw new Error("Unknown connection.");
    return connections.connect(
      id,
      settings.connections?.[id] || defaultConnection(root, id),
      root,
    );
  });
  handle("connection-disconnect", (id) => connections.disconnect(id));
  handle("connection-state", () => connections.snapshot());
  handle("connection-call", async (id, name, args) => {
    if (id.startsWith("plugin-")) await plugins.approved(id);
    return connections.call(id, name, args);
  });
  handle("workspace", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Connect your Dino Lab repository",
      properties: ["openDirectory"],
    });
    if (result.canceled) return root;
    const selected = result.filePaths[0];
    if (!(await workspace.isWorkspace(selected)))
      throw new Error(
        "Choose the ai-lab folder containing README.md, neural, setup and orchestrator.",
      );
    await phone.server.flows.close();
    phone.server.flows.runs = [];
    await runtime.close();
    await connections.close();
    await phone.server.workbench.lock;
    await phone.server.cad.lock;
    await phone.server.cad.fusionLock;
    phone.server.cad.reviews.clear();
    await plugins.lock;
    root = selected;
    runtime.root = root;
    runtime.jobs.clear();
    settings.root = root;
    await save();
    return root;
  });
  handle("folder", async (id) => {
    if (!root) throw new Error("Choose your ai-lab repository first.");
    const item = id === "root" ? { path: "" } : itemById(id);
    if (
      item.path &&
      (await workspace.moduleStatus(root, item)) !== "checked out"
    )
      throw new Error(
        "Submodule missing. Run bash setup/add-neural-submodules.sh in your repository.",
      );
    const error = await shell.openPath(path.join(root, item.path || ""));
    if (error) throw new Error(error);
  });
  handle("source", (id) => shell.openExternal(itemById(id).source));
  handle("view", showView);
  handle("close-view", closeView);
  handle("browser", (id) => {
    if (id === undefined) return currentUrl && shell.openExternal(currentUrl);
    const item = [...catalog.neural, ...catalog.lessons].find((x) => x.id === id && x.url);
    if (!item) throw new Error("Unknown visualizer.");
    return shell.openExternal(item.url);
  });
  handle("url", async (id, value) => {
    if (!catalog.neural.some((x) => x.id === id && x.port))
      throw new Error("Unknown local visualizer.");
    settings.urls = { ...settings.urls, [id]: workspace.localUrl(value) };
    await save();
    return urls();
  });
  handle("doc", async (id) => {
    const doc = catalog.docs.find((x) => x.id === id);
    if (!doc) throw new Error("Unknown document.");
    // Bundled docs remain available even before a packaged app is connected to a checkout.
    return fs.readFile(path.join(__dirname, "..", doc.path), "utf8");
  });
  handle("native", async (id, choose = false) => {
    const item = itemById(id);
    if (!item.native) throw new Error("No native application shortcut.");
    let target = settings.nativeApps?.[id];
    if (!target && process.platform === "darwin") {
      const candidate =
        id === "freecad"
          ? "/Applications/FreeCAD.app"
          : "/Applications/Autodesk Fusion.app";
      try {
        await fs.access(candidate);
        target = candidate;
      } catch {}
    }
    if (!target || choose === true) {
      const result = await dialog.showOpenDialog(win, {
        title: `Choose ${item.name} application`,
        defaultPath:
          process.platform === "darwin" ? "/Applications" : undefined,
        properties: ["openFile"],
      });
      if (result.canceled) return false;
      target = result.filePaths[0];
    }
    try {
      await fs.access(target);
    } catch {
      throw new Error(
        "Application moved or missing. Use “Choose app” to reconnect it.",
      );
    }
    if (process.platform === "linux") {
      await fs.access(target, require("node:fs").constants.X_OK);
      await new Promise((resolve, reject) => {
        const child = spawn(target, [], { detached: true, stdio: "ignore" });
        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
    } else {
      const error = await shell.openPath(target);
      if (error) throw new Error(error);
    }
    settings.nativeApps = { ...settings.nativeApps, [id]: target };
    await save();
    return true;
  });
  await createWindow();
  app.on("activate", () => {
    if (!win) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

let quitting = false;
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  Promise.allSettled([
    runtime?.close(),
    connections?.close(),
    bootstrap?.close(),
    phone?.close(),
  ]).finally(() => app.quit());
});
