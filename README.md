# Dino Lab

**One local desktop project for neural exploration, training, CAD and physics.**
Charcoal, warm off-white and Dino orange. Eight tool workspaces. One set of controls.

## Open the app

Requires Node.js **22.12+**, npm and Git. Python **3.12+** is needed for engineering
and training runtimes. Corepack is needed for Dino Neural (`npm install -g corepack`
if it is missing).

```bash
git clone --branch codex/desktop-launcher --recurse-submodules https://github.com/treverbarney/ai-lab.git
cd ai-lab
npm ci
npm run setup
npm start
```

Already cloned? Update this branch, then run the last three commands.
`npm run setup` restores all seven pinned upstream modules, including nested
submodules. It works on macOS, Windows and Linux without a Bash dependency.

The desktop app opens immediately. Use **Open workspace** on any tool to install
its runtime, start or stop it, open a hosted/local view, connect its MCP server,
or inspect its output. Nothing installs, trains or runs on launch. Start only
what you need. Hosted workspaces require internet.

## Use it on your phone

Open **Phone access** in Dino Lab desktop, then **Enable phone access**. With
Tailscale connected on both your computer and phone, scan the private pairing QR
code. On iPhone use Share → Add to Home Screen; on Android use Install app.

The phone workbench controls host jobs, streams logs, uses configured MCP tools,
and downloads build artifacts. Your host computer must remain awake with Dino
running. Hosted neural demos can run in the phone browser. The app shell remains
available offline; local jobs require the host connection.

Phone access starts only when enabled, uses a private HTTPS Tailscale Serve link
plus device pairing, and revokes its sessions when stopped. It does not expose
a public server. See [the phone guide](docs/phone.md). Terminal users can instead
run `npm run phone:private` from the repo (or `npm run phone` for a localhost preview).

## Eight wrappers. One workbench.

| Dino workspace | Engine | Controls |
| --- | --- | --- |
| Dino Neural | llm-viz | Hosted/local views, install, start/stop |
| Dino Attention | Transformer Explainer | Hosted/local views, install, start/stop |
| Dino Layers | TensorSpace | Hosted/local views, built-in local server |
| Dino Train | MiniMind | Isolated runtime, dataset selection, tiny CPU pretrain, logs |
| Dino Fusion | Fusion 360 MCP | Native launcher, wrapper build, MCP tools |
| Dino CAD | text-to-cad / cadgen / build123d | CAD engine, sample STEP/STL build, MCP tools |
| Dino Physics | MuJoCo | Shared engineering runtime, CPU simulation sample |
| Dino FEM | FreeCAD MCP | Native launcher, wrapper install, MCP tools |

All wrappers use the shared adapter registry and orchestrator. Outputs are in
`.dino/artifacts`, training files in `.dino/training`, environments in
`.dino/venvs`, and job receipts in `.dino/receipts`. Those folders are ignored by Git.
The upstream engines remain independent submodules, with their names and licenses
preserved. Dino does not rename or vendor their source.

## Make a desktop application

```bash
npm run package       # current OS and CPU architecture
npm run package:mac   # Apple Silicon .app (cross-packaging supported)
```

Open **Dino Lab** from `dist/`. On macOS, move `Dino Lab.app` into Applications.
A packaged app can **Create workspace** with one click (requires Git), or use
**Connect repository** to select this checkout; its upstream
sources, environments and outputs stay outside the bundle. Builds are unsigned.
The optional **Package Dino Lab** GitHub workflow builds native packages for all
three desktop platforms when manually dispatched.

`npm test` runs the adapter, process lifecycle, MCP, workspace and local-server
checks. `npm run doctor` checks installed tools and submodules.

See [the Dino desktop guide](docs/desktop.md), [engineering setup](setup/install-notes.md)
and [project architecture](docs/architecture.md). Fusion and FreeCAD require their
native applications and enabled add-ins on your computer. Dino's MCP inspector
runs explicit tool calls; it does not include an autonomous LLM agent or paid API.
