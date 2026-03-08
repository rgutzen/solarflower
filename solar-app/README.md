# Solar Advisor

Energy-advisor grade PV yield simulation web application.

Computes annual and monthly solar panel yield for any location worldwide,
using real-world climate data and a full PVsyst-equivalent physics chain.

## Features

- **PVGIS TMY climate data** — Typical Meteorological Year synthesized from
  20+ years of satellite observations (SARAH3/ERA5); Open-Meteo fallback
- **PVsyst-equivalent physics** — Perez anisotropic sky diffuse, Faiman
  thermal model, one-diode SDM electrical model, IAM correction
- **Full loss chain** — soiling, LID, mismatch, DC/AC wiring, inverter,
  availability; shown as an interactive waterfall chart
- **Module/inverter library** — searchable CEC database (~15 000 modules,
  ~3 000 inverters) or upload PVsyst `.pan`/`.ond` component files
- **Orientation optimizer** — tilt × azimuth heatmap showing annual yield
  across all orientations, with optimal point highlighted
- **5 interactive tabs** — Annual summary, Orientation optimizer, Monthly
  breakdown, Daily irradiance profile, Sun path diagram

## Quick Start

```bash
# From the repo root
cd solar-app

# Install dependencies (into any Python 3.11+ environment)
pip install -r requirements.txt

# Run
streamlit run app.py
```

Opens at `http://localhost:8501`.

## Using the app-dev environment

```bash
/home/rgutzen/miniforge3/envs/app-dev/bin/streamlit run app.py
```

## Physics stack

| Stage | Model | pvlib function |
|-------|-------|---------------|
| Climate data | PVGIS TMY | `pvlib.iotools.get_pvgis_tmy()` |
| Solar position | Ephemeris | `location.get_solarposition()` |
| Sky diffuse | Perez (anisotropic) | `irradiance.get_total_irradiance(model='perez')` |
| IAM | Physical (AR glass) | `pvlib.iam.physical()` |
| Cell temperature | Faiman | `pvlib.temperature.faiman()` |
| Electrical | PVsyst one-diode SDM | `calcparams_pvsyst()` + `singlediode()` |
| Inverter | CEC Sandia / PVWatts | `pvlib.inverter.sandia()` |
| PR definition | IEC 61724 | E_AC / (H_poa × P_peak) |

## Project structure

```
solar-app/
├── app.py              Main Streamlit entry point
├── requirements.txt
├── core/
│   ├── climate.py      PVGIS TMY fetch + Open-Meteo fallback
│   ├── system.py       CEC database, PVsyst .pan/.ond import, parametric module
│   ├── energy.py       Simulation pipeline: run_simulation(), compute_orientation_grid()
│   └── losses.py       LossBudget dataclass, IAM, DC/AC loss chain, waterfall builder
└── ui/
    ├── sidebar.py      All Streamlit input controls
    └── charts.py       Plotly figure builders
```

## License

AGPL-3.0 — see [LICENSE](../LICENSE).
Commercial licensing available — see [COMMERCIAL_LICENSE.md](../COMMERCIAL_LICENSE.md).

## See Also

- [Panel Compass](../mobile-app/) — on-site PWA for real-time panel alignment using phone sensors
