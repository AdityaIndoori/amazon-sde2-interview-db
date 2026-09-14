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
| Late-2025 expansion | 4 | 17 |
| 2026 recovery expansion | 5 | 29 |
| Expanded source audit | 0 | 7 |
| Assay chronology | 2 | 64 |
| Assay global countries | 0 | 84 |
| Assay pilot | 0 | 5 |
| Assay US 2026 | 0 | 42 |
| Exa historical | 3 | 91 |
| Exa original blogs | 2 | 2 |
| Exa US 2026 | 1 | 46 |
| Recovery: unconfirmed sources | 0 | 5 |
| Recovery: US January–May | 1 | 0 |
| Recovery: US June–September | 0 | 34 |
| **Total strict corpus** | **137** | **1,327** |

The strict result is **590 question–round rows**, **639 occurrences**, and **525 canonical question identities**. Rows by round: R1 179, R2 162, R3 122, R4 127. Source-level date years: 89 accounts in 2025 and 48 in 2026. There are 229 occurrence dates grounded in interview timing and 410 using explicitly labeled publication fallback.

The nineteen strict research files contain297 query/discovery entries, including direct archive API queries. These are a research log, not297 independent web searches. Exclusions are entries, not unique rejected candidate accounts; an account can be excluded in one slice and handled in another. Structured campaigns separately record scoped requests and source dispositions, with overlap in the historical query ledger. Reddit records3,400 archived posts retrieved across overlapping earlier searches, not3,400 unique qualifying interviews.

Slices are research ownership partitions, not guaranteed interview half-years. Year-only interview dates remain year-only even if publication occurred in a later period. For example, the Prime Video account posted in July 2026 describes joining in April but does not give the interview month; the database does not invent one.

## Discovery

Researchers queried SDE2, SDE 2, SDE-II, SDE II and L5 with Amazon, interview experience, rounds, and month/year combinations. Sources included original LeetCode Discuss accounts, candidate Medium and LinkedIn posts, and Reddit accounts. Candidate-linked collections and public archive indexes were used to discover original URLs, not counted as separate evidence.

Reddit research included r/leetcode, r/developersIndia, r/amazonemployees, r/amazonsdeprep, r/FAANGrecruiting, r/cscareerquestions and r/ExperiencedDevs, with role/title variants and date pagination. Some broad queries timed out; narrower partitions recovered additional reports. Comments were not exhaustively crawled.

Original pages were read directly where possible. Public rendering through Jina or Reddit embed was used when ordinary fetching failed. Arctic Shift supplied preserved public Reddit bodies where current pages could not be rendered; `verification`, `archiveRetrievalUrl`, and `retrievedVia` distinguish this evidence. A public archive does not prove a current live post is unchanged. Authenticated and paid content was not bypassed.

## Admission and exclusions

An account admitted to the default Round verified collection must establish:

1. Amazon software-development applicant level SDE II / L5. An interviewer's seniority is not the applicant's level. A Brazil account explicitly labels L5 as Senior locally; it is admitted by L5, not silently treated as L6.
2. External recruiting/application context, or an ordinary external-hire-style account with no internal-transfer evidence. Not every anonymous author explicitly names a current employer; that is a confidence limitation, not independently verified employment history.
3. A defensible in-window interview date or a publication fallback with no known pre-window interview.
4. Final-loop context and a defensible position among the first four loop interviews.
5. A specific disclosed prompt, named problem, or identifiable partial variant. Bare labels such as “DP”, “two LP questions” or “knapsack-style problem” are insufficient.

Rejected/downleveled candidates are included according to the level they interviewed for, not the eventual offer. Incomplete loops are included only for the conducted and clearly mapped rounds. A canceled scheduled round produces a documented gap, never a fictitious question. Fifth/repeat loop interviews are outside the requested four-round view and noted in source limitations/exclusions when disclosed.

Some partial prompts remain useful evidence: a candidate may say “3Sum variant” without the changed constraints. Such rows explicitly say the details were not supplied; they are not a runnable exact reconstruction and are not merged with an unrelated variant. Exact code, solutions and private candidate contact information are not collected.

