# Agent Prompt: SciComm Content — Educational Jupyter Notebook

## Your Role
You are working on the **SciComm Content** component of the Solarflower project.
Your task is to develop and maintain `notebook/solar_panel_power.ipynb` — an educational,
computationally illustrated article that derives solar panel power calculations from
first principles for a general audience.

## Design Guidelines

**You MUST follow the visual design specifications in:**
`.claude/shared/design-guidelines.md`

See also the implementation roadmap: `.claude/shared/design-roadmap.md`

Key points for the notebook:
- Use brand colors in matplotlib/plotly visualizations (amber `#F5A623`, blue `#2D7DD2`, green `#4CAF50`)
- Consistent color scheme across all charts
- Clean, minimal figure styling (remove unnecessary borders)
- Use `--amber` for sun/data highlights, `--blue` for comparison data, `--green` for optimal/reference lines
- Follow the matplotlib style example in Section 5.4 of the design guidelines

## Project Context

The Solarflower project has four components. You work on component 1:

1. **SciComm Notebook** (`notebook/solar_panel_power.ipynb`) — YOUR COMPONENT
2. **Web-App** (`solar-app/`) — production energy-advisor Streamlit app (complete)
3. **Website** (`website/`) — landing page linking all components
4. **Mobile-App** (`mobile-app/`) — on-site panel orientation helper

**Repository root:** `/home/rgutzen/01_PROJECTS/solarflower/`
**License:** AGPL-3.0-or-later (see `LICENSE`)
**Run environment:** `app-dev` conda env at `/home/rgutzen/miniforge3/envs/app-dev/`

## Educational Goals

The notebook must:
- Be accessible to a **general audience** (no PV engineering prerequisites)
- Guide the reader step-by-step through the **physical derivation** of solar panel yield
- Cover the full chain from solar geometry → irradiance → panel power → annual yield
- Include **interactive visualizations** (ipywidgets or plotly) where they aid understanding
- Follow the format of a **computational article**: prose, LaTeX equations, code, figures
- Use the **panel orientation** (tilt + azimuth) as the central free variable to illustrate

## What Already Exists

The notebook (`notebook/solar_panel_power.ipynb`) contains an existing derivation. Read it
thoroughly before making any changes. Key functions already defined:

- `solar_altitude_azimuth(doy, hour_utc, lat_deg, lon_deg)` → (alt_rad, az_rad)
  — uses spherical astronomy: declination, hour angle, solar position equations
- `panel_irradiance(DNI, DHI, GHI, altitude_rad, azimuth_rad, tilt_deg, panel_az_deg, albedo)` → G_T
  — beam + isotropic diffuse (Liu-Jordan) + ground-reflected
- `compute_annual_grid(lat, lon, elev, tilt_arr, az_arr, ...)` → energy_grid (kWh)
  — sweeps tilt × azimuth to find optimal orientation
- `compute_monthly_energy(...)` → monthly avg kWh/day
- Clear-sky model: Meinel 1976 DNI attenuation (Beer–Lambert through atmosphere)

## Physics to Cover (and the Progression)

Follow this derivation chain. Each section should explain WHY before HOW:

### 1. The Sun's Position
- Earth's orbital geometry: declination angle δ = 23.45° × sin(360/365 × (doy − 81))
- Hour angle ω: 15°/hour from solar noon
- Solar altitude: sin(α) = sin(φ)sin(δ) + cos(φ)cos(δ)cos(ω)
- Solar azimuth from altitude + hour angle
- Interactive: plot sun path for any lat/lon/day

### 2. Extraterrestrial Irradiance
- Solar constant G_sc ≈ 1361 W/m²
- Eccentricity correction: (r_0/r)² ≈ 1 + 0.033 cos(360° × doy/365)
- Normal-incidence extraterrestrial: G_0 = G_sc × (r_0/r)²

### 3. Atmospheric Attenuation → Clear-Sky DNI
- Beer–Lambert law through atmosphere
- Meinel 1976: DNI = G_0 × 0.7^(AM^0.678) where AM = 1/sin(α) (Kasten–Young)
- Derive diffuse: DHI ≈ 0.3 × (G_0 × sin(α) − DNI × sin(α))
- GHI = DNI × sin(α) + DHI
- Note: real data (PVGIS TMY) used in the web-app is far more accurate; this is for intuition

