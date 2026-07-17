import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('..') || pathname.split('/').some(part => part.startsWith('.'))) {
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
    response.writeHead(200, { 'content-type': mimeTypes[extname(realFilePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 400);
    response.end(error?.code === 'ENOENT' ? 'Not found' : 'Bad request');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Static app server: http://127.0.0.1:${port}`);
});
