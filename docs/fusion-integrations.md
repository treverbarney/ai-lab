# Fusion requirements and useful next integrations

Dino Neural, Train, CAD, Fusion, Physics and FEM belong to the same Dino Lab
application. The desktop host runs the engines; the responsive web companion
controls the same host from a paired phone. Fusion remains a native application.

## Already connected in the code

The pinned bridge is [ignaciomolini/mcp-fusion360](https://github.com/ignaciomolini/mcp-fusion360).
It provides a Python Fusion add-in and a TypeScript MCP server. Its documented
operations include inspecting bodies and parameters, parameter changes with
snapshots/rollback, and cutouts. Tool discovery does not establish that a live
Fusion design can be modified: the native application and bridge must be running.

To use the current integration:

1. Install Autodesk Fusion and sign in under your Autodesk license.
2. Restore the pinned submodule, then use Install runtime in Dino Fusion.
3. Copy its Fusion360MCP add-in into Fusion's AddIns directory.
4. Enable it in Fusion's Scripts and Add-Ins dialog and open a design.
5. Connect the saved server in Dino and try a read-only inspection first.

The bridge's prerequisites do not list a paid Autodesk extension. Advanced
Autodesk simulation, generative design and manufacturing features have separate
entitlements; wrapping the API does not provide those entitlements.

Official setup references:
- [Autodesk add-in installation](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-install-an-ADD-IN-and-Script-in-Fusion-360.html)
- [Autodesk plans and extensions](https://www.autodesk.com/products/fusion-360/extensions)
- [Dino's exact local setup](../setup/install-notes.md)

## Prioritized next work

| Priority | Component | Value for Dino | Current status |
| --- | --- | --- | --- |
| 1 | Guided Fusion connection check | Walk through native app, add-in, bridge, MCP and one real inspection so readiness is clear | Next implementation; native verification required |
| 2 | [fusion2urdf](https://github.com/syuntoku14/fusion2urdf) | Export robot structure and joints from Fusion for a simulation pipeline | Candidate; MIT upstream; not installed or tested with Dino |
| 3 | [Standalone OCP Viewer](https://github.com/bernhard-42/ocp_viewer) | View build123d/CadQuery objects directly while editing Python parameters | Candidate; Apache-2.0 upstream; overlaps with the existing artifact viewer, so add only for live code feedback |
| 4 | Parameter editor and experiment comparison | Reuse the existing Fusion parameter tools and Optuna adapter to compare candidate designs | Product workflow to build, not another CAD engine |

The existing Online 3D Viewer handles artifact inspection. MuJoCo provides the
physics engine, and the optional Kiri:Moto adapter covers fabrication workflows.
Those should be exercised together before adding competing engines. URDF export
alone is not a complete drone simulator: actuator, inertia and flight dynamics
need explicit validation in a later robotics workflow.

No extra upstream code, Autodesk extension or native add-in was installed as part
of the interface redesign. These candidates require pinned versions, preserved
licenses and real native-app acceptance checks before being labeled supported.
