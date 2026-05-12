# DashOS Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web dashboard (Vite + React frontend, Express backend) that injects live context into Claude sessions and visualizes AI-OS vault health.

**Architecture:** Express backend on port 7070 reads/writes the Obsidian vault at `VAULT_PATH`. Vite frontend on port 5173 proxies `/api/*` to the backend. Three route groups handle context injection, vault scanning, and system health. No database — vault markdown files are the store.

**Tech Stack:** React 18, Vite 5, Express 4, Vitest, Supertest, concurrently, Node 20+

---

## File Map

```
DashOS/
├── package.json                          # root: scripts, concurrently
├── .env                                  # VAULT_PATH=~/Desktop/Base copy
├── .env.example
├── .gitignore
├── backend/
│   ├── package.json
│   ├── server.js                         # Express app + listen
│   ├── vault-path.js                     # resolve VAULT_PATH helper
│   ├── routes/
│   │   ├── context.js                    # GET+POST /api/context
│   │   ├── vault.js                      # GET /api/vault/activity, /rot; POST /rot/flag
│   │   └── health.js                     # GET /api/health/git, /maps, /log; POST /log
│   └── tests/
│       ├── context.test.js
│       ├── vault.test.js
│       └── health.test.js
└── frontend/
    ├── package.json
    ├── vite.config.js                    # proxy /api → :7070
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                       # root: fetch all, pass props, error banner
        ├── styles/
        │   └── typewriter.css            # full design system (cream, Courier Prime, ink borders)
        └── components/
            ├── ContextInjector.jsx
            ├── ParaPulse.jsx
            └── SystemHealth.jsx
```

---

## Task 1: Root scaffold

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.env`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "dashos",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "concurrently \"npm run backend\" \"npm run frontend\"",
    "backend": "cd backend && node server.js",
    "frontend": "cd frontend && npx vite",
    "test": "cd backend && npx vitest run"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Install concurrently**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS && npm install
```

Expected: `node_modules/` created, `concurrently` installed.

- [ ] **Step 3: Create .env.example**

```bash
# .env.example
VAULT_PATH=~/Desktop/Base copy
PORT=7070
```

- [ ] **Step 4: Create .env**

```bash
VAULT_PATH=~/Desktop/Base copy
PORT=7070
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.env
frontend/dist/
backend/node_modules/
frontend/node_modules/
.superpowers/
```

- [ ] **Step 6: Commit**

```bash
git add package.json .env.example .gitignore
git commit -m "feat: scaffold DashOS root project"
```

---

## Task 2: Backend scaffold + server

**Files:**
- Create: `backend/package.json`
- Create: `backend/vault-path.js`
- Create: `backend/server.js`

- [ ] **Step 1: Create backend/package.json**

```json
{
  "name": "dashos-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Install backend deps**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npm install
```

Expected: `backend/node_modules/` with express, cors, dotenv, supertest, vitest.

- [ ] **Step 3: Create backend/vault-path.js**

```js
import os from 'os';
import path from 'path';

export function getVaultPath() {
  const raw = process.env.VAULT_PATH || '';
  if (!raw) throw new Error('VAULT_PATH not set in .env');
  return raw.startsWith('~') ? path.join(os.homedir(), raw.slice(1)) : raw;
}

export function vaultExists() {
  try {
    const p = getVaultPath();
    return { ok: true, path: p };
  } catch {
    return { ok: false, path: null };
  }
}
```

- [ ] **Step 4: Create backend/server.js**

```js
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
```

- [ ] **Step 5: Write ping test**

Create `backend/tests/server.test.js`:

```js
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
```

- [ ] **Step 6: Run test — verify passes**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npx vitest run tests/server.test.js
```

Expected: `1 passed`.

- [ ] **Step 7: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add backend/
git commit -m "feat: scaffold Express backend with ping route"
```

---

## Task 3: Context route

**Files:**
- Create: `backend/routes/context.js`
- Create: `backend/tests/context.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/context.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npx vitest run tests/context.test.js
```

Expected: FAIL — `contextRouter` not found.

- [ ] **Step 3: Implement backend/routes/context.js**

```js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { getVaultPath } from '../vault-path.js';

export const contextRouter = express.Router();

function contextFilePath() {
  return path.join(getVaultPath(), 'AI OS', 'current_context.md');
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { active_project: '', focus: '', vibe: '', blocker: '', updated: null };
  const obj = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(': ');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 2).replace(/^"|"$/g, '');
    obj[k] = v;
  }
  return obj;
}

contextRouter.get('/', (req, res) => {
  try {
    const raw = fs.readFileSync(contextFilePath(), 'utf8');
    res.json(parseFrontmatter(raw));
  } catch {
    res.json({ active_project: '', focus: '', vibe: '', blocker: '', updated: null });
  }
});

contextRouter.post('/', (req, res) => {
  const { active_project = '', focus = '', vibe = '', blocker = '' } = req.body;
  const updated = new Date().toISOString().slice(0, 19);
  const content = [
    '---',
    `active_project: ${active_project}`,
    `focus: ${focus}`,
    `vibe: ${vibe}`,
    `blocker: "${blocker}"`,
    `updated: ${updated}`,
    '---',
    ''
  ].join('\n');
  try {
    const filePath = contextFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ ok: true, updated });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npx vitest run tests/context.test.js
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add backend/routes/context.js backend/tests/context.test.js
git commit -m "feat: add context GET/POST route with frontmatter read/write"
```

