# Dino Lab plugins

For settings forms, embedded tool views and curated adapters, see the
[integration studio guide](integrations.md).

Plugins are small local adapters: a JSON manifest, optional helper scripts, and
fixed commands. They extend the toolkit without modifying the desktop, phone, or
orchestrator. The eight built-in adapters continue to work unchanged. Upstream
engines remain external/submodules; do not copy engines or node_modules into a plugin.

## Try the included example

1. Start Dino Lab and connect a workspace.
2. Open **Plugins → Add example plugin**.
3. Expand **Review manifest and commands**, inspect the packaged script in
   `plugins/examples/artifact-report`, then select **Trust & enable plugin**.
4. Select **Create inventory report**. Its output appears in the plugin panel and
   Activity. The JSON inventory is saved in `.dino/artifacts` and is available in
   phone Files and project attachments.

The example uses the app's Node runtime. No dependency download or training is
needed. Importing never enables or runs it. **Disable & stop** revokes approval,
cancels its queued/running job, and disconnects its MCP server. Remove appears
while disabled and deletes only the installed adapter copy, not its output files.

On a paired phone open **Studio → Plugins**. You can run approved actions, stop
jobs, follow live output, and connect/use declared MCP tools. Import, trust,
removal, and command editing are unavailable over HTTP. Refresh the phone host
connection if the desktop installed or enabled a plugin after pairing.

## Author an adapter

Create a folder containing `dino-plugin.json` and your optional scripts:

```json
{
  "schemaVersion": 1,
  "id": "plugin-my-tool",
  "name": "My Tool",
  "version": "1.0.0",
  "description": "A small adapter for my existing engine.",
  "actions": {
    "check": {
      "label": "Check engine",
      "steps": [
        { "command": "${node}", "args": ["${plugin}/check.cjs"] }
      ]
    },
    "run": {
      "label": "Run experiment",
      "steps": [
        {
          "command": "python3",
          "args": ["${workspace}/my-engine/run.py", "--output", "${artifacts}"],
          "cwd": "${workspace}"
        }
      ]
    }
  }
}
```

Import the folder using the desktop dialog. You may also place an adapter directly
in `.dino/plugins/plugin-my-tool/` and refresh Plugins; it still needs approval.
Installed packages are local to each workspace and excluded from Git.

Supported action names: `install`, `start`, `sample`, `train`, `run`, `check`.
Each action declares a label and 1–10 sequential steps. Each step requires a
`command` string and `args` string array. Optional `cwd` defaults to the plugin
folder; it must resolve inside the workspace. No shell interpolation is used.
There is no arbitrary renderer code, require hook, or automatic startup action.

| Placeholder | Value |
| --- | --- |
| `${plugin}` | Installed adapter folder |
| `${workspace}` | Connected repository |
| `${artifacts}` | Workspace `.dino/artifacts` output folder |
| `${node}` | Dino's executable, launched in Node mode |

All actions except `start` share the existing single heavy-job slot. `start` is
for long-running services and occupies that tool's job slot until stopped. Use
absolute executable paths or commands available on the host PATH. Windows npm
and corepack use Dino's existing launcher resolution. Executables and engine
files outside the adapter are not included in the package hash.

Packages support up to 100 files, 10 MB, and eight directory levels. Symlinks and
special files are rejected. Keep mutable data, caches, virtual environments,
logs, and engines outside the package: writing into it changes its fingerprint.
Use `.dino/artifacts` or a separate workspace directory for outputs.

## Optional MCP server

An MCP-only plugin can use an empty actions object. Add a declaration such as:

```json
{
  "mcp": {
    "command": "${node}",
    "args": ["${workspace}/my-engine/mcp-server.cjs"],
    "cwd": "${workspace}"
  }
}
```

Merge that field into the complete manifest above. Dino connects the declared
stdio server, discovers its advertised tool schemas, and lets you submit JSON
arguments from desktop or phone. The phone cannot replace the executable or
arguments. A tool call may modify the open design; inspect its schema and inputs.

## Trust and updates

Plugins run as **your user account**, inherit the host process environment, and
can access files/network. They are **not sandboxed**. Review manifests AND scripts;
a manifest view is not a source-code security audit. Enable only trusted adapters.
Approval records a SHA-256 fingerprint of all package files. Modified files block
new jobs and MCP calls until reviewed again. Queued actions recheck approval when
they reach the front of the queue. Already running processes are not terminated
by a file edit; use **Disable & stop**. Referenced external engines/executables can
change independently and must also be trusted. There is no download marketplace
or automatic update mechanism in this first version.

To update, disable and remove the installed adapter, import its replacement,
review, and enable again. Output artifacts remain in the workspace. Moving or
renaming a workspace does not require reapproval if package content is identical.

## Terminal management

For a standalone phone host, use these commands from the checkout:

```bash
npm run plugins -- import plugins/examples/artifact-report
npm run plugins -- list
npm run plugins -- review plugin-artifact-report
# Review prints an enable command containing the exact package fingerprint.
```

`enable ID DIGEST`, `disable ID`, and `remove ID` manage local approval. The CLI
does not own an already-running host's jobs or MCP transports; stop them in that
host before disabling/removing with the CLI. Desktop **Disable & stop** handles all
three together. Do not run simultaneous CLI/desktop management writes.
