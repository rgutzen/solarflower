# Project Status Board

_Update this file whenever a component's status changes._
_Last updated: 2026-03-08_

---

## Component Status

| # | Component | Status | Blockers | Next action |
|---|-----------|--------|----------|-------------|
| 1 | SciComm Notebook | Functional draft | — | Add interactive widgets, extend with loss section |
| 2 | Web-App | **Complete + CSV/JSON export added** | — | REST API endpoint next (for mobile) |
| 3 | Website | **V1 + Solar Advisor page** | — | Deploy; add article.css/article.js |
| 4 | Mobile-App | **Complete** | — | Deploy; connect to API for server-side yield |

---

## Component 1 — SciComm Notebook

**Status:** Functional draft
**File:** `notebook/solar_panel_power.ipynb`

### What works
- Solar position calculation (declination, hour angle, altitude, azimuth)
- Clear-sky irradiance (Meinel 1976 DNI + Liu-Jordan isotropic diffuse)
- Panel irradiance (POA: beam + diffuse + ground-reflected)
- Annual energy grid (tilt × azimuth sweep)
- Monthly energy breakdown
- Orientation heatmap visualization

### Known gaps
- No interactive widgets (ipywidgets) for live parameter exploration
- No section on cell temperature effects
- No section on real-world losses (soiling, LID, etc.)
- No comparison with PVGIS TMY vs clear-sky model
- No link/pointer to the Solar Advisor web-app

### Physics models used
- DNI: Meinel 1976 (simplified; educational only)
- Diffuse: Liu-Jordan isotropic (simpler than Perez used in web-app)
- Temperature: NOCT model (not Faiman)

---

## Component 2 — Web-App (Solar Advisor)

**Status:** Complete, all features working
**Directory:** `solar-app/`

### What works
- PVGIS TMY data fetch with Open-Meteo + clear-sky fallback
- Full PVsyst-equivalent simulation pipeline
- 5 interactive tabs: Annual Summary, Orientation Optimizer, Monthly, Daily, Sun Path
- CEC database (15k modules, 3k inverters) + PVsyst .pan/.ond import + parametric
- Orientation grid sweep with heatmap
- Loss waterfall chart
- Persistent summary metrics bar

### Known gaps / enhancements (see tasks/backlog.md)
- No deployment guide (Streamlit Cloud)
- No REST API endpoint (needed for mobile)
- Orientation sweep is slow (nested loop, not vectorized)
- No site shading input

### Verification baseline (Berlin, 8 kWp, S-facing 35°)
- Annual yield: 9,500–11,000 kWh (depends on data source)
- Specific yield: 1,180–1,375 kWh/kWp
- Performance Ratio: 85–92%
- Capacity Factor: 13–16%

---

## Component 3 — Website

**Status:** V1 complete + Solar Advisor dedicated page
**Directory:** `website/`

### What works
- `index.html` — landing page with nav, hero, 4 component cards, open-source section, footer
- `styles.css` — full responsive design system, WCAG AA color contrast
- `main.js` — scroll reveal, nav state
- `article.html` — "From Sunlight to Watts" first-principles article with interactive charts
- `solar-advisor.html` — dedicated Solar Advisor page: feature grid, physics table, iframe embed, launch instructions
- `assets/logo.svg`, `assets/hero-illustration.svg`

### Known gaps
- `article.css` and `article.js` referenced by `article.html` not yet created
- No deployment (GitHub Pages / Netlify)
- No favicon PNG fallback

---

## Component 4 — Mobile-App (Panel Compass)

**Status:** Not started
**Directory:** `mobile-app/` (does not exist yet)

### Planned
- PWA (Progressive Web App) — no app store needed
- Geolocation → compute optimal tilt + azimuth
- Live compass (DeviceOrientationAbsoluteEvent)
- Live tilt meter (DeviceOrientationEvent.beta)
- On-target confirmation when within ±3°
- Offline support (service worker)
- Optional: quick yield estimate using simplified formula

### Dependencies
- Requires `shared/interfaces.md::Optimal Orientation Formula`
- Optional: requires web-app REST API (not yet built)

---

## Cross-Component Dependencies

```
website ──links to──→ web-app (URL contract)
website ──links to──→ notebook (GitHub URL)
website ──links to──→ mobile-app (URL contract)
mobile-app ──optional API call──→ web-app (REST endpoint not yet built)
mobile-app ──implements──→ shared optimal_tilt formula
notebook ──references (prose only)──→ web-app (no runtime dependency)
```
