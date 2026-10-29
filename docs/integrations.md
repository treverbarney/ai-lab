# Dino Integration Studio

Open **Plugins → Open integration studio**. It opens inside the Dino desktop
window. A paired phone uses **Studio → Integration studio**. Desktop retains
plugin import/review/enable controls. Both interfaces share settings, jobs,
artifacts, workflows and logs on the host.

## First run

1. In desktop Plugins, choose **Add & review adapter** from the curated catalog.
2. Review the manifest, upstream project and resource notes; **Trust & enable**.
3. Open the integration studio. Select the tool and **Install runtime** if needed.
4. Use **Run starter experiment**, then **Start tool view → Open embedded view**.
5. Use **Stop job** when finished. Install/sample/train/run/check jobs share the
   heavy-job queue. Started services occupy their tool slot and remain running.

Nothing installs, starts, trains or downloads model weights on app launch.
Runtimes are isolated Python environments under `.dino/venvs/<tool>`. Python 3.12
is recommended. Large dependencies and model weights are excluded from the app.
Resource descriptions are qualitative guidance, not measured memory guarantees.

| Adapter | Included behavior | Requirements |
| --- | --- | --- |
| Netron | Generate valid tiny ONNX; inspect model graph in embedded viewer | Optional Netron runtime |
| Online 3D Viewer | Render STEP/IGES/FreeCAD and common mesh files locally | Bundled viewer and OCCT WebAssembly; large files need more memory |
| marimo | Gradient-descent lesson with live sliders; notebook exported as Python | Optional marimo runtime |
| Aim | Two real scalar-regression training runs and loss comparison | Optional Aim runtime; NumPy constrained below 2 |
| MLX LM | Selected-model generation; bounded LoRA profile using JSONL data | Apple Silicon Mac; explicit weight download on Run/Train |
| Rerun | Generate a motion recording; optional local replay viewer | Optional SDK; graphical viewer must be tested on the target device |
| Stable-Baselines3 | Small CPU PPO CartPole training, policy ZIP and evaluation JSON | Optional PyTorch and Gymnasium; capped training steps |
| Optuna | Bounded learning-rate search for real regression objective | Optional Optuna runtime |
| React Flow | Connect actions; review inputs; approve a sequential workflow | Bundled browser editor; engines must be enabled/installed |
| Kiri:Moto / Mesh:Tool | Optional upstream fabrication/mesh-tool service adapter | Pinned submodule and upstream npm setup; installation requires network |
| llama.cpp | Start a local llama-server using selected GGUF and thread limit | Install llama-server separately and import local weights |

These are adapters to upstream tools, not replacement implementations. Kiri:Moto
stays a pinned submodule. Python tools use pinned direct package versions and
separate environments; transitive requirements are resolved during installation.

## Files and handoffs

Desktop **Plugins → Import artifact** copies a file into `.dino/artifacts`,
including large local GGUF/model files without loading them all into memory.
The studio's file picker also works on phones, with a 20 MB limit. Imports receive
a unique filename prefix and never overwrite another artifact.

Under **Artifacts & handoffs**, choose **Send to…** to select an enabled tool that
accepts that file extension. Review its populated settings and save/run. Existing
project artifacts have integration-studio links. No automatic cross-tool execution
occurs when a file is selected. Multi-file models with external tensor shards or
textures may require additional files/setup; the handoff selector sends one file.

## Workflows

Starter workflows inspect a model, compare training runs, or open the interactive
lesson. They show their steps and require **Approve & run**. Install dependencies
separately. The visual editor supports up to eight actions; connect nodes to set
dependencies. Cycles are rejected in the editor. Independent branches execute
sequentially to preserve the low-compute policy.

Settings are captured per submission and used even if you edit saved defaults
while a job is queued. Changed plugin packages require fresh approval. A workflow
checks the package fingerprint again before each step. Failed/stopped jobs end the
sequence. Cancellation stops the current job and prevents later steps. Workflow
history is saved under `.dino/plugin-flows.json`; unfinished runs are shown as
interrupted after a host restart and are not automatically resumed.

## Views and privacy

Embedded local servers bind to loopback and are accessed through the authenticated
phone host at `/views/<plugin-id>/`. The gateway checks pairing and plugin approval,
permits declared ports only while that tool's Start job is running, proxies HTTP
and WebSockets, and strips the Dino pairing cookie before forwarding to engines.
Stopping phone access closes proxy sockets. Native tools still run on the host.

Enabled view plugins are trusted software: their pages share the paired owner's
origin and can access owner APIs. This is not isolation from an untrusted plugin.
Do not enable code you do not trust. Runtime installation executes upstream code.

The Netron response overlay rewrites its model URL for the gateway and disables
its standalone age gate and analytics/consent startup. Dino manages the pinned
version. External requests are restricted by CSP. The CAD build overlays OCCT worker creation with a local static worker and
local files. Upstream source trees are not modified for these fixes.
Some optional upstream features that require external CDNs (e.g. uncommon CAD
format loaders) are unavailable under this policy. The Aim response overlay
disables its optional Pyodide console startup and remote release feed; experiment
tracking and comparison stay available. Compressed assets are decoded first.

## Developer extension points

Manifests may declare `settings` fields (`text`, `integer`, `enum`, `artifact`),
`resources` text and a `view` with a fixed loopback `port`, optional `stripPrefix`,
and path. Settings substitute **arguments only** using `${setting:key}`. They
cannot replace the executable or working directory. `${app}` resolves to bundled
Dino code; `${workspace}`, `${plugin}`, `${artifacts}` and `${node}` remain supported.

Settings schemas declare integer bounds, enum choices, or allowed file extensions.
Artifact paths are contained by realpath. Host/phone APIs validate every value;
unknown fields and traversal are rejected. User settings live separately from
package approvals. See [the plugin guide](plugins.md) for the base format.

## Verification

`npm test` runs the host/unit/integration checks. `node test/studio.e2e.cjs` runs
real installed tool services and Electron/browser flows; it requires Playwright
in your development environment, prepared adapters and installed optional runtimes.
Headless Linux flags in that test are test-only. They do not weaken normal app
launch settings. The test expects a sample engineering STEP artifact.

Native Mac launch, physical iPhone/Android behavior, and MLX/model-specific runs
must still be checked on those devices with the selected weights. See
[the validation record](integration-validation.md) for the actual tested scope.
