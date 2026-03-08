# Solarflower

**Understand, simulate, and optimize solar panel yield — from first principles to professional-grade calculations.**

Four open-source components covering the full learning and deployment journey:

| # | Component | What it does | Status |
|---|-----------|--------------|--------|
| 1 | [Solar Panel Power](notebook/) | Educational notebook — first-principles derivation | Complete |
| 2 | [Solar Advisor](solar-app/) | Professional PV yield simulator (web app) | Complete |
| 3 | [Website](website/) | Landing page linking all components | Complete |
| 4 | [Solar Advisor API](api/) | REST API for mobile integration | Complete |
| 5 | [Panel Compass](mobile-app/) | On-site orientation helper PWA | Complete |

---

## Component 1 — Solar Panel Power (Educational Notebook)

A step-by-step computational article that derives solar panel yield from first principles.
Covers solar geometry, atmospheric physics, POA irradiance, cell temperature models,
and annual energy integration — written for a general audience with interactive plots.

**Run locally:**

```bash
cd notebook
pip install jupyter pvlib numpy pandas matplotlib
jupyter notebook solar_panel_power.ipynb
```

---

## Component 2 — Solar Advisor (Web App)

Production-grade PV yield simulator for any location worldwide.

**Physics stack (PVsyst-equivalent):**
- Climate data: PVGIS TMY (20+ year satellite synthesis via EU JRC)
- Solar position: Ephemeris model
- Sky diffuse: Perez anisotropic model
- IAM: Physical (AR glass) or ASHRAE
- Cell temperature: Faiman model
- Electrical: PVsyst one-diode SDM or PVWatts fallback
- Inverter: CEC Sandia or PVWatts

**Features:**
- 15,000+ CEC modules and 3,000+ CEC inverters
- PVsyst `.pan` / `.ond` file import
- Vectorized orientation optimizer (tilt × azimuth sweep, ~5 s)
- Near-shading / horizon profile input (8-point compass)
- Annual loss waterfall (PVsyst-style)
- Monthly breakdown and daily irradiance explorer
- Sun path polar diagram with horizon overlay
- **Lifetime yield projection** (20–30 year degradation model)
- **Economics tab**: CAPEX, simple/discounted payback, NPV, IRR, LCOE
- CSV and JSON export

**Run locally:**

```bash
cd solar-app
pip install -r requirements.txt
streamlit run app.py
# Opens at http://localhost:8501
```

> **Conda environment (recommended):**
> ```bash
> conda create -n app-dev python=3.12
> conda activate app-dev
> pip install -r solar-app/requirements.txt
> cd solar-app && streamlit run app.py
> ```

**Dependencies:** Python 3.12, pvlib ≥ 0.11, streamlit ≥ 1.35, numpy ≥ 2.0, pandas ≥ 2.1, plotly ≥ 5.20, scipy ≥ 1.13, requests ≥ 2.31

---

## Component 3 — Website (Landing Page)

Static HTML/CSS/JS landing page linking all project components.

**Run locally:**

```bash
cd website
python -m http.server 8080
# Opens at http://localhost:8080
```

No build step required — plain HTML, CSS, and vanilla JS.

---

## Component 4 — Solar Advisor API (REST API)

Lightweight FastAPI service exposing PV yield estimates for the mobile app (and any other client).

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `POST` | `/api/estimate` | Yield estimate for a given location + orientation |

**Example request:**
```bash
curl -X POST https://your-api.onrender.com/api/estimate \
  -H "Content-Type: application/json" \
  -d '{"lat": 52.5, "lon": 13.4, "tilt_deg": 35, "azimuth_deg": 180, "peak_power_kwp": 8}'
```

**Run locally:**

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload
# Opens at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

**Deploy to Render / Railway:**
1. Connect your GitHub repo
2. Set root directory to `api/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

---

## Component 5 — Panel Compass (Mobile PWA)

On-site orientation helper PWA: place your phone face-up on the solar panel and get
real-time compass + tilt guidance toward the optimal orientation for your GPS location.

**Features:**
- Live yield estimation from device sensors (compass heading → azimuth, accelerometer → tilt)
- Circular yield gauge showing percentage of optimal output
- Visual guidance: zone arcs (±3° green, ±10° amber) on compass and tilt meter
- Directional arrows guiding toward optimal orientation
- Automatic GPS geolocation with reverse geocoding
- PVWatts-style yield model (GHI lookup × orientation factor × PR)
- Installable PWA with offline support (service worker + cache)
- Mobile-first design, no build step — plain HTML/CSS/JS

**Run locally:**

```bash
cd mobile-app
python -m http.server 8081
# Opens at http://localhost:8081
```

No dependencies — vanilla JavaScript ES modules, no framework, no bundler.

---

## Repository Layout

```
solarflower/
├── notebook/              Component 1 — educational Jupyter notebook
│   └── solar_panel_power.ipynb
├── solar-app/             Component 2 — Streamlit web app
│   ├── app.py
│   ├── requirements.txt
│   ├── core/
│   │   ├── climate.py     PVGIS TMY fetch + fallbacks
│   │   ├── system.py      CEC DB + PVsyst file parser
│   │   ├── energy.py      Full hourly simulation + vectorized orientation sweep
│   │   ├── losses.py      LossBudget, IAM, DC/AC loss chain, waterfall
│   │   ├── economics.py   CAPEX, NPV, IRR, LCOE
│   │   └── degradation.py Lifetime yield projection
│   └── ui/
│       ├── sidebar.py     All input controls
│       └── charts.py      Plotly figure builders
├── website/               Component 3 — static landing page
│   ├── index.html
│   ├── solar-advisor.html
│   ├── styles.css
│   └── assets/
├── api/                   Component 4 — FastAPI REST service
│   ├── main.py
│   ├── requirements.txt
│   ├── Procfile
│   └── core/              climate.py + losses.py (no Streamlit deps)
└── mobile-app/            Component 5 — Panel Compass PWA
    ├── index.html         Single-page app shell
    ├── app.js             Main orchestrator (geolocation → sensors → yield → UI)
    ├── solar.js           Pure JS solar calculations (yield, orientation factor)
    ├── compass.js         Device sensor abstraction (compass + tilt + smoothing)
    ├── styles.css         Mobile-first Solarflower design system
    ├── manifest.json      PWA manifest
    ├── sw.js              Service worker (cache-first offline)
    └── icons/             App icons (SVG + PNG)
```

---

## License

[AGPL-3.0-or-later](LICENSE) — free for personal, research, and educational use.
Commercial licensing available — see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).
Contact: robin.gutzen@outlook.com