---

## Task 4: Vault routes (activity + rot + flag)

**Files:**
- Create: `backend/routes/vault.js`
- Create: `backend/tests/vault.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/vault.test.js`:

```js
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
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npx vitest run tests/vault.test.js
```

Expected: FAIL — `vaultRouter` not found.

- [ ] **Step 3: Implement backend/routes/vault.js**

```js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { getVaultPath } from '../vault-path.js';

export const vaultRouter = express.Router();

const HOURS_48 = 48 * 60 * 60 * 1000;
const DAYS_14  = 14 * 24 * 60 * 60 * 1000;

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, results);
    else if (entry.name.endsWith('.md')) results.push(full);
  }
  return results;
}

function getProjectDirs(vault) {
  const areas = path.join(vault, '🗺️ Areas');
  if (!fs.existsSync(areas)) return [];
  return fs.readdirSync(areas, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => ({ name: e.name, dir: path.join(areas, e.name) }));
}

vaultRouter.get('/activity', (req, res) => {
  try {
    const vault = getVaultPath();
    const now = Date.now();
    const projects = getProjectDirs(vault);
    const result = [];

    for (const { name, dir } of projects) {
      const files = walkDir(dir);
      const recent = files.filter(f => {
        try { return now - fs.statSync(f).mtime.getTime() < HOURS_48; }
        catch { return false; }
      });
      if (recent.length > 0) result.push({ project: name, count: recent.length });
    }

    result.sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

vaultRouter.get('/rot', (req, res) => {
  try {
    const vault = getVaultPath();
    const now = Date.now();
    const projects = getProjectDirs(vault);
    const result = [];

    for (const { name, dir } of projects) {
      const files = walkDir(dir);
      if (files.length === 0) continue;
      const newest = Math.max(...files.map(f => {
        try { return fs.statSync(f).mtime.getTime(); } catch { return 0; }
      }));
      const age = now - newest;
      if (age >= DAYS_14) {
        result.push({
          project: name,
          daysStale: Math.floor(age / (24 * 60 * 60 * 1000)),
          lastModified: new Date(newest).toISOString().slice(0, 10)
        });
      }
    }

    result.sort((a, b) => b.daysStale - a.daysStale);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

vaultRouter.post('/rot/flag', (req, res) => {
  const { project } = req.body;
  try {
    const vault = getVaultPath();
    const flagFile = path.join(vault, '📥 Inbox', 'AI Generated', 'rot-flagged.md');
    fs.mkdirSync(path.dirname(flagFile), { recursive: true });
    const entry = `- ${new Date().toISOString().slice(0, 10)} · ${project} flagged for archiving\n`;
    fs.appendFileSync(flagFile, entry, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npx vitest run tests/vault.test.js
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add backend/routes/vault.js backend/tests/vault.test.js
git commit -m "feat: add vault activity, rot scan, and rot-flag routes"
```

---

## Task 5: Health routes (git + maps + log)

**Files:**
- Create: `backend/routes/health.js`
- Create: `backend/tests/health.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/health.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  vi.restoreAllMocks();
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
  it('returns no-git when execSync throws', async () => {
    const childProcess = await import('child_process');
    vi.spyOn(childProcess, 'execSync').mockImplementation(() => { throw new Error('not a git repo'); });

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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npx vitest run tests/health.test.js
```

Expected: FAIL — `healthRouter` not found.

- [ ] **Step 3: Implement backend/routes/health.js**

