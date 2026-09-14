# Research expansion: design tree, decisions and implementation plan

## Goal and pinned baseline

Implement the previously proposed next step: structured research coverage, a separate collection of verified-final-loop questions whose round number is unknown, and a targeted public-source research pass. Preserve the existing dark design, multi-select filters, country-only locations and rigorous provenance.

Baseline for review: `f860aa4045982602e8721b6744d76cabba928f52` (586 strict question–round rows, 635 occurrences, 136 reports). The user explicitly delegated self-grilling and decisions; no clarification or confirmation loop is required. This document is the originating spec for the final implementation review.

## Self-grilling round 1: independent root decisions

### Q1 — Does more data justify weaker admission?

**Challenge:** A missing round is not the same as an unverified interview. Could a second collection launder generic question banks or screening accounts into the site?

**Decision:** No weaker role/stage/date/source requirements. The second collection requires an actual SDE II/L5 final-loop account, a concrete question, an in-window defensible date and a written reason the round cannot be established. Only the round is unknown. Unknown country remains `Not stated`. Unverified discovery leads remain in exclusions/ledger, never question rows.

### Q2 — What does coverage mean?

**Challenge:** Search keywords and publication dates cannot prove every interview month/country was covered.

**Decision:** Coverage measures documented research activity, not existence or absence of interviews. Explicit scoped campaign runs contain a country, date window, execution timestamp, queries, provider, evidence artifact and per-source dispositions. Distinguish failed search, completed discovery with unresolved leads, inspected sources with no admitted questions, and admitted evidence. Historical loose query lists remain visible but are not retroactively relabeled as exhaustive structured coverage.

### Q3 — Which features are in scope?

**Decision:** Build the two collections, reviewable campaign ledger, real research input and reproducible exports. Do not add a submission backend, paid unattended crawler, login system, telemetry or scheduled publishing. A static repository and manual reviewed additions remain sufficient. Private-source access would require separate explicit authorization.

## Self-grilling round 2: decisions unlocked by round 1

### Q4 — How do we prevent count contamination?

**Decision:** Keep `data/database.json`, its strict counts, CSV and SQLite contracts unchanged. New inputs live under `data/unconfirmed/`, not `data/research/`. Build a separate `data/unconfirmed.json`, CSV and SQLite; null round is never serialized as 0, R0 or one of R1–4. The viewer defaults to Round verified and switches explicitly to Round unconfirmed. Each collection has its own counts, sources and downloads.

### Q5 — Can the same source be present in both collections?

**Decision:** Yes when different questions have different evidence. Reuse source IDs and canonical question keys. Reject duplicate source URLs across different IDs. If a source+canonical question already has a verified round, do not count it in the unconfirmed collection. Promotion is an explicit research edit: add verified evidence to strict inputs and remove its supplemental entry; build rejects mixed-state duplicates rather than silently guessing. Duplicate entries within an unconfirmed report count once; conflicting dates fail.

### Q6 — How do filters and exports behave?

**Decision:** Both collections use search/topic/country/year/date-basis/minimum-frequency filters with OR within and AND across groups, at the same occurrence. Unconfirmed mode disables and ignores round choices without deleting them; returning to strict mode restores those selections. `view=unconfirmed` persists in URLs. Export only the active filtered collection; label Round as `Unconfirmed` and expose the uncertainty reason in evidence. Full downloads point to active collection artifacts. Do not combine strict and unconfirmed frequencies.

### Q7 — How should coverage relate to source location/date?

**Decision:** A campaign's requested country/date is a search scope only. It never supplies an admitted record's location/date. Campaign sources carry a disposition (`verified`, `unconfirmed`, `duplicate`, `excluded`, `unresolved`) and an explanatory note. Admitted dispositions must reference a real generated report ID. Provider failures retain status and errors; never use wording such as no interviews exist. Coverage controls are independent of question filters and state their scope explicitly.

## Self-grilling round 3: operational frontier

### Q8 — Where are the test seams?

**Decision:** At a pure supplemental compilation interface that takes raw supplemental reports, strict database, normalization and campaign records and returns validated collection/ledger output; and at actual browser controls for view switching, filtering and exports. This is the delegated test-seam decision. Keep focused regression tests for contamination, duplicate/promotion behavior, unknown-round reason, calendar validity and campaign reference validation. Use real browser smoke checks for UI, not DOM/source-text unit tests.

### Q9 — How do we stop research without claiming exhaustiveness?

**Decision:** Execute a bounded targeted Exa pass for a US2026 window and late2025 gap, inspect returned plausible originals, and recover known explicitly-final-loop exclusions. Every discovered candidate in these runs receives a disposition or remains unresolved. No arbitrary inflated question target and no infinite search loop. If Exa is unavailable, record failure and still finish reachable source recovery. No fabricated successes.

### Q10 — What protects deployment and reproducibility?

**Decision:** Build/check both collections and ledger, exercise dark desktop/mobile UI, update asset content-version strings, run Standards and Spec review in parallel against the pinned baseline, fix findings, commit and publish only task-owned files. Preserve unrelated local ASSAY_REVIEW.md. Verify latest GitHub Actions and hosted behavior.

