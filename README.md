# Signal Desk — Revenue Intelligence Inbox

Signal Desk is a revenue-intelligence triage surface built for the Volopay assignment. It converts two supplied JSON deliveries into an evidence-backed manager workflow: conversation analysis, multi-route decisions, human review, a replayable import pipeline, and a file-based export archive with a machine-readable manifest.

The app ships in two layers that work side-by-side:

| Layer | Entry point | Stack |
|---|---|---|
| **Vite + React app** | `src/main.jsx` → `http://localhost:5173` | React 19, Vite 6, JSZip |
| **Standalone UI** | `index.html` → open directly in browser | Vanilla HTML · CSS · JS · Chart.js |

---

## At a glance

| Measure | Value | Definition |
|---|---:|---|
| Unique source records | **44** | Distinct `(source_type, source_id)` pairs after revisions — 30 calls + 14 meetings |
| Usable supplied text | **18 / 44** (41 %) | 10 calls with non-blank transcript + 8 meetings with ≥ 1 non-blank turn |
| Records without usable text | **26** | 20 background calls, 3 silent meetings (M05 / M08 / M11), 3 capture gaps (M12 / M13 / M14) |
| Route assignments | **57** | Destinations across 44 routed records — 13 records have more than one route |
| Open review work | **21** | 18 needs-review + 3 capture gaps after update |
| Conversation analyses | **18** | One per usable supplied text — 17 at revision 1, M07 at revision 2 |
| Validated evidence passages | **89** | Every quote matched against supplied call text or meeting turn by validation script |
| Export files | **107** | 44 canonical records + 57 route files + manifests, brief, route index, import log, README |

The manager brief is fixed to **21 August 2026, Asia / Kolkata** and covers all 18 conversations. It does not react to dashboard filters.

---

## Quick start

```bash
npm install
npm run dev          # Vite dev server → http://localhost:5173
```

Or open `index.html` directly in any browser — no build step needed for the standalone UI.

### Other commands

```bash
npm run build            # Production build → dist/
npm run preview          # Preview the production build on port 4173
npm run validate:data    # Validates all 18 analyses and 89 evidence quotes
npm run generate:exports # Rewrites exports/, exports-replay-demo/ and both ZIPs
npm run sync:data        # Syncs data sources
```

State is persisted in `localStorage` under `signal-desk-state-v1`. A hard refresh does not clear it. Use **Imports & replay → Reset to empty state** to start clean.

---

## Standalone UI — 8 screens

The standalone UI (`index.html` + `styles.css` + `app.js`) covers the full manager workflow. Open `index.html` directly in a browser — no server or build step required.

| # | Screen | Content |
|---|---|---|
| 01 | **Overview** | KPI cards, activity trend chart (Chart.js), routing distribution donut, attention queue |
| 02 | **Conversations** | Source records table, live search, multi-filter (type / person / route / status) |
| 03 | **Review Detail** | Tabbed evidence, transcript with audio scrubber, AI analysis, route reasoning, manual correction, review history |
| 04 | **Imports** | Drag-and-drop CSV / JSON upload, animated 4-step pipeline (Normalize → Validate → Fingerprint → Upsert), import history |
| 05 | **Exports** | Export builder (data selection, date range, field picker, format), recent exports table with download |
| 06 | **Audit Trail** | Searchable log of every route change, manual review, import, export, and login with before / after diff |
| 07 | **Rules & Settings** | Routing rules table, confidence thresholds, SLA, duplicate handling, dark mode toggle |
| 08 | **Human Review** | Conflicting-evidence queue, confirm / override decisions, related context, nav badge counter |

**Interactive features across all screens**

