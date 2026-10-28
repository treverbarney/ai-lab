#!/usr/bin/env bash
# Safe to rerun from any directory. Existing gitlinks keep their pinned revisions.
set -euo pipefail
cd "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

git rev-parse --show-toplevel >/dev/null
add_module() {
  local name="$1" url="$2" target="neural/$1"
  if ! git ls-files --stage -- "$target" | awk '$1 == "160000" { found=1 } END { exit !found }'; then
    git submodule add "$url" "$target"
  fi
}
add_module llm-viz https://github.com/bbycroft/llm-viz
add_module transformer-explainer https://github.com/poloclub/transformer-explainer
add_module tensorspace https://github.com/tensorspace-team/tensorspace
add_module minimind https://github.com/jingyaogong/minimind

git submodule sync --recursive
git submodule update --init --recursive
printf '%s\n' 'Neural submodules are ready. Dependencies and training are opt-in.'
