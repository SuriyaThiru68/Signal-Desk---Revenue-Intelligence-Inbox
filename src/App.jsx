import React, { useEffect, useMemo, useRef, useState } from "react";
import initialBatch from "./data/initial-batch.js";
import updateBatch from "./data/update-batch.js";
import {
  REVIEW_STATES,
  allRecordStates,
  analysisFor,
  analysisFreshness,
  captureReason,
  computeMetrics,
  createDemoState,
  effectiveRoutes,
  emptyState,
  filterRecordStates,
  findRecordByRef,
  findRecordState,
  formatDate,
  formatDuration,
  formatLongDate,
  formatTime,
  freshnessLabel,
  hasUsableText,
  importBatch,
  isManualOverride,
  meetingTurns,
  personInfo,
  personOptions,
  progressSteps,
  recordSubtitle,
  recordTitle,
  resetManualRoutes,
  routesLabel,
  setManualRoutes,
  setReviewState,
  shuffleSeeded,
  sourceTimestamp,
  suggestedRoutesFor,
  textStatusLabel
} from "./lib/model.js";
import { buildExport, manifestCsv } from "./lib/exportCore.js";
import brief from "./data/brief.js";
import taxonomy from "./data/taxonomy.js";
import {
  aiDisclosure,
  findings,
  limitations,
  metricDefinitions,
  rejectedDecision,
  routingPrinciples
} from "./data/notes.js";

const NAV_ITEMS = [
  { id: "dashboard", label: "Overview", kicker: "Today" },
  { id: "inbox", label: "Conversation inbox", kicker: "Source records" },
  { id: "brief", label: "Manager brief", kicker: "Fixed snapshot" },
  { id: "exports", label: "Exports", kicker: "Archive" },
  { id: "import", label: "Imports & replay", kicker: "Test the contract" },
  { id: "method", label: "Method & evidence", kicker: "Decisions" }
];

const REVIEW_TONE = {
  needs_review: "warn",
  in_review: "info",
  needs_evidence: "danger",
  approved: "success",
  no_text: "muted",
  needs_capture: "violet"
};

function Pill({ tone = "neutral", children, title }) {
  return (
    <span className={`pill pill-${tone}`} title={title}>
      {children}
    </span>
  );
}

