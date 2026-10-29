# CAD milestone validation — 0.7

Validated locally in the managed Linux build environment. No GitHub Actions or
Vercel builds were used.

| Area | Result | Evidence / limit |
| --- | --- | --- |
| Existing host plus new CAD boundaries | Passed | `npm test`: 31 tests. Includes pairing, CSRF, artifact containment, queue/process lifecycle, MCP, plugins, CAD dimension bounds, immutable revisions, concurrent stale saves, source validation and reviewed Fusion edit boundaries. |
| Exact enclosure geometry | Passed | Actual build123d 0.13.0 / OpenCascade run; 11 valid solids. Default, compact M4 and larger/thicker variants pass static and three-pose motion checks. |
| Negative geometry check | Passed | A deliberately overlapping replacement screw is detected as base/screw interference; checks fail. |
| STEP interchange | Passed | Actual export then reimport; solid count 11 and total volume match. Default closed lid minimum distance 0.4 mm; pin/lid minimum distance 0.2 mm. |
| Desktop to CAD engine | Passed | `npm run test:cad`: real Electron dashboard → paired CAD page → M4 edit → queued build → exact 3D preview → STEP/STL/source/BOM downloads. |
| Editing and assembly controls | Passed | Highlight/isolate/show all; hinge angle and explode controls; reviewed word edits; restore/reload revision; reopen source JSON. |
| Mobile layout | Passed in browser | 390 × 844 CSS viewport; no page overflow. Screenshots inspected. Physical iPhone/Android and private Tailscale route remain unverified. |
| Guided Fusion operations | Protocol fixture passed | Single-use and expired reviews, changed-document rejection, successful expression update, and native error propagation. Fixture is not native Fusion. |
| Native Fusion API | Not verified here | Fusion is unavailable on the Linux executor. Requires Mac/Windows with the upstream add-in running. No native assembly/joint import is claimed. |
| Mechanical validity | Limited | Simplified hardware, example material densities, no threads/pin retention, and three sampled hinge poses only. Not a manufacturing certification or continuous collision proof. |
| Mac package | Cross-package only | Unsigned Apple Silicon Electron app. Archive/bundle checks are possible on Linux; native launch requires a Mac. |

Reproduce after `npm ci` and explicit CAD engine installation:

```bash
npm test
npm run test:cad:geometry
npm run build:viewer
npm run test:cad
```

The UI acceptance script needs Playwright available to Node. It deliberately runs
the real installed engine rather than replacing build results with fixtures.
The engine install is on demand, creates a separate environment, and imports the
pinned build123d version before marking the environment ready.

The initial positive-primitives draft is labeled as omitting cuts. Only a built
revision's tessellated exact geometry is labeled exact. Source JSON is regenerated
through the trusted template; imported geometry instructions are not executed.
