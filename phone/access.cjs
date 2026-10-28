const { execFile } = require("node:child_process");
const qr = require("qrcode");
const { PhoneServer } = require("./server.cjs");
class PhoneAccess {
  constructor(options) {
    this.server = new PhoneServer(options);
    this.env = options.env || process.env;
    this.createdServe = false;
    this.privateUrl = null;
    this.message = "";
  }
  async command(args) {
    const execute = (command) =>
      new Promise((resolve, reject) =>
        execFile(
          command,
          args,
          { env: this.env, timeout: 15000, maxBuffer: 1024 * 1024 },
          (error, stdout, stderr) =>
            error
              ? reject(Object.assign(error, { details: stderr }))
              : resolve(stdout),
        ),
      );
    try {
      return await execute("tailscale");
    } catch (error) {
      if (error.code === "ENOENT" && process.platform === "darwin")
        return execute("/Applications/Tailscale.app/Contents/MacOS/Tailscale");
      throw error;
    }
  }
  async start() {
    await this.server.start();
    this.message =
      "Local phone preview is ready. Enable the private link to reach it from your phone.";
    return this.info();
  }
  async enablePrivate() {
    if (!this.server.server) await this.server.start();
    const state = JSON.parse(await this.command(["status", "--json"]));
    const dns = state.Self?.DNSName?.replace(/\.$/, "");
    if (state.BackendState !== "Running" || !dns?.endsWith(".ts.net"))
      throw new Error("Connect Tailscale on this computer, then try again.");
    const config = JSON.parse(
      (await this.command(["serve", "status", "--json"])) || "{}",
    );
    const target = `http://127.0.0.1:${this.server.port}`;
    const existing = Object.entries(config.Web || {}).filter(([host]) =>
      host.endsWith(":8443"),
    );
    const own =
      existing.length === 1 && existing[0][1].Handlers?.["/"]?.Proxy === target;
    if ((config.TCP?.["8443"] || existing.length) && !own)
      throw new Error(
        "Tailscale port 8443 is already in use. Existing services were left unchanged.",
      );
    if (!own) {
      await this.command(["serve", "--bg", "--yes", "--https=8443", target]);
      this.createdServe = true;
    }
    this.privateUrl = `https://${dns}:8443`;
    this.server.publicOrigin = this.privateUrl;
    this.message =
      "Private phone access is ready. Connect Tailscale on your phone and scan the code.";
    return this.info();
  }
  async info() {
    const running = Boolean(this.server.server);
    const localUrl = running
      ? `http://127.0.0.1:${this.server.port}/phone/`
      : null;
    const url = running
      ? `${this.privateUrl ? this.privateUrl + "/phone/" : localUrl}#pair=${this.server.key}`
      : null;
    return {
      running,
      localUrl,
      privateUrl: this.privateUrl ? this.privateUrl + "/phone/" : null,
      pairingUrl: url,
      key: running ? this.server.key : null,
      qr:
        running && this.privateUrl
          ? await qr.toDataURL(url, { width: 240, margin: 2 })
          : null,
      message: this.message,
    };
  }
  async close() {
    await this.server.close();
    if (this.createdServe) {
      try {
        const status = JSON.parse(
          (await this.command(["serve", "status", "--json"])) || "{}",
        );
        const target = `http://127.0.0.1:${this.server.port}`;
        if (
          Object.entries(status.Web || {}).some(
            ([host, value]) =>
              host.endsWith(":8443") && value.Handlers?.["/"]?.Proxy === target,
          )
        )
          await this.command([
            "serve",
            "--yes",
            "--https=8443",
            "--set-path=/",
            "off",
          ]);
      } catch {
        /* The loopback server is already closed, even if Tailscale is offline. */
      }
    }
    this.createdServe = false;
    this.privateUrl = null;
    this.server.publicOrigin = null;
    this.message =
      "Phone access is off. Previous device sessions have been revoked.";
    return this.info();
  }
}
module.exports = { PhoneAccess };
