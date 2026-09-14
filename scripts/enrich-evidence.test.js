import { describe, expect, test } from 'bun:test';
import { enrichEvidence } from './enrich-evidence.js';

const occurrence = overrides => ({ reportId: 'source-a', date: '2026-03-05', dateBasis: 'publication', location: 'Not stated', evidence: 'The candidate describes implementing an LRU cache.', reportedQuestion: 'Implement an LRU cache.', reportedTopic: 'Data structures / Cache', sourceRound: 'Round 2', roundMappingNote: 'Source numbers this interview as round 2.', ...overrides });
const row = overrides => ({ id: 'r2-lru-cache', round: 2, question: 'Implement an LRU cache.', topic: 'Data structures / Cache', frequency: 1, dates: [{ date: '2026-03-05', basis: 'publication' }], locations: ['Not stated'], sources: [{ id: 'source-a', title: 'Candidate account', url: 'https://example.com/source-a' }], occurrences: [occurrence()], ...overrides });
const collection = questions => ({ metadata: { questionCount: questions.length, reportCount: 1, occurrenceCount: questions.reduce((count, q) => count + q.occurrences.length, 0) }, questions, reports: [{ id: 'source-a', url: 'https://example.com/source-a' }], coverage: [{ limitations: ['Candidate accounts are not independently authenticated.'] }] });
const exact = overrides => ({ quality: 'exact-named', reason: 'The cited source explicitly names the problem.', problemEvidence: 'Round 2: LRU Cache (LeetCode 146).', problemUrl: 'https://leetcode.com/problems/lru-cache/', ...overrides });
const registry = assessment => ({ occurrences: { 'source-a|2|lru-cache': assessment } });
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};

// These tests defend occurrence-level claims, not the canonical grouping slug.
describe('evidence quality boundaries', () => {
  test('does not infer an exact match or link from a named prompt and canonical slug', () => {
    const result = enrichEvidence(collection([row({ occurrences: [occurrence({ evidence: 'Round 2: LRU Cache (LeetCode 146).' })] })]));
    expect(result.questions[0].occurrences[0].evidenceQuality).toBe('described');
    expect(result.questions[0].occurrences[0]).not.toHaveProperty('problemUrl');
    expect(result.questions[0].occurrences[0]).not.toHaveProperty('problemEvidence');
  });

  test('detects a reported variant even when the normalized row hides the uncertainty', () => {
    const input = collection([row({ occurrences: [occurrence({ reportedQuestion: 'Solve a variation of LRU Cache.', evidence: 'LRU Cache with unspecified changes.' })] })]);
    expect(enrichEvidence(input).questions[0].occurrences[0].evidenceQuality).toBe('partial');
  });

  test('uses occurrence evidence independently from the reported prompt', () => {
    const input = collection([row({ occurrences: [occurrence({ evidence: 'A cache problem; exact restrictions were not disclosed.' })] })]);
    expect(enrichEvidence(input).questions[0].occurrences[0].evidenceQuality).toBe('partial');
  });

  test('keeps source round uncertainty and ordinary design analogy separate from prompt quality', () => {
    const input = collection([row({ topic: 'System design / Video', occurrences: [occurrence({ reportedQuestion: 'Design a video service similar to YouTube.', evidence: 'Design a video service.', roundMappingNote: 'The source round is unspecified.' })] })]);
    expect(enrichEvidence(input).questions[0].occurrences[0].evidenceQuality).toBe('described');
    input.questions[0].occurrences[0].reportedQuestion = 'Design a video service; exact requirements are not supplied.';
    expect(enrichEvidence(input).questions[0].occurrences[0].evidenceQuality).toBe('partial');
  });

  test('keeps mixed source qualities and exact links scoped to the assessed occurrence', () => {
    const input = collection([row({ frequency: 3, occurrences: [occurrence({ reportId: 'source-b', reportedQuestion: 'Solve an LRU Cache variant.' }), occurrence(), occurrence({ reportId: 'source-c' })] })]);
    const result = enrichEvidence(input, registry(exact()));
    const enriched = result.questions[0];
    expect(enriched.evidenceQualities).toEqual(['exact-named', 'described', 'partial']);
    expect(enriched.occurrences.map(o => o.evidenceQuality)).toEqual(['partial', 'exact-named', 'described']);
    expect(enriched.occurrences[1].problemUrl).toBe('https://leetcode.com/problems/lru-cache/');
    expect(enriched.occurrences[0]).not.toHaveProperty('problemUrl');
    expect(enriched.occurrences[2]).not.toHaveProperty('problemUrl');
    expect(enriched.frequency).toBe(3);
  });

  test('allows explicit curator resolution and removes stale claims on re-enrichment', () => {
    const input = collection([row({ occurrences: [occurrence({ evidence: 'A variation is mentioned in the surrounding account.' })] })]);
    const result = enrichEvidence(input, registry(exact()));
    expect(result.questions[0].occurrences[0].evidenceQuality).toBe('exact-named');
    const reassessed = enrichEvidence(result, registry({ quality: 'partial', reason: 'The cited variant does not identify its changed rules.' }));
    expect(reassessed.questions[0].evidenceQualities).toEqual(['partial']);
    expect(reassessed.questions[0].occurrences[0]).not.toHaveProperty('problemUrl');
    expect(reassessed.questions[0].occurrences[0]).not.toHaveProperty('problemEvidence');
    const removed = enrichEvidence(result);
    expect(removed.questions[0].occurrences[0].evidenceQuality).toBe('partial');
    expect(removed.questions[0].occurrences[0]).not.toHaveProperty('problemUrl');
  });
});

