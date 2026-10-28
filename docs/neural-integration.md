# Neural + Engineering Integration Notes

The neural track and the CAD/physics track live side-by-side in this monorepo.

## Shared ideas
- Modular folders (`neural/`, existing engineering experts)
- Low-compute first (MiniMind 64M, MuJoCo on CPU, script-based CAD)
- Dashboard launcher so you can jump between tools
- Future extension points: vision models, physics-informed NNs, drone control, CAD generation from text

## Next steps you can do later
1. Add Unsloth fine-tuning experiments under `neural/unsloth/`
2. Hook a trained MiniMind or fine-tuned model into the orchestrator
3. Export CAD assemblies to MuJoCo and visualize with the 3D tools
4. Add a vision track (e.g. MiniMind multimodal or a small ViT)

Everything is designed so you can keep adding without breaking the existing structure.
