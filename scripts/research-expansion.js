const fail = message => { throw new Error(message); };
const text = (value, label) => typeof value === 'string' && value.trim() ? value.trim() : fail(`Missing ${label}`);
const array = (value, label) => Array.isArray(value) ? value : fail(`${label} must be an array`);
const basis = value => ['interview', 'publication'].includes(value) ? value : fail(`Invalid date basis: ${value}`);
const webUrl = (value, label) => {
  let url;
  try { url = new URL(text(value, label)); } catch { fail(`Invalid ${label}: ${value}`); }
  if (url.protocol !== 'https:' || url.username || url.password) fail(`Expected public HTTPS ${label}: ${value}`);
  return url.href;
};
const calendarDate = (value, label, exact = false) => {
  const pattern = exact ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
  if (typeof value !== 'string' || !pattern.test(value)) fail(`Invalid ${label}: ${value}`);
  const first = value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value;
  const parsed = new Date(`${first}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== first) fail(`Invalid calendar ${label}: ${value}`);
  return first;
};
const canonical = (value, aliases, label) => {
  let key = text(value, label);
  const seen = new Set();
  while (Object.hasOwn(aliases, key)) {
    if (seen.has(key)) fail(`Cyclic ${label} alias: ${key}`);
    seen.add(key);
    key = text(aliases[key], label);
  }
  return key;
};

// Filesystem existence and symlink containment are checked by build/check, not this pure compiler.
export function validateArtifactPath(value) {
  const path = text(value, 'campaign artifact');
  if (path !== value || !/^[a-zA-Z0-9_][a-zA-Z0-9_./-]*$/.test(path) || path.split('/').some(part => !part || part.startsWith('.') || /^(?:credentials?|secrets?|id_rsa|id_ed25519)(?:\.|$)/i.test(part))) fail(`Unsafe campaign artifact: ${value}`);
  return path;
}

export function compileResearchExpansion({ slices, strict, normalization, campaigns }) {
  const questionAliases = normalization.questionAliases ?? {};
  const reportAliases = normalization.reportAliases ?? {};
  const keyFor = value => {
    const key = canonical(value, questionAliases, 'question key');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) fail(`Invalid question key: ${key}`);
    return key;
  };
  const idFor = value => canonical(value, reportAliases, 'report id');
  const inWindow = (value, label) => {
    const first = calendarDate(value, label);
    if (first < strict.metadata.startDate || first > strict.metadata.endDate) fail(`Out-of-window ${label}: ${value}`);
    return value;
  };
  const countries = new Set(Object.values(normalization.locationCountries ?? {}));
  const countryFor = location => normalization.locationCountries?.[text(location, 'location')] ?? (countries.has(location) ? location : fail(`Unmapped location: ${location}`));
  const urlOwners = new Map();
  const claimUrls = report => {
    for (const url of [report.url, ...report.aliases]) {
      const owner = urlOwners.get(url);
      if (owner && owner !== report.id) fail(`Duplicate source ${url}: ${owner}, ${report.id}; add reportAliases`);
      urlOwners.set(url, report.id);
    }
  };
  const strictReports = new Map();
  const verified = new Set();
  for (const raw of strict.reports) {
    const report = { ...raw, id: idFor(raw.id), url: webUrl(raw.url, 'strict URL'), aliases: (raw.aliases ?? []).map(url => webUrl(url, 'strict alias')) };
    strictReports.set(report.id, report);
    claimUrls(report);
    for (const q of report.questions) verified.add(`${report.id}\0${keyFor(q.key)}`);
  }
  const reportMap = new Map();
  const coverage = [];
  const sliceIds = new Set();
  for (const slice of array(slices, 'slices')) {
    const sliceId = text(slice.slice, 'slice');
    if (sliceIds.has(sliceId)) fail(`Duplicate supplemental slice: ${sliceId}`);
    sliceIds.add(sliceId);
    coverage.push({ slice: sliceId, queries: [], excluded: [], limitations: ['Final-loop questions in this collection have no verified round number.'] });
    for (const raw of array(slice.reports, `${sliceId} reports`)) {
      const id = idFor(raw.id);
      const report = {
        ...raw, id, url: webUrl(raw.url, 'report URL'), title: text(raw.title, 'report title'),
        role: text(raw.role, 'role'), stageEvidence: text(raw.stageEvidence, 'role/stage evidence'),
        eligibility: text(raw.eligibility ?? 'External-hire context reported; candidate account not independently authenticated.', 'eligibility'),
        location: countryFor(raw.location), date: inWindow(raw.date, `${id} date`), dateBasis: basis(raw.dateBasis),
        publishedDate: raw.publishedDate ?? null, interviewDate: raw.interviewDate ?? null,
        aliases: array(raw.aliases ?? [], 'source aliases').map(url => webUrl(url, 'source alias')), slices: [sliceId],
      };
      if (!/sde\s*[- ]?(?:ii\b|2\b)|l5\b|software development engineer\s*(?:ii\b|2\b)/i.test(report.role)) fail(`${id}: role is not explicitly SDE II/L5`);
      if (raw.retrievedVia) report.retrievedVia = webUrl(raw.retrievedVia, 'retrieval URL');
      for (const field of ['publishedDate', 'interviewDate']) {
        if (report[field] !== null) {
          const first = calendarDate(report[field], `${id} ${field}`);
          if (first > strict.metadata.endDate) fail(`${id}: ${field} after cutoff`);
          if (field === 'interviewDate' && first < strict.metadata.startDate) fail(`${id}: known pre-window interview`);
        }
      }
      claimUrls(report);
      const previous = reportMap.get(id) ?? strictReports.get(id);
      if (previous && (previous.location !== report.location || previous.date !== report.date || previous.dateBasis !== report.dateBasis)) fail(`Conflicting duplicate report metadata: ${id}`);
      const questions = array(raw.questions, `${id} questions`);
      if (!questions.length) fail(`${id}: no questions`);
      report.questions = questions.map(q => {
        if (q.round !== null) fail(`${id}: unconfirmed round must be explicitly null`);
        const key = keyFor(q.key);
        if (verified.has(`${id}\0${key}`)) fail(`Verified/unconfirmed duplicate: ${id} ${key}; remove supplemental entry when promoting`);
        const uncertainty = text(q.roundUncertainty, `${id} round uncertainty`);
        return { ...q, key, round: null, question: text(q.question, 'question'), topic: text(q.topic, 'topic'), evidence: text(q.evidence, 'question evidence'), roundUncertainty: uncertainty, roundMappingNote: uncertainty, date: inWindow(q.date ?? report.date, `${id} occurrence date`), dateBasis: basis(q.dateBasis ?? report.dateBasis) };
      });
      const existing = reportMap.get(id);
      if (existing) {
        existing.questions.push(...report.questions);
        existing.aliases = [...new Set([...existing.aliases, report.url, ...report.aliases])].filter(url => url !== existing.url);
        existing.slices.push(sliceId);
      } else reportMap.set(id, report);
    }
  }
  const rows = new Map();
  for (const report of reportMap.values()) {
    const unique = new Map();
    for (const q of report.questions) {
      const previous = unique.get(q.key);
      if (!previous) unique.set(q.key, q);
      else {
        if (previous.date !== q.date || previous.dateBasis !== q.dateBasis) fail(`Conflicting duplicate occurrence date: ${report.id} ${q.key}`);
        for (const field of ['evidence', 'roundUncertainty']) if (!previous[field].includes(q[field])) previous[field] += `\n${q[field]}`;
        previous.roundMappingNote = previous.roundUncertainty;
      }
    }
    report.questions = [...unique.values()];
    for (const q of report.questions) {
      const id = `u-${q.key}`;
      let row = rows.get(id);
      if (!row) {
        const override = normalization.questions?.[q.key] ?? {};
        row = { id, round: null, question: override.question ?? q.question, topic: override.topic ?? q.topic, frequency: 0, dates: [], sources: [], locations: [], occurrences: [] };
        rows.set(id, row);
      }
      row.occurrences.push({ reportId: report.id, date: q.date, dateBasis: q.dateBasis, location: report.location, evidence: q.evidence, reportedQuestion: q.question, reportedTopic: q.topic, sourceRound: q.sourceRound ?? 'Unconfirmed', roundMappingNote: q.roundUncertainty, roundUncertainty: q.roundUncertainty });
    }
  }
  const questions = [...rows.values()].sort((a, b) => a.question.localeCompare(b.question) || a.id.localeCompare(b.id));
  for (const row of questions) {
    row.occurrences.sort((a, b) => b.date.localeCompare(a.date) || a.reportId.localeCompare(b.reportId));
    row.frequency = row.occurrences.length;
    row.dates = [...new Map(row.occurrences.map(o => [`${o.date}|${o.dateBasis}`, { date: o.date, basis: o.dateBasis }])).values()];
    row.locations = [...new Set(row.occurrences.map(o => o.location))].sort();
    row.sources = row.occurrences.map(o => { const r = reportMap.get(o.reportId); return { id: r.id, title: r.title, url: r.url }; });
  }
  const reports = [...reportMap.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const metadata = { ...strict.metadata, collection: 'unconfirmed', frequencyDefinition: 'Distinct candidate reports mentioning this final-loop question without a verified round number; cross-posts count once. Separate from round-verified frequencies.', reportCount: reports.length, questionCount: questions.length, occurrenceCount: questions.reduce((n, q) => n + q.frequency, 0) };
  const campaignIds = new Set();
  const compiledCampaigns = array(campaigns, 'campaigns').map(raw => {
    const id = text(raw.id, 'campaign id');
    if (campaignIds.has(id)) fail(`Duplicate campaign id: ${id}`);
    campaignIds.add(id);
    if (!countries.has(raw.country)) fail(`${id}: campaign country must be canonical`);
    calendarDate(raw.startDate, `${id} scope start`, true);
    calendarDate(raw.endDate, `${id} scope end`, true);
    if (raw.startDate > raw.endDate) fail(`${id}: reversed campaign scope`);
    const searchedAt = text(raw.searchedAt, 'campaign searchedAt');
    calendarDate(searchedAt.slice(0, 10), `${id} searchedAt`, true);
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(searchedAt) || !Number.isFinite(Date.parse(searchedAt))) fail(`${id}: invalid searchedAt timestamp`);
    const queries = array(raw.queries, `${id} queries`).map(q => text(q, 'campaign query'));
    if (!queries.length) fail(`${id}: campaign needs actual queries`);
    if (!['completed', 'failed'].includes(raw.status)) fail(`${id}: invalid campaign status`);
    const sources = array(raw.sources, `${id} sources`).map(source => {
      const url = webUrl(source.url, 'campaign source URL');
      if (!['verified', 'unconfirmed', 'duplicate', 'excluded', 'unresolved'].includes(source.disposition)) fail(`${id}: invalid source disposition`);
      const result = { url, disposition: source.disposition, reason: text(source.reason, 'source disposition reason') };
      const admitted = ['verified', 'unconfirmed'].includes(source.disposition);
      if (admitted || source.reportId !== undefined) {
        const reportId = idFor(source.reportId);
        const report = source.disposition === 'verified' ? strictReports.get(reportId) : source.disposition === 'unconfirmed' ? reportMap.get(reportId) : strictReports.get(reportId) ?? reportMap.get(reportId);
        if (!report || urlOwners.get(url) !== reportId) fail(`${id}: invalid ${source.disposition} report reference ${reportId} for ${url}`);
        result.reportId = reportId;
      }
      return result;
    });
    if (new Set(sources.map(s => s.url)).size !== sources.length) fail(`${id}: duplicate campaign source URL`);
    const outcome = raw.status === 'failed' ? 'failed' : sources.length === 0 ? 'no-candidates-returned' : sources.some(s => ['verified', 'unconfirmed'].includes(s.disposition)) ? 'admitted-evidence' : sources.some(s => s.disposition === 'unresolved') ? 'unresolved' : 'inspected-no-admissions';
    return { id, country: raw.country, startDate: raw.startDate, endDate: raw.endDate, searchedAt, provider: text(raw.provider, 'campaign provider'), queries, artifact: validateArtifactPath(raw.artifact), status: raw.status, ...(raw.status === 'failed' ? { error: text(raw.error, 'failed campaign error') } : {}), sources, outcome };
  }).sort((a, b) => b.searchedAt.localeCompare(a.searchedAt) || a.id.localeCompare(b.id));
  return { unconfirmed: { metadata, questions, reports, coverage }, ledger: { metadata: { title: 'Scoped research campaign ledger', campaignCount: compiledCampaigns.length, coverageDefinition: 'Documented search activity, not exhaustive interview coverage. Campaign country and dates describe search scope, never admitted record metadata.' }, campaigns: compiledCampaigns } };
}