- Collapsible sidebar (⌘ B / Ctrl B)
- Global search bar with page-jump shortcut (⌘ K / Ctrl K)
- Toast notifications for all actions
- Share modal on Review Detail — copy link, Email / Slack / Teams / PDF, invite by email, access-level selector
- Dark mode (Settings → General)
- Chart.js line chart with hover tooltips and Chart.js doughnut with centre label
- Add-rule modal with live table injection
- Pipeline step animation with IntersectionObserver
- Mock audio player with scrub-click and play / pause
- Human review queue — confirm / override removes item and decrements nav badge

---

## Vite + React app — 7 screens

| Screen | Content |
|---|---|
| **Overview** | Fixed three priorities, KPI cards with definitions, activity by IST hour and person, route counts, review-state distribution, source-reported connection rate |
| **Conversation inbox** | All 44 records, source-type / person / route filters and search, state, revision, route decision, analysis freshness |
| **Record detail** | Evidence quotes linked to source, uncertainty, next steps, coaching, route editor, review state, audit history, full source excerpt |
| **Manager brief** | Fixed 21 Aug 2026 snapshot — summary, three priorities, coaching, follow-ups, watchlist |
| **Exports** | Generated folder tree, manifest preview, multi-route example, real ZIP / manifest downloads |
| **Imports & replay** | Reset, initial import, shuffled repeat, manual correction, update, refresh, import log, progress checklist |
| **Method & evidence** | Metric definitions, routing principles, three findings, rejected decision, AI disclosure, limitations |

---

## Routing design

```
One canonical record  →  exports/records/<REF>-<hash>.md
                         (full source, evidence, next steps)

Per active destination →  exports/routes/<destination>/<REF>-<hash>.md
                          (shared context key + destination-specific actions + back-link)
```

- Manual overrides are stored separately from the automated suggestion, shown as **Manual** in the UI, preserved across updates until explicitly reset, and written to the manifest and audit log.
- Stale route paths are never left behind — the archive is regenerated from current state on every export.

### 9-route taxonomy

| Route | Slug |
|---|---|
| Deal Follow-up | `deal-follow-up` |
| Sales Coaching | `sales-coaching` |
| Customer Support | `customer-support` |
| Onboarding & Training | `onboarding-training` |
| Partner Development | `partner-development` |
| Vendor Evaluation | `vendor-evaluation` |
| Internal Operations | `internal-operations` |
| No-opportunity Close | `no-opportunity-close` |
| Intake / No Text | `intake-no-text` |

---

## Replay contract

The exact public test sequence:

1. **Reset to empty state** on Imports & replay
2. **Import `data/01_initial.json`** → 44 added, 44 unique, 17 usable texts
3. **Repeat shuffled initial** → received 44, added 0, ignored 44, unique 44 — array position is not identity
4. Open **Conversation inbox → M07**. It has no usable text, state **Intake logged**, no substantive analysis
5. In M07's **Routes** card click **Customer support**, then remove **Intake / no text**. Decision becomes **Manual**, written to audit history
6. Return to **Imports & replay** and **Import `data/02_update.json`** → received 1, updated 1, still 44 unique, now 18 usable texts
7. Refresh the browser. Reopen M07 — it is revision 2, has 27 turns, a current revision-2 analysis, and the **manual Customer support** route is still active
8. **Repeat the initial batch again** after the update → revision 1 is older for M07, batch is ignored, counts stay at 44 / 18 and do not inflate

The built-in demo state already includes the update. `exports/` is the clean post-update snapshot. `exports-replay-demo/` contains the same state with M07 manually reduced to Customer support, so manual-override preservation is visible in the generated files.

---

## Three findings (with source passages)

### 1 · Price changed inside the meeting — proposal needs its composition

Asterloom challenged a move from ₹ 26,000 to ₹ 39,000. The rep separated the recurring subscription from the one-time integration fee on the spot.

> *"But you previously told me INR 26,000. Why has that become INR 39,000?"* — M03, turn 23
>
> *"INR 26,000 plus tax is the recurring annual subscription, and INR 13,000 is the one-time accounting integration setup."* — M03, turn 24

