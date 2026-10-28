const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { neural, engineering, docs } = require("../dashboard/catalog.js");
const workspace = require("../desktop/workspace.cjs");
const packageInfo = require("../package.json");
const tools = [...neural, ...engineering];
const json = (res, status, value) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
};
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function equal(a, b) {
  const x = Buffer.from(hash(a)),
    y = Buffer.from(hash(b));
  return crypto.timingSafeEqual(x, y);
}
async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) throw new Error("Request too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}
class PhoneServer {
  constructor({
    getRoot,
    runtime,
    connections,
    urls,
    getConnection,
    launchNative,
    port = 4317,
  }) {
    Object.assign(this, {
      getRoot,
      runtime,
      connections,
      urls,
      getConnection,
      launchNative,
      port,
    });
    this.server = null;
    this.sessions = new Map();
    this.streams = new Set();
    this.attempts = new Map();
    this.publicOrigin = null;
    this.key = null;
  }
  async start() {
    if (this.server) return;
    this.key = crypto.randomBytes(32).toString("base64url");
    const server = http.createServer((req, res) =>
      this.request(req, res).catch((error) => {
        if (!res.headersSent) json(res, 400, { error: error.message });
        else res.destroy();
      }),
    );
    this.server = server;
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(this.port, "127.0.0.1", resolve);
      });
    } catch (error) {
      this.server = null;
      throw error;
    }
    this.port = server.address().port;
    this.change = () => {
      if (this.streamTimer) return;
      this.streamTimer = setTimeout(() => {
        this.streamTimer = null;
        for (const stream of this.streams)
          stream.res.write(
            `event: jobs\ndata: ${JSON.stringify(this.runtime.snapshot().map((job) => ({ ...job, log: job.log.slice(-8000) })))}\n\n`,
          );
      }, 500);
    };
    this.runtime.on("change", this.change);
  }
  origin(req) {
    const host = req.headers.host;
    const local = [`127.0.0.1:${this.port}`, `localhost:${this.port}`];
    if (local.includes(host)) return `http://${host}`;
    if (this.publicOrigin && host === new URL(this.publicOrigin).host)
      return this.publicOrigin;
    throw new Error("Unrecognized host.");
  }
  session(req) {
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("dino_phone="));
    const entry =
      cookie && this.sessions.get(hash(cookie.slice("dino_phone=".length)));
    return entry && entry.expires > Date.now() ? entry : null;
  }
  async state() {
    const root = this.getRoot();
    return {
      version: packageInfo.version,
      host: require("node:os").hostname(),
      workspace: Boolean(root),
      workspaceName: root ? path.basename(root) : null,
      status: await workspace.status(root, this.urls()),
      jobs: this.runtime.snapshot(),
      connections: this.connections
        .snapshot()
        .map(({ id, tools }) => ({ id, tools })),
      tools,
    };
  }
  async file(name) {
    if (!name || path.basename(name) !== name || name.startsWith("."))
      throw new Error("Invalid artifact name.");
    const root = this.getRoot();
    if (!root) throw new Error("Connect a repository on the desktop first.");
    const base = await fs.realpath(path.join(root, ".dino", "artifacts"));
    const target = await fs.realpath(path.join(base, name));
    if (
      !target.startsWith(base + path.sep) ||
      (await fs.stat(target)).isDirectory()
    )
      throw new Error("Artifact unavailable.");
    return target;
  }
  async request(req, res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    let origin;
    try {
      origin = this.origin(req);
    } catch {
      return json(res, 403, { error: "Unrecognized host." });
    }
    const url = new URL(req.url, origin);
    if (req.headers.origin && req.headers.origin !== origin)
      return json(res, 403, { error: "Request origin rejected." });
    if (!["GET", "POST"].includes(req.method))
      return json(res, 405, { error: "Method unavailable." });
    if (
      req.method === "POST" &&
      (req.headers.origin !== origin ||
        !req.headers["content-type"]?.startsWith("application/json"))
    )
      return json(res, 403, {
        error: "Use this app to send authenticated JSON requests.",
      });
    if (req.method === "POST" && url.pathname === "/api/pair") {
      const address = req.socket.remoteAddress;
      const now = Date.now();
      const tries = this.attempts.get(address) || { count: 0, since: now };
      if (now - tries.since > 60000) {
        tries.count = 0;
        tries.since = now;
      }
      this.attempts.set(address, tries);
      if (tries.count >= 8)
        return json(res, 429, {
          error: "Too many pairing attempts. Wait a minute.",
        });
      const input = await body(req);
      tries.count++;
      if (typeof input.key !== "string" || !equal(input.key, this.key))
        return json(res, 401, {
          error:
            "Pairing key does not match. Open Phone access on your desktop.",
        });
      if (this.sessions.size >= 100)
        return json(res, 429, {
          error: "Device limit reached. Restart phone access on the desktop.",
        });
      const token = crypto.randomBytes(32).toString("base64url");
      const expires = now + 7 * 86400000;
      this.sessions.set(hash(token), { expires });
      tries.count = 0;
      res.setHeader(
        "Set-Cookie",
        `dino_phone=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${origin.startsWith("https:") ? "; Secure" : ""}`,
      );
      return json(res, 200, { paired: true });
    }
    if (url.pathname.startsWith("/api/")) {
      const session = this.session(req);
      if (!session)
        return json(res, 401, {
          error: "Pair this phone with Dino Lab on your desktop.",
        });
      if (req.method === "POST" && url.pathname === "/api/logout") {
        const cookie = (req.headers.cookie || "").match(
          /(?:^|;\s*)dino_phone=([^;]+)/,
        );
        if (cookie) this.sessions.delete(hash(cookie[1]));
        for (const entry of this.streams)
          if (entry.session === session) entry.res.end();
        res.setHeader(
          "Set-Cookie",
          "dino_phone=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return json(res, 200, { paired: false });
      }
      if (req.method === "GET" && url.pathname === "/api/state")
        return json(res, 200, await this.state());
      if (req.method === "GET" && url.pathname === "/api/events") {
        if (this.streams.size >= 20)
          return json(res, 429, { error: "Too many live connections." });
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.write(
          `event: jobs\ndata: ${JSON.stringify(this.runtime.snapshot().map((job) => ({ ...job, log: job.log.slice(-8000) })))}\n\n`,
        );
        const entry = { res, session };
        this.streams.add(entry);
        const timer = setInterval(() => {
          if (session.expires < Date.now()) res.end();
          else res.write(": alive\n\n");
        }, 25000);
        timer.unref();
        req.on("close", () => {
          clearInterval(timer);
          this.streams.delete(entry);
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/files") {
        const root = this.getRoot();
        let files = [];
        try {
          for (const entry of await fs.readdir(
            path.join(root, ".dino", "artifacts"),
            { withFileTypes: true },
          )) {
            if (entry.isFile() && !entry.name.startsWith(".")) {
              const stat = await fs.stat(await this.file(entry.name));
              files.push({
                name: entry.name,
                size: stat.size,
                modifiedAt: stat.mtime.toISOString(),
              });
            }
          }
        } catch {}
        return json(
          res,
          200,
          files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
        );
      }
      if (req.method === "GET" && url.pathname === "/api/download") {
        const name = url.searchParams.get("name");
        const target = await this.file(name);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
          "Cache-Control": "no-store",
        });
        require("node:fs")
          .createReadStream(target)
          .on("error", () => res.destroy())
          .pipe(res);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/doc") {
        const doc = docs.find((x) => x.id === url.searchParams.get("id"));
        if (!doc) throw new Error("Unknown guide.");
        return json(res, 200, {
          name: doc.name,
          text: await fs.readFile(path.join(__dirname, "..", doc.path), "utf8"),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/action") {
        const { id, action } = await body(req);
        const tool = tools.find((x) => x.id === id);
        if (!tool) throw new Error("Unknown tool.");
        if (action === "stop") await this.runtime.stop(id);
        else if (action === "connect") {
          if (!tool.mcp) throw new Error("This tool has no MCP server.");
          await this.connections.connect(
            id,
            this.getConnection(id),
            this.getRoot(),
          );
        } else if (action === "disconnect")
          await this.connections.disconnect(id);
        else if (action === "launch") {
          if (!tool.native) throw new Error("No native launcher.");
          await this.launchNative(id);
        } else if (["start", "sample", "install", "train"].includes(action)) {
          if (id === "minimind" && action === "train")
            await fs
              .access(
                path.join(
                  this.getRoot() || "",
                  ".dino",
                  "training",
                  "input.jsonl",
                ),
              )
              .catch(() => {
                throw new Error(
                  "Prepare the tiny CPU training dataset in Dino desktop first.",
                );
              });
          await this.runtime.start(id, action);
        } else throw new Error("Unknown action.");
        return json(res, 200, { accepted: true });
      }
      if (req.method === "POST" && url.pathname === "/api/tool") {
        const { id, name, args } = await body(req);
        return json(res, 200, await this.connections.call(id, name, args));
      }
      return json(res, 404, { error: "Endpoint unavailable." });
    }
    if (req.method !== "GET")
      return json(res, 405, { error: "Method unavailable." });
    const staticFiles = new Map([
      ["/phone/", "index.html"],
      ["/phone/app.js", "app.js"],
      ["/phone/styles.css", "styles.css"],
      ["/phone/manifest.webmanifest", "manifest.webmanifest"],
      ["/phone/sw.js", "sw.js"],
      ...[180, 192, 512].map((size) => [
        `/phone/icons/dino-${size}.png`,
        `icons/dino-${size}.png`,
      ]),
    ]);
    if (url.pathname === "/" || url.pathname === "/phone") {
      res.writeHead(302, { Location: "/phone/" }).end();
      return;
    }
    const relative = staticFiles.get(url.pathname);
    let file;
    if (relative) file = path.join(__dirname, relative);
    else if (url.pathname === "/phone/catalog.js")
      file = path.join(__dirname, "..", "dashboard", "catalog.js");
    else return json(res, 404, { error: "File unavailable." });
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".webmanifest": "application/manifest+json",
      ".png": "image/png",
    };
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)],
      "Cache-Control": "no-cache",
    });
    res.end(await fs.readFile(file));
  }
  async close() {
    clearTimeout(this.streamTimer);
    if (this.change) this.runtime.removeListener("change", this.change);
    for (const stream of this.streams) stream.res.end();
    this.streams.clear();
    this.sessions.clear();
    this.attempts.clear();
    this.key = null;
    const server = this.server;
    this.server = null;
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
}
module.exports = { PhoneServer };
