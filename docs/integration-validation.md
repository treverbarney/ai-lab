# Integration validation record — Dino Lab 0.6

This record separates implemented adapters from verified engine/device behavior.
It is not a claim that every optional upstream project was installed or benchmarked.

| Check | Result |
| --- | --- |
| Existing host, engineering, phone, plugin and new studio tests | Passed; 27 automated tests total |
| All 11 curated manifest schemas | Passed |
| Settings validation, persistence, artifact containment | Passed |
| Paired file import and approved sequential workflow API | Passed |
| Netron valid tiny ONNX generation / runtime check | Passed |
| marimo notebook generation / runtime check | Passed |
| Aim two actual CPU regression runs / saved loss curves | Passed |
| Optuna real bounded trial search / saved result | Passed |
| Rerun .rrd generation | Passed |
| Stable-Baselines3 CPU PPO training / saved policy and evaluation | Passed |
| Embedded Netron, marimo, Aim and real STEP browser preview | Passed through paired HTTP/WebSocket gateway |
| Reviewed templates, visual workflow editor and mobile-width UI | Passed: authenticated upload, template approval, actual job execution |
| Kiri:Moto dependency installation and full tool execution | Blocked: registry.npmjs.org denied by environment policy |
| MLX inference / LoRA | Requires Apple Silicon Mac and chosen model/data; not run on Linux |
| llama.cpp model execution | Requires installed llama-server and local GGUF; unavailable here |
| Native Mac app launch / physical phones / Tailscale device route | Not run in this Linux environment |

The optional adapters expose actionable requirements and failures; unavailable
runtimes are not reported as successful jobs. No model weights download at startup.

The Electron/browser pass rendered the ONNX Mul graph, waited for the live Python
lesson result, opened Aim's real experiment list, rendered the STEP mounting
plate with locally served OCCT, imported a phone artifact, ran a reviewed training
comparison template, and executed an Optuna action from the React Flow editor.
No uncaught page errors remained. Startup readiness polling can receive temporary
503 responses before an engine is listening; these are expected retries.

Aim's optional Pyodide console and remote release feed are disabled in the paired
local view. Its compressed assets are decoded before applying that overlay.
Neither those extras nor every upstream feature/format is claimed as verified.
Rerun's generated recording is verified; full viewer interaction remains a target-
device check. MLX generation/LoRA and llama.cpp model inference require the stated
hardware/executable/weights and are not represented as successful runs here.
