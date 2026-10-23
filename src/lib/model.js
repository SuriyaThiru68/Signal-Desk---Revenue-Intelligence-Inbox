import analyses from "../data/analyses.js";
import taxonomy from "../data/taxonomy.js";

export const APP_VERSION = 1;
export const STORAGE_KEY = "signal-desk-state-v1";
export const DAY = "2026-08-21";
export const TIMEZONE = "Asia/Kolkata";
export const ROUTES = taxonomy.routes;
export const ROUTE_BY_ID = Object.fromEntries(ROUTES.map((route) => [route.id, route]));
export const ROUTE_IDS = ROUTES.map((route) => route.id);
export const ANALYSES = analyses;

export const REVIEW_STATES = {
  needs_review: { label: "Needs review", tone: "amber" },
  in_review: { label: "In review", tone: "blue" },
  needs_evidence: { label: "Needs evidence", tone: "rose" },
  approved: { label: "Reviewed", tone: "green" },
  no_text: { label: "Intake logged", tone: "muted" },
  needs_capture: { label: "Capture gap", tone: "violet" }
};

export const OPEN_REVIEW_STATES = ["needs_review", "in_review", "needs_evidence", "needs_capture"];

export const DEFAULT_RULES = {
  deal_follow_up: { owner: "Account executive", slaHours: 4 },
  sales_coaching: { owner: "Sales manager", slaHours: 24 },
  customer_support: { owner: "Support lead", slaHours: 2 },
  onboarding: { owner: "Onboarding specialist", slaHours: 24 },
  partner: { owner: "Partnerships lead", slaHours: 48 },
  vendor_procurement: { owner: "Finance operations", slaHours: 48 },
  internal_ops: { owner: "Operations lead", slaHours: 24 },
  no_opportunity: { owner: "Account executive", slaHours: 72 },
  intake: { owner: "Revenue operations", slaHours: 8 }
};

export function rulesFor(state) {
  const saved = state?.settings?.rules || {};
  return ROUTE_IDS.reduce((acc, id) => {
    acc[id] = {
      ...DEFAULT_RULES[id],
      ...(saved[id] || {})
    };
    return acc;
  }, {});
}

export function updateRules(state, routeId, patch) {
  if (!ROUTE_BY_ID[routeId]) return state;
  const current = rulesFor(state);
  return {
    ...state,
    settings: {
      ...(state.settings || {}),
      rules: {
        ...current,
        [routeId]: { ...current[routeId], ...patch }
      },
      updatedAt: new Date().toISOString()
    }
  };
}

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});
const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  hour12: false
});
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric"
});
const longDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

export function recordKey(record) {
  return `${record.source_type}:${record.source_id}`;
}

export function sourceTimestamp(record) {
  return record.source_type === "call" ? record.payload.started_at : record.payload.starts_at;
}

export function sourceHash(record) {
  return JSON.stringify({ payload: record.payload, transcript_payload: record.transcript_payload });
}

export function formatTime(value) {
  return timeFormatter.format(new Date(value));
}

export function formatDate(value) {
  return dateFormatter.format(new Date(value));
}

export function formatLongDate(value) {
  return longDateFormatter.format(new Date(value));
}

export function istHour(value) {
  return Number(hourFormatter.format(new Date(value)));
}

export function formatHour(hour) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export function meetingTurns(record) {
  if (!record || record.source_type !== "meeting") return [];
  return Array.isArray(record.transcript_payload?.turns) ? record.transcript_payload.turns : [];
}

export function usableTurnCount(record) {
  return meetingTurns(record).filter((turn) => String(turn.text || "").trim().length > 0).length;
}

export function hasUsableText(record) {
  if (!record) return false;
  if (record.source_type === "call") {
    return Boolean(String(record.payload?.transcript || "").trim());
  }
  return usableTurnCount(record) > 0;
}

export function textStatus(record) {
  return hasUsableText(record) ? "usable" : "none";
}

export function textStatusLabel(record) {
  if (hasUsableText(record)) return "Usable text";
  if (record.source_type === "call") return "No supplied text";
  const payload = record.payload;
  if (payload.has_transcript === false) return "Transcript unavailable";
  if (payload.recording_status === "cancelled") return "Notetaker cancelled";
  if (payload.recording_status === "not_scheduled") return "No notetaker";
  if (String(record.transcript_payload?.unavailable_reason || "").toLowerCase().includes("later")) {
    return "Late transcript";
  }
  return "No usable speech";
}

