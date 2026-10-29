# Upstream integration sources

Dino adapters keep upstream implementations external and retain their notices.
Pinned package versions are in package.json/package-lock.json or the integration
catalog. Kiri:Moto is pinned by its Git submodule commit.

| Component | Source | Upstream license label |
| --- | --- | --- |
| Online 3D Viewer | https://github.com/kovacsv/Online3DViewer | MIT |
| OCCT import JS | https://github.com/kovacsv/occt-import-js | LGPL-2.1; includes Open CASCADE notices |
| React Flow | https://github.com/xyflow/xyflow | MIT |
| Netron | https://github.com/lutzroeder/netron | See installed upstream package notices |
| marimo | https://github.com/marimo-team/marimo | See installed upstream package notices |
| Aim | https://github.com/aimhubio/aim | See installed upstream package notices |
| MLX LM | https://github.com/ml-explore/mlx-lm | See installed upstream package notices |
| Rerun | https://github.com/rerun-io/rerun | See installed upstream package notices |
| Stable-Baselines3 | https://github.com/DLR-RM/stable-baselines3 | See installed upstream package notices |
| Optuna | https://github.com/optuna/optuna | See installed upstream package notices |
| Kiri:Moto / Mesh:Tool | https://github.com/GridSpace/grid-apps | MIT |
| llama.cpp | https://github.com/ggml-org/llama.cpp | See separately installed upstream notices |

The build copies OCCT's unmodified JavaScript, worker, WebAssembly, and license
files to `studio/vendor/`. Their upstream source/build instructions are available
at the OCCT import JS repository above. Online 3D Viewer's URL-only adaptation
occurs at build time in `integrations/build.cjs`; its license is copied alongside
those assets. React Flow's license is bundled there too. npm-installed modules
retain their own LICENSE files. Optional Python packages retain their installed
package notices. Model weights and datasets have separate terms and are not
included in Dino Lab.