```js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getVaultPath } from '../vault-path.js';

export const healthRouter = express.Router();

const MAP_NAMES = ['me.md', 'vault_map.md', 'skills_map.md'];
const WARN_SIZE_BYTES = 10 * 1024;

healthRouter.get('/git', (req, res) => {
  try {
    const vault = getVaultPath();
    const ahead = parseInt(
      execSync('git rev-list @{u}..HEAD --count', { cwd: vault }).toString().trim(), 10
    );
    const status = execSync('git status --porcelain', { cwd: vault }).toString().trim();
    res.json({ git: true, ahead, hasChanges: status.length > 0 });
  } catch {
    res.json({ git: false, ahead: 0, hasChanges: false });
  }
});

healthRouter.get('/maps', (req, res) => {
  try {
    const vault = getVaultPath();
    const maps = MAP_NAMES.map(name => {
      const filePath = path.join(vault, 'AI OS', name);
      try {
        const stat = fs.statSync(filePath);
        return { name, exists: true, sizeBytes: stat.size, warn: stat.size > WARN_SIZE_BYTES };
      } catch {
        return { name, exists: false, sizeBytes: 0, warn: false };
      }
    });
    res.json(maps);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

healthRouter.get('/log', (req, res) => {
  try {
    const vault = getVaultPath();
    const logFile = path.join(vault, '📥 Inbox', 'AI Generated', 'hallucination-log.md');
    if (!fs.existsSync(logFile)) return res.json([]);
    const lines = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(l => l.startsWith('- '))
      .slice(-10)
      .map(parsLogLine);
    res.json(lines);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

healthRouter.post('/log', (req, res) => {
  const { tag = 'general', message = '' } = req.body;
  try {
    const vault = getVaultPath();
    const logFile = path.join(vault, '📥 Inbox', 'AI Generated', 'hallucination-log.md');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const entry = `- ${date} · ${tag} · ${message}\n`;
    fs.appendFileSync(logFile, entry, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function parsLogLine(line) {
  // Format: "- YYYY-MM-DD · tag · message"
  const match = line.match(/^- (\S+) · (\S+) · (.+)$/);
  if (!match) return { date: '', tag: 'general', message: line };
  return { date: match[1], tag: match[2], message: match[3] };
}
```

- [ ] **Step 4: Run all backend tests**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npx vitest run
```

Expected: all tests in `tests/` pass (server, context, vault, health).

- [ ] **Step 5: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add backend/routes/health.js backend/tests/health.test.js
git commit -m "feat: add health routes for git status, map validation, and hallucination log"
```

---

## Task 6: Frontend scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx` (shell only)

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "dashos-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 2: Install frontend deps**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/frontend && npm install
```

- [ ] **Step 3: Create frontend/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:7070',
        changeOrigin: true
      }
    }
  }
});
```

- [ ] **Step 4: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DashOS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create frontend/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/typewriter.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Create shell frontend/src/App.jsx**

```jsx
import React from 'react';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="logo">DashOS</div>
          <div className="logo-sub">AI Operating System · v1.0.0</div>
        </div>
      </header>
      <main className="grid">
        <p style={{ padding: '20px', color: 'var(--ink-3)' }}>Loading...</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Verify frontend starts**

```bash
# Terminal 1
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && node server.js

# Terminal 2
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/frontend && npx vite
```

Expected: browser opens at `http://localhost:5173`, shows "Loading..." on cream background.

- [ ] **Step 8: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add frontend/
git commit -m "feat: scaffold Vite + React frontend with proxy config"
```

---

## Task 7: Typewriter CSS design system

**Files:**
- Create: `frontend/src/styles/typewriter.css`

- [ ] **Step 1: Create frontend/src/styles/typewriter.css**

```css
:root {
  --bg:         #fdf6e3;
  --bg2:        #f5ecd0;
  --panel:      #fcf5e4;
  --panel2:     #ede3cb;
  --border:     #c8b898;
  --border2:    #b0a080;
  --ink:        #26211a;
  --ink-2:      #5c5040;
  --ink-3:      #9a8c78;
  --ink-4:      #bfb09a;
  --green:      #4a7c55;
  --green-bg:   rgba(74,124,85,0.10);
  --amber:      #9a6b00;
  --amber-bg:   rgba(154,107,0,0.10);
  --red:        #a03030;
  --red-bg:     rgba(160,48,48,0.10);
  --mono:       'Courier Prime', 'Courier New', monospace;
  --stamp:      'Special Elite', monospace;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.55;
  min-height: 100vh;
}

/* Layout */
.app { max-width: 1180px; margin: 0 auto; padding: 20px; }

.grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 14px;
}

.right-col { display: flex; flex-direction: column; gap: 14px; }

/* Error banner */
.vault-error {
  padding: 10px 16px;
  background: var(--red-bg);
  border: 1px solid var(--red);
  border-left: 3px solid var(--red);
  color: var(--red);
  font-size: 12px;
  margin-bottom: 14px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--panel);
  border: 2px solid var(--ink);
  margin-bottom: 16px;
  box-shadow: 3px 3px 0 var(--border2);
}

.logo { font-family: var(--stamp); font-size: 22px; letter-spacing: 3px; }
.logo-sub { font-size: 10px; color: var(--ink-3); letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }

.header-right { display: flex; align-items: center; gap: 12px; font-size: 11px; }

.status-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 9px; border: 1px solid var(--border);
  background: var(--bg2); font-size: 10px;
  letter-spacing: 1px; text-transform: uppercase;
}

.dot { width: 5px; height: 5px; border-radius: 50%; }
.dot.ok   { background: var(--green); }
.dot.warn { background: var(--amber); }
.dot.err  { background: var(--red); }

.clock { font-family: var(--stamp); font-size: 14px; color: var(--ink-2); letter-spacing: 2px; }

/* Panels */
.panel {
  background: var(--panel);
  border: 1.5px solid var(--ink);
  padding: 16px;
  box-shadow: 3px 3px 0 var(--border2);
}

