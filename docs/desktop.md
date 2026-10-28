# Dino Lab — desktop field guide

## One project

Use `npm ci`, `npm run setup` and `npm start` from the repository. The project owns
all eight Dino wrappers and their shared runtime, MCP host, activity view, guides
and packaging. Upstream engines stay as seven pinned Git submodules.

`npm run doctor` checks Git, Node, npm, Corepack, Python and source checkouts.
Node 22.12+ is required; Python 3.12+ is needed for engineering/training. Corepack
is used for the pinned Yarn version in llm-viz. Install Corepack if missing.

## First open

The app displays the Dino studio immediately. In a packaged app, **Create
workspace** clones the small Dino project into its application data directory.
Each tool fetches its own pinned source only when you click Install runtime.
You can instead click **Connect repository** and select an existing ai-lab checkout. Preferences and native app shortcuts
are stored in the per-user Dino Lab application data directory; older AI Lab
preferences are migrated when found.

Search the workbench by Dino name or upstream tool name. Open a workspace for its
install, run, view, MCP or native controls. Status distinguishes source checkout,
local HTTP availability, active jobs and connected MCP clients. None of these
states claims a native design bridge or trained model is ready without testing it.

## Run only what you need

**Install runtime** downloads that tool's dependencies and shows its output.
Neural browser tools keep dependencies in their submodule; Python tools use
separate environments under `.dino/venvs`. TensorSpace needs no dependency install.
The pinned Transformer Explainer source pairs Vite 5 with a Svelte plugin that
requires Vite 6/7. Dino installs Vite 7.3.7 with `--no-save --package-lock=false`
as a local dependency overlay, leaving the submodule manifest and lockfile
unchanged. Managed starts also set its project root as `SASS_PATH` for the
upstream Sass imports. A thin Vite overlay resolves its `popovers` imports to
the actual `Popovers` directory on case-sensitive systems. Re-run its Install
runtime action after resetting dependencies.

MiniMind installation can be a large ML download and happens only on request.

**Start local** starts one visualizer. Open its local view after its log says it
is ready. Default addresses:

| Workspace | Address |
| --- | --- |
| Dino Neural | `http://127.0.0.1:3002/` |
| Dino Attention | `http://127.0.0.1:5173/` |
| Dino Layers | `http://127.0.0.1:5174/` |

The local address can be edited in its tool panel; managed starts use that port.
Dino Layers serves the pinned LeNet example. Hosted demos work immediately with
internet; they may download browser models or use GPU resources when opened.
**Dino Lab** in the view toolbar returns to the studio and destroys that view.
The browser button and tool panel's browser link are fallbacks for hosted pages.

Activity and each tool panel show live output with a 30 KB cap. Stop terminates
only the process tree Dino started. Closing the desktop window stops owned jobs
and MCP clients; native Fusion/FreeCAD apps keep their own lifecycle.

## Train and build

Dino Train can prepare at most 32 JSONL records from a file you select, each with
a `text` field, and launch the tiny CPU pretraining profile. This profile uses
one epoch, two layers, hidden size 64 and 128-token sequences. Install MiniMind's
runtime first. Data and weights remain under `.dino/training`. Full training and
SFT follow the pinned upstream README; no full model is trained on startup.

Dino CAD and Dino Physics share an environment and serialize their jobs. Their
sample plate and drop test save real files in `.dino/artifacts`. The sidebar's
**Open build artifacts** opens this folder. Job metadata is in `.dino/receipts`.

Dino Fusion, CAD and FEM expose local stdio MCP connections. Save an executable
and argument array, connect, inspect advertised schemas and run explicit tool
calls. Default adapters are already filled in. Read **Engineering setup** for
native app/add-in requirements.

## Package

`npm run package` packages the current platform. `npm run package:mac` prepares an
Apple Silicon .app, including Dino's icon and bundle identity, from any build
host supported by Electron Packager. Open the app from `dist/`; on macOS move it
into Applications. Cross-built macOS bundles require testing on the Mac and are
unsigned; macOS signing/notarization needs a Mac and developer credentials.

The optional manually dispatched GitHub workflow packages natively on macOS,
Windows and Linux. Upstream source, `.dino` data, Git history, development tests
and workflow files are excluded from app bundles. The MCP SDK is bundled as a
runtime dependency; Node, Python and each native CAD app are workstation tools.

## Boundaries

No arbitrary shell text crosses the renderer bridge. Managed actions use fixed
argument arrays. The dashboard is sandboxed, Node is disabled in renderers, and
embedded tools have no privileged preload bridge. Native launch paths are chosen
by the user or detected in standard application locations. MCP calls are explicit;
there is no embedded autonomous agent or API billing setup.
