import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isForbiddenPathname, parseByteRange, parseServerOptions } from './serve-options.mjs';

const projectRoot = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const { host, port, root: rootOption } = parseServerOptions(process.argv.slice(2), process.env);
const root = rootOption === 'dist'
  ? await realpath(resolve(projectRoot, 'dist'))
  : projectRoot;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (isForbiddenPathname(pathname)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const filePath = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
    if (relative(root, filePath).startsWith('..')) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const realFilePath = await realpath(filePath);
    if (relative(root, realFilePath).startsWith('..')) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const body = await readFile(realFilePath);
    const contentType = mimeTypes[extname(realFilePath)] ?? 'application/octet-stream';
    const range = parseByteRange(request.headers.range, body.length);
    if (range === 'unsatisfiable') {
      response.writeHead(416, { 'content-range': `bytes */${body.length}` });
      response.end();
      return;
    }
    if (range) {
      response.writeHead(206, {
        'content-type': contentType,
        'accept-ranges': 'bytes',
        'content-range': `bytes ${range.start}-${range.end}/${body.length}`,
        'content-length': range.end - range.start + 1
      });
      response.end(body.subarray(range.start, range.end + 1));
      return;
    }
    response.writeHead(200, {
      'content-type': contentType,
      'accept-ranges': 'bytes',
      'content-length': body.length
    });
    response.end(body);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 400);
    response.end(error?.code === 'ENOENT' ? 'Not found' : 'Bad request');
  }
});

server.listen(port, host, () => {
  console.log(`Static app server: http://${host}:${port}`);
});
