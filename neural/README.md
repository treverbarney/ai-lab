# Neural Track

The visualizers and training code are pinned Git submodules. Run
`bash setup/add-neural-submodules.sh` from the repository to restore all four
projects and their nested submodules. Install each tool’s dependencies only when
you need it. The desktop launcher works without installing or running these tools.

## Recommended layout
```
neural/
  llm-viz/              # 3D GPT visualization
  transformer-explainer/ # Live Transformer demo
  tensorspace/          # 3D NN framework
  minimind/             # From-scratch LLM training
```

## Why these
- Full 3D visuals of networks and data flow
- Interactive browser demos you can learn from immediately
- Complete, readable training pipeline (pretrain → SFT → RL) that runs on a single consumer GPU
- Easy to extend later with vision, video, or domain-specific heads

See the root README and `setup/add-neural-submodules.sh`.
