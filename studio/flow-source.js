import React, { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
const h = React.createElement;
function Editor() {
  const [nodes, setNodes] = useState([]),
    [edges, setEdges] = useState([]),
    [tools, setTools] = useState([]),
    [selected, setSelected] = useState(""),
    [message, setMessage] = useState(
      "Connect actions in order. Review the sequence before running.",
    ),
    [plan, setPlan] = useState(null),
    [history, setHistory] = useState([]);
  React.useEffect(() => {
    fetch("/api/plugins")
      .then((r) => r.json())
      .then((p) => setTools(p.filter((p) => p.enabled)));
    fetch("/api/flows")
      .then((r) => r.json())
      .then(setHistory);
  }, []);
  function add() {
    const [id, action] = selected.split(":");
    const tool = tools.find((p) => p.id === id);
    if (!tool || nodes.length >= 8) return;
    const uid = crypto.randomUUID();
    setNodes((n) => [
      ...n,
      {
        id: uid,
        position: {
          x: 40 + (n.length % 2) * 220,
          y: 40 + Math.floor(n.length / 2) * 120,
        },
        data: {
          label: tool.name.split(" · ")[0] + " / " + action,
          plugin: id,
          action,
        },
      },
    ]);
    setPlan(null);
  }
  function order() {
    if (!nodes.length) throw Error("Add actions first.");
    const incoming = new Map(nodes.map((n) => [n.id, 0]));
    for (const e of edges) {
      if (!incoming.has(e.source) || !incoming.has(e.target))
        throw Error("Invalid connection.");
      incoming.set(e.target, incoming.get(e.target) + 1);
    }
    const queue = nodes.filter((n) => incoming.get(n.id) === 0),
      result = [];
    while (queue.length) {
      const n = queue.shift();
      result.push({ id: n.data.plugin, action: n.data.action });
      for (const e of edges.filter((e) => e.source === n.id)) {
        incoming.set(e.target, incoming.get(e.target) - 1);
        if (incoming.get(e.target) === 0)
          queue.push(nodes.find((n) => n.id === e.target));
      }
    }
    if (result.length !== nodes.length)
      throw Error("Remove cycles before running.");
    return result;
  }
  async function run() {
    try {
      const r = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Visual workflow", steps: plan }),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      setHistory([v, ...history]);
      setPlan(null);
      setMessage("Workflow submitted. Follow its jobs in the studio.");
    } catch (e) {
      setMessage(e.message);
    }
  }
  return h(
    React.Fragment,
    null,
    h(
      "header",
      null,
      h("a", { href: "/studio/index.html" }, "← Integration studio"),
      h("strong", null, "DINO / VISUAL WORKFLOWS"),
    ),
    h(
      "main",
      null,
      h("h1", null, "Connect the experiment."),
      h("p", null, message),
      h(
        "div",
        { className: "actions" },
        h(
          "select",
          {
            value: selected,
            onChange: (e) => setSelected(e.target.value),
            "aria-label": "Workflow action",
          },
          h("option", { value: "" }, "Choose an enabled action"),
          ...tools.flatMap((p) =>
            p.actions
              .filter((a) => a.id !== "install")
              .map((a) =>
                h(
                  "option",
                  { key: p.id + a.id, value: p.id + ":" + a.id },
                  p.name.split(" · ")[0] + " / " + a.label,
                ),
              ),
          ),
        ),
        h("button", { onClick: add }, "Add action"),
        h(
          "button",
          {
            onClick: async () => {
              try {
                const steps = order();
                for (const s of steps) {
                  const r = await fetch(
                    "/api/plugin-settings?id=" + encodeURIComponent(s.id),
                  );
                  s.settings = await r.json();
                  if (!r.ok) throw Error(s.settings.error);
                }
                setPlan(steps);
              } catch (e) {
                setMessage(e.message);
              }
            },
          },
          "Review workflow",
        ),
        h(
          "button",
          {
            onClick: () => {
              setNodes([]);
              setEdges([]);
              setPlan(null);
            },
          },
          "Clear",
        ),
      ),
      h(
        "div",
        { className: "flow-canvas" },
        h(
          ReactFlow,
          {
            nodes,
            edges,
            onNodesChange: (c) => {
              setNodes((n) => applyNodeChanges(c, n));
              setPlan(null);
            },
            onEdgesChange: (c) => {
              setEdges((e) => applyEdgeChanges(c, e));
              setPlan(null);
            },
            onConnect: (c) => {
              setEdges((e) => addEdge(c, e));
              setPlan(null);
            },
            fitView: true,
          },
          h(Controls),
          h(Background),
        ),
      ),
      plan &&
        h(
          "section",
          null,
          h("h2", null, "Review " + plan.length + " steps"),
          h(
            "pre",
            null,
            plan
              .map(
                (s, i) =>
                  i +
                  1 +
                  ". " +
                  s.id +
                  " / " +
                  s.action +
                  "\n" +
                  JSON.stringify(s.settings, null, 2),
              )
              .join("\n"),
          ),
          h(
            "p",
            null,
            "Uses saved settings captured when you approve. Independent branches run sequentially to limit compute. Starting a service leaves it running.",
          ),
          h("button", { onClick: run }, "Approve & run workflow"),
        ),
      h("h2", null, "Recent workflows"),
      ...history.map((r) => h("p", { key: r.id }, r.name + " · " + r.state)),
      h(
        "button",
        {
          onClick: () =>
            fetch("/api/flows")
              .then((r) => r.json())
              .then(setHistory),
        },
        "Refresh workflow status",
      ),
    ),
  );
}
createRoot(document.querySelector("#root")).render(h(Editor));