describe('explicit proof and safe practice links', () => {
  test('requires source proof for exact-named claims even without a practice link', () => {
    expect(() => enrichEvidence(collection([row()]), registry({ quality: 'exact-named', reason: 'Assumed from canonical key.' }))).toThrow();
    const result = enrichEvidence(collection([row()]), registry({ quality: 'exact-named', reason: 'Explicit name in source.', problemEvidence: 'Round 2: LRU Cache.' }));
    expect(result.questions[0].occurrences[0].evidenceQuality).toBe('exact-named');
    expect(result.questions[0].occurrences[0]).not.toHaveProperty('problemUrl');
  });

  test('rejects links for partial or described assessments rather than silently promoting them', () => {
    for (const quality of ['partial', 'described']) {
      expect(() => enrichEvidence(collection([row()]), registry(exact({ quality })))).toThrow();
    }
  });

  test('rejects unsafe URLs, unrelated pages and misleading normalized problem paths', () => {
    const urls = [
      'javascript:alert(1)',
      'http://leetcode.com/problems/lru-cache/',
      'https://leetcode.com.evil.example/problems/lru-cache/',
      'https://leetcode.com@evil.example/problems/lru-cache/',
      'https://user:secret@leetcode.com/problems/lru-cache/',
      'https://leetcode.com:444/problems/lru-cache/',
      'https://leetcode.com/discuss/post/123/',
      'https://leetcode.com/problems/',
      'https://leetcode.com/problems/lru-cache/solutions/',
      'https://leetcode.com/problems/lru-cache/?redirect=https://evil.example',
      'https://leetcode.com/problems/lru-cache/#discussion',
      'https://leetcode.com/problems/../problems/lru-cache/',
      'https://leetcode.com/problems/%6cru-cache/',
      'https://leetcode.com\\problems\\lru-cache\\',
      'https://leetcode.com/problems/lru-cache/\n',
    ];
    for (const problemUrl of urls) expect(() => enrichEvidence(collection([row()]), registry(exact({ problemUrl })))).toThrow();
    expect(enrichEvidence(collection([row()]), registry(exact({ problemUrl: 'https://www.leetcode.com/problems/lru-cache' }))).questions[0].occurrences[0].problemUrl).toBe('https://www.leetcode.com/problems/lru-cache');
  });
});