function reviewLabel(value) {
  return REVIEW_STATES[value]?.label || String(value || "Unclassified").replaceAll("_", " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, quotes = [] }) {
  const matches = [...new Set(quotes.filter((quote) => quote && String(text).includes(quote)))].sort(
    (a, b) => b.length - a.length
  );
  if (!matches.length) return text;
  const pattern = new RegExp(`(${matches.map(escapeRegExp).join("|")})`, "g");
  return String(text)
    .split(pattern)
    .map((part, index) => (matches.includes(part) ? <mark key={index}>{part}</mark> : <React.Fragment key={index}>{part}</React.Fragment>));
}

function PageHeader({ kicker, title, description, actions, meta }) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        <span className="eyebrow">{kicker}</span>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

function FilterBar({ filters, onChange, onClear, people, total, filteredCount, showSearch = false }) {
  const active = filters.sourceType !== "all" || filters.person !== "all" || filters.route !== "all" || Boolean(filters.search);
  return (
    <section className="filter-bar" aria-label="Record filters">
      <div className="filter-fields">
        <label className="filter-field">
          <span>Source type</span>
          <select value={filters.sourceType} onChange={(event) => onChange({ sourceType: event.target.value })}>
            <option value="all">All types</option>
            <option value="call">Calls</option>
            <option value="meeting">Meetings</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Person</span>
          <select value={filters.person} onChange={(event) => onChange({ person: event.target.value })}>
            <option value="all">All people</option>
            {people.map((person) => (
              <option key={person.key} value={person.key}>
                {person.name} · {person.role}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Route</span>
          <select value={filters.route} onChange={(event) => onChange({ route: event.target.value })}>
            <option value="all">All routes</option>
            {taxonomy.routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.label}
              </option>
            ))}
          </select>
        </label>
        {showSearch && (
          <label className="filter-field filter-search">
            <span>Search</span>
            <input
              type="search"
              value={filters.search}
              placeholder="Ref, title, person, route…"
              onChange={(event) => onChange({ search: event.target.value })}
            />
          </label>
        )}
      </div>
      <div className="filter-summary">
        <span>
          Showing <strong>{filteredCount}</strong> of <strong>{total}</strong> selected records
        </span>
        {active && (
          <button type="button" className="text-button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}

function KpiCard({ label, value, detail, definition, tone = "default" }) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-detail">{detail}</span>
      <details className="definition">
        <summary>How it is counted</summary>
        <p>{definition}</p>
      </details>
    </article>
  );
}

function RouteChips({ active, onToggle }) {
  return (
    <div className="route-editor" role="group" aria-label="Route decisions">
      {taxonomy.routes.map((route) => {
        const selected = active.includes(route.id);
        return (
          <button
            key={route.id}
            type="button"
            className={`route-chip ${selected ? "route-chip-active" : ""} ${route.id === "intake" ? "route-chip-intake" : ""}`}
            aria-pressed={selected}
            title={`${route.description} Folder: routes/${route.folder}/`}
            onClick={() => onToggle(route.id)}
          >
            <span className="route-chip-dot" aria-hidden="true" />
            {route.label}
          </button>
        );
      })}
    </div>
  );
}

function PriorityCard({ priority, index, state, onOpen }) {
  const recordState = findRecordByRef(state, priority.ref);
  const routes = recordState ? effectiveRoutes(recordState) : [];
  const review = recordState?.reviewState || "needs_review";
  return (
    <article className="priority-card">
      <div className="priority-top">
        <span className="index-chip">{String(index + 1).padStart(2, "0")}</span>
        <span className="priority-ref">{priority.ref}</span>
        <Pill tone={REVIEW_TONE[review] || "neutral"}>{reviewLabel(review)}</Pill>
      </div>
      <h3>{priority.title}</h3>
      <p className="clamp-3">{priority.body}</p>
      <div className="priority-footer">
        <div className="priority-routes">
          {routes.map((route) => (
            <span key={route} className="route-mini">
              {taxonomy.routes.find((item) => item.id === route)?.short || route}
            </span>
          ))}
        </div>
        <button type="button" className="text-button" onClick={() => onOpen(priority.ref)}>
          Inspect {priority.ref} →
        </button>
      </div>
      <p className="fine">Evidence: {priority.evidence}</p>
    </article>
  );
}

function EmptyState({ title, body, action }) {
  return (
    <section className="empty-state card">
      <span className="empty-mark" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}

function Overview({ state, metrics, total, filters, onFilters, onClearFilters, people, onOpenRecord, onOpenInbox }) {
  const activeHours = metrics.hours.filter((hour) => hour.total > 0);
  const maxHour = Math.max(1, ...activeHours.map((hour) => hour.total));
  const maxRoute = Math.max(1, ...Object.values(metrics.routeCounts));
  const coverage = metrics.total ? Math.round((metrics.text / metrics.total) * 100) : 0;
  const allDay = new Date("2026-08-21T12:00:00+05:30");

  return (
    <div className="view-stack">
      <PageHeader
        kicker="Manager overview · 21 August 2026 · Asia/Kolkata"
        title="What needs attention today"
        description="A triage surface built from 44 selected source records. Activity alone is not performance: missing text, source-reported outcomes and organiser details stay visibly separate."
        meta={
          <>
            <Pill tone="success">Post-update state</Pill>
            <Pill tone="info">Revisions 1–2</Pill>
            <Pill tone="muted">All timestamps IST</Pill>
          </>
        }
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => onOpenInbox({})}>
            Open conversation inbox →
          </button>
        }
      />

      <FilterBar
        filters={filters}
        onChange={onFilters}
        onClear={onClearFilters}
        people={people}
        total={total}
        filteredCount={metrics.total}
      />

      <section className="priority-section">
        <div className="section-label-row">
          <div>
            <span className="eyebrow">Fixed brief priorities</span>
            <h2>Today&apos;s three follow-up decisions</h2>
          </div>
          <span className="small-note">The brief is fixed to this date and does not react to filters.</span>
        </div>
        <div className="priority-grid">
          {brief.priorities.map((priority, index) => (
            <PriorityCard
              key={priority.ref}
              priority={priority}
              index={index}
              state={state}
              onOpen={() => {
                const recordState = findRecordByRef(state, priority.ref);
                if (recordState) onOpenRecord(recordState.key);
              }}
            />
          ))}
        </div>
      </section>

      <section className="kpi-grid" aria-label="Headline metrics">
        <KpiCard
          label="Unique source records"
          value={metrics.total}
          detail={`${metrics.calls} calls · ${metrics.meetings} meetings`}
          definition="Distinct (source_type, source_id) identities after applying revisions. A repeated delivery does not add a record. This is the denominator for the other counts on this screen."
        />
        <KpiCard
          label="Usable supplied text"
          value={`${metrics.text}/${metrics.total}`}
          detail={`${coverage}% coverage · Calls ${metrics.callText}/${metrics.calls} · Meetings ${metrics.meetingText}/${metrics.meetings}`}
          definition="A call counts when its supplied transcript has non-blank text. A meeting counts when at least one turn has non-blank text. A recording flag alone does not count as usable text."
        />
        <KpiCard
          label="Route assignments"
          value={metrics.routeAssignments}
          detail={`${metrics.routedRecords} routed records · ${metrics.multiRoute} multi-route · ${metrics.manualOverrides} manual`}
          definition="The sum of active destinations over selected records. One conversation can produce several outputs, so assignments can exceed the record count. Manual decisions replace the suggestion for that record."
        />
        <KpiCard
          label="Open review work"
          value={metrics.openReviews}
          detail={`${metrics.approved} reviewed · ${metrics.captureGaps} capture gaps · ${metrics.intakeLogged} intake logged`}
          definition="Selected records in Needs review, In review, Needs evidence or Capture gap. Reviewed and Intake logged are excluded. Every one of the 44 records has a review state."
        />
      </section>

      <div className="grid-two-one">
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Activity by day and hour</span>
              <h2>Selected records on the source day</h2>
              <p className="small-note">A date filter alone is not enough: all supplied activity falls on one local date.</p>
            </div>
            <Pill tone="muted">All times IST</Pill>
          </div>
          <div className="day-banner">
            <div>
              <span className="eyebrow">Day</span>
              <strong>{formatLongDate(allDay)}</strong>
            </div>
            <div className="day-count">
              <strong>{metrics.total}</strong>
              <span>selected records</span>
            </div>
          </div>
          {activeHours.length ? (
            <div className="hour-chart">
              {activeHours.map((hour) => (
                <div key={hour.hour} className="hour-row">
                  <span className="hour-label">{hour.label}</span>
                  <div className="hour-track">
                    <span className="hour-fill" style={{ width: `${Math.max(3, (hour.total / maxHour) * 100)}%` }} />
                  </div>
                  <span className="hour-total">
                    {hour.total}
                    <small>
                      {hour.calls}c · {hour.meetings}m
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No records match the current filters.</p>
          )}
          <p className="fine">Bars use source start times, not conversation duration or outcome. The 18 usable texts are a subset of these selected records.</p>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">People</span>
              <h2>Call reps vs meeting organizers</h2>
              <p className="small-note">Click a person to view their source records.</p>
            </div>
          </div>
          <div className="person-list">
            {metrics.people.length ? (
              metrics.people.map((person) => (
                <button
                  key={person.key}
                  type="button"
                  className="person-row"
                  onClick={() => onOpenInbox({ person: person.key })}
                >
                  <span className={`person-avatar ${person.kind}`}>{person.name.slice(0, 2).toUpperCase()}</span>
                  <span className="person-copy">
                    <span className="person-name">{person.name}</span>
                    <span className="person-role">{person.role} · {person.detail}</span>
                  </span>
                  <span className="person-stats">
                    <strong>{person.total}</strong>
                    <span>{person.calls}c · {person.meetings}m · {person.text} text</span>
                  </span>
                  <span className="person-open">{person.open} open</span>
                </button>
              ))
            ) : (
              <p className="muted">No people match the current filters.</p>
            )}
          </div>
          <p className="fine">Meeting attribution uses organizer_email only. An organiser is not assumed to be the salesperson or an attendee; call reps use rep_name.</p>
        </section>
      </div>

      <div className="grid-two-one">
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Destination mix</span>
              <h2>Routing counts</h2>
              <p className="small-note">Select a route to view its assigned records.</p>
            </div>
            <Pill tone="muted">{metrics.routeAssignments} assignments</Pill>
          </div>
          <div className="route-list">
            {taxonomy.routes.map((route) => {
              const count = metrics.routeCounts[route.id] || 0;
              return (
                <button
                  key={route.id}
                  type="button"
                  className="route-row"
                  onClick={() => onOpenInbox({ route: route.id })}
                  title={route.description}
                >
                  <span className={`route-marker tone-${route.tone}`} aria-hidden="true" />
                  <span className="route-copy">
                    <strong>{route.label}</strong>
                    <span>{route.description}</span>
                  </span>
                  <span className="route-bar">
                    <span style={{ width: `${Math.max(count ? 6 : 0, (count / maxRoute) * 100)}%` }} />
                  </span>
                  <span className="route-count">{count}</span>
                </button>
              );
            })}
          </div>
          <p className="fine">A route assignment is not a deal, outcome or performance signal. Records with no usable text are held in Intake rather than given a content-based route.</p>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Review state</span>
              <h2>Every record has a state</h2>
              <p className="small-note">States are stored separately from the source payload.</p>
            </div>
          </div>
          <div className="review-stack" aria-label="Review state distribution">
            {Object.entries(REVIEW_STATES).map(([key, meta]) => {
              const count = metrics.reviewCounts[key] || 0;
              return count ? (
                <span
                  key={key}
                  className={`review-segment review-${key}`}
                  style={{ width: `${(count / Math.max(1, metrics.total)) * 100}%` }}
                  title={`${meta.label}: ${count}`}
                />
              ) : null;
            })}
          </div>
          <div className="review-list">
            {Object.entries(REVIEW_STATES).map(([key, meta]) => (
              <div key={key} className="review-row">
                <span className={`review-dot review-${key}`} aria-hidden="true" />
                <span>{meta.label}</span>
                <strong>{metrics.reviewCounts[key] || 0}</strong>
              </div>
            ))}
          </div>
          <div className="mini-stats">
            <div>
              <span>Connected</span>
              <strong>{metrics.connectedTrue}/{metrics.connectedKnown}</strong>
              <small>{metrics.connectedUnknown} unknown · source-reported</small>
            </div>
            <div>
              <span>Substantive</span>
              <strong>{metrics.conversationTrue}</strong>
              <small>source is_conversation=true</small>
            </div>
          </div>
          <p className="fine">Connection is a source-reported flag, not a transcript-verified measure. Coverage, routing and review counts all use the current filter denominator shown above.</p>
        </section>
      </div>
    </div>
  );
}

function Inbox({ filtered, filters, onFilters, onClearFilters, people, total, onOpenRecord, onOpenInbox }) {
  const sorted = [...filtered].sort((a, b) => new Date(sourceTimestamp(a.record)) - new Date(sourceTimestamp(b.record)));
  return (
    <div className="view-stack">
      <PageHeader
        kicker="Conversation inbox · source evidence first"
        title={`All source records (${filtered.length}/${total})`}
        description="Every record keeps its own identity. Open a row to inspect evidence, correct a route, set a review state or read the source transcript."
        meta={
          <>
            <Pill tone="info">Click a route to filter</Pill>
            <Pill tone="muted">No records are merged</Pill>
          </>
        }
      />
      <FilterBar
        filters={filters}
        onChange={onFilters}
        onClear={onClearFilters}
        people={people}
        total={total}
        filteredCount={filtered.length}
        showSearch
      />
      <section className="card card-flush">
        <div className="table-scroll">
          <div className="inbox-table">
            <div className="inbox-head" aria-hidden="true">
              <span>Ref</span>
              <span>Conversation</span>
              <span>Person</span>
              <span>Routes / decision</span>
              <span>State</span>
            </div>
            {sorted.map((recordState) => {
              const record = recordState.record;
              const person = personInfo(record);
              const routes = effectiveRoutes(recordState);
              const manual = isManualOverride(recordState);
              return (
                <button
                  key={recordState.key}
                  type="button"
                  className="inbox-row"
                  onClick={() => onOpenRecord(recordState.key)}
                >
                  <span className="ref-cell">
                    <strong>{record.record_ref}</strong>
                    <span>{record.source_type}</span>
                  </span>
                  <span className="conversation-cell">
                    <span className="row-title">{recordTitle(record)}</span>
                    <span className="row-sub">
                      {recordSubtitle(record)} · {formatTime(sourceTimestamp(record))} IST
                    </span>
                    <span className="row-status">
                      <span className={`status-dot ${hasUsableText(record) ? "has-text" : "no-text"}`} />
                      {textStatusLabel(record)} · rev {recordState.appliedRevision}
                    </span>
                  </span>
                  <span className="person-cell">
                    <span className="row-title">{person.name}</span>
                    <span className="row-sub">{person.role}</span>
                  </span>
                  <span className="route-cell">
                    <span className="route-inline">
                      {routes.map((route) => (
                        <span key={route} className="route-mini">
                          {taxonomy.routes.find((item) => item.id === route)?.short || route}
                        </span>
                      ))}
                    </span>
                    <span className="row-sub">{manual ? "Manual correction" : "Automated suggestion"}</span>
                  </span>
                  <span className="state-cell">
                    <Pill tone={REVIEW_TONE[recordState.reviewState] || "neutral"}>{reviewLabel(recordState.reviewState)}</Pill>
                    <span className="row-sub">{analysisFreshness(recordState) === "stale" ? "Stale analysis" : analysisFreshness(recordState) === "current" ? "Analysis current" : "No analysis"}</span>
                  </span>
                  <span className="row-arrow" aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
        </div>
        {!sorted.length && (
          <div className="empty-inline">
            <strong>No records match these filters.</strong>
            <button type="button" className="text-button" onClick={onClearFilters}>Clear filters</button>
          </div>
        )}
      </section>
      <p className="fine">Person attribution is role-specific: call rep from rep_name; meeting organiser from organizer_email. Organiser identity does not establish attendance or sales ownership.</p>
    </div>
  );
}

function DetailPanel({ recordState, onSetRoutes, onResetRoutes, onSetReview, onOpenInbox, onNotice }) {
  if (!recordState) {
    return (
      <EmptyState
        title="Select a record"
        body="Open any source record to inspect its evidence, route decision and review state."
        action={<button type="button" className="btn" onClick={() => onOpenInbox({})}>Open conversation inbox</button>}
      />
    );
  }

  const record = recordState.record;
  const analysis = analysisFor(recordState);
  const routes = effectiveRoutes(recordState);
  const suggested = suggestedRoutesFor(recordState);
  const person = personInfo(record);
  const manual = isManualOverride(recordState);
  const freshness = analysisFreshness(recordState);
  const turns = meetingTurns(record);
  const quotes = analysis?.evidence?.map((item) => item.quote) || [];
  const activeReasons = routes
    .map((routeId) => ({ routeId, reason: analysis?.routeReasons?.[routeId] }))
    .filter((item) => item.reason);

  function toggleRoute(routeId) {
    const next = routes.includes(routeId) ? routes.filter((id) => id !== routeId) : [...routes, routeId];
    if (!next.length) {
      onNotice("A record needs at least one destination. Add another route before removing the last.", "warn");
      return;
    }
    onSetRoutes(next, manual ? `Manually updated from ${routesLabel(routes)}` : `Manually corrected from ${routesLabel(suggested)}`);
    onNotice("Manual route saved. It will survive a source update and a refresh.", "success");
  }

  function viewPassage(item) {
    const id = item.turn ? `turn-${item.turn}` : "source-excerpt";
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("passage-flash");
    window.setTimeout(() => element.classList.remove("passage-flash"), 1800);
  }

  return (
    <div className="view-stack">
      <button type="button" className="back-link" onClick={() => onOpenInbox({})}>← Back to conversation inbox</button>

      <section className="record-hero card">
        <div className="record-hero-copy">
          <div className="hero-kicker-row">
            <span className="eyebrow">{record.source_type} · {record.record_ref}</span>
            <Pill tone={hasUsableText(record) ? "success" : "warn"}>{textStatusLabel(record)}</Pill>
            <Pill tone={manual ? "warn" : "info"}>{manual ? "Manual route" : "Automated suggestion"}</Pill>
            {recordState.appliedRevision > 1 && <Pill tone="violet">Source revision {recordState.appliedRevision} received</Pill>}
          </div>
          <h1>{recordTitle(record)}</h1>
          <p className="record-subtitle">
            {recordSubtitle(record)} · {person.name} ({person.role}) · {formatTime(sourceTimestamp(record))} IST · {formatDate(sourceTimestamp(record))}
          </p>
          <div className="hero-pills">
            <Pill>{routesLabel(routes)}</Pill>
            <Pill tone={REVIEW_TONE[recordState.reviewState] || "neutral"}>{reviewLabel(recordState.reviewState)}</Pill>
            <Pill tone={freshness === "stale" ? "danger" : freshness === "current" ? "success" : "muted"}>{freshnessLabel(recordState)}</Pill>
          </div>
        </div>
      </section>

      <div className="detail-layout">
        <main className="detail-main">
          {hasUsableText(record) && analysis ? (
            <>
              <section className="card analysis-card">
                <div className="card-head">
                  <div>
                    <span className="eyebrow">Evidence-backed analysis</span>
                    <h2>{analysis.headline}</h2>
                    <p className="small-note">
                      Confidence {analysis.confidence} · Analysis {analysis.analysisVersion} · Reviews source revision {analysis.sourceRevision}
                    </p>
                  </div>
                  <Pill tone={freshness === "stale" ? "danger" : "success"}>{freshnessLabel(recordState)}</Pill>
                </div>
                {freshness === "stale" && (
                  <div className="callout callout-danger">
                    This analysis is older than the applied source revision. It is shown as stale and should not be treated as current.
                  </div>
                )}
                <div className="analysis-grid">
                  <div>
                    <h3>What happened</h3>
                    <p>{analysis.summary}</p>
                  </div>
                  <div>
                    <h3>Why it matters</h3>
                    <p>{analysis.whyItMatters}</p>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-head">
                  <div>
                    <span className="eyebrow">Traceable evidence</span>
                    <h2>Passages that support the conclusion</h2>
                    <p className="small-note">Meeting passages use turn numbers; call passages quote the supplied transcript.</p>
                  </div>
                  <Pill tone="muted">{analysis.evidence.length} passages</Pill>
                </div>
                <div className="evidence-list">
                  {analysis.evidence.map((item, index) => (
                    <article key={index} className="evidence-card">
                      <div className="evidence-top">
                        <Pill tone="info">{record.source_type === "meeting" ? `Turn ${item.turn}` : "Call passage"}</Pill>
                        <button type="button" className="text-button" onClick={() => viewPassage(item)}>
                          View in source ↓
                        </button>
                      </div>
                      <blockquote>“{item.quote}”</blockquote>
                      {item.note && <p className="fine">{item.note}</p>}
                    </article>
                  ))}
                </div>
              </section>

              <div className="split-cards">
                <section className="card">
                  <div className="card-head">
                    <div>
                      <span className="eyebrow">Evidence boundary</span>
                      <h2>What this does not establish</h2>
                    </div>
                  </div>
                  <ul className="clean-list">
                    {(analysis.notEstablished || []).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section className="card">
                  <div className="card-head">
                    <div>
                      <span className="eyebrow">Suggested next steps</span>
                      <h2>Actions and stated ownership</h2>
                    </div>
                  </div>
                  <div className="step-list">
                    {(analysis.nextSteps || []).map((step, index) => (
                      <div key={index} className="step-item">
                        <span className="index-chip">{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <strong>{step.action}</strong>
                          <p className="fine">Owner: {step.owner}</p>
                          {step.ownerBasis && <p className="fine">Basis: {step.ownerBasis}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {analysis.coaching?.length > 0 && (
                <section className="card">
                  <div className="card-head">
                    <div>
                      <span className="eyebrow">Coaching</span>
                      <h2>What should change next time</h2>
                    </div>
                  </div>
                  <ul className="clean-list">
                    {analysis.coaching.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <section className="card">
              <div className="card-head">
                <div>
                  <span className="eyebrow">Intake / no usable text</span>
                  <h2>No substantive analysis was generated</h2>
                </div>
                <Pill tone="warn">{reviewLabel(recordState.reviewState)}</Pill>
              </div>
              <div className="callout callout-warn">
                <strong>{textStatusLabel(record)}</strong>
                <p>{captureReason(record)}</p>
                <p>The source metadata is inspectable, but it is not conversation evidence. This record cannot receive a generic summary or an evidence-based route recommendation.</p>
              </div>
              {hasUsableText(record) && (
                <div className="callout callout-danger">
                  The current source has usable text but no analysis for revision {recordState.appliedRevision}. This needs human-assisted analysis; an older analysis is not displayed as current.
                </div>
              )}
            </section>
          )}

          <section className="card" id="source-excerpt">
            <div className="card-head">
              <div>
                <span className="eyebrow">Source excerpt</span>
                <h2>{record.source_type === "meeting" ? "Meeting transcript" : "Call transcript"}</h2>
                <p className="small-note">The transcript is shown as supplied. Evidence quotes are highlighted where they appear.</p>
              </div>
              <Pill tone="muted">
                {record.source_type === "meeting" ? `${turns.length} turns` : hasUsableText(record) ? "Supplied text" : "No supplied text"}
              </Pill>
            </div>
            {record.source_type === "meeting" ? (
              turns.length ? (
                <div className="transcript">
                  {turns.map((turn, index) => (
                    <article key={index} id={`turn-${index + 1}`} className="turn">
                      <div className="turn-header">
                        <span>Turn {index + 1} · {turn.speaker}</span>
                        <span>{turn.timecode}</span>
                      </div>
                      <p><HighlightedText text={turn.text} quotes={quotes} /></p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">No meeting turns were supplied for this record. That is a capture gap, not evidence that the meeting did not happen.</p>
              )
            ) : (
              <div className="call-text">
                {record.payload.transcript ? <HighlightedText text={record.payload.transcript} quotes={quotes} /> : "No call transcript was supplied for this record."}
              </div>
            )}
          </section>
        </main>

        <aside className="detail-side">
          <section className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Decision</span>
                <h2>Routes</h2>
              </div>
              <Pill tone={manual ? "warn" : "info"}>{manual ? "Manual" : "Suggested"}</Pill>
            </div>
            <p className="small-note">Click a route to add or remove it. The change saves immediately as a manual decision, separate from the automated suggestion.</p>
            <RouteChips active={routes} onToggle={toggleRoute} />
            <div className="meta-rows">
              <div>
                <span>Suggested</span>
                <strong>{routesLabel(suggested)}</strong>
              </div>
              <div>
                <span>Source revision</span>
                <strong>{recordState.appliedRevision}</strong>
              </div>
              <div>
                <span>Analysis</span>
                <strong>{freshnessLabel(recordState)}</strong>
              </div>
            </div>
            {activeReasons.length > 0 && (
              <details className="definition">
                <summary>Why these routes?</summary>
                <div className="reason-list">
                  {activeReasons.map((item) => (
                    <div key={item.routeId}>
                      <strong>{taxonomy.routes.find((route) => route.id === item.routeId)?.label}</strong>
                      <p>{item.reason}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {manual && (
              <>
                <p className="fine">Manual note: {recordState.manualNote || "No note supplied."}</p>
                <button type="button" className="btn btn-ghost btn-small" onClick={onResetRoutes}>
                  Reset to suggestion
                </button>
              </>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Triage</span>
                <h2>Review state</h2>
              </div>
              <Pill tone={REVIEW_TONE[recordState.reviewState] || "neutral"}>{reviewLabel(recordState.reviewState)}</Pill>
            </div>
            <div className="review-options">
              {Object.entries(REVIEW_STATES).map(([value, meta]) => (
                <button
                  key={value}
                  type="button"
                  className={`route-chip ${recordState.reviewState === value ? "route-chip-active" : ""}`}
                  onClick={() => {
                    onSetReview(value);
                    onNotice(`Review state set to ${meta.label}.`, "success");
                  }}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <p className="fine">Review state is stored separately from the source payload and persists across updates.</p>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Audit</span>
                <h2>Correction history</h2>
              </div>
            </div>
            {recordState.routeHistory?.length ? (
              <div className="audit-list">
                {recordState.routeHistory.map((entry, index) => (
                  <div key={index} className="audit-row">
                    <strong>{entry.action.replaceAll("-", " ")}</strong>
                    <span className="fine">{formatDate(entry.at)} · {formatTime(entry.at)} IST</span>
                    <span className="fine">Previous: {routesLabel(entry.previousRoutes)}</span>
                    <span className="fine">Now: {routesLabel(entry.routes)}</span>
                    {entry.note && <span className="fine">{entry.note}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No manual corrections yet.</p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Record metadata</span>
                <h2>Source details</h2>
              </div>
            </div>
            <dl className="meta-list">
              <div><dt>Record reference</dt><dd>{record.record_ref}</dd></div>
              <div><dt>Source type</dt><dd>{record.source_type}</dd></div>
              <div><dt>Source ID</dt><dd><code>{record.source_id}</code></dd></div>
              <div><dt>Applied revision</dt><dd>{recordState.appliedRevision}</dd></div>
              <div><dt>Start time</dt><dd>{formatTime(sourceTimestamp(record))} IST · {formatDate(sourceTimestamp(record))}</dd></div>
              <div><dt>Person</dt><dd>{person.name} · {person.role}</dd></div>
              <div><dt>Duration</dt><dd>{formatDuration(record.payload.duration_seconds)}</dd></div>
              {record.source_type === "call" ? (
                <>
                  <div><dt>Caller</dt><dd>{record.payload.rep_email || "Not supplied"}</dd></div>
                  <div><dt>Direction</dt><dd>{record.payload.direction || "Not supplied"}</dd></div>
                  <div><dt>Source-reported outcome</dt><dd>{record.payload.observed_outcome || "Not supplied"}</dd></div>
                  <div><dt>Connected / conversation</dt><dd>{String(record.payload.is_connected)} / {String(record.payload.is_conversation)}</dd></div>
                </>
              ) : (
                <>
                  <div><dt>Meeting title</dt><dd>{record.payload.title || "Not supplied"}</dd></div>
                  <div><dt>Recording status</dt><dd>{record.payload.recording_status || "Not supplied"}</dd></div>
                  <div><dt>Has transcript flag</dt><dd>{String(record.payload.has_transcript)}</dd></div>
                  <div><dt>Attendee count</dt><dd>{record.payload.attendee_count ?? "Not supplied"}</dd></div>
                </>
              )}
            </dl>
            <p className="fine">Identity is (source_type, source_id). Names, record_ref and array positions are never used as identity.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ManagerBrief({ state, overall, onOpenRecord }) {
  const recordCount = allRecordStates(state).length;
  const usable = allRecordStates(state).filter((item) => hasUsableText(item.record)).length;
  return (
    <div className="view-stack">
      <PageHeader
        kicker={`${brief.date} · ${brief.timezone}`}
        title={brief.label}
        description="A fixed manager brief covering all 18 supplied conversations after the update. It does not react to dashboard filters."
        meta={
          <>
            <Pill tone="success">Fixed snapshot</Pill>
            <Pill tone="info">{usable}/18 supplied texts reviewed</Pill>
            <Pill tone="muted">{recordCount} source records considered</Pill>
          </>
        }
      />
      <div className="brief-hero card">
        <div className="brief-hero-copy">
          <span className="eyebrow">Manager summary</span>
          <h2>Read the evidence, not just the outcome flag</h2>
          <p>{brief.summary}</p>
          <p className="fine">{brief.status}</p>
        </div>
        <div className="brief-hero-stats">
          <div><strong>{recordCount}</strong><span>source records</span></div>
          <div><strong>{usable}</strong><span>usable texts</span></div>
          <div><strong>{overall.routeAssignments}</strong><span>route assignments</span></div>
          <div><strong>{overall.manualOverrides}</strong><span>manual corrections</span></div>
        </div>
      </div>

      <section className="brief-priority-grid">
        {brief.priorities.map((priority, index) => {
          const recordState = findRecordByRef(state, priority.ref);
          return (
            <article key={priority.ref} className="card priority-brief-card">
              <div className="priority-top">
                <span className="index-chip">{String(index + 1).padStart(2, "0")}</span>
                <span className="priority-ref">{priority.ref}</span>
                {recordState && <Pill tone={REVIEW_TONE[recordState.reviewState] || "neutral"}>{reviewLabel(recordState.reviewState)}</Pill>}
              </div>
              <h3>{priority.title}</h3>
              <p>{priority.body}</p>
              <p className="fine"><strong>Action:</strong> {priority.action}</p>
              <p className="fine"><strong>Evidence:</strong> {priority.evidence}</p>
              {recordState && (
                <button type="button" className="text-button" onClick={() => onOpenRecord(recordState.key)}>
                  Inspect {priority.ref} evidence →
                </button>
              )}
            </article>
          );
        })}
      </section>

      <div className="grid-two-one">
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Coaching</span>
              <h2>Practical behaviour to change</h2>
            </div>
          </div>
          <div className="brief-list">
            {brief.coaching.map((item) => {
              const recordState = findRecordByRef(state, item.ref);
              return (
                <div key={item.ref} className="brief-list-row">
                  <div className="brief-ref">{item.ref}</div>
                  <div>
                    <strong>{item.point}</strong>
                    <p>{item.detail}</p>
                    <p className="fine">Evidence: {item.evidence}</p>
                    {recordState && (
                      <button type="button" className="text-button" onClick={() => onOpenRecord(recordState.key)}>
                        Open source →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Watchlist</span>
              <h2>Uncertainty and capture gaps</h2>
            </div>
          </div>
          <ul className="clean-list">
            {brief.watchlist.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <p className="fine">{brief.caveat}</p>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Follow-ups and commitments</span>
            <h2>Who owns what, when the source states it</h2>
          </div>
          <Pill tone="muted">No invented deadlines</Pill>
        </div>
        <div className="table-scroll">
          <div className="brief-table">
            <div className="brief-table-head" aria-hidden="true">
              <span>Ref</span><span>Commitment</span><span>Owner</span><span>When</span><span>Risk</span>
            </div>
            {brief.followUps.map((item) => {
              const recordState = findRecordByRef(state, item.ref);
              return (
                <button key={item.ref} type="button" className="brief-table-row" onClick={() => recordState && onOpenRecord(recordState.key)}>
                  <span><strong>{item.ref}</strong></span>
                  <span>{item.commitment}</span>
                  <span>{item.owner}</span>
                  <span>{item.when}</span>
                  <span className="fine">{item.risk}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function ExportTree({ manifest }) {
  const routes = taxonomy.routes.filter((route) => (manifest.totals.route_counts[route.id] || 0) > 0);
  return (
    <div className="file-tree" role="tree" aria-label="Export folder structure">
      <div className="tree-line"><span className="tree-folder">📦</span><strong>signal-desk-export/</strong></div>
      <div className="tree-line indent"><span className="tree-folder">▤</span>manifest.json <span className="tree-note">machine-readable manifest</span></div>
      <div className="tree-line indent"><span className="tree-folder">▤</span>manifest.csv <span className="tree-note">same manifest in CSV</span></div>
      <div className="tree-line indent"><span className="tree-folder">▤</span>README.md <span className="tree-note">structure and review notes</span></div>
      <div className="tree-line indent"><span className="tree-folder">▤</span>ROUTE-INDEX.md <span className="tree-note">human index by destination</span></div>
      <div className="tree-line indent"><span className="tree-folder">▸</span>briefs/ <span className="tree-note">2026-08-21-manager-brief.md</span></div>
      <div className="tree-line indent"><span className="tree-folder">▸</span>records/ <span className="tree-note">{manifest.totals.unique_source_records} canonical source files</span></div>
      <div className="tree-line indent"><span className="tree-folder">▾</span>routes/ <span className="tree-note">{manifest.totals.route_assignments} active destination files</span></div>
      {routes.map((route) => (
        <div key={route.id} className="tree-line indent-2"><span className="tree-folder">▸</span>{route.folder}/ <span className="tree-note">{manifest.totals.route_counts[route.id]} files</span></div>
      ))}
      <div className="tree-line indent"><span className="tree-folder">▸</span>state/ <span className="tree-note">import-log.json</span></div>
    </div>
  );
}

function Exports({ state, exportBundle, onOpenRecord, onDownloadZip, onDownloadManifest, onWriteFolder }) {
  const { files, manifest } = exportBundle;
  const multiRoute = [...manifest.records].sort((a, b) => b.routes.length - a.routes.length)[0];
  return (
    <div className="view-stack">
      <PageHeader
        kicker="Archive and manifest"
        title="A folder another person can follow"
        description="The current state generates one canonical file per source identity and one thin file per active destination. The manifest lists every path and every manual decision."
        meta={
          <>
            <Pill tone="info">{files.length} files generated</Pill>
            <Pill tone="muted">JSON + CSV manifest</Pill>
            <Pill tone="success">Current browser state</Pill>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={onDownloadZip}>Download ZIP</button>
            <button type="button" className="btn btn-ghost" onClick={onWriteFolder}>Write to folder…</button>
          </>
        }
      />

      <div className="kpi-grid kpi-grid-four">
        <KpiCard label="Files in archive" value={files.length} detail={`${manifest.totals.unique_source_records} records + ${manifest.totals.route_assignments} route files + state`} definition="Count of generated files in the current export bundle, including manifests, brief, record files and destination files." />
        <KpiCard label="Canonical records" value={manifest.totals.unique_source_records} detail="One file per (source_type, source_id)" definition="Each record is written once under records/. Route files link back to it rather than duplicating a second identity." />
        <KpiCard label="Route files" value={manifest.totals.route_assignments} detail={`${manifest.totals.records_with_multiple_routes} records have multiple destinations`} definition="Active destination files across all records. A single conversation can appear in more than one folder without becoming more than one record." />
        <KpiCard label="Manual overrides" value={manifest.totals.manually_corrected_records} detail="Preserved in this export" definition="Records whose active route differs from the automated suggestion because a manager corrected it. The manifest records manual_override=true and the note." />
      </div>

      <div className="grid-two-one">
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Structure</span>
              <h2>What the archive contains</h2>
              <p className="small-note">No proposed-only tree: this is generated from the current app state.</p>
            </div>
            <button type="button" className="text-button" onClick={onDownloadZip}>Download ZIP →</button>
          </div>
          <ExportTree manifest={manifest} />
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Multi-route example</span>
              <h2>{multiRoute?.record_ref || "No record"} keeps one source identity</h2>
            </div>
            <Pill tone={multiRoute?.manual_override ? "warn" : "info"}>{multiRoute?.manual_override ? "Manual" : "Suggested"}</Pill>
          </div>
          {multiRoute && (
            <>
              <p className="small-note">{multiRoute.routes.length} active destinations plus one canonical file. Follow the links to read the same context in different work queues.</p>
              <div className="path-list">
                <button type="button" className="path-row" onClick={() => onOpenRecord(multiRoute.record_ref)}>
                  <span className="path-icon">C</span>
                  <code>{multiRoute.record_output_path}</code>
                  <span>canonical</span>
                </button>
                {multiRoute.route_output_paths.map((path) => (
                  <div key={path} className="path-row">
                    <span className="path-icon">R</span>
                    <code>{path}</code>
                    <span>route</span>
                  </div>
                ))}
              </div>
              <p className="fine">Route files carry the shared context key, evidence, destination-specific actions and a link back to the canonical record.</p>
            </>
          )}
          <div className="download-row">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => onDownloadManifest("json")}>manifest.json</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => onDownloadManifest("csv")}>manifest.csv</button>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Manifest preview</span>
            <h2>Every record, route and processing state</h2>
            <p className="small-note">Generated {formatDate(manifest.generated_at)} · {formatTime(manifest.generated_at)} IST. Click a reference to open the record.</p>
          </div>
          <Pill tone="muted">{manifest.records.length} rows</Pill>
        </div>
        <div className="table-scroll">
          <div className="manifest-table">
            <div className="manifest-head" aria-hidden="true">
              <span>Ref</span><span>Type</span><span>Routes</span><span>Processing state</span><span>Manual</span><span>Freshness</span><span>Paths</span>
            </div>
            {manifest.records.map((entry) => (
              <button type="button" key={`${entry.source_type}:${entry.source_id}`} className="manifest-row" onClick={() => onOpenRecord(entry.record_ref)}>
                <span><strong>{entry.record_ref}</strong></span>
                <span>{entry.source_type}</span>
                <span>{entry.route_labels.join(" + ")}</span>
                <span>{reviewLabel(entry.processing_state)}</span>
                <span>{entry.manual_override ? "Yes" : "No"}</span>
                <span>{entry.analysis_freshness}</span>
                <span>{entry.output_paths.length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <p className="fine">The app downloads a ZIP built from the current browser state. The repository also contains a pre-generated post-update snapshot in exports/ and a corrected-route example in exports-replay-demo.zip. The manifest is the source of truth for active paths.</p>
    </div>
  );
}

function Replay({ state, steps, onImportInitial, onRepeatInitial, onCorrectM07, onImportUpdate, onLoadDemo, onReset, onUpload, importInputRef, onDownloadReplayZip }) {
  const records = allRecordStates(state);
  const logs = state.importLog || [];
  const lastInitial = logs.find((log) => log.revision === 1);
  const lastUpdate = logs.find((log) => log.revision === 2);
  const m07 = findRecordByRef(state, "M07");
  const hasM07 = Boolean(m07);
  return (
    <div className="view-stack">
      <PageHeader
        kicker="Imports, late information and corrections"
        title="Reproduce the replay contract"
        description="Run the same public test a reviewer will run: initial import, repeat with a different order, correct a route, apply the update, then refresh or restart and confirm the decision survives."
        meta={
          <>
            <Pill tone="info">{records.length} unique records</Pill>
            <Pill tone="success">{records.filter((item) => hasUsableText(item.record)).length} usable texts</Pill>
            <Pill tone="muted">State in localStorage</Pill>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={onLoadDemo}>Load full demo</button>
            <button type="button" className="btn btn-ghost" onClick={onDownloadReplayZip}>Download current ZIP</button>
          </>
        }
      />

      <div className="replay-grid">
        <section className="card replay-actions-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Step-by-step</span>
              <h2>Run the import checks</h2>
              <p className="small-note">Each action writes an audit log entry with received, added, updated, ignored and unique-after counts.</p>
            </div>
          </div>
          <div className="action-steps">
            <div className="action-step">
              <span className="step-number">1</span>
              <div>
                <strong>Initial import</strong>
                <p className="small-note">Creates 44 identities. Background calls and silent meetings are visible with intake states.</p>
                <button type="button" className="btn btn-ghost btn-small" onClick={onImportInitial}>Import 01_initial.json</button>
              </div>
            </div>
            <div className="action-step">
              <span className="step-number">2</span>
              <div>
                <strong>Repeat the same batch, different order</strong>
                <p className="small-note">Expected: added 0, ignored 44, unique after 44. Array position is not identity.</p>
                <button type="button" className="btn btn-ghost btn-small" onClick={onRepeatInitial}>Repeat shuffled initial</button>
              </div>
            </div>
            <div className="action-step">
              <span className="step-number">3</span>
              <div>
                <strong>Correct M07 manually</strong>
                <p className="small-note">Set M07 to Customer support only. The manual decision is stored separately from the source.</p>
                <button type="button" className="btn btn-ghost btn-small" disabled={!hasM07} onClick={onCorrectM07}>Correct M07 route</button>
              </div>
            </div>
            <div className="action-step">
              <span className="step-number">4</span>
              <div>
                <strong>Apply the update</strong>
                <p className="small-note">Revision 2 replaces M07 and supplies the 18th transcript. The manual route should remain.</p>
                <button type="button" className="btn btn-ghost btn-small" onClick={onImportUpdate}>Import 02_update.json</button>
              </div>
            </div>
            <div className="action-step">
              <span className="step-number">5</span>
              <div>
                <strong>Repeat the initial batch again</strong>
                <p className="small-note">Expected: revision 1 is older than M07&apos;s revision 2, so every record is ignored. Counts do not fall or inflate.</p>
                <button type="button" className="btn btn-ghost btn-small" onClick={onImportInitial}>Import initial again</button>
              </div>
            </div>
          </div>

          <div className="upload-row">
            <label className="file-upload">
              <span>Import another delivery envelope</span>
              <input ref={importInputRef} type="file" accept="application/json,.json" onChange={onUpload} />
            </label>
            <button type="button" className="btn btn-ghost btn-small" onClick={onReset}>Reset to empty state</button>
          </div>
        </section>

        <aside className="replay-side">
          <section className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Current state</span>
                <h2>What is loaded</h2>
              </div>
            </div>
            <div className="mini-stats mini-stats-tall">
              <div><span>Unique records</span><strong>{records.length}</strong><small>identity de-duplicated</small></div>
              <div><span>Usable texts</span><strong>{records.filter((item) => hasUsableText(item.record)).length}</strong><small>after revision 2</small></div>
              <div><span>Manual routes</span><strong>{records.filter((item) => isManualOverride(item)).length}</strong><small>survive updates</small></div>
              <div><span>M07 revision</span><strong>{m07 ? m07.appliedRevision : "—"}</strong><small>{m07 ? textStatusLabel(m07.record) : "not loaded"}</small></div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Duplicate test</span>
                <h2>44 → 44</h2>
              </div>
            </div>
            {lastInitial ? (
              <div className="result-card">
                <strong>Latest initial delivery</strong>
                <div className="result-grid">
                  <span>Received<strong>{lastInitial.received}</strong></span>
                  <span>Added<strong>{lastInitial.added}</strong></span>
                  <span>Ignored<strong>{lastInitial.ignored}</strong></span>
                  <span>Unique after<strong>{lastInitial.uniqueAfter}</strong></span>
                </div>
                <p className="fine">Same revision duplicates are ignored. No count is inflated by a repeat import.</p>
              </div>
            ) : (
              <p className="muted">Import the initial batch to populate this check.</p>
            )}
            {lastUpdate ? (
              <div className="result-card result-update">
                <strong>Latest update delivery</strong>
                <div className="result-grid">
                  <span>Received<strong>{lastUpdate.received}</strong></span>
                  <span>Added<strong>{lastUpdate.added}</strong></span>
                  <span>Updated<strong>{lastUpdate.updated}</strong></span>
                  <span>Unique after<strong>{lastUpdate.uniqueAfter}</strong></span>
                </div>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Preservation</span>
                <h2>M07 across revisions</h2>
              </div>
              {m07 && <Pill tone={isManualOverride(m07) ? "warn" : "info"}>{isManualOverride(m07) ? "Manual route" : "Suggested route"}</Pill>}
            </div>
            {m07 ? (
              <>
                <p className="small-note">{routesLabel(effectiveRoutes(m07))}</p>
                <p className="fine">Revision {m07.appliedRevision} · {textStatusLabel(m07.record)} · {freshnessLabel(m07)}</p>
                <p className="fine">Refresh the page or restart the app after correcting the route. The manual decision is read back from localStorage.</p>
                <button type="button" className="text-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Review the checklist ↑</button>
              </>
            ) : (
              <p className="muted">M07 is not loaded in the current state.</p>
            )}
          </section>
        </aside>
      </div>

      <div className="grid-two-one">
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Checklist</span>
              <h2>Progress through the contract</h2>
            </div>
            <Pill tone="muted">{steps.filter((step) => step.done).length}/{steps.length}</Pill>
          </div>
          <div className="checklist">
            {steps.map((step) => (
              <div key={step.id} className={`check-row ${step.done ? "is-done" : ""}`}>
                <span className="check-mark" aria-hidden="true">{step.done ? "✓" : ""}</span>
                <div><strong>{step.label}</strong><p className="fine">{step.detail}</p></div>
                <Pill tone={step.done ? "success" : "muted"}>{step.done ? "Done" : "Not seen"}</Pill>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Import log</span>
              <h2>Audit trail</h2>
            </div>
            <Pill tone="muted">{logs.length} entries</Pill>
          </div>
          <div className="log-list">
            {logs.length ? logs.map((log) => (
              <div key={log.id} className="log-row">
                <div className="log-top"><strong>{log.batchId}</strong><span className="fine">rev {log.revision}</span></div>
                <span className="fine">{log.sourceName} · {formatDate(log.at)} {formatTime(log.at)}</span>
                <span className="fine">R {log.received} · A {log.added} · U {log.updated} · I {log.ignored} · unique {log.uniqueAfter}</span>
                {log.ignoredReason && <span className="fine">Reason: {log.ignoredReason}</span>}
              </div>
            )) : <p className="muted">No imports logged.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Method() {
  return (
    <div className="view-stack">
      <PageHeader
        kicker="Method, evidence and trade-offs"
        title="How Signal Desk makes its decisions"
        description="This page is the reviewable explanation: metric denominators, routing rules, the three findings, one rejected decision, AI disclosure and the limits of the supplied data."
        meta={
          <>
            <Pill tone="info">89 validated evidence passages</Pill>
            <Pill tone="success">18/18 texts reviewed</Pill>
            <Pill tone="muted">No API keys or live AI</Pill>
          </>
        }
        actions={
          <a className="btn btn-ghost" href="/slides/index.html" target="_blank" rel="noreferrer">Open five slides ↗</a>
        }
      />

      <section className="method-intro card">
        <div>
          <span className="eyebrow">The manager problem</span>
          <h2>Make the next conversation easier to have.</h2>
          <p>This is not a performance scorecard. It is a triage surface: find the few conversations that need a decision, see the passage behind the claim, correct the destination, and leave a trail another person can follow.</p>
        </div>
        <div className="method-principles">
          {routingPrinciples.map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Definitions</span>
            <h2>Every headline number has a denominator</h2>
            <p className="small-note">These are the definitions used by the dashboard and export manifest.</p>
          </div>
        </div>
        <div className="table-scroll">
          <div className="definition-table">
            <div className="definition-head" aria-hidden="true"><span>Metric</span><span>Definition and denominator</span><span>Source</span></div>
            {metricDefinitions.map((item) => (
              <div key={item.metric} className="definition-row">
                <strong>{item.metric}</strong>
                <span>{item.definition}</span>
                <code>{item.source}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Findings</span>
            <h2>Three things the conversations changed</h2>
            <p className="small-note">Each finding links to an exact passage and to the screen, rule or output it affected.</p>
          </div>
        </div>
        <div className="finding-grid">
          {findings.map((finding) => (
            <article key={finding.number} className="finding-card">
              <div className="finding-top"><span className="index-chip">{finding.number}</span><Pill tone="info">{finding.source}</Pill></div>
              <h3>{finding.title}</h3>
              <p>{finding.noticed}</p>
              <blockquote>{finding.quote}</blockquote>
              <p className="fine"><strong>Where it changed the product:</strong> {finding.product}</p>
              <p className="fine"><strong>Check it:</strong> {finding.where}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rejected-card card">
        <div className="rejected-label">Deliberately rejected decision</div>
        <h2>{rejectedDecision.title}</h2>
        <div className="rejected-grid">
          <div><span className="eyebrow">Alternative</span><p>{rejectedDecision.alternative}</p></div>
          <div><span className="eyebrow">Why rejected</span><p>{rejectedDecision.rejected}</p></div>
          <div><span className="eyebrow">Trade-off accepted</span><p>{rejectedDecision.tradeoff}</p></div>
        </div>
        <p className="fine"><strong>Where to see it:</strong> {rejectedDecision.where}</p>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Routing design</span>
            <h2>Nine destinations, one canonical record</h2>
            <p className="small-note">The taxonomy is deliberately small. A route says what kind of work the conversation needs, not what the deal is worth.</p>
          </div>
        </div>
        <div className="route-taxonomy">
          {taxonomy.routes.map((route) => (
            <div key={route.id} className="taxonomy-row">
              <span className={`route-marker tone-${route.tone}`} aria-hidden="true" />
              <div><strong>{route.label}</strong><p>{route.description}</p></div>
              <code>routes/{route.folder}/</code>
            </div>
          ))}
        </div>
      </section>

      <div className="split-cards">
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">AI disclosure</span>
              <h2>Pre-generated analysis, runtime computation</h2>
            </div>
          </div>
          <div className="ai-grid">
            <div><strong>Pre-generated</strong><p>{aiDisclosure.preGenerated}</p></div>
            <div><strong>Computed at runtime</strong><p>{aiDisclosure.runtime}</p></div>
            <div><strong>New source content</strong><p>{aiDisclosure.newContent}</p></div>
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Known limitations</span>
              <h2>What this data cannot support</h2>
            </div>
          </div>
          <ul className="clean-list">
            {limitations.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </section>
      </div>

      <section className="card deliverable-card">
        <div>
          <span className="eyebrow">Deliverables</span>
          <h2>Open the explanation pack</h2>
          <p>Five slides cover the manager problem, interface choices, folder design, verification and trade-offs. The README contains setup, replay instructions and the recording script.</p>
        </div>
        <div className="deliverable-actions">
          <a className="btn" href="/slides/index.html" target="_blank" rel="noreferrer">Five slides</a>
          <a className="btn btn-ghost" href="/recording-script.txt" target="_blank" rel="noreferrer">Recording script</a>
        </div>
      </section>
    </div>
  );
}

function LandingPage({ onEnter }) {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#000000" }}>
      <header style={{ padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", border: "1.5px solid #000000", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="1.5" rx="0.75" fill="black" />
              <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="black" />
              <rect x="2" y="12.5" width="7" height="1.5" rx="0.75" fill="black" />
            </svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-0.01em" }}>Signal Desk</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <a href="#features" style={{ fontSize: "14px", color: "#000000", textDecoration: "none", opacity: 0.7 }}>Features</a>
          <a href="#about" style={{ fontSize: "14px", color: "#000000", textDecoration: "none", opacity: 0.7 }}>About</a>
          <button
            type="button"
            onClick={onEnter}
            style={{
              padding: "8px 18px",
              fontSize: "14px",
              fontWeight: "500",
              background: "#000000",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Open App
          </button>
        </nav>
      </header>
      <main>
        <section style={{ padding: "100px 48px 80px", maxWidth: "1100px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "28px", alignItems: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", background: "#f7f7f7", borderRadius: "100px", fontSize: "13px" }}>
              <span style={{ width: "6px", height: "6px", background: "#000000", borderRadius: "50%" }}></span>
              Revenue Intelligence Platform
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(42px, 7vw, 64px)", fontWeight: "600", letterSpacing: "-0.03em", lineHeight: "1.08", maxWidth: "900px" }}>
              Turn every conversation into actionable revenue insight
            </h1>
            <p style={{ margin: 0, fontSize: "18px", color: "#666666", maxWidth: "680px", lineHeight: "1.8" }}>
              Evidence-first triage that routes signals to the right teams with full context. Make confident decisions backed by traceable conversation evidence.
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={onEnter}
                style={{
                  padding: "12px 28px",
                  fontSize: "15px",
                  fontWeight: "500",
                  background: "#000000",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Get Started
              </button>
              <button
                type="button"
                style={{
                  padding: "12px 28px",
                  fontSize: "15px",
                  fontWeight: "500",
                  background: "#ffffff",
                  color: "#000000",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Learn More
              </button>
            </div>
          </div>
        </section>
        <section id="features" style={{ padding: "80px 48px", background: "#fafafa", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "64px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "36px", fontWeight: "600", letterSpacing: "-0.02em" }}>Built for revenue teams</h2>
              <p style={{ margin: 0, fontSize: "17px", color: "#666666" }}>Everything you need to triage and act on customer conversations</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
              {[
                { title: "Evidence-First", desc: "Every insight linked to exact conversation passages for full traceability." },
                { title: "Smart Routing", desc: "Automatically route signals to sales, support, product, and more." },
                { title: "Decision Tracking", desc: "Track manual overrides and decisions with complete audit history." }
              ].map((item, i) => (
                <div key={i} style={{ padding: "32px", background: "#ffffff", border: "1px solid #f0f0f0", borderRadius: "8px" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: "600" }}>{item.title}</h3>
                  <p style={{ margin: 0, color: "#666666", lineHeight: "1.7" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer style={{ padding: "40px 48px", borderTop: "1px solid #f0f0f0" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#999999" }}>© 2026 Signal Desk. Local-first application.</p>
        </div>
      </footer>
    </div>
  );
}

function AppContent() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem("signal-desk-state-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.records) return parsed;
      }
    } catch (error) {
      console.warn(error);
    }
    return createDemoState(initialBatch, updateBatch);
  });
  const [view, setView] = useState("dashboard");
  const [selectedKey, setSelectedKey] = useState(null);
  const [filters, setFilters] = useState({ sourceType: "all", person: "all", route: "all", search: "" });
  const [notice, setNotice] = useState(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("signal-desk-state-v1", JSON.stringify(state));
    } catch (error) {
      console.warn(error);
    }
  }, [state]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const records = useMemo(() => allRecordStates(state), [state]);
  const overall = useMemo(() => computeMetrics(records), [records]);
  const people = useMemo(() => personOptions(records), [records]);
  const filtered = useMemo(() => filterRecordStates(records, filters), [records, filters]);
  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);
  const steps = useMemo(() => progressSteps(state), [state]);
  const selected = selectedKey ? findRecordState(state, selectedKey) : null;
  const exportBundle = useMemo(() => buildExport(state, new Date().toISOString()), [state]);

  function showNotice(text, tone = "info") {
    setNotice({ text, tone });
  }

  function openRecord(key) {
    setSelectedKey(key);
    setView("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openRecordByRef(ref) {
    const recordState = findRecordByRef(state, ref);
    if (recordState) openRecord(recordState.key);
  }

  function openInbox(patch = {}) {
    setFilters({ ...filters, ...patch });
    setView("inbox");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearFilters() {
    setFilters({ sourceType: "all", person: "all", route: "all", search: "" });
  }

  function handleImportBatch(batch, name) {
    try {
      const result = importBatch(state, batch, name);
      setState(result.state);
      setFilters({ sourceType: "all", person: "all", route: "all", search: "" });
      const log = result.log;
      showNotice(
        `Received ${log.received} · added ${log.added} · updated ${log.updated} · ignored ${log.ignored} · unique after ${log.uniqueAfter}.`,
        log.ignored > 0 ? "warn" : "success"
      );
    } catch (error) {
      showNotice(error.message, "danger");
    }
  }

  function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const batch = JSON.parse(String(reader.result));
        handleImportBatch(batch, `Upload — ${file.name}`);
      } catch (error) {
        showNotice(`Could not read ${file.name}: ${error.message}`, "danger");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleLoadDemo() {
    setState(createDemoState(initialBatch, updateBatch));
    setFilters({ sourceType: "all", person: "all", route: "all", search: "" });
    setSelectedKey(null);
    setView("import");
    showNotice("Loaded the built-in post-update demo: 44 records, 18 usable texts.", "success");
  }

  function handleReset() {
    setState(emptyState());
    setFilters({ sourceType: "all", person: "all", route: "all", search: "" });
    setSelectedKey(null);
    showNotice("State reset to empty. Import the initial batch to start the replay.", "warn");
  }

  function handleCorrectM07() {
    const m07 = findRecordByRef(state, "M07");
    if (!m07) {
      showNotice("Import the initial batch before correcting M07.", "warn");
      return;
    }
    setState(setManualRoutes(state, m07.key, ["customer_support"], "Replay test: manager set M07 to Customer support only."));
    showNotice("M07 route set to Customer support. Import the update and refresh to confirm it survives.", "success");
  }

  function handleDownloadZip() {
    downloadZip(exportBundle.files).then(() => {
      showNotice(`Downloaded ${exportBundle.files.length} files as a ZIP from the current state.`, "success");
    }).catch((error) => showNotice(`ZIP failed: ${error.message}`, "danger"));
  }

  function handleDownloadManifest(format) {
    if (format === "csv") {
      downloadBlob(new Blob([`${manifestCsv(exportBundle.manifest)}\n`], { type: "text/csv;charset=utf-8" }), "manifest.csv");
    } else {
      downloadBlob(new Blob([`${JSON.stringify(exportBundle.manifest, null, 2)}\n`], { type: "application/json" }), "manifest.json");
    }
    showNotice(`Downloaded manifest.${format}.`, "success");
  }

  async function handleWriteFolder() {
    if (!("showDirectoryPicker" in window)) {
      showNotice("This browser cannot write directly to a folder. Use Download ZIP instead.", "warn");
      return;
    }
    try {
      const directory = await window.showDirectoryPicker();
      for (const file of exportBundle.files) {
        const parts = file.path.split("/");
        let current = directory;
        for (let index = 0; index < parts.length - 1; index += 1) {
          current = await current.getDirectoryHandle(parts[index], { create: true });
        }
        const handle = await current.getFileHandle(parts[parts.length - 1], { create: true });
        const writable = await handle.createWritable();
        await writable.write(file.content);
        await writable.close();
      }
      showNotice(`Wrote ${exportBundle.files.length} files to the selected folder.`, "success");
    } catch (error) {
      if (error.name !== "AbortError") showNotice(`Folder export failed: ${error.message}`, "danger");
    }
  }

  const nav = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.id === "inbox" ? records.length : item.id === "import" ? state.importLog?.length || 0 : null
  }));
  const currentNav = nav.find((item) => item.id === view) || nav[0];
  const revisions = [...new Set(records.map((item) => item.appliedRevision))].sort((a, b) => a - b);
  const revisionLabel = revisions.length
    ? revisions.length === 1
      ? `rev ${revisions[0]}`
      : `rev ${revisions[0]}–${revisions[revisions.length - 1]}`
    : "not imported";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => setView("dashboard")} aria-label="Signal Desk overview">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="14" height="2" rx="1" fill="black" />
              <rect x="3" y="9" width="14" height="2" rx="1" fill="black" />
              <rect x="3" y="15" width="8" height="2" rx="1" fill="black" />
            </svg>
          </span>
          <span className="brand-text"><strong>Signal Desk</strong></span>
        </button>

        <nav className="side-nav" aria-label="Workspace">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${view === item.id ? "nav-active" : ""}`}
              onClick={() => { setView(item.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <span className="nav-copy">
                <span className="nav-icon">
                  {item.id === "dashboard" && <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="10" y="2" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="10" y="8" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>}
                  {item.id === "inbox" && <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 5L9 10L16 5M3 3H15C15.5523 3 16 3.44772 16 4V14C16 14.5523 15.5523 15 15 15H3C2.44772 15 2 14.5523 2 14V4C2 3.44772 2.44772 3 3 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {item.id === "brief" && <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L11.09 6.26L16 6.97L12.5 10.14L13.18 15L9 12.77L4.82 15L5.5 10.14L2 6.97L6.91 6.26L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {item.id === "exports" && <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2V12M9 12L5 8M9 12L13 8M3 14H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {item.id === "import" && <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M16 12V14C16 14.5523 15.5523 15 15 15H3C2.44772 15 2 14.5523 2 14V12M12 6L9 3M9 3L6 6M9 3V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {item.id === "method" && <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" /><path d="M9 12V9M9 6H9.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                </span>
                <strong>{item.label}</strong>
              </span>
              {item.badge != null && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-stat">
            <span>Workspace state</span>
            <strong>{records.length} records · {overall.text} usable texts</strong>
            <small>{overall.manualOverrides} manual route{overall.manualOverrides === 1 ? "" : "s"} · {revisionLabel}</small>
          </div>
          <button type="button" className="sidebar-link" onClick={() => setView("import")}>View replay checks →</button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Signal Desk</span>
            <span className="breadcrumb-sep">/</span>
            <strong>{currentNav.label}</strong>
          </div>
          <div className="topbar-actions">
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setView("import")}>Replay checks</button>
            <button type="button" className="btn btn-small" onClick={handleDownloadZip}>Download export</button>
          </div>
        </header>

        <main className="page">
          {notice && (
            <div className={`toast toast-${notice.tone}`} role="status">
              <span>{notice.text}</span>
              <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button>
            </div>
          )}

          {view === "dashboard" && (
            <Overview
              state={state}
              metrics={metrics}
              total={overall.total}
              filters={filters}
              onFilters={(patch) => setFilters({ ...filters, ...patch })}
              onClearFilters={clearFilters}
              people={people}
              onOpenRecord={openRecord}
              onOpenInbox={openInbox}
            />
          )}

          {view === "inbox" && (
            <Inbox
              filtered={filtered}
              filters={filters}
              onFilters={(patch) => setFilters({ ...filters, ...patch })}
              onClearFilters={clearFilters}
              people={people}
              total={overall.total}
              onOpenRecord={openRecord}
              onOpenInbox={openInbox}
            />
          )}

          {view === "detail" && (
            <DetailPanel
              recordState={selected}
              onSetRoutes={(routes, note) => setState(setManualRoutes(state, selectedKey, routes, note))}
              onResetRoutes={() => {
                setState(resetManualRoutes(state, selectedKey));
                showNotice("Route reset to the automated suggestion.", "warn");
              }}
              onSetReview={(review) => setState(setReviewState(state, selectedKey, review))}
              onOpenInbox={openInbox}
              onNotice={showNotice}
            />
          )}

          {view === "brief" && <ManagerBrief state={state} overall={overall} onOpenRecord={openRecord} />}

          {view === "exports" && (
            <Exports
              state={state}
              exportBundle={exportBundle}
              onOpenRecord={openRecordByRef}
              onDownloadZip={handleDownloadZip}
              onDownloadManifest={handleDownloadManifest}
              onWriteFolder={handleWriteFolder}
            />
          )}

          {view === "import" && (
            <Replay
              state={state}
              steps={steps}
              onImportInitial={() => handleImportBatch(initialBatch, "Upload/import — initial batch")}
              onRepeatInitial={() => handleImportBatch({ ...initialBatch, records: shuffleSeeded(initialBatch.records, 42) }, "Upload/import — initial batch (different order)")}
              onCorrectM07={handleCorrectM07}
              onImportUpdate={() => handleImportBatch(updateBatch, "Upload/import — update batch")}
              onLoadDemo={handleLoadDemo}
              onReset={handleReset}
              onUpload={handleUpload}
              importInputRef={importInputRef}
              onDownloadReplayZip={handleDownloadZip}
            />
          )}

          {view === "method" && <Method />}

          <footer className="footer-note">
            <span>Signal Desk · Evidence-first triage · No pipeline value, deal outcome or account link asserted</span>
            <span>{overall.total} unique records · {overall.text} usable texts · {overall.routeAssignments} route assignments</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function downloadZip(files) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.content);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  downloadBlob(blob, "signal-desk-export.zip");
}

export default function App() {
  const [showLanding, setShowLanding] = useState(true);

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  return <AppContent />;
}
