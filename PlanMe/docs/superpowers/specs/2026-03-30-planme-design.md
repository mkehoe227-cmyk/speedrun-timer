# PlanMe — Design Spec
**Date:** 2026-03-30
**Status:** Approved

---

## Overview

PlanMe is a local-first Electron + React desktop app that ingests project plans from Claude Code CLI sessions and renders them as interactive, traversable flowchart graphs. It is a comprehension tool — its job is to make AI-generated plans legible to a human brain.

Plans enter the system via a Claude Code skill called `planme`. The skill extracts the plan from the current conversation history, writes a structured `plan.md`, and immediately spawns a Node.js parser agent that converts it to `plan.json`. The Electron app watches `~/.planme/plans/` and auto-ingests new files.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React + Vite |
| Graph rendering | React Flow (XY Flow) |
| State management | Zustand |
| File watching | chokidar |
| Parser agent | Node.js + Anthropic SDK (claude-sonnet-4-6) |
| Storage | `~/.planme/plans/` — one `.md` + one `.json` per plan |

---

## The `plan.json` Schema

This is the contract between the CLI skill and the Electron app. The planme skill owns it.

```json
{
  "version": "1.0",
  "id": "uuid",
  "title": "Plan title",
  "createdAt": "2026-03-30T18:00:00Z",
  "overview": {
    "description": "What this plan is and why it exists",
    "techStack": [
      { "layer": "Desktop shell", "technology": "Electron" },
      { "layer": "Frontend", "technology": "React + Vite" }
    ]
  },
  "nodes": [
    {
      "id": "uuid",
      "title": "Node title",
      "description": "Brief description of what this step involves",
      "checklist": [
        { "id": "uuid", "text": "Sub-task text", "checked": false }
      ],
      "verification": "You know you're done when...",
      "status": "pending | in_progress | completed",
      "position": { "x": 0, "y": 0 },
      "dependsOn": ["other-node-id"],
      "children": []
    }
  ]
}
```

**Key decisions:**
- `overview` holds plan-level metadata (description + tech stack). It is reference material, not a task, and is displayed in a separate Overview tab — not as a node in the graph.
- `dependsOn` is the source of truth for edges. The app derives the React Flow `edges` array from it — no separate edges array in the schema.
- `children` is a recursive array of the same node structure. Children reference sibling IDs in their own `dependsOn` — never parent IDs. Nesting is capped at 2 levels (top-level nodes → children only; children cannot have children).
- `position` is written by the parser with a default auto-layout grid, then updated by the app as the user moves nodes. The app writes back to disk on change.
- `status`, `checked`, and `position` are the only fields the app mutates at runtime.

---

## The planme Skill Pipeline

### Prerequisites
- `ANTHROPIC_API_KEY` set in environment
- Node.js installed
- Parser agent installed at `~/.planme/parser/index.js`

### Stage 1 — Skill trigger
User runs `/planme` in the Claude Code CLI. The skill reads the current conversation history and instructs Claude to extract a structured plan from it. It writes `~/.planme/plans/<slugified-title>.md` using a strict template:

```markdown
# Plan Title

**Description:** What this plan is and why it exists.

**Tech Stack:**
- Desktop shell: Electron
- Frontend: React + Vite

## Node Title
**Description:** Brief description of this step.

**Checklist:**
- [ ] Sub-task one
- [ ] Sub-task two

**Verification:** You know you're done when...

**Depends on:** other-node-title

### Child Node Title (if any)
...same structure...
```

### Stage 2 — Parser agent
The skill spawns: `node ~/.planme/parser/index.js <path-to-plan.md>`

The parser:
1. Checks for `ANTHROPIC_API_KEY` — exits with a clear error message if missing
2. Reads the `.md` file
3. Calls the Claude API with a system prompt specifying the exact `plan.json` schema
4. Validates the response against the schema
5. Assigns UUIDs to all nodes and checklist items
6. Computes default `position` values using a simple grid auto-layout
7. Writes `<same-name>.json` to `~/.planme/plans/`
8. On failure: writes `<same-name>.error.json` and logs to stdout

### Stage 3 — Auto-ingestion
The Electron app watches `~/.planme/plans/` via chokidar. On any `.json` file add or change event, it reads the file and sends it to the renderer via IPC. The sidebar updates automatically — no manual import step needed.

---

## Electron App Structure

