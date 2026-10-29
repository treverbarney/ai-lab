const esbuild = require("esbuild"),
  fs = require("node:fs/promises"),
  path = require("node:path");
(async () => {
  await esbuild.build({ entryPoints: ['studio/assembly-source.js'], bundle: true, format: 'esm', minify: true, outfile: 'studio/assembly.js' });
  await esbuild.build({
    entryPoints: ["studio/cad-source.js"],
    bundle: true,
    format: "esm",
    minify: true,
    outfile: "studio/cad.js",
    plugins: [
      {
        name: "local-occt-assets",
        setup(build) {
          build.onLoad(
            { filter: /(?:importerutils|o3dv\.module)\.js$/ },
            async (args) => ({
              contents: (await fs.readFile(args.path, "utf8"))
                .replace(
                  /function CreateOcctWorker \(worker\)\s*\{/,
                  "function CreateOcctWorker (worker) { const localWorker = new Worker('/studio/vendor/occt-import-js-worker.js'); localWorker.addEventListener('error', e => console.error('OCCT: '+e.message)); return Promise.resolve(localWorker);",
                )
                .replace(
                  "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/",
                  "/studio/vendor/",
                ),
              loader: "js",
              resolveDir: path.dirname(args.path),
            }),
          );
        },
      },
    ],
  });
  await esbuild.build({
    entryPoints: ["studio/flow-source.js"],
    bundle: true,
    format: "esm",
    minify: true,
    outfile: "studio/flow.js",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await fs.mkdir("studio/vendor", { recursive: true });
  for (const f of [
    "occt-import-js-worker.js",
    "occt-import-js.js",
    "occt-import-js.wasm",
    "license.occt-import-js.txt",
    "license.occt.txt",
  ])
    await fs.copyFile(
      "node_modules/occt-import-js/dist/" + f,
      "studio/vendor/" + f,
    );
  for (const [module, name] of [
    ["online-3d-viewer", "LICENSE.md"],
    ["@xyflow/react", "LICENSE"],
  ]) {
    try {
      await fs.copyFile(
        "node_modules/" + module + "/" + name,
        "studio/vendor/" + module.replace("/", "-") + "-LICENSE.txt",
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
