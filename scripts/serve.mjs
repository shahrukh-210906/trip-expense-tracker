import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(fileURLToPath(new URL('../prototype/' + file[0], import.meta.url)));
    res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8' }); res.end(body);
  } catch { res.writeHead(500); res.end('Unable to load preview'); }
}).listen(5173, '127.0.0.1', () => console.log('Prototype: http://127.0.0.1:5173'));
