# Dino Lab — engineering setup

Install Node 22.12+, Git and Python 3.12+. Run `npm ci`, `npm run setup`, then
`npm start`. The seven engines/wrappers live in this one repository as submodules.
Use each Dino workspace's **Install runtime** button for its dependencies.

## Dino CAD and Dino Physics

These share `.dino/venvs/engineering`. Installation pins cadgen and MuJoCo from
`engineering/requirements.txt`. CAD telemetry and update checks are disabled for
processes Dino starts. Use **Build sample plate** for STEP/STL and **Run sample
simulation** for a 1,000-step CPU sphere drop. Outputs are in `.dino/artifacts`.

For live CAD tools, use **Start CAD engine**, then **Save & connect** in the MCP
panel. The default executable is the engineering environment's `cadgen`, with
`["mcp"]` arguments. Some restricted execution environments cannot start cadgen's
engine; its error is displayed rather than treating a failed connection as ready.

Your text-to-cad fork is pinned at `engineering/text-to-cad`. Its agent skills and
full model-generation workflow remain available there. Dino includes the runtime
and MCP host; it does not include a built-in language model or API key.

## Dino Fusion

The previous `treverbarney/fusion360-mcp-server` URL was unavailable. The project
now pins the MIT-licensed `ignaciomolini/mcp-fusion360` upstream wrapper at
`engineering/fusion360-mcp`.

1. Install Autodesk Fusion on a supported desktop platform.
2. In Dino Fusion, **Install runtime** installs/builds `mcp-server/`.
3. Copy `engineering/fusion360-mcp/Fusion360MCP` into Fusion's AddIns directory:
   - macOS: `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/`
   - Windows: `%APPDATA%\Autodesk\Autodesk Fusion 360\API\AddIns\`
4. In Fusion, open Scripts and Add-Ins, choose Fusion360MCP and run it. The default
   local bridge port is 9876.
5. Dino's default connection is `node` plus the absolute path to
   `engineering/fusion360-mcp/mcp-server/dist/index.js`. Click **Save & connect**.

The native launcher detects `/Applications/Autodesk Fusion.app` when present,
otherwise it opens a picker. **Choose native app** changes the remembered path.
Native Fusion must be running with its add-in enabled before tools can inspect
or modify a design. Discovery alone is not proof that the native bridge is ready.

## Dino FEM

The wrapper is `engineering/freecad-mcp` (`neka-nat/freecad-mcp`).

1. Install FreeCAD.
2. Use **Install runtime** in Dino FEM to prepare `.dino/venvs/freecad`.
3. Copy `engineering/freecad-mcp/addon/FreeCADMCP` into your FreeCAD addon directory.
   See that submodule's `docs/installation.md` for the platform-specific location.
4. Restart FreeCAD, select the MCP Addon workbench and start its RPC server.
5. In Dino FEM, **Save & connect** starts the environment's `freecad-mcp` executable.

Dino detects `/Applications/FreeCAD.app` when present. The application, FEM solver
and native addon remain installed on the workstation. The wrapper's own docs
cover solver configuration and authentication. Keep native RPC listeners local.

## Tool calls

Connected servers show their real tools and input schemas. Enter arguments as a
JSON object and click **Run tool**. Calls run exactly as entered and may modify
open designs. Disconnect stops Dino's MCP connection. The local install does not
silently enable add-ins or copy files into either native app's configuration.
