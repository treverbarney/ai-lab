const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const [directory, action] = process.argv.slice(2);
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      entry.name.startsWith(".") ||
      entry.name === "artifact-inventory.json"
    )
      continue;
    const stat = await fs.stat(path.join(directory, entry.name));
    files.push({
      name: entry.name,
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  const report = {
    createdAt: new Date().toISOString(),
    count: files.length,
    files,
  };
  console.log(JSON.stringify(report, null, 2));
  if (action === "run") {
    await fs.writeFile(
      path.join(directory, "artifact-inventory.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      "Saved artifact-inventory.json. Open Files or attach it to a project.",
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
