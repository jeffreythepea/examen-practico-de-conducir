// Single-range parsing shared by the static dev server and the service
// worker's cached-response path: iPadOS Safari's media stack only plays video
// delivered as byte-range (206) responses. Returns { start, end } (inclusive),
// null for "serve the whole file" (no/invalid header per RFC 9110 lenient
// handling), or 'unsatisfiable' for a 416.
export function parseByteRange(header, size) {
  if (typeof header !== 'string' || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') {
    const suffixLength = Number(match[2]);
    if (suffixLength === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }
  const start = Number(match[1]);
  if (start >= size) return 'unsatisfiable';
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (end < start) return null;
  return { start, end };
}
