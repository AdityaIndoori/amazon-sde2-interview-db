import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const server = Bun.serve({
  hostname: '127.0.0.1', port,
  async fetch(request) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response('Bad request', { status: 400 }); }
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    if (pathname.split('/').some(segment => segment.startsWith('.'))) return new Response('Not found', { status: 404 });
    // /preview/ exercises deployment under a GitHub Pages project subpath.
    if (pathname.startsWith('/preview/')) pathname = pathname.slice('/preview'.length);
    const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) return new Response('Not found', { status: 404 });
    const file = Bun.file(target);
    if (!(await file.exists())) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : file, { headers: { 'Content-Type': file.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  },
});
console.log(`Serving http://localhost:${server.port}`);
