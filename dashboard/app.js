/* Framework-free UI. Browser mode keeps hosted demos and setup recipes usable. */
"use strict";
const $ = (selector) => document.querySelector(selector);
const desktop = Boolean(window.lab);
let data = window.labCatalog;
let statuses = [];
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 6500);
}
function action(fn) {
  return async (event) => {
    const button = event?.currentTarget;
    if (button) button.disabled = true;
    try {
      await fn();
    } catch (error) {
      toast(error.message || String(error));
    } finally {
      if (button) button.disabled = false;
    }
  };
}
function button(text, className, fn) {
  const el = document.createElement("button");
  el.textContent = text;
  el.className = className;
  el.addEventListener("click", action(fn));
  return el;
}
function paragraph(text) {
  const el = document.createElement("p");
  el.textContent = text;
  return el;
}
function modal(title, label = "LAB GUIDE") {
  $("#dialog-title").textContent = title;
  $("#dialog-label").textContent = label;
  $("#dialog-body").replaceChildren();
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
  return $("#dialog-body");
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
  await window.lab.openView(item.id, mode);
  $("#view-title").textContent = item.name;
  $("#view-mode").textContent =
    mode === "local" ? data.urls[item.id] : "Hosted demo · internet required";
  $("#view-toolbar").hidden = false;
  document.body.classList.add("workspace-open");
}
async function leaveView() {
  if (desktop) await window.lab.closeView();
  $("#view-toolbar").hidden = true;
  document.body.classList.remove("workspace-open");
}
function art(index) {
  // Lightweight diagrams, rendered once. No animation, WebGL or network requests at rest.
  const colors = ["#99bda7", "#91b2cd", "#a3bcb3", "#b8bd94"];
  let shapes = "";
  if (index === 0 || index === 2) {
    const layers = index === 0 ? [3, 5, 5, 3] : [4, 6, 4, 2];
    const nodes = layers.map((n, x) =>
      Array.from({ length: n }, (_, y) => [
        70 + x * 74,
        56 + (y - (n - 1) / 2) * 17,
      ]),
    );
    nodes.forEach((layer, l) =>
      layer.forEach(([x, y]) => {
        nodes[l + 1]?.forEach(([x2, y2]) => {
          shapes += `<path d="M${x},${y}L${x2},${y2}" opacity=".2"/>`;
        });
        shapes += `<circle cx="${x}" cy="${y}" r="${index === 0 ? 3 : 4}" fill="${colors[index]}" stroke-width=".5"/>`;
      }),
    );
  } else if (index === 1) {
    for (let i = 0; i < 7; i++) {
      shapes += `<rect x="${55 + i * 38}" y="75" width="25" height="13" rx="2" fill="${colors[index]}" opacity=".3"/>`;
      for (let j = i + 1; j < 7; j++)
        shapes += `<path d="M${67 + i * 38},72 Q${67 + (i + j) * 19},${16 - (j - i) * 2} ${67 + j * 38},72" opacity=".3"/>`;
    }
  } else {
    shapes += '<path d="M45,87H330M45,25V87" opacity=".3"/>';
    shapes +=
      '<path d="M48,29L65,40L82,35L97,55L115,49L130,64L146,61L162,72L180,68L197,78L216,75L235,80L256,79L282,83L326,84" stroke-width="2"/>';
    shapes +=
      '<path d="M48,33Q110,78 326,86" stroke-dasharray="3 4" opacity=".3"/>';
  }
  return `<svg viewBox="0 0 380 112" fill="none" stroke="${colors[index]}" aria-hidden="true">${shapes}</svg>`;
}
function setup(item) {
  const body = modal(item.name, "LOCAL SETUP");
  body.append(
    paragraph(
      "Run commands in a terminal from your ai-lab repository. If a submodule is missing, first run: bash setup/add-neural-submodules.sh. Dependencies are installed separately for each tool.",
    ),
  );
  const pre = document.createElement("pre");
  const command =
    item.command ||
    "See Engineering setup and the upstream documentation for installation and MCP configuration.";
  pre.textContent = command;
  body.append(pre);
  if (item.id === "minimind")
    body.append(
      paragraph(
        "Training is manual and may require a GPU, datasets and model downloads. Nothing starts here automatically. Check the pinned upstream README for current hardware and training instructions.",
      ),
    );
  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  if (item.command)
    actions.append(
      button("Copy commands", "primary", async () => {
        await navigator.clipboard.writeText(command);
        toast("Commands copied.");
      }),
    );
  if (desktop && item.path)
    actions.append(
      button("Open project folder ↗", "quiet", () =>
        window.lab.openFolder(item.id),
      ),
    );
  actions.append(button("Upstream guide ↗", "quiet", () => source(item)));
  if (item.url)
    actions.append(
      button("Demo in browser ↗", "quiet", () =>
        desktop
          ? window.lab.openBrowser(item.id)
          : window.open(item.url, "_blank", "noopener,noreferrer"),
      ),
    );
  body.append(actions);
  if (item.port && desktop) {
    body.append(
      paragraph(
        "Start the local dev server first. If its port differs, update the address below. Use loopback only.",
      ),
    );
    const label = document.createElement("label");
    label.textContent = "Local visualizer URL";
    label.htmlFor = "local-url";
    const input = document.createElement("input");
    input.id = "local-url";
    input.type = "url";
    input.value = data.urls[item.id];
    input.spellcheck = false;
    body.append(
      label,
      input,
      button("Save address", "quiet", async () => {
        data.urls = await window.lab.saveUrl(item.id, input.value);
        await refresh();
        toast("Local address saved.");
      }),
    );
  }
}
function render() {
  $("#neural-grid").replaceChildren();
  data.neural.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "tool-card";
    card.innerHTML = `<div class="card-art art-${index}"><span class="art-label">${["TOKEN FLOW", "SELF ATTENTION", "LAYER BY LAYER", "LOSS / STEP"][index]}</span>${art(index)}<span class="art-index">0${index + 1} / NEURAL</span></div><div class="card-body"><span class="card-eyebrow"></span><h3></h3><p></p><div class="card-actions"></div></div><div class="card-footer"><span class="checkout"></span></div>`;
    card.querySelector(".card-eyebrow").textContent = item.label;
    card.querySelector("h3").textContent = item.name;
    card.querySelector("p").textContent = item.description;
    const actions = card.querySelector(".card-actions");
    if (item.url)
      actions.append(
        button("Explore demo ↗", "primary", () => openView(item, "hosted")),
      );
    else
      actions.append(button("Training setup →", "primary", () => setup(item)));
    if (item.port && desktop)
      actions.append(
        button("Open local", "quiet", () => openView(item, "local")),
      );
    actions.append(
      button(item.url ? "Setup" : "Source ↗", "quiet", () =>
        item.url ? setup(item) : source(item),
      ),
    );
    card.querySelector(".checkout").dataset.checkout = item.id;
    card
      .querySelector(".card-footer")
      .append(button("Project ↗", "quiet", () => source(item)));
    $("#neural-grid").append(card);
  });
  $("#engineering-grid").replaceChildren();
  data.engineering.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "tool-card";
    card.innerHTML = `<div class="card-body"><div class="engineering-icon" aria-hidden="true">${["⬡", "⌁", "◎", "◇"][index]}</div><span class="card-eyebrow"></span><h3></h3><p></p><div class="card-actions"></div></div>`;
    card.querySelector(".card-eyebrow").textContent = item.label;
    card.querySelector("h3").textContent = item.name;
    card.querySelector("p").textContent = item.description;
    const actions = card.querySelector(".card-actions");
    if (item.native && desktop) {
      actions.append(
        button("Launch app ↗", "primary", async () => {
          if (await window.lab.launchNative(item.id))
            toast(`${item.name} launched.`);
        }),
      );
      actions.append(
        button("Choose app", "quiet", async () => {
          if (await window.lab.launchNative(item.id, true))
            toast(`${item.name} shortcut saved.`);
        }),
      );
    } else
      actions.append(button("Open guide ↗", "primary", () => source(item)));
    actions.append(button("Setup", "quiet", () => readDoc("setup")));
    $("#engineering-grid").append(card);
  });
  $("#doc-links").replaceChildren(
    ...data.docs.map((doc) =>
      button(`${doc.name}  ↗`, "doc-link", () => readDoc(doc.id)),
    ),
  );
  $("#app-version").textContent = desktop
    ? `DESKTOP v${data.version}`
    : "BROWSER PREVIEW";
}
async function readDoc(id) {
  const doc = data.docs.find((x) => x.id === id);
  const body = modal(doc.name, "WORKSPACE DOCS");
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
    pre.textContent = `${error.message}\nOpen ${doc.path} in your repository, or run the desktop app with npm start.`;
  }
}
async function refresh() {
  statuses = desktop
    ? await window.lab.status()
    : data.neural.map((x) => ({
        id: x.id,
        checkout: "desktop only",
        local: null,
      }));
  $("#workspace-path").textContent =
    data.root ||
    (desktop
      ? "No repository selected. Hosted demos and docs are ready; choose your checkout for local tools."
      : "Browser preview · run npm start for local status and native shortcuts.");
  $("#checkout-count").textContent = desktop
    ? String(
        statuses.filter((x) => x.checkout === "checked out").length,
      ).padStart(2, "0")
    : "—";
  $("#status-list").replaceChildren();
  statuses.forEach((status) => {
    const item = data.neural.find((x) => x.id === status.id);
    const checkout = document.querySelector(`[data-checkout="${status.id}"]`);
    const local =
      status.local === null
        ? ""
        : ` · server ${status.local ? "online" : "offline"}`;
    checkout.textContent = `${status.checkout}${local}`;
    const row = document.createElement("div");
    row.className = "status-row";
    const label = document.createElement("span");
    label.textContent = item.name;
    const value = document.createElement("span");
    value.textContent = `${status.checkout}${local}`;
    row.append(label, value);
    $("#status-list").append(row);
  });
}
$("#close-dialog").addEventListener("click", () => $("#detail-dialog").close());
$("#back-home").addEventListener("click", action(leaveView));
$("#view-browser").addEventListener(
  "click",
  action(() => window.lab.openBrowser()),
);
$("#refresh").addEventListener("click", action(refresh));
$("#choose-workspace").addEventListener(
  "click",
  action(async () => {
    if (!desktop) {
      toast(
        "Run npm start from your ai-lab repository to use desktop features.",
      );
      return;
    }
    data.root = await window.lab.workspace();
    await refresh();
  }),
);
$("#open-root").addEventListener(
  "click",
  action(async () => {
    if (!desktop) {
      toast("Open the desktop app with npm start for folder shortcuts.");
      return;
    }
    await window.lab.openFolder("root");
  }),
);
document.querySelectorAll("[data-nav]").forEach((link) =>
  link.addEventListener("click", () => {
    document
      .querySelectorAll("[data-nav]")
      .forEach((x) => x.classList.toggle("active", x === link));
    $("#breadcrumb").textContent = {
      overview: "Overview",
      neural: "Neural track",
      engineering: "Engineering",
      docs: "Status & docs",
    }[link.dataset.nav];
    if (link.dataset.nav === "overview")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }),
);
if (desktop)
  window.lab.onViewError((message) => {
    leaveView().catch(() => {});
    toast(message);
  });
(async () => {
  if (desktop) data = await window.lab.catalog();
  render();
  await refresh();
})().catch((error) => toast(`Unable to load workspace: ${error.message}`));
