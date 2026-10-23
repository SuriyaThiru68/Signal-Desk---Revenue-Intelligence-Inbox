import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { allRecordStates, createDemoState, setManualRoutes } from "../src/lib/model.js";
import { buildExport } from "../src/lib/exportCore.js";

const initial = JSON.parse(fs.readFileSync("data/01_initial.json", "utf8"));
const update = JSON.parse(fs.readFileSync("data/02_update.json", "utf8"));

const generatedAt = new Date("2026-08-22T11:00:00+05:30").toISOString();

async function writeArchive(directory, state, label) {
  const { files, manifest } = buildExport(state, generatedAt);
  const target = path.resolve(directory);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  for (const file of files) {
    const destination = path.join(target, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, file.content, "utf8");
  }

  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.content);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(`${target}.zip`, buffer);

  console.log(`${label}: ${files.length} files → ${target} (+ ${path.basename(target)}.zip)`);
  console.log(
    `  Manifest: ${manifest.totals.unique_source_records} records, ${manifest.totals.route_assignments} route assignments, ${manifest.totals.usable_supplied_texts} usable texts, ${manifest.totals.manually_corrected_records} manual overrides`
  );
  return manifest;
}

const state = createDemoState(initial, update);
const m07 = allRecordStates(state).find((item) => item.record.record_ref === "M07");
if (!m07) throw new Error("M07 is missing from the demo state.");

await writeArchive("exports", state, "Post-update export");

const replayState = setManualRoutes(
  state,
  m07.key,
  ["customer_support"],
  "Replay demo: manager set M07 to Customer support only; the manual decision is preserved across the revision-2 source update."
);
await writeArchive("exports-replay-demo", replayState, "Replay-demo export");
