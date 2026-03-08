# Agent Prompt: Web-App — Solar Advisor Energy Advisor

## Your Role
You are working on the **Web-App** component of the Solarflower project.
Your task is to maintain, improve, and extend `solar-app/` — a production-grade
Streamlit application that provides energy-advisor quality PV yield simulations.

## Design Guidelines

**You MUST follow the visual design specifications in:**
`.claude/shared/design-guidelines.md`

See also the implementation roadmap: `.claude/shared/design-roadmap.md`

Key points for the web app:
- Use brand colors for charts: `SUN_COLOR = "#F5A623"`, `BLUE_COLOR = "#2D7DD2"`, `GREY_COLOR = "#AAAAAA"`, `RED_COLOR = "#E63946"`
- Configure Streamlit theme with amber as primary color
- Use custom CSS via `st.markdown()` to match the design system
- Apply the same color psychology (amber = primary, blue = professional, green = success)
- Follow accessibility requirements for contrast ratios

## Project Context

The Solarflower project has four components. You work on component 2:

1. **SciComm Notebook** (`notebook/solar_panel_power.ipynb`) — educational article
2. **Web-App** (`solar-app/`) — YOUR COMPONENT
3. **Website** (`website/`) — landing page
4. **Mobile-App** (`mobile-app/`) — on-site orientation helper

**Repository root:** `/home/rgutzen/01_PROJECTS/solarflower/`
**License:** AGPL-3.0-or-later (SPDX header on every Python file)
**Run environment:** `app-dev` conda env at `/home/rgutzen/miniforge3/envs/app-dev/`

## Run Command

```bash
cd /home/rgutzen/01_PROJECTS/solarflower/solar-app
/home/rgutzen/miniforge3/envs/app-dev/bin/streamlit run app.py
```
Opens at `http://localhost:8501`

## Environment Versions

- Python 3.12, pvlib 0.15.0, streamlit 1.55.0, numpy 2.4.2, pandas 2.x, plotly 5.x
- All dependencies in `solar-app/requirements.txt`

## Architecture

```
solar-app/
├── app.py               Streamlit entry point — 5 tabs + persistent metrics bar
├── requirements.txt
├── core/
│   ├── __init__.py
│   ├── climate.py       fetch_tmy(): PVGIS TMY → Open-Meteo → clear-sky fallback
│   ├── system.py        CEC DB, PVsyst .pan/.ond import, parametric_module()
│   ├── losses.py        LossBudget dataclass, IAM, DC/AC loss chain, waterfall builder
│   └── energy.py        run_simulation(), compute_orientation_grid(), SimResult
└── ui/
    ├── __init__.py
    ├── sidebar.py        All Streamlit input controls → returns cfg dict
    └── charts.py         Plotly figure builders (waterfall, monthly, heatmap, daily, sun path)
```

## Physics Stack (PVsyst-equivalent)

| Stage | Model | pvlib function |
|-------|-------|----------------|
| Climate data | PVGIS TMY | `pvlib.iotools.get_pvgis_tmy()` |
| Solar position | Ephemeris | `location.get_solarposition()` |
| Sky diffuse | Perez (anisotropic) | `irradiance.get_total_irradiance(model='perez')` |
| IAM | Physical (AR glass) | `pvlib.iam.physical()` |
| Cell temperature | Faiman | `pvlib.temperature.faiman()` |
| Electrical (SDM) | PVsyst one-diode | `calcparams_pvsyst()` + `singlediode()` |
| Electrical (fallback) | PVWatts | `pvlib.pvsystem.pvwatts_dc()` (positional args) |
| Inverter | CEC Sandia / PVWatts | `pvlib.inverter.sandia()` / `pvlib.inverter.pvwatts()` |
| PR definition | IEC 61724 | E_AC / (H_poa × P_peak) — POA, not GHI |

## Critical Known Bugs (already fixed — do not regress)

### Bug 1: pd.Series(None) → NaN, not None
**Location:** `core/energy.py:_electrical_model`
**Symptom:** Annual yield = 0 for parametric modules
**Cause:** `parametric_module()` sets `"IL_ref": None`; when stored in a `pd.Series`,
`None` becomes `NaN`. `nan is not None` evaluates to `True` in Python, so the SDM
branch was entered with `I_L_ref=float(nan)` → all output NaN.
**Fix:** Use `pd.notna()`:
```python
il_ref = mp.get("IL_ref")
sdm_available = has_sdm and il_ref is not None and pd.notna(il_ref) and ...
```
**Never revert this to `is not None` alone.**

