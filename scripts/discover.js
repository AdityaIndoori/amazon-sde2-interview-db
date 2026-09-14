import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, text, calendarDate } from './evidence-validation.js';
import { validateArtifactPath } from './research-expansion.js';
import { canonicalUrl, emptyQueue, reportIndex, validateQueue, timestamp } from './research-status.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const queuePath = 'data/review-queue.json';
export function reviewQueuePath(path) {
  validateArtifactPath(path);
  if (basename(path) !== 'review-queue.json') fail('Queue destination must be named review-queue.json, never a corpus file');
  return path;
}
export const candidateId = url => `candidate-${createHash('sha256').update(canonicalUrl(url)).digest('hex').slice(0, 24)}`;
export async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function loadCollections() {
  const [strict, unconfirmed] = await Promise.all([readJson('data/database.json'), readJson('data/unconfirmed.json')]);
  return { strict, unconfirmed };
}
export function localPath(path) {
  validateArtifactPath(path);
  return resolve(root, path);
}
export async function safeDirectory(path) {
  const target = path === '.' ? root : localPath(path);
  // Check existing ancestors before mkdir so a symlink cannot create files outside the repository.
  let ancestor = target;
  while (true) {
    try {
      const actual = await realpath(ancestor);
      const rel = relative(await realpath(root), actual);
      if (rel.startsWith('..') || isAbsolute(rel)) fail('Output directory escapes repository');
      break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = dirname(ancestor); }
  }
  await mkdir(target, { recursive: true });
  return target;
}
export async function writeJson(path, value) {
  const destination = localPath(path);
  await safeDirectory(relative(root, dirname(destination)) || '.');
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, destination);
}
export function argumentsFor(argv, defaults, allowed) {
  const options = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (argv[i] === '--help') return { help: true };
    if (!argv[i].startsWith('--') || !allowed.includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) fail(`Unknown or missing argument: ${argv[i]}`);
    options[key] = argv[++i];
  }
  return options;
}

