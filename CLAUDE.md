# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Open `tictactoe/tictactoe.html` directly in a browser — no build step or server required.

```bash
open tictactoe/tictactoe.html
```

## Architecture

This is a plain HTML/CSS/JS project with no dependencies or frameworks.

- `tictactoe.html` — static markup; the board is 9 hardcoded `.cell` divs with `data-i` indices 0–8
- `style.css` — dark-themed styles; cell state is driven by CSS classes (`.x`, `.o`, `.taken`, `.win`)
- `script.js` — all game logic; runs immediately on load with no module system

### Key concepts in `script.js`

- `board` is a flat 9-element array (`null` | `'X'` | `'O'`), indexed to match `data-i`
- `WINS` is a hardcoded list of winning index triplets checked after every move
- `scores` is an in-memory object; it resets on page refresh (no persistence)
- `init()` resets game state and DOM classes without re-rendering the board structure
- Cell clicks are bound at startup via `querySelectorAll('.cell')` — adding cells to the DOM later won't pick up the listeners
