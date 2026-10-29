"use strict";
const $ = (selector) => document.querySelector(selector);
const desktop = Boolean(window.lab);
const brands = {
  "llm-viz": [
    "Dino Neural",
    "GPT architecture, in three dimensions. Follow a token through the model.",
  ],
  "transformer-explainer": [
    "Dino Attention",
    "See the next token take shape inside a live transformer.",
  ],
  tensorspace: [
    "Dino Layers",
    "Explore a neural network, one interactive layer at a time.",
  ],
  minimind: [
    "Dino Train",
    "A compact language model. Your own training workbench.",
  ],
  fusion: [
    "Dino Fusion",
    "Assembly, parameters and geometry inside your Fusion workspace.",
  ],
  cad: [
    "Dino CAD",
    "Parametric models, STEP exports and a connected CAD tool server.",
  ],
  mujoco: [
    "Dino Physics",
    "Contact, motion and dynamics. Fast, local validation on your CPU.",
  ],
  freecad: [
    "Dino FEM",
    "Open CAD, inspect geometry and connect your FreeCAD tool server.",
  ],
};
let data = window.labCatalog,
  statuses = [],
  jobs = [],
  connected = [],
  activeTool,
  toastTimer;
const all = () => [...data.neural, ...data.engineering];
const name = (item) =>
  item ? brands[item.id]?.[0] || item.name || item.id : "Plugin";
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 7000);
}
function action(fn) {
  return async (event) => {
    const target = event?.currentTarget;
    if (target) target.disabled = true;
    try {
      await fn();
    } catch (error) {
      toast(error.message || String(error));
    } finally {
      if (target) target.disabled = false;
    }
  };
}
function button(text, kind, fn) {
  const el = document.createElement("button");
  el.textContent = text;
  el.className = kind;
  el.addEventListener("click", action(fn));
  return el;
}
function paragraph(text, cls) {
  const el = document.createElement("p");
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function section(parent, title) {
  const el = document.createElement("section");
  el.className = "panel-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  el.append(heading);
  parent.append(el);
  return el;
}
function modal(title, label = "DINO LAB / FIELD GUIDE") {
  activeTool = null;
  $("#dialog-title").textContent = title;
  $("#dialog-label").textContent = label;
  $("#dialog-body").replaceChildren();
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
  return $("#dialog-body");
}
function requireDesktop() {
  if (!desktop)
    throw new Error("Open the Dino Lab desktop app to manage local tools.");
}
async function source(item) {
  if (desktop) await window.lab.openSource(item.id);
  else window.open(item.source, "_blank", "noopener,noreferrer");
}
async function openView(item, mode) {
  if (!desktop) {
    window.open(item.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (mode === "local")
    toast(
      "Connecting to the local workspace. First compilation can take a moment.",
    );
  await window.lab.openView(item.id, mode);
  $("#detail-dialog").close();
  activeTool = null;
  $("#view-title").textContent = `${name(item)} / ${item.name}`;
  $("#view-mode").textContent =
    mode === "local"
      ? data.urls[item.id]
      : "Hosted workspace · internet required";
  $("#view-toolbar").hidden = false;
  document.body.classList.add("workspace-open");
}
async function leaveView() {
  if (desktop) await window.lab.closeView();
  $("#view-toolbar").hidden = true;
  document.body.classList.remove("workspace-open");
}
function art(index) {
  const color = index === 3 ? "#f47b43" : "#a3b38b";
  let shapes = "";
  if (index === 1) {
    for (let i = 0; i < 6; i++) {
      shapes += `<rect x="${37 + i * 29}" y="61" width="17" height="10" rx="1" fill="${color}" opacity=".4"/>`;
      for (let j = i + 1; j < 6; j++)
        shapes += `<path d="M${45 + i * 29} 60Q${45 + (i + j) * 14.5} ${14 - (j - i) * 3} ${45 + j * 29} 60" opacity=".35"/>`;
    }
  } else if (index === 3)
    shapes =
      '<path d="M30 20v53h180" opacity=".25"/><path d="m31 25 16 9 13-3 16 19 13-5 15 13 15-2 15 7 16-2 15 6 15-1 16 5 14-1" stroke-width="1.5"/><path d="M31 30Q80 65 210 72" stroke-dasharray="3 4" opacity=".3"/>';
  else {
    const layers = [3, 5, 5, 3];
    const nodes = layers.map((n, l) =>
      Array.from({ length: n }, (_, i) => [
        47 + l * 48,
        49 + (i - (n - 1) / 2) * 11,
      ]),
    );
    nodes.forEach((layer, l) =>
      layer.forEach(([x, y]) => {
        nodes[l + 1]?.forEach(([x2, y2]) => {
          shapes += `<path d="M${x} ${y}L${x2} ${y2}" opacity=".18"/>`;
        });
        shapes += `<circle cx="${x}" cy="${y}" r="${index === 0 ? 2 : 3}" fill="${color}"/>`;
      }),
    );
  }
  return `<svg viewBox="0 0 240 90" fill="none" stroke="${color}" aria-hidden="true">${shapes}</svg>`;
}
function render() {
  $("#neural-grid").replaceChildren();
  $("#engineering-grid").replaceChildren();
  data.neural.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "tool-card";
    card.dataset.tool = item.id;
    card.innerHTML = `<div class="tool-art"><span class="tool-id">N / 0${index + 1}</span>${art(index)}</div><div class="tool-body"><span class="tool-category"></span><h4></h4><div class="upstream"></div><p></p></div><div class="tool-status"><span></span><span>↗</span></div>`;
    card.querySelector(".tool-category").textContent = item.label;
    card.querySelector("h4").textContent = name(item);
    card.querySelector(".upstream").textContent =
      `POWERED BY ${item.name.toUpperCase()}`;
    card.querySelector("p").textContent = brands[item.id][1];
    card
      .querySelector(".tool-body")
      .append(
        button(
          item.id === "minimind"
            ? "Open training workspace ↗"
            : "Open workspace ↗",
          "button",
          () => toolPanel(item),
        ),
      );
    card.querySelector(".tool-status span").dataset.status = item.id;
    $("#neural-grid").append(card);
  });
  data.engineering.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "engineering-row";
    row.dataset.tool = item.id;
    row.innerHTML = `<span class="engineering-glyph" aria-hidden="true">${["⬡", "⌁", "◎", "◇"][index]}</span><div><h4></h4><div class="upstream"></div></div><p></p><span class="row-status"></span>`;
    row.querySelector("h4").textContent = name(item);
    row.querySelector(".upstream").textContent = item.name;
    row.querySelector("p").textContent = brands[item.id][1];
    row.querySelector(".row-status").dataset.status = item.id;
    row.append(
      button("Open workspace ↗", "button subtle", () => toolPanel(item)),
    );
    $("#engineering-grid").append(row);
  });
  $("#doc-links").replaceChildren(
    ...data.docs.map((doc) =>
      button(`${doc.name}  ↗`, "doc-link", () => readDoc(doc.id)),
    ),
  );
  $("#app-version").textContent = desktop
    ? `DINO LAB / v${data.version}`
    : "DINO LAB / BROWSER PREVIEW";
  filter();
}
function updateStatusLabels() {
  all().forEach((item) => {
    const job = jobs.find((j) => j.id === item.id);
    const status = statuses.find((s) => s.id === item.id);
    const connection = connected.find((c) => c.id === item.id);
    const label =
      job?.state === "running"
        ? `${job.action} running`
        : connection
          ? "MCP connected"
          : status?.local
            ? "Local server online"
            : status?.checkout === "checked out"
              ? "Source ready"
              : status?.checkout === "built in"
                ? "Built in"
                : desktop
                  ? "Setup needed"
                  : "Desktop available";
    const el = document.querySelector(`[data-status="${item.id}"]`);
    if (el) {
      el.textContent = label;
      el.parentElement.classList.toggle("running", job?.state === "running");
    }
  });
  const count =
    jobs.filter((j) => ["running", "stopping"].includes(j.state)).length +
    connected.length;
  $("#running-count").textContent = String(count).padStart(2, "0");
  $("#job-count").textContent = String(count);
}
async function refresh() {
  $("#phone-access").hidden = !desktop;
  $("#initialize-workspace").hidden = !desktop || Boolean(data.root);
  if (desktop) {
    [statuses, jobs, connected] = await Promise.all([
      window.lab.status(),
      window.lab.jobs(),
      window.lab.connectionState(),
    ]);
  }
  $("#workspace-path").textContent =
    data.root ||
    (desktop
      ? "Connect your ai-lab repository to manage local runtimes and build artifacts. Hosted workspaces and guides are ready."
      : "Browser preview. Open the desktop app for local runtimes, MCP connections and build artifacts.");
  const modules = statuses.filter((s) => s.checkout === "checked out").length;
  $("#checkout-count").textContent = desktop
    ? String(modules).padStart(2, "0")
    : "—";
  $("#status-summary").textContent = desktop
    ? `${modules} source modules ready · ${connected.length} MCP servers connected`
    : "Hosted neural demos work here. Native tools run in Dino Lab desktop.";
  updateStatusLabels();
  renderJobs();
}
function renderJobs() {
  if (!jobs.length) {
    $("#activity-list").innerHTML =
      '<div class="empty-state"><span class="empty-symbol">—</span><div><strong>Quiet by default.</strong><p>Start a local tool or run a sample. Its output will appear here.</p></div></div>';
    return;
  }
  $("#activity-list").replaceChildren(
    ...[...jobs].reverse().map((job) => {
      const row = document.createElement("div");
      row.className = "job-row";
      const title = document.createElement("strong");
      title.textContent = name(
        all().find((x) => x.id === job.id) || { id: job.id },
      );
      const jobAction = document.createElement("span");
      jobAction.textContent = job.action;
      const state = document.createElement("span");
      state.textContent = job.state;
      state.className = job.state;
      row.append(
        title,
        jobAction,
        state,
        button("View log →", "text-button", () =>
          job.id.startsWith("plugin-")
            ? pluginPanel(job.id)
            : toolPanel(all().find((x) => x.id === job.id)),
        ),
      );
      return row;
    }),
  );
  updateLog();
}
function updateLog() {
  const log = $("#tool-log");
  if (log && activeTool) {
    const job = jobs.find((j) => j.id === activeTool);
    log.textContent = job?.log || "";
    const state = $("#tool-job-state");
    if (state)
      state.textContent = job
        ? `${job.action} / ${job.state}`
        : "No active job";
  }
}
async function run(item, jobAction) {
  requireDesktop();
  await window.lab.run(item.id, jobAction);
  jobs = await window.lab.jobs();
  updateStatusLabels();
  renderJobs();
  toast(`${name(item)}: ${jobAction} started. Follow its output in Activity.`);
}
function toolPanel(item) {
  const body = modal(name(item), "DINO LAB / TOOL WORKSPACE");
  activeTool = item.id;
  body.append(
    paragraph(`${item.name} · ${item.label}`, "tool-panel-subtitle"),
    paragraph(brands[item.id][1]),
  );
  const actions = document.createElement("div");
  actions.className = "panel-actions";
  if (item.url)
    actions.append(
      button("Explore hosted ↗", "button primary", () =>
        openView(item, "hosted"),
      ),
    );
  if (item.port && desktop) {
    actions.append(
      button("Start local", "button subtle", () => run(item, "start")),
    );
    actions.append(
      button("Open local ↗", "button subtle", () => openView(item, "local")),
    );
  }
  if (item.id === "cad" && desktop)
    actions.append(
      button("Start CAD engine", "button subtle", () => run(item, "start")),
    );
  if (item.native && desktop)
    actions.append(
      button("Launch app ↗", "button primary", () =>
        window.lab.launchNative(item.id),
      ),
    );
  if (["cad", "mujoco"].includes(item.id) && desktop)
    actions.append(
      button(
        item.id === "cad" ? "Build sample plate" : "Run sample simulation",
        "button primary",
        () => run(item, "sample"),
      ),
    );
  if (desktop)
    actions.append(
      button("Install runtime", "button subtle", () => run(item, "install")),
    );
  if (desktop)
    actions.append(
      button("Stop process", "text-button", async () => {
        await window.lab.stop(item.id);
        await refresh();
      }),
    );
  body.append(actions);
  if (item.id === "minimind")
    body.append(
      paragraph(
        "Runtime installation downloads the upstream ML dependencies. The tiny CPU profile below runs only when you start it. Follow the pinned MiniMind guide for full pretraining and fine-tuning.",
        "panel-note",
      ),
    );
  else if (item.native)
    body.append(
      paragraph(
        "Install runtime prepares the MCP wrapper. Fusion / FreeCAD and their in-app add-ins must be installed on this computer; the guide below includes the exact add-in paths.",
        "panel-note",
      ),
    );
  else
    body.append(
      paragraph(
        "Install runtime downloads this tool’s dependencies. Start local runs only this tool. Open local connects to the server once its log reports ready.",
        "panel-note",
      ),
    );
  if (desktop) {
    const output = section(body, "Process output");
    const label = document.createElement("p");
    label.id = "tool-job-state";
    label.className = "panel-note";
    const log = document.createElement("pre");
    log.id = "tool-log";
    log.className = "log-output";
    output.append(label, log);
    updateLog();
  }
  if (item.port && desktop) {
    const local = section(body, "Local workspace address");
    const label = document.createElement("label");
    label.textContent = "Loopback URL";
    label.htmlFor = "local-url";
    const input = document.createElement("input");
    input.type = "url";
    input.id = "local-url";
    input.value = data.urls[item.id];
    input.spellcheck = false;
    local.append(
      label,
      input,
      button("Save address", "button subtle", async () => {
        data.urls = await window.lab.saveUrl(item.id, input.value);
        await refresh();
        toast("Local address saved.");
      }),
    );
  }
  if (item.id === "minimind" && desktop) {
    const training = section(body, "Tiny CPU training profile");
    training.append(
      paragraph(
        "A diagnostic pretraining run: up to 32 text records, 64 hidden dimensions, 2 layers, 128 tokens and one epoch. This is a small learning run, not the full MiniMind training pipeline. Install its runtime first.",
        "panel-note",
      ),
    );
    const info = paragraph(
      "Choose a local JSONL file with a text field in each record.",
      "panel-note",
    );
    const actions = document.createElement("div");
    actions.className = "panel-actions";
    actions.append(
      button("Choose dataset", "button subtle", async () => {
        const result = await window.lab.trainingData();
        if (result)
          info.textContent = `${result.records} records ready / ${result.profile}`;
      }),
      button("Run tiny CPU pretrain", "button primary", () =>
        run(item, "train"),
      ),
    );
    training.append(info, actions);
  }
  if (item.mcp && desktop) connectionPanel(body, item);
  const resources = section(body, "Project resources");
  const links = document.createElement("div");
  links.className = "panel-actions";
  if (desktop && item.path)
    links.append(
      button("Open source folder ↗", "text-button", () =>
        window.lab.openFolder(item.id),
      ),
    );
  if (item.url)
    links.append(
      button("Hosted demo in browser ↗", "text-button", () =>
        desktop
          ? window.lab.openBrowser(item.id)
          : window.open(item.url, "_blank", "noopener,noreferrer"),
      ),
    );
  if (item.native && desktop)
    links.append(
      button("Choose native app", "text-button", () =>
        window.lab.launchNative(item.id, true),
      ),
    );
  links.append(
    button("Upstream guide ↗", "text-button", () => source(item)),
    button("Dino setup guide →", "text-button", () => readDoc("setup")),
  );
  resources.append(links);
  if (item.command) {
    const commands = document.createElement("pre");
    commands.className = "schema-output";
    commands.textContent = item.command;
    resources.append(commands);
  }
}
function connectionPanel(body, item) {
  const panel = section(body, "MCP connection");
  panel.append(
    paragraph(
      "Connect a local server to discover its actual tools, inspect their input schemas and run explicit calls. Keep Fusion / FreeCAD open with its add-in enabled.",
      "panel-note",
    ),
  );
  const config = data.connections[item.id];
  const commandLabel = document.createElement("label");
  commandLabel.textContent = "Server executable";
  commandLabel.htmlFor = "mcp-command";
  const command = document.createElement("input");
  command.id = "mcp-command";
  command.value = config.command;
  const argsLabel = document.createElement("label");
  argsLabel.textContent = "Arguments (JSON array)";
  argsLabel.htmlFor = "mcp-args";
  const args = document.createElement("textarea");
  args.id = "mcp-args";
  args.value = JSON.stringify(config.args, null, 2);
  args.spellcheck = false;
  const buttons = document.createElement("div");
  buttons.className = "panel-actions";
  const toolArea = document.createElement("div");
  toolArea.id = "mcp-tools";
  buttons.append(
    button("Save & connect", "button primary", async () => {
      const value = { command: command.value, args: JSON.parse(args.value) };
      await window.lab.saveConnection(item.id, value);
      data.connections[item.id] = value;
      const tools = await window.lab.connect(item.id);
      connected = await window.lab.connectionState();
      renderMcpTools(toolArea, item, tools);
      updateStatusLabels();
      toast(`${tools.length} MCP tools discovered.`);
    }),
    button("Disconnect", "text-button", async () => {
      await window.lab.disconnect(item.id);
      connected = await window.lab.connectionState();
      toolArea.replaceChildren();
      updateStatusLabels();
    }),
  );
  panel.append(commandLabel, command, argsLabel, args, buttons, toolArea);
  const connection = connected.find((c) => c.id === item.id);
  if (connection) renderMcpTools(toolArea, item, connection.tools);
}
function renderMcpTools(area, item, tools) {
  area.replaceChildren();
  if (!tools.length) {
    area.append(paragraph("The server advertised no tools."));
    return;
  }
  const label = document.createElement("label");
  label.textContent = "Server tools";
  label.htmlFor = "mcp-tool-select";
  const select = document.createElement("select");
  select.id = "mcp-tool-select";
  tools.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.name;
    option.textContent = t.name;
    select.append(option);
  });
  const schema = document.createElement("pre");
  schema.className = "schema-output";
  const argsLabel = document.createElement("label");
  argsLabel.textContent = "Call arguments (JSON object)";
  argsLabel.htmlFor = "mcp-call-args";
  const args = document.createElement("textarea");
  args.id = "mcp-call-args";
  args.value = "{}";
  args.spellcheck = false;
  const result = document.createElement("pre");
  result.className = "log-output";
  result.id = "mcp-call-result";
  const schemaUpdate = () => {
    const tool = tools.find((t) => t.name === select.value);
    schema.textContent = `${tool.description || ""}\n\n${JSON.stringify(tool.inputSchema, null, 2)}`;
  };
  select.addEventListener("change", schemaUpdate);
  schemaUpdate();
  area.append(
    label,
    select,
    schema,
    argsLabel,
    args,
    paragraph(
      "Run tool sends this exact call to the connected server. A CAD tool may modify the currently open document.",
      "panel-note",
    ),
    button("Run tool", "button primary", async () => {
      result.textContent = "Running…";
      try {
        const response = await window.lab.callTool(
          item.id,
          select.value,
          JSON.parse(args.value),
        );
        result.textContent = JSON.stringify(response, null, 2);
      } catch (error) {
        result.textContent = error.message;
        throw error;
      }
    }),
    result,
  );
}
async function readDoc(id) {
  const doc = data.docs.find((x) => x.id === id);
  const body = modal(doc.name);
  const pre = document.createElement("pre");
  pre.className = "doc-text";
  pre.textContent = "Loading…";
  body.append(pre);
  try {
    if (desktop) pre.textContent = await window.lab.readDoc(id);
    else {
      const response = await fetch(`../${doc.path}`);
      if (!response.ok) throw new Error("Document unavailable.");
      pre.textContent = await response.text();
    }
  } catch (error) {
    pre.textContent = `${error.message}\nOpen ${doc.path} in your repository, or run Dino Lab desktop.`;
  }
}
function filter() {
  const query = $("#tool-search").value.trim().toLowerCase();
  let count = 0;
  document.querySelectorAll("[data-tool]").forEach((el) => {
    const item = all().find((x) => x.id === el.dataset.tool);
    const shown = `${name(item)} ${item.name} ${item.description} ${item.label}`
      .toLowerCase()
      .includes(query);
    el.hidden = !shown;
    if (shown) count++;
  });
  $("#no-results").hidden = count !== 0;
}
function showConnections() {
  const body = modal("Your connected workbench.", "DINO LAB / CONNECTIONS");
  const table = document.createElement("table");
  table.className = "connection-table";
  all().forEach((item) => {
    const status = statuses.find((s) => s.id === item.id);
    const row = document.createElement("tr");
    const label = document.createElement("td");
    label.textContent = name(item);
    const state = document.createElement("td");
    state.textContent = `${status?.checkout || "Desktop only"}${status?.local !== null && status?.local !== undefined ? ` · server ${status.local ? "online" : "offline"}` : ""}${connected.some((c) => c.id === item.id) ? " · MCP connected" : ""}`;
    row.append(label, state);
    table.append(row);
  });
  body.append(table);
}
$("#close-dialog").addEventListener("click", () => {
  $("#detail-dialog").close();
  activeTool = null;
});
$("#detail-dialog").addEventListener("close", () => {
  activeTool = null;
});
$("#back-home").addEventListener("click", action(leaveView));
$("#view-browser").addEventListener(
  "click",
  action(() => window.lab.openBrowser()),
);
$("#refresh").addEventListener("click", action(refresh));
$("#tool-search").addEventListener("input", filter);
$("#status-detail").addEventListener("click", showConnections);
$("#initialize-workspace").addEventListener(
  "click",
  action(async () => {
    requireDesktop();
    toast(
      "Creating your Dino workspace. Individual engines download only when you install their runtime.",
    );
    await window.lab.initialize();
    data = await window.lab.catalog();
    await refresh();
    toast("Dino workspace ready. Open any tool to get started.");
  }),
);
$("#choose-workspace").addEventListener(
  "click",
  action(async () => {
    requireDesktop();
    await window.lab.workspace();
    data = await window.lab.catalog();
    await refresh();
  }),
);
$("#open-root").addEventListener(
  "click",
  action(async () => {
    requireDesktop();
    await window.lab.openFolder("root");
  }),
);
$("#open-artifacts").addEventListener(
  "click",
  action(async () => {
    requireDesktop();
    await window.lab.artifacts();
  }),
);
$("#explore-tools").addEventListener("click", () =>
  $("#tool-workbench").scrollIntoView({ behavior: "smooth" }),
);
$("#quick-guide").addEventListener(
  "click",
  action(() => readDoc("architecture")),
);
const navigationNames = {
  overview: "Studio",
  neural: "Neural studio",
  engineering: "Engineering studio",
  activity: "Activity",
  guides: "Guides & setup",
};
document.querySelectorAll("[data-nav]").forEach((link) =>
  link.addEventListener("click", () => {
    document
      .querySelectorAll("[data-nav]")
      .forEach((x) => x.classList.toggle("active", x === link));
    $("#breadcrumb").textContent = navigationNames[link.dataset.nav];
  }),
);
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !$("#detail-dialog").open &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    $("#tool-search").focus();
  }
});
if (desktop) {
  window.lab.onBootstrap((text) => {
    $("#status-summary").textContent = text.trim().slice(-250);
  });
  window.lab.onViewError((message) => {
    leaveView().catch(() => {});
    toast(message);
  });
  window.lab.onJobs((value) => {
    jobs = value;
    updateStatusLabels();
    renderJobs();
  });
}
(async () => {
  if (desktop) data = await window.lab.catalog();
  render();
  await refresh();
})().catch((error) => toast(`Dino Lab could not load: ${error.message}`));

