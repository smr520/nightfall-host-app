const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'desktop', 'app');
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

function requestedFile(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const relative = pathname === '/' || path.extname(pathname) === '' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  if (path.relative(root, resolved).startsWith('..')) return null;
  return resolved;
}

const server = http.createServer((request, response) => {
  const file = requestedFile(request.url || '/');
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', mimeTypes[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).on('error', () => response.writeHead(404).end('Not found')).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Desktop preview: http://127.0.0.1:${port}\n`);
});
