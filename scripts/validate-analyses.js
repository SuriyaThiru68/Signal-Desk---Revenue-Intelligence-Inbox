import fs from "node:fs";
import { ANALYSES, ROUTE_IDS, hasUsableText, meetingTurns } from "../src/lib/model.js";

const initial = JSON.parse(fs.readFileSync("data/01_initial.json", "utf8"));
const update = JSON.parse(fs.readFileSync("data/02_update.json", "utf8"));
const records = new Map();
for (const record of [...initial.records, ...update.records]) records.set(record.source_id, record);

let failures = 0;
let checks = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL ${message}`);
}

for (const [sourceId, analysis] of Object.entries(ANALYSES)) {
  const record = records.get(sourceId);
  if (!record) {
    fail(`${analysis.ref}: analysis source ID is not present in either delivery`);
    continue;
  }
  if (analysis.ref !== record.record_ref) fail(`${analysis.ref}: ref mismatch with ${record.record_ref}`);
  if (analysis.sourceRevision !== (record.record_ref === "M07" ? 2 : 1)) {
    fail(`${analysis.ref}: unexpected analysis sourceRevision ${analysis.sourceRevision}`);
  }
  for (const route of analysis.suggestedRoutes) {
    if (!ROUTE_IDS.includes(route)) fail(`${analysis.ref}: unknown route ${route}`);
  }
  for (const route of Object.keys(analysis.routeReasons || {})) {
    if (!ROUTE_IDS.includes(route)) fail(`${analysis.ref}: unknown route reason ${route}`);
  }
  for (const evidence of analysis.evidence) {
    checks += 1;
    if (record.source_type === "call") {
      const text = record.payload.transcript || "";
      if (!text.includes(evidence.quote)) fail(`${analysis.ref}: call quote not found: ${evidence.quote}`);
    } else {
      const turns = meetingTurns(record);
      const turn = turns[(evidence.turn || 0) - 1];
      if (!turn) {
        fail(`${analysis.ref}: turn ${evidence.turn} does not exist`);
      } else if (!turn.text.includes(evidence.quote)) {
        fail(`${analysis.ref}: turn ${evidence.turn} quote not found: ${evidence.quote}`);
      }
    }
  }
}

const usable = [...records.values()].filter(hasUsableText);
if (usable.length !== 18) fail(`expected 18 usable texts after update, found ${usable.length}`);
if (records.size !== 44) fail(`expected 44 unique records, found ${records.size}`);
if (Object.keys(ANALYSES).length !== 18) fail(`expected 18 analyses, found ${Object.keys(ANALYSES).length}`);

console.log(`Validated ${Object.keys(ANALYSES).length} analyses and ${checks} evidence passages against ${records.size} unique source records.`);
if (failures) {
  console.error(`${failures} validation failure(s).`);
  process.exitCode = 1;
} else {
  console.log("All evidence quotes match the supplied source text exactly.");
}
