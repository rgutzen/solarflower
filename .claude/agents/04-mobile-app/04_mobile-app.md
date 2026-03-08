# Agent Prompt: Mobile-App — Panel Compass (On-Site Orientation Helper)

## Your Role
You are working on the **Mobile-App** component of the Solarflower project.
Your task is to design and build a mobile helper application that guides a user
to orient a solar panel optimally on-site — in real time, using the phone's sensors.

## Design Guidelines

**You MUST follow the visual design specifications in:**
`.claude/shared/design-guidelines.md`

See also the implementation roadmap: `.claude/shared/design-roadmap.md`

Key points for the mobile app:
- Use brand colors: amber `#F5A623` for on-target indicator, red `#E63946` for far-off, success green `#22C55E` for perfect alignment
- Mobile-first design with large touch targets (minimum 44px)
- High contrast for outdoor readability
- Use CSS variables from Section 6.1 for consistency
- Apply responsive breakpoints from Section 6.2
- Follow the screen layout guidelines in Section 5.3

## Project Context

The Solarflower project has four components. You work on component 4:

1. **SciComm Notebook** (`notebook/solar_panel_power.ipynb`) — educational article
2. **Web-App** (`solar-app/`) — production Streamlit energy-advisor app (complete)
3. **Website** (`website/`) — landing page
4. **Mobile-App** (`mobile-app/`) — YOUR COMPONENT

**Repository root:** `/home/rgutzen/01_PROJECTS/solarflower/`
**License:** AGPL-3.0-or-later
**Copyright:** Robin Gutzen — robin.gutzen@outlook.com

## Core User Need

An installer or homeowner stands on a rooftop holding a solar panel. They need to know:
1. **Which direction to face the panel** (azimuth): optimal compass heading
2. **How steeply to tilt the panel** (tilt angle): optimal angle from horizontal
3. **Real-time feedback** as they physically rotate and tilt the panel

The app computes the optimal orientation for the user's location, then uses the phone's
compass and accelerometer to give live guidance: "rotate left 15°", "tilt up 8°".

## Technology Choice

Build as a **Progressive Web App (PWA)** — a mobile-optimized web app served from
`mobile-app/`. Reasons:
- No app store required; works on iOS and Android via any browser
- Access to DeviceOrientation API (compass + accelerometer)
- Can be added to home screen by users
- Shares the same domain as the website
- Single codebase

**Stack:** Vanilla JavaScript + HTML5 + CSS (or a lightweight framework like Svelte/Vue
if needed for reactivity). Keep dependencies minimal — the app should load fast on mobile
networks.

## File Structure

```
mobile-app/
├── index.html          App shell (single-page)
├── app.js              Main application logic
├── compass.js          Sensor handling (DeviceOrientationEvent)
├── solar.js            Optimal orientation calculation (pure JS, no dependencies)
├── styles.css
├── manifest.json       PWA manifest
├── sw.js               Service worker for offline support
└── icons/              App icons (192×192, 512×512 PNG)
```

## Features (in priority order)

### 1. Location Input
- On load: request `navigator.geolocation` (GPS)
- Fallback: manual lat/lon entry or city search
- Show detected location on screen

### 2. Optimal Orientation Calculation (pure JS — no server call)
Implement this in `solar.js`. The calculation is fast enough to run client-side.

**Optimal tilt rule of thumb (rule valid for fixed-mount, annual maximization):**
```
optimal_tilt ≈ 0.9 × |latitude| + 3.1°   (Northern hemisphere)
optimal_tilt ≈ 0.9 × |latitude| + 3.1°   (Southern hemisphere, same formula)
```
This approximation is accurate to ±2° vs full PVGIS TMY sweep for latitudes 20°–65°.

**Optimal azimuth:**
- Northern hemisphere (lat > 0): 180° (South)
- Southern hemisphere (lat < 0): 0° / 360° (North)
- Near equator (|lat| < 5°): compute based on season or default to 180°

**Optional enhanced calculation:** Port the orientation grid sweep from `solar-app/core/energy.py`
to JavaScript using a simplified PVWatts-style model for higher accuracy. This is optional
but significantly improves accuracy at high latitudes and coastal locations.

Coordinate convention (match the rest of the project):
- **Azimuth:** 0° = North, 90° = East, 180° = South, 270° = West (clockwise from above)
- **Tilt:** 0° = horizontal, 90° = vertical

### 3. Live Compass (Azimuth Guidance)
Use `DeviceOrientationEvent` (or `DeviceOrientationAbsoluteEvent` where available):
- Display current phone heading vs optimal azimuth
- Large visual compass rose or arc indicator
- Show delta in degrees: "Rotate 23° clockwise" / "On target ✓"
- iOS requires permission request: `DeviceOrientationEvent.requestPermission()`

**Important:** The phone's compass gives the heading the phone is **facing** (its
long axis). The panel faces the same direction as the phone when laid flat on it.
Document this clearly in the UI.

### 4. Live Tilt Meter (Tilt Guidance)
Use `DeviceOrientationEvent.beta` (front-to-back tilt):
- Display current tilt angle vs optimal tilt
- Visual level/inclinometer indicator
- Show delta: "Tilt up 5°" / "Perfect tilt ✓"
- Handle both landscape and portrait phone orientations

### 5. On-Target Confirmation
When both azimuth and tilt are within ±3° of optimal:
- Green highlight, checkmark, celebratory feedback
- Display the exact values: "Tilt: 32°, Azimuth: 180° (S) — Optimal for your location"

