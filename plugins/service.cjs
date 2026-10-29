// Both launchers use the same trusted host-side action path. No remote command overrides.
async function pluginAction(plugins, runtime, connections, input) {
  if (!plugins) throw Error("Plugins are unavailable on this host.");
  const { id, action } = input;
  if (typeof id !== "string" || !id.startsWith("plugin-"))
    throw Error("Unknown plugin.");
  if (action === "stop") return runtime.stop(id);
  if (action === "disconnect") return connections.disconnect(id);
  await plugins.approved(id);
  if (action === "connect") {
    const config = await plugins.connection(id);
    const result = await connections.connect(id, config, config.cwd);
    try {
      await plugins.approved(id);
    } catch (error) {
      await connections.disconnect(id);
      throw error;
    }
    return result;
  }
  if (action === "call") return connections.call(id, input.name, input.args);
  return runtime.start(id, action);
}
module.exports = { pluginAction };
