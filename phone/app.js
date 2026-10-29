"use strict";
const $ = (selector) => document.querySelector(selector);
const catalog = window.labCatalog;
let pluginList = [];
const goWorkbench = new URLSearchParams(location.hash.slice(1)).has(
  "workbench",
);
const tools = [...catalog.neural, ...catalog.engineering];
const names = {
  "llm-viz": "Dino Neural",
  "transformer-explainer": "Dino Attention",
  tensorspace: "Dino Layers",
  minimind: "Dino Train",
  fusion: "Dino Fusion",
  cad: "Dino CAD",
  mujoco: "Dino Physics",
  freecad: "Dino FEM",
};
let state = null,
  paired = false,
  connected = false,
  stream = null,
  currentTool = null,
  toastTimer,
  installPrompt;
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 6500);
}
function action(fn) {
  return async (event) => {
    const button = event?.currentTarget;
    if (button) button.disabled = true;
    try {
      await fn();
    } catch (error) {
      toast(error.message);
    } finally {
      if (button) button.disabled = false;
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
function paragraph(text, kind) {
  const el = document.createElement("p");
  el.textContent = text;
  if (kind) el.className = kind;
  return el;
}
function sheet(title, label = "DINO LAB / POCKET WORKSPACE") {
  $("#sheet-title").textContent = title;
  $("#sheet-label").textContent = label;
  $("#sheet-body").replaceChildren();
  currentTool = null;
  if (!$("#sheet").open) $("#sheet").showModal();
  return $("#sheet-body");
}
async function api(route, method = "GET", value) {
  const response = await fetch(`/api/${route}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: method === "POST" ? { "Content-Type": "application/json" } : {},
    body: method === "POST" ? JSON.stringify(value || {}) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      paired = false;
      connected = false;
      update();
    }
    throw new Error(data.error || "Could not reach your desktop.");
  }
  return data;
}
function showConnection() {
  $("#connection-label").textContent = connected
    ? "Connected"
    : paired
      ? "Reconnect"
      : "Pair desktop";
  $("#connection-dot").classList.toggle("online", connected);
  $("#host-name").textContent = connected
    ? state.host
    : "Your desktop, one tap away.";
  $("#host-detail").textContent = connected
    ? state.workspace
      ? `${state.workspaceName || "Workspace"} · tasks run on this host.`
      : "Connect a repository in Dino Lab desktop first."
    : paired
      ? "Host unavailable. Keep your computer awake and Tailscale connected."
      : "Open Phone access in Dino Lab desktop to pair.";
}
function renderTools() {
  const list = $("#tool-list");
  list.replaceChildren(
    ...tools.map((tool, index) => {
      const row = document.createElement("button");
      row.className = "tool-row";
      row.dataset.tool = tool.id;
      row.innerHTML = `<span class="tool-index">${String(index + 1).padStart(2, "0")}</span><div><h3></h3><p></p></div><span class="arrow">↗</span>`;
      row.querySelector("h3").textContent = names[tool.id];
      row.querySelector("p").textContent = tool.name;
      row.addEventListener("click", () => openTool(tool));
      return row;
    }),
  );
}
function update() {
  showConnection();
  $("#running-count").textContent = connected
    ? String(
        (state.jobs || []).filter((j) =>
          ["running", "stopping"].includes(j.state),
        ).length + (state.connections || []).length,
      ).padStart(2, "0")
    : "—";
  $("#source-count").textContent = connected
    ? String(
        state.status.filter((s) => s.checkout === "checked out").length,
      ).padStart(2, "0")
    : "—";
  renderJobs();
  if (currentTool) {
    const log = $("#live-log");
    if (log)
      log.textContent =
        state?.jobs.find((j) => j.id === currentTool)?.log ||
        "No process output yet.";
  }
}
async function refresh() {
  try {
    state = await api("state");
    pluginList = await api("plugins");
    paired = true;
    connected = true;
    update();
    connectStream();
    return true;
  } catch (error) {
    connected = false;
    update();
    $("#running-count").textContent = "—";
    $("#source-count").textContent = "—";
    return false;
  }
}
function connectStream() {
  if (stream || document.hidden || !connected) return;
  stream = new EventSource("/api/events");
  stream.addEventListener("jobs", (event) => {
    if (state) {
      state.jobs = JSON.parse(event.data);
      connected = true;
      update();
    }
  });
  stream.addEventListener("notice", (event) => {
    const value = JSON.parse(event.data);
    toast(value.title + ": " + value.body);
  });
  stream.onerror = () => {
    stream?.close();
    stream = null;
    connected = false;
    update();
  };
}
function pairForm() {
  const body = sheet("Pair your desktop.", "DINO LAB / PRIVATE ACCESS");
  body.append(
    paragraph(
      "Scan the QR code in Dino Lab desktop, or paste its pairing key below. Keep this key private.",
      "pair-help",
    ),
  );
  const label = document.createElement("label");
  label.textContent = "Pairing key";
  label.htmlFor = "pair-key";
  const input = document.createElement("input");
  input.id = "pair-key";
  input.type = "password";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "Paste the key from Phone access";
  const error = paragraph("", "error");
  body.append(
    label,
    input,
    error,
    button("Connect to Dino Lab", "button primary", async () => {
      try {
        await pair(input.value.trim());
        $("#sheet").close();
        toast("Phone paired. Your desktop workbench is ready.");
      } catch (e) {
        error.textContent = e.message;
      }
    }),
  );
}
async function pair(key) {
  await api("pair", "POST", { key });
  paired = true;
  if (!(await refresh()))
    throw new Error(
      "Paired, but host status is unavailable. Try reconnecting.",
    );
}
async function run(tool, jobAction) {
  if (!connected) {
    pairForm();
    return;
  }
  await api(
    tool.id.startsWith("plugin-") ? "plugin-action" : "action",
    "POST",
    { id: tool.id, action: jobAction },
  );
  toast(
    `${names[tool.id] || tool.name || tool.id}: ${jobAction === "launch" ? "launched on host" : jobAction + " requested"}.`,
  );
  await refresh();
}
function openTool(tool) {
  if (!tool) throw Error("Tool unavailable. Refresh your connection.");
  if (tool.id.startsWith("plugin-")) return openPlugin(tool);
  const body = sheet(names[tool.id]);
  currentTool = tool.id;
  body.append(
    paragraph(tool.name + " / " + tool.label),
    paragraph(tool.description),
  );
  if (tool.url) {
    const link = document.createElement("a");
    link.className = "button primary";
    link.textContent = "Explore browser demo ↗";
    link.href = tool.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    body.append(
      link,
      paragraph(
        "Hosted demos run in this phone’s browser and may load models. Local tool processes run on the connected computer.",
        "tool-note",
      ),
    );
  }
  if (!connected) {
    body.append(
      button("Pair your desktop", "button secondary", () => pairForm()),
    );
    return;
  }
  if (tool.native)
    body.append(
      button("Launch app on host ↗", "button primary", () =>
        run(tool, "launch"),
      ),
    );
  if (["cad", "mujoco"].includes(tool.id))
    body.append(
      button(
        tool.id === "cad"
          ? "Build sample plate on host"
          : "Run sample physics on host",
        "button primary",
        () => run(tool, "sample"),
      ),
    );
  if (tool.port)
    body.append(
      button("Start local server on host", "button secondary", () =>
        run(tool, "start"),
      ),
      paragraph(
        "The local visualizer opens on the host computer. Use the hosted demo above when viewing from your phone.",
        "pair-help",
      ),
    );
  if (tool.id === "cad")
    body.append(
      button("Start CAD engine on host", "button secondary", () =>
        run(tool, "start"),
      ),
    );
  if (tool.id === "minimind")
    body.append(
      paragraph(
        "Prepare a tiny CPU dataset in the desktop training workspace first. This phone can then start and monitor that prepared run. Full training setup remains on the host.",
        "tool-note",
      ),
      button("Run prepared tiny CPU training", "button primary", () =>
        run(tool, "train"),
      ),
    );
  body.append(
    button("Install runtime on host", "button secondary", () =>
      run(tool, "install"),
    ),
    paragraph(
      "Installation downloads dependencies on your host computer. Nothing is installed or trained automatically.",
      "pair-help",
    ),
    button("Stop host process", "text-button", () => run(tool, "stop")),
  );
  const heading = document.createElement("h3");
  heading.textContent = "Live output";
  const log = document.createElement("pre");
  log.id = "live-log";
  log.className = "log";
  log.textContent =
    state.jobs.find((j) => j.id === tool.id)?.log || "No process output yet.";
  body.append(heading, log);
  if (tool.mcp) {
    const heading = document.createElement("h3");
    heading.textContent = "MCP tools";
    body.append(heading);
    const connection = state.connections.find((c) => c.id === tool.id);
    if (connection) {
      body.append(
        button("Disconnect MCP server", "button secondary", () =>
          run(tool, "disconnect"),
        ),
      );
      mcpPanel(body, tool, connection.tools);
    } else {
      body.append(
        paragraph(
          "Uses the server executable already configured on your desktop. Server settings cannot be changed remotely.",
          "pair-help",
        ),
        button("Connect saved MCP server", "button secondary", async () => {
          await run(tool, "connect");
          openTool(tool);
        }),
      );
    }
  }
}
function mcpPanel(body, tool, list) {
  if (!list.length) {
    body.append(paragraph("This server advertised no tools."));
    return;
  }
  const select = document.createElement("select");
  select.setAttribute("aria-label", "MCP tool");
  list.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.name;
    option.textContent = t.name;
    select.append(option);
  });
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Inspect input schema";
  const schema = document.createElement("pre");
  schema.className = "schema";
  details.append(summary, schema);
  const args = document.createElement("textarea");
  args.value = "{}";
  args.spellcheck = false;
  args.setAttribute("aria-label", "Tool arguments as JSON");
  const result = document.createElement("pre");
  result.className = "log";
  result.id = "tool-result";
  const showSchema = () => {
    const selected = list.find((t) => t.name === select.value);
    schema.textContent =
      (selected.description || "") +
      "\n\n" +
      JSON.stringify(selected.inputSchema, null, 2);
  };
  select.addEventListener("change", showSchema);
  showSchema();
  body.append(
    select,
    details,
    args,
    paragraph(
      "Run tool sends these exact arguments to your host. CAD tools may change the open design.",
      "tool-note",
    ),
    button("Run tool on host", "button primary", async () => {
      result.textContent = "Running on host…";
      try {
        result.textContent = JSON.stringify(
          await api("tool", "POST", {
            id: tool.id,
            name: select.value,
            args: JSON.parse(args.value),
          }),
          null,
          2,
        );
      } catch (error) {
        result.textContent = error.message;
        throw error;
      }
    }),
    result,
  );
}
function empty(target, text) {
  const el = document.createElement("p");
  el.className = "empty";
  el.textContent = text;
  target.replaceChildren(el);
}
function renderJobs() {
  const target = $("#job-list");
  if (!connected) {
    empty(target, "Pair or reconnect your desktop to see its jobs.");
    return;
  }
  if (!state.jobs.length) {
    empty(
      target,
      "Quiet by default. Start a tool from Studio to see its output here.",
    );
    return;
  }
  target.replaceChildren(
    ...[...state.jobs].reverse().map((job) => {
      const card = document.createElement("article");
      card.className = "job-card";
      card.innerHTML =
        '<div class="job-head"><strong></strong><span></span></div><p></p><div class="job-buttons"></div>';
      card.querySelector("strong").textContent = names[job.id] || job.id;
      card.querySelector(".job-head span").textContent = job.state;
      card.querySelector("p").textContent =
        job.action + " / " + new Date(job.startedAt).toLocaleTimeString();
      card
        .querySelector(".job-buttons")
        .append(
          button("Open output →", "text-button", () =>
            openTool(
              tools.find((t) => t.id === job.id) ||
                pluginList.find((p) => p.id === job.id) || {
                  id: job.id,
                  name: job.id,
                  actions: [],
                  enabled: false,
                },
            ),
          ),
        );
      if (["running", "stopping"].includes(job.state))
        card
          .querySelector(".job-buttons")
          .append(
            button("Stop job", "text-button", () =>
              run(tools.find((t) => t.id === job.id) || { id: job.id }, "stop"),
            ),
          );
      return card;
    }),
  );
}
async function renderFiles() {
  const target = $("#file-list");
  if (!connected) {
    empty(target, "Pair or reconnect your desktop to access build artifacts.");
    return;
  }
  const files = await api("files");
  if (!files.length) {
    empty(
      target,
      "No artifacts yet. Build the sample plate or run a simulation from Studio.",
    );
    return;
  }
  target.replaceChildren(
    ...files.map((file) => {
      const card = document.createElement("article");
      card.className = "file-card";
      const title = document.createElement("strong");
      title.textContent = file.name;
      const size = paragraph(
        `${file.size < 1024 ? file.size + " B" : (file.size / 1024).toFixed(1) + " KB"} / ${new Date(file.modifiedAt).toLocaleDateString()}`,
      );
      const link = document.createElement("a");
      link.className = "download";
      link.textContent = "Download to phone ↧";
      link.href = "/api/download?name=" + encodeURIComponent(file.name);
      link.download = file.name;
      card.append(title, size, link);
      return card;
    }),
  );
}
function tab(id) {
  document
    .querySelectorAll(".tab-panel")
    .forEach((panel) => (panel.hidden = panel.id !== id));
  document
    .querySelectorAll("[data-tab]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.tab === id),
    );
  window.scrollTo({ top: 0 });
  if (id === "jobs") renderJobs();
  if (id === "files") renderFiles().catch((error) => toast(error.message));
}
document
  .querySelectorAll("[data-tab]")
  .forEach((button) =>
    button.addEventListener("click", () => tab(button.dataset.tab)),
  );
$("#close-sheet").addEventListener("click", () => {
  $("#sheet").close();
  currentTool = null;
});
$("#sheet").addEventListener("close", () => (currentTool = null));
$("#show-pair").addEventListener("click", pairForm);
$("#connection-button").addEventListener(
  "click",
  action(async () => {
    if (paired) {
      if (await refresh()) toast("Desktop connection refreshed.");
      else
        toast(
          "Host unavailable. Keep your computer awake and Tailscale connected.",
        );
    } else pairForm();
  }),
);
$("#unpair").addEventListener(
  "click",
  action(async () => {
    if (!connected)
      throw new Error("Reconnect to the host to revoke this phone’s pairing.");
    await api("logout", "POST");
    stream?.close();
    stream = null;
    paired = false;
    connected = false;
    state = null;
    update();
    tab("studio");
    toast("Phone unpaired.");
  }),
);
$("#refresh-jobs").addEventListener(
  "click",
  action(async () => {
    if (!(await refresh()))
      throw new Error(
        "Host unavailable. Pair or reconnect your desktop first.",
      );
  }),
);
$("#refresh-files").addEventListener("click", action(renderFiles));
catalog.docs.forEach((doc) =>
  $("#guide-list").append(
    button(doc.name + " ↗", "guide-button", async () => {
      if (!connected) {
        pairForm();
        return;
      }
      const value = await api("doc?id=" + encodeURIComponent(doc.id));
      const body = sheet(value.name, "DINO LAB / FIELD GUIDE");
      const pre = document.createElement("pre");
      pre.className = "doc";
      pre.textContent = value.text;
      body.append(pre);
    }),
  ),
);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("#install-app").hidden = false;
});
$("#install-app").addEventListener(
  "click",
  action(async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      installPrompt = null;
      $("#install-app").hidden = true;
    }
  }),
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stream?.close();
    stream = null;
  } else refresh();
});
window.addEventListener("online", () => refresh());
window.addEventListener("offline", () => {
  connected = false;
  stream?.close();
  stream = null;
  update();
});
(async () => {
  const projects = document.createElement("a");
  projects.href = "/workbench/index.html";
  projects.className = "button primary";
  projects.textContent = "Projects, 3D review & agent →";
  $("#studio").append(projects);
  const notify = button(
    "Enable completion notifications",
    "button secondary",
    async () => {
      if (!connected) throw Error("Pair your host first.");
      if (!("PushManager" in window))
        throw Error(
          "Use the installed Home Screen app for notifications on iPhone.",
        );
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw Error("Notifications were not enabled.");
      const registration = await navigator.serviceWorker.ready;
      const { key } = await api("push-key");
      const bytes = Uint8Array.from(
        atob(
          key
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(key.length / 4) * 4, "="),
        ),
        (c) => c.charCodeAt(0),
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      await api("push", "POST", subscription.toJSON());
      toast("Completion notifications enabled.");
    },
  );
  $("#more").append(notify);
  $("#studio").append(button("Plugins →", "button secondary", openPlugins));
  renderTools();
  showConnection();
  if ("serviceWorker" in navigator && window.isSecureContext)
    navigator.serviceWorker.register("sw.js").catch(() => {});
  const key = new URLSearchParams(location.hash.slice(1)).get("pair");
  if (key) {
    history.replaceState(null, "", location.pathname);
    try {
      await pair(key);
      toast("Phone paired. Welcome to your pocket studio.");
    } catch (error) {
      pairForm();
      toast(error.message);
    }
  } else await refresh();
  if (goWorkbench && connected) location.assign("/workbench/index.html");
})().catch((error) => toast(error.message));

async function openPlugins() {
  if (!connected) return pairForm();
  pluginList = await api("plugins");
  const body = sheet("Your extended toolkit.", "DINO LAB / PLUGINS");
  body.append(
    paragraph(
      "Import, review and enable plugins on the host. Enabled actions run on that computer through the shared job queue.",
      "tool-note",
    ),
  );
  if (!pluginList.length)
    body.append(
      paragraph(
        "No plugins installed yet. Open Plugins in Dino Lab desktop to add one.",
      ),
    );
  for (const p of pluginList) {
    body.append(
      button(
        p.name + " · " + (p.enabled ? "Enabled" : "Disabled"),
        "button secondary",
        () => openPlugin(p),
      ),
    );
  }
}
function openPlugin(plugin) {
  const body = sheet(plugin.name, "DINO LAB / PLUGIN");
  currentTool = plugin.id;
  body.append(paragraph(plugin.description || plugin.error || "Host plugin"));
  if (!plugin.enabled)
    body.append(
      paragraph(
        "This plugin needs host review and enablement before it can run.",
        "tool-note",
      ),
    );
  else {
    plugin.actions.forEach((a) =>
      body.append(button(a.label, "button primary", () => run(plugin, a.id))),
    );
    if (plugin.mcp) {
      const connection = state.connections.find((c) => c.id === plugin.id);
      body.append(
        button(
          connection ? "Disconnect MCP server" : "Connect MCP server",
          "button secondary",
          async () => {
            await run(plugin, connection ? "disconnect" : "connect");
            openPlugin(plugin);
          },
        ),
      );
      if (connection) mcpPanel(body, plugin, connection.tools);
    }
  }
  body.append(
    button("Stop host job", "text-button", () => run(plugin, "stop")),
  );
  const log = document.createElement("pre");
  log.id = "live-log";
  log.className = "log";
  log.textContent =
    state.jobs.find((j) => j.id === plugin.id)?.log || "No process output yet.";
  body.append(log, button("← All plugins", "text-button", openPlugins));
}