async function phonePanel() {
  const body = modal("Your lab. In your pocket.", "DINO LAB / PHONE ACCESS");
  body.append(
    paragraph(
      "Use Dino Lab on iPhone or Android. Your desktop runs local tools; your phone controls jobs, MCP tools and build files. Connect Tailscale on both devices.",
    ),
  );
  const content = document.createElement("div");
  body.append(content);
  function render(info) {
    content.replaceChildren(
      paragraph(
        info.message ||
          "Phone access is off. Enable it to create a private link and pairing code.",
        "panel-note",
      ),
    );
    const controls = document.createElement("div");
    controls.className = "panel-actions";
    if (!info.running)
      controls.append(
        button("Enable phone access", "button primary", async () =>
          render(await window.lab.phoneStart()),
        ),
      );
    else {
      if (!info.privateUrl)
        controls.append(
          button("Enable private Tailscale link", "button primary", async () =>
            render(await window.lab.phonePrivate()),
          ),
        );
      controls.append(
        button("Open local preview ↗", "button subtle", () =>
          window.lab.phonePreview(),
        ),
      );
      controls.append(
        button("Stop access & revoke phones", "text-button", async () =>
          render(await window.lab.phoneStop()),
        ),
      );
    }
    content.append(controls);
    if (info.privateUrl) {
      const link = document.createElement("p");
      link.className = "path";
      link.textContent = info.privateUrl;
      content.append(link);
      const image = document.createElement("img");
      image.src = info.qr;
      image.alt = "Scan to pair Dino Lab on your phone";
      image.width = 240;
      image.height = 240;
      image.className = "phone-qr";
      content.append(image);
      content.append(
        paragraph(
          "Scan on your phone with Tailscale connected. The private link includes a pairing key; share it only with your own devices.",
          "panel-note",
        ),
      );
      content.append(
        button("Copy private pairing link", "button subtle", async () => {
          await navigator.clipboard.writeText(info.pairingUrl);
          toast("Private phone pairing link copied.");
        }),
      );
    }
    if (info.running) {
      const sectionElement = section(content, "Manual pairing key");
      const key = document.createElement("pre");
      key.className = "schema-output";
      key.textContent = info.key;
      sectionElement.append(key);
      sectionElement.append(
        paragraph(
          "On iPhone: Share → Add to Home Screen. On Android: browser menu → Install app. Keep this computer awake and phone access running.",
          "panel-note",
        ),
      );
    }
  }
  render(await window.lab.phoneInfo());
}
$("#phone-access").addEventListener("click", action(phonePanel));

