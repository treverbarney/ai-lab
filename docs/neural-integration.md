# Dino Lab — neural and engineering integration

Neural exploration, MiniMind training and engineering share the same Dino shell,
registry, job supervisor, MCP host, artifact directory and setup command.

The source engines remain separate submodules. This lets you update or replace a
visualizer, model trainer or CAD wrapper without rewriting the desktop project.
`npm run setup` checks out the pinned versions and their nested dependencies.

The engineering expert pattern is unchanged: generate with cadgen/build123d,
assemble with Fusion and validate with MuJoCo or FreeCAD. The current shared
surface is tool lifecycle, explicit MCP calls, logs and files. An autonomous
model that routes requests between experts is a future extension, not a hidden
dependency or a claimed capability of this build.

Start with a hosted neural demo, a tiny CPU training experiment, a sample STEP
plate or the sphere-drop simulation. Outputs stay local under `.dino/` and can be
handed off to the native engineering tools.
