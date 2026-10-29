# CAD & assembly

Open **CAD & assembly** in the desktop sidebar, integration studio, or paired phone.
The same responsive workspace runs on all three. Your computer runs CAD jobs;
the phone sends controls and displays results. No drone tools are included.

## First build

1. Adjust the hinged-enclosure dimensions, or use the default example.
2. **Save first revision**. Revisions are immutable parameter snapshots.
3. **Install CAD engine** once. This explicitly creates `.dino/venvs/assembly`
   and installs `build123d==0.13.0` and its dependencies. Python 3.12+ and network
   access are required. This environment is separate from cadgen and MuJoCo.
4. **Build & check**. The existing orchestrator serializes the CPU job with other
   installs, builds and training. Stop/queue/log/receipt behavior is shared.
5. Inspect the checks and download STEP, STL, source JSON, BOM CSV, or check report.

The starter contains an enclosure base, hinged lid, Ø3 cut-to-length pin, four
mounting screws and four nuts. M3/M4 hardware changes the screws, nuts and matching
floor clearance holes together. Hardware dimensions are simplified nominal
examples, not a supplier-certified parts library. Threads and socket recesses
are omitted. Pin retention is not modeled. Select the actual hardware, materials,
manufacturing process and tolerances before fabrication.

## Preview and assembly

The initial draft preview shows positive primitives, **without cuts**. A successful
build replaces it with tessellated exact solids, including holes. Select parts in
the tree or 3D view; toggle visibility, isolate, fit the view, open the lid through
0–110°, or explode the display. Pose, visibility and explosion are display controls,
not edits to the saved/exported closed assembly. This is a template assembly with
one revolute connection and fixed hardware; arbitrary joint editing is not included.

The engine checks all static component pairs for positive-volume interference,
then checks the lid against every other component at 0°, 55°, and 110°. It reports
minimum closed-lid and pin/lid distances using OpenCascade. Three clear poses are
not a continuous collision proof. A failed check leaves an inspectable report and
marks the job failed. The report is written only after all exports finish.

The STEP file is actually reimported and its volume compared with the original.
Source JSON retains named dimensions, component IDs, constructive primitive
operations and joint metadata. STEP retains geometry/component labels, **not native
Fusion/FreeCAD feature history or a guaranteed transfer of joints**. STL is a mesh.
Mass is an estimate from solid volumes and example PETG/steel densities; print
infill, manufacturing variation and real material properties are not accounted for.

## Editing and revisions

Supported word commands are deliberately bounded: `width to 120 mm and height to
40 mm`, `wider by 10 mm`, `deeper by 5 mm`, `taller by 5 mm`, or `use M4 screws`.
Review the proposed changes before they are saved. Unsupported requests return
an error. No LLM, API key, generated Python execution, or inference is involved.
Other dimensions use the fields. Dimensional bounds and hardware thickness checks
run on the host. Restoring an earlier revision creates another revision; existing
files remain unchanged. A stale save from another tab/phone is rejected.

State lives in `.dino/cad/designs.json`; revision inputs are in
`.dino/cad/revisions/`. Build files use unique `assembly-REVISION` names under
`.dino/artifacts`. Downloads use the existing authenticated artifact endpoint.
No runtime dependencies or upstream source are vendored into Git.

Source JSON can be reopened through **Reopen editable source**. The host validates
the template, parameter ranges and digest, then regenerates geometry through the
trusted builder. Imported construction instructions are not executed.

## Live Fusion

The **Live Fusion** tab gives guided access to the existing upstream MCP bridge:
connect, read document metadata and user parameters, inspect root-component bodies,
measure clearance between two named bodies, and review/apply a parameter expression.
The default Fusion bridge is `127.0.0.1:9876`; it needs the native Fusion application
and the running upstream `Fusion360MCP` add-in. Install the wrapper from the existing
Dino Fusion tool. Register the upstream add-in folder through Fusion's Scripts and
Add-Ins dialog and run it. See the submodule README for platform-specific paths.

Parameter review captures the document metadata, parameters and body list; it
expires after two minutes, can be used only once, and is rechecked before applying.
The native upstream rolls parameters back on recompute failure. The review cannot
lock Fusion against direct user interaction: do not switch documents during a call.
Documents with identical metadata are not a globally unique identity. Receipts are
saved under `.dino/cad/fusion-receipts`. Existing generic MCP tools remain available
for cutouts and other supported operations. This upgrade does not add native Fusion
assembly creation or export APIs to the upstream bridge.

Native Fusion execution requires a Mac/Windows acceptance check. Protocol tests
use a clearly identified fixture; they do not establish Fusion API compatibility.

## Local validation

`npm test` covers the existing host and new dimension/revision/API/Fusion-review
boundaries. After installing the CAD engine, `npm run test:cad` launches the desktop
app with Playwright/Electron, exercises the actual paired UI, builds exact solids,
downloads and validates exports, restores revisions and checks a 390px phone layout.
Playwright must be available to Node (installed locally or through `NODE_PATH`).
`npm run test:cad:geometry` runs real OpenCascade checks including deliberately
overlapping solids and dimensional variants. These commands do not require native
Fusion. See `docs/cad-validation.md` for the actual validation record.
