# DashOS — Design Spec

## Context
DashOS is a local web dashboard for the AI-OS system. The problem it solves: the AI's working memory (`me.md`, vault maps) is static — it doesn't know what you're working on *right now*, how you're feeling, or whether your vault is healthy. This dashboard makes that state dynamic and visible, injecting live context into every Claude session and surfacing vault health at a glance.

---

## Decisions

| Dimension | Choice |
|-----------|--------|
| Platform | Local web app (Vite + React + Express) |
| Phase 2 | Electron menubar wrapper |
| MVP features | Context Injector, PARA Pulse, System Health |
| Cut from MVP | Agentic Command Bar, Zettelkasten Serendipity |
| Claude API in v1 | No — purely local |
| Visual theme | Typewriter light (cream/parchment, Courier Prime, ink-black borders) |
| Launch | `npm start` → opens `localhost:5173` |

---

## Architecture

```
DashOS/
├── frontend/               # Vite + React
│   ├── vite.config.js      # proxy /api → localhost:7070
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── ContextInjector.jsx
│       │   ├── ParaPulse.jsx
│       │   └── SystemHealth.jsx
│       └── styles/
│           └── typewriter.css
├── backend/                # Express
│   ├── server.js           # entry point, port 7070
│   └── routes/
│       ├── context.js
│       ├── vault.js
│       └── health.js
├── .env                    # VAULT_PATH=~/Desktop/Base copy
└── package.json            # "start": runs both concurrently
```

**Key constraint:** All vault writes go only to AI OS-approved zones:
- `AI OS/current_context.md` — context injector writes here
- `📥 Inbox/AI Generated/` — rot flags + hallucination log write here

---

## Features

### 1. Context Injector

**Backend:** `routes/context.js`
- `GET /api/context` — reads + parses `AI OS/current_context.md`
- `POST /api/context` — writes file with: active_project, focus, vibe, blocker, timestamp

**File format written:**
```md
---
active_project: Atlas
focus: Phase 2 task manager UI
vibe: Productive
blocker: ""
updated: 2026-05-11T14:32:00
---
```

**Claude integration:** Add one line to `CLAUDE.md`:
```
@/Users/mitchkehoe/Desktop/Base copy/AI OS/current_context.md
```

**UI:** Project selector grid (6 chips) + Focus input + Vibe tags + Blocker input + "Inject Context" button + last-injected footer.

---

### 2. PARA Pulse

**Backend:** `routes/vault.js`
- `GET /api/vault/activity` — walks vault dirs, returns file mtimes grouped by project folder for last 48h. No watcher — on-demand scan.
- `GET /api/vault/rot` — scans `🗺️ Areas/` subdirs for files not modified in 14+ days
- `POST /api/vault/rot/flag` — appends entry to `📥 Inbox/AI Generated/rot-flagged.md` (does not move files)

**UI:** Bar chart heatmap (height = file count in 48h) + rot table (project, days stale, last modified, → archive flag action). Manual refresh button.

---

### 3. System Health

**Backend:** `routes/health.js`
- `GET /api/health/git` — `git status --porcelain` + `git rev-list @{u}..HEAD --count` for commits-ahead count
- `GET /api/health/maps` — stat `me.md`, `vault_map.md`, `skills_map.md` → returns size + exists boolean. Warn threshold: >10KB
- `GET /api/health/log` — reads last 10 entries from `📥 Inbox/AI Generated/hallucination-log.md`
- `POST /api/health/log` — appends timestamped entry to same file

**UI:** Git status bar (ahead count, amber if >0) + 3-stat row (vault/maps/skills) + map integrity list + hallucination log table + flag input.

**Auto-refresh:** `setInterval` every 60s for health endpoints only.

---

## Data Flow

```
npm start
  ├── Express :7070 (reads VAULT_PATH from .env)
  └── Vite :5173 (proxies /api/* → :7070)

Page load → parallel fetch:
  GET /api/context
  GET /api/vault/activity  ─┐
  GET /api/vault/rot        ─┤ scans ~/Desktop/Base copy/
  GET /api/health/git       ─┤ via child_process.execSync
  GET /api/health/maps      ─┘
  GET /api/health/log

User clicks "Inject Context":
  POST /api/context → writes AI OS/current_context.md
  → Claude reads on next session start via CLAUDE.md @import

User clicks "→ archive" on rot item:
  POST /api/vault/rot/flag
  → appends to 📥 Inbox/AI Generated/rot-flagged.md
  (Claude sees it; user decides what to do)

User clicks "Flag" in hallucination log:
  POST /api/health/log
  → appends to 📥 Inbox/AI Generated/hallucination-log.md
```

---

## Error Handling

| Error | Behavior |
|-------|----------|
| VAULT_PATH missing/wrong | Top banner: "Vault not found. Set VAULT_PATH in .env" |
| Git not initialized | Health panel shows "no git" badge, no crash |
| Map file missing | Map row shows red ✗, not a crash |
| POST fails | Inline error under the triggering action, no silent swallow |
| Vault dir unreadable | PARA Pulse shows "scan failed" with retry button |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18, Vite 5 |
| Styling | Plain CSS (typewriter theme vars) — no Tailwind |
| State | useState/useEffect only — no Zustand needed for v1 |
| Backend | Express 4, Node 20+ |
| Process mgmt | `concurrently` runs both servers from root `npm start` |
| Git ops | `child_process.execSync` — no git library needed |
| FS ops | Node `fs`, `path` — no abstractions |

---

## Phase 2 (post-MVP)

- Electron menubar wrapper — BrowserWindow points at `localhost:7070`, tray icon
- Zettelkasten Serendipity widget (Claude API)
- Agentic Command Bar (natural language → Claude API → file/email actions)
- Project list auto-detected from vault memory files instead of hardcoded

---

## Verification Plan

1. `npm start` → both servers up, browser opens at `localhost:5173`
2. Select project + set focus → Inject → verify `AI OS/current_context.md` written with correct frontmatter
3. Open new Claude Code session → verify context fields appear in context window
4. PARA Pulse heatmap reflects real file activity (touch a vault file, refresh, bar grows)
5. Rot list shows projects with correct 14-day threshold
6. Git status matches `git status` run directly in terminal
7. Flag a hallucination → verify entry in `hallucination-log.md` with timestamp
8. Set wrong VAULT_PATH → verify error banner appears, app doesn't crash
