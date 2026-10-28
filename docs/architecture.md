# Architecture Details

## Expert Pattern

Instead of one giant model knowing everything, the system uses specialized experts:

1. **Generator** (text-to-cad / build123d): Produces parametric code and geometry.
2. **Assembler** (Fusion MCP): Handles joints, full assemblies, preferred UI.
3. **Validator** (MuJoCo + FreeCAD): Physics, dynamics, interference, light FEM.
4. **Reasoner** (local LLM or sympy): Math, units, design iteration, physics equations.

The orchestrator maintains a short task context and routes. Results (measurements, errors, STEP files) are fed back for self-correction.

## Why this is smart for limited resources

- Most heavy work is geometry kernels and physics solvers (CPU-efficient).
- LLM only needs to write/edit scripts or call tools, not invent geometry from scratch.
- Fusion free personal covers the polished assembly side without paid licenses.
- All open-source pieces can run locally.
