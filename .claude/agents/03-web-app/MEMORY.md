# Agent 03 — Web-App (Solar Advisor): Persistent Memory

_Update this file after every working session._
_Last updated: 2026-03-06_

## Scope
- **Directory:** `/home/rgutzen/01_PROJECTS/solarflower/solar-app/`
- **Base prompt:** `.claude/agent-prompts/03_web-app.md`
- **Do NOT modify:** any file outside `solar-app/`

## Architecture

```
solar-app/
├── app.py               Streamlit entry, 5 tabs + persistent metrics bar
├── requirements.txt
├── core/
│   ├── __init__.py
│   ├── climate.py       fetch_tmy(): PVGIS TMY → Open-Meteo → clear-sky fallback
│   ├── system.py        CEC DB, PVsyst .pan/.ond import, parametric_module()
│   ├── losses.py        LossBudget dataclass, IAM, DC/AC loss chain, waterfall
│   └── energy.py        run_simulation(), compute_orientation_grid(), SimResult
└── ui/
    ├── __init__.py
    ├── sidebar.py        All Streamlit input controls → returns cfg dict
    └── charts.py         Plotly: waterfall, monthly, heatmap, daily, sun path
```

## Physics Stack

| Stage | Model | Function |
|-------|-------|----------|
| Climate | PVGIS TMY (20+yr satellite) | `pvlib.iotools.get_pvgis_tmy()` |
| Solar position | Ephemeris | `location.get_solarposition()` |
| Sky diffuse | Perez anisotropic | `get_total_irradiance(model='perez')` |
| IAM | Physical (AR glass) | `pvlib.iam.physical()` |
| Thermal | Faiman (PVsyst default) | `pvlib.temperature.faiman()` |
| Electrical (SDM) | PVsyst one-diode | `calcparams_pvsyst()` + `singlediode()` |
| Electrical (fallback) | PVWatts | `pvwatts_dc(poa, Tcell, pdc0, gamma)` |
| Inverter | CEC Sandia / PVWatts | `pvlib.inverter.sandia/pvwatts()` |
| PR | IEC 61724 | E_AC / (H_poa × P_peak) |

## Critical Bugs (all fixed — DO NOT REGRESS)

### Bug 1: pd.Series(None) → NaN
- **File:** `core/energy.py:_electrical_model` (line ~283)
- **Symptom:** Annual yield = 0 for parametric modules
- **Cause:** `parametric_module()` sets `IL_ref=None`. In pd.Series, None→NaN.
  `nan is not None` is `True` → SDM branch entered with NaN → all output NaN.
- **Fix:**
  ```python
  il_ref = mp.get("IL_ref")
  sdm_available = has_sdm and il_ref is not None and pd.notna(il_ref) and ...
  ```

### Bug 2: pvwatts_dc keyword removed
- **File:** `core/energy.py:_electrical_model` (line ~312)
- **Cause:** `g_poa_effective` keyword removed in pvlib 0.13+
- **Fix:** `pvlib.pvsystem.pvwatts_dc(poa, temp_cell, pdc0, gamma)` (positional)

### Bug 3: PR > 100% using GHI
- **File:** `core/energy.py:run_simulation` (line ~167)
- **Cause:** POA > GHI for optimally tilted panels → PR > 100% with GHI denominator
- **Fix:** `pr = annual_yield / (poa_kwh * pk_kw)` (use POA per IEC 61724)

### Bug 4: gamma_r unit mismatch
- **File:** `core/system.py:parametric_module` (stores as %/°C, e.g. −0.40)
         `core/energy.py:_electrical_model` (converts: `if abs(gamma)>0.1: /=100`)
- **Convention:** gamma_r stored as %/°C; pvwatts_dc needs 1/°C. Conversion at use.

## Caching Strategy
- `@st.cache_resource`: `load_cec_modules()`, `load_cec_inverters()` (once per process)
- `@st.cache_data`: `run_simulation()`, `compute_orientation_grid()` (keyed on all args)
- `st.session_state["tmy_df"]`: TMY data (fetched on demand, survives reruns)
- `st.session_state["energy_grid"]`: Orientation sweep (behind "Run Sweep" button)

## Verification Baseline (do not break)
Berlin (52.5°N), 20 × 400W = 8 kWp CEC monocrystalline, S-facing 35°, Open-Meteo 2023:
- Annual yield: ~10,200 kWh
- Specific yield: ~1,275 kWh/kWp
- Performance Ratio: ~89.4%
- Capacity Factor: ~14.6%

## Key cfg Dict Keys (from render_sidebar)
`lat, lon, elevation_m, tilt_deg, panel_az_deg, albedo,`
`module_params (pd.Series), inverter_params (pd.Series), inverter_type (str),`
`n_modules, strings_per_inverter, n_inverters, loss_budget (LossBudget),`
`tilt_step, az_step, fetch_climate (bool)`

## Implementation Plan
See `.claude/plans/solar-app-plan.md` for the full original implementation plan.
Status: fully implemented.

## Decisions Made
- Tabs: Annual Summary / Orientation Optimizer / Monthly Breakdown / Daily Irradiance / Sun Path
- Metric bar: DC Peak | Annual Yield | Specific Yield | PR | CF | Avg Daily | Data Source
- Loss waterfall: horizontal bar chart (not Sankey) for readability
- Orientation sweep: nested loop (simple, cached) — vectorization is a future optimization
- PR definition: IEC 61724 vs POA (not GHI) — this is non-negotiable
