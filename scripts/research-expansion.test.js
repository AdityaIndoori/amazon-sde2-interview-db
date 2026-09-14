import { describe, expect, test } from 'bun:test';
import { compileResearchExpansion } from './research-expansion.js';

const question = overrides => ({ round: null, key: 'lru-cache', question: 'Implement an LRU cache.', topic: 'Data structures / Cache', evidence: 'The candidate reports being asked to implement an LRU cache in the onsite loop.', roundUncertainty: 'The final-loop account lists questions without identifying their sessions.', ...overrides });
const report = overrides => ({ id: 'source-a', url: 'https://example.com/source-a', title: 'Amazon SDE II onsite experience', role: 'SDE II', stage: 'final-loop', stageEvidence: 'Candidate explicitly describes the final onsite loop after passing the phone screen.', location: 'Seattle, United States', date: '2026-03-05', dateBasis: 'interview', questions: [question()], ...overrides });
const fixture = () => ({
  slices: [{ slice: 'recovery', reports: [report()] }],
  strict: { metadata: { startDate: '2025-01-01', endDate: '2026-09-13', reportCount: 0, questionCount: 0, occurrenceCount: 0 }, questions: [], reports: [], coverage: [] },
  normalization: { locationCountries: { 'Seattle, United States': 'United States', 'United States': 'United States', India: 'India', 'Not stated': 'Not stated' }, questionAliases: { 'cache-alias': 'lru-cache' }, reportAliases: { 'cross-post': 'source-a' } },
  campaigns: [],
});
const campaign = overrides => ({ id: 'us-spring', country: 'United States', startDate: '2026-01-01', endDate: '2026-06-30', searchedAt: '2026-09-14T10:00:00Z', provider: 'Exa', queries: ['Amazon SDE II onsite United States spring 2026'], artifact: 'data/exa/us-spring.json', status: 'completed', sources: [{ url: 'https://example.com/source-a', disposition: 'unconfirmed', reason: 'Explicit final loop, question given without a session number.', reportId: 'source-a' }], ...overrides });

describe('supplemental compilation boundaries', () => {
  test('rejects supplemental records without an explicit final-loop stage', () => {
    const input = fixture();
    for (const stage of [undefined, 'phone-screen', 'online-assessment']) {
      input.slices[0].reports[0].stage = stage;
      expect(() => compileResearchExpansion(input)).toThrow('final-loop stage');
    }
  });

  test('keeps strict data untouched and supplemental frequencies independent', () => {
    const input = fixture();
    input.strict.reports = [report({ id: 'strict-only', url: 'https://example.com/strict', location: 'United States', questions: [question({ round: 2 })] })];
    input.strict.metadata = { ...input.strict.metadata, reportCount: 1, questionCount: 1, occurrenceCount: 1 };
    const before = structuredClone(input);
    const { unconfirmed } = compileResearchExpansion(input);
    expect(input).toEqual(before);
    expect(unconfirmed.metadata.reportCount).toBe(1);
    expect(unconfirmed.questions[0].frequency).toBe(1);
    expect(unconfirmed.questions[0].round).toBeNull();
    expect(unconfirmed.questions[0].sources.map(s => s.id)).toEqual(['source-a']);
    expect(unconfirmed.questions[0].occurrences[0].roundMappingNote).toBe(question().roundUncertainty);
    expect(unconfirmed.reports[0].location).toBe('United States');
  });

  test('deduplicates canonical questions and aliased reports while retaining evidence', () => {
    const input = fixture();
    input.slices.push({ slice: 'cross-post-review', reports: [report({ id: 'cross-post', url: 'https://example.com/cross-post', questions: [question({ key: 'cache-alias', evidence: 'A cross-post independently repeats the cache prompt.', roundUncertainty: 'Cross-post also omits the round number.' })] })] });
    const result = compileResearchExpansion(input).unconfirmed;
    expect(result.metadata.occurrenceCount).toBe(1);
    expect(result.questions[0].frequency).toBe(1);
    expect(result.questions[0].occurrences[0].evidence).toContain('cross-post independently');
    expect(result.questions[0].occurrences[0].roundUncertainty).toContain('Cross-post also');
    expect(result.reports[0].aliases).toContain('https://example.com/cross-post');
  });

  test('rejects conflicting dates for a deduplicated occurrence', () => {
    const input = fixture();
    input.slices[0].reports[0].questions.push(question({ key: 'cache-alias', date: '2026-03-06' }));
    expect(() => compileResearchExpansion(input)).toThrow('Conflicting duplicate occurrence date');
  });

  test('rejects a source URL claimed under a different report ID', () => {
    const input = fixture();
    input.slices[0].reports.push(report({ id: 'different-id', url: 'https://example.com/mirror', aliases: ['https://example.com/source-a'] }));
    expect(() => compileResearchExpansion(input)).toThrow('Duplicate source');
  });

  test('requires explicit removal of an aliased question when promoting to verified', () => {
    const input = fixture();
    input.strict.reports = [report({ location: 'United States', questions: [question({ round: 2 })] })];
    input.slices[0].reports[0].id = 'cross-post';
    input.slices[0].reports[0].questions[0].key = 'cache-alias';
    expect(() => compileResearchExpansion(input)).toThrow('Verified/unconfirmed duplicate');
    input.slices[0].reports[0].questions = [question({ key: 'different-question', question: 'Design a notification service.' })];
    expect(compileResearchExpansion(input).unconfirmed.metadata.occurrenceCount).toBe(1);
  });

  test('rejects missing uncertainty and a missing or numbered round', () => {
    const input = fixture();
    delete input.slices[0].reports[0].questions[0].roundUncertainty;
    expect(() => compileResearchExpansion(input)).toThrow('round uncertainty');
    input.slices[0].reports[0].questions = [question({ round: undefined })];
    expect(() => compileResearchExpansion(input)).toThrow('explicitly null');
    input.slices[0].reports[0].questions = [question({ round: 1 })];
    expect(() => compileResearchExpansion(input)).toThrow('explicitly null');
  });

  test('rejects rollover calendar dates and known pre-window interviews', () => {
    const input = fixture();
    input.slices[0].reports[0].date = '2026-02-30';
    expect(() => compileResearchExpansion(input)).toThrow('Invalid calendar');
    input.slices[0].reports[0].date = '2026-02';
    expect(compileResearchExpansion(input).unconfirmed.questions[0].dates).toEqual([{ date: '2026-02', basis: 'interview' }]);
    input.slices[0].reports[0].interviewDate = '2024-12';
    expect(() => compileResearchExpansion(input)).toThrow('known pre-window interview');
  });
});

