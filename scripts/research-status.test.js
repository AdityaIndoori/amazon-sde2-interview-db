import { describe, expect, test } from 'bun:test';
import { canonicalUrl, compileResearchStatus, emptyQueue, validateQueue } from './research-status.js';
import { candidateId, discoveryWindow, parseMcpResponse, pendingCandidates, reviewQueuePath, searchResults } from './discover.js';
import { mergeDiscovery } from './import-discovery.js';
import { reviewCandidate } from './review-queue.js';

const run = overrides => ({ id: 'discovery-one', startedAt: '2026-09-14T10:00:00Z', completedAt: '2026-09-14T10:01:00Z', status: 'successful', country: 'India', startDate: '2026-09-01', endDate: '2026-09-13', queries: ['Amazon SDE II India interview'], artifact: 'data/discovery/one.json', ...overrides });
const candidate = overrides => ({ id: candidateId('https://example.com/new'), url: 'https://example.com/new', title: 'Candidate experience', discoveredAt: '2026-09-14T10:00:00Z', runIds: ['discovery-one'], status: 'pending', ...overrides });
const collections = () => ({
  strict: { metadata: { endDate: '2026-09-13' }, reports: [{ id: 'strict-one', url: 'https://example.com/known', aliases: ['https://leetcode.com/discuss/post/123/old-title/'] }], questions: [{ id: 'r1-cache' }] },
  unconfirmed: { metadata: { endDate: '2026-09-13' }, reports: [{ id: 'supplement-one', url: 'https://example.com/supplement', aliases: [] }], questions: [] },
});
const queue = () => ({ version: 1, runs: [run()], candidates: [candidate()] });

describe('research watermark and references', () => {
  test('later failures advance attempted time but not successful research or corpus cutoff', () => {
    const input = { collections: collections(), queue: queue(), history: { version: 1, releases: [] }, campaigns: [] };
    input.queue.runs.push(run({ id: 'failed', status: 'failed', startedAt: '2026-09-15T10:00:00Z', completedAt: '2026-09-15T10:01:00Z', endDate: '2026-09-15', error: 'Provider unavailable' }));
    const before = structuredClone(input);
    const result = compileResearchStatus(input);
    expect(result.lastResearchedAt).toBe('2026-09-14T10:01:00Z');
    expect(result.lastAttemptedAt).toBe('2026-09-15T10:01:00Z');
    expect(result.cutoff).toBe('2026-09-13');
    expect(discoveryWindow({ end: '2026-09-16', country: 'India', overlap: 2 }, input.queue, result.cutoff)).toEqual({ startDate: '2026-09-11', endDate: '2026-09-16' });
    expect(input).toEqual(before);
  });

  test('completed campaigns participate in successful research independently of discovery', () => {
    const result = compileResearchStatus({ collections: collections(), queue: emptyQueue(), history: [], campaigns: [{ id: 'manual-research', searchedAt: '2026-09-16', status: 'completed', artifact: 'data/campaign-evidence/manual.json', sources: [] }] });
    expect(result.lastResearchedAt).toBe('2026-09-16');
    expect(result.lastAttemptedAt).toBe('2026-09-16');
    expect(result.cutoff).toBe('2026-09-13');
  });

  test('rejects unknown candidate run references and invalid accepted report references', () => {
    const input = queue();
    input.candidates[0].runIds = ['missing'];
    expect(() => validateQueue(input, collections())).toThrow('run reference');
    input.candidates[0] = candidate({ status: 'accepted', reason: 'Curator decision', reportId: 'strict-one' });
    expect(() => validateQueue(input, collections())).toThrow('admitted report URL');
  });

  test('history references current rows or explicit historical snapshots, never invented IDs', () => {
    const input = { collections: collections(), queue: emptyQueue(), campaigns: [], history: [{ id: 'release', date: '2026-09-14', summary: 'Source correction', changes: [{ collection: 'strict', id: 'removed-row', type: 'removed', before: { id: 'removed-row', question: 'Old question' } }] }] };
    expect(compileResearchStatus(input).history[0].changes[0].type).toBe('removed');
    delete input.history[0].changes[0].before;
    expect(() => compileResearchStatus(input)).toThrow('Unresolved history row');
  });

  test('failure and publication date validation cannot silently create a watermark', () => {
    const input = queue();
    input.runs[0].status = 'failed';
    expect(() => validateQueue(input, collections())).toThrow('failed run error');
    input.runs[0] = run();
    input.candidates[0].publishedDate = '2026-02-30';
    expect(() => validateQueue(input, collections())).toThrow('calendar');
  });
});