The design frontier is closed for this implementation. Each decision has a conservative answer; no unanswered branch is silently delegated to a future implementation.

## Detailed implementation

1. Add `scripts/research-expansion.js` with a small pure `compileResearchExpansion({ slices, strict, normalization, campaigns })` interface; isolate source normalization, deduplication and scope-ledger validation there.
2. Input `data/unconfirmed/*.json`: `{slice, reports:[{id,url,title,role,stage:"final-loop",location,date,dateBasis,stageEvidence,questions:[{round:null,key,question,topic,evidence,roundUncertainty}]}]}`. Same optional original metadata/aliases as strict accounts. Validate actual calendar dates, source level, explicit final-loop stage discriminator, null round, required uncertainty and provenance. Curator inspection still verifies that the discriminator is supported by source evidence; a field cannot authenticate a narrative.
3. Output unconfirmed JSON uses the current viewer shape `{metadata,questions,reports,coverage}` with null-round rows and stable `u-<key>` IDs. All question frequencies count unique reports. Output CSV has existing seven columns with `Unconfirmed` round, while JSON/SQLite retain uncertainty evidence.
4. Add `data/campaigns/*.json` with explicit run fields `{id,country,startDate,endDate,searchedAt,provider,queries,artifact,status,error?,sources:[{url,disposition,reason,reportId?}]}`. Execution status is `completed` or `failed`; derive human-readable outcome from dispositions. Scope dates must be exact and ordered. Artifacts must be safe repository-relative paths, not credentials or absolute paths.
5. `scripts/build.js` invokes supplemental compiler after strict build, writes separate JSON/CSV/SQLite and `data/research-ledger.json`. Existing strict tables/counts remain unchanged. `scripts/check.js` checks both datasets and ledger; CI stale-output gate includes all generated artifacts. Add focused compiler tests and one full test invocation at completion.
6. Add collection switch above existing filters, explanatory note, active collection counts and download paths; shared table/evidence rendering handles null round and reason. Round choices disabled in unconfirmed mode, other filters retained. Add independent country/status filters and compact campaign table above historical coverage details.
7. Preserve shared dark tokens and no framework/runtime services. Self-hosted fonts remain unchanged. All source content uses textContent; links are protocol checked; CSV formula escaping remains.
8. Research and write actual supplemental accounts/campaign runs; retain Exa responses. Reject screening ambiguity, undated stale reposts and unordered generic examples. No alteration of historic search coverage claims.
9. Update README/METHODOLOGY/PLAN with exact new counts and semantics. Review since baseline on Standards and Spec axes, resolve defects, publish and inspect live deployment.

## Acceptance criteria

- Strict question rows, report counts, frequencies and source/date/location lists are unchanged unless separately supported strict additions are explicitly documented.
- Unconfirmed records never enter strict JSON/CSV/SQLite frequencies; each has explicit null round, evidence and uncertainty reason.
- Source+question promotion/duplicate collisions fail clearly; no double counting through aliases.
- Structured ledger has actual queries, outcomes and per-source reasons; failed searches are not shown as zero relevant interviews.
- Existing single/multi-value URLs work; explicit unconfirmed URL loads correct collection; switching preserves round choices without applying them to unknown rounds.
- Exports and downloads match selected collection; unknown labels never read Rnull/R0.
- Desktop/mobile, keyboard, evidence, search, multiselect, empty state and reset verified against actual program.
- Focused compiler tests and complete data check pass; reproducible rebuild and CI current-artifact checks pass.
- Two-axis review performed and no unresolved correctness findings; committed and live site verified.

## Implementation and review record

- Delivered separate3-question/2-report supplemental collection and4 scoped campaign runs; strict JSON remained identical to baseline586 rows/136 reports/635 occurrences.
- Thirteen focused regression tests pass. Zero-result campaign semantics and missing/wrong stage admission each had a demonstrated failing test before their fixes; empty discovery is no longer mislabeled as inspection and supplemental inputs require explicit final-loop stage.
- Both JSON/CSV/SQLite collections and ledger references/artifacts pass `bun run check`; all seven generated artifacts were reproducible across rebuilds.
- Browser checks exercised active-collection filters, dormant round retention, unconfirmed CSV, separate downloads, independent ledger filters, mobile390px layout, evidence reasons and auxiliary503 isolation.
- Standards review: no hard documented-standard or correctness blockers. Shared validators and collection exporters were extracted in response to duplication feedback. Small build/check containment checks and two-view display branches remain deliberately explicit; further abstraction would add machinery without another behavior variant.
- Spec review identified a missing machine-enforced final-loop stage discriminator. Fixed with required `stage: "final-loop"` in compiler/schema/source inputs and a regression rejecting missing, phone-screen and OA stages. Actual recovered accounts had already been source-verified. No remaining correctness finding after this correction. The local plan is the review specification; no issue-tracker setup was needed.
- Tests were not all written test-first: concurrent initial compiler cases were added with implementation, while the later empty-campaign edge used a demonstrated red/green cycle. No TypeScript/typecheck target exists; this is plain Bun JavaScript.
