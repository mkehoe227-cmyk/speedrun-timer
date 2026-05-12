import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from '../server.js';

const TMP_VAULT = path.join(os.tmpdir(), 'dashos-vault-test');

function touch(filePath, mtime) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'test', 'utf8');
  fs.utimesSync(filePath, mtime, mtime);
}

beforeEach(() => {
  process.env.VAULT_PATH = TMP_VAULT;
  fs.mkdirSync(TMP_VAULT, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP_VAULT, { recursive: true, force: true });
});

describe('GET /api/vault/activity', () => {
  it('returns projects with file counts modified in last 48h', async () => {
    const now = new Date();
    const recent = new Date(now - 1 * 60 * 60 * 1000); // 1h ago
    touch(path.join(TMP_VAULT, '🗺️ Areas', 'Atlas', 'notes.md'), recent);
    touch(path.join(TMP_VAULT, '🗺️ Areas', 'Atlas', 'todo.md'), recent);

    const res = await request(app).get('/api/vault/activity');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ project: 'Atlas', count: 2 })
    ]));
  });

  it('excludes files older than 48h', async () => {
    const old = new Date(Date.now() - 50 * 60 * 60 * 1000); // 50h ago
    touch(path.join(TMP_VAULT, '🗺️ Areas', 'OldProject', 'file.md'), old);

    const res = await request(app).get('/api/vault/activity');
    expect(res.status).toBe(200);
    const projects = res.body.map(p => p.project);
    expect(projects).not.toContain('OldProject');
  });
});

describe('GET /api/vault/rot', () => {
  it('returns projects with no file modified in 14+ days', async () => {
    const stale = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    touch(path.join(TMP_VAULT, '🗺️ Areas', 'StaleProject', 'file.md'), stale);

    const res = await request(app).get('/api/vault/rot');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ project: 'StaleProject' })
    ]));
    expect(res.body[0].daysStale).toBeGreaterThanOrEqual(15);
  });
});

describe('POST /api/vault/rot/flag', () => {
  it('appends flagged project to rot-flagged.md', async () => {
    fs.mkdirSync(path.join(TMP_VAULT, '📥 Inbox', 'AI Generated'), { recursive: true });

    const res = await request(app).post('/api/vault/rot/flag').send({ project: 'StaleProject' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const log = fs.readFileSync(
      path.join(TMP_VAULT, '📥 Inbox', 'AI Generated', 'rot-flagged.md'), 'utf8');
    expect(log).toContain('StaleProject');
  });

  it('creates Inbox/AI Generated dir when absent', async () => {
    const res = await request(app).post('/api/vault/rot/flag').send({ project: 'NewProject' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const log = fs.readFileSync(
      path.join(TMP_VAULT, '📥 Inbox', 'AI Generated', 'rot-flagged.md'), 'utf8');
    expect(log).toContain('NewProject');
  });

  it('returns 400 when project is missing', async () => {
    const res = await request(app).post('/api/vault/rot/flag').send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});
