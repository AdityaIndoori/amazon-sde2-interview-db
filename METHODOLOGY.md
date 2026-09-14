# Evidence and coverage methodology

## What this collection can establish

This repository records questions disclosed in public candidate accounts of Amazon external SDE II / L5 interviews. The snapshot window is **2025-01-01 through 2026-09-13**. The searchable table includes final-loop positions 1–4, not online assessments or phone screens.

It does not establish every question asked inside Amazon. There is no public denominator, official complete question bank, or way to authenticate every anonymous account. Search/indexing/access limitations and self-selection mean the corpus is not representative of interview probabilities.

## Current corpus

| Research slice | Accepted candidate accounts | Exclusion/uncertainty entries |
|---|---:|---:|
| 2025 H1 | 34 | 21 |
| 2025 H2 | 20 | 21 |
| 2026 H1 | 24 | 20 |
| 2026 H2 through cutoff | 7 | 30 |
| Reddit, whole window | 34 | 804 |
| Supplemental source audit | 0 | 5 |
| **Total** | **119** | **901** |

The result is **539 question–round rows**, **577 occurrences**, and **481 canonical question identities**. Rows by round: R1 164, R2 150, R3 109, R4 116. Source-level date years: 81 accounts in 2025 and 38 in 2026. There are 220 occurrence dates grounded in interview timing and 357 using explicitly labeled publication fallback.

The six files contain 160 query/discovery entries, including direct archive API queries. These are a research log, not necessarily 160 independent web searches. Exclusions are entries, not unique rejected candidate accounts; an account can be excluded in one slice and handled in another. Reddit records 3,400 archived posts retrieved across overlapping searches, not 3,400 unique qualifying interviews. Detailed archive pages, failed requests and counts remain in its research JSON and generated coverage discovery metadata.

Slices are research ownership partitions, not guaranteed interview half-years. Year-only interview dates remain year-only even if publication occurred in a later period. For example, the Prime Video account posted in July 2026 describes joining in April but does not give the interview month; the database does not invent one.

## Discovery

Researchers queried SDE2, SDE 2, SDE-II, SDE II and L5 with Amazon, interview experience, rounds, and month/year combinations. Sources included original LeetCode Discuss accounts, candidate Medium and LinkedIn posts, and Reddit accounts. Candidate-linked collections and public archive indexes were used to discover original URLs, not counted as separate evidence.

Reddit research included r/leetcode, r/developersIndia, r/amazonemployees, r/amazonsdeprep, r/FAANGrecruiting, r/cscareerquestions and r/ExperiencedDevs, with role/title variants and date pagination. Some broad queries timed out; narrower partitions recovered additional reports. Comments were not exhaustively crawled.

Original pages were read directly where possible. Public rendering through Jina or Reddit embed was used when ordinary fetching failed. Arctic Shift supplied preserved public Reddit bodies where current pages could not be rendered; `verification`, `archiveRetrievalUrl`, and `retrievedVia` distinguish this evidence. A public archive does not prove a current live post is unchanged. Authenticated and paid content was not bypassed.

## Admission and exclusions

An accepted account must establish:

1. Amazon software-development applicant level SDE II / L5. An interviewer's seniority is not the applicant's level. A Brazil account explicitly labels L5 as Senior locally; it is admitted by L5, not silently treated as L6.
2. External recruiting/application context, or an ordinary external-hire-style account with no internal-transfer evidence. Not every anonymous author explicitly names a current employer; that is a confidence limitation, not independently verified employment history.
3. A defensible in-window interview date or a publication fallback with no known pre-window interview.
4. Final-loop context and a defensible position among the first four loop interviews.
5. A specific disclosed prompt, named problem, or identifiable partial variant. Bare labels such as “DP”, “two LP questions” or “knapsack-style problem” are insufficient.

Rejected/downleveled candidates are included according to the level they interviewed for, not the eventual offer. Incomplete loops are included only for the conducted and clearly mapped rounds. A canceled scheduled round produces a documented gap, never a fictitious question. Fifth/repeat loop interviews are outside the requested four-round view and noted in source limitations/exclusions when disclosed.

Some partial prompts remain useful evidence: a candidate may say “3Sum variant” without the changed constraints. Such rows explicitly say the details were not supplied; they are not a runnable exact reconstruction and are not merged with an unrelated variant. Exact code, solutions and private candidate contact information are not collected.

