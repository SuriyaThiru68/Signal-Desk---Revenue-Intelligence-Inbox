import brief from "../data/brief.js";
import taxonomy from "../data/taxonomy.js";
import {
  ROUTE_BY_ID,
  analysisFor,
  analysisFreshness,
  allRecordStates,
  captureReason,
  effectiveRoutes,
  formatDate,
  formatDuration,
  formatTime,
  hasUsableText,
  isManualOverride,
  meetingTurns,
  personInfo,
  recordSubtitle,
  recordTitle,
  routesLabel,
  sourceTimestamp,
  suggestedRoutesFor,
  textStatusLabel
} from "./model.js";

const ROUTE_ORDER = taxonomy.routes.map((route) => route.id);

function clean(value) {
  return String(value ?? "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .trim();
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : clean(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function outputBaseName(record) {
  return `${record.record_ref}-${record.source_id.slice(0, 8)}`;
}

export function recordPath(record) {
  return `records/${outputBaseName(record)}.md`;
}

export function routePath(record, routeId) {
  const route = ROUTE_BY_ID[routeId];
  return `routes/${route?.folder || slug(routeId)}/${outputBaseName(record)}.md`;
}

function routeReason(recordState, routeId) {
  const analysis = analysisFor(recordState);
  if (routeId === "intake") {
    return hasUsableText(recordState.record)
      ? "No route-specific automated rule fired; a human decision is required."
      : "No usable supplied text. This record is held for intake / capture review rather than substantive analysis.";
  }
  return analysis?.routeReasons?.[routeId] || ROUTE_BY_ID[routeId]?.description || "Route assigned by the review policy.";
}

function metadataRows(recordState) {
  const record = recordState.record;
  const person = personInfo(record);
  const rows = [
    ["Record reference", record.record_ref],
    ["Source type", record.source_type],
    ["Source ID", record.source_id],
    ["Applied source revision", String(recordState.appliedRevision)],
    ["Source time", `${formatTime(sourceTimestamp(record))} · ${formatDate(sourceTimestamp(record))} · Asia/Kolkata`],
    ["Person", `${person.name} (${person.role}; not a verified job title)`],
    ["Duration", formatDuration(record.payload.duration_seconds)],
    ["Usable supplied text", textStatusLabel(record)]
  ];
  if (record.source_type === "call") {
    rows.push(["Direction", record.payload.direction || "not supplied"]);
    rows.push(["Source-reported outcome", record.payload.observed_outcome || "not supplied"]);
    rows.push(["Source-reported connected", String(record.payload.is_connected)]);
    rows.push(["Source-reported conversation", String(record.payload.is_conversation)]);
  } else {
    rows.push(["Title", record.payload.title || "not supplied"]);
    rows.push(["Recording status", record.payload.recording_status || "not supplied"]);
    rows.push(["Organiser", record.payload.organizer_email || "not supplied"]);
    rows.push(["Attendee count (source metadata)", String(record.payload.attendee_count ?? "not supplied")]);
  }
  return rows;
}

function markdownTable(rows) {
  return [`| Field | Value |`, `| --- | --- |`, ...rows.map(([key, value]) => `| ${key} | ${clean(value).replaceAll("|", "\\|")} |`)].join("\n");
}

function evidenceMarkdown(analysis, record) {
  if (!analysis?.evidence?.length) return "_No supported evidence passage._";
  return analysis.evidence
    .map((item) => {
      const reference = record.source_type === "meeting" && item.turn ? `Turn ${item.turn}` : "Call passage";
      return `- **${reference}** — “${clean(item.quote)}”${item.note ? `\n  ${clean(item.note)}` : ""}`;
    })
    .join("\n");
}

function nextStepsMarkdown(analysis) {
  if (!analysis?.nextSteps?.length) return "_No action is asserted from the supplied evidence._";
  return analysis.nextSteps
    .map(
      (step, index) =>
        `${index + 1}. **${clean(step.action)}**  \n   Owner: ${clean(step.owner)}${step.ownerBasis ? `  \n   Ownership basis: ${clean(step.ownerBasis)}` : ""}`
    )
    .join("\n");
}

function listMarkdown(items, fallback = "_None stated._") {
  if (!items?.length) return fallback;
  return items.map((item) => `- ${clean(item)}`).join("\n");
}

function sourceExcerpt(record) {
  if (record.source_type === "call") {
    const text = clean(record.payload.transcript);
    if (!text) return "_No call transcript supplied._";
    return text
      .split(/\n{2,}/)
      .map((paragraph) => `> ${paragraph.replaceAll("\n", " ")}`)
      .join("\n>\n");
  }
  const turns = meetingTurns(record);
  if (!turns.length) return "_No meeting turns supplied._";
  return turns
    .map(
      (turn, index) =>
        `**Turn ${index + 1} | ${clean(turn.timecode) || "time not supplied"} | ${clean(turn.speaker)}**\n\n> ${clean(turn.text)}`
    )
    .join("\n\n");
}

export function buildRecordMarkdown(recordState) {
  const record = recordState.record;
  const analysis = analysisFor(recordState);
  const routes = effectiveRoutes(recordState);
  const freshness = analysisFreshness(recordState);
  const manual = isManualOverride(recordState);
  const lines = [];
  lines.push(`# ${record.record_ref} — ${recordTitle(record)}`);
  lines.push("");
  lines.push(`> Canonical record context. Active routes: ${routesLabel(routes)}.`);
  lines.push("");
  lines.push(markdownTable(metadataRows(recordState)));
  lines.push("");
  lines.push("## Route decision");
  lines.push("");
  lines.push(`- **Active routes:** ${routesLabel(routes)}`);
  lines.push(`- **Decision source:** ${manual ? "Manual correction" : "Automated suggestion"}`);
  lines.push(`- **Suggested routes at this revision:** ${routesLabel(suggestedRoutesFor(recordState))}`);
  lines.push(`- **Analysis freshness:** ${freshness === "current" ? "Reflects current source revision" : freshness === "stale" ? "Stale — source revision is newer" : "No analysis available"}`);
  if (manual) {
    lines.push(`- **Manual note:** ${clean(recordState.manualNote) || "No note supplied."}`);
    lines.push(`- **Corrected at:** ${recordState.manualUpdatedAt || "not supplied"}`);
    lines.push(`- **Manual override preserved across source updates:** yes`);
  }
  lines.push("");
  if (recordState.routeHistory?.length) {
    lines.push("### Correction history");
    lines.push("");
    for (const entry of recordState.routeHistory.slice(0, 8)) {
      lines.push(`- ${entry.at} — ${entry.action} → ${routesLabel(entry.routes)}${entry.note ? ` — ${clean(entry.note)}` : ""}`);
    }
    lines.push("");
  }

  if (!hasUsableText(record)) {
    lines.push("## Intake state");
    lines.push("");
    lines.push("**No substantive conversation analysis was generated.** Missing or silent text is not evidence that a conversation did not happen, and it cannot support a route recommendation based on content.");
    lines.push("");
    lines.push(`Capture reason: ${clean(captureReason(record))}`);
    lines.push("");
    lines.push("### Source-reported metadata only");
    lines.push("");
    lines.push("The fields above are stored source metadata. They have not been verified against conversation text.");
    lines.push("");
    lines.push(`Review state: **${recordState.reviewState}**`);
    return lines.join("\n");
  }

  lines.push("## Analysis");
  lines.push("");
  if (!analysis) {
    lines.push("**No analysis is available for the current source revision.** This record needs human-assisted analysis.");
    lines.push("");
  } else {
    if (freshness === "stale") {
      lines.push("> **Stale analysis:** the source has a newer revision than the analysis below. Do not treat this as current until reviewed.");
      lines.push("");
    }
    lines.push(`### ${clean(analysis.headline)}`);
    lines.push("");
    lines.push(`**Confidence:** ${clean(analysis.confidence)} · **Analysis version:** ${clean(analysis.analysisVersion)} · **Analysis source revision:** ${analysis.sourceRevision}`);
    lines.push("");
    lines.push("#### What happened");
    lines.push("");
    lines.push(clean(analysis.summary));
    lines.push("");
    lines.push("#### Why it matters");
    lines.push("");
    lines.push(clean(analysis.whyItMatters));
    lines.push("");
    lines.push("#### Evidence");
    lines.push("");
    lines.push(evidenceMarkdown(analysis, record));
    lines.push("");
    lines.push("#### What the evidence does not establish");
    lines.push("");
    lines.push(listMarkdown(analysis.notEstablished));
    lines.push("");
    lines.push("#### Next steps and ownership");
    lines.push("");
    lines.push(nextStepsMarkdown(analysis));
    lines.push("");
    if (analysis.coaching?.length) {
      lines.push("#### Coaching notes");
      lines.push("");
      lines.push(listMarkdown(analysis.coaching));
      lines.push("");
    }
  }

  lines.push("## Source excerpt");
  lines.push("");
  lines.push(sourceExcerpt(record));
  lines.push("");
  return lines.join("\n");
}

export function buildRouteMarkdown(recordState, routeId) {
  const record = recordState.record;
  const route = ROUTE_BY_ID[routeId];
  const analysis = analysisFor(recordState);
  const canonical = `../../${recordPath(record)}`;
  const manual = isManualOverride(recordState);
  const lines = [];
  lines.push(`# ${route?.label || routeId} — ${record.record_ref}`);
  lines.push("");
  lines.push(`> **Shared context:** [${record.record_ref} canonical record](${canonical}). This route file is one destination for the same source record; it does not create a second record.`);
  lines.push("");
  lines.push(`- **Destination folder:** \`${route?.folder || slug(routeId)}\``);
  lines.push(`- **Source type:** ${record.source_type}`);
  lines.push(`- **Source ID:** \`${record.source_id}\``);
  lines.push(`- **Applied source revision:** ${recordState.appliedRevision}`);
  lines.push(`- **Route decision:** ${manual ? "Manual correction" : "Automated suggestion"}`);
  lines.push(`- **Review state:** ${recordState.reviewState}`);
  lines.push("");
  lines.push("## Why this route");
  lines.push("");
  lines.push(routeReason(recordState, routeId));
  lines.push("");
  if (manual) {
    lines.push(`**Manual note:** ${clean(recordState.manualNote) || "No note supplied."}`);
    lines.push("");
  }
  if (!hasUsableText(record)) {
    lines.push("## Intake note");
    lines.push("");
    lines.push(clean(captureReason(record)));
    lines.push("");
    lines.push("No substantive analysis is stored for this destination. Do not infer a conversation from missing text.");
    return lines.join("\n");
  }
  if (!analysis) {
    lines.push("## Analysis pending");
    lines.push("");
    lines.push("No analysis is available for the current source revision. A human review is required.");
    return lines.join("\n");
  }
  lines.push("## Context carried into this destination");
  lines.push("");
  lines.push(clean(analysis.summary));
  lines.push("");
  lines.push("## Evidence");
  lines.push("");
  lines.push(evidenceMarkdown(analysis, record));
  lines.push("");
  lines.push("## Actions for this destination");
  lines.push("");
  lines.push(nextStepsMarkdown(analysis));
  lines.push("");
  if (routeId === "sales_coaching" && analysis.coaching?.length) {
    lines.push("## Coaching focus");
    lines.push("");
    lines.push(listMarkdown(analysis.coaching));
    lines.push("");
  }
  lines.push("## Evidence boundary");
  lines.push("");
  lines.push(listMarkdown(analysis.notEstablished));
  lines.push("");
  return lines.join("\n");
}

export function buildManifest(state, generatedAt = new Date().toISOString()) {
  const records = allRecordStates(state).sort((a, b) => a.record.record_ref.localeCompare(b.record.record_ref));
  const entries = records.map((recordState) => {
    const record = recordState.record;
    const routes = effectiveRoutes(recordState);
    const paths = [recordPath(record), ...routes.map((route) => routePath(record, route))];
    const freshness = analysisFreshness(recordState);
    return {
      record_ref: record.record_ref,
      source_type: record.source_type,
      source_id: record.source_id,
      applied_source_revision: recordState.appliedRevision,
      routes,
      route_labels: routes.map((route) => ROUTE_BY_ID[route]?.label || route),
      route_output_paths: routes.map((route) => routePath(record, route)),
      record_output_path: recordPath(record),
      output_paths: [...new Set(paths)],
      processing_state: recordState.reviewState,
      review_state: recordState.reviewState,
      manual_override: isManualOverride(recordState),
      route_decision_source: isManualOverride(recordState) ? "manual" : "suggested",
      manual_override_note: recordState.manualNote || null,
      analysis_freshness: freshness,
      analysis_source_revision: analysisFor(recordState)?.sourceRevision ?? null,
      text_status: hasUsableText(record) ? "usable" : "none",
      last_source_change_at: recordState.lastSourceChangeAt,
      generated_at: generatedAt
    };
  });
  const routeCounts = Object.fromEntries(ROUTE_ORDER.map((route) => [route, entries.filter((entry) => entry.routes.includes(route)).length]));
  return {
    schema: "signal-desk-manifest/v1",
    app: "Signal Desk — Revenue Intelligence Inbox",
    generated_at: generatedAt,
    source_day: brief.date,
    source_timezone: brief.timezone,
    source_revisions_applied: [...new Set(records.map((item) => item.appliedRevision))].sort((a, b) => a - b),
    totals: {
      unique_source_records: entries.length,
      usable_supplied_texts: entries.filter((entry) => entry.text_status === "usable").length,
      route_assignments: entries.reduce((sum, entry) => sum + entry.routes.length, 0),
      manually_corrected_records: entries.filter((entry) => entry.manual_override).length,
      records_with_multiple_routes: entries.filter((entry) => entry.routes.length > 1).length,
      route_counts: routeCounts
    },
    records: entries
  };
}

export function manifestCsv(manifest) {
  const columns = [
    "record_ref",
    "source_type",
    "source_id",
    "applied_source_revision",
    "routes",
    "route_labels",
    "output_paths",
    "processing_state",
    "review_state",
    "manual_override",
    "route_decision_source",
    "manual_override_note",
    "analysis_freshness",
    "analysis_source_revision",
    "text_status",
    "last_source_change_at",
    "generated_at"
  ];
  const rows = [columns.map(csvCell).join(",")];
  for (const entry of manifest.records) {
    rows.push(
      [
        entry.record_ref,
        entry.source_type,
        entry.source_id,
        entry.applied_source_revision,
        entry.routes,
        entry.route_labels,
        entry.output_paths,
        entry.processing_state,
        entry.review_state,
        entry.manual_override,
        entry.route_decision_source,
        entry.manual_override_note || "",
        entry.analysis_freshness,
        entry.analysis_source_revision ?? "",
        entry.text_status,
        entry.last_source_change_at,
        entry.generated_at
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return rows.join("\n");
}

export function buildBriefMarkdown(state, generatedAt = new Date().toISOString()) {
  const records = allRecordStates(state);
  const byRef = new Map(records.map((item) => [item.record.record_ref, item]));
  const usable = records.filter((item) => hasUsableText(item.record)).length;
  const manual = records.filter((item) => isManualOverride(item)).length;
  const assignments = records.reduce((sum, item) => sum + effectiveRoutes(item).length, 0);
  const lines = [];
  lines.push(`# ${brief.label}`);
  lines.push("");
  lines.push(`> ${brief.status}`);
  lines.push("");
  lines.push(`Generated from the current export state at ${generatedAt}. Source day: ${brief.date} (${brief.timezone}).`);
  lines.push("");
  lines.push("## Snapshot");
  lines.push("");
  lines.push(`- Unique source records: **${records.length}**`);
  lines.push(`- Usable supplied texts: **${usable} / ${records.length}**`);
  lines.push(`- Route assignments: **${assignments}** across **${records.length}** unique records`);
  lines.push(`- Manual route corrections in effect: **${manual}**`);
  lines.push("");
  lines.push("## Manager summary");
  lines.push("");
  lines.push(clean(brief.summary));
  lines.push("");
  lines.push("## Priorities");
  lines.push("");
  for (const priority of brief.priorities) {
    const recordState = byRef.get(priority.ref);
    const link = recordState ? `[${priority.ref} record](../${recordPath(recordState.record)})` : priority.ref;
    lines.push(`### ${priority.ref} — ${clean(priority.title)}`);
    lines.push("");
    lines.push(clean(priority.body));
    lines.push("");
    lines.push(`**Action:** ${clean(priority.action)}`);
    lines.push("");
    lines.push(`**Evidence:** ${clean(priority.evidence)} · **Record:** ${link}`);
    lines.push("");
  }
  lines.push("## Coaching");
  lines.push("");
  for (const item of brief.coaching) {
    const recordState = byRef.get(item.ref);
    const link = recordState ? `[${item.ref}](../${recordPath(recordState.record)})` : item.ref;
    lines.push(`### ${item.ref} — ${clean(item.point)}`);
    lines.push("");
    lines.push(clean(item.detail));
    lines.push("");
    lines.push(`Evidence: ${clean(item.evidence)} · ${link}`);
    lines.push("");
  }
  lines.push("## Follow-ups and commitments");
  lines.push("");
  lines.push("| Record | Commitment | Owner | When | Risk |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const item of brief.followUps) {
    lines.push(
      `| [${item.ref}](../${byRef.get(item.ref) ? recordPath(byRef.get(item.ref).record) : ""}) | ${clean(item.commitment).replaceAll("|", "\\|")} | ${clean(item.owner).replaceAll("|", "\\|")} | ${clean(item.when).replaceAll("|", "\\|")} | ${clean(item.risk).replaceAll("|", "\\|")} |`
    );
  }
  lines.push("");
  lines.push("## Watchlist and evidence limits");
  lines.push("");
  lines.push(listMarkdown(brief.watchlist));
  lines.push("");
  lines.push(clean(brief.caveat));
  lines.push("");
  return lines.join("\n");
}

export function buildRouteIndex(state) {
  const records = allRecordStates(state).sort((a, b) => a.record.record_ref.localeCompare(b.record.record_ref));
  const lines = ["# Route index", "", "Each record below links to its canonical context. A record with several routes appears in several destination lists but remains one source identity.", ""];
  for (const route of taxonomy.routes) {
    const matches = records.filter((recordState) => effectiveRoutes(recordState).includes(route.id));
    lines.push(`## ${route.label} (${matches.length})`);
    lines.push("");
    lines.push(route.description);
    lines.push("");
    if (!matches.length) {
      lines.push("_No active records._");
    } else {
      for (const recordState of matches) {
        lines.push(`- [${recordState.record.record_ref} — ${recordTitle(recordState.record)}](../${routePath(recordState.record, route.id)})`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function buildExportReadme(state, manifest) {
  return [
    "# Signal Desk export",
    "",
    `Generated at ${manifest.generated_at} from the current application state.`,
    "",
    "This archive is a clean snapshot, not an append-only pile. It contains one canonical record file per active source identity and one active file per assigned route. A repeated export replaces the previous snapshot; superseded route files are not written as additional active copies.",
    "",
    "## Structure",
    "",
    "```text",
    "manifest.json                  Machine-readable manifest",
    "manifest.csv                   Same manifest in CSV",
    "ROUTE-INDEX.md                 Human index by destination",
    "briefs/2026-08-21-manager-brief.md",
    "records/<ref>-<id>.md          Canonical source context + analysis",
    "routes/<destination>/<ref>-<id>.md",
    "state/import-log.json          Import and revision audit trail",
    "```",
    "",
    "## How multi-route context is preserved",
    "",
    "Every conversation has one canonical file under `records/`. Each active destination gets a thin route file with the shared context key, evidence, actions and a link back to the canonical record. The manifest lists the canonical file and every route file in `output_paths`.",
    "",
    "## Current state",
    "",
    `- Unique records: ${manifest.totals.unique_source_records}`,
    `- Usable supplied texts: ${manifest.totals.usable_supplied_texts}`,
    `- Route assignments: ${manifest.totals.route_assignments}`,
    `- Records with multiple routes: ${manifest.totals.records_with_multiple_routes}`,
    `- Records with manual route corrections: ${manifest.totals.manually_corrected_records}`,
    `- Applied source revisions: ${manifest.source_revisions_applied.join(", ")}`,
    "",
    "## Review before reuse",
    "",
    "- `processing_state` describes the intake/review state at export time.",
    "- `analysis_freshness` distinguishes an analysis that matches the current source revision from a stale one.",
    "- `manual_override=true` means a manager changed the route. It is separate from the automated suggestion and survives source updates.",
    "- Missing text is recorded as `text_status: none`; it is not evidence that no conversation happened and does not receive a substantive analysis.",
    "- No pipeline value or deal outcome is asserted. Conversation-stated amounts are evidence only.",
    ""
  ].join("\n");
}

export function buildExport(state, generatedAt = new Date().toISOString()) {
  const records = allRecordStates(state).sort((a, b) => a.record.record_ref.localeCompare(b.record.record_ref));
  const manifest = buildManifest(state, generatedAt);
  const files = [];

  files.push({ path: "manifest.json", content: `${JSON.stringify(manifest, null, 2)}\n` });
  files.push({ path: "manifest.csv", content: `${manifestCsv(manifest)}\n` });
  files.push({ path: "README.md", content: buildExportReadme(state, manifest) });
  files.push({ path: "ROUTE-INDEX.md", content: buildRouteIndex(state) });
  files.push({ path: `briefs/${brief.date}-manager-brief.md`, content: buildBriefMarkdown(state, generatedAt) });
  files.push({
    path: "state/import-log.json",
    content: `${JSON.stringify({ generated_at: generatedAt, batches: state.importLog || [] }, null, 2)}\n`
  });

  for (const recordState of records) {
    files.push({ path: recordPath(recordState.record), content: buildRecordMarkdown(recordState) });
    for (const route of effectiveRoutes(recordState)) {
      files.push({ path: routePath(recordState.record, route), content: buildRouteMarkdown(recordState, route) });
    }
  }

  return { files, manifest };
}
