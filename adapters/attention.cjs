// Compatibility overlay for the pinned upstream; its source and manifests stay untouched.
const path = require("node:path");
const { pathToFileURL } = require("node:url");
async function start(root, port) {
  const { createServer } = await import(
    pathToFileURL(
      path.join(root, "node_modules", "vite", "dist", "node", "index.js"),
    ).href
  );
  const server = await createServer({
    root,
    configFile: path.join(root, "vite.config.ts"),
    resolve: {
      alias: [
        {
          find: /^\.\/popovers\//,
          replacement:
            path.join(root, "src", "components", "Popovers") + path.sep,
        },
      ],
    },
    server: { host: "127.0.0.1", port: Number(port), strictPort: true },
  });
  await server.listen();
  server.printUrls();
  const stop = async () => {
    await server.close();
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return server;
}
if (require.main === module)
  start(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { start };