export function captureReason(record) {
  if (hasUsableText(record)) return null;
  if (record.source_type === "call") {
    return "No call transcript was supplied in this package. The stored outcome is source metadata, not a conversation.";
  }
  return record.transcript_payload?.unavailable_reason || record.payload?.recording_detail || "No usable transcript supplied.";
}

export function organiserLabel(email) {
  if (!email) return "Unknown organiser";
  const match = String(email).match(/^team(\d+)@example\.com$/i);
  if (match) return `Team ${match[1].padStart(2, "0")}`;
  if (email === "arun@example.com") return "Arun";
  return email;
}

export function personInfo(record) {
  if (record.source_type === "call") {
    const name = record.payload.rep_name || "Unknown rep";
    return {
      key: `rep:${name}`,
      name,
      role: "Call rep",
      detail: record.payload.rep_email || "Caller account not supplied",
      kind: "rep"
    };
  }
  const email = record.payload.organizer_email || "";
  return {
    key: `org:${email || "unknown"}`,
    name: organiserLabel(email),
    role: "Meeting organiser",
    detail: email || "Organiser not supplied",
    kind: "organiser"
  };
}

export function recordTitle(record) {
  if (!record) return "";
  if (record.source_type === "call") {
    const direction = record.payload.direction ? `${capitalise(record.payload.direction)} call` : "Call";
    return `${direction} · ${record.payload.observed_outcome || "Outcome not supplied"}`;
  }
  return record.payload.title || "Untitled meeting";
}

export function recordSubtitle(record) {
  if (!record) return "";
  if (record.source_type === "call") {
    const parts = [record.payload.rep_name || "Unknown rep"];
    if (record.payload.duration_seconds != null) parts.push(formatDuration(record.payload.duration_seconds));
    parts.push(record.payload.direction || "direction not supplied");
    return parts.join(" · ");
  }
  const parts = [record.payload.provider || "meeting"];
  if (record.payload.recording_status) parts.push(record.payload.recording_status.replaceAll("_", " "));
  if (record.payload.attendee_count != null) parts.push(`${record.payload.attendee_count} attendee${record.payload.attendee_count === 1 ? "" : "s"} reported`);
  return parts.join(" · ");
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "Duration not supplied";
  const value = Number(seconds);
  const minutes = Math.floor(value / 60);
  const remaining = Math.round(value % 60);
  if (minutes < 1) return `${remaining}s`;
  return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
}

