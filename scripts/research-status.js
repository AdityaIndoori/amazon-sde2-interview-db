import { fail, text, webUrl, calendarDate } from './evidence-validation.js';
import { validateArtifactPath } from './research-expansion.js';

const array = (value, label) => Array.isArray(value) ? value : fail(`${label} must be an array`);
export const emptyQueue = () => ({ version: 1, runs: [], candidates: [] });
export function timestamp(value, label) {
  text(value, label);
  calendarDate(value.slice(0, 10), label, true);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) || !Number.isFinite(Date.parse(value))) fail(`Invalid ${label}`);
  return value;
}

// Tracking parameters and platform title slugs do not identify distinct reports.
export function canonicalUrl(value) {
  const url = new URL(webUrl(value, 'source URL'));
  url.hash = '';
  url.hostname = url.hostname.replace(/^www\./, '');
  if (['old.reddit.com', 'new.reddit.com'].includes(url.hostname)) url.hostname = 'reddit.com';
  const reddit = url.hostname === 'reddit.com' && url.pathname.match(/\/comments\/([a-z0-9]+)/i);
  const leetcode = url.hostname === 'leetcode.com' && url.pathname.match(/^\/discuss\/(?:post\/)?(\d+)/);
  if (reddit) { url.pathname = `/comments/${reddit[1].toLowerCase()}`; url.search = ''; }
  else if (leetcode) { url.pathname = `/discuss/post/${leetcode[1]}`; url.search = ''; }
  else {
    for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid|ref|source|share|share_id)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  }
  return url.href;
}

export function reportIndex(collections) {
  const reports = new Map();
  const urls = new Map();
  for (const collection of Object.values(collections)) {
    for (const report of array(collection.reports, 'collection reports')) {
      const id = text(report.id, 'report id');
      reports.set(id, report);
      for (const raw of [report.url, ...(report.aliases ?? [])]) {
        const url = canonicalUrl(raw);
        if (urls.has(url) && urls.get(url) !== id) fail(`Conflicting admitted URL: ${url}`);
        urls.set(url, id);
      }
    }
  }
  return { reports, urls };
}

export function validateQueue(queue, collections) {
  if (queue?.version !== 1) fail('Unsupported review queue version');
  const { reports, urls } = reportIndex(collections);
  const runIds = new Set();
  const runs = array(queue.runs, 'queue runs').map(run => {
    const id = text(run.id, 'run id');
    if (runIds.has(id)) fail(`Duplicate run id: ${id}`);
    runIds.add(id);
    timestamp(run.startedAt, 'run startedAt');
    if (run.completedAt !== undefined) {
      timestamp(run.completedAt, 'run completedAt');
      if (Date.parse(run.completedAt) < Date.parse(run.startedAt)) fail(`Run ${id} completes before it starts`);
    }
    if (!['successful', 'failed'].includes(run.status)) fail(`Invalid run status: ${id}`);
    if (run.status === 'successful' && !run.completedAt) fail(`Successful run ${id} needs completedAt`);
    if (run.status === 'failed') text(run.error, 'failed run error');
    calendarDate(run.startDate, 'run startDate', true);
    calendarDate(run.endDate, 'run endDate', true);
    if (run.startDate > run.endDate) fail(`Reversed run window: ${id}`);
    text(run.country, 'run country');
    if (!array(run.queries, 'run queries').length) fail(`Run ${id} needs queries`);
    run.queries.forEach(query => text(query, 'run query'));
    validateArtifactPath(run.artifact);
    return structuredClone(run);
  });
  const candidateIds = new Set();
  const candidateUrls = new Set();
  const candidates = array(queue.candidates, 'queue candidates').map(candidate => {
    const id = text(candidate.id, 'candidate id');
    const url = canonicalUrl(candidate.url);
    if (candidateIds.has(id) || candidateUrls.has(url)) fail(`Duplicate queue candidate: ${id}`);
    candidateIds.add(id);
    candidateUrls.add(url);
    text(candidate.title, 'candidate title');
    timestamp(candidate.discoveredAt, 'candidate discoveredAt');
    if (candidate.publishedDate !== undefined) timestamp(candidate.publishedDate, 'candidate publishedDate');
    if (!array(candidate.runIds, 'candidate runIds').length || new Set(candidate.runIds).size !== candidate.runIds.length || candidate.runIds.some(runId => !runIds.has(runId))) fail(`Invalid run reference: ${id}`);
    if (!['pending', 'rejected', 'duplicate', 'accepted'].includes(candidate.status)) fail(`Invalid candidate status: ${id}`);
    if (candidate.status !== 'pending') text(candidate.reason, 'review reason');
    if (candidate.reportId !== undefined && !reports.has(candidate.reportId)) fail(`Unknown admitted report: ${candidate.reportId}`);
    if (candidate.status === 'accepted' && (!candidate.reportId || urls.get(url) !== candidate.reportId)) fail(`Accepted candidate ${id} must match an admitted report URL or alias`);
    return structuredClone(candidate);
  });
  return { version: 1, runs, candidates };
}

