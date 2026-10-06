import express from 'express';
import path from 'path';
import fs from 'fs';

// Muat .env jika ada file .env lokal dan gantikan placeholder jika ada
if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim().replace(/^['"](.*)['"]$/, '$1');
        if (
          !process.env[key] ||
          process.env[key]?.includes('your_') ||
          process.env[key]?.includes('change_me') ||
          process.env[key]?.includes('dummy') ||
          process.env[key]?.trim() === ''
        ) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.warn('Gagal memuat .env lokal:', e);
  }
}

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
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
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
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        if (req.method === 'HEAD') {
          res.status(200).set({ 'Content-Type': 'text/html' }).end();
        } else {
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        }
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
