# Amazon SDE II interview database — execution plan

## Scope and deliverables

Build a GitHub-ready git repository containing an evidence-backed database of publicly reported Amazon external SDE II / L5 final-loop questions from 2025-01-01 through 2026-09-13, and a clean static HTML viewer. Required columns: Round, Question, Topic, Frequency, List of dates, List of sources, List of locations.

Public reports cannot prove all questions asked internally. The collection will cover all qualifying reports discovered in the documented search, with explicit exclusions and access gaps; never label the corpus exhaustive. No publishing or remote repository creation until authorized.

## Evidence rules

- Include final-loop rounds 1–4 only; exclude online assessments, phone screens, internal transfers, SDE I and SDE III.
- Round means final-loop position 1–4. Preserve original labels in `sourceRound`. Where the author explicitly includes OA/screens in numbering, normalize only an unambiguous final-loop sequence and document the offset in `roundMappingNote`; otherwise exclude ambiguous assignments. Do not assume a fixed topic order or infer a day from a round.
- Prefer first-person candidate accounts. A rendered copy of an original report is acceptable with retrieval URL retained. Do not bypass authentication or paywalls.
- Record concise quotations tying each question to its round and retain source-level role, date, location and stage evidence.
- Interview date is preferred. If unavailable, use publication date explicitly labeled as such. Preserve month/year precision, not invented days. Reports with no usable in-window date stay in the excluded/uncertain ledger.
- Location is country-only, supported by the report; missing country evidence is `Not stated`. Reviewed country mappings normalize historical source labels at build time, while source quotations retain original wording. Do not infer location from username or nationality.
- Record specific behavioral/GenAI questions when supplied, not generic Leadership Principle labels masquerading as questions.
- A question's frequency is the count of distinct candidate reports for that question and round. Cross-posts are one report; repeated mentions within one report are one occurrence. It is not an estimate of Amazon's asking rate.
- Merge equivalent questions conservatively, preserving materially different follow-ups as separate questions and preserving all evidence.

## Architecture and contracts

The published viewer requires no frontend framework, account, server database or paid API. Bun builds checked-in JSON, CSV and SQLite from provenance-rich JSON research files. HTML/CSS/JavaScript reads generated JSON. GitHub Pages serves the repository root unchanged. Optional research tooling now includes user-requested Assay discovery and evidence retrieval, with costs and certificates retained separately from the runtime.

Assay expansion: evaluate a cost-capped pilot, research US2026/global-country/chronological gaps independently, preserve full certificates under `data/assay/`, admit only source-verified additions, retain ambiguous leads and failures in coverage, rebuild/verify exports, then publish and inspect the live site. Certificate quotation spans prove correspondence to fetched text, not candidate authenticity or exhaustive coverage.

Exa expansion: connect to the official hosted MCP endpoint, inspect its live tool schemas, use structured date-filtered semantic search and content fetch, preserve response artifacts under `data/exa/`, verify original applicant/round/country/date evidence and deduplicate cross-posts, then rebuild and publish only qualified records. No API key or persistent harness configuration change was needed for the observed hosted endpoint; search-provider geography is not source-country evidence.

### Research file contract

Each `data/research/<slice>.json` contains:

```json
{
  "slice": "2025-h1",
  "searchedAt": "2026-09-13",
  "queries": ["actual search query"],
  "reports": [{
    "id": "leetcode-1234567",
    "url": "https://leetcode.com/discuss/post/.../",
    "retrievedVia": "https://r.jina.ai/https://leetcode.com/discuss/post/.../",
    "title": "Original title",
    "publishedDate": "2025-03-12",
    "interviewDate": "2025-03",
    "date": "2025-03",
    "dateBasis": "interview",
    "location": "India",
    "role": "SDE II",
    "stageEvidence": "Short quotation establishing role and final loop",
    "questions": [{
      "round": 1,
      "sourceRound": "Round 1 — Coding",
      "roundMappingNote": "Source numbers the final loop separately; no offset.",
      "key": "container-with-most-water",
      "question": "Find two vertical lines enclosing the largest area of water.",
      "topic": "Arrays / Two pointers",
      "evidence": "Short quotation establishing question and round"
    }]
  }],
  "excluded": [{"url": "https://...", "reason": "OA only / inaccessible / ambiguous level / no date"}],
  "limitations": ["Specific search or access limitations"]
}
```

