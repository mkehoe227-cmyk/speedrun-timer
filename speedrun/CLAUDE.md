# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git & GitHub

The repo is at https://github.com/mkehoe227-cmyk/speedrun-timer. Commit and push to `main` whenever meaningful work is complete (new feature, bug fix, etc.). Use descriptive commit messages and always include the co-author trailer.

## Running the App

Open `speedrun.html` directly in a browser — no build step or server required.

```bash
open speedrun/speedrun.html
```

## Architecture

Plain HTML/CSS/JS with no dependencies or frameworks. All logic runs immediately on load via a bare `init()` call at the bottom of `script.js`.

- `speedrun.html` — four screens as sibling `<div>`s; only one is visible at a time via `.hidden`
- `style.css` — dark theme; visual state is driven entirely by CSS classes (`.active-split`, `.split-done`, `.gold-split`, `.ahead`, `.behind`, `.gold`)
- `script.js` — all logic; module-level variables hold the entire app state

## Key Concepts in `script.js`

### State machine
`state` is a string: `'home' | 'setup' | 'running' | 'finished'`. `showOnly(id)` switches screens; render functions (`renderHome`, `renderSetup`, `startRun`, `finishRun`) set `state` and call `showOnly`. The keyboard handler and button handlers gate on `state` before acting.

### Route data model
Each route is a plain object:
```js
{ id: string, name: string, splitNames: string[], pb: number[]|null, goldSplits: (number|null)[] }
```
- `pb` is a **cumulative** ms array (index `i` = total elapsed at end of split `i`). `null` until the first saved run.
- `goldSplits` is an **individual** ms array (best single-split duration per position). Stored separately from `pb` because gold splits update on every saved run regardless of overall pace.
- `routes[]` is the in-memory master list; `activeRoute` is a reference into it.

### Timer loop
Uses `requestAnimationFrame` (stored in `rafId`). Timing is always computed as `performance.now() - startTime` — never accumulated frame-by-frame — so no drift occurs and tab-switch pauses are handled correctly. Cancel with `cancelAnimationFrame(rafId)` before any screen transition out of `running`.

### Delta calculation
`computeDelta(splitIndex, elapsedMs)` returns `cumulativeNow - pb[splitIndex]`. Negative = ahead (green `.ahead`), positive = behind (red `.behind`). Returns `null` if `pb` is null; delta cells stay blank on first-ever run.

### DOM updates during a run
`buildSplitsTable()` creates `<tr>` elements and stores references in `splitRows[]` (parallel to `splitNames`). During `onFrame`, cells are updated by index (`splitRows[i].cells[2]`, `cells[3]`) — no querySelectorAll in the hot path.

### Persistence
All routes are stored under a single localStorage key `"speedrun_routes"` as a JSON array. `loadRoutes()` validates array lengths on load — if `pb.length` or `goldSplits.length` mismatches `splitNames.length` (route edited), those fields are reset to null/empty. `handleSave()` only overwrites `pb` if the new run is faster; gold splits always update per-split.

### Setup screen dual-mode
`renderSetup(route)` handles both create (route = null, `editingRouteId = null`) and edit (route passed, `editingRouteId = route.id`). `handleSaveRoute(andRun)` reads `editingRouteId` to decide whether to push a new route or update in place.
