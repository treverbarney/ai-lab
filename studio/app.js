const $ = (s) => document.querySelector(s);
let plugins = [],
  files = [],
  jobs = [],
  chosen,
  events;
const say = (s) => ($("#status").textContent = s);
async function api(route, method = "GET", data) {
  const r = await fetch("/api/" + route, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : {},
    body: method === "POST" ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const v = await r.json();
  if (!r.ok) throw Error(v.error || "Host unavailable.");
  return v;
}
function act(fn) {
  return async (e) => {
    if (e?.currentTarget) e.currentTarget.disabled = true;
    try {
      await fn();
    } catch (e) {
      say(e.message);
    } finally {
      if (e?.currentTarget) e.currentTarget.disabled = false;
    }
  };
}
function button(text, fn, primary = false) {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = primary ? "primary" : "";
  b.onclick = act(fn);
  return b;
}
function p(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}
function option(value, label = value) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}
async function refresh() {
  [plugins, files] = await Promise.all([api("plugins"), api("files")]);
  const state = await api("state");
  jobs = state.jobs;
  $("#tool-list").replaceChildren(
    ...plugins.map((t) =>
      button(t.name + (t.enabled ? "" : " · disabled"), () => open(t.id)),
    ),
  );
  renderFiles();
  await history();
  if (!events) {
    events = new EventSource("/api/events");
    events.addEventListener("jobs", (e) => {
      jobs = JSON.parse(e.data);
      updateLog();
    });
    events.addEventListener("notice", () =>
      refresh().catch((e) => say(e.message)),
    );
    events.onerror = () =>
      say("Host connection interrupted. Refresh to reconnect.");
  }
  say("Connected · installs and heavy jobs share one queue.");
}
function updateLog() {
  const job = jobs.find((j) => j.id === chosen);
  const log = $("#log");
  if (log)
    log.textContent = job
      ? `${job.action} / ${job.state}\n${job.log}`
      : "No process output yet.";
}
async function open(id, file) {
  chosen = id;
  const tool = plugins.find((p) => p.id === id),
    area = $("#tool");
  area.replaceChildren();
  if (!tool) return;
  const title = document.createElement("h2");
  title.textContent = tool.name;
  area.append(title, p(tool.description), p(tool.resources));
  if (!tool.enabled) {
    area.append(
      p(
        tool.error ||
          "Review and enable this adapter in Dino desktop → Plugins.",
      ),
    );
    return;
  }
  let saved = {};
  try {
    saved = await api("plugin-settings?id=" + encodeURIComponent(id));
  } catch (e) {
    say(e.message);
  }
  const controls = {};
  for (const [key, field] of Object.entries(tool.settings)) {
    const label = document.createElement("label");
    label.textContent = field.label;
    let input;
    if (field.type === "artifact" || field.type === "enum") {
      input = document.createElement("select");
      input.append(option("", "Choose…"));
      const choices =
        field.type === "artifact"
          ? files
              .filter((f) =>
                field.extensions.includes(
                  f.name.split(".").at(-1).toLowerCase(),
                ),
              )
              .map((f) => f.name)
          : field.options;
      choices.forEach((c) => input.append(option(c)));
    } else {
      input = document.createElement("input");
      input.type = field.type === "integer" ? "number" : "text";
      if (field.type === "integer") {
        input.min = field.min;
        input.max = field.max;
      } else input.maxLength = field.maxLength || 200;
    }
    input.id = "setting-" + key;
    input.value =
      key === "file" && file ? file : (saved[key] ?? field.default ?? "");
    controls[key] = { input, field };
    label.append(input);
    area.append(label);
  }
  const save = async () => {
    const values = Object.fromEntries(
      Object.entries(controls).map(([k, { input, field }]) => [
        k,
        field.type === "integer" ? Number(input.value) : input.value,
      ]),
    );
    await api("plugin-settings", "POST", { id, values });
    return values;
  };
  const actions = document.createElement("div");
  actions.className = "actions";
  if (Object.keys(controls).length)
    actions.append(
      button("Save settings", async () => {
        await save();
        say("Settings saved.");
      }),
    );
  tool.actions.forEach((a) =>
    actions.append(
      button(
        a.label,
        async () => {
          await save();
          await api("plugin-action", "POST", { id, action: a.id });
          say(a.label + " submitted. Follow the output below.");
        },
        a.id === "sample",
      ),
    ),
  );
  actions.append(
    button("Stop job", () =>
      api("plugin-action", "POST", { id, action: "stop" }),
    ),
  );
  if (tool.view)
    actions.append(
      button(
        "Open embedded view",
        async () => {
          await save();
          let url = tool.view.port
            ? "/views/" + id + (tool.view.path || "/")
            : tool.view.path;
          if (id === "plugin-rerun")
            url +=
              "?url=" +
              encodeURIComponent(
                location.origin +
                  "/api/download?name=" +
                  encodeURIComponent(
                    controls.file?.input.value || "dino-motion.rrd",
                  ),
              );
          if (!tool.view.port && controls.file?.input.value)
            url += "?file=" + encodeURIComponent(controls.file.input.value);
          await showView(tool.name, url);
        },
        true,
      ),
    );
  area.append(actions);
  const log = document.createElement("pre");
  log.id = "log";
  area.append(log);
  updateLog();
  if (id === "plugin-kiri")
    area.append(
      button("Open Mesh:Tool", () =>
        showView("Mesh:Tool", "/views/plugin-kiri/mesh/"),
      ),
    );
  const details = document.createElement("details"),
    summary = document.createElement("summary");
  summary.textContent = "Upstream project";
  const a = document.createElement("a");
  a.textContent = tool.homepage;
  a.href = tool.homepage;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  details.append(summary, a);
  area.append(details);
}
async function showView(name, url) {
  if (url.startsWith("/views/")) {
    const id = url.split("/")[2],
      state = await api("state");
    if (
      !state.jobs.some(
        (j) => j.id === id && j.action === "start" && j.state === "running",
      )
    )
      throw Error("Start this tool view first.");
    say("Waiting for tool view…");
    let ready = false;
    for (let n = 0; n < 100; n++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!ready) throw Error("Tool did not become ready. Check its log.");
    say("Tool view ready.");
  }

  $("#view-name").textContent = name;
  $("#view").src = url;
  $("#view-dialog").showModal();
}
$("#close-view").onclick = () => {
  $("#view").src = "about:blank";
  $("#view-dialog").close();
};
function renderFiles() {
  $("#artifacts").replaceChildren(
    ...files.map((file) => {
      const row = document.createElement("div");
      row.className = "artifact";
      const title = document.createElement("strong");
      title.textContent = file.name;
      row.append(title);
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Send " + file.name + " to tool");
      select.append(option("", "Send to…"));
      for (const tool of plugins.filter((p) => p.enabled))
        if (
          Object.values(tool.settings).some(
            (f) =>
              f.type === "artifact" &&
              f.extensions.includes(file.name.split(".").at(-1).toLowerCase()),
          )
        )
          select.append(option(tool.id, tool.name));
      select.onchange = act(async () => {
        if (select.value) {
          await open(select.value, file.name);
          $("#tool").scrollIntoView({ block: "start", behavior: "smooth" });
        }
      });
      row.append(select);
      const a = document.createElement("a");
      a.textContent = "Download";
      a.href = "/api/download?name=" + encodeURIComponent(file.name);
      row.append(a);
      return row;
    }),
  );
}
const templates = [
  {
    name: "Inspect a model",
    steps: [
      { id: "plugin-netron", action: "sample" },
      { id: "plugin-netron", action: "start" },
    ],
  },
  {
    name: "Compare training runs",
    steps: [
      { id: "plugin-aim", action: "sample" },
      { id: "plugin-aim", action: "start" },
    ],
  },
  {
    name: "Explore gradient descent",
    steps: [
      { id: "plugin-marimo", action: "sample" },
      { id: "plugin-marimo", action: "start" },
    ],
  },
];
$("#templates").append(
  ...templates.map((t) =>
    button(t.name, () => {
      const target = $("#plan");
      target.replaceChildren(
        p("Review: " + t.steps.map((s) => s.id + " / " + s.action).join(" → ")),
        p(
          "Uses saved settings. Install and enable these tools first. A started service stays running.",
        ),
        button(
          "Approve & run " + t.name,
          async () => {
            await api("flows", "POST", t);
            say("Workflow queued.");
            await history();
          },
          true,
        ),
      );
    }),
  ),
);
async function history() {
  const runs = await api("flows");
  $("#flows").replaceChildren(
    ...runs.map((r) => {
      const el = p(r.name + " · " + r.state + (r.error ? " · " + r.error : ""));
      if (r.state === "running")
        el.append(
          button("Cancel workflow", async () => {
            await api("flows", "POST", { op: "cancel", id: r.id });
            await history();
          }),
        );
      return el;
    }),
  );
}
$("#import").onchange = act(async () => {
  const file = $("#import").files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024)
    throw Error(
      "Phone imports are limited to 20 MB; use desktop Import artifact for larger files.",
    );
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const saved = await api("import", "POST", { name: file.name, data });
  await refresh();
  say("Imported " + saved.name);
});
$("#refresh").onclick = act(async () => {
  events?.close();
  events = null;
  await refresh();
  if (chosen) await open(chosen);
});
refresh()
  .then(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("plugin"))
      return open(params.get("plugin"), params.get("file"));
  })
  .catch((e) =>
    say(e.message + " Pair this browser from Dino desktop Phone access."),
  );

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    events?.close();
    events = null;
  } else refresh().catch((e) => say(e.message));
});
