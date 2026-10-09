import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const allowed = new Set(['index.html', 'pivot.html', 'styles.css', 'app.js', 'physics.js', 'input-source.js', 'scopes.js', 'workspace-ui.js', 'lab.html', 'lab.js', 'plants.js', 'plant-scenes.js', 'update.html', 'update.css', 'update.js']);
export function createLocalServer() {
return http.createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'gallery.html';
  if (['pivot.html','lab.html'].includes(name)) { res.writeHead(302, { Location: '/gallery.html', 'Cache-Control': 'no-store' }); res.end(); return; }
  if (!allowed.has(name) && !['gallery.html','gallery.js','gallery.css'].includes(name)) { res.writeHead(404); res.end('No encontrado'); return; }
  try {
    const data = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': `${types[path.extname(name)]}; charset=utf-8`, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(data);
  } catch { res.writeHead(500); res.end('No se pudo abrir el archivo'); }
});
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const server = createLocalServer();
server.listen(3000, '127.0.0.1', () => console.log('Laboratorio local: http://127.0.0.1:3000'));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}
