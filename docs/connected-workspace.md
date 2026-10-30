# Connected Dino workspace

The desktop app now opens a common workspace after connecting its repository. The same workspace is served at /phone/ for a paired browser. A persistent sidebar routes to neural viewers, CAD, live Fusion controls, FreeCAD actions, training, results, projects, visual workflows, integration studio and activity. Advanced desktop plugin and connection management remains under Desktop setup.

Local embedded pages retain their state when switching tools. Internal links for known workspaces route through the parent navigation. Browser Back/Forward works. Hosted neural frames are released when leaving them to avoid keeping unused visualization workloads running; they require internet. Their upstream interfaces and attribution remain intact.

Training accepts a small JSONL dataset through the paired API and uses the existing bounded preparation function. Preparing data never starts training; active training blocks dataset replacement. Engine installation and training are explicit actions. Physics remains the existing MuJoCo sphere drop, not simulation of the CAD assembly. Fusion/FreeCAD still require native applications and their bridges.

Validation on the Mac: the existing 31 tests passed, plus two new endpoint/framing tests. Browser acceptance exercised the actual hosted neural canvas, CAD viewport, retained CAD/project drafts, JSONL preparation in a temporary workspace, Back navigation, nested crosslinks, settings, and a 390px mobile viewport without page overflow. No uncaught page errors occurred. The packaged native Mac app also opened the shared workspace automatically and rendered CAD inside it. These checks do not claim successful optional engine installation, native Fusion calls, or full training/physics execution.

Run the browser acceptance test with Playwright available to Node: node test/workspace.e2e.cjs. It uses a temporary host/workspace, Chrome, and internet for the hosted neural viewer. No user datasets or projects are changed.