```
planme/
├── electron/
│   ├── main.js          # Window creation, chokidar watcher, IPC handlers
│   └── preload.js       # contextBridge — exposes safe IPC API to renderer
├── src/
│   ├── App.jsx           # Root layout — sidebar + main content area
│   ├── store/
│   │   └── planStore.js  # Zustand store — loaded plans, active plan, write-back
│   └── components/
│       ├── Sidebar.jsx      # Plan list; click to activate
│       ├── TabBar.jsx       # "Overview" and "Graph" tabs above content area
│       ├── OverviewPanel.jsx # Renders plan description + tech stack table
│       ├── PlanCanvas.jsx   # React Flow instance for top-level graph
│       ├── PlanNode.jsx     # Custom node — collapsed and expanded states
│       └── SubCanvas.jsx    # React Flow instance for child sub-graph + breadcrumb
├── parser/
│   └── index.js          # Node.js parser agent (standalone, CLI-invoked)
└── skills/
    └── planme.md         # The Claude Code skill file
```

---

## React Component Tree & Interaction Model

### Sidebar
- Lists all plans in `~/.planme/plans/` by title and creation date
- Error badge on plans with a corresponding `.error.json` file
- Empty state on first launch: message explaining how to generate a plan via the CLI

### TabBar
Two tabs above the main content area: **Overview** and **Graph**. Switching tabs does not affect graph state — the React Flow canvas persists in the background.

### OverviewPanel
- Renders `overview.description` as a paragraph
- Renders `overview.techStack` as a clean two-column table (Layer / Technology)
- Notebook aesthetic: eggshell background, navy text, same typography as the rest of the app
- Read-only — not editable in the app

### PlanCanvas
- React Flow instance rendering top-level nodes
- Edges derived from `dependsOn` arrays at render time
- Passes active node state down to PlanNode components

### PlanNode (custom React Flow node)
**Collapsed state:**
- Shows title + status indicator
- Dependency-blocked nodes (not all `dependsOn` completed): 40% opacity, edges faded
- Completed nodes: title with strikethrough + muted opacity
- In-progress nodes: small filled amber dot on the node border

**Expanded state (on click):**
- Node grows in-place with a spring animation
- Canvas behind blurs and dims to ~30% opacity — node becomes focal point
- Reveals: description, checklist (interactive checkboxes), verification criterion
- "Go deeper" button appears if the node has children
- Click anywhere on the dimmed canvas to collapse back

### SubCanvas
- Replaces PlanCanvas when "Go deeper" is clicked
- Renders child nodes as a new React Flow instance
- Breadcrumb at top: "Plan Title → Node Title" — click to navigate back
- Same PlanNode behavior applies to child nodes

### State write-back
Every state mutation (checklist check, status change, node position drag) triggers an immediate write to `plan.json` on disk via IPC. If chokidar detects an external change to an open plan, the app prompts: "This plan was updated externally — reload?" rather than silently overwriting.

---

## Visual Design — Notebook Aesthetic

**Canvas:** Eggshell background (`#F5F0E8`), subtle dot-grid in a slightly darker cream. Pan and zoom freely.

**Nodes:** Navy blue (`#1B2D4F`), rounded rectangles with a subtle hand-drawn border wobble via SVG filter (`feTurbulence` + `feDisplacementMap`). Off-white/cream text. Faint drop shadow like an index card.

**Typography:** Humanist sans-serif (Inter or DM Sans) for titles; same or slightly lighter weight for body content. Legible first, characterful second.

**Edges:** Thin curved lines in warm mid-navy. Faded for dependency-blocked connections.

**Status indicators:**
- Pending: no indicator
- In-progress: small filled amber dot on node border
- Completed: title strikethrough + muted node opacity
- Dependency-blocked: 40% opacity on node and its edges

**Expanded node:** Spring animation on expand. Canvas behind blurs and dims to ~30% opacity. Node gets a warmer fill and more pronounced shadow — visually lifted off the page.

**Overview panel:** Same eggshell background, navy text, clean table for tech stack. Feels like the inside cover of a notebook.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Parser API call fails | Writes `.error.json`; app shows error badge in sidebar |
| `plan.json` missing required fields | App shows plan in warning state rather than crashing |
| External file change while plan is open | Prompt: "This plan was updated externally — reload?" |
| No plans exist | Empty sidebar with onboarding message |
| Missing `ANTHROPIC_API_KEY` | Parser exits immediately with clear terminal error |
| Sub-graph depth exceeded | Children cannot have children; skill enforces 2-level cap |

---

## Constraints & Non-Goals

- **No backend server.** Everything is local — files on disk, Electron IPC, no network except the Anthropic API call in the parser.
- **No manual plan creation in the app.** Plans are always generated via the CLI skill. The app is read/interact only.
- **No multi-user or sync.** Single user, single machine.
- **Nesting capped at 2 levels.** Children cannot have children. Plans needing more depth should use additional top-level nodes.
- **No drag-to-create edges in the UI.** Graph structure comes from `plan.json`. Users cannot draw new dependency edges in the app.
- **The app never writes to `plan.md`.** The `.md` file is the skill's output only. The app reads and writes `plan.json` exclusively.
- **Overview is read-only.** Plan metadata is set at creation time by the skill; it is not editable in the app.
