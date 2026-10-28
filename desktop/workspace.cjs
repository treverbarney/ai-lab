const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { neural, engineering } = require("../dashboard/catalog.js");
function localUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error("Use an http://localhost or http://127.0.0.1 address.");
  }
  return url.href;
}
async function isWorkspace(root) {
  if (!root) return false;
  try {
    const checks = await Promise.all(
      ["README.md", "neural", "setup", "orchestrator"].map((p) =>
        fs.stat(path.join(root, p)),
      ),
    );
    return checks[0].isFile() && checks.slice(1).every((s) => s.isDirectory());
  } catch {
    return false;
  }
}
async function moduleStatus(root, item) {
  if (!root) return "missing";
  try {
    // Git submodule checkouts have a .git file (or directory), unlike empty gitlink folders.
    await fs.stat(path.join(root, item.path, ".git"));
    return "checked out";
  } catch {
    return "missing";
  }
}
function probe(value, timeout = 1200) {
  return new Promise((resolve) => {
    let request;
    try {
      request = http.get(localUrl(value), (response) => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 400);
        request.destroy();
      });
      request.setTimeout(timeout, () => request.destroy());
      request.on("error", () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}
async function status(root, urls) {
  return Promise.all(
    [...neural, ...engineering].map(async (item) => ({
      id: item.id,
      checkout: item.path ? await moduleStatus(root, item) : "built in",
      local: urls[item.id] ? await probe(urls[item.id]) : null,
    })),
  );
}
module.exports = { localUrl, isWorkspace, moduleStatus, probe, status };
