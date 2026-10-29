const py = (type, label, extra = {}) => ({ type, label, ...extra });
const model = py("artifact", "Model file", {
  extensions: ["onnx", "tflite", "pt", "pth", "npy", "gguf"],
  default: "",
});
const cad = py("artifact", "CAD / mesh file", {
  extensions: [
    "step",
    "stp",
    "iges",
    "igs",
    "fcstd",
    "stl",
    "obj",
    "glb",
    "gltf",
    "ply",
    "off",
    "3mf",
  ],
  default: "",
});
const catalog = [
  {
    key: "netron",
    name: "Netron · Model inspector",
    description: "Inspect actual model graphs, layers and tensors.",
    homepage: "https://github.com/lutzroeder/netron",
    port: 4321,
    strip: true,
    fields: { file: model },
    actions: ["install", "sample", "start", "check"],
    resources:
      "Small runtime; model size determines browser memory. No model download.",
    requirements: ["netron==9.3.3"],
  },
  {
    key: "cad-viewer",
    name: "Online 3D Viewer · Engineering review",
    description:
      "Local browser previews for STEP, IGES, FreeCAD and mesh formats.",
    homepage: "https://github.com/kovacsv/Online3DViewer",
    view: "/studio/cad.html",
    fields: { file: cad },
    actions: ["check"],
    resources:
      "Browser/WebAssembly on demand. Large assemblies can use substantial memory.",
  },
  {
    key: "marimo",
    name: "marimo · Interactive experiments",
    description:
      "A live gradient-descent lesson with sliders, results and editable notebook source.",
    homepage: "https://github.com/marimo-team/marimo",
    port: 4322,
    fields: {},
    actions: ["install", "sample", "start", "check"],
    resources:
      "Moderate Python runtime. Included lesson uses small CPU experiments.",
    requirements: ["marimo==0.25.2"],
  },
  {
    key: "aim",
    name: "Aim · Experiment tracker",
    description:
      "Compare two real CPU training runs, their loss curves and settings.",
    homepage: "https://github.com/aimhubio/aim",
    port: 4323,
    fields: {
      steps: py("integer", "Training steps", {
        min: 10,
        max: 500,
        default: 60,
      }),
    },
    actions: ["install", "sample", "start", "check"],
    resources:
      "Moderate runtime and local storage. Sample trains a scalar linear regressor; no model downloads.",
    requirements: ["aim==3.29.1", "numpy<2"],
  },
  {
    key: "mlx",
    name: "MLX LM · Apple Silicon models",
    description:
      "Run a selected small model or LoRA fine-tuning on a prepared local dataset.",
    homepage: "https://github.com/ml-explore/mlx-lm",
    platform: "darwin-arm64",
    fields: {
      model: py("text", "Hugging Face model ID", {
        default: "",
        maxLength: 160,
      }),
      prompt: py("text", "Prompt", {
        default: "Explain gradient descent briefly.",
        maxLength: 2000,
      }),
      file: py("artifact", "Training JSONL", {
        extensions: ["jsonl"],
        default: "",
      }),
      steps: py("integer", "LoRA iterations", {
        min: 1,
        max: 100,
        default: 10,
      }),
    },
    actions: ["install", "check", "run", "train"],
    resources:
      "Apple Silicon only. Selected weights download on Run/Train; memory varies by model. Start with a small quantized model.",
    requirements: ["mlx-lm==0.32.2"],
  },
  {
    key: "rerun",
    name: "Rerun · Simulation replay",
    description:
      "Record a short 3D motion trajectory as a portable .rrd recording.",
    homepage: "https://github.com/rerun-io/rerun",
    port: 4326,
    strip: true,
    fields: {
      file: py("artifact", "Recording", { extensions: ["rrd"], default: "" }),
    },
    actions: ["install", "sample", "check", "start"],
    resources:
      "Optional SDK; small demo recording. Large sensor logs need more memory.",
    requirements: ["rerun-sdk==0.26.2"],
  },
  {
    key: "rl",
    name: "Stable-Baselines3 · Reinforcement learning",
    description: "Train and evaluate a tiny CartPole policy with PPO on CPU.",
    homepage: "https://github.com/DLR-RM/stable-baselines3",
    fields: {
      steps: py("integer", "Training timesteps", {
        min: 128,
        max: 4096,
        default: 512,
      }),
    },
    actions: ["install", "sample", "check"],
    resources:
      "Large PyTorch dependency. CPU-only install on Linux; sample capped at 4,096 steps.",
    requirements: ["stable-baselines3==2.7.0", "gymnasium==1.2.0"],
  },
  {
    key: "optuna",
    name: "Optuna · Automatic experiments",
    description:
      "Search learning rates for a small CPU regression task; record trial scores.",
    homepage: "https://github.com/optuna/optuna",
    fields: {
      trials: py("integer", "Trial budget", { min: 1, max: 12, default: 4 }),
    },
    actions: ["install", "sample", "check"],
    resources:
      "Small Python runtime; bounded trial count. Real objectives determine total compute.",
    requirements: ["optuna==4.5.0"],
  },
  {
    key: "workflow",
    name: "React Flow · Visual workflows",
    description:
      "Connect enabled actions into a reviewed sequence using the shared queue.",
    homepage: "https://github.com/xyflow/xyflow",
    view: "/studio/flows.html",
    fields: {},
    actions: ["check"],
    resources:
      "Browser editor. Executing a flow uses the selected tools’ resource requirements.",
  },
  {
    key: "kiri",
    name: "Kiri:Moto + Mesh:Tool · Fabrication",
    description:
      "Local slicing, CNC/laser preparation and browser mesh repair.",
    homepage: "https://github.com/GridSpace/grid-apps",
    port: 4324,
    strip: false,
    viewPath: "/kiri/",
    fields: {},
    actions: ["install", "start", "check"],
    resources:
      "Optional upstream checkout and npm dependencies. Slicing workload depends on model complexity.",
  },
  {
    key: "llama",
    name: "llama.cpp · Local assistant backend",
    description:
      "Start an installed llama-server with a chosen local GGUF model.",
    homepage: "https://github.com/ggml-org/llama.cpp",
    port: 4325,
    strip: true,
    fields: {
      file: py("artifact", "GGUF model", { extensions: ["gguf"], default: "" }),
      threads: py("integer", "CPU threads", { min: 1, max: 8, default: 2 }),
    },
    actions: ["check", "start"],
    resources:
      "Requires llama-server on PATH and local weights. No automatic model download; memory depends on weights.",
  },
];
const labels = {
  install: "Install runtime",
  sample: "Run starter experiment",
  start: "Start tool view",
  check: "Check runtime",
  run: "Run selected model",
  train: "Run small LoRA training",
};
function manifest(c) {
  const m = {
    schemaVersion: 1,
    id: "plugin-" + c.key,
    name: c.name,
    version: "1.0.0",
    description: c.description,
    homepage: c.homepage,
    resources: c.resources,
    settings: c.fields,
    actions: {},
  };
  for (const action of c.actions)
    m.actions[action] = {
      label: labels[action],
      steps: [
        {
          command: "${node}",
          args: [
            "${app}/integrations/run.cjs",
            c.key,
            action,
            "${workspace}",
            ...Object.keys(c.fields).map((k) => "${setting:" + k + "}"),
          ],
          cwd: "${workspace}",
        },
      ],
    };
  if (c.view) m.view = { path: c.view };
  else if (c.port)
    m.view = { port: c.port, stripPrefix: !!c.strip, path: c.viewPath || "/" };
  return m;
}
module.exports = { catalog, manifest };
