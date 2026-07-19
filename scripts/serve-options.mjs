const DEFAULT_HOST = '127.0.0.1';
const LAN_HOST = '0.0.0.0';
const DEFAULT_PORT = 4173;
const ALLOWED_HOSTS = new Set([DEFAULT_HOST, LAN_HOST]);

export function parseServerOptions(args = [], environment = process.env) {
  let host = DEFAULT_HOST;
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
    throw new Error(`Unknown server option: ${argument}`);
  }
  if (!ALLOWED_HOSTS.has(host)) throw new Error(`Unsupported host: ${host}`);

  const port = Number(environment.PORT || DEFAULT_PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid server port: ${environment.PORT}`);
  }
  return { host, port };
}

export function isForbiddenPathname(pathname) {
  return pathname.includes('..') || pathname.split('/').some(part => part.startsWith('.'));
}