export function capitalise(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function analysisFor(recordState) {
  if (!recordState) return null;
  const analysis = ANALYSES[recordState.record.source_id];
  if (!analysis) return null;
  if (analysis.sourceRevision > recordState.appliedRevision) return null;
  return analysis;
}

export function analysisFreshness(recordState) {
  const analysis = analysisFor(recordState);
  if (!analysis) return "not_available";
  if (analysis.sourceRevision < recordState.appliedRevision) return "stale";
  return "current";
}

export function freshnessLabel(recordState) {
  const freshness = analysisFreshness(recordState);
  if (freshness === "stale") return "Stale — new source revision";
  if (freshness === "current") return "Reflects current source revision";
  return "No generated analysis";
}

export function suggestedRoutesFor(recordState) {
  if (!recordState) return [];
  if (!hasUsableText(recordState.record)) return ["intake"];
  return analysisFor(recordState)?.suggestedRoutes || ["intake"];
}

export function effectiveRoutes(recordState) {
  if (!recordState) return [];
  return recordState.manualRoutes || suggestedRoutesFor(recordState);
}

export function isManualOverride(recordState) {
  return Array.isArray(recordState?.manualRoutes);
}

export function defaultReviewState(record) {
  if (hasUsableText(record)) return "needs_review";
  if (record.source_type === "meeting") {
    const reason = String(record.transcript_payload?.unavailable_reason || "").toLowerCase();
    if (record.payload.has_transcript === false) return "needs_capture";
    if (reason.includes("not included") || reason.includes("later assessment")) return "needs_capture";
  }
  return "no_text";
}

export function buildRecordState(record, revision, previous = null, now = new Date().toISOString()) {
  const suggested = !hasUsableText(record)
    ? ["intake"]
    : ANALYSES[record.source_id]?.suggestedRoutes || ["intake"];
  const sourceChanged = Boolean(previous && previous.sourceHash !== sourceHash(record));

  let reviewState = previous?.reviewState || defaultReviewState(record);
  if (sourceChanged) {
    reviewState = hasUsableText(record) ? "needs_review" : defaultReviewState(record);
  }

  return {
    record,
    appliedRevision: revision,
    sourceHash: sourceHash(record),
    addedAt: previous?.addedAt || now,
    updatedAt: now,
    lastSourceChangeAt: sourceChanged ? now : previous?.lastSourceChangeAt || now,
    suggestedRoutes: suggested,
    manualRoutes: previous?.manualRoutes || null,
    manualNote: previous?.manualNote || "",
    manualUpdatedAt: previous?.manualUpdatedAt || null,
    routeHistory: previous?.routeHistory || [],
    reviewState,
    reviewUpdatedAt: previous?.reviewUpdatedAt || null,
    analysisSeenRevision: hasUsableText(record)
      ? ANALYSES[record.source_id]?.sourceRevision || null
      : null
  };
}

export function emptyState() {
  const now = new Date().toISOString();
  return {
    version: APP_VERSION,
    createdAt: now,
    updatedAt: now,
    records: {},
    importLog: []
  };
}

export function validateBatch(batch) {
  if (!batch || typeof batch !== "object") throw new Error("The file is not a JSON delivery envelope.");
  if (typeof batch.batch_id !== "string" || !batch.batch_id.trim()) throw new Error("Missing batch_id.");
  if (!Number.isInteger(batch.revision)) throw new Error("Missing or invalid revision; it must be an integer.");
  if (!Array.isArray(batch.records)) throw new Error("Missing records array.");
  batch.records.forEach((record, index) => {
    const label = `Record ${index + 1}`;
    if (!record || typeof record !== "object") throw new Error(`${label} is not an object.`);
    if (record.source_type !== "call" && record.source_type !== "meeting") {
      throw new Error(`${label} has an unsupported source_type.`);
    }
    if (typeof record.source_id !== "string" || !record.source_id) throw new Error(`${label} is missing source_id.`);
    if (record.payload?.id && record.payload.id !== record.source_id) {
      throw new Error(`${label} payload.id does not match source_id.`);
    }
    if (!record.payload || typeof record.payload !== "object") throw new Error(`${label} is missing payload.`);
  });
  return true;
}

export function importBatch(state, batch, sourceName = "Uploaded delivery") {
  validateBatch(batch);
  const now = new Date().toISOString();
  const nextRecords = { ...state.records };
  let added = 0;
  let updated = 0;
  let ignored = 0;
  const ignoredReasons = new Set();

  for (const record of batch.records) {
    const key = recordKey(record);
    const existing = nextRecords[key];
    if (!existing) {
      nextRecords[key] = buildRecordState(record, batch.revision, null, now);
      added += 1;
      continue;
    }
    if (batch.revision > existing.appliedRevision) {
      nextRecords[key] = buildRecordState(record, batch.revision, existing, now);
      updated += 1;
      continue;
    }
    ignored += 1;
    ignoredReasons.add(
      batch.revision === existing.appliedRevision
        ? "same revision (duplicate identity)"
        : "older revision"
    );
  }

  const log = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: now,
    batchId: batch.batch_id,
    revision: batch.revision,
    sourceName,
    received: batch.records.length,
    added,
    updated,
    ignored,
    ignoredReason: [...ignoredReasons].join("; ") || null,
    uniqueAfter: Object.keys(nextRecords).length
  };

  return {
    state: {
      ...state,
      updatedAt: now,
      records: nextRecords,
      importLog: [log, ...(state.importLog || [])].slice(0, 60)
    },
    log
  };
}