### 4. Plane-of-Array (POA) Irradiance
- Beam component: G_beam = DNI × cos(angle of incidence)
  - AOI = arccos(sin(α)cos(β) + cos(α)cos(γ_s − γ)sin(β))
  - β = panel tilt, γ = panel azimuth, γ_s = solar azimuth
- Isotropic sky diffuse (Liu-Jordan): G_diff = DHI × (1 + cos β)/2
- Ground-reflected: G_ground = GHI × albedo × (1 − cos β)/2
- Total POA: G_T = G_beam + G_diff + G_ground
- Interactive heatmap: G_T as function of tilt and azimuth for a chosen day

### 5. Panel Temperature
- Nominal Operating Cell Temperature (NOCT): T_cell = T_air + (NOCT − 20) × G_T/800
- Effect on power: P ~ P_STC × (G_T/1000) × [1 + γ(T_cell − 25)]
- γ ≈ −0.004/°C for monocrystalline silicon

### 6. Electrical Power Output
- STC: Pmax = Isc × Voc × FF (fill factor)
- Show I–V curve schematically (can be plotted from one-diode model)
- Practical: P = P_STC × (G_T/1000) × [1 + γ(T_cell − 25)]
- Note the full one-diode SDM (used in the web-app) for those who want to go deeper

### 7. Annual Yield Integration
- Integrate P over all daylight hours over the year
- Show the strong dependence on tilt and azimuth → optimal orientation
- Compare Northern vs Southern hemisphere (optimal azimuth flips)
- Monthly breakdown: seasonal variation

### 8. From Theory to Practice
- Real losses: soiling, LID, mismatch, wiring, inverter (~15–25% total)
- Real climate data vs clear-sky: PVGIS TMY (20+ year satellite synthesis)
- Point reader to the web-app for professional-grade calculations

## Coordinate Conventions (CRITICAL — be consistent)

- **Azimuth**: 0° = North, 90° = East, 180° = South, 270° = West (clockwise from above)
- **Tilt**: 0° = horizontal, 90° = vertical
- **Latitude**: positive = North, negative = South
- **Optimal orientation**: ~180° (South) for Northern hemisphere, ~0°/360° (North) for Southern

## Notebook Style Guide

- **Prose**: clear, friendly, no jargon without explanation. Write as if explaining to a curious
  non-physicist friend.
- **Equations**: use LaTeX in Markdown cells. Show derivation steps, not just results.
- **Code cells**: keep functions self-contained and readable. Add inline comments for non-obvious steps.
- **Figures**: every key equation should have a corresponding visualization. Use matplotlib
  (inline) or plotly. For interactive widgets use ipywidgets (`interact`, `interactive`).
- **Structure**: use Markdown headers (##, ###) to divide into clear sections. Add a brief
  summary at the end of each section.
- **Units**: always state units explicitly. SI throughout (W, W/m², kWh, K/°C, degrees).

## Notebook Environment

The `app-dev` conda environment has: numpy, pandas, matplotlib, plotly, pvlib, ipywidgets, scipy.
Use these freely. Do NOT add new dependencies without updating `requirements.txt`.

To launch:
```bash
/home/rgutzen/miniforge3/envs/app-dev/bin/jupyter notebook notebook/solar_panel_power.ipynb
```

## Key Numerical Sanity Checks

When showing annual yield calculations, verify results are physically plausible:
- Berlin (52.5°N), south-facing 35° tilt, 1 m² panel, η=20%: ~175–200 kWh/m²/yr
- Cape Town (33.9°S), north-facing 30° tilt: ~220–250 kWh/m²/yr
- Horizontal panel anywhere: always less than optimally tilted (except equatorial regions)
- Tilt = 0° (flat): yield is azimuth-independent (no preferred direction)

## License

All notebook content is AGPL-3.0-or-later. Add a note at the top of the notebook:
```
# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
```
(In the first code cell, or as a raw cell with SPDX comment.)

## Coordination Notes

- The web-app (`solar-app/`) implements a production-grade version of the same physics.
  Reference it as "for professional calculations, see the Solar Advisor app" but do NOT
  depend on it at runtime (the notebook must work standalone).
- Memory and plans are in `.claude/memory/MEMORY.md` and `.claude/plans/`.
- Do NOT modify files in `solar-app/`, `website/`, or `mobile-app/`.
