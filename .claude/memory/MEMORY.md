# Solarflower — Project Coordination Hub

## Project Structure

```
solarflower/
├── notebook/            Component 1: SciComm educational notebook
│   └── solar_panel_power.ipynb
├── solar-app/           Component 2: Solar Advisor web-app (complete)
├── website/             Component 3: Landing page (not started)
├── mobile-app/          Component 4: Panel Compass PWA (complete)
├── LICENSE, COMMERCIAL_LICENSE.md, .gitignore, README.md
└── .claude/             All coordination files (below)
```

## Component Status

| # | Component | Directory | Status |
|---|-----------|-----------|--------|
| 1 | SciComm Notebook | `notebook/` | Functional draft, needs extensions |
| 2 | Web-App (Solar Advisor) | `solar-app/` | Complete, working |
| 3 | Website (landing page) | `website/` | Not started |
| 4 | Mobile-App (Panel Compass) | `mobile-app/` | Complete |

Full detail: `.claude/shared/status.md`

## Multi-Agent Workflow

### Spawning an agent
Each agent directory contains everything it needs:
```
.claude/agents/0X-NAME/
├── 0X_name.md    ← base prompt (load this as agent's system instructions)
├── MEMORY.md     ← agent's persistent memory (read + update each session)
└── plans/        ← implementation plans
```
Also load: `.claude/shared/conventions.md` + `.claude/shared/interfaces.md` + `.claude/shared/design-guidelines.md`
Check work: `.claude/tasks/active.md` + `.claude/tasks/backlog.md`
After work: update own `MEMORY.md`, move tasks, update `.claude/shared/status.md`

### File ownership — strict boundaries
| Agent | Writes to |
|-------|-----------|
| 01-notebook | `notebook/` |
| 02-website  | `website/` |
| 03-web-app  | `solar-app/` |
| 04-mobile   | `mobile-app/` |
| Any agent   | Own `.claude/agents/0X-*/MEMORY.md`, `.claude/tasks/`, `.claude/shared/status.md` |

### Delegating a task
Add to `.claude/tasks/backlog.md` with `[agent:0X]` tag.
Working → move to `active.md`. Done → move to `done.md`.

## Navigation Map

```
.claude/
├── memory/MEMORY.md           ← YOU ARE HERE (auto-loaded, < 200 lines)
├── shared/
│   ├── conventions.md         ← Coordinates, units, SPDX, colors, git, pvlib gotchas
│   ├── interfaces.md          ← Data schemas, URL contracts, cross-component APIs
│   ├── status.md              ← Live project status board
│   ├── design-guidelines.md   ← Full visual design system (v1.3, solarpunk/soilpunk)
│   └── design-roadmap.md      ← Phase status + Phases 6-7 implementation plan
├── agents/
│   ├── 01-notebook/           ← prompt + memory + plans
│   ├── 02-website/
│   ├── 03-web-app/
│   ├── 04-mobile-app/
│   ├── 00_design-guidelines.md     ← (source, same as shared/design-guidelines.md)
│   ├── 00_design-improvements.md   ← original proposals (reference)
│   └── 00_design-plan-phases5-8.md ← detailed implementation notes (reference)
├── tasks/
│   ├── backlog.md, active.md, done.md
├── plans_deprecated/          ← historical (solar-app-plan.md)
├── RSE-PROMPT.md              ← general RSE engineering principles
└── notes.md                   ← human notes
```

## Quick Reference

**Run web-app:**
```bash
cd /home/rgutzen/01_PROJECTS/solarflower/solar-app
/home/rgutzen/miniforge3/envs/app-dev/bin/streamlit run app.py
```
**Run notebook:**
```bash
/home/rgutzen/miniforge3/envs/app-dev/bin/jupyter notebook notebook/solar_panel_power.ipynb
```
**Environment:** `app-dev` conda — Python 3.12, pvlib 0.15.0, streamlit 1.55.0
**Repo:** `git@github.com:rgutzen/solarflower.git`
**License:** AGPL-3.0-or-later + commercial dual license

## Critical Rules (details in `shared/conventions.md`)
- Azimuth: 0°=N, 90°=E, 180°=S, 270°=W (clockwise); Tilt: 0°=horizontal
- PR: IEC 61724 — use POA irradiance, not GHI
- SPDX header on every source file; brand accent: `#F5A623`

## Known pvlib Bugs — already fixed, do not regress
- `pd.Series(None)` → NaN; use `pd.notna()`, not `is not None`
- `pvwatts_dc`: positional args only (`g_poa_effective` removed pvlib 0.13+)
