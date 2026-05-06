# Job Activity Logger — Design Spec

> AI-generated on 2026-05-06. Reviewed and approved by Mitch Kehoe.

## Problem

Mitch needs a frictionless end-of-day tool to convert raw task bullets in his Obsidian daily note into a structured, aggregated accomplishments file suitable for LLM-driven resume generation. The tool must intelligently compact existing entries rather than blindly appending.

## Solution

A Claude Code slash command (`/job-log`) that uses Claude's native Read/Write/Bash tools to process the daily note and update the master accomplishments file. No Python, no API key — runs on the Claude Code session.

---

## Phase Structure

| Phase | Master File | Active |
|-------|-------------|--------|
| 1 — Personal testing | `🗺️ Areas/Personal/Personal_Accomplishments.md` | Now → June 2026 |
| 2 — Dark Wolf | `🗺️ Areas/Work/Dark Wolf/Dark_Wolf_Accomplishments.md` | June 2026+ |

Switch: update one path variable at top of command file.

---

## Paths

| Resource | Path |
|----------|------|
| Daily notes | `~/Desktop/Base copy/📅 Calendar/YYYY-MM-DD.md` |
| Task section header | `## 🏆 Accomplishments` |
| Phase 1 master | `~/Desktop/Base copy/🗺️ Areas/Personal/Personal_Accomplishments.md` |
| Phase 2 master | `~/Desktop/Base copy/🗺️ Areas/Work/Dark Wolf/Dark_Wolf_Accomplishments.md` |
| Command file | `~/.claude/commands/job-log.md` |

---

## Invocation

```
/job-log              # processes today's note
/job-log 2026-05-03   # processes a specific date
```

---

## Execution Sequence

1. Resolve date from `$ARGUMENTS` or `date +%Y-%m-%d`
2. Read daily note → extract `## 🏆 Accomplishments` section (up to next `---` or `##`)
3. Validate: stop if file missing, section missing, or section only has placeholder text
4. Read master file (empty if not found — cold start)
5. Backup master if it exists: `cp master.md master.md.bak`
6. Apply compactor logic
7. Write full updated master file
8. Print change summary

---

## Compactor Rules

1. **Aggregation** — Absorb and rewrite existing project bullets when new work extends them. Never duplicate. One project = one block.
2. **Noise Filter** — Skip routine emails, admin, low-impact meetings, doc-reading with no output.
3. **Cold Start** — Foundational work → `Project: Onboarding & Infrastructure`, `Status: Foundational`.
4. **Tech Extraction** — Every project block names languages/frameworks/tools explicitly.
5. **STAR Bullets** — Strong verbs (Architected, Engineered, Deployed, Refactored). Format: what → with what → to what end.

---

## Master File Format

```markdown
# Personal Accomplishments

> Last updated: YYYY-MM-DD

## Project: [Project Name]
**Status:** Ongoing | Completed | Foundational
**Tech Stack:** Python, FastAPI, PostgreSQL
**Milestones:**
* Architected X to solve Y, resulting in Z
* Refactored A using B, reducing C by D%
```

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Daily note not found | Stop, print path looked for |
| Section missing | Stop: "Add entries to ## 🏆 Accomplishments first" |
| Section is only placeholder | Stop: same message |
| Master not found | Cold start — create fresh |
| Bad date arg format | Stop, print correct format (YYYY-MM-DD) |

---

## Verification Checklist

- [ ] Run `/job-log` with a real bullet → master file created with correct format
- [ ] Run again with same bullet → aggregates, does not duplicate
- [ ] Run `/job-log 2026-05-05` → date override works
- [ ] `.bak` file exists after second run
- [ ] Remove section from daily note → command stops cleanly with error message