describe('campaign provenance and outcomes', () => {
  test('does not claim source inspection when a completed search returns no candidates', () => {
    const input = fixture();
    input.campaigns = [campaign({ sources: [] })];
    expect(compileResearchExpansion(input).ledger.campaigns[0].outcome).toBe('no-candidates-returned');
  });

  test('scope does not supply a report country or occurrence date', () => {
    const input = fixture();
    input.campaigns = [campaign({ country: 'India', startDate: '2025-10-01', endDate: '2025-12-31' })];
    const { unconfirmed, ledger } = compileResearchExpansion(input);
    expect(unconfirmed.questions[0].locations).toEqual(['United States']);
    expect(unconfirmed.questions[0].dates).toEqual([{ date: '2026-03-05', basis: 'interview' }]);
    expect(ledger.campaigns[0].outcome).toBe('admitted-evidence');
  });

  test('admission references must exist in the claimed collection and match their URL', () => {
    const input = fixture();
    input.campaigns = [campaign()];
    input.campaigns[0].sources[0].reportId = 'missing';
    expect(() => compileResearchExpansion(input)).toThrow('report reference');
    input.campaigns[0].sources[0].reportId = 'source-a';
    input.campaigns[0].sources[0].disposition = 'verified';
    expect(() => compileResearchExpansion(input)).toThrow('report reference');
    input.campaigns[0].sources[0].disposition = 'unconfirmed';
    input.campaigns[0].sources[0].url = 'https://example.com/unrelated';
    expect(() => compileResearchExpansion(input)).toThrow('report reference');
  });

  test('distinguishes unresolved discovery, inspected exclusions and provider failures', () => {
    const input = fixture();
    const source = { url: 'https://example.com/lead', disposition: 'unresolved', reason: 'Original page unavailable.' };
    input.campaigns = [campaign({ sources: [source] })];
    expect(compileResearchExpansion(input).ledger.campaigns[0].outcome).toBe('unresolved');
    source.disposition = 'excluded';
    source.reason = 'Inspected original describes only a phone screen.';
    expect(compileResearchExpansion(input).ledger.campaigns[0].outcome).toBe('inspected-no-admissions');
    input.campaigns[0].status = 'failed';
    expect(() => compileResearchExpansion(input)).toThrow('failed campaign error');
    input.campaigns[0].error = 'Provider unavailable.';
    expect(compileResearchExpansion(input).ledger.campaigns[0].outcome).toBe('failed');
  });

  test('rejects invalid scope dates, reversed windows and unsafe artifacts', () => {
    const input = fixture();
    input.campaigns = [campaign({ startDate: '2026-02-29' })];
    expect(() => compileResearchExpansion(input)).toThrow('Invalid calendar');
    input.campaigns[0].startDate = '2026-07-01';
    expect(() => compileResearchExpansion(input)).toThrow('reversed campaign scope');
    input.campaigns[0].startDate = '2026-01-01';
    input.campaigns[0].artifact = 'data/../.env';
    expect(() => compileResearchExpansion(input)).toThrow('Unsafe campaign artifact');
  });
});
