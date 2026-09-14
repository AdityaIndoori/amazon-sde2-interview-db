# Amazon SDE II Interview Fieldnotes

An evidence-backed database and static HTML explorer of publicly reported **Amazon external SDE II / L5 final-loop questions**, covering **January 1, 2025 through September 13, 2026**.

**590 round-verified rows · 639 reported occurrences · 137 candidate accounts · 6 stated countries.** These are 525 conservatively normalized question identities across rounds. A separate round-unconfirmed collection contains 31 questions from 7 reports. Counts are public-report frequencies, not Amazon's internal asking rates.

> This is not ALL questions asked at Amazon. No public source can establish that. The strict corpus research ledger contains297 query/discovery entries and1,327 exclusion/uncertainty entries; structured campaign logs separately record scoped searches and inspections. Private, deleted, inaccessible, unindexed, vague and ambiguously staged reports remain coverage gaps. Candidate accounts are self-reported, not independently authenticated.

## View locally

Requires [Bun](https://bun.sh/) 1.2+ (verified with 1.4.1). No dependencies or installation step.

```sh
bun run serve
```

Open **http://localhost:4173**. Do not open `index.html` directly: browsers restrict fetching local JSON from `file://`.

The generated assets are checked in. A normal static server is sufficient to view the site; Bun is only needed to rebuild or use the supplied preview server. Set `PORT` to use a different local port. The server binds only to localhost and refuses dotfile access.

## Explorer

The table exposes the requested schema:

| Round | Question | Topic | Frequency | List of dates | List of sources | List of locations |
|---|---|---|---|---|---|---|
| Final-loop position 1–4 | Concise reported prompt | Technical/behavioral category | Independent reports for this question and round | Exact/month/year precision, labeled interview or publication | Original account URLs | Countries only, or Not stated |

The default **Round verified** collection contains 590 rows, 639 occurrences and 137 reports. **Round unconfirmed** is a separate collection of 31 questions from 7 accounts whose SDE II final-loop stage is supported but whose question ordinals are missing. One account contributes different questions to both collections; their unique combined report count is 143, not 144. Supplemental questions never change verified-round frequencies. Open them with `?view=unconfirmed`; the round filter is disabled and ignored, while its selected values are retained for switching back. Reset in this view clears applicable filters but keeps those dormant round choices. Counts and JSON/SQLite/CSV downloads always refer to the active collection.

The **Scoped research campaigns** ledger records actual search scopes, providers, execution dates, queries, evidence artifacts and per-source decisions. Its country/status filters are independent of question filters. Search scope never supplies a candidate country or interview date. Sixteen runs now include all nine2026 publication-month windows through September13 for US-targeted discovery, plus source-recovery inspections and prior campaigns. Missing campaigns and empty search results do not establish that interviews did not occur.

- Search question text, topic, source title/URL and evidence.
- Select multiple rounds, topics, countries, years and date types using checkboxes. Within a filter selections combine with OR; different filters combine with AND. No selections means all values. Each group has a Clear selection button; minimum frequency remains numeric.
- Sort every column; date sorting uses the latest displayed date.
- Combine filters at the **same occurrence** level. A question reported in India in 2025 and another country in 2026 does not match India + 2026.
- Frequencies, dates, source lists, location lists and counts recalculate from matching occurrences.
- Expand evidence to see quotations, reported prompt, original round label, numbering notes, role/stage context and retrieval/archive provenance.
- Share the URL to preserve filters/sort. Multiple selections use repeated parameters, for example `?round=1&round=2&location=India&location=United+States`. Existing single-value URLs still work. Reset restores the complete table.
- Export the filtered selection as CSV, or download full JSON/SQLite.
- Narrow screens scroll the table horizontally without overflowing the page.
- Minimalist Dark styling uses layered slate surfaces, amber accents, subtle glass/glow effects and locally hosted Space Grotesk, Inter and JetBrains Mono. Shared CSS tokens control color, type, spacing, radius and elevation. Font licenses are included under `assets/fonts/`.
- Motion respects `prefers-reduced-motion`; interactive controls have amber focus states and 44px targets. Muted text is lightened from the supplied palette to preserve contrast. The table has a bounded scrolling viewport and sticky sortable headers.

## Evidence quality and private study tools

- **Exact named:** a curator assessment contains source proof identifying a specific named problem. A LeetCode practice link is shown only when explicitly supported.
- **Described:** the source supplies a description; this is not a completeness or authenticity guarantee.
- **Partial:** the source mentions a variant, similarity or missing problem details. Unknown round and publication-date fallback remain separate labels.
- Quality filters apply to individual occurrences. If an exact source is filtered out, its practice link disappears; mixed rows show only matching evidence labels.
- Category filters separate Coding, Low-level design, System design, Behavioral, GenAI and Project deep dive.
- Bookmark/Practiced toggles and named saved filter sets use localStorage in this browser only. No account, server or upload. Blocked/corrupt storage falls back to a visible session-only mode. Shared links exclude study marks and personal filters. Copy failure exposes a selectable public URL.
- Study state is keyed by collection and row ID; a deliberately corrected/rekeyed row may need re-bookmarking. Browser-data deletion removes local marks; there is no cloud backup.

The [provenance audit](data/provenance-audit.json) reviewed all 42 baseline frequency>1 rows using their retained evidence and targeted original checks. It corrected a June10 update date to the actual May20 publication date for leetcode-6763561 and separated a generic-feedback occurrence from manager-specific feedback. Counts of candidate reports and occurrences did not increase; one grouping split adds one row. The explicit registry has 35 source-supported practice links and four partial-variant overrides; other classifications are conservative description-based labels.

## Incremental discovery, review and change history

```sh
bun run discover --start 2026-09-07 --end 2026-09-14 --country "United States" --results 5 --output data/discovery/initial
bun run import-discovery --input data/discovery/initial/review-queue.json
bun run review-queue --id CANDIDATE_ID --status rejected --reason "Evidence-based reason"
bun run build
bun run check
```

Discovery makes one bounded Exa request and writes public response/failure audit plus a pending-only queue artifact. It never modifies the admitted corpus or authoritative queue. Import explicitly merges candidates and preserves curator decisions. `accepted` requires a matching report already admitted through normal source curation; the review command cannot create questions. Optional `EXA_API_KEY` is read from the environment and never saved. Failed runs do not advance successful discovery watermarks.

`.github/workflows/discover.yml` runs weekly and supports manual dispatch. It has read-only repository permissions and uploads an artifact only: no commit, push, admission or Pages publication. Extract the workflow artifact under its original `data/discovery/weekly/` path before importing it. The default date window starts at the last imported successful end date for the same country minus overlap, or the corpus cutoff when none exists. The site displays last successful research, last attempt and corpus cutoff separately.

A real local discovery run produced five pending candidates; one wrong-level new-grad result was explicitly rejected, leaving four pending. These are review leads, not new interview records. Search country and provider publication metadata are not admission facts.

After intentional source/assessment changes:

```sh
bun run build
bun run record-changes --date YYYY-MM-DD --id UNIQUE_RELEASE_ID --summary "Describe the change"
bun run build
bun run check
```

`data/history-snapshot.json` is the prior row manifest; `data/change-history.json` records explicit added/corrected/removed rows and before/after fields. Build never mutates history. The initial baseline does not fabricate past changes; older changes remain in Git. The first upgrade records evidence metadata enrichment and the two audit corrections. The page exposes read-only candidate decisions, discovery runs and record history through `data/research-status.json`. Full implementation contracts are in [STUDY_RESEARCH_PLAN.md](STUDY_RESEARCH_PLAN.md).

## Database and reproducibility

```sh
bun run build
bun run check
bun test
```

`build` validates the strict research corpus and a separate supplemental compiler. The strict artifacts remain:

- [`data/database.json`](data/database.json): complete provenance-rich browser dataset, including reports and research coverage.
- [`data/database.csv`](data/database.csv): seven-column spreadsheet view. Formula-like cells are escaped for spreadsheet safety.
- [`data/database.sqlite`](data/database.sqlite): relational database with reports, questions, occurrences, metadata and research coverage. `question_database` is the requested aggregated view.

- `data/unconfirmed.json`, `data/unconfirmed.csv`, `data/unconfirmed.sqlite`: separate final-loop questions with `round: null` and mandatory uncertainty evidence. CSV displays `Unconfirmed`, not R0.
- [`data/research-ledger.json`](data/research-ledger.json): validated campaign scopes, source dispositions and derived outcomes. Source references and repository artifacts are checked during build/check.
- [`data/research-status.json`](data/research-status.json): validated pending/reviewed candidates, research dates and record history; no automatic admissions.

`check` verifies unique IDs, source references, counts, occurrence provenance, SQLite integrity/foreign keys, and agreement between JSON, CSV and SQLite.
The focused compiler suite tests collection isolation, canonical deduplication, promotion collisions, invalid dates, missing uncertainty and misleading campaign outcomes. There is no TypeScript/typecheck command in this plain-JavaScript project.

Example SQLite queries:

```sql
SELECT Round, Question, Topic, Frequency, Dates, Sources, Locations
FROM question_database
ORDER BY Frequency DESC, Round;

SELECT q.round, q.question, o.date, o.date_basis, o.location, r.url,
       o.source_round, o.round_mapping_note, o.evidence
FROM occurrences o
JOIN questions q ON q.id = o.question_id
JOIN reports r ON r.id = o.report_id
WHERE o.location = 'India' AND o.date LIKE '2026%';
```

`reports.details_json` preserves additional source metadata (archive verification, date evidence, aliases and original question records). `occurrences.reported_question` and `reported_topic` preserve report-specific wording alongside canonical labels.

The workflow in `.github/workflows/check.yml` checks committed artifacts, rebuilds, rechecks, and rejects stale generated output. It passed on GitHub Actions for the initial publication.

## Repository map

```text
index.html, app.js, styles.css   Static viewer; no trackers or remote assets
assets/fonts/                   Self-hosted variable fonts and SIL license notices
PLAN.md                          Detailed implementation and research plan
METHODOLOGY.md                   Evidence, date, round and counting policies
RESEARCH_EXPANSION_PLAN.md       Self-grilled decision tree and acceptance spec
data/research/*.json             Source-of-truth research and exclusion ledger
data/assay/**/*.json             Assay evidence certificates and retrieval failures
data/exa/**/*.json               Exa search/fetch responses and source verification
data/research.schema.json        Machine-readable contribution format
data/normalization.json          Reviewed question aliases and adjudications
data/database.{json,csv,sqlite}  Generated database exports
data/unconfirmed/               Supplemental source inputs (never strict counts)
data/campaigns/                 Explicit scoped research-run inputs
data/campaign-evidence/         Retained source/search evidence for campaign runs
data/unconfirmed.{json,csv,sqlite} Separate round-unconfirmed exports
data/research-ledger.json       Generated scoped campaign ledger
scripts/build.js                Deterministic corpus compiler
scripts/check.js                Data integrity and export checks
scripts/serve.js                Local static preview server
.github/workflows/check.yml     Database validation on push/pull request
```

## Add or correct a report

1. Read the original account and verify applicant level, external-hire context, date, final-loop stage and round order.
2. Add it to the appropriate research JSON using `data/research.schema.json` and the example in `PLAN.md`. Location is country-only. Use `Not stated` for absent country evidence; never derive location from a username. Add new evidenced country mappings to `normalization.json`; unrecognized labels fail the build. Historical research quotations retain their original wording.
3. Supply short question/round evidence and original URLs. Retain publicly rendered or archived retrieval URLs if needed. Do not bypass authentication or paywalls.
4. If a report includes OA/screening in its numbering, record the unambiguous final-loop position and preserve `sourceRound` plus `roundMappingNote`.
5. Use the existing canonical key only for an equivalent question. Keep uncertain variants report-specific; keep low-level implementation and high-level architecture questions distinct.
6. Record cross-posts as aliases, not extra independent reports. Use `normalization.json` for reviewed equivalence and exclusion decisions.
7. Run `bun run build` and `bun run check`, inspect the resulting rows in the viewer, and commit the research and generated artifacts together.
8. Update `data/evidence-assessments.json` only for supported quality/link/category decisions. Exact links require a source quotation and exact-named assessment; an algorithmic resemblance is not enough. Record intentional data changes with `bun run record-changes`, then rebuild and commit the history/snapshot with generated artifacts.

If only the final-loop ordinal is unknown, use `data/unconfirmed/*.json` with `data/unconfirmed.schema.json`: retain all other admission evidence, `round: null`, and a precise `roundUncertainty`. Do not put generic or screening-ambiguous leads here. To promote a source/question, add supported numbered evidence to strict inputs and remove the supplemental entry in the same change; the compiler rejects source+canonical-question collisions. Campaign inputs follow `data/campaign.schema.json`, one run per file. Record every returned source as verified, unconfirmed, duplicate, excluded or unresolved; do not invent closed dispositions to make a search look complete.
Supplemental reports must explicitly declare `stage: "final-loop"`; missing, phone-screen and OA stage values are rejected. This machine check supplements, rather than replaces, curator inspection of the required `stageEvidence` quotation.

The window is a fixed research snapshot, not a live feed. To extend it, update the cutoff in `scripts/build.js`, plan/methodology scope and initial HTML text, then research and validate new sources. Do not simply relabel old data as current.

## Publish to GitHub and GitHub Pages

Repository: [AdityaIndoori/amazon-sde2-interview-db](https://github.com/AdityaIndoori/amazon-sde2-interview-db). Site address: [Interview Fieldnotes](https://adityaindoori.github.io/amazon-sde2-interview-db/). Publishing uses the `main` branch root.

For contributions or a fork, configure your own local commit identity if necessary:

```sh
git config user.name "YOUR NAME"
git config user.email "YOUR VERIFIED EMAIL OR GITHUB NOREPLY ADDRESS"
git add .
git commit -m "Add sourced SDE II interview database and explorer"
```

To publish a fork, create an empty repository under your own account and use its actual URL:

```sh
git remote add origin https://github.com/YOUR-ACCOUNT/amazon-sde2-interview-db.git
git push -u origin main
```

For the HTML site: **Settings → Pages → Deploy from a branch → main → /(root) → Save**. `.nojekyll` is included and all assets use relative URLs. The viewer was exercised under `/preview/` as well as `/` to check project-subpath compatibility.

GitHub Pages publishes a public website, even for many private-repository configurations. Review the public evidence excerpts and repository contents before enabling it. See [GitHub's publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Verification performed

- Build and cross-format integrity checks against the complete current corpus.
- Chromium: real dataset load, all seven sortable headers, search, all filters, minimum frequency, same-occurrence location/year exclusion, reset, keyboard activation, evidence expansion and filtered CSV payload.
- All three download endpoints returned complete files; URL filter restoration worked under a project subpath.
- Desktop and 390px mobile screenshots inspected; mobile document width equals viewport width.
- Fetch-failure fallback observed; normal loaded page showed no JavaScript errors during the exercised navigation.
- GitHub Actions validation and Pages deployment passed. The live Pages site loaded all 539 rows; Spain + Round 2 filtering returned the expected source-linked Reorganize String question.

Research coverage and remaining evidence gaps are detailed in [METHODOLOGY.md](METHODOLOGY.md) and the in-page coverage panel.

Independent research; not affiliated with Amazon. Source authors retain rights to their original accounts. Brief excerpts are retained for attribution and auditability; this project does not claim ownership of source publications.