Use null for unknown publishedDate/interviewDate, but date must be a defensible ISO date, month or year. Allowed dateBasis: interview, publication. A report can have `aliases` URLs for identified cross-posts. Questions may override `date` and `dateBasis` when exact round dates are given. Do not put solution content or personal information into the corpus.

### Generated viewer contract

`data/database.json`: `{ metadata, questions, reports, coverage }`.

- metadata: title, startDate, endDate, generatedAt, frequencyDefinition, disclaimer.
- questions: `{ id, round, question, topic, frequency, dates: [{date,basis}], sources: [{id,title,url}], locations: [string], occurrences: [{reportId,date,dateBasis,location,evidence,sourceRound,roundMappingNote}] }`.
- reports: canonical reports including question evidence.
- coverage: search queries, exclusions, limitations by slice.
- Frequency after filtering counts distinct matching report IDs. Dates, sources and locations shown must derive from the same matching occurrences, not independent cross-matches.

## Execution sequence

1. Initialize repository and contracts; write this detailed plan before implementation.
2. Research independent periods: 2025 H1, 2025 H2, 2026 H1, 2026 H2 to cutoff; separately inspect Reddit candidate accounts. Search multiple role spellings and rounds, traverse related report links, record query/access coverage.
3. In parallel, build responsive static viewer against the contract: full-text search, round/topic/location/year filters, sortable columns, source links, evidence details, live counts, reset, empty/error states, CSV export and downloadable JSON/SQLite. Include coverage/methodology panel and clear date/frequency meanings.
4. Integrate all research; review every accepted report's role/stage/date and every round/question evidence mapping. Deduplicate sources and canonical questions. Never inflate counts from mirrors or vague topic labels.
5. Build validated JSON, CSV and SQLite, with foreign keys and occurrence-level provenance. Maintain one source of truth in research JSON. Provide reproducible build/check commands.
6. Run data validation and meaningful integrity checks. Launch actual static server and exercise search, sorting, combined occurrence-level filtering, reset, exports and narrow-screen layout in Chromium. Inspect screenshots and console errors.
7. After successful smoke verification, finalize README, methodology, contribution and GitHub Pages publishing instructions, remove temporary artifacts, commit repository locally if git identity is available. Do not push or create a remote.
8. Report corpus size, dates, source coverage and known completeness limits with exact verified behavior and repository path.

## Acceptance criteria

- Seven requested columns populated from actual sourced observations, including explicit missing-location values.
- Every frequency traceable to unique candidate reports and every row to a round-specific evidence quote.
- All accepted reports have defensible dates within the window; no screening/other-level items silently mixed in.
- JSON/CSV/SQLite agree; build rejects malformed or unsupported provenance.
- Viewer works locally and from a GitHub Pages project subpath; safe text rendering of untrusted report content; no secrets or trackers.
- A clean, initialized git repository with runnable commands and honest coverage documentation, ready for user-authorized GitHub publication.

## Execution record

- Repository finalized at `/home/aditya/amazon-sde2-interview-db` (moved out of temporary storage).
- Delivered 586 question–round rows, 635 occurrences, 136 candidate accounts, JSON/CSV/SQLite exports, and the seven-column static viewer after the user-requested Exa research pass.
- Recorded 286 discovery/query entries and 1,288 exclusion/uncertainty entries; coverage limits are explicit in METHODOLOGY.md.
- Build/check passed; all three artifacts were byte-identical across regeneration.
- Chromium exercised loaded data, seven sort controls, filters, source/evidence expansion, CSV export, keyboard reset, project-subpath navigation and 390px mobile layout.
- Git initialized on main; the user subsequently authorized GitHub publication and interactively authenticated as AdityaIndoori. Target: `AdityaIndoori/amazon-sde2-interview-db`, with GitHub Pages from the main branch root.
- The literal set of ALL internally asked questions remains unknowable from public reports; the deliverable is a documented, reproducible public-report corpus rather than a claim of exhaustive coverage.
- Following the explicit coverage choice, expanded late-2025 and early-2026 research added nine candidate accounts and 28 occurrences without claiming exhaustiveness. Newly discovered qualifying accounts from that gap pass were fully extracted; remaining gated/ambiguous sources stay documented.