$("#open-workbench").addEventListener(
  "click",
  action(async () => {
    requireDesktop();
    await window.lab.openWorkbench();
  }),
);

async function pluginsPanel() {
  requireDesktop();
  const body = modal("Build your own toolkit.", "DINO LAB / PLUGINS");
  body.append(
    paragraph(
      "Small adapters. Your choice of engines. Import a local plugin, review its commands, then enable it for this workspace.",
    ),
  );
  const controls = document.createElement("div");
  controls.className = "panel-actions";
  controls.append(
    button("Open integration studio ↗", "button primary", openStudio),
    button("Import artifact", "button subtle", async () => {
      const name = await window.lab.importArtifact();
      if (name) toast("Imported " + name);
    }),
    button("Import plugin folder", "button primary", async () => {
      const id = await window.lab.importPlugin();
      if (id) await pluginPanel(id);
      else await pluginsPanel();
    }),
    button("Add example plugin", "button subtle", async () => {
      const id = await window.lab.importPlugin(true);
      await pluginPanel(id);
    }),
    button("Developer guide →", "text-button", () => readDoc("plugins")),
  );
  body.append(controls);
  const list = await window.lab.plugins();
  if (!list.length)
    body.append(
      paragraph(
        "Your plugin shelf is empty. Try the dependency-free Artifact Report example to see how it works.",
        "panel-note",
      ),
    );
  const curated = section(body, "Add a curated integration");
  for (const tool of await window.lab.pluginsCatalog()) {
    const card = section(curated, tool.name);
    card.append(
      paragraph(tool.description),
      paragraph(tool.resources, "panel-note"),
    );
    const installed = list.find((p) => p.id === "plugin-" + tool.key);
    card.append(
      button(
        installed ? "Review installed adapter" : "Add & review adapter",
        "button subtle",
        async () => {
          const id = installed
            ? installed.id
            : await window.lab.importPlugin(tool.key);
          await pluginPanel(id);
        },
      ),
    );
  }
  for (const plugin of list) {
    const card = section(
      body,
      plugin.name + " · " + (plugin.version || "Invalid"),
    );
    card.append(
      paragraph(plugin.description || plugin.error),
      paragraph(
        plugin.error
          ? "Unavailable: " + plugin.error
          : plugin.enabled
            ? "Enabled · available to your paired phone"
            : plugin.changed
              ? "Files changed · review required"
              : "Disabled · nothing runs",
        "panel-note",
      ),
      button("Open plugin →", "button subtle", () => pluginPanel(plugin.id)),
    );
  }
}
async function pluginPanel(id) {
  const plugin = (await window.lab.plugins()).find((p) => p.id === id);
  if (!plugin) throw Error("Plugin was removed. Refresh the plugin shelf.");
  const body = modal(plugin.name, "DINO LAB / PLUGIN WORKSPACE");
  activeTool = id;
  body.append(
    button("← All plugins", "text-button", pluginsPanel),
    paragraph(plugin.description || plugin.error),
  );
  const controls = document.createElement("div");
  controls.className = "panel-actions";
  if (plugin.error) body.append(paragraph(plugin.error, "panel-note"));
  else {
    body.append(
      paragraph(
        `${plugin.version} · ${plugin.files} files · ${(plugin.bytes / 1024).toFixed(1)} KB · ${plugin.enabled ? "Enabled" : plugin.changed ? "Changed; needs review" : "Disabled"}`,
        "panel-note",
      ),
    );
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Review manifest and commands";
    const pre = document.createElement("pre");
    pre.className = "schema-output";
    pre.textContent = JSON.stringify(plugin.manifest, null, 2);
    details.append(summary, pre);
    details.open = !plugin.enabled;
    body.append(details);
    if (!plugin.enabled) {
      body.append(
        paragraph(
          "Trust only plugins you have inspected. Commands run with your user account and can read or change files and use the network. This is not a sandbox. Enabling approves this exact package; changed files require review again.",
          "panel-note",
        ),
      );
      controls.append(
        button("Trust & enable plugin", "button primary", async () => {
          await window.lab.enablePlugin(id, plugin.digest);
          await pluginPanel(id);
        }),
      );
    } else {
      plugin.actions.forEach((a) =>
        controls.append(
          button(a.label, "button primary", async () => {
            await window.lab.pluginAction({ id, action: a.id });
            toast("Plugin action submitted. Follow its output below.");
          }),
        ),
      );
      controls.append(
        button("Disable & stop", "button subtle", async () => {
          await window.lab.disablePlugin(id);
          await pluginPanel(id);
        }),
      );
    }
  }
  controls.append(
    button("Stop job", "text-button", () =>
      window.lab.pluginAction({ id, action: "stop" }),
    ),
  );
  if (!plugin.enabled)
    controls.append(
      button("Remove plugin", "text-button", async () => {
        await window.lab.disablePlugin(id, true);
        await pluginsPanel();
      }),
    );
  body.append(controls);
  const state = paragraph("", "panel-note");
  state.id = "tool-job-state";
  const log = document.createElement("pre");
  log.id = "tool-log";
  log.className = "log-output";
  body.append(state, log);
  jobs = await window.lab.jobs();
  updateLog();
  if (plugin.enabled && plugin.mcp) {
    const area = section(body, "MCP tools");
    area.append(
      button("Connect declared server", "button subtle", async () => {
        await window.lab.pluginAction({ id, action: "connect" });
        await pluginPanel(id);
      }),
      button("Disconnect server", "text-button", async () => {
        await window.lab.pluginAction({ id, action: "disconnect" });
        await pluginPanel(id);
      }),
    );
    const connection = (await window.lab.connectionState()).find(
      (c) => c.id === id,
    );
    if (connection) {
      const tools = document.createElement("div");
      area.append(tools);
      renderMcpTools(tools, { id }, connection.tools);
    }
  }
}
$("#open-plugins").addEventListener("click", action(pluginsPanel));

async function openStudio() {
  requireDesktop();
  await window.lab.openStudio();
  $("#detail-dialog").close();
  activeTool = null;
  $("#view-title").textContent = "Dino Integration Studio";
  $("#view-mode").textContent = "Local tools · paired host connection";
  $("#view-toolbar").hidden = false;
  document.body.classList.add("workspace-open");
}
$('#open-assembly').addEventListener('click', action(async () => {
  requireDesktop();
  await window.lab.openAssembly();
  activeTool = null;
  $('#view-title').textContent = 'Dino CAD & Assembly';
  $('#view-mode').textContent = 'Local design · exact geometry · paired phone controls';
  $('#view-toolbar').hidden = false;
  document.body.classList.add('workspace-open');
}));
