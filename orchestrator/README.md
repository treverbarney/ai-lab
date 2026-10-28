# Dino orchestrator

The orchestrator is implemented in Node alongside the desktop host so the whole
project has one lifecycle and one launch command.

- `runtime.cjs`: fixed adapter recipes, subprocess supervision, output, stop and receipts.
- `mcp.cjs`: standard MCP stdio host; connect, discover, inspect, call, disconnect.
- `static-server.cjs`: loopback-only TensorSpace server, with path and symlink containment.
- `training.cjs`: bounded JSONL preparation for MiniMind's diagnostic CPU profile.

`adapters/registry.cjs` preserves the generator / assembler / validator expert
boundaries. The neural and engineering workspaces share this infrastructure.
The host does not contain an autonomous agent or silently route natural-language
requests to modifying tools. A future agent can use the same connected MCP surfaces.

Outputs and receipts stay in `.dino/` in the selected repository. Closing the Dino
window stops owned jobs and disconnects its MCP clients.
