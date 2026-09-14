# Evidence quality, study tools and incremental research

## Decisions

Implement all requested areas without weakening admission or adding a backend. Keep country-only multiselect, dark styling, strict/unconfirmed separation, and existing seven-column exports. Study state stays local; discoveries never become admitted records automatically. Existing corpus cutoff stays2026-09-13; new discovery activity can be newer and is labeled separately.

## Shared contracts

### Evidence enrichment

New pure module `scripts/enrich-evidence.js` exports `enrichEvidence(collection, assessments)` returning enriched collection without changing counts/IDs. Input assessment registry `data/evidence-assessments.json`: `{occurrences:{"reportId|round-or-unconfirmed|canonicalKey":{quality,reason,problemUrl?,problemEvidence?}}, categories:{canonicalKey:category}}`.

Every occurrence gains `evidenceQuality` enum `exact-named` / `described` / `partial`, `qualityReason`, optional `problemUrl` and `problemEvidence`. Default is `described` (means reported description, not completeness or trust guarantee); conservative text markers of unspecified variants yield `partial`. `exact-named` and practice links ONLY through explicit curator assessments with source proof; never infer from slug alone. Each row has `category` enum `Coding`, `Low-level design`, `System design`, `Behavioral`, `GenAI`, `Project deep dive`; map existing topics deterministically, ambiguity use explicit registry override. Row `evidenceQualities` array from occurrences. Browser recomputes visible qualities/links from matching occurrences, not the full row. Existing dateBasis labels already give interview vs publication evidence; retain distinct from quality/round status.

### Study UI

`app.js` adds quality and category multiselect groups, personal filter (All / Bookmarked / Practiced / Not practiced), Bookmark and Practiced toggle buttons per row with aria-pressed. LocalStorage versioned key; identity includes collection and row.id so no collisions. Storage failure produces visible session-only notice, not broken app. Saved named filter sets store relative query strings locally; load/delete and copy/share current view controls. Shared links contain public filter state only; personal progress never serialized or uploaded. Unknown/malformed local data cannot execute code. Maintain keyboard focus after toggles. Provide backup export/import for local study data only if straightforward; not required.

### Incremental research

CLI `scripts/discover.js` runs Exa hosted MCP advanced search for publication window since last successful run (overlap allowed), configurable start/end/country/results/output. Default bounded small request count. Retain request/result/failure audit. Canonicalize URLs and compare against strict/unconfirmed aliases and prior queue IDs. New candidates enter pending queue ONLY. Review CLI `scripts/review-queue.js` updates decision pending/rejected/duplicate/accepted with reason; accepted must reference an already admitted canonical report, not create it. No fetched content injected into source files or executed.

Authoritative `data/review-queue.json`: `{version:1,runs:[{id,startedAt,completedAt?,status,country,startDate,endDate,queries,artifact,error?}],candidates:[{id,url,title,discoveredAt,publishedDate?,runIds,status,reason?,reportId?}]}`. Run status successful/failed; failures never advance success watermark. Queue UI is read-only with status filter and source links. Last researched = latest successful research/discovery timestamp, explicitly separate from corpus cutoff and last attempted. Module `scripts/research-status.js` exports `compileResearchStatus({queue,history,collections,campaigns})` -> `{lastResearchedAt,lastAttemptedAt,cutoff,queue:[...],runs:[...],history:[...]}`; validates inputs/references.

Weekly GitHub workflow invokes discovery in a separate output directory and uploads review artifact. It must NOT commit, admit, push or publish results. Manual local import command merges queued candidate artifacts with validation and dedup; then curator reviews. Use existing default free endpoint or explicit optional key, never expose secrets. CI permissions contents:read only. Run actual bounded discovery locally to prove command; queue real candidates/existing unresolved leads, no dummy records.

### Change history

`data/change-history.json` explicit dated releases with `id,date,summary,changes:[{collection,id,type,fields?,before?,after?}]`; initial baseline manifest generated now, not fictional historical diffs. `scripts/record-changes.js` compares canonical row snapshots with `data/history-snapshot.json`, appends added/corrected/removed IDs and changed fields, updates snapshot only on explicit command. Build reads history, never mutates it. Study-only changes can have summary with empty record changes. Generated `data/research-status.json` drives read-only page history and queue. Each release date explicit/reproducible.

## Ownership and sequence

Main: audit dataset, assessments, build/check/export integration, snapshots/history CLI, docs, final validation and publication.
Evidence worker: enrichment module and focused tests only.
UI worker: app.js/index.html/styles.css only against contracts.
Discovery worker: discover/review/import CLI, research-status compiler/tests, weekly workflow only. Main integrates package/build/check/CI changes.

## Acceptance

1. Visible per-occurrence quality plus independent date/round labels; partial matches never gain exact links from other sources.
2. Audit all frequency>1 rows for grouping and key evidence, plus targeted date fallback/repost cases; record findings and limitations, correct only evidence-supported issues.
3. Bookmarks/practiced survive reload; personal filter works; named saved multiselect/collection URLs restore; clipboard failure has usable URL fallback; storage denial degrades visibly.
4. Coding/LLD/HLD/behavioral/GenAI/project category filters work and exact practice links have curator support.
5. Real incremental discovery enters pending queue, dedups known aliases, records watermark and failures, cannot publish/admit. Weekly job produces artifact only.
6. Explicit record history detects additions/corrections/removals, no build side effects; readable on site with source/ID references.
7. Preserve strict/unconfirmed count separation; SQLite/JSON reflect enrichment, CSV keeps seven-column contract; checks validate enrichment and research status.
8. Focused module tests plus real browser desktop/mobile/savedstate/error/export checks, then CI and live hosted verification. Keep unrelated ASSAY_REVIEW.md uncommitted.

## Verification record

- 40 module tests passed across evidence enrichment, queue/discovery/import/review, record diffs and supplemental boundaries. Both collections' JSON/CSV/SQLite and research-status validation passed; eight generated artifacts rebuilt byte-identically.
- Audited 42 repeated-question rows using retained occurrence evidence; corrected generic feedback grouping and one publication/update-date confusion with original source checks. Registry contains 35 exact source-supported problem links; no links inferred from slug-only similarity.
- Actual Exa CLI request succeeded, five candidates imported pending, one wrong-level candidate rejected through the review CLI. Admitted report count remained 137. Weekly workflow is artifact-only with contents:read.
- Browser verified local bookmarks/practiced persist, named filter reload, personal-state exclusion from shared URLs, clipboard fallback, storage-denied session mode, mixed-source quality filtering without leaked links, categories, queue filtering and lazy history. Mobile 390px document width stayed 390px.
- UI review found no concrete defect. Pipeline review found history two-file retry risk; fixed atomic file replacement plus snapshot hashes and same-release repair, exercised with a deliberately damaged throwaway snapshot. Two other initial review claims were withdrawn after checking actual MCP wire ID and intended completion-time watermark semantics.
- No new interview accounts admitted by this upgrade. Strict rows rise 589→590 solely from splitting an over-specific grouping; occurrences 639 and reports 137 unchanged. Supplemental remains 31 questions/7 reports.
