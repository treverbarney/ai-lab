const fs = require("node:fs");
const fsp = require("node:fs/promises");
const readline = require("node:readline");
const path = require("node:path");
async function prepareTraining(root, input) {
  if (!root) throw new Error("Connect your Dino repository first.");
  if (path.extname(input).toLowerCase() !== ".jsonl")
    throw new Error("Choose a JSONL file containing text records.");
  const stream = fs.createReadStream(input, {
    encoding: "utf8",
    highWaterMark: 16384,
  });
  let bytes = 0;
  stream.on("data", (chunk) => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 4 * 1024 * 1024)
      stream.destroy(
        new Error(
          "The first 32 records must fit within 4 MB for this diagnostic profile.",
        ),
      );
  });
  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
  const records = [];
  try {
    for await (const line of lines) {
      if (line.length > 65536)
        throw new Error("A record is too large for the tiny CPU profile.");
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      if (typeof record.text !== "string")
        throw new Error(
          "Each JSONL record needs a text string for pretraining.",
        );
      records.push(JSON.stringify({ text: record.text.slice(0, 2048) }));
      if (records.length === 32) break;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  if (!records.length) throw new Error("The dataset contains no text records.");
  const destination = path.join(root, ".dino", "training");
  await fsp.mkdir(destination, { recursive: true });
  await fsp.writeFile(
    path.join(destination, "input.jsonl"),
    records.join("\n") + "\n",
  );
  return {
    records: records.length,
    profile: "CPU · 64 hidden · 2 layers · 128 tokens · 1 epoch",
  };
}
module.exports = { prepareTraining };