describe('bounded discovery and conservative deduplication', () => {
  test('known aliases, supplemental sources and queued URLs never become new pending candidates', () => {
    const result = pendingCandidates([
      { url: 'https://www.leetcode.com/discuss/post/123/new-slug/?utm_source=feed', title: 'Renamed known report' },
      { url: 'https://example.com/supplement' },
      { url: 'https://example.com/new?utm_source=feed#fragment' },
      { url: 'https://example.com/fresh', title: 'New source' },
      { url: 'https://example.com/fresh?utm_campaign=feed' },
      { url: 'javascript:alert(1)' },
    ], { queue: queue(), collections: collections(), runId: 'two', discoveredAt: '2026-09-15' });
    expect(result.candidates.map(item => [item.url, item.status])).toEqual([['https://example.com/fresh', 'pending']]);
    expect(result.ignored.map(item => item.reason)).toEqual(['Already admitted URL or alias', 'Already admitted URL or alias', 'Already in review queue', 'Not a public HTTPS result URL']);
  });

  test('normalizes Reddit title slugs without merging different source identities', () => {
    expect(canonicalUrl('https://old.reddit.com/r/leetcode/comments/abc123/title/?share_id=42')).toBe(canonicalUrl('https://www.reddit.com/r/leetcode/comments/abc123/changed-title/'));
    expect(candidateId('https://example.com/post?id=one')).not.toBe(candidateId('https://example.com/post?id=two'));
  });

  test('country scoped windows do not skip a new country and explicit dates override overlap', () => {
    const input = queue();
    input.runs[0].endDate = '2026-09-20';
    expect(discoveryWindow({ country: 'Canada', end: '2026-09-21', overlap: 0 }, input, '2026-09-13').startDate).toBe('2026-09-13');
    expect(discoveryWindow({ country: 'India', start: '2026-01-01', end: '2026-09-21' }, input, '2026-09-13').startDate).toBe('2026-01-01');
    expect(() => discoveryWindow({ overlap: 31 }, input, '2026-09-13')).toThrow('Overlap');
  });

  test('supports MCP JSON and SSE envelopes but refuses error or unstructured success messages', () => {
    const envelope = { jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify({ results: [] }) }] } };
    expect(searchResults(parseMcpResponse(JSON.stringify(envelope), 1))).toEqual([]);
    expect(searchResults(parseMcpResponse(`event: message\ndata: ${JSON.stringify(envelope)}\n\n`, 1))).toEqual([]);
    expect(() => searchResults({ content: [{ type: 'text', text: 'Try again later' }] })).toThrow('refusing to advance watermark');
    expect(() => parseMcpResponse(JSON.stringify({ id: 1, result: { isError: true, content: [{ type: 'text', text: 'rate limited' }] } }), 1)).toThrow('Exa search failed');
  });
});

describe('manual queue admission boundary', () => {
  test('review acceptance only references evidence already admitted, including aliases', () => {
    const input = queue();
    expect(() => reviewCandidate(input, { id: candidate().id, status: 'accepted', reason: 'Looks relevant', report: 'strict-one' }, collections())).toThrow('Acceptance requires');
    input.candidates[0].url = 'https://leetcode.com/discuss/post/123/new-title/';
    const result = reviewCandidate(input, { id: candidate().id, status: 'accepted', reason: 'Admitted with original verification', report: 'https://example.com/known' }, collections());
    expect(result.candidates[0].reportId).toBe('strict-one');
    expect(result.candidates[0].status).toBe('accepted');
    expect(input.candidates[0].status).toBe('pending');
    expect(() => reviewCandidate(input, { id: candidate().id, status: 'rejected', reason: '' }, collections())).toThrow('review reason');
    expect(() => reviewQueuePath('data/database.json')).toThrow('never a corpus file');
  });

  test('artifact reimport preserves local rejection and merges provenance idempotently', () => {
    const local = reviewCandidate(queue(), { id: candidate().id, status: 'rejected', reason: 'Promotional retelling' }, collections());
    const incoming = { version: 1, runs: [run({ id: 'two', artifact: 'data/discovery/two.json' })], candidates: [candidate({ runIds: ['two'], title: 'Remote rewritten title' })] };
    const before = structuredClone(local);
    const once = mergeDiscovery(local, incoming, collections());
    expect(once.candidates[0].status).toBe('rejected');
    expect(once.candidates[0].reason).toBe('Promotional retelling');
    expect(once.candidates[0].title).toBe('Candidate experience');
    expect(once.candidates[0].runIds).toEqual(['discovery-one', 'two']);
    expect(mergeDiscovery(once, incoming, collections())).toEqual(once);
    expect(local).toEqual(before);
  });

  test('rejects imported review decisions and conflicting IDs rather than overwriting', () => {
    const incoming = queue();
    incoming.candidates[0].status = 'rejected';
    incoming.candidates[0].reason = 'External decision';
    expect(() => mergeDiscovery(emptyQueue(), incoming, collections())).toThrow('pending candidates only');
    incoming.candidates[0] = candidate();
    incoming.runs[0].endDate = '2026-09-14';
    expect(() => mergeDiscovery(queue(), incoming, collections())).toThrow('Conflicting imported run');
    incoming.runs[0] = run();
    incoming.candidates[0].url = 'https://example.com/conflicting-url';
    expect(() => mergeDiscovery(queue(), incoming, collections())).toThrow('Conflicting imported candidate id');
  });
});
