import assert from 'node:assert/strict';
import { Database } from 'bun:sqlite';
import { fileURLToPath } from 'node:url';
const base = new URL('../data/', import.meta.url);
const data = await Bun.file(new URL('database.json', base)).json();
const db = new Database(fileURLToPath(new URL('database.sqlite', base)), { readonly: true });
const reports = new Map(data.reports.map(r => [r.id, r]));
assert.equal(reports.size, data.reports.length, 'Unique report IDs');
assert.equal(new Set(data.questions.map(q => q.id)).size, data.questions.length, 'Unique question/round rows');
assert.equal(db.query('PRAGMA integrity_check').get().integrity_check, 'ok');
assert.deepEqual(db.query('PRAGMA foreign_key_check').all(), []);
let occurrences = 0;
for (const q of data.questions) {
  assert.ok(q.round >= 1 && q.round <= 4);
  assert.ok(q.question.trim() && q.topic.trim());
  const ids = new Set(q.occurrences.map(o => o.reportId));
  assert.equal(ids.size, q.occurrences.length, `Duplicate report frequency for ${q.id}`);
  assert.equal(q.frequency, ids.size);
  assert.deepEqual(new Set(q.sources.map(s => s.id)), ids);
  assert.deepEqual(new Set(q.locations), new Set(q.occurrences.map(o => o.location)));
  assert.deepEqual(new Set(q.dates.map(d => `${d.date}|${d.basis}`)), new Set(q.occurrences.map(o => `${o.date}|${o.dateBasis}`)));
  for (const o of q.occurrences) {
    const r = reports.get(o.reportId);
    assert.ok(r, `Missing report ${o.reportId}`);
    assert.ok(o.evidence.trim());
    assert.equal(o.location, r.location);
    assert.ok(['interview', 'publication'].includes(o.dateBasis));
    assert.ok(o.date >= '2025' && o.date <= '2026-09-13');
    assert.ok(r.questions.some(x => x.round === q.round && q.id === `r${x.round}-${x.key}` && x.evidence === o.evidence), `Lost provenance ${q.id}`);
  }
  const sql = db.query('SELECT * FROM question_database WHERE id = ?').get(q.id);
  assert.equal(sql.Frequency, q.frequency);
  assert.equal(sql.Question, q.question);
  assert.equal(sql.Topic, q.topic);
  assert.deepEqual(new Set(JSON.parse(sql.Sources)), new Set(q.sources.map(s => s.url)));
  assert.deepEqual(new Set(JSON.parse(sql.Locations)), new Set(q.locations));
  assert.deepEqual(new Set(JSON.parse(sql.Dates).map(d => `${d.date}|${d.basis}`)), new Set(q.dates.map(d => `${d.date}|${d.basis}`)));
  occurrences += q.occurrences.length;
}
assert.equal(db.query('SELECT COUNT(*) AS n FROM reports').get().n, reports.size);
assert.equal(db.query('SELECT COUNT(*) AS n FROM questions').get().n, data.questions.length);
assert.equal(db.query('SELECT COUNT(*) AS n FROM occurrences').get().n, occurrences);
assert.equal(data.metadata.reportCount, reports.size);
assert.equal(data.metadata.questionCount, data.questions.length);
assert.equal(data.metadata.occurrenceCount, occurrences);
// Parse generated CSV, including embedded quotes/newlines, rather than splitting lines.
const csv = (await Bun.file(new URL('database.csv', base)).text()).replace(/^\uFEFF/, '');
const rows = []; let row = [], field = '', quoted = false;
for (let i = 0; i < csv.length; i++) {
  const ch = csv[i];
  if (ch === '"') { if (quoted && csv[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
  else if (ch === ',' && !quoted) { row.push(field); field = ''; }
  else if (ch === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
  else field += ch;
}
assert.equal(quoted, false);
assert.equal(rows.length, data.questions.length + 1);
assert.deepEqual(rows[0], ['Round', 'Question', 'Topic', 'Frequency', 'List of dates', 'List of sources', 'List of locations']);
for (const [i, q] of data.questions.entries()) {
  const actual = rows[i + 1];
  assert.equal(actual.length, 7);
  assert.equal(actual[0], String(q.round));
  assert.equal(actual[3], String(q.frequency));
  assert.equal(actual[5], q.sources.map(s => s.url).join('; '));
  assert.equal(actual[6], q.locations.join('; '));
}
db.close();
console.log(`Integrity verified: ${data.questions.length} rows, ${occurrences} occurrences, ${reports.size} reports; JSON/CSV/SQLite agree.`);
