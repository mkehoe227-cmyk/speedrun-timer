import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from '../server.js';

const TMP_VAULT = path.join(os.tmpdir(), 'dashos-test-vault');
const CONTEXT_FILE = path.join(TMP_VAULT, 'AI OS', 'current_context.md');

beforeEach(() => {
  process.env.VAULT_PATH = TMP_VAULT;
  fs.mkdirSync(path.join(TMP_VAULT, 'AI OS'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP_VAULT, { recursive: true, force: true });
});

describe('GET /api/context', () => {
  it('returns empty defaults when file missing', async () => {
    const res = await request(app).get('/api/context');
    expect(res.status).toBe(200);
    expect(res.body.active_project).toBe('');
  });

  it('returns parsed frontmatter when file exists', async () => {
    fs.writeFileSync(CONTEXT_FILE,
      '---\nactive_project: Atlas\nfocus: Phase 2\nvibe: Productive\nblocker: ""\nupdated: 2026-05-11T12:00:00\n---\n');
    const res = await request(app).get('/api/context');
    expect(res.status).toBe(200);
    expect(res.body.active_project).toBe('Atlas');
    expect(res.body.focus).toBe('Phase 2');
  });
});

describe('POST /api/context', () => {
  it('writes current_context.md and returns ok', async () => {
    const res = await request(app).post('/api/context').send({
      active_project: 'Atlas',
      focus: 'Phase 2 task manager',
      vibe: 'Productive',
      blocker: ''
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.updated).toBeTruthy();
    const written = fs.readFileSync(CONTEXT_FILE, 'utf8');
    expect(written).toContain('active_project: Atlas');
    expect(written).toContain('focus: Phase 2 task manager');
  });
});
