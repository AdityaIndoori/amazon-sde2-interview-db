import { Database } from 'bun:sqlite';
import { mkdir, readdir, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join, relative, sep } from 'node:path';
import { compileResearchExpansion } from './research-expansion.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = join(root, 'data');
const startDate = '2025-01-01';
const endDate = '2026-09-13';
const fail = message => { throw new Error(message); };
const text = (value, label) => typeof value === 'string' && value.trim() ? value.trim() : fail(`Missing ${label}`);
const webUrl = (value, label) => {
  const url = new URL(text(value, label));
  if (url.protocol !== 'https:') fail(`Expected HTTPS ${label}: ${value}`);
  return url.href;
};
const date = (value, label) => {
  if (typeof value !== 'string' || !/^202[56](?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(value)) fail(`Invalid ${label}: ${value}`);
  const first = value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value;
  if (first > endDate || first < startDate || new Date(first).toISOString().slice(0, 10) !== first) fail(`Out-of-window or invalid ${label}: ${value}`);
  return value;
};
const basis = value => ['interview', 'publication'].includes(value) ? value : fail(`Invalid date basis: ${value}`);
const csvCell = value => {
  let s = String(value);
  if (/^\s*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
};

await mkdir(dataDir, { recursive: true });
const researchDir = join(dataDir, 'research');
const files = (await readdir(researchDir)).filter(file => file.endsWith('.json')).sort();
if (!files.length) fail('No research inputs found');
const normalization = JSON.parse(await readFile(join(dataDir, 'normalization.json'), 'utf8'));
const questionAliases = normalization.questionAliases ?? {};
const reportAliases = normalization.reportAliases ?? {};
const countryFor = location => normalization.locationCountries?.[text(location, 'location')] ?? fail(`Unmapped location: ${location}; add its evidenced country to normalization.json`);
const canonicalKey = key => {
  const seen = new Set();
  while (questionAliases[key]) {
    if (seen.has(key)) fail(`Cyclic question alias ${key}`);
    seen.add(key);
    key = questionAliases[key];
  }
  return key;
};
const reportMap = new Map();
const coverage = [];
for (const file of files) {
  const slice = JSON.parse(await readFile(join(researchDir, file), 'utf8'));
  text(slice.slice, 'slice');
  for (const field of ['queries', 'reports', 'excluded', 'limitations']) if (!Array.isArray(slice[field])) fail(`${file}: ${field} must be an array`);
  coverage.push({ slice: slice.slice, searchedAt: slice.searchedAt, queries: slice.queries, excluded: slice.excluded, limitations: slice.limitations, ...(slice.coverage ? { discovery: slice.coverage } : {}) });
  for (const raw of slice.reports) {
    const originalId = text(raw.id, 'report id');
    if (normalization.excludedReports?.[originalId]) {
      coverage.at(-1).excluded.push({ url: raw.url, reason: normalization.excludedReports[originalId], reportedQuestions: raw.questions });
      continue;
    }
    const id = reportAliases[originalId] ?? originalId;
    const report = {
      ...raw, id,
      url: webUrl(raw.url, 'report URL'),
      title: text(raw.title, 'report title'),
      role: text(raw.role, 'role'),
      eligibility: text(raw.eligibility ?? 'External-hire context reported; candidate account not independently authenticated.', 'eligibility'),
      stageEvidence: text(raw.stageEvidence, 'role/stage evidence'),
      location: countryFor(raw.location),
      date: date(raw.date, `${id} date`), dateBasis: basis(raw.dateBasis),
      publishedDate: raw.publishedDate ?? null, interviewDate: raw.interviewDate ?? null,
      aliases: raw.aliases ?? [], slices: [slice.slice],
    };
    if (raw.retrievedVia) webUrl(raw.retrievedVia, 'retrieval URL');
    if (!/sde\s*[- ]?(?:ii\b|2\b)|l5\b|software development engineer\s*(?:ii\b|2\b)/i.test(report.role)) fail(`${id}: role is not explicitly SDE II/L5`);
    if (raw.interviewDate && /^\d{4}/.test(raw.interviewDate) && raw.interviewDate.slice(0, 4) < '2025') fail(`${id}: known pre-window interview cannot use publication date`);
    if (raw.publishedDate && raw.publishedDate > endDate) fail(`${id}: report published after cutoff`);
    if (!Array.isArray(raw.questions) || !raw.questions.length) fail(`${id}: no questions`);
    report.questions = raw.questions.map(q => {
      if (!Number.isInteger(q.round) || q.round < 1 || q.round > 4) fail(`${id}: unsupported round ${q.round}`);
      const key = canonicalKey(text(q.key, 'question key'));
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) fail(`Invalid question key ${key}`);
      return { ...q, key, question: text(q.question, 'question'), topic: text(q.topic, 'topic'), evidence: text(q.evidence, 'question evidence'), date: date(q.date ?? report.date, `${id} occurrence date`), dateBasis: basis(q.dateBasis ?? report.dateBasis) };
    });
    const existing = reportMap.get(id);
    if (existing) {
      if (existing.location !== report.location || existing.date !== report.date || existing.dateBasis !== report.dateBasis) fail(`Conflicting duplicate report metadata: ${id}`);
      existing.questions.push(...report.questions);
      existing.aliases = [...new Set([...existing.aliases, report.url, ...report.aliases])].filter(url => url !== existing.url);
      existing.slices.push(slice.slice);
    } else reportMap.set(id, report);
  }
}
const urlOwners = new Map();
for (const report of reportMap.values()) {
  for (const url of [report.url, ...report.aliases]) {
    webUrl(url, 'source alias');
    const owner = urlOwners.get(url);
    if (owner && owner !== report.id) fail(`Duplicate source ${url}: ${owner}, ${report.id}; add reportAliases`);
    urlOwners.set(url, report.id);
  }
  const unique = new Map();
  for (const q of report.questions) {
    const key = `${q.round}:${q.key}`;
    if (!unique.has(key)) unique.set(key, q);
    else {
      const previous = unique.get(key);
      if (previous.date !== q.date || previous.dateBasis !== q.dateBasis) fail(`Conflicting duplicate occurrence date: ${report.id} ${key}`);
      if (!previous.evidence.includes(q.evidence)) previous.evidence += `\n${q.evidence}`;
    }
  }
  report.questions = [...unique.values()];
}
const rows = new Map();
for (const report of reportMap.values()) {
  for (const q of report.questions) {
    const id = `r${q.round}-${q.key}`;
    let row = rows.get(id);
    if (!row) {
      const override = normalization.questions?.[q.key] ?? {};
      row = { id, round: q.round, question: override.question ?? q.question, topic: override.topic ?? q.topic, frequency: 0, dates: [], sources: [], locations: [], occurrences: [] };
      rows.set(id, row);
    }
    row.occurrences.push({ reportId: report.id, date: q.date, dateBasis: q.dateBasis, location: report.location, evidence: q.evidence, reportedQuestion: q.question, reportedTopic: q.topic, sourceRound: q.sourceRound ?? `Round ${q.round}`, roundMappingNote: q.roundMappingNote ?? report.roundMappingNote ?? 'Source final-loop position; see quoted evidence.' });
  }
}
const questions = [...rows.values()].sort((a, b) => a.round - b.round || a.question.localeCompare(b.question));
for (const row of questions) {
  row.occurrences.sort((a, b) => b.date.localeCompare(a.date) || a.reportId.localeCompare(b.reportId));
  row.frequency = new Set(row.occurrences.map(o => o.reportId)).size;
  row.dates = [...new Map(row.occurrences.map(o => [`${o.date}|${o.dateBasis}`, { date: o.date, basis: o.dateBasis }])).values()];
  row.locations = [...new Set(row.occurrences.map(o => o.location))].sort();
  row.sources = [...new Set(row.occurrences.map(o => o.reportId))].map(id => {
    const report = reportMap.get(id);
    return { id, title: report.title, url: report.url };
  });
}
if (!questions.length) fail('No qualifying questions');
const reports = [...reportMap.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
const metadata = {
  title: 'Amazon SDE II Interview Question Atlas', startDate, endDate,
  generatedAt: endDate,
  frequencyDefinition: 'Distinct candidate reports mentioning this question in this round; cross-posts count once. Not an estimate of Amazon’s actual asking rate.',
  disclaimer: 'Publicly reported experiences only. Discovery is not exhaustive and candidate accounts are not independently authenticated. Missing dates or locations are never inferred. Publication dates are labeled separately from interview dates.',
  reportCount: reports.length, questionCount: questions.length,
  occurrenceCount: questions.reduce((n, q) => n + q.occurrences.length, 0),
};
const database = { metadata, questions, reports, coverage };
const readInputs = async name => {
  const directory = join(dataDir, name);
  await mkdir(directory, { recursive: true });
  const inputs = (await readdir(directory)).filter(file => file.endsWith('.json')).sort();
  return Promise.all(inputs.map(async file => JSON.parse(await readFile(join(directory, file), 'utf8'))));
};
const [slices, campaigns] = await Promise.all([readInputs('unconfirmed'), readInputs('campaigns')]);
const { unconfirmed, ledger } = compileResearchExpansion({ slices, strict: database, normalization, campaigns });
const realRoot = await realpath(root);
for (const campaign of ledger.campaigns) {
  const artifact = await realpath(join(root, campaign.artifact));
  const path = relative(realRoot, artifact);
  if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`) || !(await stat(artifact)).isFile()) fail(`Campaign artifact must be a repository file: ${campaign.artifact}`);
}
await Bun.write(join(dataDir, 'database.json'), `${JSON.stringify(database, null, 2)}\n`);
const headers = ['Round', 'Question', 'Topic', 'Frequency', 'List of dates', 'List of sources', 'List of locations'];
const csvRows = questions.map(q => [q.round, q.question, q.topic, q.frequency, q.dates.map(d => `${d.date} (${d.basis})`).join('; '), q.sources.map(s => s.url).join('; '), q.locations.join('; ')]);
await Bun.write(join(dataDir, 'database.csv'), '\uFEFF' + [headers, ...csvRows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n');
const tmpPath = join(dataDir, 'database.sqlite.tmp');
await rm(tmpPath, { force: true });
const db = new Database(tmpPath);
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE reports (id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE, retrieved_via TEXT, role TEXT NOT NULL, location TEXT NOT NULL, date TEXT NOT NULL, date_basis TEXT NOT NULL CHECK(date_basis IN ('interview','publication')), published_date TEXT, interview_date TEXT, stage_evidence TEXT NOT NULL, aliases_json TEXT NOT NULL, details_json TEXT NOT NULL);
  CREATE TABLE questions (id TEXT PRIMARY KEY, round INTEGER NOT NULL CHECK(round BETWEEN 1 AND 4), question TEXT NOT NULL, topic TEXT NOT NULL);
  CREATE TABLE occurrences (question_id TEXT NOT NULL REFERENCES questions(id), report_id TEXT NOT NULL REFERENCES reports(id), date TEXT NOT NULL, date_basis TEXT NOT NULL CHECK(date_basis IN ('interview','publication')), location TEXT NOT NULL, evidence TEXT NOT NULL, source_round TEXT NOT NULL, round_mapping_note TEXT NOT NULL, reported_question TEXT NOT NULL, reported_topic TEXT NOT NULL, PRIMARY KEY(question_id, report_id));
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
const insertOccurrence = db.prepare('INSERT INTO occurrences VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertCoverage = db.prepare('INSERT INTO research_coverage VALUES (?, ?)');
db.transaction(() => {
  for (const [key, value] of Object.entries(metadata)) insertMeta.run(key, JSON.stringify(value));
  for (const r of reports) insertReport.run(r.id, r.title, r.url, r.retrievedVia ?? null, r.role, r.location, r.date, r.dateBasis, r.publishedDate, r.interviewDate, r.stageEvidence, JSON.stringify(r.aliases), JSON.stringify(r));
  for (const q of questions) {
    insertQuestion.run(q.id, q.round, q.question, q.topic);
    for (const o of q.occurrences) insertOccurrence.run(q.id, o.reportId, o.date, o.dateBasis, o.location, o.evidence, o.sourceRound, o.roundMappingNote, o.reportedQuestion, o.reportedTopic);
  }
  for (const c of coverage) insertCoverage.run(c.slice, JSON.stringify(c));
})();
if (db.query('PRAGMA integrity_check').get().integrity_check !== 'ok') fail('SQLite integrity failure');
db.close();
await rename(tmpPath, join(dataDir, 'database.sqlite'));
console.log(`Built ${questions.length} question/round rows, ${metadata.occurrenceCount} occurrences, ${reports.length} independent reports from ${files.length} research slices.`);
await Bun.write(join(dataDir, 'unconfirmed.json'), `${JSON.stringify(unconfirmed, null, 2)}\n`);
await Bun.write(join(dataDir, 'research-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
const unconfirmedCsvRows = unconfirmed.questions.map(q => ['Unconfirmed', q.question, q.topic, q.frequency, q.dates.map(d => `${d.date} (${d.basis})`).join('; '), q.sources.map(s => s.url).join('; '), q.locations.join('; ')]);
await Bun.write(join(dataDir, 'unconfirmed.csv'), '\uFEFF' + [headers, ...unconfirmedCsvRows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n');
const supplementalTmpPath = join(dataDir, 'unconfirmed.sqlite.tmp');
await rm(supplementalTmpPath, { force: true });
const supplementalDb = new Database(supplementalTmpPath);
supplementalDb.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE reports (id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE, retrieved_via TEXT, role TEXT NOT NULL, location TEXT NOT NULL, date TEXT NOT NULL, date_basis TEXT NOT NULL CHECK(date_basis IN ('interview','publication')), published_date TEXT, interview_date TEXT, stage_evidence TEXT NOT NULL, aliases_json TEXT NOT NULL, details_json TEXT NOT NULL);
  CREATE TABLE questions (id TEXT PRIMARY KEY, round INTEGER CHECK(round IS NULL), question TEXT NOT NULL, topic TEXT NOT NULL);
  CREATE TABLE occurrences (question_id TEXT NOT NULL REFERENCES questions(id), report_id TEXT NOT NULL REFERENCES reports(id), date TEXT NOT NULL, date_basis TEXT NOT NULL CHECK(date_basis IN ('interview','publication')), location TEXT NOT NULL, evidence TEXT NOT NULL, source_round TEXT NOT NULL, round_mapping_note TEXT NOT NULL, reported_question TEXT NOT NULL, reported_topic TEXT NOT NULL, round_uncertainty TEXT NOT NULL CHECK(length(trim(round_uncertainty)) > 0), PRIMARY KEY(question_id, report_id));
  CREATE TABLE research_coverage (slice TEXT PRIMARY KEY, details_json TEXT NOT NULL);
  CREATE INDEX occurrences_date ON occurrences(date);
  CREATE INDEX occurrences_location ON occurrences(location);
  CREATE VIEW question_database AS SELECT q.id, q.round AS Round, q.question AS Question, q.topic AS Topic, (SELECT COUNT(*) FROM occurrences o WHERE o.question_id=q.id) AS Frequency,
    (SELECT json_group_array(json_object('date', d.date, 'basis', d.date_basis)) FROM (SELECT DISTINCT date,date_basis FROM occurrences WHERE question_id=q.id ORDER BY date DESC) d) AS Dates,
    (SELECT json_group_array(r.url) FROM occurrences o JOIN reports r ON r.id=o.report_id WHERE o.question_id=q.id) AS Sources,
    (SELECT json_group_array(location) FROM (SELECT DISTINCT location FROM occurrences WHERE question_id=q.id ORDER BY location)) AS Locations FROM questions q;
`);
const supplementalMeta = supplementalDb.prepare('INSERT INTO metadata VALUES (?, ?)');
const supplementalReport = supplementalDb.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const supplementalQuestion = supplementalDb.prepare('INSERT INTO questions VALUES (?, ?, ?, ?)');
const supplementalOccurrence = supplementalDb.prepare('INSERT INTO occurrences VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const supplementalCoverage = supplementalDb.prepare('INSERT INTO research_coverage VALUES (?, ?)');
supplementalDb.transaction(() => {
  for (const [key, value] of Object.entries(unconfirmed.metadata)) supplementalMeta.run(key, JSON.stringify(value));
  for (const r of unconfirmed.reports) supplementalReport.run(r.id, r.title, r.url, r.retrievedVia ?? null, r.role, r.location, r.date, r.dateBasis, r.publishedDate, r.interviewDate, r.stageEvidence, JSON.stringify(r.aliases), JSON.stringify(r));
  for (const q of unconfirmed.questions) {
    supplementalQuestion.run(q.id, null, q.question, q.topic);
    for (const o of q.occurrences) supplementalOccurrence.run(q.id, o.reportId, o.date, o.dateBasis, o.location, o.evidence, o.sourceRound, o.roundMappingNote, o.reportedQuestion, o.reportedTopic, o.roundUncertainty);
  }
  for (const c of unconfirmed.coverage) supplementalCoverage.run(c.slice, JSON.stringify(c));
})();
if (supplementalDb.query('PRAGMA integrity_check').get().integrity_check !== 'ok') fail('Unconfirmed SQLite integrity failure');
supplementalDb.close();
await rename(supplementalTmpPath, join(dataDir, 'unconfirmed.sqlite'));
console.log(`Built ${unconfirmed.questions.length} unconfirmed rows, ${unconfirmed.metadata.occurrenceCount} occurrences, ${unconfirmed.reports.length} reports and ${ledger.campaigns.length} scoped campaigns.`);
