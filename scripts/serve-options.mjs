const DEFAULT_HOST = '127.0.0.1';
const LAN_HOST = '0.0.0.0';
const DEFAULT_PORT = 4173;
const ALLOWED_HOSTS = new Set([DEFAULT_HOST, LAN_HOST]);
const ALLOWED_ROOTS = new Set(['project', 'dist']);

export function parseServerOptions(args = [], environment = process.env) {
  let host = DEFAULT_HOST;
  let root = 'project';
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--host') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--host requires a value');
      host = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('--host=')) {
      host = argument.slice('--host='.length);
      if (!host) throw new Error('--host requires a value');
      continue;
    }
    if (argument === '--root') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--root requires a value');
      root = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('--root=')) {
      root = argument.slice('--root='.length);
      if (!root) throw new Error('--root requires a value');
      continue;
    }
    throw new Error(`Unknown server option: ${argument}`);
  }
  if (!ALLOWED_HOSTS.has(host)) throw new Error(`Unsupported host: ${host}`);
  if (!ALLOWED_ROOTS.has(root)) throw new Error(`Unsupported root: ${root}`);

  const port = Number(environment.PORT || DEFAULT_PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid server port: ${environment.PORT}`);
  }
  return { host, port, root };
}

// iPadOS Safari's media stack only plays video served with byte-range (206)
// responses, so the static server honours single-range requests. Returns
// { start, end } (inclusive), null for "serve the whole file" (no/invalid
// header per RFC 9110 lenient handling), or 'unsatisfiable' for a 416.
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

export function isForbiddenPathname(pathname) {
  return pathname.includes('..') || pathname.split('/').some(part => part.startsWith('.'));
}
