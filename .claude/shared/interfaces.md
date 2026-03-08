# Cross-Component Interfaces & Contracts

Defines what each component exposes to the others, and what each depends on.
All agents must respect these contracts when modifying their component.

---

## TMY DataFrame Schema

Used between `core/climate.py` and `core/energy.py`. Any consumer of TMY data
(including the mobile-app if it ever calls the web-app API) must expect:

```python
# 8760 rows (non-leap year), hourly UTC
# index: DatetimeIndex with tz=UTC, freq='1h', starting 2023-01-01
tmy_df.columns = ['ghi', 'dhi', 'dni', 'temp_air', 'wind_speed', 'pressure']
# Units:
#   ghi, dhi, dni   : W/m²
#   temp_air        : °C
#   wind_speed      : m/s
#   pressure        : Pa (note: Open-Meteo returns hPa, multiply by 100)
```

## Module Parameters Schema

`pd.Series` with the following key fields (not all required simultaneously):

```python
# Required for PVWatts fallback (parametric modules):
pdc0            # float, W — STC peak power
V_mp_ref        # float, V — MPP voltage at STC
I_mp_ref        # float, A — MPP current at STC
gamma_r         # float, %/°C — temp coefficient of Pmax (stored as e.g. -0.40)

# Required for full PVsyst one-diode SDM (CEC/PVsyst modules):
IL_ref          # float, A — photocurrent at STC (NaN for parametric)
I0_ref          # float, A — dark saturation current (NaN for parametric)
I_sc_ref        # float, A
alpha_sc        # float, A/°C
a_ref           # float — modified diode ideality
R_s             # float, Ω
R_sh_ref        # float, Ω
cells_in_series # int
```

**Detection logic:**
```python
# Use SDM only when IL_ref and I0_ref are present AND non-NaN:
sdm_available = (
    has_sdm                          # all structural keys present
    and pd.notna(mp.get("IL_ref"))   # NOT: mp.get("IL_ref") is not None
    and pd.notna(mp.get("I0_ref"))
)
```

## SimResult Fields

`dataclass` exported from `solar-app/core/energy.py`:

```python
SimResult:
    annual_yield_kwh        : float          # kWh/yr net AC
    specific_yield_kwh_kwp  : float          # kWh/kWp
    performance_ratio       : float          # 0–1, IEC 61724 vs POA
    capacity_factor         : float          # 0–1
    monthly_yield_kwh_day   : pd.Series      # avg kWh/day, index 1–12
    monthly_pr              : pd.Series      # PR by month, index 1–12
    hourly_poa              : pd.Series      # W/m² (8760 values)
    hourly_power_ac         : pd.Series      # W net AC (8760 values)
    loss_waterfall          : dict[str,float]# loss category → kWh lost
    peak_power_kw           : float          # DC array peak power
    data_source             : str            # human-readable source label
```

## LossBudget Fields

`dataclass` exported from `solar-app/core/losses.py`. All floats are fractions (0–1):

```python
LossBudget:
    iam_model   : str   = "physical"  # 'physical' or 'ashrae'
    soiling     : float = 0.02
    lid         : float = 0.015
    mismatch    : float = 0.01
    dc_wiring   : float = 0.015
    availability: float = 0.01
    ac_wiring   : float = 0.005
    transformer : float = 0.01
```

---

## Component URL Contracts

| Component | URL / Access | Notes |
|-----------|-------------|-------|
| Web-App | `http://localhost:8501` (local) | Streamlit; deploy to Streamlit Cloud for public |
| Notebook | `/home/rgutzen/01_PROJECTS/solarflower/notebook/solar_panel_power.ipynb` | Also on GitHub |
| GitHub | `https://github.com/rgutzen/solarflower` | Main repo |
| Website | `website/index.html` (local); TBD for deployment | Static HTML/CSS/JS |
| Mobile-App | `mobile-app/index.html` (PWA); same deployment as website | |

The website links to all other components. Treat these URLs as contracts:
changing them requires updating the website.

---

## `solar-app/core/` as a Shared Library

The `core/` modules have **no Streamlit dependency** (except `system.py` which uses
`@st.cache_resource` — wrap calls in try/except if used outside Streamlit context).

The mobile-app and website can import or call these modules if needed:
- `core/climate.py::fetch_tmy(lat, lon)` — pure function, returns TMY DataFrame
- `core/energy.py::run_simulation(...)` — returns SimResult
- `core/losses.py::LossBudget` — dataclass, importable
- `core/system.py::parametric_module(...)` — returns module pd.Series

**If building a REST API** (for mobile to call), wrap `run_simulation` and expose:
```
POST /api/simulate
Body: {lat, lon, tilt, azimuth, n_modules, pdc0_per_module, ...}
Returns: {annual_yield_kwh, specific_yield, pr, monthly_yield, ...}
```

---

## Optimal Orientation — Shared Formula

Used by both mobile-app (JS) and potentially by the notebook and website.
Documented here so all agents use the same formula:

```
# Approximate optimal tilt for annual energy maximization, fixed mount:
optimal_tilt_deg = 0.9 * abs(latitude_deg) + 3.1

# Valid range: latitudes 15°–65° N or S; accurate to ±2° vs full TMY sweep
# Source: regression fit against PVGIS TMY grid data

# Optimal azimuth:
optimal_az_deg = 180 if latitude_deg > 0 else 0   # South for N, North for S
```

For higher accuracy (latitude < 15° or > 65°, or coastal/complex terrain):
use the full `compute_orientation_grid()` from `solar-app/core/energy.py`.

---

## Cross-Component Data Flow

```
PVGIS API ──────────────────────────────────────────────────────────────────┐
                                                                             ↓
notebook/solar_panel_power.ipynb      ← educational derivation (standalone, no deps) │
                                                                             │
solar-app/                   ← production simulation engine                 │
  core/climate.py::fetch_tmy ←──────────────────────────────────────────────┘
  core/energy.py::run_simulation ─────────→ SimResult
                                                │
                              ┌─────────────────┘
                              ↓
  ui/charts.py (Plotly)    ← renders
  app.py (Streamlit)       ← orchestrates

website/                     ← links to all components; no runtime deps
  index.html               ← links to web-app URL, GitHub, notebook

mobile-app/                  ← standalone PWA; optional API call to web-app
  solar.js                 ← implements simplified optimal_tilt formula (above)
  compass.js               ← DeviceOrientationEvent sensor reading
```
