const { packager } = require("@electron/packager");
const path = require("node:path");
// Keep the application small. Upstream projects stay in the user's checkout.
packager({
  dir: path.join(__dirname, ".."),
  name: "AI Lab",
  executableName: "ai-lab",
  appBundleId: "com.treverbarney.ai-lab",
  out: path.join(__dirname, "..", "dist"),
  overwrite: true,
  asar: true,
  ignore: [
    /^\/neural\/(?!README\.md$)/,
    /^\/\.git(?:\/|$)/,
    /^\/test(?:\/|$)/,
    /^\/dist(?:\/|$)/,
  ],
  prune: true,
})
  .then((paths) => console.log(`App ready: ${paths.join(", ")}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
