import { preview } from "./viewer.js";
const $ = (s) => document.querySelector(s);
let data,
  files = [],
  project,
  viewer,
  strokes = [],
  activeStroke,
  modelFile;
const request = async (op, input = {}) => {
  const r = await fetch("/api/workbench", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...input }),
  });
  const v = await r.json();
  if (!r.ok) throw Error(v.error);
  return v;
};
function button(text, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.onclick = act(fn);
  return b;
}
function act(fn) {
  return async (e) => {
    if (e?.currentTarget) e.currentTarget.disabled = true;
    try {
      await fn();
    } catch (error) {
      $("#status").textContent = error.message;
    } finally {
      if (e?.currentTarget) e.currentTarget.disabled = false;
    }
  };
}
function option(value, text) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = text;
  return o;
}
async function refresh() {
  const chosen = $("#project").value;
  data = await request("state");
  const r = await fetch("/api/files");
  if (!r.ok)
    throw Error("Pair this browser from Dino desktop Phone access first.");
  files = await r.json();
  $("#project").replaceChildren(
    ...data.projects.map((p) => option(p.id, p.name)),
  );
  if (data.projects.some((p) => p.id === chosen)) $("#project").value = chosen;
  $("#artifact").replaceChildren(...files.map((f) => option(f.name, f.name)));
  select();
  $("#status").textContent = "Connected · review requests before approving";
}
function select() {
  project = data.projects.find((p) => p.id === $("#project").value);
  $("#notes").value = project?.notes || "";
  $("#attached").replaceChildren(
    ...(project?.artifacts || []).map((name) => {
      const el = document.createElement("p");
      el.textContent = name;
      const link = document.createElement("a");
      link.href =
        "/studio/index.html?file=" +
        encodeURIComponent(name) +
        "&plugin=" +
        (/\.(stl|step|stp|iges|igs|glb|fcstd|obj)$/i.test(name)
          ? "plugin-cad-viewer"
          : "plugin-netron");
      link.textContent = " Open in integration studio ↗";
      el.append(link);
      return el;
    }),
  );
  render();
}
function render() {
  const mine = data.requests.filter((r) => r.project === project?.id);
  $("#requests").replaceChildren(
    ...mine.map((r) => {
      const div = document.createElement("div");
      div.className = "item";
      const title = document.createElement("strong");
      title.textContent = r.prompt;
      const pre = document.createElement("pre");
      pre.textContent =
        `${r.state}\n` +
        r.steps.map((s) => data.actions[s].label).join("\n") +
        (r.error ? "\n" + r.error : "");
      div.append(title, pre);
      if (r.state === "awaiting-review")
        div.append(
          button("Approve & queue", async () => {
            await request("approve", { id: r.id });
            await refresh();
          }),
          button("Reject", async () => {
            await request("reject", { id: r.id });
            await refresh();
          }),
        );
      return div;
    }),
  );
  $("#queue").replaceChildren(
    ...data.jobs.map((j) => {
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = `${j.id} / ${j.action} / ${j.state}`;
      if (["queued", "running"].includes(j.state))
        div.append(
          button(
            j.state === "queued" ? "Cancel queued job" : "Stop job",
            async () => {
              await fetch(
                j.id.startsWith("plugin-")
                  ? "/api/plugin-action"
                  : "/api/action",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: j.id, action: "stop" }),
                },
              );
              await refresh();
            },
          ),
        );
      return div;
    }),
  );
  $("#notifications").replaceChildren(
    ...data.notifications.map((n) => {
      const el = document.createElement("p");
      el.textContent = n.title + " — " + n.text;
      return el;
    }),
  );
}
function requireProject() {
  if (!project) throw Error("Create or select a project first.");
}
$("#create").onclick = act(async () => {
  const p = await request("create", { name: $("#name").value });
  await refresh();
  $("#project").value = p.id;
  select();
});
$("#project").onchange = select;
$("#save").onclick = act(async () => {
  requireProject();
  await request("save", { id: project.id, notes: $("#notes").value });
  $("#status").textContent = "Notes saved.";
});
$("#attach").onclick = act(async () => {
  requireProject();
  const saved = await request("save", {
    id: project.id,
    file: $("#artifact").value,
  });
  await refresh();
  $("#artifact").value = saved.artifacts.at(-1);
});
$("#propose").onclick = act(async () => {
  requireProject();
  await request("request", { project: project.id, prompt: $("#prompt").value });
  await refresh();
});
$("#refresh").onclick = act(refresh);
$("#dismiss").onclick = act(async () => {
  await request("dismiss");
  await refresh();
});
const ink = $("#ink");
function paint() {
  const rect = ink.getBoundingClientRect();
  ink.width = Math.max(1, rect.width * devicePixelRatio);
  ink.height = Math.max(1, rect.height * devicePixelRatio);
  const ctx = ink.getContext("2d");
  ctx.strokeStyle = "#f47b43";
  ctx.lineWidth = 3 * devicePixelRatio;
  ctx.lineCap = "round";
  for (const stroke of strokes) {
    ctx.beginPath();
    stroke.forEach(([x, y], i) =>
      i
        ? ctx.lineTo(x * ink.width, y * ink.height)
        : ctx.moveTo(x * ink.width, y * ink.height),
    );
    ctx.stroke();
  }
}
$("#preview").onclick = act(async () => {
  requireProject();
  modelFile = $("#artifact").value;
  if (!project.artifacts.includes(modelFile))
    throw Error("Attach the artifact to this project first.");
  if (files.find((f) => f.name === modelFile)?.size > 20 * 1024 * 1024)
    throw Error("Use a preview smaller than 20 MB on this workbench.");
  viewer?.dispose();
  viewer = null;
  $("#preview-status").textContent = "Loading model…";
  try {
    viewer = await preview(
      $("#model"),
      "/api/download?name=" + encodeURIComponent(modelFile),
      modelFile,
    );
    strokes = project.markups?.[modelFile] || [];
    $("#preview-status").textContent = "Drag to orbit / pinch to zoom";
    paint();
  } catch (e) {
    $("#preview-status").textContent = e.message;
    throw e;
  }
});
$("#reset").onclick = () => viewer?.reset();
$("#draw").onclick = () => {
  ink.hidden = !ink.hidden;
  $("#draw").textContent = ink.hidden ? "Draw markup" : "Orbit model";
  if (!ink.hidden) paint();
};
$("#clear").onclick = () => {
  strokes = [];
  paint();
};
ink.onpointerdown = (e) => {
  if (strokes.length >= 200) return;
  ink.setPointerCapture(e.pointerId);
  activeStroke = [];
  strokes.push(activeStroke);
};
ink.onpointermove = (e) => {
  if (!activeStroke || activeStroke.length >= 2000) return;
  const r = ink.getBoundingClientRect();
  activeStroke.push([
    Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
  ]);
  paint();
};
ink.onpointerup = ink.onpointercancel = () => (activeStroke = null);
$("#save-ink").onclick = act(async () => {
  requireProject();
  if (!modelFile || !viewer) throw Error("Preview a model first.");
  await request("save", {
    id: project.id,
    markup: { file: modelFile, strokes },
  });
  $("#status").textContent = "Review markup saved.";
});
let events = new EventSource("/api/events");
events.addEventListener("jobs", (e) => {
  if (data) {
    data.jobs = JSON.parse(e.data);
    render();
  }
});
events.addEventListener("notice", () => refresh().catch(() => {}));
events.onerror = () => {
  $("#status").textContent = "Host unavailable. Reconnect and refresh.";
  events.close();
};
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh().catch(() => {});
});
refresh().catch(
  (error) =>
    ($("#status").textContent =
      error.message + " Open Dino Lab → Phone access to pair this browser."),
);
