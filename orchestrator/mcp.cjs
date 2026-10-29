const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
class Connections {
  constructor(env = process.env) {
    this.env = env;
    this.clients = new Map();
    this.pending = new Map();
  }
  async connect(id, config, cwd) {
    if (this.pending.has(id))
      throw new Error("Connection already in progress.");
    if (
      !config ||
      typeof config.command !== "string" ||
      !config.command.trim() ||
      !Array.isArray(config.args) ||
      config.args.some((x) => typeof x !== "string")
    )
      throw new Error(
        "Choose a server executable and provide its arguments as a JSON array.",
      );
    this.pending.set(id, {});
    let client, transport;
    try {
      await this.disconnect(id);
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        cwd,
        env: {
          ...this.env,
          ELECTRON_RUN_AS_NODE: "1",
          CADGEN_TELEMETRY: "0",
          CADGEN_UPDATE_CHECK: "0",
          PYTHONUNBUFFERED: "1",
        },
        stderr: "pipe",
      });
      client = new Client({ name: "dino-lab", version: "0.2.0" });
      this.pending.set(id, { client, transport });
      const errors = [];
      transport.stderr?.on("data", (b) => {
        errors.push(b.toString());
        if (errors.length > 30) errors.shift();
      });
      await client.connect(transport, { timeout: 15000 });
      const tools = [];
      let cursor;
      do {
        const result = await client.listTools({ cursor }, { timeout: 15000 });
        tools.push(...result.tools);
        cursor = result.nextCursor;
      } while (cursor && tools.length < 1000);
      client.onclose = () => {
        if (this.clients.get(id)?.client === client) this.clients.delete(id);
      };
      this.clients.set(id, { client, transport, tools, errors });
      return tools;
    } catch (error) {
      await client?.close().catch(() => {});
      await transport?.close().catch(() => {});
      throw error;
    } finally {
      this.pending.delete(id);
    }
  }
  async call(id, name, args) {
    const entry = this.clients.get(id);
    if (!entry || !entry.tools.some((t) => t.name === name))
      throw new Error(
        "Connect this server and choose one of its advertised tools.",
      );
    if (!args || typeof args !== "object" || Array.isArray(args))
      throw new Error("Tool arguments must be a JSON object.");
    return entry.client.callTool({ name, arguments: args }, undefined, {
      timeout: 60000,
    });
  }
  snapshot() {
    return [...this.clients].map(([id, { tools }]) => ({ id, tools }));
  }
  async disconnect(id) {
    const entry = this.clients.get(id);
    this.clients.delete(id);
    if (entry) await entry.client.close();
  }
  async close() {
    await Promise.allSettled(
      [...this.pending.values()].map((entry) => entry.client?.close()),
    );
    await Promise.all(
      [...this.clients.keys()].map((id) => this.disconnect(id)),
    );
  }
}
module.exports = { Connections };