### Bug 2: pvlib 0.15 pvwatts_dc parameter rename
**Location:** `core/energy.py:_electrical_model`
**Cause:** `g_poa_effective` was renamed to `effective_irradiance` in pvlib 0.13+.
**Fix:** Use positional arguments:
```python
pvlib.pvsystem.pvwatts_dc(poa, temp_cell, pdc0, gamma)
```

### Bug 3: PR > 100% using GHI as reference
**Location:** `core/energy.py:run_simulation`
**Cause:** For south-facing tilted panels, POA > GHI; using GHI gives PR > 100%.
**Fix:** Use POA irradiance per IEC 61724:
```python
pr = annual_yield / (poa_kwh * pk_kw)  # NOT ghi_kwh
```

### Bug 4: gamma_r unit convention
**Location:** `core/system.py:parametric_module` and `core/energy.py:_electrical_model`
**Convention:** `gamma_r` is stored as %/°C (e.g., -0.4 for -0.40%/°C).
`_electrical_model` converts back with `if abs(gamma) > 0.1: gamma /= 100`.
Do not change this convention without updating both ends.

## Key Data Structures

### `SimResult` dataclass (core/energy.py)
```python
@dataclass
class SimResult:
    annual_yield_kwh: float
    specific_yield_kwh_kwp: float   # kWh per kWp
    performance_ratio: float        # IEC 61724, vs POA
    capacity_factor: float
    monthly_yield_kwh_day: pd.Series  # avg kWh/day, index 1–12
    monthly_pr: pd.Series             # PR by month, index 1–12
    hourly_poa: pd.Series             # W/m² plane-of-array
    hourly_power_ac: pd.Series        # W net AC
    loss_waterfall: dict[str, float]  # loss category → kWh lost
    peak_power_kw: float
    data_source: str
```

### `LossBudget` dataclass (core/losses.py)
```python
@dataclass
class LossBudget:
    iam_model: str = "physical"   # 'physical' or 'ashrae'
    soiling: float = 0.02
    lid: float = 0.015
    mismatch: float = 0.01
    dc_wiring: float = 0.015
    availability: float = 0.01
    ac_wiring: float = 0.005
    transformer: float = 0.01
```

### `cfg` dict from `render_sidebar()` (ui/sidebar.py)
Keys: `lat`, `lon`, `elevation_m`, `tilt_deg`, `panel_az_deg`, `albedo`,
`module_params` (pd.Series), `inverter_params` (pd.Series), `inverter_type` (str),
`n_modules`, `strings_per_inverter`, `n_inverters`, `loss_budget` (LossBudget),
`tilt_step`, `az_step`, `fetch_climate` (bool)

## Coordinate Conventions

- **Azimuth:** 0° = North, 90° = East, 180° = South, 270° = West (pvlib convention)
- **Tilt:** 0° = horizontal, 90° = vertical
- **Optimal orientation:** South (180°) for N hemisphere, North (0°) for S hemisphere

## Caching Strategy

- `@st.cache_resource`: CEC database loads (once per server process)
- `@st.cache_data`: `run_simulation()`, `compute_orientation_grid()` (keyed on all inputs)
- TMY data: stored in `st.session_state["tmy_df"]` (fetched on demand)
- Orientation grid: stored in `st.session_state["energy_grid"]` (computed on button click)

## Verification Baseline (Berlin, 52.5°N, 8 kWp, S-facing 35°)

After any changes, verify the simulation still produces reasonable results:
- Annual yield: ~9,500–11,000 kWh (range due to data source — TMY vs single year)
- Specific yield: ~1,180–1,375 kWh/kWp
- Performance Ratio: ~85–92% (vs POA)
- Capacity Factor: ~13–16%
- Loss waterfall: all bars positive, total losses ~15–25% of gross

## SPDX Header (required on every Python file)

```python
# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
```

## Coordination Notes

- The notebook (`notebook/solar_panel_power.ipynb`) uses simpler first-principles models (Meinel,
  Liu-Jordan). The web-app is intentionally more accurate. They are independent.
- The mobile app (`mobile-app/`) will want to call the same optimal-orientation logic.
  If you create any standalone utility functions (e.g., compute optimal tilt/azimuth for
  a location), consider placing them in `core/` with no Streamlit dependency so the
  mobile team can import them.
- Memory and plans are in `.claude/memory/MEMORY.md` and `.claude/plans/solar-app-plan.md`.
- Do NOT modify files outside `solar-app/` (except `requirements.txt` at repo root if needed).
