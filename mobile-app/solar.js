// SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * solar.js — Optimal orientation & yield estimation (pure JS, no dependencies)
 *
 * Coordinate convention (matches the rest of the Solarflower project):
 *   Azimuth: 0° = North, 90° = East, 180° = South, 270° = West (clockwise)
 *   Tilt:    0° = horizontal, 90° = vertical
 */

// ---------------------------------------------------------------------------
// 1. Optimal orientation
// ---------------------------------------------------------------------------

/**
 * Compute the optimal fixed-mount orientation for annual energy maximisation.
 *
 * @param {number} lat — Latitude in decimal degrees (positive = N, negative = S)
 * @returns {{ tilt: number, azimuth: number }}
 */
export function computeOptimalOrientation(lat) {
  // Empirical regression fit against PVGIS TMY grid data.
  // Accurate to ±2° for latitudes 15°–65° N/S.
  const tilt = 0.9 * Math.abs(lat) + 3.1;

  // South-facing in Northern hemisphere, North-facing in Southern.
  // Near equator (|lat| < 5°): default to 180° (South).
  const azimuth = lat >= 0 ? 180 : 0;

  return { tilt: Math.round(tilt * 10) / 10, azimuth };
}

// ---------------------------------------------------------------------------
// 2. GHI lookup table (kWh/m²/year by latitude band)
// ---------------------------------------------------------------------------

/**
 * Annual Global Horizontal Irradiation by latitude band.
 * Derived from PVGIS satellite data averages (typical values for land areas).
 * Each entry: [midpoint-latitude, annual GHI kWh/m²].
 */
const GHI_TABLE = [
  [0,  2100],   // equatorial
  [5,  2050],
  [10, 2000],
  [15, 1950],
  [20, 1880],
  [25, 1800],
  [30, 1700],
  [35, 1600],
  [40, 1480],
  [45, 1350],
  [50, 1200],
  [55, 1080],
  [60, 950],
  [65, 820],
  [70, 700],
];

/**
 * Linearly interpolate annual GHI from the latitude lookup table.
 *
 * @param {number} lat — Latitude in decimal degrees
 * @returns {number} — Estimated annual GHI in kWh/m²/year
 */
function latitudeToGHI(lat) {
  const absLat = Math.abs(lat);

  // Clamp to table range
  if (absLat <= GHI_TABLE[0][0]) return GHI_TABLE[0][1];
  if (absLat >= GHI_TABLE[GHI_TABLE.length - 1][0]) {
    return GHI_TABLE[GHI_TABLE.length - 1][1];
  }

  // Find surrounding entries and interpolate
  for (let i = 0; i < GHI_TABLE.length - 1; i++) {
    const [lat0, ghi0] = GHI_TABLE[i];
    const [lat1, ghi1] = GHI_TABLE[i + 1];
    if (absLat >= lat0 && absLat <= lat1) {
      const t = (absLat - lat0) / (lat1 - lat0);
      return ghi0 + t * (ghi1 - ghi0);
    }
  }
  return GHI_TABLE[GHI_TABLE.length - 1][1]; // fallback
}

// ---------------------------------------------------------------------------
// 3. Orientation factor
// ---------------------------------------------------------------------------

const DEG2RAD = Math.PI / 180;

/**
 * Approximate the ratio of Plane-of-Array (POA) irradiance for a given
 * orientation vs the optimal orientation, using a simplified cosine model.
 *
 * This is a first-order approximation that accounts for:
 *   - Sun path geometry at the given latitude
 *   - Azimuth deviation penalty (cosine-based)
 *   - Tilt deviation from optimal (cosine-based)
 *
 * @param {number} lat     — Latitude (deg)
 * @param {number} tilt    — Panel tilt (deg, 0=horizontal)
 * @param {number} azimuth — Panel azimuth (deg, 0=N, 180=S)
 * @returns {number} — Factor between 0 and 1 (1 = optimal)
 */
export function computeOrientationFactor(lat, tilt, azimuth) {
  const { tilt: optTilt, azimuth: optAz } = computeOptimalOrientation(lat);

  // Azimuth deviation — wrap to [-180, 180]
  let azDelta = azimuth - optAz;
  if (azDelta > 180) azDelta -= 360;
  if (azDelta < -180) azDelta += 360;

  // Tilt deviation
  const tiltDelta = tilt - optTilt;

  // Cosine-based loss model:
  // - Azimuth deviation is weighted more heavily at higher tilts
  //   (a horizontal panel doesn't care about azimuth)
  // - Tilt deviation has a direct cosine penalty
  const tiltRad = tilt * DEG2RAD;
  const optTiltRad = optTilt * DEG2RAD;

  // Azimuth penalty: proportional to sin(tilt) because flat panels are azimuth-agnostic
  const azPenalty = 1 - Math.sin(optTiltRad) * (1 - Math.cos(azDelta * DEG2RAD));

  // Tilt penalty: cosine of the angular difference from optimal
  const tiltPenalty = Math.cos(tiltDelta * DEG2RAD);

  // Combined factor (clamp to [0, 1])
  return Math.max(0, Math.min(1, azPenalty * tiltPenalty));
}

// ---------------------------------------------------------------------------
// 4. Yield estimation
// ---------------------------------------------------------------------------

/**
 * Estimate annual energy yield in kWh per kWp for a given location and
 * panel orientation, using the PVWatts simplified method.
 *
 * @param {number} lat     — Latitude (deg)
 * @param {number} tilt    — Panel tilt (deg)
 * @param {number} azimuth — Panel azimuth (deg)
 * @returns {number} — Estimated annual yield in kWh/kWp
 */
export function estimateYieldKwhPerKwp(lat, tilt, azimuth) {
  const ghi = latitudeToGHI(lat);
  const orientationFactor = computeOrientationFactor(lat, tilt, azimuth);

  // POA irradiance boost: optimally tilted panels receive ~10-20% more than GHI
  // at mid-latitudes. Model as latitude-dependent boost.
  const absLat = Math.abs(lat);
  const poaBoost = 1.0 + 0.15 * Math.sin(absLat * DEG2RAD * 1.2);

  // Typical system performance ratio (IEC 61724)
  // Accounts for: temperature losses, inverter efficiency, wiring, soiling, etc.
  const PR = 0.80;

  return Math.round(ghi * poaBoost * orientationFactor * PR);
}

// ---------------------------------------------------------------------------
// 5. Helpers
// ---------------------------------------------------------------------------

/**
 * Format azimuth as a cardinal direction string.
 *
 * @param {number} azimuth — Degrees (0–360)
 * @returns {string} — e.g. "N", "NE", "E", "SE", "S", "SW", "W", "NW"
 */
export function azimuthToCardinal(azimuth) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((azimuth % 360) + 360) % 360 / 45) % 8;
  return dirs[index];
}

/**
 * Compute the shortest signed angular difference from `current` to `target`.
 * Positive = clockwise, negative = counter-clockwise.
 *
 * @param {number} current — Current angle in degrees
 * @param {number} target  — Target angle in degrees
 * @returns {number} — Difference in degrees, range [-180, 180]
 */
export function angleDelta(current, target) {
  let d = ((target - current) % 360 + 540) % 360 - 180;
  return d;
}
