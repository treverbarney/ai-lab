const fs = require("node:fs/promises");
const path = require("node:path");
const push = require("web-push");
class Notices {
  constructor(root) {
    this.root = root;
    this.lock = Promise.resolve();
  }
  async data() {
    const root = this.root();
    if (!root) throw Error("Connect a repository first.");
    const file = path.join(root, ".dino", "push.json");
    try {
      return { file, ...JSON.parse(await fs.readFile(file, "utf8")) };
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      return { file, keys: push.generateVAPIDKeys(), subscriptions: [] };
    }
  }
  async edit(fn) {
    const task = this.lock.then(async () => {
      const data = await this.data();
      const result = await fn(data);
      const { file, ...saved } = data;
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(saved), { mode: 0o600 });
      return result;
    });
    this.lock = task.catch(() => {});
    return task;
  }
  key() {
    return this.edit((d) => d.keys.publicKey);
  }
  subscribe(value, owner) {
    const url = new URL(value?.endpoint);
    if (
      url.protocol !== "https:" ||
      (url.port && url.port !== "443") ||
      ![
        "fcm.googleapis.com",
        "web.push.apple.com",
        "updates.push.services.mozilla.com",
      ].includes(url.hostname)
    )
      throw Error("Unsupported push provider.");
    if (!value.keys?.p256dh || !value.keys?.auth)
      throw Error("Invalid subscription.");
    return this.edit((d) => {
      d.subscriptions = d.subscriptions.filter(
        (s) => s.endpoint !== value.endpoint,
      );
      if (d.subscriptions.length >= 20)
        throw Error("Notification device limit reached.");
      d.subscriptions.push({ ...value, owner });
    });
  }
  async send(value) {
    await this.edit(async (d) => {
      const keep = [];
      for (const s of d.subscriptions) {
        try {
          await push.sendNotification(s, JSON.stringify(value), {
            vapidDetails: {
              subject: "https://github.com/treverbarney/ai-lab",
              publicKey: d.keys.publicKey,
              privateKey: d.keys.privateKey,
            },
            TTL: 3600,
            timeout: 5000,
          });
          keep.push(s);
        } catch (e) {
          if (![404, 410].includes(e.statusCode)) keep.push(s);
        }
      }
      d.subscriptions = keep;
    });
  }
  remove(owner) {
    return this.edit((d) => {
      d.subscriptions = d.subscriptions.filter((s) => s.owner !== owner);
    });
  }
  clear() {
    return this.edit((d) => {
      d.subscriptions = [];
    });
  }
}
module.exports = { Notices };
