const path = require("node:path");
const { Runtime } = require("../orchestrator/runtime.cjs");
const { Connections } = require("../orchestrator/mcp.cjs");
const { Plugins } = require("../plugins/manager.cjs");
const { recipe } = require("../adapters/registry.cjs");
const { defaultConnection } = require("../adapters/registry.cjs");
const { neural } = require("../dashboard/catalog.js");
const { environment } = require("../desktop/environment.cjs");
const { PhoneAccess } = require("./access.cjs");
const root = path.join(__dirname, "..");
const urls = () =>
  Object.fromEntries(
    neural
      .filter((x) => x.port)
      .map((x) => [x.id, `http://127.0.0.1:${x.port}/`]),
  );
const plugins = new Plugins(() => root);
const runtime = new Runtime({
  root,
  urls,
  env: environment(),
  buildRecipe: (workspaceRoot, id, action, localUrls, options) =>
    id.startsWith("plugin-")
      ? plugins.recipe(id, action, options)
      : recipe(workspaceRoot, id, action, localUrls),
});
const connections = new Connections(environment());
const phone = new PhoneAccess({
  plugins,
  getRoot: () => root,
  runtime,
  connections,
  urls,
  getConnection: (id) => defaultConnection(root, id),
  launchNative: () => {
    throw new Error(
      "Native app shortcuts are available when phone access is started from Dino desktop.",
    );
  },
  env: environment(),
});
(async () => {
  await phone.start();
  if (process.argv.includes("--tailscale")) await phone.enablePrivate();
  const info = await phone.info();
  console.log(
    "Dino Lab phone access\n" +
      info.pairingUrl +
      "\n\n" +
      info.message +
      "\nKeep this key private. Press Ctrl+C to stop.",
  );
})().catch(async (error) => {
  console.error(error.message);
  await phone.close();
  process.exitCode = 1;
});
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await Promise.allSettled([
    phone.close(),
    runtime.close(),
    connections.close(),
  ]);
  process.exit(0);
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
