const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "lab",
  Object.freeze({
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
