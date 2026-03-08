// SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * compass.js — Device sensor abstraction for heading (compass) and tilt.
 *
 * Handles:
 *   - iOS permission request (DeviceOrientationEvent.requestPermission)
 *   - deviceorientationabsolute (preferred — true North heading)
 *   - deviceorientation fallback (iOS reports absolute alpha natively)
 *   - Exponential smoothing for stable readings
 *   - Heading + tilt extraction with proper coordinate conventions
 *
 * Coordinate convention:
 *   Heading: 0° = North, 90° = East, 180° = South, 270° = West (clockwise)
 *   Tilt:    0° = horizontal, 90° = vertical (panel angle from ground)
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SMOOTHING_FACTOR = 0.25;  // Exponential smoothing α (0–1, higher = less smooth)
const MIN_UPDATE_INTERVAL = 16; // ~60fps cap (ms)

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _heading = null;     // Smoothed compass heading (0–360°)
let _tilt = null;        // Smoothed panel tilt (0–90°)
let _rawBeta = null;     // Raw beta from sensor
let _rawGamma = null;    // Raw gamma from sensor
let _isActive = false;
let _callback = null;    // User-provided callback: ({ heading, tilt, accuracy }) => void
let _lastUpdate = 0;
let _sensorType = null;  // 'absolute' | 'standard' | 'none'
let _permissionState = 'unknown'; // 'unknown' | 'granted' | 'denied' | 'not-needed'

// ---------------------------------------------------------------------------
// Smoothing helpers
// ---------------------------------------------------------------------------

/**
 * Exponential smoothing for circular quantities (angles in degrees).
 * Handles the 0°/360° wrap-around correctly.
 */
function smoothAngle(prev, curr, alpha) {
  if (prev === null) return curr;

  // Convert to radians for vector averaging
  const prevRad = prev * Math.PI / 180;
  const currRad = curr * Math.PI / 180;

  const sinAvg = (1 - alpha) * Math.sin(prevRad) + alpha * Math.sin(currRad);
  const cosAvg = (1 - alpha) * Math.cos(prevRad) + alpha * Math.cos(currRad);

  let result = Math.atan2(sinAvg, cosAvg) * 180 / Math.PI;
  if (result < 0) result += 360;
  return result;
}

/**
 * Exponential smoothing for linear quantities.
 */
function smoothLinear(prev, curr, alpha) {
  if (prev === null) return curr;
  return (1 - alpha) * prev + alpha * curr;
}

// ---------------------------------------------------------------------------
// Sensor event handler
// ---------------------------------------------------------------------------

