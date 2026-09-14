import { fail, text, webUrl } from './evidence-validation.js';

const qualities = ['exact-named', 'described', 'partial'];
const categories = ['Coding', 'Low-level design', 'System design', 'Behavioral', 'GenAI', 'Project deep dive'];
const codingTopics = new Set(['Algorithms', 'Arrays', 'Backtracking', 'Binary search', 'Bit manipulation', 'Caching', 'Data structure design', 'Data structures', 'Dynamic programming', 'External memory', 'Graphs', 'Greedy', 'Hash maps', 'Hashing', 'Heap', 'Heaps', 'Intervals', 'Linked lists', 'Math', 'Optimization', 'Randomized algorithms', 'Sorting', 'Stack', 'Stacks', 'Streaming', 'Strings', 'Trees', 'Trie', 'Tries']);
const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const detail = '(?:variants?|variations?|extensions?|changes?|differences?|constraints?|requirements?|operations?|inputs?|outputs?|rules?|grammar|restrictions?|details?|follow-ups?)';
const unspecifiedDetails = new RegExp(`\\b(?:unspecified|undisclosed|unreported)\\s+(?:\\w+[ -]){0,3}${detail}\\b|\\b${detail}\\b[^.;\\n]{0,80}\\b(?:not (?:disclosed|supplied|provided|reported|specified|described|given)|unspecified|undisclosed|omitted)\\b|\\b(?:does not|doesn't) (?:specify|disclose|describe|report)\\b[^.;\\n]{0,60}\\b${detail}\\b|\\bwithout\\s+(?:\\w+[ -]){0,3}details\\b`, 'i');
const variant = /\b(?:variant|variation)\b|\b(?:similar|related) to\b|\b\w+(?:-\w+)*-like problem\b/i;
const describedReason = 'Reported question description; this label does not establish source completeness or an exact named-problem match.';
const partialReason = 'Reported prompt or evidence describes a variant, similarity, or unspecified problem details; no exact named-problem match is inferred.';

const object = (value, label) => value && typeof value === 'object' && !Array.isArray(value) ? value : fail(`${label} must be an object`);

function practiceUrl(value) {
  const href = webUrl(value, 'LeetCode problem URL');
  const url = new URL(href);
  // Check the original spelling too: URL parsing otherwise normalizes dot paths,
  // backslashes, credentials, and some control characters into plausible URLs.
  if (typeof value !== 'string' || !/^https:\/\/(?:www\.)?leetcode\.com\/problems\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(value)
    || !['leetcode.com', 'www.leetcode.com'].includes(url.hostname) || url.port || url.search || url.hash) {
    fail(`Invalid LeetCode problem URL: ${value}`);
  }
  return href;
}

function validateAssessments(assessments) {
  const registry = object(assessments, 'Evidence assessments');
  const occurrences = object(registry.occurrences ?? {}, 'Occurrence assessments');
  const overrides = object(registry.categories ?? {}, 'Category assessments');
  const validated = new Map();
  for (const [target, raw] of Object.entries(occurrences)) {
    const parts = target.split('|');
    if (parts.length !== 3 || !parts[0] || /\s/.test(parts[0]) || !/^(?:[1-4]|unconfirmed)$/.test(parts[1]) || !keyPattern.test(parts[2])) fail(`Invalid assessment target: ${target}`);
    const assessment = object(raw, `Assessment ${target}`);
    if (!qualities.includes(assessment.quality)) fail(`Invalid evidence quality for ${target}: ${assessment.quality}`);
    const result = { evidenceQuality: assessment.quality, qualityReason: text(assessment.reason, `assessment reason for ${target}`) };
    if (assessment.quality === 'exact-named') {
      result.problemEvidence = text(assessment.problemEvidence, `named-problem source proof for ${target}`);
      if (Object.hasOwn(assessment, 'problemUrl')) result.problemUrl = practiceUrl(assessment.problemUrl);
    } else if (Object.hasOwn(assessment, 'problemUrl') || Object.hasOwn(assessment, 'problemEvidence')) {
      fail(`Problem links and proof require exact-named quality for ${target}`);
    }
    validated.set(target, { round: parts[1], fields: result });
  }
  for (const [key, category] of Object.entries(overrides)) {
    if (!keyPattern.test(key)) fail(`Invalid category assessment target: ${key}`);
    if (!categories.includes(category)) fail(`Invalid category for ${key}: ${category}`);
  }
  return { validated, overrides };
}

function categoryFor(row, key, overrides) {
  if (Object.hasOwn(overrides, key)) return overrides[key];
  const primary = text(row.topic, `topic for ${row.id}`).split('/')[0].trim();
  if (['GenAI', 'Generative AI'].includes(primary)) return 'GenAI';
  if (categories.includes(primary)) return primary;
  if (codingTopics.has(primary)) return 'Coding';
  fail(`Ambiguous or unknown topic for ${row.id}: ${row.topic}; add a category assessment`);
}

// This registry is shared by strict and unconfirmed collections. Unknown targets
// are rejected only in this collection's round namespace; the other call checks
// the other namespace. Category target existence needs the union at integration.
export function enrichEvidence(collection, assessments = {}) {
  const { validated, overrides } = validateAssessments(assessments);
  const unconfirmed = collection.metadata?.collection === 'unconfirmed';
  const seen = new Set();
  const questions = collection.questions.map(row => {
    if (unconfirmed ? row.round !== null : ![1, 2, 3, 4].includes(row.round)) fail(`Invalid round for ${row.id}`);
    const round = unconfirmed ? 'unconfirmed' : String(row.round);
    const prefix = unconfirmed ? 'u-' : `r${row.round}-`;
    if (typeof row.id !== 'string' || !row.id.startsWith(prefix) || !keyPattern.test(row.id.slice(prefix.length))) fail(`Invalid question identity: ${row.id}`);
    const key = row.id.slice(prefix.length);
    const category = categoryFor(row, key, overrides);
    const occurrences = row.occurrences.map(occurrence => {
      const target = `${occurrence.reportId}|${round}|${key}`;
      seen.add(target);
      // Re-enrichment must never retain a stale or unassessed practice link.
      const { evidenceQuality, qualityReason, problemUrl, problemEvidence, ...original } = occurrence;
      const assessment = validated.get(target);
      if (assessment) return { ...original, ...assessment.fields };
      const prompt = `${occurrence.reportedQuestion ?? ''}\n${occurrence.evidence ?? ''}`;
      const partial = unspecifiedDetails.test(prompt) || category === 'Coding' && variant.test(prompt);
      return { ...original, evidenceQuality: partial ? 'partial' : 'described', qualityReason: partial ? partialReason : describedReason };
    });
    const present = new Set(occurrences.map(occurrence => occurrence.evidenceQuality));
    return { ...row, category, evidenceQualities: qualities.filter(quality => present.has(quality)), occurrences };
  });
  for (const [target, assessment] of validated) {
    if ((assessment.round === 'unconfirmed') === unconfirmed && !seen.has(target)) fail(`Unknown assessment target: ${target}`);
  }
  return { ...collection, questions };
}
