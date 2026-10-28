# Dino Lab — one project, modular engines

Dino Lab owns the product shell, shared tool registry, process lifecycle and MCP
client. Each upstream engine keeps its own source, runtime and license.

## Shared layers

- `dashboard/`: Dino brand, studio, eight tool panels, live activity and field guides.
- `dashboard/catalog.js`: engine identity, submodule paths, hosted/local view metadata.
- `adapters/registry.cjs`: fixed install/start/sample/training recipes and default MCP connections.
- `orchestrator/runtime.cjs`: owned subprocesses, bounded logs, stop controls and action receipts.
- `orchestrator/mcp.cjs`: local stdio MCP handshakes, real tool discovery and explicit calls.
- `desktop/`: isolated Electron bridge, view lifecycle, native launchers and packaging.
- `neural/` and `engineering/`: pinned upstream submodules and thin Dino engineering jobs.
- `.dino/`: local environments, artifacts, training data and job receipts. Never committed.

## Neural track

Explore a hosted visualizer immediately, or install its dependencies in its source
folder and start its local server from Dino. Only one embedded visualizer stays
open. Returning to Dino destroys that view. Local tool processes are independent
and remain visible in Activity until stopped or until the desktop window closes.

Dino Train installs MiniMind into its own Python environment. The tiny CPU profile
copies at most 32 selected text records, caps each text at 2,048 characters, and
runs a two-layer, 64-hidden-dimension model for one epoch at 128-token sequence
length. It is a diagnostic learning profile. Full MiniMind training remains an
upstream workflow; no dataset or model downloads happen automatically on launch.

## Engineering track and expert pattern

The original expert boundaries remain intact:

1. **Generator** — text-to-cad / cadgen / build123d.
2. **Assembler** — Fusion's local add-in and MCP wrapper.
3. **Validator** — MuJoCo physics and FreeCAD/FEM.
4. **Reasoner** — an external model or agent may call these surfaces later.

Dino now implements the lifecycle and MCP host these experts share. It does not
pretend to include an autonomous natural-language router. A connected server
advertises its tools; the user sees the actual JSON schema, supplies arguments,
and runs an explicit call. Model selection and autonomous planning remain a
separate extension point.

The sample plate and sphere-drop jobs produce actual local STEP/STL/XML/JSON
outputs. They are independent validation examples, not a coupled CAD-to-physics
pipeline or a stress certification. Artifacts in `.dino/artifacts` can be handed
off to the native applications or MCP tools.

## Resource policy

No startup installs, background training, idle polling or persistent model
processes. Installs and jobs run on demand. Shared CAD/physics environment jobs
are serialized. Logs are capped at 30 KB per tool. The Stop control terminates
the process tree Dino started, with a bounded grace period before forced stop.
Native apps launched independently are left to their own application lifecycle.
