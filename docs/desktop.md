# AI Lab desktop

## Launch and package

Install Node.js 22.12+ and Git. In the repository run `npm ci` and `npm start`.
On Windows, use Git Bash for `bash setup/add-neural-submodules.sh`.
The dashboard has no frontend build step, external fonts, telemetry or polling loop.
Electron supplies the desktop window; its runtime is downloaded during install or
first launch. The root install does not install upstream tool dependencies.

`npm run package` creates a runnable app for the current OS and architecture in
`dist/`. Build on each target OS for its native app. On macOS open the `.app`;
on Windows open `ai-lab.exe`; on Linux run `ai-lab` in the output directory.
Linux needs a graphical desktop and Electron system dependencies. Local builds
are unsigned. Add signing/notarization before distributing publicly.

The bundle contains only the launcher, docs and setup notes. All upstream code,
models, training data, `.git` directories and development tests stay outside it.
Choose your repository using the top-right button in the packaged app. The
selection, native application shortcuts and local URLs are saved in Electron's per-user application data folder
(`workspace.json`); no checkout-specific paths are committed. A development
launch uses the repository containing this app unless another checkout was selected.

## Explore neural tools

“Explore demo” opens a hosted tool within the same window. “Back to lab” destroys
the tool view and frees its renderer. Only one visualizer stays open. The toolbar browser button and Setup → Demo in browser are fallbacks if an upstream page cannot run in Electron or a link is blocked.
Hosted demos require internet, may download browser models, and can use CPU/GPU.
The launcher starts no training or local servers and does not poll while idle.

“Setup” shows copyable commands. Run them manually from your repository root.
Install **Corepack** if `corepack` is unavailable (`npm install -g corepack`);
LLM Visualizer pins its own Yarn release. Read the upstream README before
installing tool dependencies or downloading models.

| Tool | Default local address | How to start |
| --- | --- | --- |
| LLM Visualizer | `http://127.0.0.1:3002/` | `cd neural/llm-viz`, `corepack yarn install`, `corepack yarn dev --hostname 127.0.0.1` |
| Transformer Explainer | `http://127.0.0.1:5173/` | `cd neural/transformer-explainer`, `npm install`, `npm run dev -- --host 127.0.0.1` |
| TensorSpace | Hosted playground | Follow the pinned upstream README for local examples/builds. |
| MiniMind | Project folder + training guide | Create a dedicated Python environment; follow the pinned README for data, hardware and training commands. |

If a server chooses another port, change the loopback address in its Setup panel.
Click “Refresh status” after starting or stopping a server. “Checked out” means
the submodule has a `.git` entry, not that its dependencies, models or training
are ready. “Server online” means the configured loopback HTTP endpoint responded
successfully; it does not identify or validate the service. Missing modules are
restored with `bash setup/add-neural-submodules.sh`. This script does not update
to upstream HEAD; revisions remain pinned by this repository.

## Engineering shortcuts

Fusion and FreeCAD “Launch app” opens an OS picker on first use for your installed application
(on macOS choose its `.app`, on Windows its `.exe`, on Linux its executable).
The selected app is remembered for later launches. “Choose app” reconnects it
if it moves. Canceling does nothing. The shortcut launches the app only; it does not install,
configure or start an MCP server. Text to CAD and MuJoCo link to their upstream
setup guides. “Setup” opens the existing engineering notes in the launcher.

MCP server configuration, Python environments and orchestrator workflows remain
independent. The orchestrator is currently a documented architecture, not an
implemented router. See `setup/install-notes.md` and `orchestrator/README.md`.

## Implementation and checks

- `dashboard/`: plain HTML, CSS and JavaScript; catalog is shared with the main process.
- `desktop/`: isolated preload bridge, fixed launch registry, repository status and packaging.
- `neural/`: Git submodules; no vendored source or bundled upstream dependencies.
- `npm test`: workspace validation, loopback policy, HTTP status and timeout handling.

The dashboard renderer is sandboxed with Node disabled and a restrictive CSP.
Visualizer views have no preload bridge, no Node access and denied permissions
and downloads. Privileged IPC is restricted to the dashboard's main frame and
fixed catalog IDs. Native launch uses a user-selected file, without a command shell.

If the app opens but a hosted tool fails, try Setup → “Demo in browser”, check internet
access, or start its local server. If the desktop app cannot start on Linux,
check Electron's native library/display requirements. A headless CI environment
needs a virtual display or headless Ozone support for GUI checks; do not disable the sandbox in normal use.