.panel-title {
  font-family: var(--stamp);
  font-size: 11px; letter-spacing: 3px;
  color: var(--ink-2); text-transform: uppercase;
  margin-bottom: 14px; padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}

/* Forms */
.field { margin-bottom: 11px; }

.field-label {
  font-size: 9px; letter-spacing: 2px;
  text-transform: uppercase; color: var(--ink-3); margin-bottom: 4px;
}

.field-input {
  width: 100%; background: var(--bg);
  border: 1px solid var(--border); border-bottom: 2px solid var(--border2);
  color: var(--ink); font-family: var(--mono); font-size: 12px;
  padding: 7px 10px; outline: none; transition: border-color 0.12s;
}

.field-input:focus { border-color: var(--ink); border-bottom-color: var(--ink); }
.field-input::placeholder { color: var(--ink-4); font-style: italic; }

/* Buttons */
.btn-primary {
  width: 100%; padding: 9px;
  background: var(--ink); border: 2px solid var(--ink);
  color: var(--bg); font-family: var(--stamp); font-size: 13px;
  letter-spacing: 3px; cursor: pointer; text-transform: uppercase;
  transition: all 0.12s;
}
.btn-primary:hover { background: var(--ink-2); border-color: var(--ink-2); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost {
  padding: 4px 10px; background: transparent;
  border: 1px solid var(--border); color: var(--ink-3);
  font-family: var(--mono); font-size: 10px; cursor: pointer;
  transition: all 0.12s;
}
.btn-ghost:hover { border-color: var(--ink); color: var(--ink); }

.btn-danger {
  padding: 5px 12px; background: var(--red-bg);
  border: 1px solid var(--red); color: var(--red);
  font-family: var(--stamp); font-size: 11px;
  letter-spacing: 1px; cursor: pointer;
}

/* Project chips */
.proj-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 14px; }

.proj-chip {
  padding: 6px 10px; border: 1px solid var(--border);
  background: var(--bg2); color: var(--ink-2);
  font-family: var(--mono); font-size: 11px;
  cursor: pointer; transition: all 0.12s; text-align: left;
}
.proj-chip:hover { background: var(--panel2); border-color: var(--ink); color: var(--ink); }
.proj-chip.active { background: var(--ink); border-color: var(--ink); color: var(--bg); font-weight: 700; }

/* Vibe tags */
.vibe-row { display: flex; gap: 5px; flex-wrap: wrap; }
.vibe-tag {
  padding: 3px 9px; border: 1px solid var(--border);
  font-size: 10px; cursor: pointer; color: var(--ink-3);
  background: var(--bg2); transition: all 0.12s;
}
.vibe-tag:hover { border-color: var(--ink-2); color: var(--ink); }
.vibe-tag.active { background: var(--ink); border-color: var(--ink); color: var(--bg); }

/* Active project box */
.active-box {
  padding: 10px 12px; background: var(--bg2);
  border: 1px solid var(--border2); border-left: 3px solid var(--ink);
  margin-bottom: 14px;
}
.active-box-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-3); margin-bottom: 3px; }
.active-box-val { font-family: var(--stamp); font-size: 16px; letter-spacing: 1px; }

/* Last injected */
.last-inject {
  margin-top: 10px; padding: 7px 10px;
  background: var(--bg2); border: 1px dashed var(--border);
  font-size: 10px; color: var(--ink-3); font-style: italic;
}

/* Inline error */
.inline-error { font-size: 11px; color: var(--red); margin-top: 5px; font-style: italic; }

/* Heatmap */
.heatmap {
  display: flex; gap: 8px; align-items: flex-end;
  margin-bottom: 14px; height: 60px;
}
.hm-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.hm-bar { width: 100%; border: 1px solid var(--border2); border-bottom: none; transition: opacity 0.15s; }
.hm-bar:hover { opacity: 0.6; }
.hm-label { font-size: 8px; color: var(--ink-3); letter-spacing: 0.5px; text-transform: uppercase; }

/* Rot table */
.rot-heading { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--red); margin-bottom: 8px; font-family: var(--stamp); }

.data-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.data-table th { text-align: left; padding: 5px 8px; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-3); border-bottom: 1px solid var(--border); font-weight: normal; }
.data-table td { padding: 7px 8px; border-bottom: 1px solid var(--bg2); }
.data-table tr:last-child td { border-bottom: none; }
.data-table .cell-name { color: var(--ink); font-weight: 700; }
.data-table .cell-age { color: var(--red); font-family: var(--stamp); font-size: 12px; }
.data-table .cell-date { color: var(--ink-3); font-style: italic; }
.data-table .cell-action { color: var(--ink-3); cursor: pointer; font-size: 10px; text-decoration: underline; text-underline-offset: 3px; }
.data-table .cell-action:hover { color: var(--ink); }

