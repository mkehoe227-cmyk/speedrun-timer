import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from '../server.js';

const TMP_VAULT = path.join(os.tmpdir(), 'dashos-health-test');

beforeEach(() => {
  process.env.VAULT_PATH = TMP_VAULT;
  fs.mkdirSync(path.join(TMP_VAULT, 'AI OS'), { recursive: true });
  fs.mkdirSync(path.join(TMP_VAULT, '📥 Inbox', 'AI Generated'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP_VAULT, { recursive: true, force: true });
});

describe('GET /api/health/maps', () => {
  it('returns valid status for existing maps', async () => {
    fs.writeFileSync(path.join(TMP_VAULT, 'AI OS', 'me.md'), 'content', 'utf8');
    fs.writeFileSync(path.join(TMP_VAULT, 'AI OS', 'vault_map.md'), 'content', 'utf8');
    fs.writeFileSync(path.join(TMP_VAULT, 'AI OS', 'skills_map.md'), 'content', 'utf8');

    const res = await request(app).get('/api/health/maps');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'me.md', exists: true })
    ]));
  });

  it('returns exists:false for missing maps', async () => {
    const res = await request(app).get('/api/health/maps');
    expect(res.status).toBe(200);
    const meMd = res.body.find(m => m.name === 'me.md');
    expect(meMd.exists).toBe(false);
  });
});

describe('GET /api/health/git', () => {
  it('returns no-git when vault has no git repo', async () => {
    // TMP_VAULT has no git init, so execSync throws naturally
    const res = await request(app).get('/api/health/git');
    expect(res.status).toBe(200);
    expect(res.body.git).toBe(false);
  });
});

describe('GET /api/health/log', () => {
  it('returns empty array when log file missing', async () => {
    const res = await request(app).get('/api/health/log');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns last 10 entries', async () => {
    const logFile = path.join(TMP_VAULT, '📥 Inbox', 'AI Generated', 'hallucination-log.md');
    fs.writeFileSync(logFile,
      '- 2026-05-10 · yes-man · Agreed to feature without YAGNI\n' +
      '- 2026-05-09 · identity · Wrong git identity\n');

    const res = await request(app).get('/api/health/log');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].tag).toBe('yes-man');
  });
});

describe('POST /api/health/log', () => {
  it('appends entry to hallucination-log.md', async () => {
    const res = await request(app).post('/api/health/log').send({
      tag: 'yes-man',
      message: 'Agreed to feature without checking YAGNI'
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const logFile = path.join(TMP_VAULT, '📥 Inbox', 'AI Generated', 'hallucination-log.md');
    const content = fs.readFileSync(logFile, 'utf8');
    expect(content).toContain('yes-man');
    expect(content).toContain('Agreed to feature without checking YAGNI');
  });
});
