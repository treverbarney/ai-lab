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
const catalog = require("../dashboard/catalog.js");
const workspace = require("./workspace.cjs");
let win,
  view,
  currentUrl,
  settings = {},
  root;
const homeFile = path.join(__dirname, "..", "dashboard", "index.html");
const homeUrl = pathToFileURL(homeFile).href;
const all = [...catalog.neural, ...catalog.engineering];
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
async function showView(id, mode) {
  const item = catalog.neural.find((x) => x.id === id && x.url);
  if (!item || !["hosted", "local"].includes(mode))
    throw new Error("No visualizer available.");
  const url = mode === "local" ? urls()[id] : item.url;
  if (!url) throw new Error("This tool has no local server configured.");
  if (mode === "local" && !(await workspace.probe(url)))
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
    title: "AI Lab",
    width: 1380,
    height: 920,
    minWidth: 800,
    minHeight: 620,
    backgroundColor: "#0c0f11",
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
  win.on("close", closeView);
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
    settings = {};
  }
  const candidate =
    settings.root || (!app.isPackaged ? path.join(__dirname, "..") : null);
  root = (await workspace.isWorkspace(candidate)) ? candidate : null;
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
  }));
  handle("status", () => workspace.status(root, urls()));
  handle("workspace", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Choose your ai-lab repository",
      properties: ["openDirectory"],
    });
    if (result.canceled) return root;
    const selected = result.filePaths[0];
    if (!(await workspace.isWorkspace(selected)))
      throw new Error(
        "Choose the ai-lab folder containing README.md, neural, setup and orchestrator.",
      );
    root = selected;
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
    const item = catalog.neural.find((x) => x.id === id && x.url);
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
