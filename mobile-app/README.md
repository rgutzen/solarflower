# Panel Compass

Real-time solar panel orientation helper — a Progressive Web App that uses your
phone's compass and tilt sensors to guide you toward the optimal panel alignment.

## How It Works

1. **GPS** detects your location (or enter manually)
2. **Optimal orientation** is computed from your latitude (tilt ≈ 0.9 × |lat| + 3.1°, azimuth = due south/north)
3. **Device sensors** measure the panel's current tilt and compass heading in real time
4. **Live yield** is estimated every frame using a PVWatts-style model
5. **Visual guidance** shows how to adjust — zone arcs, directional arrows, and a yield gauge

Place your phone face-up on the panel surface. The screen shows:

- **Compass** — needle for current heading, orange target marker, green/amber zone arcs
- **Tilt meter** — arc gauge for current tilt vs optimal, with directional arrows
- **Yield gauge** — circular percentage showing current vs optimal annual yield
- **Status bar** — alignment state (on-target / close / adjusting)

## Quick Start

```bash
cd mobile-app
python -m http.server 8081
# Opens at http://localhost:8081
```

No build step, no dependencies — vanilla JavaScript ES modules.

Open on a phone (or use browser DevTools device emulation for layout testing —
real sensors require a physical device or HTTPS).

## Project Structure

```
mobile-app/
├── index.html         Single-page app shell (SVG compass, tilt meter, yield panel)
├── app.js             Main orchestrator — geolocation → sensors → yield → DOM updates
├── solar.js           Pure JS solar calculations (no dependencies)
│                      Exports: computeOptimalOrientation, estimateYieldKwhPerKwp,
│                               computeOrientationFactor, azimuthToCardinal, angleDelta
├── compass.js         Device sensor abstraction
│                      DeviceOrientationEvent, iOS permission handling,
│                      exponential smoothing, heading + tilt extraction
├── styles.css         Mobile-first CSS — Solarflower solarpunk design system
├── manifest.json      PWA manifest (standalone, theme #F5A623)
├── sw.js              Service worker — cache-first offline strategy
└── icons/
    ├── icon.svg       Compass rose SVG
    ├── icon-192.png   Android home screen icon
    └── icon-512.png   Splash screen icon
```

## Physics Model

| Parameter | Value / Source |
|-----------|---------------|
| GHI | Latitude-band lookup table (15 bands, 0°–70°) |
| Optimal tilt | `0.9 × |latitude| + 3.1°` |
| Optimal azimuth | 180° (N hemisphere) / 0° (S hemisphere) |
| Orientation factor | Cosine model with diffuse/ground components |
| Performance ratio | 0.80 (fixed) |
| Yield | `GHI × POA_boost × orientation_factor × PR` |

Thresholds: ±3° on-target (green), ±10° close (amber), >10° off (red).

## Sensor Mapping

The phone is placed **face-up on the panel surface**:

- **Compass heading** (`DeviceOrientationEvent.alpha`) → panel azimuth
- **Accelerometer beta** → panel tilt (0° = horizontal, 90° = vertical)
- iOS: `webkitCompassHeading` for true north; Android: `deviceorientationabsolute`
- Exponential smoothing (factor 0.25) applied to all readings

## PWA

Installable on Android and iOS. The service worker caches all assets for offline
use after the first visit. Manifest defines standalone display mode with the
Solarflower amber theme.

## License

AGPL-3.0 — see [LICENSE](../LICENSE).
Commercial licensing available — see [COMMERCIAL_LICENSE.md](../COMMERCIAL_LICENSE.md).

## See Also

- [Solar Advisor](../solar-app/) — professional-grade PV yield simulator
- [Solar Panel Power](../notebook/) — educational notebook deriving yield from first principles
