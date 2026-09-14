import assert from 'node:assert/strict';
import { Database } from 'bun:sqlite';
import { readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileResearchExpansion } from './research-expansion.js';
import { enrichEvidence } from './enrich-evidence.js';
import { compileResearchStatus, emptyQueue } from './research-status.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = new URL('../data/', import.meta.url);
const data = await Bun.file(new URL('database.json', base)).json();
const unconfirmed = await Bun.file(new URL('unconfirmed.json', base)).json();
const ledger = await Bun.file(new URL('research-ledger.json', base)).json();
const normalization = await Bun.file(new URL('normalization.json', base)).json();
const readInputs = async name => {
  let files;
  try { files = await readdir(join(root, 'data', name)); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return Promise.all(files.filter(file => file.endsWith('.json')).sort().map(file => Bun.file(join(root, 'data', name, file)).json()));
};
const [slices, campaigns] = await Promise.all([readInputs('unconfirmed'), readInputs('campaigns')]);
const compiled = compileResearchExpansion({ slices, strict: data, normalization, campaigns });
const assessments = await Bun.file(new URL('evidence-assessments.json', base)).json();
assert.deepEqual(data, enrichEvidence(data, assessments), 'Strict evidence metadata matches assessments');
assert.deepEqual(unconfirmed, enrichEvidence(compiled.unconfirmed, assessments), 'Unconfirmed JSON matches validated research inputs and assessments');
const queueFile = Bun.file(new URL('review-queue.json', base));
const historyFile = Bun.file(new URL('change-history.json', base));
const status = compileResearchStatus({ queue: await queueFile.exists() ? await queueFile.json() : emptyQueue(), history: await historyFile.exists() ? await historyFile.json() : { version: 1, releases: [] }, collections: { strict: data, unconfirmed }, campaigns: ledger.campaigns });
assert.deepEqual(await Bun.file(new URL('research-status.json', base)).json(), status, 'Research status matches queue and history');
assert.deepEqual(ledger, compiled.ledger, 'Ledger matches validated campaign inputs and report references');
const realRoot = await realpath(root);
for (const campaign of ledger.campaigns) {
  const artifact = await realpath(join(root, campaign.artifact));
  const path = relative(realRoot, artifact);
  assert.ok(!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`) && (await stat(artifact)).isFile(), `Unsafe or missing campaign artifact: ${campaign.artifact}`);
}

const csvValue = value => {
  const string = String(value);
  return /^\s*[=+@-]/.test(string) || /^[\t\r\n]/.test(string) ? `'${string}` : string;
};
const parseCsv = csv => {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') { if (quoted && csv[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(field); field = ''; }
    else if (ch === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  assert.equal(quoted, false, 'CSV quotes balanced');
  assert.equal(field, '', 'CSV ends with a newline');
  assert.equal(row.length, 0);
  return rows;
};

async function checkCollection(collection, filename, supplemental) {
  const db = new Database(fileURLToPath(new URL(`${filename}.sqlite`, base)), { readonly: true });
  try {
    const reports = new Map(collection.reports.map(r => [r.id, r]));
    assert.equal(reports.size, collection.reports.length, 'Unique report IDs');
    assert.equal(new Set(collection.questions.map(q => q.id)).size, collection.questions.length, 'Unique question rows');
    assert.equal(db.query('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.deepEqual(db.query('PRAGMA foreign_key_check').all(), []);
    assert.deepEqual(Object.fromEntries(db.query('SELECT * FROM metadata').all().map(row => [row.key, JSON.parse(row.value)])), collection.metadata);
    assert.deepEqual(new Map(db.query('SELECT slice, details_json FROM research_coverage').all().map(row => [row.slice, JSON.parse(row.details_json)])), new Map(collection.coverage.map(entry => [entry.slice, entry])));
    for (const r of collection.reports) {
      const sql = db.query('SELECT * FROM reports WHERE id = ?').get(r.id);
      assert.deepEqual(sql, { id: r.id, title: r.title, url: r.url, retrieved_via: r.retrievedVia ?? null, role: r.role, location: r.location, date: r.date, date_basis: r.dateBasis, published_date: r.publishedDate, interview_date: r.interviewDate, stage_evidence: r.stageEvidence, aliases_json: JSON.stringify(r.aliases), details_json: JSON.stringify(r) });
    }
    let occurrences = 0;
    for (const q of collection.questions) {
      if (supplemental) assert.equal(q.round, null); else assert.ok(Number.isInteger(q.round) && q.round >= 1 && q.round <= 4);
      assert.ok(q.question.trim() && q.topic.trim());
      const ids = new Set(q.occurrences.map(o => o.reportId));
      assert.equal(ids.size, q.occurrences.length, `Duplicate report frequency for ${q.id}`);
      assert.equal(q.frequency, ids.size);
      assert.deepEqual(q.sources, [...ids].map(id => { const r = reports.get(id); assert.ok(r, `Missing report ${id}`); return { id: r.id, title: r.title, url: r.url }; }));
      assert.deepEqual(new Set(q.locations), new Set(q.occurrences.map(o => o.location)));
      assert.deepEqual(new Set(q.dates.map(d => `${d.date}|${d.basis}`)), new Set(q.occurrences.map(o => `${o.date}|${o.dateBasis}`)));
      for (const o of q.occurrences) {
        const r = reports.get(o.reportId);
        assert.ok(r, `Missing report ${o.reportId}`);
        assert.ok(o.evidence.trim());
        assert.equal(o.location, r.location);
        assert.ok(['interview', 'publication'].includes(o.dateBasis));
        assert.ok(o.date >= '2025' && o.date <= collection.metadata.endDate);
        const raw = r.questions.find(x => x.round === q.round && q.id === (supplemental ? `u-${x.key}` : `r${x.round}-${x.key}`));
        assert.ok(raw, `Lost provenance ${q.id}`);
        assert.equal(raw.evidence, o.evidence);
        assert.equal(raw.date, o.date);
        assert.equal(raw.dateBasis, o.dateBasis);
        if (supplemental) {
          assert.ok(o.roundUncertainty.trim());
          assert.equal(o.roundMappingNote, o.roundUncertainty);
          assert.equal(raw.roundUncertainty, o.roundUncertainty);
        }
        const sql = db.query('SELECT * FROM occurrences WHERE question_id = ? AND report_id = ?').get(q.id, o.reportId);
        assert.deepEqual(sql, { question_id: q.id, report_id: o.reportId, date: o.date, date_basis: o.dateBasis, location: o.location, evidence: o.evidence, source_round: o.sourceRound, round_mapping_note: o.roundMappingNote, reported_question: o.reportedQuestion, reported_topic: o.reportedTopic, evidence_quality: o.evidenceQuality, quality_reason: o.qualityReason, problem_url: o.problemUrl ?? null, problem_evidence: o.problemEvidence ?? null, ...(supplemental ? { round_uncertainty: o.roundUncertainty } : {}) });
      }
      const sql = db.query('SELECT * FROM question_database WHERE id = ?').get(q.id);
      const enrichedRow = db.query('SELECT category, evidence_qualities_json FROM questions WHERE id = ?').get(q.id);
      assert.equal(enrichedRow.category, q.category);
      assert.deepEqual(JSON.parse(enrichedRow.evidence_qualities_json), q.evidenceQualities);
      assert.equal(sql.Round, q.round);
      assert.equal(sql.Frequency, q.frequency);
      assert.equal(sql.Question, q.question);
      assert.equal(sql.Topic, q.topic);
      assert.deepEqual(new Set(JSON.parse(sql.Sources)), new Set(q.sources.map(s => s.url)));
      assert.deepEqual(new Set(JSON.parse(sql.Locations)), new Set(q.locations));
      assert.deepEqual(new Set(JSON.parse(sql.Dates).map(d => `${d.date}|${d.basis}`)), new Set(q.dates.map(d => `${d.date}|${d.basis}`)));
      occurrences += q.occurrences.length;
    }
    assert.equal(db.query('SELECT COUNT(*) AS n FROM reports').get().n, reports.size);
    assert.equal(db.query('SELECT COUNT(*) AS n FROM questions').get().n, collection.questions.length);
    assert.equal(db.query('SELECT COUNT(*) AS n FROM occurrences').get().n, occurrences);
    assert.equal(collection.metadata.reportCount, reports.size);
    assert.equal(collection.metadata.questionCount, collection.questions.length);
    assert.equal(collection.metadata.occurrenceCount, occurrences);
    const csv = (await Bun.file(new URL(`${filename}.csv`, base)).text()).replace(/^\uFEFF/, '');
    const rows = parseCsv(csv);
    const expected = [['Round', 'Question', 'Topic', 'Frequency', 'List of dates', 'List of sources', 'List of locations'], ...collection.questions.map(q => [supplemental ? 'Unconfirmed' : q.round, q.question, q.topic, q.frequency, q.dates.map(d => `${d.date} (${d.basis})`).join('; '), q.sources.map(s => s.url).join('; '), q.locations.join('; ')])];
    assert.deepEqual(rows, expected.map(row => row.map(csvValue)), `${filename} CSV agrees in every column`);
    console.log(`Integrity verified (${filename}): ${collection.questions.length} rows, ${occurrences} occurrences, ${reports.size} reports; JSON/CSV/SQLite agree.`);
  } finally { db.close(); }
}
await checkCollection(data, 'database', false);
await checkCollection(unconfirmed, 'unconfirmed', true);
console.log(`Ledger verified: ${ledger.campaigns.length} campaigns, report references and repository artifacts agree.`);
