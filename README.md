# AI Lab

## Run the desktop app locally

Requires **Node.js 22.12+**, npm and Git. Run on macOS, Windows or Linux:

```bash
git clone --recurse-submodules https://github.com/treverbarney/ai-lab.git
cd ai-lab
npm ci
npm start
```

Already cloned? Run `bash setup/add-neural-submodules.sh` (Git Bash on Windows)
then `npm ci && npm start`. The setup script is safe to rerun and restores the
pinned submodules, including nested dependencies.

The dark launcher opens immediately. Explore hosted neural demos in the app,
open local visualizers after starting their servers, read setup docs, or launch
installed Fusion / FreeCAD apps. **No servers, training, package installs or
model downloads start in the background.** Hosted demos need internet and may
load models when opened; local mode needs each upstream project's dependencies.

To create a desktop application for your current OS, run `npm run package`.
Open **AI Lab** from `dist/` (on macOS, move the `.app` into Applications).
The first time you open a packaged app, click **Choose repository** and select
this checkout. Submodules stay outside the app bundle. These local builds are
unsigned; public distribution requires platform signing/notarization.
See [the desktop guide](docs/desktop.md) for local ports, packaging and troubleshooting.

Unified lab for **neural networks + LLM training** and **CAD / physics / engineering**.

Fork the best open-source tools, keep them modular, and run everything from one place. Designed to be low-compute and portfolio-friendly.

## Two Main Tracks

### 1. Neural Track (new)
- **3D GPT visualization**: [bbycroft/llm-viz](https://github.com/bbycroft/llm-viz)
- **Interactive Transformer explainer** (live GPT-2 in browser): [poloclub/transformer-explainer](https://github.com/poloclub/transformer-explainer)
- **3D neural network framework**: [tensorspace-team/tensorspace](https://github.com/tensorspace-team/tensorspace)
- **From-scratch LLM training** (64M model, ~2h on one 3090, ~$0.40): [jingyaogong/minimind](https://github.com/jingyaogong/minimind)

### 2. Engineering Track (existing)
- Parametric CAD (text-to-cad / build123d)
- Fusion 360 MCP
- MuJoCo physics
- FreeCAD / CalculiX FEM
- Orchestrator that routes tasks to the right expert

## Quick Start

### Visualizers (no GPU required)
```bash
# After adding as submodules (see setup/)
cd neural/llm-viz && corepack yarn install && corepack yarn dev --hostname 127.0.0.1
cd neural/transformer-explainer && npm install && npm run dev
```

### MiniMind training
```bash
cd neural/minimind
pip install -r requirements.txt
# Follow their README — full pretrain + SFT on mini data is ~2 hours on a 3090
```

### Dashboard
Use `npm start` for the desktop launcher. `dashboard/index.html` also works as a browser preview with hosted demo links; native shortcuts and local status require the desktop app.

## Adding the neural forks as submodules

```bash
bash setup/add-neural-submodules.sh
# Or, after cloning a repo with the submodules already registered:
git submodule update --init --recursive
```

## Cost
- Visualizers: free
- MiniMind 64M full pipeline: ~$0.40 cloud GPU or free on your own card
- Optional 7B Unsloth fine-tune: $0.35–$2

See `setup/` and `docs/` for more detail. Everything is modular so you can add vision, video, drones, or more physics later.
