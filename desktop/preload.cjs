const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "lab",
  Object.freeze({
    phoneInfo: () => ipcRenderer.invoke("lab:phone-info"),
    phoneStart: () => ipcRenderer.invoke("lab:phone-start"),
    phonePrivate: () => ipcRenderer.invoke("lab:phone-private"),
    phoneStop: () => ipcRenderer.invoke("lab:phone-stop"),
    phonePreview: () => ipcRenderer.invoke("lab:phone-preview"),
    initialize: () => ipcRenderer.invoke("lab:initialize"),
    onBootstrap: (callback) =>
      ipcRenderer.on("lab:bootstrap-log", (_event, text) => callback(text)),
    trainingData: () => ipcRenderer.invoke("lab:training-data"),
    run: (id, action) => ipcRenderer.invoke("lab:run", id, action),
    stop: (id) => ipcRenderer.invoke("lab:stop", id),
    jobs: () => ipcRenderer.invoke("lab:jobs"),
    artifacts: () => ipcRenderer.invoke("lab:artifacts"),
    saveConnection: (id, config) =>
      ipcRenderer.invoke("lab:connection-save", id, config),
    connect: (id) => ipcRenderer.invoke("lab:connection-connect", id),
    disconnect: (id) => ipcRenderer.invoke("lab:connection-disconnect", id),
    connectionState: () => ipcRenderer.invoke("lab:connection-state"),
    callTool: (id, name, args) =>
      ipcRenderer.invoke("lab:connection-call", id, name, args),
    onJobs: (callback) =>
      ipcRenderer.on("lab:jobs", (_event, jobs) => callback(jobs)),
    catalog: () => ipcRenderer.invoke("lab:catalog"),
    status: () => ipcRenderer.invoke("lab:status"),
    workspace: () => ipcRenderer.invoke("lab:workspace"),
    openFolder: (id) => ipcRenderer.invoke("lab:folder", id),
    openSource: (id) => ipcRenderer.invoke("lab:source", id),
    openView: (id, mode) => ipcRenderer.invoke("lab:view", id, mode),
    closeView: () => ipcRenderer.invoke("lab:close-view"),
    openBrowser: (id) => ipcRenderer.invoke("lab:browser", id),
    readDoc: (id) => ipcRenderer.invoke("lab:doc", id),
    saveUrl: (id, url) => ipcRenderer.invoke("lab:url", id, url),
    launchNative: (id, choose = false) =>
      ipcRenderer.invoke("lab:native", id, choose),
    onViewError: (callback) =>
      ipcRenderer.on("lab:view-error", (_event, message) => callback(message)),
  }),
);
