import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
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

/* Build only: three.js ships the shaders of every material. La Percée draws with four of them, so the
   others are left out and the comments and indentation of the rest are removed. The picture is unchanged. */
function trimThreeShaders() {
  const dir = resolve(__dirname, 'node_modules/three/src/renderers/shaders');
  const usedLib = new Set(['meshlambert', 'meshbasic', 'points', 'sprite']);
  // the chunks fp3d.js includes in its own shaders, and those three.js adds to every program
  const used = new Set();
  const addChunk = (name) => {
    if (used.has(name)) return;
    used.add(name);
    follow(readFileSync(`${dir}/ShaderChunk/${name}.glsl.js`, 'utf8'));
  };
  const follow = (code) => { for (const m of code.matchAll(/#include\s+<(\w+)>/g)) addChunk(m[1]); };
  ['common', 'fog_pars_vertex', 'fog_vertex', 'fog_pars_fragment', 'colorspace_fragment', 'colorspace_pars_fragment', 'tonemapping_pars_fragment'].forEach(addChunk);
  usedLib.forEach((name) => follow(readFileSync(`${dir}/ShaderLib/${name}.glsl.js`, 'utf8')));
  const tidy = (glsl) => glsl.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  return {
    name: 'trim-three-shaders',
    apply: 'build',
    transform(code, id) {
      const m = id.match(/three\/src\/renderers\/shaders\/(ShaderChunk|ShaderLib)\/(\w+)\.glsl\.js/);
      if (!m) return null;
      const [, kind, name] = m;
      if (kind === 'ShaderLib' && !usedLib.has(name)) return { code: "export const vertex = ''; export const fragment = '';", map: null };
      if (kind === 'ShaderChunk' && !used.has(name)) return { code: "export default '';", map: null };
      return { code: code.replace(/`([\s\S]*?)`/g, (_, glsl) => `\`\n${tidy(glsl)}\n\``), map: null };
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), classBoardMock(), trimThreeShaders()],
  // the build reads three.js from its source files: that is what lets unused parts be left out
  resolve: command === 'build' ? { alias: [{ find: /^three$/, replacement: resolve(__dirname, 'node_modules/three/src/Three.js') }] } : {},
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        lab: resolve(__dirname, 'game-lab.html'),
      },
    },
  },
}));