**Action:** M03 → **Deal follow-up + Sales coaching**. A line-item proposal and explicit prepaid funding model are required. See Manager brief, Priority 02.

### 2 · Credit expectation can block migration even when a product path exists

Cedarwave's core issue is prepaid-to-credit. The replacement programme is still prepaid. Eligibility, limit visibility, and reconciliation are unconfirmed.

> *"The replacement I described is still prepaid. I do not want to promise that this becomes a credit card in the near term."* — M04, turn 10
>
> *"moving from prepaid to credit is the main issue for us."* — M04, turn 25

**Action:** M04 → **Customer support + conditional Deal follow-up**. Do not promise credit or accounting sync before eligibility is checked. See Manager brief, Priority 03.

### 3 · A workaround is not a fix — a late transcript changes what is reviewable

Willowfield showed four issues. An invoice-inbox upload workaround exists, but the direct upload defect remains open. M07's transcript arrived only in revision 2.

> *"The workaround does not mean the direct upload issue has been resolved."* — M07, turn 15
>
> *"it is retaining the previous amount rather than fetching the next payment's value."* — M07, turn 23

**Action:** M07 → **Customer support + Internal operations**, analysis versioned to source revision 2. The replay test verifies the manual route survives the update and a browser refresh.

---

## Deliberately rejected decision

**Rejected: auto-merging M04 and M13 into one CRM opportunity.**

M04 and M13 share a Cedarwave migration theme and the same organiser domain. The tempting path was to merge them, create a deal, and attach a pipeline value.

The supplied data does not establish that they are the same conversation, that the organiser is the salesperson, that an opportunity exists, or that any deal value is authoritative. A title match and an organiser email are not identities.

**Trade-off accepted:** less automation and no pipeline total, in exchange for preserving every source identity, making uncertainty explicit, and never manufacturing a number. The watchlist flags the possible relationship without asserting it.

---

## Export structure

```
exports/
├── manifest.json          # machine-readable manifest (all fields)
├── manifest.csv           # spreadsheet-friendly version
├── README.md              # export README
├── ROUTE-INDEX.md         # route directory index
├── briefs/
│   └── 2026-08-21-manager-brief.md
├── records/               # 44 canonical files
│   └── <REF>-<hash>.md
├── routes/
│   ├── deal-follow-up/
│   ├── sales-coaching/
│   ├── customer-support/
│   ├── onboarding-training/
│   ├── partner-development/
│   ├── vendor-evaluation/
│   ├── internal-operations/
│   ├── no-opportunity-close/
│   └── intake-no-text/
└── state/
    └── import-log.json
```

**Manifest fields:** `source_type`, `source_id`, `record_ref`, `applied_source_revision`, active routes, every output path, processing state, review state, manual override, manual note, analysis freshness.

**Pre-generated snapshots**

| Archive | Files | Manual overrides |
|---|---|---|
| `exports/` + `exports.zip` | 107 | 0 |
| `exports-replay-demo/` + `exports-replay-demo.zip` | 106 | 1 (M07 Customer support only — one fewer route file) |

---

## AI disclosure

| Area | Detail |
|---|---|
| **Pre-generated analysis** | 18 conversation analyses prepared with AI assistance and checked against the supplied source. Analysis version and source revision stored with each. `npm run validate:data` confirms all 89 quotes match the exact supplied text. |
| **Runtime computation** | Imports, identity deduplication, revision handling, filters, metrics, routing state, review state, audit history, manifest rows, Markdown / CSV exports, ZIP creation — all run locally in the browser. |
| **No credentials** | No API keys, secrets, live model calls, authentication, or external services. |
| **Stale analysis handling** | If a newer source revision arrives without a matching analysis, the interface shows the analysis as unavailable / stale — it never silently presents old analysis as current. |

---

## Metric definitions

