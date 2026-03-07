// SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Solarflower — Article: From Sunlight to Watts
 *
 * Solar physics engine (ported from Python notebook) + Plotly.js visualizations
 * + interactive explorer dashboard.
 *
 * All computations run client-side. No data is sent anywhere.
 */

(function () {
  "use strict";

  // =====================================================================
  // CONSTANTS
  // =====================================================================
  const L_SUN = 3.828e26;   // Solar luminosity [W]
  const AU    = 1.496e11;   // 1 Astronomical Unit [m]
  const S0    = 1361.0;     // Solar constant [W/m²]

  // Colors matching the solarpunk design
  const SUN_COLOR   = "#F5A623";
  const SKY_COLOR   = "#4A90D9";
  const EARTH_COLOR = "#27AE60";
  const PANEL_COLOR = "#2ECC71";
  const INK_COLOR   = "#1B2E1B";
  const INK_LIGHT   = "#3D5240";
  const GREY_COLOR  = "#5C6F7A";

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun",
                        "Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTH_DAYS   = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Plotly layout defaults
  const PLOTLY_CONFIG = {
    responsive: true,
    displayModeBar: false,
    displaylogo: false,
  };

  const LAYOUT_BASE = {
    font: { family: '"Inter", "Segoe UI", system-ui, sans-serif', color: INK_LIGHT },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { t: 50, r: 30, b: 50, l: 60 },
    hoverlabel: { bgcolor: "#fff", bordercolor: "#ccc", font: { size: 12 } },
  };

  // =====================================================================
  // UTILITY: array generation
  // =====================================================================
  function linspace(start, end, n) {
    const arr = new Float64Array(n);
    const step = (end - start) / (n - 1);
    for (let i = 0; i < n; i++) arr[i] = start + i * step;
    return arr;
  }

  function arange(start, end, step) {
    const n = Math.ceil((end - start) / step);
    const arr = new Float64Array(n);
    for (let i = 0; i < n; i++) arr[i] = start + i * step;
    return arr;
  }

  function deg2rad(d) { return d * Math.PI / 180; }
  function rad2deg(r) { return r * 180 / Math.PI; }

  // =====================================================================
  // SOLAR PHYSICS ENGINE
  // =====================================================================

  function dayAngle(doy) {
    return 2 * Math.PI * (doy - 1) / 365.25;
  }

  function eccentricityCorrection(doy) {
    const B = dayAngle(doy);
    return 1.000110 + 0.034221 * Math.cos(B) + 0.001280 * Math.sin(B)
           + 0.000719 * Math.cos(2*B) + 0.000077 * Math.sin(2*B);
  }

  function solarDeclination(doy) {
    const B = dayAngle(doy);
    return 0.006918
           - 0.399912 * Math.cos(B)   + 0.070257 * Math.sin(B)
           - 0.006758 * Math.cos(2*B) + 0.000907 * Math.sin(2*B)
           - 0.002697 * Math.cos(3*B) + 0.001480 * Math.sin(3*B);
  }

  function equationOfTime(doy) {
    const B = dayAngle(doy);
    return 229.18 * (0.000075 + 0.001868*Math.cos(B) - 0.032077*Math.sin(B)
                     - 0.014615*Math.cos(2*B) - 0.04089*Math.sin(2*B));
  }

  function solarAltitudeAzimuth(doy, hourUtc, latDeg, lonDeg) {
    const delta = solarDeclination(doy);
    const phi = deg2rad(latDeg);
    const ET = equationOfTime(doy);
    const LSM = Math.round(lonDeg / 15.0) * 15.0;
    const tSolar = hourUtc + ET / 60.0 + (lonDeg - LSM) / 15.0;
    const omega = deg2rad(15.0 * (tSolar - 12.0));

    const sinAlt = Math.sin(phi) * Math.sin(delta)
                   + Math.cos(phi) * Math.cos(delta) * Math.cos(omega);
    const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const cosAlt = Math.cos(altitude) + 1e-12;
    const sinAz = Math.cos(delta) * Math.sin(omega) / cosAlt;
    const cosAz = (Math.sin(delta) * Math.cos(phi)
                   - Math.cos(delta) * Math.sin(phi) * Math.cos(omega)) / cosAlt;
    let azimuth = Math.atan2(sinAz, cosAz);
    if (azimuth < 0) azimuth += 2 * Math.PI;

    return { altitude, azimuth };
  }

  function airMass(altitudeRad, elevationM) {
    elevationM = elevationM || 0;
    const altDeg = rad2deg(altitudeRad);
    if (altDeg <= 0) return Infinity;
    const denom = Math.sin(altitudeRad)
                  + 0.50572 * Math.pow(Math.max(altDeg + 6.07995, 0.01), -1.6364);
    return (1.0 / denom) * Math.exp(-elevationM / 8435.0);
  }

  function clearSky(Gext, altitudeRad, elevationM) {
    elevationM = elevationM || 0;
    if (altitudeRad <= 0) return { DNI: 0, DHI: 0, GHI: 0 };
    const AM = Math.min(airMass(altitudeRad, elevationM), 38.0);
    const DNI = Gext * Math.pow(0.7, Math.pow(AM, 0.678));
    const DHI = 0.1 * Gext * Math.sin(altitudeRad);
    const GHI = DNI * Math.sin(altitudeRad) + DHI;
    return { DNI, DHI, GHI };
  }

  function panelIrradiance(DNI, DHI, GHI, altRad, azRad, tiltDeg, panelAzDeg, albedo) {
    albedo = albedo || 0.20;
    if (altRad <= 0) return 0;
    const beta = deg2rad(tiltDeg);
    const gamma = deg2rad(panelAzDeg);
    let cosTheta = Math.sin(altRad) * Math.cos(beta)
                   + Math.cos(altRad) * Math.sin(beta) * Math.cos(azRad - gamma);
    cosTheta = Math.max(0, Math.min(1, cosTheta));
    const Gdirect = DNI * cosTheta;
    const Gsky    = DHI * (1.0 + Math.cos(beta)) / 2.0;
    const Gground = GHI * albedo * (1.0 - Math.cos(beta)) / 2.0;
    return Gdirect + Gsky + Gground;
  }

  // --- Annual energy computation (vectorised over days x hours) ---
  function computeAnnualGrid(latDeg, lonDeg, elevM, tiltArr, azArr, areaM2, efficiency, albedo, dt) {
    dt = dt || 1.0;
    const hours = [];
    for (let h = dt/2; h < 24; h += dt) hours.push(h);
    const nDays = 365;
    const nHours = hours.length;

    // Pre-compute solar position + irradiance for all (day, hour)
    const alt   = new Float64Array(nDays * nHours);
    const az    = new Float64Array(nDays * nHours);
    const DNI_a = new Float64Array(nDays * nHours);
    const DHI_a = new Float64Array(nDays * nHours);
    const GHI_a = new Float64Array(nDays * nHours);

    for (let d = 0; d < nDays; d++) {
      const doy = d + 1;
      const Gext = S0 * eccentricityCorrection(doy);
      for (let hi = 0; hi < nHours; hi++) {
        const idx = d * nHours + hi;
        const sp = solarAltitudeAzimuth(doy, hours[hi], latDeg, lonDeg);
        alt[idx] = sp.altitude;
        az[idx]  = sp.azimuth;
        const cs = clearSky(Gext, sp.altitude, elevM);
        DNI_a[idx] = cs.DNI;
        DHI_a[idx] = cs.DHI;
        GHI_a[idx] = cs.GHI;
      }
    }

    const nTilt = tiltArr.length;
    const nAz   = azArr.length;
    const energy = new Float64Array(nTilt * nAz);

    for (let ti = 0; ti < nTilt; ti++) {
      const beta = deg2rad(tiltArr[ti]);
      const cosBeta = Math.cos(beta);
      const sinBeta = Math.sin(beta);
      const skyFactor = (1 + cosBeta) / 2;
      const gndFactor = albedo * (1 - cosBeta) / 2;

      for (let ai = 0; ai < nAz; ai++) {
        const gamma = deg2rad(azArr[ai]);
        let sum = 0;
        for (let idx = 0; idx < nDays * nHours; idx++) {
          if (alt[idx] <= 0) continue;
          let cosTheta = Math.sin(alt[idx]) * cosBeta
                         + Math.cos(alt[idx]) * sinBeta * Math.cos(az[idx] - gamma);
          cosTheta = Math.max(0, Math.min(1, cosTheta));
          const GT = DNI_a[idx] * cosTheta + DHI_a[idx] * skyFactor + GHI_a[idx] * gndFactor;
          sum += GT;
        }
        energy[ti * nAz + ai] = areaM2 * efficiency * sum * dt / 1000;
      }
    }

    return { energy, nTilt, nAz };
  }

  function computeMonthlyEnergy(latDeg, lonDeg, elevM, tiltDeg, panelAzDeg, areaM2, efficiency, albedo, dt) {
    dt = dt || 1.0;
    const boundaries = [1,32,60,91,121,152,182,213,244,274,305,335,366];
    const monthly = new Float64Array(12);
    const hours = [];
    for (let h = dt/2; h < 24; h += dt) hours.push(h);

    for (let m = 0; m < 12; m++) {
      let sum = 0;
      for (let doy = boundaries[m]; doy < boundaries[m+1]; doy++) {
        const Gext = S0 * eccentricityCorrection(doy);
        for (const h of hours) {
          const sp = solarAltitudeAzimuth(doy, h, latDeg, lonDeg);
          const cs = clearSky(Gext, sp.altitude, elevM);
          const GT = panelIrradiance(cs.DNI, cs.DHI, cs.GHI, sp.altitude, sp.azimuth,
                                     tiltDeg, panelAzDeg, albedo);
          sum += areaM2 * efficiency * GT;
        }
      }
      monthly[m] = sum * dt / 1000;
    }
    return monthly;
  }

  // =====================================================================
  // CHART RENDERING
  // =====================================================================

  function waitForPlotly(cb) {
    if (typeof Plotly !== "undefined") {
      cb();
    } else {
      setTimeout(() => waitForPlotly(cb), 100);
    }
  }

  // ---- Step 1: Inverse-Square Law ----
  function renderInverseSquare() {
    const el = document.getElementById("chart-inverse-square");
    if (!el) return;

    const dAU = linspace(0.3, 2.2, 400);
    const irrad = Array.from(dAU, d => L_SUN / (4 * Math.PI * Math.pow(d * AU, 2)));

    const planets = [
      { name: "Venus", dist: 0.723, color: "orange" },
      { name: "Earth", dist: 1.000, color: "dodgerblue" },
      { name: "Mars",  dist: 1.524, color: "tomato" },
    ];

    const traces = [{
      x: Array.from(dAU),
      y: irrad,
      mode: "lines",
      name: "I = L☉ / (4π d²)",
      line: { color: SUN_COLOR, width: 3 },
      hovertemplate: "Distance: %{x:.2f} AU<br>Irradiance: %{y:.0f} W/m²<extra></extra>",
    }];

    for (const p of planets) {
      const I = L_SUN / (4 * Math.PI * Math.pow(p.dist * AU, 2));
      traces.push({
        x: [p.dist], y: [I],
        mode: "markers+text",
        name: `${p.name}  (${I.toFixed(0)} W/m²)`,
        marker: { color: p.color, size: 12, line: { width: 1, color: "#fff" } },
        text: [p.name],
        textposition: "top right",
        textfont: { color: p.color, size: 12 },
        hovertemplate: `${p.name}<br>${p.dist} AU<br>${I.toFixed(0)} W/m²<extra></extra>`,
      });
    }

    Plotly.newPlot(el, traces, {
      ...LAYOUT_BASE,
      title: { text: "Inverse-Square Law: Irradiance vs Distance from the Sun", font: { size: 14 } },
      xaxis: { title: "Distance from the Sun [AU]", range: [0.3, 2.2], gridcolor: "rgba(0,0,0,0.06)" },
      yaxis: { title: "Irradiance [W/m²]", gridcolor: "rgba(0,0,0,0.06)" },
      showlegend: true,
      legend: { x: 0.55, y: 0.95, bgcolor: "rgba(255,255,255,0.85)", bordercolor: "rgba(0,0,0,0.1)", borderwidth: 1 },
    }, PLOTLY_CONFIG);
  }

  // ---- Step 2: ETR over the year ----
  function renderETR() {
    const el = document.getElementById("chart-etr");
    if (!el) return;

    const doy = arange(1, 366, 1);
    const Gext = Array.from(doy, d => S0 * eccentricityCorrection(d));
    const E0   = Array.from(doy, d => eccentricityCorrection(d));

    // Find perihelion / aphelion
    let maxG = 0, minG = Infinity, maxI = 0, minI = 0;
    Gext.forEach((g, i) => {
      if (g > maxG) { maxG = g; maxI = i; }
      if (g < minG) { minG = g; minI = i; }
    });

    const traces = [{
      x: Array.from(doy),
      y: Gext,
      mode: "lines",
      name: "Extraterrestrial Irradiance",
      line: { color: SUN_COLOR, width: 3 },
      hovertemplate: "Day %{x}<br>ETR: %{y:.1f} W/m²<extra></extra>",
    }, {
      x: Array.from(doy),
      y: Array(365).fill(S0),
      mode: "lines",
      name: `Mean S₀ = ${S0} W/m²`,
      line: { color: GREY_COLOR, width: 1.5, dash: "dash" },
      hoverinfo: "skip",
    }, {
      x: [doy[maxI]], y: [maxG],
      mode: "markers+text",
      name: `Perihelion (${maxG.toFixed(0)} W/m²)`,
      marker: { color: "crimson", size: 10 },
      text: ["Perihelion (Jan)"],
      textposition: "top right",
      textfont: { color: "crimson", size: 11 },
      hovertemplate: `Perihelion<br>Day ${doy[maxI]}<br>${maxG.toFixed(1)} W/m²<extra></extra>`,
    }, {
      x: [doy[minI]], y: [minG],
      mode: "markers+text",
      name: `Aphelion (${minG.toFixed(0)} W/m²)`,
      marker: { color: "steelblue", size: 10 },
      text: ["Aphelion (Jul)"],
      textposition: "bottom left",
      textfont: { color: "steelblue", size: 11 },
      hovertemplate: `Aphelion<br>Day ${doy[minI]}<br>${minG.toFixed(1)} W/m²<extra></extra>`,
    }];

    Plotly.newPlot(el, traces, {
      ...LAYOUT_BASE,
      title: { text: "Extraterrestrial Irradiance Over the Year", font: { size: 14 } },
      xaxis: {
        title: "Day of Year",
        tickvals: MONTH_DAYS,
        ticktext: MONTH_LABELS,
        range: [1, 365],
        gridcolor: "rgba(0,0,0,0.06)",
      },
      yaxis: { title: "ETR [W/m²]", range: [1300, 1420], gridcolor: "rgba(0,0,0,0.06)" },
      showlegend: true,
      legend: { x: 0.35, y: 1.02, orientation: "h", bgcolor: "rgba(255,255,255,0.85)" },
    }, PLOTLY_CONFIG);
  }

  // ---- Step 3: Solar Declination ----
  function renderDeclination() {
    const el = document.getElementById("chart-declination");
    if (!el) return;

    const doy = arange(1, 366, 1);
    const decAccurate = Array.from(doy, d => rad2deg(solarDeclination(d)));
    const decSimple   = Array.from(doy, d => {
      const psi = deg2rad(360 / 365.25 * (d - 81));
      return 23.44 * Math.sin(psi);
    });

    const traces = [{
      x: Array.from(doy), y: decAccurate,
      mode: "lines",
      name: "Spencer (1971) — used here",
      line: { color: SUN_COLOR, width: 3 },
      hovertemplate: "Day %{x}<br>δ = %{y:.2f}°<extra></extra>",
    }, {
      x: Array.from(doy), y: decSimple,
      mode: "lines",
      name: "Simple sinusoidal approx.",
      line: { color: GREY_COLOR, width: 1.5, dash: "dash" },
      hovertemplate: "Day %{x}<br>δ ≈ %{y:.2f}°<extra></extra>",
    }];

    // Key dates
    const keyDates = [
      { doy: 80, label: "Spring equinox", color: "green" },
      { doy: 172, label: "Summer solstice", color: "crimson" },
      { doy: 265, label: "Autumn equinox", color: "green" },
      { doy: 355, label: "Winter solstice", color: "steelblue" },
    ];

    const shapes = keyDates.map(d => ({
      type: "line", x0: d.doy, x1: d.doy, y0: -30, y1: 30,
      line: { color: d.color, width: 1, dash: "dot" },
    }));

    const annotations = keyDates.map(d => ({
      x: d.doy, y: -28, text: d.label,
      showarrow: false, font: { color: d.color, size: 10 },
    }));

    Plotly.newPlot(el, traces, {
      ...LAYOUT_BASE,
      title: { text: "Solar Declination Over the Year", font: { size: 14 } },
      xaxis: {
        title: "Day of Year",
        tickvals: MONTH_DAYS,
        ticktext: MONTH_LABELS,
        range: [1, 365],
        gridcolor: "rgba(0,0,0,0.06)",
      },
      yaxis: { title: "Declination δ [°]", range: [-32, 32], gridcolor: "rgba(0,0,0,0.06)" },
      showlegend: true,
      legend: { x: 0.5, y: 1.02, orientation: "h", bgcolor: "rgba(255,255,255,0.85)" },
      shapes,
      annotations,
    }, PLOTLY_CONFIG);
  }

  // ---- Step 4: Sun Path Diagrams ----
  function renderSunPaths() {
    const configs = [
      { el: "chart-sunpath-berlin",   lat: 51,  name: "Berlin (51°N)" },
      { el: "chart-sunpath-equator",  lat: 0,   name: "Equator (0°)" },
      { el: "chart-sunpath-capetown", lat: -33, name: "Cape Town (33°S)" },
    ];

    const seasons = [
      { doy: 172, label: "Summer solstice (Jun 21)", color: "crimson", dash: "solid" },
      { doy: 80,  label: "Equinox (Mar 20)",         color: "green",   dash: "dash" },
      { doy: 355, label: "Winter solstice (Dec 21)", color: "steelblue", dash: "dot" },
    ];

    const hours = linspace(0, 24, 1440);

    for (const cfg of configs) {
      const el = document.getElementById(cfg.el);
      if (!el) continue;

      const traces = [];

      for (const s of seasons) {
        const theta = [];
        const r = [];

        for (let i = 0; i < hours.length; i++) {
          const sp = solarAltitudeAzimuth(s.doy, hours[i], cfg.lat, 0);
          if (sp.altitude > 0) {
            theta.push(rad2deg(sp.azimuth));
            r.push(90 - rad2deg(sp.altitude));
          }
        }

        if (theta.length > 0) {
          traces.push({
            type: "scatterpolar",
            theta, r,
            mode: "lines",
            name: s.label,
            line: { color: s.color, width: 2, dash: s.dash },
            hovertemplate: "Az: %{theta:.1f}°<br>Alt: %{customdata:.1f}°<extra></extra>",
            customdata: r.map(ri => 90 - ri),
          });
        }
      }

      Plotly.newPlot(el, traces, {
        ...LAYOUT_BASE,
        title: { text: cfg.name, font: { size: 13 } },
        margin: { t: 50, r: 40, b: 30, l: 40 },
        polar: {
          angularaxis: {
            direction: "clockwise",
            rotation: 90,
            tickvals: [0, 90, 180, 270],
            ticktext: ["N", "E", "S", "W"],
          },
          radialaxis: {
            range: [0, 90],
            tickvals: [10, 30, 60, 90],
            ticktext: ["80°", "60°", "30°", "0°"],
            showline: false,
          },
        },
        showlegend: cfg.lat === 0,
        legend: { x: 0.0, y: -0.25, orientation: "h", font: { size: 10 } },
      }, PLOTLY_CONFIG);
    }
  }

  // ---- Step 5: Atmosphere ----
  function renderAtmosphere() {
    const el = document.getElementById("chart-atmosphere");
    if (!el) return;

    const altArr = linspace(1, 90, 300);
    const GextNoon = S0 * 1.01;

    const elevations = [
      { h: 0,    color: "navy",      name: "Sea level" },
      { h: 1000, color: SKY_COLOR,   name: "1000 m" },
      { h: 2500, color: "lightblue", name: "2500 m" },
    ];

    const traces = [];

    // Air Mass traces
    for (const e of elevations) {
      const am = Array.from(altArr, a => {
        const v = airMass(deg2rad(a), e.h);
        return v > 12 ? null : v;
      });
      traces.push({
        x: am, y: Array.from(altArr),
        mode: "lines",
        name: `AM — ${e.name}`,
        line: { color: e.color, width: 2.5 },
        hovertemplate: `AM = %{x:.2f}<br>Alt = %{y:.1f}°<extra>${e.name}</extra>`,
        xaxis: "x", yaxis: "y",
      });
    }

    // DNI traces
    for (const e of elevations) {
      const dni = Array.from(altArr, a => {
        const cs = clearSky(GextNoon, deg2rad(a), e.h);
        return cs.DNI;
      });
      traces.push({
        x: dni, y: Array.from(altArr),
        mode: "lines",
        name: `DNI — ${e.name}`,
        line: { color: e.color, width: 2.5 },
        hovertemplate: `DNI = %{x:.0f} W/m²<br>Alt = %{y:.1f}°<extra>${e.name}</extra>`,
        xaxis: "x2", yaxis: "y2",
        showlegend: false,
      });
    }

    // GHI sea level
    const ghi = Array.from(altArr, a => clearSky(GextNoon, deg2rad(a), 0).GHI);
    traces.push({
      x: ghi, y: Array.from(altArr),
      mode: "lines",
      name: "GHI (sea level)",
      line: { color: INK_COLOR, width: 1.5, dash: "dash" },
      xaxis: "x2", yaxis: "y2",
      showlegend: false,
      hovertemplate: "GHI = %{x:.0f} W/m²<br>Alt = %{y:.1f}°<extra></extra>",
    });

    Plotly.newPlot(el, traces, {
      ...LAYOUT_BASE,
      title: { text: "Atmospheric Effects on Solar Irradiance", font: { size: 14 } },
      grid: { rows: 1, columns: 2, pattern: "independent" },
      xaxis:  { title: "Air Mass AM", range: [0, 12], domain: [0, 0.45], gridcolor: "rgba(0,0,0,0.06)" },
      yaxis:  { title: "Solar altitude α [°]", range: [1, 90], gridcolor: "rgba(0,0,0,0.06)" },
      xaxis2: { title: "Irradiance [W/m²]", range: [0, 1420], domain: [0.55, 1], gridcolor: "rgba(0,0,0,0.06)" },
      yaxis2: { title: "Solar altitude α [°]", range: [1, 90], gridcolor: "rgba(0,0,0,0.06)" },
      showlegend: true,
      legend: { x: 0.0, y: 1.15, orientation: "h", font: { size: 10 }, bgcolor: "rgba(255,255,255,0.85)" },
      margin: { t: 70, r: 30, b: 50, l: 60 },
    }, PLOTLY_CONFIG);
  }

  // ---- Step 6: Panel Irradiance ----
  function renderPanelIrradiance() {
    const el = document.getElementById("chart-panel-irradiance");
    if (!el) return;

    const hoursDay = linspace(4, 20, 500);
    const doyEq = 172;
    const latDemo = 48, lonDemo = 11;

    const orientations = [
      { tilt: 0,  az: 180, color: GREY_COLOR,    name: "Horizontal (β=0°)", dash: "solid" },
      { tilt: 30, az: 180, color: "crimson",      name: "30° tilt, South",   dash: "solid" },
      { tilt: 30, az: 90,  color: "steelblue",    name: "30° tilt, East",    dash: "dash" },
      { tilt: 30, az: 270, color: "orange",        name: "30° tilt, West",    dash: "dashdot" },
      { tilt: 90, az: 180, color: EARTH_COLOR,     name: "Vertical, South",   dash: "dot" },
    ];

    const traces = [];

    for (const o of orientations) {
      const GT = Array.from(hoursDay, h => {
        const sp = solarAltitudeAzimuth(doyEq, h, latDemo, lonDemo);
        const Gext = S0 * eccentricityCorrection(doyEq);
        const cs = clearSky(Gext, sp.altitude, 0);
        return panelIrradiance(cs.DNI, cs.DHI, cs.GHI, sp.altitude, sp.azimuth, o.tilt, o.az);
      });

      traces.push({
        x: Array.from(hoursDay),
        y: GT,
        mode: "lines",
        name: o.name,
        line: { color: o.color, width: 2.5, dash: o.dash },
        hovertemplate: `%{y:.0f} W/m² at %{x:.1f}h<extra>${o.name}</extra>`,
      });
    }

    Plotly.newPlot(el, traces, {
      ...LAYOUT_BASE,
      title: { text: "Panel Irradiance Over a Day (Munich, June 21)", font: { size: 14 } },
      xaxis: { title: "Hour (UTC)", range: [4, 20], gridcolor: "rgba(0,0,0,0.06)" },
      yaxis: { title: "In-plane irradiance G_T [W/m²]", gridcolor: "rgba(0,0,0,0.06)" },
      showlegend: true,
      legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.85)", bordercolor: "rgba(0,0,0,0.1)", borderwidth: 1 },
    }, PLOTLY_CONFIG);
  }

  // ---- Step 7: Power output ----
  function renderPower() {
    const el = document.getElementById("chart-power");
    if (!el) return;

    const AREA = 10, ETA_STC = 0.20, GAMMA_T = 0.004, NOCT = 45, T_AMB = 20;
    const doyDemo = 172, latDemo = 48, lonDemo = 11, tiltDemo = 35;

    const hours = linspace(3, 21, 500);
    const pFixed = [], pTemp = [], hArr = [];

    for (let i = 0; i < hours.length; i++) {
      const h = hours[i];
      hArr.push(h);
      const sp = solarAltitudeAzimuth(doyDemo, h, latDemo, lonDemo);
      const Gext = S0 * eccentricityCorrection(doyDemo);
      const cs = clearSky(Gext, sp.altitude, 0);
      const GT = panelIrradiance(cs.DNI, cs.DHI, cs.GHI, sp.altitude, sp.azimuth, tiltDemo, 180);

      const Pf = AREA * ETA_STC * GT / 1000;
      const Tcell = T_AMB + (NOCT - 20) / 800 * GT;
      const etaT = ETA_STC * (1 - GAMMA_T * (Tcell - 25));
      const Pt = AREA * etaT * GT / 1000;

      pFixed.push(Pf);
      pTemp.push(Pt);
    }

    // Compute daily energy (rough trapezoidal)
    const dt = (21 - 3) / 499;
    let eFixed = 0, eTemp = 0;
    for (let i = 0; i < pFixed.length; i++) {
      eFixed += pFixed[i] * dt;
      eTemp += pTemp[i] * dt;
    }

    const traces = [{
      x: hArr, y: pFixed,
      mode: "lines",
      name: `Fixed η = ${ETA_STC*100}%`,
      line: { color: SUN_COLOR, width: 3 },
      fill: "tozeroy",
      fillcolor: "rgba(245, 166, 35, 0.1)",
      hovertemplate: "%{y:.2f} kW at %{x:.1f}h<extra>Fixed η</extra>",
    }, {
      x: hArr, y: pTemp,
      mode: "lines",
      name: `With T correction (γ = ${GAMMA_T}/°C)`,
      line: { color: "tomato", width: 2, dash: "dash" },
      fill: "tozeroy",
      fillcolor: "rgba(255, 99, 71, 0.06)",
      hovertemplate: "%{y:.2f} kW at %{x:.1f}h<extra>With T correction</extra>",
    }];

    Plotly.newPlot(el, traces, {
      ...LAYOUT_BASE,
      title: { text: `Daily Power Output — Munich, Jun 21 (${AREA} m², ${ETA_STC*100}% eff., ${tiltDemo}° S)`, font: { size: 14 } },
      xaxis: { title: "Hour (UTC)", range: [3, 21], gridcolor: "rgba(0,0,0,0.06)" },
      yaxis: { title: "Power [kW]", gridcolor: "rgba(0,0,0,0.06)" },
      showlegend: true,
      legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.85)" },
      annotations: [{
        x: 12, y: Math.max(...pFixed) * 0.65,
        text: `Daily yield:<br>Fixed η: ${eFixed.toFixed(2)} kWh<br>With T corr.: ${eTemp.toFixed(2)} kWh`,
        showarrow: false,
        font: { size: 11 },
        bgcolor: "rgba(255,255,255,0.9)",
        bordercolor: "rgba(0,0,0,0.1)",
        borderwidth: 1,
        borderpad: 6,
      }],
    }, PLOTLY_CONFIG);
  }

  // ---- Step 8: Annual Energy ----
  function renderAnnualEnergy() {
    const latM = 48, lonM = 11, elevM = 520, areaM2 = 10, eta = 0.20;
    const tiltArr = Array.from(arange(0, 91, 5));
    const azArr   = Array.from(arange(0, 361, 10));

    // Show loading indicator
    const heatmapEl = document.getElementById("chart-annual-heatmap");
    const tiltEl    = document.getElementById("chart-tilt-sweep");
    const monthEl   = document.getElementById("chart-monthly");

    if (heatmapEl) heatmapEl.innerHTML = '<p style="text-align:center;padding:4rem;color:#5C6F7A;">Computing annual energy grid…</p>';

    // Use requestIdleCallback or setTimeout for non-blocking compute
    setTimeout(() => {
      const result = computeAnnualGrid(latM, lonM, elevM, tiltArr, azArr, areaM2, eta, 0.20, 0.5);

      // Find optimum
      let maxE = 0, optI = 0, optJ = 0;
      for (let i = 0; i < result.nTilt; i++) {
        for (let j = 0; j < result.nAz; j++) {
          const e = result.energy[i * result.nAz + j];
          if (e > maxE) { maxE = e; optI = i; optJ = j; }
        }
      }
      const eFlat = result.energy[0]; // tilt=0, az=0

      // --- Heatmap ---
      if (heatmapEl) {
        const zData = [];
        for (let i = 0; i < result.nTilt; i++) {
          const row = [];
          for (let j = 0; j < result.nAz; j++) {
            row.push(result.energy[i * result.nAz + j]);
          }
          zData.push(row);
        }

        Plotly.newPlot(heatmapEl, [{
          z: zData,
          x: azArr,
          y: tiltArr,
          type: "heatmap",
          colorscale: "YlOrRd",
          colorbar: { title: "Annual yield [kWh]", titleside: "right" },
          hovertemplate: "Tilt: %{y}°<br>Azimuth: %{x}°<br>Yield: %{z:.0f} kWh<extra></extra>",
        }, {
          x: [azArr[optJ]], y: [tiltArr[optI]],
          mode: "markers+text",
          marker: { symbol: "star", size: 18, color: "#fff", line: { color: "#000", width: 1.5 } },
          text: [`Optimum: ${tiltArr[optI]}° tilt, ${azArr[optJ]}° az`],
          textposition: "top right",
          textfont: { size: 11, color: "#fff" },
          showlegend: false,
          hovertemplate: `Optimum: ${tiltArr[optI]}° tilt, ${azArr[optJ]}° az<br>${maxE.toFixed(0)} kWh<extra></extra>`,
        }], {
          ...LAYOUT_BASE,
          title: { text: `Annual Yield Heatmap — Munich (48°N, ${areaM2} m², ${eta*100}% eff.)`, font: { size: 14 } },
          xaxis: {
            title: "Panel azimuth γ [° from North]",
            tickvals: [0, 90, 180, 270, 360],
            ticktext: ["N", "E", "S", "W", "N"],
            gridcolor: "rgba(0,0,0,0.06)",
          },
          yaxis: { title: "Panel tilt β [°]", gridcolor: "rgba(0,0,0,0.06)" },
        }, PLOTLY_CONFIG);
      }

      // --- Tilt Sweep ---
      if (tiltEl) {
        const jSouth = azArr.indexOf(180) >= 0 ? azArr.indexOf(180) : Math.round(azArr.length / 2);
        const jEast  = azArr.indexOf(90)  >= 0 ? azArr.indexOf(90)  : 0;
        const jWest  = azArr.indexOf(270) >= 0 ? azArr.indexOf(270) : 0;

        const southY = tiltArr.map((_, i) => result.energy[i * result.nAz + jSouth]);
        const eastY  = tiltArr.map((_, i) => result.energy[i * result.nAz + jEast]);
        const westY  = tiltArr.map((_, i) => result.energy[i * result.nAz + jWest]);

        Plotly.newPlot(tiltEl, [{
          x: tiltArr, y: southY,
          name: "South (180°)",
          line: { color: "crimson", width: 3 },
          hovertemplate: "Tilt %{x}°: %{y:.0f} kWh<extra>South</extra>",
        }, {
          x: tiltArr, y: eastY,
          name: "East (90°)",
          line: { color: "steelblue", width: 2, dash: "dash" },
          hovertemplate: "Tilt %{x}°: %{y:.0f} kWh<extra>East</extra>",
        }, {
          x: tiltArr, y: westY,
          name: "West (270°)",
          line: { color: "orange", width: 2, dash: "dashdot" },
          hovertemplate: "Tilt %{x}°: %{y:.0f} kWh<extra>West</extra>",
        }], {
          ...LAYOUT_BASE,
          title: { text: "Yield vs Tilt Angle", font: { size: 13 } },
          xaxis: { title: "Panel tilt β [°]", gridcolor: "rgba(0,0,0,0.06)" },
          yaxis: { title: "Annual yield [kWh]", gridcolor: "rgba(0,0,0,0.06)" },
          showlegend: true,
          legend: { x: 0.55, y: 0.98, bgcolor: "rgba(255,255,255,0.85)" },
          margin: { t: 50, r: 20, b: 50, l: 60 },
        }, PLOTLY_CONFIG);
      }

      // --- Monthly profile ---
      if (monthEl) {
        const monthlyOpt  = computeMonthlyEnergy(latM, lonM, elevM, tiltArr[optI], azArr[optJ], areaM2, eta, 0.20, 0.5);
        const monthlyFlat = computeMonthlyEnergy(latM, lonM, elevM, 0, 180, areaM2, eta, 0.20, 0.5);

        const avgDailyOpt  = Array.from(monthlyOpt,  (m, i) => m / DAYS_PER_MONTH[i]);
        const avgDailyFlat = Array.from(monthlyFlat, (m, i) => m / DAYS_PER_MONTH[i]);
        const totalOpt = Array.from(monthlyOpt).reduce((a, b) => a + b, 0);

        Plotly.newPlot(monthEl, [{
          x: MONTH_LABELS,
          y: avgDailyOpt,
          type: "bar",
          name: `Optimal (${tiltArr[optI]}° tilt)`,
          marker: { color: SUN_COLOR, opacity: 0.9 },
          hovertemplate: "%{x}: %{y:.2f} kWh/day<extra>Optimal</extra>",
        }, {
          x: MONTH_LABELS,
          y: avgDailyFlat,
          type: "bar",
          name: "Horizontal",
          marker: { color: "#ddd", opacity: 0.9, line: { color: GREY_COLOR, width: 1 } },
          hovertemplate: "%{x}: %{y:.2f} kWh/day<extra>Horizontal</extra>",
        }], {
          ...LAYOUT_BASE,
          title: { text: `Monthly Profile — Total: ${totalOpt.toFixed(0)} kWh/yr`, font: { size: 13 } },
          xaxis: { gridcolor: "rgba(0,0,0,0.06)" },
          yaxis: { title: "Avg. daily yield [kWh/day]", gridcolor: "rgba(0,0,0,0.06)" },
          barmode: "group",
          showlegend: true,
          legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.85)" },
          margin: { t: 50, r: 20, b: 50, l: 60 },
        }, PLOTLY_CONFIG);
      }
    }, 50);
  }

  // =====================================================================
  // INTERACTIVE EXPLORER (Step 9)
  // =====================================================================
  let explorerTimeout = null;

  function initExplorer() {
    const sliders = {
      lat:    document.getElementById("slider-lat"),
      elev:   document.getElementById("slider-elev"),
      area:   document.getElementById("slider-area"),
      eff:    document.getElementById("slider-eff"),
    };

    const values = {
      lat:    document.getElementById("val-lat"),
      elev:   document.getElementById("val-elev"),
      area:   document.getElementById("val-area"),
      eff:    document.getElementById("val-eff"),
    };

    if (!sliders.lat) return;

    function updateLabels() {
      values.lat.textContent    = sliders.lat.value + "°";
      values.elev.textContent   = sliders.elev.value + " m";
      values.area.textContent   = sliders.area.value + " m²";
      values.eff.textContent    = sliders.eff.value + "%";
    }

    function runExplorer() {
      const latDeg      = parseFloat(sliders.lat.value);
      const elevM       = parseFloat(sliders.elev.value);
      const areaM2      = parseFloat(sliders.area.value);
      const efficiency  = parseFloat(sliders.eff.value) / 100;
      const albedo      = 0.20;  // fixed ground reflectivity

      // Coarse grid for speed
      const tiltC = Array.from(arange(0, 91, 10));
      const azC   = Array.from(arange(0, 361, 20));

      const result = computeAnnualGrid(latDeg, 0, elevM, tiltC, azC, areaM2, efficiency, albedo, 1.0);

      // Find optimum
      let maxE = 0, optI = 0, optJ = 0;
      for (let i = 0; i < tiltC.length; i++) {
        for (let j = 0; j < azC.length; j++) {
          const e = result.energy[i * azC.length + j];
          if (e > maxE) { maxE = e; optI = i; optJ = j; }
        }
      }

      // Horizontal reference (average of all azimuths at tilt=0)
      let eFlatSum = 0;
      for (let j = 0; j < azC.length; j++) eFlatSum += result.energy[j];
      const eFlat = eFlatSum / azC.length;
      const gain = ((maxE - eFlat) / eFlat * 100);

      // Update stat cards
      const statTilt   = document.getElementById("stat-opt-tilt");
      const statAz     = document.getElementById("stat-opt-az");
      const statAnnual = document.getElementById("stat-annual");
      const statGain   = document.getElementById("stat-gain");

      if (statTilt)   statTilt.textContent   = tiltC[optI] + "°";
      if (statAz)     statAz.textContent     = azC[optJ] + "°";
      if (statAnnual) statAnnual.textContent = maxE.toFixed(0) + " kWh";
      if (statGain)   statGain.textContent   = "+" + gain.toFixed(1) + "%";

      // --- Heatmap ---
      const heatmapEl = document.getElementById("chart-explorer-heatmap");
      if (heatmapEl) {
        const zData = [];
        for (let i = 0; i < tiltC.length; i++) {
          const row = [];
          for (let j = 0; j < azC.length; j++) {
            row.push(result.energy[i * azC.length + j]);
          }
          zData.push(row);
        }

        Plotly.react(heatmapEl, [{
          z: zData, x: azC, y: tiltC,
          type: "heatmap",
          colorscale: "YlOrRd",
          colorbar: { title: "kWh", titleside: "right" },
          hovertemplate: "Tilt: %{y}°, Az: %{x}° → %{z:.0f} kWh<extra></extra>",
        }, {
          x: [azC[optJ]], y: [tiltC[optI]],
          mode: "markers",
          marker: { symbol: "star", size: 18, color: "#fff", line: { color: "#000", width: 1.5 } },
          showlegend: false,
          hoverinfo: "skip",
        }], {
          ...LAYOUT_BASE,
          title: { text: `Annual Yield — lat=${latDeg}°, ${areaM2} m², ${(efficiency*100).toFixed(0)}%`, font: { size: 13 } },
          xaxis: {
            title: "Azimuth [° from N]",
            tickvals: [0, 90, 180, 270, 360],
            ticktext: ["N", "E", "S", "W", "N"],
            gridcolor: "rgba(0,0,0,0.06)",
          },
          yaxis: { title: "Tilt [°]", gridcolor: "rgba(0,0,0,0.06)" },
        }, PLOTLY_CONFIG);
      }

      // --- Tilt sweep ---
      const tiltEl = document.getElementById("chart-explorer-tilt");
      if (tiltEl) {
        const jS = azC.indexOf(180) >= 0 ? azC.indexOf(180) : 0;
        const jN = 0;
        const southY = tiltC.map((_, i) => result.energy[i * azC.length + jS]);
        const northY = tiltC.map((_, i) => result.energy[i * azC.length + jN]);

        Plotly.react(tiltEl, [{
          x: tiltC, y: southY,
          name: "South (180°)",
          line: { color: "crimson", width: 3 },
          hovertemplate: "%{x}°: %{y:.0f} kWh<extra></extra>",
        }, {
          x: tiltC, y: northY,
          name: "North (0°)",
          line: { color: "navy", width: 2, dash: "dash" },
          hovertemplate: "%{x}°: %{y:.0f} kWh<extra></extra>",
        }, {
          x: [0, 90], y: [eFlat, eFlat],
          name: `Horizontal: ${eFlat.toFixed(0)} kWh`,
          line: { color: GREY_COLOR, width: 1.5, dash: "dot" },
          hoverinfo: "skip",
        }], {
          ...LAYOUT_BASE,
          title: { text: `Yield vs Tilt (gain: +${gain.toFixed(1)}%)`, font: { size: 13 } },
          xaxis: { title: "Tilt β [°]", gridcolor: "rgba(0,0,0,0.06)" },
          yaxis: { title: "Annual yield [kWh]", gridcolor: "rgba(0,0,0,0.06)" },
          showlegend: true,
          legend: { x: 0.5, y: 0.98, bgcolor: "rgba(255,255,255,0.85)", font: { size: 10 } },
          margin: { t: 50, r: 20, b: 50, l: 60 },
        }, PLOTLY_CONFIG);
      }

      // --- Monthly ---
      const monthEl = document.getElementById("chart-explorer-monthly");
      if (monthEl) {
        const monthly = computeMonthlyEnergy(latDeg, 0, elevM, tiltC[optI], azC[optJ], areaM2, efficiency, albedo, 1.0);
        const avgDaily = Array.from(monthly, (m, i) => m / DAYS_PER_MONTH[i]);
        const total = Array.from(monthly).reduce((a, b) => a + b, 0);

        Plotly.react(monthEl, [{
          x: MONTH_LABELS,
          y: avgDaily,
          type: "bar",
          marker: { color: SUN_COLOR, opacity: 0.9 },
          hovertemplate: "%{x}: %{y:.2f} kWh/day<extra></extra>",
        }], {
          ...LAYOUT_BASE,
          title: { text: `Monthly Profile — ${total.toFixed(0)} kWh/yr`, font: { size: 13 } },
          yaxis: { title: "Avg. daily yield [kWh/day]", gridcolor: "rgba(0,0,0,0.06)" },
          margin: { t: 50, r: 20, b: 50, l: 60 },
        }, PLOTLY_CONFIG);
      }
    }

    // Wire up sliders with debounce
    for (const key in sliders) {
      sliders[key].addEventListener("input", () => {
        updateLabels();
        clearTimeout(explorerTimeout);
        explorerTimeout = setTimeout(runExplorer, 300);
      });
    }

    // Initial render
    updateLabels();
    runExplorer();
  }

  // =====================================================================
  // SCROLL PROGRESS BAR + TOC HIGHLIGHT + NAV + REVEAL
  // =====================================================================
  function initScrollFeatures() {
    // Progress bar
    const progressBar = document.getElementById("progress-bar");
    const article = document.getElementById("article");

    if (progressBar && article) {
      window.addEventListener("scroll", () => {
        const rect = article.getBoundingClientRect();
        const total = article.scrollHeight - window.innerHeight;
        const scrolled = Math.max(0, -rect.top);
        const pct = Math.min(100, (scrolled / total) * 100);
        progressBar.style.width = pct + "%";
      }, { passive: true });
    }

    // TOC highlight
    const tocLinks = document.querySelectorAll(".toc__link");
    const sections = document.querySelectorAll(".article__section[id]");

    if (tocLinks.length && sections.length) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            tocLinks.forEach(link => {
              link.classList.toggle("active", link.getAttribute("href") === "#" + id);
            });
          }
        });
      }, { rootMargin: "-20% 0px -60% 0px" });

      sections.forEach(s => observer.observe(s));
    }

    // Nav scroll state
    const nav = document.querySelector(".nav");
    if (nav) {
      window.addEventListener("scroll", () => {
        nav.classList.toggle("nav--scrolled", window.scrollY > 16);
      }, { passive: true });
    }

    // Reveal on scroll
    const revealEls = document.querySelectorAll("[data-reveal]");
    if (revealEls.length && "IntersectionObserver" in window) {
      const ro = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            ro.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
      revealEls.forEach(el => ro.observe(el));
    } else {
      revealEls.forEach(el => el.classList.add("revealed"));
    }
  }

  // =====================================================================
  // INIT
  // =====================================================================
  document.addEventListener("DOMContentLoaded", () => {
    initScrollFeatures();

    waitForPlotly(() => {
      // Render static charts immediately
      renderInverseSquare();
      renderETR();
      renderDeclination();
      renderSunPaths();
      renderAtmosphere();
      renderPanelIrradiance();
      renderPower();

      // Defer heavy annual computation
      setTimeout(() => {
        renderAnnualEnergy();
        initExplorer();
      }, 200);
    });
  });

})();
