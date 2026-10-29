const http = require("node:http");
const zlib = require("node:zlib");
function decode(chunks, headers) {
  let b = Buffer.concat(chunks);
  const encoding = headers["content-encoding"];
  if (encoding === "gzip") b = zlib.gunzipSync(b);
  else if (encoding === "br") b = zlib.brotliDecompressSync(b);
  else if (encoding === "deflate") b = zlib.inflateSync(b);
  delete headers["content-encoding"];
  delete headers.etag;
  delete headers["last-modified"];
  return b.toString();
}

class Views {
  constructor(host) {
    this.host = host;
    this.sockets = new Set();
    this.owners = new Map();
  }
  async target(req) {
    const match = /^\/views\/(plugin-[a-z0-9-]+)(\/.*)$/.exec(req.url);
    if (!match) throw Error("Unknown view.");
    const p = await this.host.plugins.approved(match[1]);
    const view = p.manifest.view;
    if (!view?.port) throw Error("This plugin has no local service view.");
    const job = this.host.runtime.jobs.get(match[1]);
    if (job?.state !== "running" || job.action !== "start")
      throw Error("Start this tool from the integration studio first.");
    return {
      port: view.port,
      path: view.stripPrefix ? match[2] : req.url,
      id: match[1],
    };
  }
  headers(req, port) {
    const headers = {
      ...req.headers,
      host: "127.0.0.1:" + port,
      origin: "http://127.0.0.1:" + port,
    };
    delete headers.authorization;
    delete headers["accept-encoding"];
    delete headers["proxy-authorization"];
    delete headers["x-forwarded-host"];
    delete headers["x-forwarded-for"];
    const cookies = (headers.cookie || "")
      .split(";")
      .filter((s) => !s.trim().startsWith("dino_phone="));
    if (cookies.length) headers.cookie = cookies.join(";");
    else delete headers.cookie;
    return headers;
  }
  async request(req, res) {
    const target = await this.target(req);
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: target.port,
        path: target.path,
        method: req.method,
        headers: this.headers(req, target.port),
      },
      (response) => {
        const headers = {
          ...response.headers,
          "cache-control": "no-store",
          "x-frame-options": "SAMEORIGIN",
          "content-security-policy":
            "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
        };
        delete headers["access-control-allow-origin"];
        delete headers["access-control-allow-credentials"];
        if (headers["set-cookie"])
          headers["set-cookie"] = headers["set-cookie"]
            .filter((c) => !/^dino_phone=/i.test(c))
            .map((c) =>
              c.replace(/;\s*Path=[^;]*/i, "; Path=/views/" + target.id + "/"),
            );
        if (headers.location) {
          const url = new URL(
            headers.location,
            "http://127.0.0.1:" + target.port,
          );
          if (url.origin !== "http://127.0.0.1:" + target.port) {
            upstream.destroy();
            res.writeHead(502).end("External redirects are unavailable.");
            return;
          }
          headers.location = target.path.startsWith("/views/")
            ? url.pathname + url.search
            : "/views/" + target.id + url.pathname + url.search;
        }
        if (
          target.id === "plugin-aim" &&
          /text\/html|javascript/.test(String(headers["content-type"]))
        ) {
          const chunks = [];
          response.on("data", (c) => chunks.push(c));
          response.on("end", () => {
            let source = decode(chunks, headers);
            source = source.replaceAll(
              "https://api.github.com/repos/aimhubio/aim/releases",
              "/api/integration-release-notes",
            );
            source = source.replace(
              /<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/pyodide[^"\n]+"[^>]*><\/script>/g,
              "",
            );
            source = source.replace(
              /<link[^>]+href="https:\/\/fonts\.googleapis\.com[^"\n]+"[^>]*>/g,
              "",
            );
            source = source.replace(
              "case 0:return R.a.setPyodide({current:null,namespace:null,isLoading:!0}),e.next=3,window.loadPyodide",
              'case 0:if(!window.loadPyodide){R.a.setPyodide({current:null,namespace:null,isLoading:!1});return e.abrupt("return");}return R.a.setPyodide({current:null,namespace:null,isLoading:!0}),e.next=3,window.loadPyodide',
            );
            delete headers["content-length"];
            res.writeHead(response.statusCode, headers);
            res.end(source);
          });
        } else if (
          target.id === "plugin-netron" &&
          (String(headers["content-type"]).includes("text/html") ||
            target.path.split("?")[0] === "/browser.js")
        ) {
          const chunks = [];
          response.on("data", (c) => chunks.push(c));
          response.on("end", () => {
            let html = decode(chunks, headers).replace(
              /content="\/data\//g,
              'content="data/',
            );
            if (target.path.split("?")[0] === "/browser.js")
              html = html
                .replace("await age();", "/* Dino manages pinned updates. */")
                .replace(
                  "await consent();",
                  "/* No analytics consent is needed: telemetry is disabled. */",
                )
                .replace(
                  "await telemetry();",
                  "/* Local-only telemetry disabled. */",
                );
            delete headers["content-length"];
            res.writeHead(response.statusCode, headers);
            res.end(html);
          });
        } else {
          res.writeHead(response.statusCode, headers);
          response.pipe(res);
        }
      },
    );
    upstream.once("error", () => {
      if (!res.headersSent)
        res
          .writeHead(503, { "content-type": "text/plain" })
          .end(
            "Tool is starting or unavailable. Check its log, then reload the view.",
          );
      else res.destroy();
    });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  }
  async upgrade(req, socket, head) {
    try {
      const origin = this.host.origin(req);
      if (!this.host.session(req) || req.headers.origin !== origin)
        throw Error("Pair this browser first.");
      const target = await this.target(req);
      const request = http.request({
        host: "127.0.0.1",
        port: target.port,
        path: target.path,
        headers: this.headers(req, target.port),
      });
      request.on("upgrade", (response, remote, buffer) => {
        this.sockets.add(socket);
        this.sockets.add(remote);
        this.owners.set(socket, this.host.session(req)?.id);
        socket.write(
          "HTTP/1.1 101 Switching Protocols\r\n" +
            Object.entries(response.headers)
              .map(([k, v]) => k + ": " + v)
              .join("\r\n") +
            "\r\n\r\n",
        );
        if (buffer.length) socket.write(buffer);
        if (head.length) remote.write(head);
        remote.pipe(socket);
        socket.pipe(remote);
        const close = () => {
          clearInterval(timer);
          this.owners.delete(socket);
          this.sockets.delete(socket);
          this.sockets.delete(remote);
          socket.destroy();
          remote.destroy();
        };
        const timer = setInterval(() => {
          if (!this.host.session(req)) close();
        }, 25000);
        timer.unref();
        socket.on("close", close);
        remote.on("close", close);
        socket.on("error", close);
        remote.on("error", close);
      });
      request.on("response", () => socket.destroy());
      request.on("error", () => socket.destroy());
      request.end();
    } catch {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  }
  revoke(id) {
    for (const [socket, owner] of this.owners)
      if (owner === id) socket.destroy();
  }
  close() {
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    this.owners.clear();
  }
}
module.exports = { Views };
