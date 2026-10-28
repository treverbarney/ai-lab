# Setup Notes

## Prerequisites
- Python 3.11+
- Fusion 360 (free personal license)
- Git
- uv (recommended) or pip

## Experts
```bash
# text-to-cad (already forked)
git clone https://github.com/treverbarney/text-to-cad.git
# follow its install (uv / cadgen)

# Fusion MCP
# Install the add-in from treverbarney/fusion360-mcp-server into Fusion AddIns folder
# Then run the MCP server

# MuJoCo
pip install mujoco
# Clone and install the MCP server

# FreeCAD
# Install FreeCAD + the MCP addon
```

## Orchestrator config example
See `orchestrator/config.example.yaml` (to be added).