describe('category mapping and registry boundaries', () => {
  test('uses primary topics without confusing design algorithms or cross-topic mentions', () => {
    const topics = ['Data structures / Design', 'Low-level design / Parsing', 'System design / Generative AI', 'Behavioral / Generative AI', 'GenAI / Code verification', 'Project deep dive', 'Randomized algorithms / Low-level design'];
    const input = collection(topics.map((topic, index) => row({ id: `r2-topic-${index}`, topic })));
    expect(enrichEvidence(input).questions.map(q => q.category)).toEqual(['Coding', 'Low-level design', 'System design', 'Behavioral', 'GenAI', 'Project deep dive', 'Coding']);
  });

  test('requires an explicit override for ambiguous topics and applies it across rounds', () => {
    const input = collection([row({ topic: 'Design' }), row({ id: 'r3-lru-cache', round: 3, topic: 'Design' })]);
    expect(() => enrichEvidence(input)).toThrow();
    expect(enrichEvidence(input, { categories: { 'lru-cache': 'Low-level design' } }).questions.map(q => q.category)).toEqual(['Low-level design', 'Low-level design']);
    expect(() => enrichEvidence(input, { categories: { 'lru-cache': 'LLD' } })).toThrow();
  });

  test('checks targets in each collection while accepting a registry shared by both', () => {
    const assessments = { occurrences: { 'source-a|2|lru-cache': exact(), 'source-b|unconfirmed|lru-cache': { quality: 'described', reason: 'Cache prompt reported without a final-loop session number.' } } };
    expect(enrichEvidence(collection([row()]), assessments).questions[0].evidenceQualities).toEqual(['exact-named']);
    const supplemental = collection([row({ id: 'u-lru-cache', round: null, occurrences: [occurrence({ reportId: 'source-b', roundUncertainty: 'No ordinal supplied.' })] })]);
    supplemental.metadata.collection = 'unconfirmed';
    expect(enrichEvidence(supplemental, assessments).questions[0].evidenceQualities).toEqual(['described']);
    expect(() => enrichEvidence(collection([row()]), { occurrences: { 'source-a|3|lru-cache': exact() } })).toThrow();
    expect(() => enrichEvidence(supplemental, { occurrences: { 'missing|unconfirmed|lru-cache': exact() } })).toThrow();
  });

  test('rejects malformed targets, invalid quality and empty assessment reasons', () => {
    for (const target of ['source-a|2', 'source-a|0|lru-cache', 'source-a|2|LRU', 'source-a|2|lru-cache|extra']) {
      expect(() => enrichEvidence(collection([row()]), { occurrences: { [target]: exact() } })).toThrow();
    }
    expect(() => enrichEvidence(collection([row()]), registry(exact({ quality: 'verified' })))).toThrow();
    expect(() => enrichEvidence(collection([row()]), registry(exact({ reason: ' ' })))).toThrow();
  });

  test('preserves identity, counts and provenance without mutating frozen input or registry', () => {
    const input = freeze(collection([row()]));
    const assessments = freeze(registry(exact()));
    const before = structuredClone(input);
    const assessmentBefore = structuredClone(assessments);
    const result = enrichEvidence(input, assessments);
    expect(input).toEqual(before);
    expect(assessments).toEqual(assessmentBefore);
    expect(result.metadata).toEqual(before.metadata);
    expect(result.reports).toEqual(before.reports);
    expect(result.coverage).toEqual(before.coverage);
    const { category, evidenceQualities, occurrences, ...originalRow } = result.questions[0];
    const { occurrences: originalOccurrences, ...expectedRow } = before.questions[0];
    expect(originalRow).toEqual(expectedRow);
    const { evidenceQuality, qualityReason, problemUrl, problemEvidence, ...originalOccurrence } = occurrences[0];
    expect(originalOccurrence).toEqual(originalOccurrences[0]);
  });
});
