# PlanMe — Parallel Execution Batches

Tasks from `2026-03-30-planme.md` grouped by dependency. Each batch can be run fully in parallel.

---

## Batch 0 — Sequential (prerequisite for everything)
- **Task 1:** Scaffold the project

## Batch 1 — Parallel (all after Task 1)
- **Task 2:** Schema validation module
- **Task 3:** Layout algorithm (parser)
- **Task 5:** Electron main process + preload
- **Task 12:** SVG wobble filter (`index.html` only)
- **Task 13:** planme Claude Code skill (markdown file)

## Batch 2 — Parallel (after their Batch 1 prerequisites)
- **Task 4:** Parser agent ← needs Task 3
- **Task 6:** Zustand store ← needs Task 2
- **Task 7:** App root layout + CSS ← needs Task 1

## Batch 3 — Parallel (after Tasks 6 + 7)
- **Task 8:** Sidebar component
- **Task 9:** TabBar + OverviewPanel components
- **Task 10:** PlanNode component

## Batch 4 — Sequential
- **Task 11:** PlanCanvas + SubCanvas ← needs Task 10

## Batch 5 — Final
- **Task 14:** End-to-end integration test ← needs all tasks
