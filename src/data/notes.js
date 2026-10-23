// Explanation content used by the Method page and the five-slide deck.
// Source passages are exact quotes from the supplied conversations.

export const findings = [
  {
    number: "01",
    title: "A price changed inside the meeting, so the proposal has to show its composition",
    noticed:
      "At Asterloom the customer challenged a move from INR 26,000 to INR 39,000. The rep then separated INR 26,000 recurring from INR 13,000 one-time integration. The number did not change so much as the explanation arrived late.",
    source: "M03 · turns 23–24",
    quote:
      "“But you previously told me INR 26,000. Why has that become INR 39,000?” / “INR 26,000 plus tax is the recurring annual subscription, and INR 13,000 is the one-time accounting integration setup.”",
    product:
      "M03 is routed to Deal follow-up + Sales coaching. The next step asks for a line-item proposal and makes the prepaid funding model explicit. The manager brief prioritises the same repair before the CFO review.",
    where: "Inbox → M03; Detail → Evidence; Manager brief → Priority 02"
  },
  {
    number: "02",
    title: "A credit expectation can block a migration even when the product path exists",
    noticed:
      "Cedarwave said moving from prepaid to credit was the main issue. The replacement programme was still prepaid; a bank-issued card feed was possible, but eligibility, limit visibility and reconciliation were not confirmed.",
    source: "M04 · turns 10–11, 23–25",
    quote:
      "“The replacement I described is still prepaid. I do not want to promise that this becomes a credit card in the near term.” / “moving from prepaid to credit is the main issue for us.”",
    product:
      "M04 is routed to Customer support + a conditional Deal follow-up. The detail view explicitly lists what the evidence does not establish. The brief tells the manager not to promise credit or accounting sync before eligibility is checked.",
    where: "Inbox → M04; Detail → What the evidence does not establish; Manager brief → Priority 03"
  },
  {
    number: "03",
    title: "A workaround is not a fix, and a late transcript changes what is reviewable",
    noticed:
      "Willowfield demonstrated four product issues. The team found an invoice-inbox upload workaround, but the direct upload defect remained. The transcript arrived only in revision 2, so the record had no analysis in the initial state.",
    source: "M07 · turns 13–15, 21–23",
    quote:
      "“The workaround does not mean the direct upload issue has been resolved.” / “it is retaining the previous amount rather than fetching the next payment's value.”",
    product:
      "M07 is routed to Customer support + Internal operations. Its analysis is versioned to source revision 2 and is hidden before that revision arrives. A manual route correction survives the update and is recorded in the manifest.",
    where: "Imports & replay; Inbox → M07; Export manifest → manual_override"
  }
];

export const rejectedDecision = {
  title: "Rejected: auto-merging similar meeting records and inventing a CRM opportunity",
  alternative:
    "M04 and M13 share a Cedarwave migration theme and the same organiser domain. The tempting alternative was to merge them into one account conversation, create a deal, and attach a pipeline value so the dashboard looked more commercial.",
  rejected:
    "The supplied data does not establish that they are the same conversation, that the organiser is the salesperson, that an opportunity exists, or that any deal value is authoritative. A title match and an organiser email are not identities.",
  tradeoff:
    "The product shows less automation and no pipeline total. In exchange, every record remains inspectable under its own (source_type, source_id), the brief can flag the possible relationship without asserting it, and no number is manufactured. I accepted a less impressive dashboard for evidence integrity.",
  where:
    "M04/M13 are kept separate; the watchlist in the manager brief records the possible relationship; the Method page and README state the limitation."
};

