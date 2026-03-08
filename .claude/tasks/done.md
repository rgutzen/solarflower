# Completed Tasks

---

## Session: Initial project build (2026-03-06)

### [agent:01] Educational notebook
- [x] Derive solar position equations from first principles
- [x] Implement clear-sky irradiance model (Meinel 1976 DNI)
- [x] Implement Liu-Jordan isotropic diffuse + ground-reflected
- [x] Implement POA irradiance calculation
- [x] Implement annual energy grid (tilt × azimuth sweep)
- [x] Implement monthly energy breakdown
- [x] Orientation heatmap visualization

### [agent:03] Web-App (Solar Advisor)
- [x] Design full architecture (core + ui)
- [x] `core/climate.py` — PVGIS TMY + Open-Meteo + clear-sky fallback
- [x] `core/system.py` — CEC DB + PVsyst .pan/.ond import + parametric_module()
- [x] `core/losses.py` — LossBudget dataclass, IAM, DC/AC loss chain, waterfall builder
- [x] `core/energy.py` — run_simulation(), compute_orientation_grid(), SimResult
- [x] `ui/sidebar.py` — all input controls
- [x] `ui/charts.py` — waterfall, monthly, heatmap, daily, sun path (Plotly)
- [x] `app.py` — 5-tab Streamlit layout with persistent metrics bar
- [x] `requirements.txt`
- [x] Fix: pd.Series(None)→NaN, use pd.notna() (annual yield was 0)
- [x] Fix: pvwatts_dc positional args (deprecated keyword)
- [x] Fix: PR uses POA not GHI (was giving PR > 100%)
- [x] Fix: gamma_r unit convention documented and applied correctly
- [x] SPDX headers on all 7 Python source files

### [infra] Project setup
- [x] `.gitignore` created (Python, Jupyter, Streamlit, PVsyst files, secrets)
- [x] `LICENSE` — AGPL-3.0-or-later (downloaded from gnu.org)
- [x] `COMMERCIAL_LICENSE.md` — dual licensing terms + contact info
- [x] `solar-app/README.md` — quick start, physics stack, project structure
- [x] Initial git commit (43a9ca3) and push to `git@github.com:rgutzen/solarflower.git`

## Session: Streamlit Cloud deployment prep (2026-03-07)

### [agent:03] Streamlit Cloud preparation
- [x] Fixed `.gitignore` — tracks `config.toml`, ignores `secrets.toml` and `credentials.toml`
- [x] Created `solar-app/.streamlit/config.toml` — brand theme (#F5A623 primary, dark bg) + iframe CORS disabled
- [x] Created `solar-app/docs/deployment.md` — full step-by-step guide (10 min deploy)
  - Covers: push → Streamlit Cloud form → URL update → PVGIS fallback → X-Frame-Options workaround → sleep behavior
- [x] Updated `website/solar-advisor.html` — cloud-aware embed script
  - `APP_URL` constant with comment directing to deployment guide
  - Dynamic fallback messages for local vs. cloud context
  - 40 s timeout for cloud (vs 12 s for local) to handle cold starts

---

## Session: Web-app export + Solar Advisor website page (2026-03-07)

### [agent:03] Web-App — CSV/JSON export
- [x] Added "Download Results" expander to Tab 1 (Annual Summary)
- [x] `Download Monthly CSV` button — month, avg daily yield, PR
- [x] `Download Full Summary JSON` — location, orientation, system, results, monthly, loss waterfall

### [agent:02] Website — Solar Advisor dedicated page
- [x] Created `website/solar-advisor.html` — feature showcase + physics table + iframe embed
- [x] Updated `website/index.html` — Solar Advisor card now links to `solar-advisor.html`

---

## Session: Multi-agent coordination setup (2026-03-06)

### [infra] Agent coordination infrastructure
- [x] Agent base prompts: `.claude/agent-prompts/01_scicomm-notebook.md`
- [x] Agent base prompts: `.claude/agent-prompts/02_website.md`
- [x] Agent base prompts: `.claude/agent-prompts/03_web-app.md`
- [x] Agent base prompts: `.claude/agent-prompts/04_mobile-app.md`
- [x] Shared conventions: `.claude/shared/conventions.md`
- [x] Shared interfaces: `.claude/shared/interfaces.md`
- [x] Shared status board: `.claude/shared/status.md`
- [x] Per-agent memory files: `.claude/agents/0X-*/MEMORY.md` (all four)
- [x] Task queue: `.claude/tasks/backlog.md`, `active.md`, `done.md`
- [x] Rewrote `.claude/memory/MEMORY.md` as orchestration hub
