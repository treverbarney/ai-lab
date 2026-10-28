# AI Lab

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
cd neural/llm-viz && yarn && yarn dev
cd neural/transformer-explainer && npm install && npm run dev
```

### MiniMind training
```bash
cd neural/minimind
pip install -r requirements.txt
# Follow their README — full pretrain + SFT on mini data is ~2 hours on a 3090
```

### Dashboard
Open `dashboard/index.html` in a browser (or serve the folder) for links to every component.

## Adding the neural forks as submodules

```bash
git submodule add https://github.com/bbycroft/llm-viz neural/llm-viz
git submodule add https://github.com/poloclub/transformer-explainer neural/transformer-explainer
git submodule add https://github.com/tensorspace-team/tensorspace neural/tensorspace
git submodule add https://github.com/jingyaogong/minimind neural/minimind
```

## Cost
- Visualizers: free
- MiniMind 64M full pipeline: ~$0.40 cloud GPU or free on your own card
- Optional 7B Unsloth fine-tune: $0.35–$2

See `setup/` and `docs/` for more detail. Everything is modular so you can add vision, video, drones, or more physics later.
