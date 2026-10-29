const path = require("node:path");
const { Plugins } = require("./manager.cjs");
const plugins = new Plugins(() => path.join(__dirname, ".."));
(async () => {
  const [op = "list", target, digest] = process.argv.slice(2);
  if (op === "list") console.log(JSON.stringify(await plugins.list(), null, 2));
  else if (op === "review") {
    const p = (await plugins.list(true)).find((p) => p.id === target);
    if (!p) throw Error("Plugin not found.");
    console.log(JSON.stringify(p, null, 2));
    console.log(
      "\nCommands have your user account privileges. Inspect all package scripts before trusting.",
    );
    if (p.digest)
      console.log(
        `To approve these exact files: npm run plugins -- enable ${p.id} ${p.digest}`,
      );
  } else if (op === "import") {
    if (!target) throw Error("Provide a local plugin directory.");
    console.log(
      "Imported disabled:",
      await plugins.import(path.resolve(target)),
    );
  } else if (op === "enable") {
    await plugins.enable(target, digest);
    console.log("Enabled.");
  } else if (["disable", "remove"].includes(op)) {
    // A separate live host owns its processes; avoid suggesting the CLI stopped them.
    await plugins[op](target);
    console.log(
      "Approval revoked. Stop any existing job/MCP connection in the host.",
    );
  } else
    throw Error(
      "Usage: npm run plugins -- list | import FOLDER | review ID | enable ID DIGEST | disable ID | remove ID",
    );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