export function shuffleSeeded(items, seed = 17) {
  const copy = [...items];
  let value = seed;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    value = (value * 1103515245 + 12345) % 2147483648;
    const swap = value % (index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function createDemoState(initialBatch, updateBatch) {
  let state = emptyState();
  state = importBatch(state, initialBatch, "Built-in initial delivery").state;
  state = importBatch(state, updateBatch, "Built-in update delivery").state;
  return state;
}

export function routesLabel(routes) {
  if (!routes?.length) return "Unrouted";
  return routes.map((route) => ROUTE_BY_ID[route]?.label || route).join(" + ");
}

export function setManualRoutes(state, key, routes, note = "") {
  const current = state.records[key];
  if (!current) return state;
  const now = new Date().toISOString();
  const previous = effectiveRoutes(current);
  const nextRoutes = [...new Set(routes)].filter((route) => ROUTE_BY_ID[route]);
  if (!nextRoutes.length) return state;
  const entry = {
    at: now,
    routes: nextRoutes,
    previousRoutes: previous,
    note,
    action: "manual-correction"
  };
  return {
    ...state,
    updatedAt: now,
    records: {
      ...state.records,
      [key]: {
        ...current,
        manualRoutes: nextRoutes,
        manualNote: note,
        manualUpdatedAt: now,
        routeHistory: [entry, ...(current.routeHistory || [])].slice(0, 30)
      }
    }
  };
}

export function resetManualRoutes(state, key, note = "Reset to the automated suggestion") {
  const current = state.records[key];
  if (!current) return state;
  const now = new Date().toISOString();
  const entry = {
    at: now,
    routes: suggestedRoutesFor(current),
    previousRoutes: effectiveRoutes(current),
    note,
    action: "reset-to-suggestion"
  };
  return {
    ...state,
    updatedAt: now,
    records: {
      ...state.records,
      [key]: {
        ...current,
        manualRoutes: null,
        manualNote: "",
        manualUpdatedAt: null,
        routeHistory: [entry, ...(current.routeHistory || [])].slice(0, 30)
      }
    }
  };
}

export function setReviewState(state, key, reviewState) {
  const current = state.records[key];
  if (!current || !REVIEW_STATES[reviewState]) return state;
  const now = new Date().toISOString();
  const entry =
    current.reviewState === reviewState
      ? null
      : {
          at: now,
          review: reviewState,
          previousReview: current.reviewState,
          note: `Review state set to ${REVIEW_STATES[reviewState].label}`
        };
  return {
    ...state,
    updatedAt: now,
    records: {
      ...state.records,
      [key]: {
        ...current,
        reviewState,
        reviewUpdatedAt: now,
        reviewHistory: entry
          ? [entry, ...(current.reviewHistory || [])].slice(0, 30)
          : current.reviewHistory || []
      }
    }
  };
}

export function filterRecordStates(recordStates, filters = {}) {
  const { sourceType = "all", person = "all", route = "all", search = "" } = filters;
  const query = search.trim().toLowerCase();
  return recordStates.filter((recordState) => {
    const record = recordState.record;
    if (sourceType !== "all" && record.source_type !== sourceType) return false;
    if (person !== "all" && personInfo(record).key !== person) return false;
    if (route !== "all" && !effectiveRoutes(recordState).includes(route)) return false;
    if (query) {
      const haystack = [
        record.record_ref,
        record.source_id,
        recordTitle(record),
        personInfo(record).name,
        personInfo(record).detail,
        routesLabel(effectiveRoutes(recordState)),
        record.source_type
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function personOptions(recordStates) {
  const map = new Map();
  for (const recordState of recordStates) {
    const person = personInfo(recordState.record);
    if (!map.has(person.key)) {
      map.set(person.key, { ...person, total: 0, calls: 0, meetings: 0, text: 0 });
    }
    const entry = map.get(person.key);
    entry.total += 1;
    if (recordState.record.source_type === "call") entry.calls += 1;
    else entry.meetings += 1;
    if (hasUsableText(recordState.record)) entry.text += 1;
  }
  return [...map.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "rep" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function computeMetrics(recordStates) {
  const total = recordStates.length;
  const calls = recordStates.filter((item) => item.record.source_type === "call");
  const meetings = recordStates.filter((item) => item.record.source_type === "meeting");
  const textRecords = recordStates.filter((item) => hasUsableText(item.record));
  const callText = calls.filter((item) => hasUsableText(item.record));
  const meetingText = meetings.filter((item) => hasUsableText(item.record));

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: formatHour(hour),
    calls: 0,
    meetings: 0,
    total: 0
  }));
  for (const recordState of recordStates) {
    const hour = istHour(sourceTimestamp(recordState.record));
    hours[hour][recordState.record.source_type === "call" ? "calls" : "meetings"] += 1;
    hours[hour].total += 1;
  }

  const reviewCounts = Object.fromEntries(Object.keys(REVIEW_STATES).map((state) => [state, 0]));
  for (const recordState of recordStates) {
    reviewCounts[recordState.reviewState] = (reviewCounts[recordState.reviewState] || 0) + 1;
  }
  const openReviews = recordStates.filter((item) => OPEN_REVIEW_STATES.includes(item.reviewState)).length;

  const routeCounts = Object.fromEntries(ROUTE_IDS.map((route) => [route, 0]));
  let routeAssignments = 0;
  let multiRoute = 0;
  let manualOverrides = 0;
  let routedRecords = 0;
  for (const recordState of recordStates) {
    const routes = effectiveRoutes(recordState);
    if (routes.length) routedRecords += 1;
    if (routes.length > 1) multiRoute += 1;
    if (isManualOverride(recordState)) manualOverrides += 1;
    for (const route of routes) {
      routeCounts[route] = (routeCounts[route] || 0) + 1;
      routeAssignments += 1;
    }
  }

  const peopleMap = new Map();
  for (const recordState of recordStates) {
    const person = personInfo(recordState.record);
    if (!peopleMap.has(person.key)) {
      peopleMap.set(person.key, {
        ...person,
        total: 0,
        calls: 0,
        meetings: 0,
        text: 0,
        open: 0,
        routes: 0
      });
    }
    const entry = peopleMap.get(person.key);
    entry.total += 1;
    if (recordState.record.source_type === "call") entry.calls += 1;
    else entry.meetings += 1;
    if (hasUsableText(recordState.record)) entry.text += 1;
    if (OPEN_REVIEW_STATES.includes(recordState.reviewState)) entry.open += 1;
    entry.routes += effectiveRoutes(recordState).length;
  }
  const people = [...peopleMap.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const connectedKnown = calls.filter((item) => item.record.payload.is_connected !== null);
  const connectedTrue = connectedKnown.filter((item) => item.record.payload.is_connected === true);
  const connectedUnknown = calls.length - connectedKnown.length;
  const conversationTrue = calls.filter((item) => item.record.payload.is_conversation === true);

  const outcomes = {};
  for (const recordState of calls) {
    const outcome = recordState.record.payload.observed_outcome || "not supplied";
    outcomes[outcome] = (outcomes[outcome] || 0) + 1;
  }

  return {
    total,
    calls: calls.length,
    meetings: meetings.length,
    text: textRecords.length,
    callText: callText.length,
    meetingText: meetingText.length,
    coverage: total ? textRecords.length / total : 0,
    callCoverage: calls.length ? callText.length / calls.length : 0,
    meetingCoverage: meetings.length ? meetingText.length / meetings.length : 0,
    noText: total - textRecords.length,
    reviewCounts,
    openReviews,
    routeCounts,
    routeAssignments,
    routedRecords,
    multiRoute,
    manualOverrides,
    people,
    hours,
    connectedKnown: connectedKnown.length,
    connectedTrue: connectedTrue.length,
    connectedUnknown,
    connectionRate: connectedKnown.length ? connectedTrue.length / connectedKnown.length : null,
    conversationTrue: conversationTrue.length,
    outcomes,
    approved: reviewCounts.approved || 0,
    captureGaps: reviewCounts.needs_capture || 0,
    intakeLogged: reviewCounts.no_text || 0
  };
}

export function allRecordStates(state) {
  return Object.entries(state.records).map(([key, recordState]) => ({ key, ...recordState }));
}

export function findRecordState(state, key) {
  if (!state.records[key]) return null;
  return { key, ...state.records[key] };
}

export function findRecordByRef(state, ref) {
  return allRecordStates(state).find((item) => item.record.record_ref === ref) || null;
}

export function progressSteps(state) {
  const logs = state.importLog || [];
  const hasInitial = logs.some((log) => log.revision === 1);
  const hasUpdate = logs.some((log) => log.revision === 2);
  const duplicateInitial = logs.some((log) => log.revision === 1 && log.ignored > 0);
  const m07 = findRecordByRef(state, "M07");
  return [
    {
      id: "initial",
      label: "Initial batch loaded",
      detail: "Revision 1 creates the 44 identities.",
      done: hasInitial
    },
    {
      id: "repeat",
      label: "Initial batch repeated",
      detail: "Same revision produces ignored duplicates, not new records.",
      done: duplicateInitial
    },
    {
      id: "update",
      label: "Update applied",
      detail: "Revision 2 replaces M07 and supplies the 18th transcript.",
      done: hasUpdate
    },
    {
      id: "manual",
      label: "M07 route corrected",
      detail: "A manual route is saved separately from the source record.",
      done: Boolean(m07 && isManualOverride(m07))
    },
    {
      id: "preserved",
      label: "Correction preserved after update",
      detail: "M07 still has a manual route and its current transcript.",
      done: Boolean(
        m07 &&
          isManualOverride(m07) &&
          m07.appliedRevision === 2 &&
          hasUsableText(m07.record)
      )
    }
  ];
}