export const metricDefinitions = [
  {
    metric: "Unique source records",
    definition:
      "Distinct (source_type, source_id) pairs after applying revisions. A repeated delivery does not add a record. This is the denominator for coverage and review counts.",
    source: "data/01_initial.json + data/02_update.json"
  },
  {
    metric: "Usable supplied text",
    definition:
      "A call counts when its supplied transcript has non-blank text. A meeting counts when at least one supplied turn has non-blank text. A recording flag alone does not count. Coverage = usable supplied text ÷ selected source records.",
    source: "transcript_payload / payload.transcript"
  },
  {
    metric: "Route assignments",
    definition:
      "The sum of active destinations over selected records. One record can have several routes, so this can exceed the record count. Manual corrections replace the automated suggestion for that record.",
    source: "analysis suggestions + manual route state"
  },
  {
    metric: "Open review work",
    definition:
      "Selected records whose review state is Needs review, In review, Needs evidence or Capture gap. Reviewed and Intake logged are excluded. The denominator is the selected record count.",
    source: "review state saved in the app"
  },
  {
    metric: "Call connection rate",
    definition:
      "Calls with is_connected = true ÷ calls with a non-null is_connected value. Unknown is shown separately. This is source-reported metadata, not a verified conversation measure.",
    source: "call payload"
  },
  {
    metric: "Activity by person",
    definition:
      "Calls are attributed to rep_name (call rep). Meetings are attributed to organizer_email (meeting organiser). An organiser is not assumed to be the salesperson or an attendee.",
    source: "call rep_name; meeting organizer_email"
  },
  {
    metric: "Manager brief coverage",
    definition:
      "All 18 supplied conversations with usable text are reviewed after revision 2: 10 calls and 8 meetings. The brief is fixed to 21 August 2026 Asia/Kolkata and does not react to dashboard filters.",
    source: "18 pre-generated analyses"
  },
  {
    metric: "Manual override",
    definition:
      "A route decision saved separately from the source record. It remains in effect across source updates until the user explicitly resets it. The manifest records manual_override and the note.",
    source: "app route history + manifest"
  }
];

export const limitations = [
  "No CRM opportunity table, authoritative deal value, account history or confirmed staff-role directory is supplied. Amounts quoted in conversations are evidence, not pipeline totals.",
  "The extract is selected for variety, not a representative team sample. No cross-person performance ranking is produced.",
  "Twenty background calls have no supplied text. Their stored outcomes are source-reported, not transcript-verified.",
  "M05, M08 and M11 are recorded but contain no usable speech. M12 and M14 were cancelled; M13 had no notetaker scheduled.",
  "Transcripts are adapted and abridged. A quote is evidence of what appears in the supplied text, not proof of the underlying commercial facts.",
  "The app is local-first. There are no live integrations, authentication, recording capture or paid AI calls. State is stored in the browser's localStorage.",
  "M04 and M13 may be related, but the records are not merged and no account link is asserted.",
  "The screen recording with spoken narration must be recorded by the candidate. This repository includes the script and the exact workflow to demonstrate."
];

export const aiDisclosure = {
  preGenerated:
    "The 18 conversation analyses in src/data/analyses.json were prepared before the app runs, with AI assistance, then checked against the source. Each evidence quote was validated by script: 89 passages across 18 analyses. Analysis version and source revision are stored with every output.",
  runtime:
    "The app computes imports, identity de-duplication, revision handling, filters, metrics, route state, review state, audit history, manifest rows and Markdown/CSV exports at runtime. It makes no AI API calls and stores no keys or credentials.",
  newContent:
    "A newer source revision becomes visible immediately. M07 is the supplied example: revision 2 supplies its transcript and a matching revision-2 analysis. If a newer source arrived without an analysis for that revision, the detail view would show the source as new and mark analysis as unavailable rather than silently showing an older one."
};

export const routingPrinciples = [
  {
    title: "One record, several destinations",
    body:
      "A conversation keeps one canonical record under records/. Each destination gets a thin route file under routes/<destination>/ that links back to the canonical context, evidence and actions. The manifest lists every active path."
  },
  {
    title: "Route the evidence, not the label",
    body:
      "The source type, stored outcome, organiser and recording flag are evidence to inspect. They do not decide the route. A support conversation can also contain a commercial next step; an organiser is not automatically sales."
  },
  {
    title: "No text, no invented analysis",
    body:
      "Every record has an intake/review state. Records without usable supplied text stay in intake or capture review, with a capture reason. They never receive a generic conversation summary."
  },
  {
    title: "Separate suggestion from decision",
    body:
      "Automated suggestions are stored in the record state. Manual corrections are stored separately, shown as manual in the interface, and preserved when a newer source revision arrives. Reset is explicit."
  },
  {
    title: "Uncertainty is an output",
    body:
      "Every analysis has a not-established section. Conditional routes (for example Deal follow-up on M04) remain conditional in the reason, the next step and the manager brief."
  }
];