/* Git bar */
.git-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; margin-bottom: 12px;
  background: var(--amber-bg); border: 1px solid var(--border);
  border-left: 3px solid var(--amber); font-size: 11px;
}
.git-bar .arrow { color: var(--amber); }
.git-bar .repo { flex: 1; color: var(--ink-2); font-style: italic; }
.git-bar .ahead { font-family: var(--stamp); color: var(--amber); }
.git-bar.ok { background: var(--green-bg); border-left-color: var(--green); }
.git-bar.ok .arrow { color: var(--green); }
.git-bar.ok .ahead { color: var(--green); }

/* Stat row */
.stat-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.stat { padding: 8px 10px; border: 1px solid var(--border); background: var(--bg2); text-align: center; }
.stat-l { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-3); margin-bottom: 4px; }
.stat-v { font-family: var(--stamp); font-size: 16px; }
.stat-v.ok   { color: var(--green); }
.stat-v.warn { color: var(--amber); }
.stat-v.err  { color: var(--red); }

/* Map list */
.map-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.map-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg2); border: 1px solid var(--border); font-size: 11px; }
.map-indicator { font-family: var(--stamp); font-size: 13px; min-width: 16px; }
.map-indicator.ok   { color: var(--green); }
.map-indicator.warn { color: var(--amber); }
.map-indicator.err  { color: var(--red); }
.map-name { flex: 1; color: var(--ink-2); font-style: italic; }
.map-meta { font-size: 10px; color: var(--ink-3); }

/* Log */
.log-section-title { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-3); margin-bottom: 8px; font-family: var(--stamp); }
.log-entries { display: flex; flex-direction: column; margin-bottom: 8px; }
.log-entry { display: flex; gap: 10px; padding: 6px 8px; border-bottom: 1px dashed var(--border); font-size: 10px; align-items: baseline; }
.log-entry:last-child { border-bottom: none; }
.log-ts { color: var(--ink-3); font-size: 9px; white-space: nowrap; font-style: italic; }
.log-msg { flex: 1; color: var(--ink-2); }
.log-tag { font-size: 9px; padding: 1px 6px; border: 1px solid; text-transform: uppercase; letter-spacing: 1px; font-family: var(--stamp); white-space: nowrap; }
.log-tag.yes-man  { color: var(--red); border-color: var(--red); background: var(--red-bg); }
.log-tag.identity { color: var(--amber); border-color: var(--amber); background: var(--amber-bg); }
.log-tag.general  { color: var(--ink-3); border-color: var(--border); }

.log-add { display: flex; gap: 6px; }
.log-add .field-input { font-size: 11px; padding: 5px 8px; }

/* Divider */
.divider { border: none; border-top: 1px dashed var(--border); margin: 12px 0; }

/* Refresh button row */
.refresh-row { display: flex; justify-content: flex-end; margin-bottom: 10px; }
```

- [ ] **Step 2: Verify styles load in browser**

With both servers running, open `http://localhost:5173`. The background should be cream (`#fdf6e3`), "Loading..." text in Courier Prime. No console errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add frontend/src/styles/typewriter.css
git commit -m "feat: add typewriter CSS design system"
```

---

## Task 8: ContextInjector component

**Files:**
- Create: `frontend/src/components/ContextInjector.jsx`

- [ ] **Step 1: Create frontend/src/components/ContextInjector.jsx**

```jsx
import React, { useState } from 'react';

const PROJECTS = ['Atlas', 'FitnessApp', 'PGA Model', 'ObsidianTag', 'JobActivity', 'AI-OS'];
const VIBES = ['Productive', 'Deep Work', 'Frustrated', 'Exploring', 'Stuck', 'Debugging'];