export function discoveryWindow({ start, end = new Date().toISOString().slice(0, 10), country = 'All countries', overlap = 7 }, queue, cutoff) {
  calendarDate(end, 'end date', true);
  const days = Number(overlap);
  if (!Number.isInteger(days) || days < 0 || days > 30) fail('Overlap must be an integer from 0 to 30');
  const last = queue.runs.filter(run => run.status === 'successful' && run.country === country).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const since = last?.endDate ?? cutoff;
  calendarDate(since, 'discovery watermark', true);
  const startDate = start ?? new Date(Date.parse(`${since}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  calendarDate(startDate, 'start date', true);
  if (startDate > end) fail('Start date must not be after end date');
  return { startDate, endDate: end };
}

export function pendingCandidates(results, { queue, collections, runId, discoveredAt }) {
  const known = reportIndex(collections).urls;
  const prior = new Map(queue.candidates.map(candidate => [canonicalUrl(candidate.url), candidate]));
  const candidates = new Map();
  const ignored = [];
  for (const result of results) {
    let url;
    try { url = canonicalUrl(result.url); }
    catch { ignored.push({ url: typeof result.url === 'string' ? result.url : null, reason: 'Not a public HTTPS result URL' }); continue; }
    if (known.has(url)) { ignored.push({ url: result.url, reason: 'Already admitted URL or alias', reportId: known.get(url) }); continue; }
    if (prior.has(url)) { ignored.push({ url: result.url, reason: 'Already in review queue', candidateId: prior.get(url).id }); continue; }
    if (candidates.has(url)) continue;
    const candidate = { id: candidateId(url), url: result.url, title: typeof result.title === 'string' && result.title.trim() ? result.title.trim() : result.url, discoveredAt, runIds: [runId], status: 'pending' };
    if (result.publishedDate) {
      try { candidate.publishedDate = timestamp(result.publishedDate, 'result publishedDate'); }
      catch { /* Invalid provider metadata remains in the response artifact, not the queue. */ }
    }
    candidates.set(url, candidate);
  }
  return { candidates: [...candidates.values()], ignored };
}

export function parseMcpResponse(raw, id) {
  let messages;
  try { messages = [JSON.parse(raw)]; }
  catch {
    messages = raw.split(/\r?\n\r?\n/).flatMap(event => {
      const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      return data ? [JSON.parse(data)] : [];
    });
  }
  const message = messages.find(item => item.id === id);
  if (!message) fail('MCP response did not contain the requested result');
  if (message.error) fail(`MCP error: ${JSON.stringify(message.error)}`);
  if (message.result?.isError) fail(`Exa search failed: ${JSON.stringify(message.result.content)}`);
  if (!message.result) fail('MCP response is missing a result');
  return message.result;
}

export function searchResults(result) {
  if (Array.isArray(result.structuredContent?.results)) return result.structuredContent.results;
  for (const part of result.content ?? []) {
    if (part.type !== 'text') continue;
    try { const parsed = JSON.parse(part.text); if (Array.isArray(parsed.results)) return parsed.results; }
    catch { /* Non-JSON provider messages are not evidence of zero candidates. */ }
  }
  fail('Exa response has no structured results array; refusing to advance watermark');
}

const usage = `Usage: bun scripts/discover.js [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--country "United States"] [--results 10] [--overlap 7] [--output data/discovery] [--queue data/review-queue.json]
Runs exactly one bounded Exa advanced search (1–25 results), no retries. EXA_API_KEY is optional.
Window defaults to the latest successful end date for this country, minus overlap (0–30 days), or corpus cutoff. Output contains request/response audit and a pending-only review-queue.json; import explicitly to advance the local watermark. Publication window and query country are not admitted interview metadata.`;

export async function discover(options) {
  const collections = await loadCollections();
  const queue = validateQueue(await readJson(options.queue ?? queuePath, emptyQueue()), collections);
  const count = Number(options.results ?? 10);
  if (!Number.isInteger(count) || count < 1 || count > 25) fail('Results must be an integer from 1 to 25');
  const country = text(options.country ?? 'All countries', 'country');
  if (country.length > 100) fail('Country must be at most 100 characters');
  const window = discoveryWindow({ ...options, country }, queue, collections.strict.metadata.endDate);
  const output = options.output ?? 'data/discovery';
  validateArtifactPath(output);
  if (resolve(root, output, 'review-queue.json') === resolve(root, options.queue ?? queuePath)) fail('Discovery output must not overwrite the authoritative queue; use import-discovery.js');
  await safeDirectory(output);
  const startedAt = new Date().toISOString();
  const id = `discovery-${startedAt.replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const query = `First-person Amazon SDE II SDE 2 L5 final onsite interview experience with specific coding, low-level design or system design questions${country === 'All countries' ? '' : ` in ${country}`}`;
  const run = { id, startedAt, status: 'failed', country, ...window, queries: [query], artifact: `${output}/${id}.json` };
  const endpoint = 'https://mcp.exa.ai/mcp?tools=web_search_advanced_exa';
  const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'web_search_advanced_exa', arguments: { query, numResults: count, type: 'auto', startPublishedDate: `${window.startDate}T00:00:00.000Z`, endPublishedDate: `${window.endDate}T23:59:59.999Z`, textMaxCharacters: 2000 } } };
  const artifact = { version: 1, runId: id, endpoint, request, responses: [] };
  const redact = value => process.env.EXA_API_KEY ? value.split(process.env.EXA_API_KEY).join('[REDACTED]') : value;
  let candidates = [];
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(process.env.EXA_API_KEY ? { 'x-api-key': process.env.EXA_API_KEY } : {}) }, body: JSON.stringify(request), signal: AbortSignal.timeout(90000) });
    const raw = redact(await response.text());
    artifact.responses.push({ status: response.status, contentType: response.headers.get('content-type'), body: raw });
    if (!response.ok) fail(`Exa HTTP ${response.status}`);
    const results = searchResults(parseMcpResponse(raw, 1));
    const found = pendingCandidates(results.slice(0, count), { queue, collections, runId: id, discoveredAt: startedAt });
    candidates = found.candidates;
    artifact.ignored = found.ignored;
    run.status = 'successful';
  } catch (error) {
    run.error = redact(error.message);
    artifact.error = run.error;
  }
  run.completedAt = new Date().toISOString();
  artifact.run = run;
  artifact.candidates = candidates;
  await writeJson(run.artifact, artifact);
  const existingOutput = validateQueue(await readJson(`${output}/review-queue.json`, emptyQueue()), collections);
  // Repeated discovery calls in one output directory retain all audit runs until explicit import.
  const { mergeDiscovery } = await import('./import-discovery.js');
  const merged = mergeDiscovery(existingOutput, { version: 1, runs: [run], candidates }, collections);
  await writeJson(`${output}/review-queue.json`, merged);
  return { run, candidates: candidates.length, output: `${output}/review-queue.json` };
}

if (import.meta.main) {
  try {
    const options = argumentsFor(process.argv.slice(2), {}, ['start', 'end', 'country', 'results', 'overlap', 'output', 'queue']);
    if (options.help) console.log(usage);
    else { const result = await discover(options); console.log(JSON.stringify(result, null, 2)); if (result.run.status === 'failed') process.exitCode = 1; }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
