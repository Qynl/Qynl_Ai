import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) throw new Error('Invalid path');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': types[extname(filePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Qynl AI is running at http://localhost:${port}`);
});