A report whose technical-screen/final-loop distinction remains ambiguous is retained in the uncertainty ledger rather than included in frequency counts. The Pragadheeshwaran Medium account is one such adjudication; its disclosed questions remain in research data and generated exclusion details, but not the primary table.

The separate Round unconfirmed collection relaxes only requirement4's numbered position, not final-loop stage. It contains31 questions from7 accounts, including verified US and India loops whose question order is missing or contradictory. All use explicit null rounds, written uncertainty reasons, stage:final-loop and separate exports/frequencies. Historical exclusion entries remain an audit trail of the earlier ordinal restriction. Unverified leads and screening-ambiguous accounts stay outside both question collections. One Hissan account contributes a verified R4LMS question and a different unconfirmed restaurant-token question; combined unique accounts are143, not the sum137+7.

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

Locations are countries only in the database, table, filters and exports. Reported role/interview locations—not author residence, nationality, interviewer location or a site's footer—supply the evidence. The reviewed `locationCountries` mapping collapses Seattle and Austin into United States, Indian cities into India, and Dublin into Ireland. Historical research labels and quotations retain their original wording for auditability. An unmapped label fails the build instead of being guessed.

There are six stated countries: Brazil, Canada, India, Ireland, Spain and United States. `Not stated` remains separate when the report does not establish a country. Country normalization does not change independent-report frequencies.

## Viewer and export semantics

Round and topic filters select question rows. Round, topic, country, year and date basis support checkbox multi-selection: OR within a filter, AND between filters, no selection means unrestricted. Search, year, country and date basis filter individual occurrences; at least one selected value from each active filter must match the same occurrence. The viewer then rebuilds frequency, dates, sources and locations and finally applies minimum frequency. This prevents false combinations across unrelated reports. Repeated URL parameters preserve multiple selections; single-value links remain valid.

Every column is sortable. Dates sort by latest visible date; sources by title; locations alphabetically. CSV export follows current filtering and sorting. Full JSON/SQLite downloads ignore active filters. Both preserve source provenance; SQLite also contains complete report details as JSON. Source text is rendered as text, URLs allow only web protocols, and CSV formula-like values are escaped.

`view=unconfirmed` selects the supplemental collection. Round filtering applies in every collection: `round=unconfirmed` selects null-round entries, and numbered values select known ordinals. Multiple values match any selected round; incompatible collection/round choices return no matches. Exported CSV uses Unconfirmed in the round column. No cross-collection frequencies are combined. Promotion requires explicit strict evidence and removal of the same source/question from supplemental input.

All is the default collection; `view=all` selects it explicitly. It combines the row lists for browsing, not their canonical frequencies. Verified and unconfirmed rows remain separate even when a question key is shared. The summary deduplicates report IDs, and each row uses its original collection's source context and local study identity. Selecting only numbered rounds excludes null-round entries; adding `round=unconfirmed` includes them. Shared URLs explicitly record the collection. Combined selection CSV retains each round label; full databases remain separate downloads on the research page.

Structured campaigns under `data/campaigns/` are distinct from historic free-form query logs. Each records country/date search scope, execution time, provider, actual query, artifact and source dispositions. Completed means the request/inspection ran, not exhaustive coverage. Derived outcomes distinguish admitted evidence, unresolved leads, inspected sources with no admissions, no returned candidates and failed execution. No-candidates and failures never mean no interviews exist. Sixteen campaigns are currently recorded; the latest pass added12 runs and93 per-source dispositions. Some candidates remain explicitly unresolved.

## Known coverage gaps

- Later-2025 indexed coverage remains weak, especially December. An expanded pass added October/November accounts and Austin, Texas; a December publication proved to be a duplicate June interview rather than new December evidence. CAPTCHA limited some queries.
- LeetCode/Reddit access failures, deleted posts, login walls and anonymous attribution.
- Paywalled or membership-gated candidate details (including some Exponent/Glassdoor accounts).
- Interviews with disclosed questions but no level, round, date or stage evidence.
- Unindexed, private, non-English and video-only experiences without accessible transcripts.
- Comments and all possible cross-platform aliases are not exhaustively traversed.
- No estimate of true asking frequency or expected interview order is possible from these observations.

