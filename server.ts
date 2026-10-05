import express from 'express';
import path from 'path';
import fs from 'fs';
import { app } from './server/app';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const argPort = portIndex !== -1 && args[portIndex + 1] ? Number(args[portIndex + 1]) : null;
const PORT = argPort || Number(process.env.PORT) || 3000;

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const distDir = path.resolve('dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.use((req, res, next) => {
        if (req.method !== 'GET') return next();
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
          return next();
        }
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Full-Stack App] Running at http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
