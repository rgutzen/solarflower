# Agent 04 — Mobile-App (Panel Compass): Persistent Memory

_Update this file after every working session._
_Last updated: 2026-03-06_

## Scope
- **Directory:** `/home/rgutzen/01_PROJECTS/solarflower/mobile-app/`
- **Base prompt:** `.claude/agent-prompts/04_mobile-app.md`
- **Do NOT modify:** any file outside `mobile-app/`

## Current State

**Not started.** The `mobile-app/` directory does not yet exist.

## Decisions Made

- **Tech stack:** PWA (Progressive Web App) — vanilla JS + HTML5 + CSS
  - Rationale: no app store, works iOS + Android, access to DeviceOrientation API,
    offline via service worker, one codebase
- **Sensor for compass:** `deviceorientationabsolute` (absolute heading, 0=North)
  - iOS fallback: `deviceorientation` (iOS reports absolute heading natively)
  - Android: must use `deviceorientationabsolute` for true North heading
- **Sensor for tilt:** `DeviceOrientationEvent.beta` (front-to-back tilt)
  - Phone flat on panel → beta≈0, panel tilt = 90° − |beta|

## Key Technical Notes (from base prompt)

### iOS Permission Pattern
```javascript
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ requires user gesture + permission request
    DeviceOrientationEvent.requestPermission()
        .then(perm => { if (perm === 'granted') startSensors(); });
} else {
    startSensors();  // Android, older iOS
}
```

### Heading Derivation
- `deviceorientationabsolute.alpha` = compass heading, 0=North, clockwise
- This matches our azimuth convention directly (see `shared/conventions.md`)
- No correction needed for magnetic declination (OS handles it)

### Tilt Derivation
- Phone lying flat on panel surface: `beta` ≈ 0°
- Panel at 30° tilt: `beta` ≈ 90° − 30° = 60° (or negative depending on orientation)
- Need to handle landscape vs portrait phone orientation (`gamma` for roll check)

## Optimal Tilt Formula (from `shared/interfaces.md`)
```javascript
const optimalTilt = 0.9 * Math.abs(lat) + 3.1;  // degrees
const optimalAz = lat >= 0 ? 180 : 0;             // South for N, North for S
```

## On-Target Thresholds
- Within ±3°: on target (green)
- Within ±10°: close (amber)
- Beyond ±10°: off (red / directional guidance shown)

## Notes
_(add session-specific findings here as work progresses)_
