const { packager } = require("@electron/packager");
const path = require("node:path");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
const platform = option("--platform", process.platform);
const arch = option("--arch", process.arch);
const buildId = new Date().toISOString().replace(/[-:.]/g, "");
if (
  !["darwin", "win32", "linux"].includes(platform) ||
  !["arm64", "x64"].includes(arch)
)
  throw new Error("Choose darwin/win32/linux and arm64/x64.");
// Only adapters and product assets are bundled. Source modules and local user data stay outside.
packager({
  dir: path.join(__dirname, ".."),
  name: "Dino Lab",
  executableName: "dino-lab",
  appBundleId: "com.treverbarney.dinolab",
  appCategoryType: "public.app-category.developer-tools",
  appCopyright: "Dino Lab · Trever Barney",
  icon: path.join(
    __dirname,
    "..",
    "dashboard",
    "assets",
    platform === "darwin"
      ? "dino-icon.icns"
      : platform === "win32"
        ? "dino-icon.ico"
        : "dino-icon.png",
  ),
  platform,
  arch,
  out: path.join(__dirname, "..", "dist", `build-${buildId}`),
  overwrite: true,
  asar: true,
  prune: true,
  ignore: [
    /^\/integrations\/upstream(?:\/|$)/,
    /^\/studio\/.*-source\.js$/,
    /^\/neural\/(?!README\.md$)/,
    /^\/engineering\/(text-to-cad|fusion360-mcp|freecad-mcp)(?:\/|$)/,
    /^\/\.git(?:\/|$)/,
    /^\/\.dino(?:\/|$)/,
    /^\/\.github(?:\/|$)/,
    /^\/test(?:\/|$)/,
    /^\/dist(?:\/|$)/,
  ],
})
  .then((paths) => console.log(`Dino Lab ready: ${paths.join(", ")}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
