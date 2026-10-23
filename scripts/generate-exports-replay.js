import fs from "node:fs";
import path from "node:path";
import { createDemoState, setManualRoutes } from "../src/lib/model.js";
import { buildExport } from "../src/lib/exportCore.js";

const initial = JSON.parse(fs.readFileSync("data/01_initial.json", "utf8"));
const update = JSON.parse(fs.readFileSync("data/02_update.json", "utf8"));

let state = createDemoState(initial, update);
const m07Key = `meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a`;
state = setManualRoutes(state, m07Key, ["customer_support"], "Replay test: keep support-owned follow-up visible; workaround is not a fix.");
const generatedAt = new Date("2026-08-22T11:15:00+05:30").toISOString();
const { files, manifest } = buildExport(state, generatedAt);

const target = path.resolve("exports-replay-demo");
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

for (const file of files) {
  const destination = path.join(target, file.path);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, file.content, "utf8");
}

console.log(`Wrote ${files.length} export files to ${target}`);
const m07 = manifest.records.find((r) => r.record_ref === "M07");
console.log("M07", m07.manual_override, m07.routes, m07.applied_source_revision);
