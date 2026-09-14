import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { calendarDate } from './evidence-validation.js';

export function snapshotCollections(collections) {
  const records = {};
  for (const [collection, data] of Object.entries(collections)) {
    for (const row of data.questions) records[`${collection}|${row.id}`] = { collection, id: row.id, question: row.question, round: row.round, topic: row.topic, category: row.category ?? null, frequency: row.frequency, dates: row.dates, locations: row.locations, sources: row.sources, occurrences: row.occurrences };
  }
  return { version: 1, records };
}

export function diffSnapshots(before, after) {
  if (before.version !== 1 || after.version !== 1 || !before.records || !after.records) throw new Error('Invalid history snapshot');
  const changes = [];
  for (const key of [...new Set([...Object.keys(before.records), ...Object.keys(after.records)])].sort()) {
    const old = before.records[key], next = after.records[key];
    if (!old) changes.push({ collection: next.collection, id: next.id, type: 'added', after: next });
    else if (!next) changes.push({ collection: old.collection, id: old.id, type: 'removed', before: old });
    else {
      const fields = Object.keys(next).filter(field => JSON.stringify(old[field]) !== JSON.stringify(next[field]));
      if (fields.length) changes.push({ collection: next.collection, id: next.id, type: 'corrected', fields, before: Object.fromEntries(fields.map(f => [f, old[f]])), after: Object.fromEntries(fields.map(f => [f, next[f]])) });
    }
  }
  return changes;
}

if (import.meta.main) {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { root: { type: 'string' }, date: { type: 'string' }, summary: { type: 'string' }, id: { type: 'string' }, baseline: { type: 'boolean', default: false } }, strict: true });
  const root = values.root ? resolve(values.root) : fileURLToPath(new URL('../', import.meta.url));
  if (!values.date || !values.summary?.trim() || !values.id?.trim()) throw new Error('Required: --date YYYY-MM-DD --id release-id --summary description');
  calendarDate(values.date, 'release date', true);
  const snapshotPath = join(root, 'data/history-snapshot.json');
  const historyPath = join(root, 'data/change-history.json');
  const [strict, unconfirmed] = await Promise.all(['database', 'unconfirmed'].map(name => Bun.file(join(root, `data/${name}.json`)).json()));
  const atomicWrite = async (path, content) => {
    await Bun.write(`${path}.tmp`, content);
    await rename(`${path}.tmp`, path);
  };
  const next = snapshotCollections({ strict, unconfirmed });
  const snapshotText = JSON.stringify(next, null, 2) + '\n';
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  const history = await Bun.file(historyPath).exists() ? await Bun.file(historyPath).json() : { version: 1, releases: [] };
  if (history.version !== 1 || !Array.isArray(history.releases)) throw new Error('Invalid change history');
  const existing = history.releases.find(r => r.id === values.id);
  if (existing) {
    if (existing.snapshotSha256 !== snapshotSha256 || existing.date !== values.date || existing.summary !== values.summary.trim()) throw new Error('Release id already recorded with different content');
    await atomicWrite(snapshotPath, snapshotText);
    console.log(`Restored snapshot for already recorded release ${values.id}; no duplicate history entry.`);
    process.exit(0);
  }
  let changes;
  if (values.baseline) {
    if (await Bun.file(snapshotPath).exists() || history.releases.length) throw new Error('Baseline already exists; refusing to overwrite history');
    changes = [];
  } else {
    if (!await Bun.file(snapshotPath).exists()) throw new Error('Create a baseline first with --baseline');
    const priorText = await Bun.file(snapshotPath).text();
    const priorHash = createHash('sha256').update(priorText).digest('hex');
    const last = history.releases.at(-1);
    if (last?.snapshotSha256 && last.snapshotSha256 !== priorHash) throw new Error(`Previous release ${last.id} has an incomplete snapshot; retry that release with its original content before recording another`);
    changes = diffSnapshots(JSON.parse(priorText), next);
  }
  history.releases.push({ id: values.id, date: values.date, summary: values.summary.trim(), snapshotSha256, changes });
  // Commit history first. A retry with the same release/content repairs a missed
  // snapshot write; a different release cannot silently claim the same id.
  await atomicWrite(historyPath, JSON.stringify(history, null, 2) + '\n');
  await atomicWrite(snapshotPath, snapshotText);
  console.log(`Recorded ${values.id}: ${changes.length} record changes${values.baseline ? ' (baseline; no invented historical changes)' : ''}. Rebuild to publish research status.`);
}
