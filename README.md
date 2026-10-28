# AI Lab

Expert-orchestrated system for CAD, physics, assemblies, and engineering on limited compute/budget.

## Architecture (MoE-style at system level)

Central orchestrator routes tasks to specialized experts via MCP (Model Context Protocol):

- **CAD Generation Expert**: Fork of [text-to-cad](https://github.com/treverbarney/text-to-cad) (build123d + OpenCASCADE). Agent writes parametric Python scripts → STEP/STL/GLB. Ideal for parts and simple assemblies.
- **Fusion 360 Expert**: Wrapper around Fusion MCP (e.g. faust-machines/fusion360-mcp-server or official Autodesk). Preferred for full assemblies, joints, and free personal license workflows.
- **Physics / Dynamics Expert**: MuJoCo MCP (Rongxuan-Zhou/mujoco-mcp-server) or simple mujoco Python bindings. Validates assemblies, kinematics, dynamics, interference on CPU.
- **FEM / Validation Expert**: FreeCAD MCP (neka-nat/freecad-mcp) + CalculiX for lightweight stress analysis.
- **Math / Physics Solver Expert**: Local models or sympy/scipy for equations, units, optimization.

Orchestrator keeps context light by routing only relevant tools to the right expert. Self-correction loops: generate → measure/validate → fix.

## Forked / Wrapped Tools

| Tool | Repo | Role | Status |
|------|------|------|--------|
| text-to-cad | treverbarney/text-to-cad | Primary parametric CAD gen | Forked |
| fusion360-mcp-server | treverbarney/fusion360-mcp-server | Fusion assemblies & joints | Forked |
| mujoco-mcp-server | treverbarney/mujoco-mcp-server | Physics / dynamics validation | Forked |
| freecad-mcp | treverbarney/freecad-mcp | FEM / open validation | Forked |
| SolidCraft | tangency-labs/solidcraft (wrap) | Pure-Rust parametric alternative | Wrapper |

## Low-Compute Priorities

- Local / small models where possible
- CPU-friendly solvers (MuJoCo, CalculiX)
- Script-first CAD (build123d) for deterministic validation
- Fusion 360 personal free license for preferred UI
- Headless checks before heavy simulation

## Quick Start (local)

1. Clone this repo and the forked experts.
2. Install Fusion 360 (free personal) + enable MCP add-in from the forked fusion360-mcp-server.
3. `pip install mujoco build123d` and set up MuJoCo MCP.
4. Configure your agent (Claude Code, Cursor, Grok, etc.) with the MCP servers.
5. Point the orchestrator at the experts.

See `orchestrator/` for skeleton code and `docs/` for detailed plans.

## Phased Build Plan

1. **Phase 1 (done in this scaffold)**: Architecture, forks, README, basic structure.
2. **Phase 2**: Implement lightweight MCP orchestrator + routing logic.
3. **Phase 3**: Custom skills for text-to-cad focused on assemblies + physics export (URDF/MJCF).
4. **Phase 4**: Fusion ↔ text-to-cad roundtrip, validation loops, MuJoCo assembly tests.
5. **Phase 5**: Expert self-improvement / math-physics learning loops.

Built for intelligent, constrained AI engineering labs.
