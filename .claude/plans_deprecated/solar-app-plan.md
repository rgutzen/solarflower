# Plan: Solar Panel Power Web Application (Energy-Advisor Grade)

## Context
Build a production web app in `solar-app/` alongside the educational notebook. Target accuracy: bankable yield assessment matching PVsyst/SAM quality. Stack: **PVGIS TMY + pvlib** (which implements PVsyst's internal models) + PVsyst `.pan`/`.ond` file import support.

**Why not direct PVsyst integration**: PVsyst is a Windows-only GUI app with no public API or Python SDK. However, pvlib implements the identical physics (one-diode model, Faiman thermal, Perez diffuse, IAM) and can read PVsyst's `.pan`/`.ond` component export files — giving full PVsyst-equivalent accuracy.

## Architecture

```
solarflower/
├── solar_panel_power.ipynb    (unchanged)
└── solar-app/
    ├── app.py                 (Streamlit entry point)
    ├── core/
    │   ├── climate.py         (PVGIS TMY + Open-Meteo fallback)
    │   ├── system.py          (module/inverter DB lookup + .pan/.ond import)
    │   ├── energy.py          (full yield simulation pipeline)
    │   └── losses.py          (full PVsyst-style loss chain)
    ├── ui/
    │   ├── sidebar.py         (all controls: location, system, losses)
    │   └── charts.py          (Plotly figures)
    └── requirements.txt
```

## Physics Stack (PVsyst-equivalent, all via pvlib)

| Step | pvlib function | PVsyst equivalent |
|------|---------------|-------------------|
| Solar position | `pvlib.solarposition.get_solarposition()` | Astronomical module |
| Clear-sky | `pvlib.clearsky.ineichen()` + Linke turbidity | Meteo clear-sky |
| Sky diffuse | `pvlib.irradiance.perez()` | Perez model |
| POA transposition | `pvlib.irradiance.get_total_irradiance(model='perez')` | Plane transposition |
| IAM (angle correction) | `pvlib.iam.physical()` (AR coating) or `pvlib.iam.ashrae()` | IAM factor |
| Thermal model | `pvlib.temperature.faiman()` | Faiman (PVsyst default) |
| Electrical model | `pvlib.pvsystem.calcparams_pvsyst()` + `pvlib.pvsystem.singlediode()` | One-diode SDM |
| Inverter | `pvlib.inverter.sandia()` or `pvlib.inverter.pvwatts()` | Inverter model |

## Implementation Status: COMPLETE

All files written and verified:
- `solar-app/requirements.txt` — streamlit, pvlib, numpy, pandas, plotly, requests, scipy
- `solar-app/core/climate.py` — PVGIS TMY primary, Open-Meteo fallback, clear-sky ultimate fallback
- `solar-app/core/system.py` — CEC database + PVsyst .pan/.ond import + parametric module
- `solar-app/core/losses.py` — LossBudget dataclass, IAM, DC+AC loss chain, waterfall builder
- `solar-app/core/energy.py` — run_simulation, compute_orientation_grid, SimResult dataclass
- `solar-app/ui/sidebar.py` — Location, Orientation, PV System, Loss Budget, Sweep controls
- `solar-app/ui/charts.py` — Waterfall, monthly summary, orientation heatmap, daily irradiance, sun path
- `solar-app/app.py` — 5-tab Streamlit layout with persistent summary metrics bar

## Key Bugs Fixed During Implementation

1. **NaN propagation from pd.Series(None)**: `None` stored in `pd.Series` becomes `nan`.
   `nan is not None` is `True` in Python, so the condition to use the full one-diode SDM was
   wrongly triggered for parametric modules (which have `IL_ref=None`). Fix: use `pd.notna()`.
   File: `core/energy.py`, function `_electrical_model`.

2. **Deprecated pvlib parameter name**: `pvwatts_dc(g_poa_effective=...)` → use positional args
   since `g_poa_effective` renamed to `effective_irradiance` in pvlib 0.13+.

3. **PR calculated against GHI instead of POA**: Gave PR > 100% for optimized tilts. Fixed to
   use POA irradiance (IEC 61724 standard for tilted systems).

## Run

```bash
cd solar-app
pip install -r requirements.txt   # or: mamba run -n app-dev pip install -r requirements.txt
streamlit run app.py
```

## Verification Results (Berlin, 52.5°N, 20×400W = 8 kWp, S-facing 35°)

- Annual yield: ~10,200 kWh (Open-Meteo 2023, a sunny year)
- Specific yield: ~1,275 kWh/kWp
- Performance Ratio: ~89.4% (IEC 61724, vs POA)
- Capacity Factor: ~14.6%
- Loss waterfall: soiling 230 / LID 169 / mismatch 111 / DC wire 165 / inverter 386 / ... kWh
