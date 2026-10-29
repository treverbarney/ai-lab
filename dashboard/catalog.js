(() => {
  // The only launch targets exposed to the renderer. No shell commands cross IPC.
  const neural = [
    {
      id: "llm-viz",
      name: "LLM Visualizer",
      label: "3D EXPLORATION",
      description:
        "Step inside a transformer. Follow tokens, attention and activations through a GPT model.",
      path: "neural/llm-viz",
      url: "https://bbycroft.net/llm",
      source: "https://github.com/bbycroft/llm-viz",
      port: 3002,
      command:
        "cd neural/llm-viz\ncorepack yarn install\ncorepack yarn dev --hostname 127.0.0.1",
    },
    {
      id: "transformer-explainer",
      name: "Transformer Explainer",
      label: "INTERACTIVE INFERENCE",
      description:
        "Watch a live GPT-2 prediction unfold, from your prompt to the next token.",
      path: "neural/transformer-explainer",
      url: "https://poloclub.github.io/transformer-explainer/",
      source: "https://github.com/poloclub/transformer-explainer",
      port: 5173,
      command:
        "cd neural/transformer-explainer\nnpm install --no-save --package-lock=false vite@7.3.7\nnpm run dev -- --host 127.0.0.1",
    },
    {
      id: "tensorspace",
      port: 5174,
      name: "TensorSpace",
      label: "NETWORK ANATOMY",
      description:
        "Explore layers and model structure with interactive 3D neural network examples.",
      path: "neural/tensorspace",
      url: "https://tensorspace.org/html/playground/index.html",
      source: "https://github.com/tensorspace-team/tensorspace",
      command:
        "# Start local from Dino Lab. No dependency installation required.\n# LeNet example is served on http://127.0.0.1:5174/",
    },
    {
      id: "minimind",
      name: "MiniMind",
      label: "TRAINING WORKBENCH",
      description:
        "A compact language model, built from scratch. Explore pretraining, fine-tuning and reasoning.",
      path: "neural/minimind",
      source: "https://github.com/jingyaogong/minimind",
      command:
        "cd neural/minimind\npython3 -m venv .venv\n# macOS / Linux:\nsource .venv/bin/activate\n# Windows PowerShell: .venv\\Scripts\\Activate.ps1\npython -m pip install -r requirements.txt\n# Read the upstream README before downloading data or starting training.",
    },
  ];
  const engineering = [
    {
      id: "fusion",
      path: "engineering/fusion360-mcp",
      mcp: true,
      name: "Fusion 360 MCP",
      label: "ASSEMBLE",
      description:
        "Connect Fusion to the lab through its MCP add-in. Launch your installed Fusion application.",
      source: "https://github.com/ignaciomolini/mcp-fusion360",
      native: true,
    },
    {
      id: "cad",
      path: "engineering/text-to-cad",
      mcp: true,
      name: "Text to CAD",
      label: "GENERATE",
      description:
        "Turn design intent into parametric geometry with text-to-cad and build123d.",
      source: "https://github.com/treverbarney/text-to-cad",
    },
    {
      id: "mujoco",
      name: "MuJoCo",
      label: "SIMULATE",
      description:
        "Validate motion, contact and dynamics in a lightweight physics environment.",
      source: "https://mujoco.readthedocs.io/en/stable/overview.html",
    },
    {
      id: "freecad",
      path: "engineering/freecad-mcp",
      mcp: true,
      name: "FreeCAD / FEM",
      label: "VALIDATE",
      description:
        "Inspect geometry and run finite element workflows with FreeCAD and CalculiX.",
      source: "https://github.com/neka-nat/freecad-mcp",
      native: true,
    },
  ];
  const docs = [
    { id: "integrations", name: "Integration studio", path: "docs/integrations.md" },
    { id: "validation", name: "Integration validation", path: "docs/integration-validation.md" },
    { id: "plugins", name: "Plugin developer guide", path: "docs/plugins.md" },
    { id: "phone", name: "Phone access guide", path: "docs/phone.md" },
    { id: "desktop", name: "Dino Lab guide", path: "docs/desktop.md" },
    { id: "setup", name: "Engineering setup", path: "setup/install-notes.md" },
    {
      id: "architecture",
      name: "Project architecture",
      path: "docs/architecture.md",
    },
    {
      id: "orchestrator",
      name: "Orchestrator",
      path: "orchestrator/README.md",
    },
    {
      id: "integration",
      name: "Neural integration",
      path: "docs/neural-integration.md",
    },
  ];
  const catalog = { neural, engineering, docs };
  if (typeof module !== "undefined") module.exports = catalog;
  else window.labCatalog = catalog;
})();
