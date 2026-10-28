const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const server = new McpServer({ name: "dino-test", version: "1.0.0" });
server.registerTool(
  "echo",
  { description: "Echo a test message", inputSchema: { text: z.string() } },
  async ({ text }) => ({ content: [{ type: "text", text }] }),
);
server.connect(new StdioServerTransport());