| Metric | Definition |
|---|---|
| Unique source records | Distinct `(source_type, source_id)` after applying revisions. Repeated deliveries do not add records. |
| Usable supplied text | A call counts when `transcript_payload` has non-blank text. A meeting counts when ≥ 1 supplied turn has non-blank text. A recording / transcript flag alone does not count. |
| Coverage | Usable supplied text ÷ selected source records. Current: 18 / 44 = 41 %. |
| Route assignments | Sum of active destinations across selected records. Can exceed the record count. Manual decisions replace the automated suggestion for that record. |
| Open review work | Records in Needs review, In review, Needs evidence, or Capture gap. Reviewed and Intake logged are excluded. |
| Call connection rate | Calls with `is_connected = true` ÷ calls with non-null `is_connected`. Current source-reported rate: 11 / 30. Five unknowns are shown separately. This is not a verified conversation measure. |
| Activity by person | Calls use `rep_name`; meetings use `organizer_email`. An organiser is not assumed to be the salesperson or an attendee. |
| Manager brief coverage | 18 / 18 supplied conversations with usable text — 10 calls + 8 meetings. Fixed to 21 Aug 2026 IST. |

All dashboard metrics respect the active source-type, person, and route filters. The manager brief remains fixed by design.

---

## Limitations

- No CRM opportunity table, account history, confirmed staff-role directory, or authoritative deal value is supplied. Amounts mentioned in conversations are evidence, not pipeline totals.
- The supplied extract is selected for variety, not a representative team sample. No cross-person performance ranking is produced.
- 20 calls have no supplied transcript — their stored outcomes are source-reported, not transcript-verified.
- M05, M08, and M11 are recorded but contain no usable speech. M12 and M14 were cancelled; M13 had no notetaker scheduled.
- Transcripts are adapted and abridged. A quote is evidence of what appears in the supplied text, not proof of the underlying commercial facts.
- M04 and M13 may be related, but are not merged and no account link is asserted.
- The app is local-first. There is no live recording capture, CRM integration, or paid AI call.

---

## Main files

```
index.html                        standalone UI entry point (open directly in browser)
styles.css                        standalone UI styles — white/black design system
app.js                            standalone UI logic — navigation, charts, interactivity

src/
  main.jsx                        React app entry point
  App.jsx                         all React screens and routing
  lib/
    model.js                      identity, revisions, state, metrics, routing logic
    exportCore.js                 manifest, canonical/route files, CSV, ZIP bundle
  data/
    analyses.json                 18 evidence-backed analyses
    analyses.js                   analysis loader
    notes.js                      findings, rejected decision, metric defs, AI/limitations
    brief.js / brief.json         fixed manager brief content
    taxonomy.js / taxonomy.json   9-route taxonomy
    initial-batch.js              01_initial.json loader
    update-batch.js               02_update.json loader

data/
  01_initial.json                 44-record revision-1 delivery
  02_update.json                  M07 revision-2 update

scripts/
  validate-analyses.js            confirms all 89 quotes match supplied text
  generate-exports.js             rewrites exports/ and exports.zip
  generate-exports-replay.js      rewrites exports-replay-demo/ and exports-replay-demo.zip
  sync-data.js                    syncs data sources

exports/                          clean post-update snapshot (107 files)
exports-replay-demo/              M07 manually corrected (106 files)
exports.zip                       downloadable clean snapshot
exports-replay-demo.zip           downloadable replay snapshot

public/
  recording-script.txt            timed 3-min narration script
  slides/                         five-slide deck (print-to-PDF)

docs/
  recording-script.md             same script in Markdown

docs-conversations.md             conversation-level documentation
docs-data-contract.md             data contract specification
docs-data-dictionary.md           field definitions
docs-source-assignment.md         source record assignment notes

vite.config.js                    Vite config — React plugin, port 5173
package.json                      dependencies — React 19, Vite 6, JSZip
```

---

## Time spent

Approximately **7–8 hours** of focused work: reading the source material, analysing all 18 texts, designing and building both the React app and the standalone UI, constructing the export / replay contract, validating evidence, generating files, and writing the documentation.
