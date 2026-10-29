// Keep the upstream CLI unchanged, force all of its HTTP listeners onto loopback.
const path = require("node:path"),
  fs = require("node:fs"),
  net = require("node:net");
const root = process.argv[2];
const original = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (args[0] && typeof args[0] === "object")
    args[0] = { ...args[0], host: "127.0.0.1" };
  else if (typeof args[0] === "number" || /^\d+$/.test(String(args[0]))) {
    if (typeof args[1] === "string") args[1] = "127.0.0.1";
    else args.splice(1, 0, "127.0.0.1");
  }
  return original.apply(this, args);
};
try {
  const pkg = path.join(
    root,
    "node_modules",
    "@gridspace",
    "app-server",
    "package.json",
  );
  const meta = JSON.parse(fs.readFileSync(pkg, "utf8")),
    entry =
      typeof meta.bin === "string"
        ? meta.bin
        : Object.values(meta.bin || {})[0];
  if (!entry) throw Error("The installed upstream server exposes no CLI.");
  process.chdir(root);
  process.argv = [
    process.execPath,
    path.resolve(path.dirname(pkg), entry),
    "--port",
    "4324",
    "--host",
    "127.0.0.1",
    "--pre",
    "/views/plugin-kiri",
  ];
  require(process.argv[1]);
} catch (e) {
  console.error("Install Kiri:Moto runtime first. " + e.message);
  process.exitCode = 1;
}
