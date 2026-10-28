# Orchestrator

Lightweight Python router that decides which expert MCP server to call based on task type.

## Example routing

- "design a bracket with holes" → text-to-cad expert
- "assemble these parts with joints in Fusion" → Fusion MCP
- "check if this assembly collides under gravity" → MuJoCo expert
- "run a simple stress check" → FreeCAD FEM expert

Skeleton code coming next. Uses MCP client libraries to keep each expert's tools isolated.
