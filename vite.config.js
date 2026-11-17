import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/* Dev only: answer /api/board like the deployed function (game-lab-api/board.mjs), backed by an
   in-memory Redis, so La Percée's class board can be tried with `npm run dev`. `apply: 'serve'`
   keeps it out of `vite build`. /api/__dev/down and /api/__dev/up simulate the store failing. */
function classBoardMock() {
  return {
    name: 'percee-class-board-mock',
    apply: 'serve',
    async configureServer(server) {
      const { createHandler } = await import('./game-lab-api/board.mjs');
      const { fakeRedis } = await import('./game-lab-api/fake-redis.mjs');
      const db = fakeRedis();
      const handle = createHandler({ redis: db, env: { ADMIN_KEY: 'dev' } });
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/__dev/down' || url.pathname === '/api/__dev/up') {
          db.setDown(url.pathname.endsWith('down')); res.end('ok'); return;
        }
        if (url.pathname !== '/api/board') { next(); return; }
        const chunks = []; for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }));
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await r.arrayBuffer()));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), classBoardMock()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        lab: resolve(__dirname, 'game-lab.html'),
      },
    },
  },
});
