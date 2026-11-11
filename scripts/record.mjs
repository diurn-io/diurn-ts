// Re-record the responses the tests replay, from a running API server:
//
//   node scripts/record.mjs http://127.0.0.1:8099
//
// The requests are the ones in test/fixtures/index.json (path and query →
// file), the same set diurn-rs records; add a line there to record another.

import fs from "node:fs";
import path from "node:path";

const base = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!base) {
  console.error("usage: node scripts/record.mjs <api url>");
  process.exit(2);
}
const dir = path.join(path.dirname(path.dirname(new URL(import.meta.url).pathname)), "test/fixtures");
const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
for (const [request, file] of Object.entries(index)) {
  const response = await fetch(base + request);
  if (!response.ok) {
    console.error(`${request}: ${response.status}`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(dir, file), JSON.stringify(await response.json(), null, 2) + "\n");
  console.log(`recorded ${request}`);
}
