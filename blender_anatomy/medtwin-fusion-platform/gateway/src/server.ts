import express from 'express';
import { fusionRouter } from './routes/fusionRoute.js';

export function createServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' })); // room for base64 images/ECG
  app.use(fusionRouter);

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  return app;
}

// Only actually listen when run directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createServer();
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.log(`MedTwin gateway listening on :${port}`));
}
