// Submission-only agent entry point. Approval stays in the project workbench.
const args = process.argv.slice(2);
const base = process.env.DINO_HOST || "http://127.0.0.1:4317";
const key = process.env.DINO_PAIR_KEY;
(async () => {
  if (!key)
    throw Error(
      "Set DINO_PAIR_KEY from Dino desktop Phone access. Never put it in a committed file.",
    );
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Invalid host URL.");
  const pair = await fetch(base + "/api/pair", {
    method: "POST",
    headers: { Origin: url.origin, "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!pair.ok) throw Error("Pairing failed.");
  const cookie = pair.headers.get("set-cookie").split(";")[0];
  const response = await fetch(base + "/api/workbench", {
    method: "POST",
    headers: {
      Origin: url.origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      op: "request",
      project: args[0],
      prompt: args.slice(1).join(" "),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  console.log(JSON.stringify(result, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