export default function ContextInjector({ context, onInjected }) {
  const [project, setProject] = useState(context?.active_project || '');
  const [focus, setFocus] = useState(context?.focus || '');
  const [vibe, setVibe] = useState(context?.vibe || '');
  const [blocker, setBlocker] = useState(context?.blocker || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastInjected, setLastInjected] = useState(
    context?.updated ? `${context.active_project} · ${context.focus} · ${context.vibe}` : ''
  );

  async function handleInject() {
    if (!project) { setError('Select a project first.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_project: project, focus, vibe, blocker })
      });
      if (!res.ok) throw new Error('Write failed');
      const data = await res.json();
      setLastInjected(`${project} · ${focus} · ${vibe}`);
      onInjected?.(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ gridRow: 'span 2' }}>
      <div className="panel-title">
        <span>Context Injector</span>
        <span style={{ fontSize: '9px', color: 'var(--green)', fontFamily: 'var(--stamp)' }}>● live</span>
      </div>

      <div className="active-box">
        <div className="active-box-label">Active Project</div>
        <div className="active-box-val">{project || '—'}</div>
      </div>

      <div className="proj-grid">
        {PROJECTS.map(p => (
          <button
            key={p}
            className={`proj-chip${project === p ? ' active' : ''}`}
            onClick={() => setProject(p)}
          >{p}</button>
        ))}
      </div>

      <div className="field">
        <div className="field-label">Current Focus</div>
        <input
          className="field-input"
          type="text"
          placeholder="What are you working on?"
          value={focus}
          onChange={e => setFocus(e.target.value)}
        />
      </div>

      <div className="field">
        <div className="field-label">Vibe Check</div>
        <div className="vibe-row">
          {VIBES.map(v => (
            <div
              key={v}
              className={`vibe-tag${vibe === v ? ' active' : ''}`}
              onClick={() => setVibe(vibe === v ? '' : v)}
            >{v}</div>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="field-label">Frustration Note</div>
        <input
          className="field-input"
          type="text"
          placeholder="What's blocking you?"
          value={blocker}
          onChange={e => setBlocker(e.target.value)}
        />
      </div>

      {error && <div className="inline-error">{error}</div>}

      <button className="btn-primary" onClick={handleInject} disabled={loading} style={{ marginTop: '12px' }}>
        {loading ? 'Injecting...' : 'Inject Context'}
      </button>

      {lastInjected && (
        <div className="last-inject">
          Last injected · {lastInjected}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add frontend/src/components/ContextInjector.jsx
git commit -m "feat: add ContextInjector component"
```

---

## Task 9: ParaPulse component

**Files:**
- Create: `frontend/src/components/ParaPulse.jsx`

- [ ] **Step 1: Create frontend/src/components/ParaPulse.jsx**

```jsx
import React, { useState } from 'react';

const BAR_COLORS = ['#c8d8b0','#b8c8d8','#d8cbb0','#d0c0d8','#c8d0c0','#d8c8b0'];
const MAX_HEIGHT = 56;

export default function ParaPulse({ activity, rot, onRefresh }) {
  const [flagging, setFlagging] = useState({});
  const [flagError, setFlagError] = useState('');

  const maxCount = Math.max(...(activity || []).map(p => p.count), 1);

  async function handleFlag(project) {
    setFlagging(f => ({ ...f, [project]: true }));
    setFlagError('');
    try {
      const res = await fetch('/api/vault/rot/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project })
      });
      if (!res.ok) throw new Error('Flag failed');
    } catch (e) {
      setFlagError(e.message);
    } finally {
      setFlagging(f => ({ ...f, [project]: false }));
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">
        <span>PARA Pulse — File Velocity (48h)</span>
        <button className="btn-ghost" onClick={onRefresh}>↻ Refresh</button>
      </div>

      {(activity || []).length === 0 ? (
        <p style={{ fontSize: '11px', color: 'var(--ink-3)', fontStyle: 'italic' }}>No file activity in last 48h.</p>
      ) : (
        <div className="heatmap">
          {(activity || []).map((p, i) => (
            <div key={p.project} className="hm-col">
              <div
                className="hm-bar"
                style={{
                  height: `${Math.max(4, Math.round((p.count / maxCount) * MAX_HEIGHT))}px`,
                  background: BAR_COLORS[i % BAR_COLORS.length]
                }}
                title={`${p.project}: ${p.count} files`}
              />
              <div className="hm-label">{p.project.slice(0, 7)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rot-heading">⚠ Rot Detected — Stale 14+ Days</div>

      {flagError && <div className="inline-error">{flagError}</div>}

      {(rot || []).length === 0 ? (
        <p style={{ fontSize: '11px', color: 'var(--green)', fontStyle: 'italic' }}>No stale projects.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Days Stale</th>
              <th>Last Modified</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(rot || []).map(r => (
              <tr key={r.project}>
                <td className="cell-name">{r.project}</td>
                <td className="cell-age">{r.daysStale}d</td>
                <td className="cell-date">{r.lastModified}</td>
                <td>
                  <span
                    className="cell-action"
                    onClick={() => !flagging[r.project] && handleFlag(r.project)}
                  >
                    {flagging[r.project] ? 'flagging...' : '→ archive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add frontend/src/components/ParaPulse.jsx
git commit -m "feat: add ParaPulse component with heatmap and rot table"
```

---

## Task 10: SystemHealth component

**Files:**
- Create: `frontend/src/components/SystemHealth.jsx`

- [ ] **Step 1: Create frontend/src/components/SystemHealth.jsx**

```jsx
import React, { useState } from 'react';

export default function SystemHealth({ git, maps, log, onRefresh }) {
  const [message, setMessage] = useState('');
  const [tag, setTag] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [localLog, setLocalLog] = useState(log || []);

  const ahead = git?.ahead ?? 0;
  const gitOk = git?.git && ahead === 0;

  async function handleFlag() {
    if (!message.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/health/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, message })
      });
      if (!res.ok) throw new Error('Flag failed');
      const date = new Date().toISOString().slice(0, 10);
      setLocalLog(l => [{ date, tag, message }, ...l].slice(0, 10));
      setMessage('');
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">
        <span>System Health</span>
        <button className="btn-ghost" onClick={onRefresh}>↻ Refresh</button>
      </div>

      <div className={`git-bar${gitOk ? ' ok' : ''}`}>
        <span className="arrow">{ahead > 0 ? '↑' : '✓'}</span>
        <span className="repo">Private vault · origin/main</span>
        <span className="ahead">
          {!git?.git ? 'no git' : ahead > 0 ? `${ahead} commits ahead` : 'synced'}
        </span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-l">Vault</div>
          <div className={`stat-v ${git?.git !== false ? 'ok' : 'warn'}`}>
            {git?.git !== false ? 'OK' : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-l">Maps</div>
          <div className={`stat-v ${(maps || []).every(m => m.exists) ? 'ok' : 'err'}`}>
            {(maps || []).filter(m => m.exists).length} / {(maps || []).length || 3}
          </div>
        </div>
        <div className="stat">
          <div className="stat-l">Skills</div>
          <div className="stat-v ok">40</div>
        </div>
      </div>

      <div className="map-list">
        {(maps || []).map(m => (
          <div key={m.name} className="map-item">
            <span className={`map-indicator ${m.exists ? (m.warn ? 'warn' : 'ok') : 'err'}`}>
              {m.exists ? (m.warn ? '!' : '✓') : '✗'}
            </span>
            <span className="map-name">{m.name}</span>
            <span className="map-meta">
              {m.exists ? `${(m.sizeBytes / 1024).toFixed(1)} KB · ${m.warn ? 'large' : 'valid'}` : 'missing'}
            </span>
          </div>
        ))}
      </div>

      <hr className="divider" />

      <div className="log-section-title">Hallucination Log</div>

      <div className="log-entries">
        {localLog.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--ink-3)', fontStyle: 'italic', padding: '4px 8px' }}>No entries yet.</p>
        ) : localLog.map((e, i) => (
          <div key={i} className="log-entry">
            <span className="log-ts">{e.date}</span>
            <span className="log-msg">{e.message}</span>
            <span className={`log-tag ${e.tag}`}>{e.tag}</span>
          </div>
        ))}
      </div>

      {submitError && <div className="inline-error">{submitError}</div>}

      <div className="log-add">
        <select
          value={tag}
          onChange={e => setTag(e.target.value)}
          className="field-input"
          style={{ width: 'auto', flex: '0 0 auto' }}
        >
          <option value="yes-man">yes-man</option>
          <option value="identity">identity</option>
          <option value="general">general</option>
        </select>
        <input
          className="field-input"
          type="text"
          placeholder="Describe the failure..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFlag()}
        />
        <button className="btn-danger" onClick={handleFlag} disabled={submitting}>
          {submitting ? '...' : 'Flag'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add frontend/src/components/SystemHealth.jsx
git commit -m "feat: add SystemHealth component with git status, maps, and hallucination log"
```

---

## Task 11: Wire up App.jsx + error banner

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Replace shell App.jsx with full wired version**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import ContextInjector from './components/ContextInjector.jsx';
import ParaPulse from './components/ParaPulse.jsx';
import SystemHealth from './components/SystemHealth.jsx';

export default function App() {
  const [vaultOk, setVaultOk] = useState(true);
  const [context, setContext] = useState(null);
  const [activity, setActivity] = useState([]);
  const [rot, setRot] = useState([]);
  const [git, setGit] = useState(null);
  const [maps, setMaps] = useState([]);
  const [log, setLog] = useState([]);
  const [clock, setClock] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [vaultStatus, ctxRes, actRes, rotRes, gitRes, mapsRes, logRes] = await Promise.all([
        fetch('/api/vault-status').then(r => r.json()),
        fetch('/api/context').then(r => r.json()),
        fetch('/api/vault/activity').then(r => r.json()),
        fetch('/api/vault/rot').then(r => r.json()),
        fetch('/api/health/git').then(r => r.json()),
        fetch('/api/health/maps').then(r => r.json()),
        fetch('/api/health/log').then(r => r.json()),
      ]);
      setVaultOk(vaultStatus.ok);
      setContext(ctxRes);
      setActivity(Array.isArray(actRes) ? actRes : []);
      setRot(Array.isArray(rotRes) ? rotRes : []);
      setGit(gitRes);
      setMaps(Array.isArray(mapsRes) ? mapsRes : []);
      setLog(Array.isArray(logRes) ? logRes : []);
    } catch {
      setVaultOk(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const healthInterval = setInterval(async () => {
      try {
        const [gitRes, mapsRes] = await Promise.all([
          fetch('/api/health/git').then(r => r.json()),
          fetch('/api/health/maps').then(r => r.json()),
        ]);
        setGit(gitRes);
        setMaps(Array.isArray(mapsRes) ? mapsRes : []);
      } catch {}
    }, 60000);
    return () => clearInterval(healthInterval);
  }, [fetchAll]);

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const rotCount = rot.length;
  const mapsOk = maps.every(m => m.exists);
  const gitAhead = git?.ahead ?? 0;

  return (
    <div className="app">
      {!vaultOk && (
        <div className="vault-error">
          ✗ Vault not found. Set <code>VAULT_PATH</code> in <code>.env</code> and restart the backend.
        </div>
      )}

      <header className="header">
        <div>
          <div className="logo">DashOS</div>
          <div className="logo-sub">AI Operating System · v1.0.0</div>
        </div>
        <div className="header-right">
          <div className="status-chip">
            <div className={`dot ${mapsOk ? 'ok' : 'err'}`} />
            maps {mapsOk ? 'ok' : 'error'}
          </div>
          {rotCount > 0 && (
            <div className="status-chip">
              <div className="dot warn" />
              {rotCount} stale
            </div>
          )}
          {gitAhead > 0 && (
            <div className="status-chip">
              <div className="dot warn" />
              ↑ {gitAhead} ahead
            </div>
          )}
          <div className="clock">{clock}</div>
        </div>
      </header>

      <div className="grid">
        <ContextInjector context={context} onInjected={fetchAll} />
        <div className="right-col">
          <ParaPulse activity={activity} rot={rot} onRefresh={fetchAll} />
          <SystemHealth git={git} maps={maps} log={log} onRefresh={fetchAll} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full app and verify**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS && npm start
```

Check at `http://localhost:5173`:
- Cream background, Courier Prime font, ink-black header border
- Context Injector left panel — project chips, focus input, vibe tags
- PARA Pulse top right — heatmap bars (may be empty if vault has no recent activity)
- System Health bottom right — git status, map validation rows, hallucination log
- Clock ticking in header

- [ ] **Step 3: Commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add frontend/src/App.jsx
git commit -m "feat: wire up App.jsx with parallel data fetching and auto-refresh"
```

---

## Task 12: CLAUDE.md integration + end-to-end verification

**Files:**
- Modify: `~/.claude/CLAUDE.md` (add one line)

- [ ] **Step 1: Add current_context.md import to CLAUDE.md**

Open `~/.claude/CLAUDE.md` and add this line after the existing `@` imports:

```
@/Users/mitchkehoe/Desktop/Base copy/AI OS/current_context.md
```

- [ ] **Step 2: Create initial current_context.md so Claude doesn't error on missing file**

```bash
mkdir -p "/Users/mitchkehoe/Desktop/Base copy/AI OS"
cat > "/Users/mitchkehoe/Desktop/Base copy/AI OS/current_context.md" << 'EOF'
---
active_project: ""
focus: ""
vibe: ""
blocker: ""
updated: ""
---
EOF
```

- [ ] **Step 3: End-to-end test — context injection**

1. Open DashOS at `http://localhost:5173`
2. Click "Atlas" chip
3. Type "Phase 2 task manager" in Focus
4. Click "Productive" vibe tag
5. Click "Inject Context"
6. Run: `cat "/Users/mitchkehoe/Desktop/Base copy/AI OS/current_context.md"`

Expected output:
```
---
active_project: Atlas
focus: Phase 2 task manager
vibe: Productive
blocker: ""
updated: 2026-05-11T...
---
```

- [ ] **Step 4: End-to-end test — rot detection**

```bash
# Touch a file to be older than 14 days
touch -t 202604010000 "/Users/mitchkehoe/Desktop/Base copy/🗺️ Areas/PGA Model/notes.md" 2>/dev/null || true
```

Click "↻ Refresh" in PARA Pulse. "PGA Model" should appear in the rot table.

- [ ] **Step 5: End-to-end test — system health**

Run directly:
```bash
cd "/Users/mitchkehoe/Desktop/Base copy" && git status
```

Compare with what DashOS shows in the git status bar. They should match.

- [ ] **Step 6: End-to-end test — hallucination log**

Type "Agreed without checking YAGNI" in the log input, select "yes-man", click Flag. Then:

```bash
cat "/Users/mitchkehoe/Desktop/Base copy/📥 Inbox/AI Generated/hallucination-log.md"
```

Expected: line containing `yes-man · Agreed without checking YAGNI`.

- [ ] **Step 7: Run all backend tests one final time**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS/backend && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8: Final commit**

```bash
cd /Users/mitchkehoe/Desktop/ClaudeTest/DashOS
git add docs/
git commit -m "feat: complete DashOS v1 — context injector, PARA pulse, system health"
```

---

## Self-Review

**Spec coverage:**
- ✓ Context Injector — GET+POST routes (Task 3), component (Task 8), wired (Task 11)
- ✓ PARA Pulse heatmap — vault activity route (Task 4), component (Task 9)
- ✓ Rot detector — vault rot route (Task 4), component (Task 9)
- ✓ Rot flag action — POST route (Task 4), component (Task 9)
- ✓ System Health git — health route (Task 5), component (Task 10)
- ✓ Map validation — health route (Task 5), component (Task 10)
- ✓ Hallucination log — health route (Task 5), component (Task 10)
- ✓ Vault error banner — App.jsx (Task 11)
- ✓ Auto-refresh 60s — App.jsx useEffect (Task 11)
- ✓ CLAUDE.md integration — Task 12
- ✓ Typewriter CSS — Task 7
- ✓ All write boundaries respected (AI OS/ + 📥 Inbox/AI Generated/)

**No placeholders, no TBDs, no missing code blocks.**

**Type consistency:** All components receive props matching what App.jsx fetches. API response shapes match what routes return and what components consume.
