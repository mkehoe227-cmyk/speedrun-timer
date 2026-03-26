# SpeedRun Timer

![Plain HTML](https://img.shields.io/badge/plain-HTML-orange) ![Plain CSS](https://img.shields.io/badge/plain-CSS-blue) ![Plain JS](https://img.shields.io/badge/plain-JS-yellow) ![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)

A browser-based split timer for speedrunning. Track personal bests, gold splits, and run history — no install, no server, no build step.

---

## Features

- **Routes** — create and edit named routes with any number of custom splits
- **Live delta tracking** — see ahead/behind PB in real time, colored green or red
- **Gold splits** — best individual segment time per split position, updated every run
- **Finish screen** — split-by-split comparison chart of current run vs. PB
- **Stats screen** — run history chart (last 10 runs), plus PB, worst, and average times
- **Route sharing** — share any route via an encoded URL hash
- **Persistent** — all routes and history saved to `localStorage`; data integrity validated on load

---

## Usage

Open the app directly in a browser — no server required:

```bash
open speedrun/speedrun.html
```

### Workflow

1. Click **+ New Route**, enter a name, and add your splits
2. Click **Save & Run** to start immediately
3. Press `Space` after each split to advance
4. On the finish screen, choose to save, discard, or run again

### Keyboard Controls

| Key       | Action                         |
|-----------|-------------------------------|
| `Space`   | Advance to next split (during run) |
| `Esc`     | Cancel run / return to home    |

---

## Tech

Plain HTML/CSS/JS — zero dependencies, zero build steps. All logic lives in `script.js`; visual state is driven entirely by CSS classes.

---

## Future Roadmap

- **Sum-of-best (SOB)** — compare your run against the theoretical best using all gold splits combined
- **Export / import** — download run history as JSON or share a full route backup
- **Pause support** — pause and resume mid-run without discarding
- **Mobile / touch** — tap-friendly controls for phone use
- **Custom themes** — light mode or accent color customization
- **PB notifications** — animated highlight or sound cue on a new personal best
- **Split reordering** — drag-and-drop to reorganize splits while editing a route
