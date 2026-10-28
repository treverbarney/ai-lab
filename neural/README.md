# Neural Track

Place the forked visualizers and training code here as git submodules.

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
