#!/usr/bin/env bash
# Run from the root of the ai-lab repo
set -e

echo "Adding neural visualizers and MiniMind as submodules..."

git submodule add https://github.com/bbycroft/llm-viz neural/llm-viz || true
git submodule add https://github.com/poloclub/transformer-explainer neural/transformer-explainer || true
git submodule add https://github.com/tensorspace-team/tensorspace neural/tensorspace || true
git submodule add https://github.com/jingyaogong/minimind neural/minimind || true

echo "Done. Run 'git submodule update --init --recursive' if needed."