export function compileResearchStatus({ queue = emptyQueue(), history = [], collections, campaigns = [] }) {
  const validated = validateQueue(queue, collections);
  const collectionEntries = Object.entries(collections);
  const cutoff = calendarDate((collections.strict ?? collectionEntries[0]?.[1])?.metadata?.endDate, 'corpus cutoff', true);
  const releases = Array.isArray(history) ? history : history?.version === 1 ? history.releases : fail('Unsupported history version');
  const releaseIds = new Set();
  const rows = new Map(collectionEntries.map(([name, collection]) => [name, new Set(array(collection.questions, 'collection questions').map(row => row.id))]));
  const compiledHistory = array(releases, 'history releases').map(release => {
    const id = text(release.id, 'release id');
    if (releaseIds.has(id)) fail(`Duplicate release id: ${id}`);
    releaseIds.add(id);
    timestamp(release.date, 'release date');
    text(release.summary, 'release summary');
    for (const change of array(release.changes, 'release changes')) {
      if (!rows.has(change.collection)) fail(`Unknown history collection: ${change.collection}`);
      text(change.id, 'changed row id');
      if (!['added', 'corrected', 'removed'].includes(change.type)) fail(`Invalid history change type: ${change.type}`);
      if (change.fields !== undefined) array(change.fields, 'changed fields').forEach(field => text(field, 'changed field'));
      // Removed rows and historical additions may no longer exist; snapshots are their durable reference.
      if (!rows.get(change.collection).has(change.id) && change.before?.id !== change.id && change.after?.id !== change.id) fail(`Unresolved history row: ${change.collection}/${change.id}`);
    }
    return structuredClone(release);
  });
  const successes = validated.runs.filter(run => run.status === 'successful').map(run => run.completedAt);
  const attempts = validated.runs.map(run => run.completedAt ?? run.startedAt);
  const campaignIds = new Set();
  const { urls } = reportIndex(collections);
  for (const campaign of array(campaigns, 'campaigns')) {
    const id = text(campaign.id, 'campaign id');
    if (campaignIds.has(id)) fail(`Duplicate campaign id: ${id}`);
    campaignIds.add(id);
    timestamp(campaign.searchedAt, 'campaign searchedAt');
    if (!['completed', 'failed'].includes(campaign.status)) fail(`Invalid campaign status: ${id}`);
    if (campaign.status === 'failed') text(campaign.error, 'failed campaign error');
    validateArtifactPath(campaign.artifact);
    for (const source of array(campaign.sources, 'campaign sources')) {
      if (source.reportId !== undefined && urls.get(canonicalUrl(source.url)) !== source.reportId) fail(`Invalid campaign report reference: ${source.reportId}`);
    }
    attempts.push(campaign.searchedAt);
    if (campaign.status === 'completed') successes.push(campaign.searchedAt);
  }
  const latest = values => values.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  return {
    lastResearchedAt: latest(successes), lastAttemptedAt: latest(attempts), cutoff,
    queue: validated.candidates.sort((a, b) => Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt) || a.id.localeCompare(b.id)),
    runs: validated.runs.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || a.id.localeCompare(b.id)),
    history: compiledHistory.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id)),
  };
}
