import { app } from './app';

const PORT = Number(process.env.PORT) || 3001;

// If started directly via `node server/index.ts`
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API Server] Running at http://0.0.0.0:${PORT}`);
});

export { app };