Corrections should preserve an audit trail in research JSON, normalization decisions and the exclusion ledger, followed by regeneration and integrity checks. Do not hide uncertainty to increase the row count.

## Expanded gap pass

After initial publication, an additional public-source research pass added nine candidate accounts and 28 occurrences (22 new question–round rows). It targeted October–December2025, January–February2026, previously inaccessible originals and geographic searches. All newly qualified discovered accounts from that pass were extracted; no exhaustive coverage claim is made.

The January/February CodingKaro index yielded three previously uncaptured original LeetCode accounts. A previously excluded Medium account was partially recovered: both conflicting early-order descriptions independently place HLD+HM fourth, so only that LMS question was admitted. Other uncertain positions remain excluded. A new backend Medium account disclosed parking-lot and Ticketmaster design rounds. Older exclusion entries remain an audit history; the expansion entries record later recovery decisions.

The additional geographic/same-author checks found no reliable new account: a 2025 LinkedIn post explicitly referred to the previous year, while related later promotional posts could not establish a coherent interview timeline. It was not admitted by simply treating a republication date as an interview date.

## Assay-assisted research pass

User-requested Assay research covered US2026, Canada, United Kingdom, Germany, Ireland, Spain, Brazil, and chronological gaps. Titles discovery, cost-capped evidence searches and public original-page checks produced two new India accounts: [May2025 L5 loop](https://leetcode.com/discuss/post/6769948/my-amazon-l5-sde-ii-interview-experience-2cj2/) and [February2026 Hyderabad loop](https://leetcode.com/discuss/post/7599995/amazon-sde-2-l5-hyderabad-by-anonymous_u-kxf5/). These add six occurrences and five question–round rows. All twelve retained question/round quotation supports were matched against saved certificate trace IDs, URLs, quotes and character ranges.

The pass also revisited 25 country-unknown2026 reports. Expanded original author replies established India for leetcode-8363946 ("Nope amazon india") and leetcode-7728145 ("Hyd,India"). These are browser-verified source corrections, not Assay-classified geographic guesses. Their `locationEvidence` is visible in expanded source context. No new US2026 account qualified; the gap remains explicit.

Forty-five JSON certificate/error artifacts are retained under `data/assay/`. Thirty-six distinct complete certificate traces report a combined logical cost of USD0.036014. This is not a complete billing total: some failed calls report no cost, and eight additional US discovery envelopes were lost after a worker reset; their recovered discovery arrays and limitation are retained in coverage. Idempotent pilot replay is not double-counted. Source capture timestamps can be September14 UTC while the interview/publication cutoff remains September13.

Assay's searxng backend returned partial failures, rate limits, irrelevant hiring/preparation pages and duplicate accounts. Date filters sometimes rejected undated results rather than establishing that no reports exist. A quotation certificate proves correspondence to fetched text, not candidate authenticity, country, date or relevance. Original publication dates, stage context and country replies remain essential. Public video retellings without a traceable dated original were not admitted. No paywall or authentication gate was bypassed.

## Exa-assisted research pass

Exa was accessed through its documented hosted MCP endpoint, using the live `web_search_advanced_exa` and `web_fetch_exa` schemas. No API key or persistent tool-configuration change was needed for the observed calls. Search/fetch responses and original verification are retained under `data/exa/`; costs were not exposed and are not assumed zero.

This pass added six candidate accounts and24 occurrences (20 new question–round rows). Three late2025 LinkedIn originals and two2026 original blogs had no explicit interview country and remain Not stated. Profile location enrichment, country search terms and image filenames were not accepted as job-country evidence.

For the first time, a US2026 account met admission criteria: [SDEII Redmond virtual onsite](https://www.reddit.com/r/amazonsdeprep/comments/1uhl798/offer_amazon_interview_experience_timeline_oa/), published June28,2026. The full public-post archive names SDEII, Redmond WA, external application, a separate screen and four final-loop rounds. Two same-author crossposts are aliases, not independent counts. Live Reddit retrieval failed; archive verification is stated explicitly. The four prompts are inventory stock management, Amazon S3 design, an unspecified anagram problem, and unspecified decoding strings. Exact anagram/encoding variants are not invented. Publication date does not assert the exact interview date.

Exa yielded more new qualifying accounts in this particular pass than the prior Assay pass, but the searches and starting corpus differed; this is not a controlled provider benchmark. Many Exa results were duplicates, wrong-level experiences, promotional retellings or insufficiently attributed sources. Current-profile summaries in fetched LinkedIn content were separated from the actual post body. The corpus remains non-exhaustive, especially for December interview dates and less represented countries.

## Bounded recovery and monthly US pass

The latest pass ran nine separate publication-month searches for US2026 (January–September13), followed plausible originals, revisited three unresolved ledger leads and inspected five otherwise-qualified ordinal-ambiguous accounts. It added one strict report with four occurrences (three new rows) and five supplemental report memberships with28 questions. Four of those supplemental accounts were new to the combined corpus; Hissan already existed in strict. Net gain: five independent accounts across both collections.

The new strict Meghana Adiga account is publication-dated May5,2026, with explicit OA/screen offsets and four loop prompts. Its country is Not stated; a US-targeted query is not country evidence. The verified US2026 count remains one account. Two newly discovered Redmond crossposts were added as aliases to that existing account, preventing duplicate inflation. One equivalent Amazon Locker LLD canonical key was unified across rounds; this changed neither existing per-round frequencies nor row counts. Unspecified variants and materially different designs remain separate.

Original full Reddit text resolved1oe4q65 as excluded because it contains no actual questions. The InterviewShow narrative remains unattributed and the Hyderabad2.8YOE mirror remains without an independently verified original; these were not admitted. Public source access failures, incomplete text and unresolved screening boundaries remain visible rather than being interpreted as evidence of absence. Original snippets, metadata and campaign requests are preserved under `data/campaign-evidence/recovery-*`.

## Evidence quality and provenance audit

The study upgrade audited all 42 baseline frequency>1 rows using retained occurrence quotations, plus targeted original-source checks. No claim is made that all sources were freshly fetched or candidate identities authenticated. Generic critical feedback in medium-19b9593b32ec was separated from manager-specific feedback (that group falls3→2); the original quote never specified a manager. LeetCode6763561's publication fallback was corrected June10→May20,2025 after original createdAt/updatedAt inspection. The source counts and total occurrences remain unchanged; splitting a grouping creates one additional row. Detailed decisions: `data/provenance-audit.json`.

Evidence quality is independent of round and date confidence. `exact-named` requires an explicit occurrence-level curator assessment and source proof;35 occurrences have supported LeetCode links. `partial` flags unspecified/changed variants; `described` means a reported description, not complete or authenticated evidence. Automatic conservative markers supplement explicit assessments and can be overridden only with recorded reasoning. Filters reaggregate quality and links from matching occurrences, so a hidden exact source cannot lend its link to a partial-only selection. Date labels continue to distinguish interview dates from publication fallback.

Study bookmarks/practiced flags and named public filter sets are browser-local. They are not part of research evidence, source counts, shared URLs or exports. Row identity changes may orphan a local mark rather than silently attach it to a different question.

Incremental Exa discovery has a review queue separate from admitted data. A successful request advances its imported discovery watermark, not the corpus cutoff. Failures and pending candidates never establish admission. Weekly automation uploads review artifacts only, with read-only repository permission; a curator imports, checks provenance and manually changes source data. Last successful research includes completed campaigns and discovery requests, explicitly not exhaustive country/date coverage. The initial real run produced five candidates and one explicit wrong-level rejection; four remain pending.

Record history begins with an explicit baseline, not reconstructed past events. A manual snapshot comparison records added/corrected/removed rows and changed fields. Build/check never mutate the history. The initial enrichment release lists621 row changes: most are metadata enrichment, not newly asked questions. Human-readable release summary distinguishes those from the two substantive audit corrections.
