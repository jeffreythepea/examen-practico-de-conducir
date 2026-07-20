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

export function isForbiddenPathname(pathname) {
  return pathname.includes('..') || pathname.split('/').some(part => part.startsWith('.'));
}
