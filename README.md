# AI Lab

Expert-orchestrated system for CAD, full assemblies with physics, math/physics learning, and engineering design. Built for limited budget and compute using specialized experts (MoE-style routing via MCP) instead of one giant model.

**Goal**: Generate working parametric CAD + assemblies that pass physics/interference/FEM checks, with Fusion 360 as the preferred interactive environment.

## Architecture

```
User / Main Agent
       |
       v
Orchestrator (routes tasks)
   /   |   \    \
  v    v    v    v
CAD Gen  Fusion  Physics  Math/FEM
Expert   Expert  Expert   Expert
(text-   (MCP)   (MuJoCo) (FreeCAD/
to-cad)                 CalculiX)
```

- **Orchestrator**: Lightweight Python agent (or Claude/Grok/Codex with MCP) that routes to specialists.
- **CAD Generation Expert**: Fork of [text-to-cad](https://github.com/treverbarney/text-to-cad) — agent writes build123d/OpenCASCADE Python scripts → STEP/STL/GLB. Self-correcting via measurements.
- **Fusion Expert**: MCP server driving Autodesk Fusion 360 (free personal license). Preferred for assemblies, joints, drawings.
- **Physics Expert**: MuJoCo for fast rigid-body dynamics, contacts, and assembly validation on CPU.
- **Validation Expert**: FreeCAD MCP + CalculiX for lightweight FEM/stress checks.

## Recommended Forks & Wrappers

| Tool | Repo / Install | Role | License |
|------|----------------|------|---------|
| text-to-cad | Forked to treverbarney/text-to-cad | Primary parametric generator | MIT |
| Fusion MCP | faust-machines/fusion360-mcp-server or frankhommers/autodesk-fusion-mcp | Drive Fusion 360 | MIT |
| FreeCAD MCP | neka-nat/freecad-mcp | Open-source CAD + FEM | MIT |
| SolidCraft | tangency-labs/solidcraft | Pure Rust parametric + native MCP | MIT/Apache |
| MuJoCo | `pip install mujoco` + optional MCP wrapper | Assembly dynamics | Apache 2.0 |

## Quick Start (Low Compute)

1. Clone this repo and the forked text-to-cad.
2. Install Fusion 360 (personal) + one MCP add-in.
3. `pip install mujoco build123d` (or use cadgen from text-to-cad).
4. Run local model (or API) as orchestrator with MCP servers for each expert.
5. Workflow: Prompt → CAD script → Export STEP → Import/validate in Fusion or MuJoCo → Iterate on failures.

## Next Steps in This Repo

- [ ] Orchestrator skeleton (`orchestrator.py`)
- [ ] MCP client wrappers
- [ ] Example assembly workflows
- [ ] Self-correction loops (measure → fix)
- [ ] Low-compute model recommendations

Built intelligently for the AI Lab. Contributions welcome.
