# Three-minute screen recording script

**Goal:** show the manager surface, one evidence-backed conclusion, the import/revision contract, a manual route correction surviving an update and refresh, and the real export files. The recording must use your own spoken narration; captions are not a substitute.

## Before you record

1. Run `npm install` and `npm run dev`.
2. Open the Vite URL (for example `http://127.0.0.1:5173`) in a clean browser window.
3. Set browser zoom to about 90% so the dashboard and tables are readable at 1080p.
4. Make sure the app is in the **post-update demo state**. If it is not, open **Imports & replay** and click **Load full demo**.
5. Start a screen recorder with microphone (OBS, Windows Game Bar, or similar). Use a 16:9 canvas and show the whole browser window.
6. Do one practice pass. Keep the final recording under 3:05.

## Narration and actions

### 0:00–0:22 — The manager problem

**Show:** Overview.

**Say:** “Signal Desk is a triage surface for 44 selected records on 21 August. These are 44 unique `(source type, source id)` identities, not rows, names or array positions. Only 18 have usable supplied text. There are 57 route assignments and 21 records still in open review. The dashboard states every denominator rather than presenting activity as performance.”

**Do:** Point at the four KPI cards. Hover or open one **How it is counted** note.

### 0:22–0:40 — Filters and the fixed brief

**Show:** Filters, then **Manager brief**.

**Say:** “Source type and person filters work across the metrics and lists. Meeting organisers are separated from call reps, because an organiser is not automatically the salesperson or an attendee. The manager brief is fixed to the source day and does not react to filters. Its three priorities are M07, M03 and M04.”

**Do:** Set **Source type** to **Meetings** (14 records), then **Person** to **Team 09** (3 records). Clear filters. Open **Manager brief**, then return to **Imports & replay**.

### 0:40–1:08 — Initial import and duplicate test

**Show:** Imports & replay.

**Say:** “I’ll replay the public contract. Reset to empty, then import the initial delivery. It creates 44 identities and 17 usable texts. Now I repeat the same batch in a different array order. The result is received 44, added zero, ignored 44, unique 44 — the count does not inflate.”

**Do:** Click **Reset to empty state** → **Import 01_initial.json** → **Repeat shuffled initial**. Point at the result card and the newest import-log row.

### 1:08–1:32 — Late information and no invented analysis

**Show:** Inbox → search `M07` → open M07.

**Say:** “M07 is the late transcript. At revision 1 it has no usable text. It has an intake state and no substantive analysis. The app does not invent a summary for a silent record.”

**Do:** Open **Conversation inbox**, type `M07` in Search, open the M07 row. Point at **Late transcript**, **No substantive analysis was generated**, and the empty meeting transcript.

### 1:32–1:52 — Manual route correction

**Show:** Right-hand **Routes** card in M07.

**Say:** “I’m correcting the route to Customer support only. The manual decision is stored separately from the source and written to the audit history.”

**Do:** Click **Customer support**, then click **Intake / no text** to remove the intake route. Point at **Manual**, the audit entry, and the toast.

### 1:52–2:12 — Update, refresh, preservation

**Show:** Imports & replay → import update → refresh.

**Say:** “Now I import revision 2. M07 is updated in place: one record updated, still 44 unique, and the 18th transcript arrives. I refresh the browser. The manual route is still there, and the new source revision is visible.”

**Do:** Click **Imports & replay** → **Import 02_update.json** (toast: received 1, updated 1). Press **F5**. After reload, open **Conversation inbox**, search `M07`, open it.

### 2:12–2:35 — Evidence after the update

**Show:** M07 detail.

**Say:** “M07 is now revision 2 with 27 turns and a current revision-2 analysis. The manual Customer support decision survived both the update and the refresh. This is the key evidence: a workaround exists, but the direct upload defect does not. I can jump from an evidence card to the exact source turn. All 89 evidence passages are validated against the supplied text.”

**Do:** Point at **Source revision 2 received**, **Manual route**, the analysis, and click **View in source** on an evidence card.

### 2:35–2:53 — Real exports and manifest

**Show:** Exports.

**Say:** “The export is a real folder, not a proposed tree: 107 files, 44 canonical records, 57 route files, plus JSON and CSV manifests. Multi-route records keep one canonical identity and link back from each destination. The manifest records the source identity, routes, output paths, processing state and every manual override.”

**Do:** Point at the tree and manifest preview. Click **Download ZIP** and show the downloaded file in the browser downloads list. (If the browser blocks the download during recording, show `exports.zip` in the project folder and say that is the pre-generated snapshot.)

### 2:53–3:05 — Rejected decision and close

**Show:** Method page, especially the rejected decision.

**Say:** “I deliberately did not merge M04 and M13 or invent a pipeline value. Similar titles and organiser domains are not identities. The trade-off is a less commercial-looking dashboard with evidence integrity. The analyses are pre-generated with AI assistance and checked against source; the runtime makes no AI calls and stores no keys.”

**Do:** Scroll to **Deliberately rejected decision**. End on the title.

## After recording

- Trim dead air at the beginning/end.
- Keep the file name clear: `signal-desk-walkthrough.mp4`.
- Check that the narration is audible and that the M07 manual route is visible after the refresh.
- Add the recording link or file to the submission. Do not claim the recording exists until you have recorded it.
