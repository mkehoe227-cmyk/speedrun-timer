import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';

describe('GET /api/ping', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