A report whose technical-screen/final-loop distinction remains ambiguous is retained in the uncertainty ledger rather than included in frequency counts. The Pragadheeshwaran Medium account is one such adjudication; its disclosed questions remain in research data and generated exclusion details, but not the primary table.

## Dates

- Exact interview day when stated.
- Interview month or year when that is all the source supports.
- Publication date when the interview date is unknown; `dateBasis: publication` stays visible.
- Round-specific dates override the report-level date when the source supplies them.
- A report published in-window about a known 2024 interview is excluded.
- “Last updated” is not publication/interview evidence. For example, the GeeksforGeeks virtual-rounds article shown as July 2025 in search was originally published March 2021 and excluded.
- Relative dates are resolved only when anchored by an observed source timestamp; ambiguity retains coarser precision or publication fallback.

Year/month strings describe precision, not January 1 or the first of a month. The viewer preserves this distinction. Sorting is lexical calendar order at available precision; a year-only date cannot be ordered precisely within that year.

## Rounds

Round means a final-loop interview position, not a standardized topic assignment. R1 can be coding, low-level design or high-level design.

Original labels remain in `sourceRound` and short evidence. If the author explicitly numbers OA as Round 1 and the next four interviews as Rounds 2–5, the four loop interviews normalize to 1–4 with an offset note. An explicitly separate screen is similarly excluded. No offset is inferred simply because the first interview is coding.

Where source labels reflect a scheduled round that was canceled, its numbering gap is retained and documented. Where the author explicitly supplies actual rescheduled chronology, that chronology is used with the original labels retained. Ambiguous unordered topic summaries stay outside the table.

## Frequency and normalization

The database groups **canonical question identity + final-loop round**. Frequency is the number of distinct candidate accounts in that group. The same question in R1 and R3 produces separate rows. A repeated mention or copied post does not increase the count.

`data/normalization.json` records reviewed equivalences. Exact algorithm equivalents can share an identity even if phrasing differs. High-level Twitter architecture is separate from the LeetCode Design Twitter coding exercise. An LRU cache with TTL is separate from plain LRU. A lower-median stream is separate from the conventional arithmetic-mean median. Unknown variants are kept separate rather than merged speculatively.

Design prompt families can aggregate conservatively when the same core system and design level are explicit; additional source requirements stay in each occurrence's `reportedQuestion` and evidence. They are not claims of identical interviewer wording. Behavioral prompts with materially different conditions remain separate.

Known syndications are aliases or excluded duplicates, including four repeated playlist-loop LeetCode posts. Suspicious promotional reposts with internally inconsistent changed questions were excluded. Unknown cross-posts may still exist; report counts are best-effort deduplicated, not identity-verified.

## Locations

Locations describe the role/interview location stated in the account, not the author's residence, nationality, interviewer location, or a site's footer. Bengaluru/BLR is displayed as Bangalore, India. Broad country-only labels and multi-city uncertainty remain broad. `Not stated` is never guessed.

There are 13 distinct stated labels, not 13 mutually exclusive geographic markets: for example, India and Bangalore, India are different precisions. Filtering matches the displayed label exactly.

## Viewer and export semantics

Round and topic filters select question rows. Search, year, location and date basis filter individual occurrences; all selected conditions must match one occurrence. The viewer then rebuilds frequency, dates, sources and locations and finally applies minimum frequency. This prevents false combinations across unrelated reports.

Every column is sortable. Dates sort by latest visible date; sources by title; locations alphabetically. CSV export follows current filtering and sorting. Full JSON/SQLite downloads ignore active filters. Both preserve source provenance; SQLite also contains complete report details as JSON. Source text is rendered as text, URLs allow only web protocols, and CSV formula-like values are escaped.

## Known coverage gaps

- Weak later-2025 indexed coverage, especially December, despite monthly/bounded searches; CAPTCHA limited some queries. Reddit adds October/November accounts but does not close the gap.
- LeetCode/Reddit access failures, deleted posts, login walls and anonymous attribution.
- Paywalled or membership-gated candidate details (including some Exponent/Glassdoor accounts).
- Interviews with disclosed questions but no level, round, date or stage evidence.
- Unindexed, private, non-English and video-only experiences without accessible transcripts.
- Comments and all possible cross-platform aliases are not exhaustively traversed.
- No estimate of true asking frequency or expected interview order is possible from these observations.

Corrections should preserve an audit trail in research JSON, normalization decisions and the exclusion ledger, followed by regeneration and integrity checks. Do not hide uncertainty to increase the row count.
