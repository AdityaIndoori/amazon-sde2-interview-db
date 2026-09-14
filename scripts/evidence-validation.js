export const fail = message => { throw new Error(message); };
export const text = (value, label) => typeof value === 'string' && value.trim() ? value.trim() : fail(`Missing ${label}`);
export const basis = value => ['interview', 'publication'].includes(value) ? value : fail(`Invalid date basis: ${value}`);
export const webUrl = (value, label) => {
  let url;
  try { url = new URL(text(value, label)); } catch { fail(`Invalid ${label}: ${value}`); }
  if (url.protocol !== 'https:' || url.username || url.password) fail(`Expected public HTTPS ${label}: ${value}`);
  return url.href;
};
export const calendarDate = (value, label, exact = false) => {
  const pattern = exact ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
  if (typeof value !== 'string' || !pattern.test(value)) fail(`Invalid ${label}: ${value}`);
  const first = value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value;
  const parsed = new Date(`${first}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== first) fail(`Invalid calendar ${label}: ${value}`);
  return first;
};
