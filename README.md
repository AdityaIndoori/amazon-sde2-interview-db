# Amazon SDE II Interview Fieldnotes

An evidence-backed database and static HTML explorer of publicly reported **Amazon external SDE II / L5 final-loop questions**, covering **January 1, 2025 through September 13, 2026**.

**586 question–round rows · 635 reported occurrences · 136 candidate accounts · 6 stated countries.** These are 523 conservatively normalized question identities across rounds. Counts are public-report frequencies, not Amazon's internal asking rates.

> This is not ALL questions asked at Amazon. No public source can establish that. This repository contains the qualifying accounts discovered in the documented research, with 286 search/query entries and 1,288 exclusion or uncertainty entries. Private, deleted, inaccessible, unindexed, vague and ambiguously staged reports remain coverage gaps. Candidate accounts are self-reported, not independently authenticated.

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

## Database and reproducibility

```sh
bun run build
bun run check
```

`build` validates and combines research files, applies the explicit normalization registry, deduplicates report/question occurrences, and writes three artifacts:

- [`data/database.json`](data/database.json): complete provenance-rich browser dataset, including reports and research coverage.
- [`data/database.csv`](data/database.csv): seven-column spreadsheet view. Formula-like cells are escaped for spreadsheet safety.
- [`data/database.sqlite`](data/database.sqlite): relational database with reports, questions, occurrences, metadata and research coverage. `question_database` is the requested aggregated view.

`check` verifies unique IDs, source references, counts, occurrence provenance, SQLite integrity/foreign keys, and agreement between JSON, CSV and SQLite.

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
data/research/*.json             Source-of-truth research and exclusion ledger
data/assay/**/*.json             Assay evidence certificates and retrieval failures
data/exa/**/*.json               Exa search/fetch responses and source verification
data/research.schema.json        Machine-readable contribution format
data/normalization.json          Reviewed question aliases and adjudications
data/database.{json,csv,sqlite}  Generated database exports
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
