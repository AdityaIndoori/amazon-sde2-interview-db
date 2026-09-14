import { expect, test } from 'bun:test';
import { diffSnapshots } from './record-changes.js';

test('records added corrected and removed rows without inventing unchanged changes', () => {
  const before = { version: 1, records: {
    'strict|r1-a': { collection: 'strict', id: 'r1-a', question: 'Old', frequency: 2 },
    'strict|r2-b': { collection: 'strict', id: 'r2-b', question: 'Removed', frequency: 1 },
    'unconfirmed|u-c': { collection: 'unconfirmed', id: 'u-c', question: 'Stable', frequency: 1 },
  } };
  const after = structuredClone(before);
  after.records['strict|r1-a'].question = 'Corrected';
  delete after.records['strict|r2-b'];
  after.records['strict|r3-d'] = { collection: 'strict', id: 'r3-d', question: 'New', frequency: 1 };
  expect(diffSnapshots(before, after)).toEqual([
    { collection: 'strict', id: 'r1-a', type: 'corrected', fields: ['question'], before: { question: 'Old' }, after: { question: 'Corrected' } },
    { collection: 'strict', id: 'r2-b', type: 'removed', before: before.records['strict|r2-b'] },
    { collection: 'strict', id: 'r3-d', type: 'added', after: after.records['strict|r3-d'] },
  ]);
  expect(diffSnapshots(before, before)).toEqual([]);
});