function onDeviceOrientation(event) {
  const now = performance.now();
  if (now - _lastUpdate < MIN_UPDATE_INTERVAL) return;
  _lastUpdate = now;

  // --- Heading (compass) ---
  // alpha: rotation around z-axis.
  // deviceorientationabsolute: alpha is clockwise from North (0–360)
  // iOS deviceorientation: alpha is also compass-referenced (unique to iOS)
  let rawHeading = null;

  if (event.absolute || _sensorType === 'standard') {
    // Both absolute events and iOS standard events give us usable heading
    if (event.alpha !== null && event.alpha !== undefined) {
      // deviceorientationabsolute: alpha = degrees clockwise from North
      // BUT alpha is actually the rotation of the device, so:
      //   heading = (360 - alpha) on most browsers
      // iOS: webkitCompassHeading is the direct compass heading
      if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        rawHeading = event.webkitCompassHeading; // iOS: direct compass heading
      } else {
        // Android / standard: alpha goes counter-clockwise
        rawHeading = (360 - event.alpha) % 360;
      }
    }
  }

  // --- Tilt ---
  // beta: front-to-back tilt (-180 to 180). 0 = flat, 90 = standing upright.
  // When phone lies flat on a tilted panel:
  //   panel_tilt = 90° - beta (when beta is in [0, 90] range)
  // We need to handle the phone being face-up on the panel surface.
  let rawTilt = null;
  _rawBeta = event.beta;
  _rawGamma = event.gamma;

  if (event.beta !== null && event.beta !== undefined) {
    const beta = event.beta;
    // Phone lying flat face-up: beta ≈ 0 → panel is horizontal (tilt = 0)
    // Phone at 60° (tilted up): beta ≈ 60 → panel tilt ≈ 60°
    // Phone standing up: beta ≈ 90 → panel is vertical (tilt = 90)
    // We clamp to [0, 90] range for valid panel tilt readings
    if (beta >= 0 && beta <= 90) {
      rawTilt = beta;
    } else if (beta > 90 && beta <= 180) {
      // Phone is tilted past vertical (screen facing down) — unlikely but handle
      rawTilt = 180 - beta;
    } else if (beta < 0 && beta >= -90) {
      // Phone flipped face-down on panel — interpret as same tilt
      rawTilt = Math.abs(beta);
    } else {
      rawTilt = 0;
    }
  }

  // Apply smoothing
  if (rawHeading !== null) {
    _heading = smoothAngle(_heading, rawHeading, SMOOTHING_FACTOR);
  }
  if (rawTilt !== null) {
    _tilt = smoothLinear(_tilt, rawTilt, SMOOTHING_FACTOR);
  }

  // Fire callback
  if (_callback && _heading !== null) {
    _callback({
      heading: Math.round(_heading * 10) / 10,
      tilt: _tilt !== null ? Math.round(_tilt * 10) / 10 : null,
      accuracy: event.webkitCompassAccuracy || null,
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if the device supports orientation sensors.
 * @returns {boolean}
 */
export function isSupported() {
  return 'DeviceOrientationEvent' in window;
}

/**
 * Check if iOS permission is required (iOS 13+).
 * @returns {boolean}
 */
export function needsPermission() {
  return typeof DeviceOrientationEvent.requestPermission === 'function';
}

/**
 * Request sensor permission (required on iOS 13+, must be called from user gesture).
 * On Android / older iOS, resolves immediately.
 *
 * @returns {Promise<'granted'|'denied'|'not-needed'>}
 */
export async function requestPermission() {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      _permissionState = result;
      return result;
    } catch (err) {
      console.warn('Sensor permission request failed:', err);
      _permissionState = 'denied';
      return 'denied';
    }
  }
  _permissionState = 'not-needed';
  return 'not-needed';
}

/**
 * @returns {'unknown'|'granted'|'denied'|'not-needed'}
 */
export function getPermissionState() {
  return _permissionState;
}

/**
 * Start listening to device orientation events.
 *
 * @param {function} callback — Called on each sensor update:
 *   ({ heading: number, tilt: number|null, accuracy: number|null }) => void
 */
export function start(callback) {
  if (_isActive) return;

  _callback = callback;

  // Try absolute orientation first (true North heading)
  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', onDeviceOrientation, true);
    _sensorType = 'absolute';
  } else {
    // Fallback to standard — works on iOS (which gives absolute alpha natively)
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
    _sensorType = 'standard';
  }

  _isActive = true;
}

/**
 * Stop listening to sensor events.
 */
export function stop() {
  if (!_isActive) return;

  if (_sensorType === 'absolute') {
    window.removeEventListener('deviceorientationabsolute', onDeviceOrientation, true);
  } else {
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);
  }

  _isActive = false;
  _heading = null;
  _tilt = null;
  _callback = null;
  _sensorType = null;
}

/**
 * Get the current (smoothed) readings without waiting for next event.
 *
 * @returns {{ heading: number|null, tilt: number|null }}
 */
export function getCurrentReadings() {
  return {
    heading: _heading !== null ? Math.round(_heading * 10) / 10 : null,
    tilt: _tilt !== null ? Math.round(_tilt * 10) / 10 : null,
  };
}

/**
 * @returns {'absolute'|'standard'|'none'}
 */
export function getSensorType() {
  return _sensorType || 'none';
}

/**
 * @returns {boolean}
 */
export function isActive() {
  return _isActive;
}
