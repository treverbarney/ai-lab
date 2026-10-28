const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
async function createServer(directory, port = 5174) {
  const root = await fs.realpath(directory);
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".bin": "application/octet-stream",
  };
  const server = http.createServer(async (req, res) => {
    try {
      const raw = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (raw === "/") {
        res.writeHead(302, { Location: "/examples/lenet/lenet.html" }).end();
        return;
      }
      const target = await fs.realpath(
        path.join(root, raw === "/" ? "examples/lenet/lenet.html" : raw),
      );
      if (
        !target.startsWith(root + path.sep) ||
        path
          .relative(root, target)
          .split(path.sep)
          .some((p) => p.startsWith("."))
      ) {
        res.writeHead(403).end();
        return;
      }
      const stat = await fs.stat(target);
      if (!stat.isFile()) throw new Error("Not a file");
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      require("node:fs")
        .createReadStream(target)
        .on("error", () => res.destroy())
        .pipe(res);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(port), "127.0.0.1", resolve);
  });
  return server;
}
if (require.main === module)
  createServer(process.argv[2], process.argv[3])
    .then((s) =>
      console.log(`TensorSpace ready at http://127.0.0.1:${s.address().port}/`),
    )
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
module.exports = { createServer };