### 6. Yield Estimate (optional but valuable)
Show a quick estimate of annual yield for the configured orientation:
```
Estimated annual yield: ~1,240 kWh/kWp
(vs 1,320 kWh/kWp at optimal — you're at 94% of maximum)
```
Use the PVWatts simplified model in `solar.js`:
```javascript
// Simplified: yield ∝ POA irradiance (integrated over TMY)
// Use lookup table indexed by latitude band for quick estimate
// Or implement a fast clear-sky + orientation calculation
```

### 7. Offline Support (PWA)
Cache `solar.js`, `app.js`, `styles.css` in the service worker so the app works
without internet once loaded. The optimal orientation calculation is entirely local.

## UI Design

**Mobile-first layout.** Large touch targets. Clear visual hierarchy.

**Screen layout (portrait, top to bottom):**
```
┌─────────────────────────────┐
│  [Location: Berlin, 52.5°N] │  ← tap to change
├─────────────────────────────┤
│                             │
│     COMPASS ROSE            │  ← large, dominant
│     Current: 142°           │
│     Target:  180° (S)       │
│     → Rotate 38° right      │
│                             │
├─────────────────────────────┤
│     TILT METER              │  ← level indicator
│     Current: 28°            │
│     Target:  35°            │
│     ↑ Tilt up 7°            │
├─────────────────────────────┤
│  Status: [  Aligning...  ]  │  ← green when on target
│  Yield est: 1,190 kWh/kWp  │
└─────────────────────────────┘
```

**Colors:** Match web-app accent (`#F5A623` amber) for brand consistency.
Use green (#22c55e) for on-target state, amber for close, red for far off.

## Sensor API Notes

### DeviceOrientationEvent (compass + tilt)
```javascript
// Request permission (iOS 13+)
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
        .then(perm => { if (perm === 'granted') startSensors(); });
} else {
    startSensors(); // Android / older iOS
}

window.addEventListener('deviceorientationabsolute', (e) => {
    const heading = e.alpha;   // compass heading 0–360° (0=North on some devices)
    const tilt    = e.beta;    // front-to-back tilt (-180 to 180°)
    const roll    = e.gamma;   // side-to-side tilt (-90 to 90°)
}, true);
```

**Gotchas:**
- `e.alpha` is 0=North only with `deviceorientationabsolute`; plain `deviceorientation`
  `alpha` is arbitrary. Always prefer `deviceorientationabsolute`.
- iOS `alpha` from `deviceorientation` is already compass-referenced (unique to iOS).
- `beta` = 0 when the phone is flat; = 90 when vertical (standing up). Panel tilt =
  when phone lies flat on panel: 90° − |beta|. Handle the sign based on orientation.
- Android magnetic declination: the OS corrects for declination automatically in
  `deviceorientationabsolute`. No additional correction needed.

### Geolocation
```javascript
navigator.geolocation.getCurrentPosition(
    pos => setLocation(pos.coords.latitude, pos.coords.longitude),
    err => showManualEntry(),
    { enableHighAccuracy: false, timeout: 10000 }
);
```

## SPDX Headers

Every source file must include:
```javascript
// SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
```
HTML files:
```html
<!-- SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com> -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
```

## Coordinate Conventions (CRITICAL — match the rest of the project)

- **Azimuth:** 0° = North, 90° = East, 180° = South, 270° = West (clockwise from above)
- **Tilt:** 0° = horizontal, 90° = vertical
- **Note:** `DeviceOrientationEvent.alpha` gives heading clockwise from North — this
  matches our azimuth convention directly.

## Shared Physics from Web-App

The web-app (`solar-app/`) implements the full PVsyst-equivalent simulation in Python.
You do NOT need to replicate the full stack — the simplified PVWatts model in `solar.js`
is sufficient for on-site guidance. However, if you want to provide higher-accuracy yield
estimates, you can call the web-app's API if/when it exposes one, or implement the
following in JS:

```javascript
// Simplified annual POA irradiance model for optimal orientation estimate
// Uses clear-sky + latitude lookup (no external API needed)
function estimateYieldKwhPerKwp(lat, tilt, azimuth) {
    // Latitude-based clear-sky GHI lookup (kWh/m²/yr)
    const ghi_ref = latitudeToGHI(lat);  // from built-in lookup table
    // Orientation factor relative to optimal
    const orientationFactor = computeOrientationFactor(lat, tilt, azimuth);
    // PVWatts-style: yield = GHI × orientation_factor × PR_system
    const PR_typical = 0.80;  // 80% typical system PR
    return ghi_ref * orientationFactor * PR_typical;
}
```

Alternatively, the web-app may expose a REST API endpoint in the future; design `solar.js`
so it can optionally fetch from `POST /api/estimate` and fall back to local calculation.

## Testing

Test on both iOS Safari and Android Chrome (the two environments with different sensor APIs).
Use browser DevTools device emulation for layout testing, but test actual sensor behavior
on a real device.

Minimum acceptance criteria:
1. Geolocation works and populates optimal tilt/azimuth
2. Compass updates smoothly at ≥10 Hz
3. Tilt meter updates smoothly at ≥10 Hz
4. On-target detection triggers correctly at ±3°
5. App loads and works offline after first visit (service worker active)
6. No console errors on iOS Safari 16+ and Android Chrome 120+

## Coordination Notes

- Do NOT modify files in `solar-app/`, `website/`, or `notebook/solar_panel_power.ipynb`.
- If you need to share constants (e.g., optimal tilt formula), document them in
  `.claude/memory/MEMORY.md` under a "Shared Constants" section.
- Memory and plans are in `.claude/memory/MEMORY.md` and `.claude/plans/`.
- The web-app uses `#F5A623` as brand accent color — reuse for consistency.
