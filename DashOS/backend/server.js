import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { contextRouter } from './routes/context.js';
import { vaultRouter } from './routes/vault.js';
import { healthRouter } from './routes/health.js';
import { vaultExists } from './vault-path.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/ping', (_req, res) => res.json({ ok: true }));
app.get('/api/vault-status', (_req, res) => res.json(vaultExists()));

app.use('/api/context', contextRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/health', healthRouter);

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 7070;
  app.listen(PORT, () => console.log(`DashOS backend :${PORT}`));
}
