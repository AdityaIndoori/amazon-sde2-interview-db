import { realpath, readFile } from 'node:fs/promises';
import { relative, isAbsolute } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fail } from './evidence-validation.js';
import { canonicalUrl, emptyQueue, reportIndex, validateQueue } from './research-status.js';
import { argumentsFor, loadCollections, localPath, queuePath, readJson, reviewQueuePath, root, writeJson } from './discover.js';

export function mergeDiscovery(local, incoming, collections) {
  const output = validateQueue(local, collections);
  const imported = validateQueue(incoming, collections);
  if (imported.candidates.some(candidate => candidate.status !== 'pending' || candidate.reportId !== undefined || candidate.reason !== undefined)) fail('Discovery imports must contain pending candidates only; review locally');
  const runs = new Map(output.runs.map(run => [run.id, run]));
  for (const run of imported.runs) {
    if (runs.has(run.id) && !isDeepStrictEqual(runs.get(run.id), run)) fail(`Conflicting imported run: ${run.id}`);
    if (!runs.has(run.id)) { runs.set(run.id, run); output.runs.push(run); }
  }
  const known = reportIndex(collections).urls;
  const urls = new Map(output.candidates.map(candidate => [canonicalUrl(candidate.url), candidate]));
  const ids = new Map(output.candidates.map(candidate => [candidate.id, canonicalUrl(candidate.url)]));
  for (const candidate of imported.candidates) {
    const url = canonicalUrl(candidate.url);
    if (ids.has(candidate.id) && ids.get(candidate.id) !== url) fail(`Conflicting imported candidate id: ${candidate.id}`);
    const existing = urls.get(url);
    if (existing) {
      existing.runIds = [...new Set([...existing.runIds, ...candidate.runIds])];
      // A downloaded artifact cannot undo a curator's local decision or rewrite its metadata.
      continue;
    }
    if (known.has(url)) continue;
    urls.set(url, candidate);
    ids.set(candidate.id, url);
    output.candidates.push(candidate);
  }
  return validateQueue(output, collections);
}

export async function readContainedJson(path) {
  const resolved = await realpath(localPath(path));
  const rel = relative(await realpath(root), resolved);
  if (rel.startsWith('..') || isAbsolute(rel)) fail(`Artifact escapes repository: ${path}`);
  return JSON.parse(await readFile(resolved, 'utf8'));
}

const usage = `Usage: bun scripts/import-discovery.js --input data/discovery/review-queue.json [--queue data/review-queue.json]
Extract workflow artifacts into their original repository-relative output directory first.
Validates all referenced public audit artifacts, merges runs and deduplicates pending URLs, preserving local decisions. Never writes admitted corpus data.`;

export async function importDiscovery(options) {
  if (!options.input) fail('Required --input discovery review-queue.json');
  const destination = reviewQueuePath(options.queue ?? queuePath);
  if (localPath(destination) === localPath(options.input)) fail('Import input and authoritative queue must differ');
  const collections = await loadCollections();
  const local = await readJson(destination, emptyQueue());
  const incoming = validateQueue(await readContainedJson(options.input), collections);
  for (const run of incoming.runs) {
    const artifact = await readContainedJson(run.artifact);
    if (artifact.version !== 1 || artifact.runId !== run.id || !isDeepStrictEqual(artifact.run, run) || !artifact.request || !Array.isArray(artifact.responses)) fail(`Mismatched discovery audit artifact: ${run.artifact}`);
    if (!Array.isArray(artifact.candidates)) fail(`Missing artifact candidates: ${run.artifact}`);
    for (const candidate of incoming.candidates.filter(candidate => candidate.runIds.includes(run.id))) {
      const evidence = artifact.candidates.find(item => item.id === candidate.id || canonicalUrl(item.url) === canonicalUrl(candidate.url));
      if (!evidence || canonicalUrl(evidence.url) !== canonicalUrl(candidate.url) || evidence.status !== 'pending') fail(`Candidate lacks discovery artifact reference: ${candidate.id}`);
    }
  }
  const merged = mergeDiscovery(local, incoming, collections);
  await writeJson(destination, merged);
  return { queue: destination, runs: merged.runs.length, candidates: merged.candidates.length };
}

if (import.meta.main) {
  try {
    const options = argumentsFor(process.argv.slice(2), {}, ['input', 'queue']);
    if (options.help) console.log(usage);
    else console.log(JSON.stringify(await importDiscovery(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
