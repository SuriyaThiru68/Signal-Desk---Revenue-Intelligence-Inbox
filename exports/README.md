# Signal Desk export

Generated at 2026-08-22T05:30:00.000Z from the current application state.

This archive is a clean snapshot, not an append-only pile. It contains one canonical record file per active source identity and one active file per assigned route. A repeated export replaces the previous snapshot; superseded route files are not written as additional active copies.

## Structure

```text
manifest.json                  Machine-readable manifest
manifest.csv                   Same manifest in CSV
ROUTE-INDEX.md                 Human index by destination
briefs/2026-08-21-manager-brief.md
records/<ref>-<id>.md          Canonical source context + analysis
routes/<destination>/<ref>-<id>.md
state/import-log.json          Import and revision audit trail
```

## How multi-route context is preserved

Every conversation has one canonical file under `records/`. Each active destination gets a thin route file with the shared context key, evidence, actions and a link back to the canonical record. The manifest lists the canonical file and every route file in `output_paths`.

## Current state

- Unique records: 44
- Usable supplied texts: 18
- Route assignments: 57
- Records with multiple routes: 13
- Records with manual route corrections: 0
- Applied source revisions: 1, 2

## Review before reuse

- `processing_state` describes the intake/review state at export time.
- `analysis_freshness` distinguishes an analysis that matches the current source revision from a stale one.
- `manual_override=true` means a manager changed the route. It is separate from the automated suggestion and survives source updates.
- Missing text is recorded as `text_status: none`; it is not evidence that no conversation happened and does not receive a substantive analysis.
- No pipeline value or deal outcome is asserted. Conversation-stated amounts are evidence only.
