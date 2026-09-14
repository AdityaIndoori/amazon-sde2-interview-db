import { Database } from 'bun:sqlite';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

const csvCell = value => {
  let text = String(value);
  if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export async function exportCollection(dataDir, name, collection) {
  const supplemental = collection.metadata.collection === 'unconfirmed';
  const { metadata, questions, reports, coverage } = collection;
  await Bun.write(join(dataDir, `${name}.json`), `${JSON.stringify(collection, null, 2)}\n`);
  const headers = ['Round', 'Question', 'Topic', 'Frequency', 'List of dates', 'List of sources', 'List of locations'];
  const rows = questions.map(q => [supplemental ? 'Unconfirmed' : q.round, q.question, q.topic, q.frequency, q.dates.map(d => `${d.date} (${d.basis})`).join('; '), q.sources.map(s => s.url).join('; '), q.locations.join('; ')]);
  await Bun.write(join(dataDir, `${name}.csv`), '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n');
  const tmpPath = join(dataDir, `${name}.sqlite.tmp`);
  await rm(tmpPath, { force: true });
  const db = new Database(tmpPath);
  try {
    const roundConstraint = supplemental ? 'CHECK(round IS NULL)' : 'NOT NULL CHECK(round BETWEEN 1 AND 4)';
    const uncertaintyColumn = supplemental ? ', round_uncertainty TEXT NOT NULL CHECK(length(trim(round_uncertainty)) > 0)' : '';
    db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE reports (id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE, retrieved_via TEXT, role TEXT NOT NULL, location TEXT NOT NULL, date TEXT NOT NULL, date_basis TEXT NOT NULL CHECK(date_basis IN ('interview','publication')), published_date TEXT, interview_date TEXT, stage_evidence TEXT NOT NULL, aliases_json TEXT NOT NULL, details_json TEXT NOT NULL);
  CREATE TABLE questions (id TEXT PRIMARY KEY, round INTEGER ${roundConstraint}, question TEXT NOT NULL, topic TEXT NOT NULL);
  CREATE TABLE occurrences (question_id TEXT NOT NULL REFERENCES questions(id), report_id TEXT NOT NULL REFERENCES reports(id), date TEXT NOT NULL, date_basis TEXT NOT NULL CHECK(date_basis IN ('interview','publication')), location TEXT NOT NULL, evidence TEXT NOT NULL, source_round TEXT NOT NULL, round_mapping_note TEXT NOT NULL, reported_question TEXT NOT NULL, reported_topic TEXT NOT NULL${uncertaintyColumn}, PRIMARY KEY(question_id, report_id));
  CREATE TABLE research_coverage (slice TEXT PRIMARY KEY, details_json TEXT NOT NULL);
  CREATE INDEX occurrences_date ON occurrences(date);
  CREATE INDEX occurrences_location ON occurrences(location);
  CREATE VIEW question_database AS SELECT q.id, q.round AS Round, q.question AS Question, q.topic AS Topic, (SELECT COUNT(*) FROM occurrences o WHERE o.question_id=q.id) AS Frequency,
    (SELECT json_group_array(json_object('date', d.date, 'basis', d.date_basis)) FROM (SELECT DISTINCT date,date_basis FROM occurrences WHERE question_id=q.id ORDER BY date DESC) d) AS Dates,
    (SELECT json_group_array(r.url) FROM occurrences o JOIN reports r ON r.id=o.report_id WHERE o.question_id=q.id) AS Sources,
    (SELECT json_group_array(location) FROM (SELECT DISTINCT location FROM occurrences WHERE question_id=q.id ORDER BY location)) AS Locations FROM questions q;
`);
    const insertMeta = db.prepare('INSERT INTO metadata VALUES (?, ?)');
    const insertReport = db.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertQuestion = db.prepare('INSERT INTO questions VALUES (?, ?, ?, ?)');
    const insertOccurrence = db.prepare(`INSERT INTO occurrences VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?${supplemental ? ', ?' : ''})`);
    const insertCoverage = db.prepare('INSERT INTO research_coverage VALUES (?, ?)');
    db.transaction(() => {
      for (const [key, value] of Object.entries(metadata)) insertMeta.run(key, JSON.stringify(value));
      for (const r of reports) insertReport.run(r.id, r.title, r.url, r.retrievedVia ?? null, r.role, r.location, r.date, r.dateBasis, r.publishedDate, r.interviewDate, r.stageEvidence, JSON.stringify(r.aliases), JSON.stringify(r));
      for (const q of questions) {
        insertQuestion.run(q.id, q.round, q.question, q.topic);
        for (const o of q.occurrences) {
          const values = [q.id, o.reportId, o.date, o.dateBasis, o.location, o.evidence, o.sourceRound, o.roundMappingNote, o.reportedQuestion, o.reportedTopic];
          if (supplemental) values.push(o.roundUncertainty);
          insertOccurrence.run(...values);
        }
      }
      for (const c of coverage) insertCoverage.run(c.slice, JSON.stringify(c));
    })();
    if (db.query('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error(`${name} SQLite integrity failure`);
  } finally { db.close(); }
  await rename(tmpPath, join(dataDir, `${name}.sqlite`));
}
