import { fail, text } from './evidence-validation.js';
import { canonicalUrl, emptyQueue, reportIndex, validateQueue } from './research-status.js';
import { argumentsFor, loadCollections, queuePath, readJson, reviewQueuePath, writeJson } from './discover.js';

export function reviewCandidate(queue, { id, status, reason, report }, collections) {
  const output = validateQueue(queue, collections);
  if (!['pending', 'rejected', 'duplicate', 'accepted'].includes(status)) fail('Status must be pending, rejected, duplicate or accepted');
  const candidate = output.candidates.find(item => item.id === id);
  if (!candidate) fail(`Unknown candidate: ${id}`);
  const decisionReason = text(reason, 'review reason');
  const { reports, urls } = reportIndex(collections);
  let reportId;
  if (report) {
    reportId = reports.has(report) ? report : urls.get(canonicalUrl(report));
    if (!reportId) fail('Report reference must identify an already admitted report');
  }
  if (status === 'accepted' && (!reportId || urls.get(canonicalUrl(candidate.url)) !== reportId)) fail('Acceptance requires an existing admitted report matching the candidate URL or alias; curate source evidence separately first');
  candidate.status = status;
  candidate.reason = decisionReason;
  delete candidate.reportId;
  if (reportId) candidate.reportId = reportId;
  return validateQueue(output, collections);
}

const usage = `Usage: bun scripts/review-queue.js --id candidate-ID --status pending|rejected|duplicate|accepted --reason "Curator evidence/reason" [--report admitted-report-ID-or-URL] [--queue data/review-queue.json]
Accepted requires an already admitted report ID/URL whose canonical URL or alias matches this candidate. This command records review only; it never admits or modifies corpus records. Rejected and duplicate decisions require reasons.`;


if (import.meta.main) {
  try {
    const options = argumentsFor(process.argv.slice(2), {}, ['id', 'status', 'reason', 'report', 'queue']);
    if (options.help) console.log(usage);
    else {
      const path = reviewQueuePath(options.queue ?? queuePath);
      const collections = await loadCollections();
      const queue = await readJson(path, emptyQueue());
      const reviewed = reviewCandidate(queue, options, collections);
      await writeJson(path, reviewed);
      console.log(JSON.stringify(reviewed.candidates.find(candidate => candidate.id === options.id), null, 2));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
