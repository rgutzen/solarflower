// SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * app.js — Main application logic for Panel Compass PWA.
 *
 * Orchestrates: geolocation → solar calculations → sensor readings → UI updates.
 *
 * The device's sensors drive the yield computation continuously:
 *   - Compass heading → panel azimuth (phone face-up on panel)
 *   - Accelerometer beta → panel tilt (phone face-up on panel)
 *   - GPS → latitude for optimal orientation + GHI lookup
 *
 * The yield is recomputed every animation frame from live sensor values
 * and displayed in a circular gauge with deviation guidance.
 */

import {
  computeOptimalOrientation,
  computeOrientationFactor,
  estimateYieldKwhPerKwp,
  azimuthToCardinal,
  angleDelta,
} from './solar.js';

import * as compass from './compass.js';

// ===========================================================================
// State
// ===========================================================================

const state = {
  lat: null,
  lon: null,
  locationName: null,
  optimalTilt: null,
  optimalAzimuth: null,
  optimalYield: null,      // kWh/kWp at optimal orientation
  currentHeading: null,    // from compass sensor (= panel azimuth)
  currentTilt: null,       // from accelerometer (= panel tilt)
  currentYield: null,      // kWh/kWp at current sensor orientation
  currentPct: null,        // percentage of optimal yield
  sensorsActive: false,
};

// Thresholds (degrees)
const THRESHOLD_ON_TARGET = 3;
const THRESHOLD_CLOSE = 10;

// Yield gauge constants
const GAUGE_RADIUS = 68;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS; // ~427.3

// Tilt arc geometry
const TILT_CX = 150, TILT_CY = 140, TILT_R = 120;

// ===========================================================================
// DOM References
// ===========================================================================

const $ = (id) => document.getElementById(id);

const dom = {
  locationBtn:      $('location-btn'),
  locationText:     $('location-text'),
  locationCoords:   $('location-coords'),
  locationManual:   $('location-manual'),
  manualLat:        $('manual-lat'),
  manualLon:        $('manual-lon'),
  manualSubmit:     $('manual-submit'),
  optimalSection:   $('optimal-section'),
  optimalTilt:      $('optimal-tilt'),
  optimalAzimuth:   $('optimal-azimuth'),
  permissionSection: $('permission-section'),
  permissionBtn:    $('permission-btn'),
  compassSection:   $('compass-section'),
  compassTicks:     $('compass-ticks'),
  compassTarget:    $('compass-target'),
  compassNeedle:    $('compass-needle'),
  compassGuideArrow: $('compass-guide-arrow'),
  compassZoneAmber: $('compass-zone-amber'),
  compassZoneGreen: $('compass-zone-green'),
  headingValue:     $('heading-value'),
  headingCardinal:  $('heading-cardinal'),
  headingDelta:     $('heading-delta'),
  tiltSection:      $('tilt-section'),
  tiltTicks:        $('tilt-ticks'),
  tiltTarget:       $('tilt-target'),
  tiltIndicator:    $('tilt-indicator'),
  tiltGuideArrow:   $('tilt-guide-arrow'),
  tiltZoneAmber:    $('tilt-zone-amber'),
  tiltZoneGreen:    $('tilt-zone-green'),
  tiltValue:        $('tilt-value'),
  tiltDelta:        $('tilt-delta'),
  yieldSection:     $('yield-section'),
  yieldArc:         $('yield-arc'),
  yieldPct:         $('yield-pct'),
  yieldCurrent:     $('yield-current'),
  yieldOptimal:     $('yield-optimal'),
  yieldLoss:        $('yield-loss'),
  statusSection:    $('status-section'),
  statusIndicator:  $('status-indicator'),
  statusIcon:       $('status-icon'),
  statusText:       $('status-text'),
  statusYield:      $('status-yield'),
  nosensorSection:  $('nosensor-section'),
  footer:           $('footer'),
  contrastBtn:      $('contrast-btn'),
  locationSpinner:  $('location-spinner'),
  latError:         $('lat-error'),
  lonError:         $('lon-error'),
};

// Haptic state (to fire only on threshold crossings, not every frame)
const haptic = {
  wasAzOnTarget: false,
  wasTiltOnTarget: false,
  wasAzClose: false,
  wasTiltClose: false,
};

// ===========================================================================
// Initialization
// ===========================================================================

document.addEventListener('DOMContentLoaded', init);

function init() {
  generateCompassTicks();
  generateTiltTicks();
  bindEvents();
  requestGeolocation();
  tryLockPortrait();
}

/** Try to lock to portrait — fails silently on unsupported browsers */
function tryLockPortrait() {
  try {
    screen.orientation?.lock?.('portrait').catch(() => {});
  } catch (_) { /* not supported */ }
}

// ===========================================================================
// Event Binding
// ===========================================================================

function bindEvents() {
  // Toggle manual location entry
  dom.locationBtn.addEventListener('click', () => {
    const manual = dom.locationManual;
    const isHidden = manual.hidden;
    manual.hidden = !isHidden;
    if (!isHidden) return;
    // Pre-fill with current coords if available
    if (state.lat !== null) {
      dom.manualLat.value = state.lat.toFixed(1);
      dom.manualLon.value = state.lon.toFixed(1);
    }
    dom.manualLat.focus();
  });

  // Manual submit with inline validation
  dom.manualSubmit.addEventListener('click', () => {
    const lat = parseFloat(dom.manualLat.value);
    const lon = parseFloat(dom.manualLon.value);
    let valid = true;

    // Validate latitude
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setFieldError(dom.manualLat, dom.latError, 'Enter latitude (−90 to 90)');
      valid = false;
    } else {
      clearFieldError(dom.manualLat, dom.latError);
    }

    // Validate longitude
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setFieldError(dom.manualLon, dom.lonError, 'Enter longitude (−180 to 180)');
      valid = false;
    } else {
      clearFieldError(dom.manualLon, dom.lonError);
    }

    if (!valid) return;

    dom.locationManual.hidden = true;
    setLocation(lat, lon, `${lat.toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`);
  });

  // Clear errors on input
  dom.manualLat.addEventListener('input', () => clearFieldError(dom.manualLat, dom.latError));
  dom.manualLon.addEventListener('input', () => clearFieldError(dom.manualLon, dom.lonError));

  // Sensor permission button
  dom.permissionBtn.addEventListener('click', async () => {
    const result = await compass.requestPermission();
    if (result === 'granted' || result === 'not-needed') {
      startSensors();
    } else {
      dom.permissionBtn.textContent = 'Permission Denied — check browser settings';
      dom.permissionBtn.disabled = true;
      dom.permissionBtn.style.opacity = '0.5';
      showNoSensorFallback();
    }
  });

  // High-contrast outdoor mode toggle
  if (dom.contrastBtn) {
    dom.contrastBtn.addEventListener('click', () => {
      document.body.classList.toggle('high-contrast');
      dom.contrastBtn.setAttribute('aria-pressed',
        document.body.classList.contains('high-contrast'));
    });
  }
}

// ===========================================================================
// Geolocation
// ===========================================================================

function requestGeolocation() {
  if (!('geolocation' in navigator)) {
    showManualEntry('Geolocation not available');
    return;
  }

  dom.locationText.textContent = 'Detecting location…';
  showSpinner(true);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      showSpinner(false);
      const { latitude, longitude } = pos.coords;
      reverseGeocode(latitude, longitude).then(name => {
        setLocation(latitude, longitude, name);
      });
    },
    (err) => {
      showSpinner(false);
      console.warn('Geolocation error:', err.message);
      showManualEntry('Location unavailable — enter manually');
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

function showSpinner(visible) {
  if (dom.locationSpinner) {
    dom.locationSpinner.classList.toggle('spinner--hidden', !visible);
  }
}

// ===========================================================================
// Validation Helpers
// ===========================================================================

function setFieldError(input, errorEl, message) {
  input.style.borderColor = 'var(--red)';
  input.setAttribute('aria-invalid', 'true');
  if (errorEl) errorEl.textContent = message;
}

function clearFieldError(input, errorEl) {
  input.style.borderColor = '';
  input.removeAttribute('aria-invalid');
  if (errorEl) errorEl.textContent = '';
}

// ===========================================================================
// Haptic Feedback — fires only on threshold crossings
// ===========================================================================

function vibrateOnce(ms = 15) {
  try { navigator.vibrate?.(ms); } catch (_) {}
}

function vibratePattern(pattern) {
  try { navigator.vibrate?.(pattern); } catch (_) {}
}

/**
 * Fire haptic feedback when the user crosses an alignment threshold.
 * Only triggers on the transition into a new zone, not on every frame.
 */
function updateHaptics(azOnTarget, tiltOnTarget, azClose, tiltClose) {
  // Perfect alignment: both channels on-target — celebration pattern
  if (azOnTarget && tiltOnTarget && !(haptic.wasAzOnTarget && haptic.wasTiltOnTarget)) {
    vibratePattern([15, 50, 15]);
  }
  // Single channel crosses into on-target zone
  else if (azOnTarget && !haptic.wasAzOnTarget)   vibrateOnce(15);
  else if (tiltOnTarget && !haptic.wasTiltOnTarget) vibrateOnce(15);
  // Single channel enters close zone
  else if (azClose && !haptic.wasAzClose && !azOnTarget)   vibrateOnce(10);
  else if (tiltClose && !haptic.wasTiltClose && !tiltOnTarget) vibrateOnce(10);

  haptic.wasAzOnTarget = azOnTarget;
  haptic.wasTiltOnTarget = tiltOnTarget;
  haptic.wasAzClose = azClose;
  haptic.wasTiltClose = tiltClose;
}

/**
 * Attempt reverse geocoding via Nominatim (best-effort, no API key needed).
 * Falls back to formatted coords on failure.
 */
async function reverseGeocode(lat, lon) {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const country = addr.country_code ? addr.country_code.toUpperCase() : '';
    if (city) return `${city}${country ? ', ' + country : ''}`;
  } catch (e) {
    // Silently fall back
  }
  return `${lat.toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}

function showManualEntry(message) {
  dom.locationText.textContent = message || 'Enter your location';
  dom.locationManual.hidden = false;
  dom.manualLat.focus();
}

// ===========================================================================
// Location → Compute Optimal
// ===========================================================================

function setLocation(lat, lon, displayName) {
  state.lat = lat;
  state.lon = lon;
  state.locationName = displayName;

  // Update location display
  dom.locationText.textContent = displayName;
  dom.locationCoords.textContent = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;

  // Compute optimal orientation
  const { tilt, azimuth } = computeOptimalOrientation(lat);
  state.optimalTilt = tilt;
  state.optimalAzimuth = azimuth;

  // Compute optimal yield (reference)
  state.optimalYield = estimateYieldKwhPerKwp(lat, tilt, azimuth);

  // Show optimal values
  dom.optimalTilt.textContent = `${tilt}°`;
  dom.optimalAzimuth.textContent = `${azimuth}° (${azimuthToCardinal(azimuth)})`;
  dom.optimalSection.hidden = false;

  // Update compass target marker + zone arcs
  dom.compassTarget.setAttribute('transform', `rotate(${azimuth} 150 150)`);
  updateCompassZoneArcs(azimuth);

  // Update tilt target marker + zone arcs
  positionTiltTarget(tilt);
  updateTiltZoneArcs(tilt);

  // Show optimal yield in yield panel
  dom.yieldOptimal.textContent = `${state.optimalYield.toLocaleString()} kWh/kWp`;

  // Decide next step: try sensors or show fallback
  if (compass.isSupported()) {
    if (compass.needsPermission()) {
      dom.permissionSection.hidden = false;
    } else {
      startSensors();
    }
  } else {
    showNoSensorFallback();
  }
}

// ===========================================================================
// Sensors
// ===========================================================================

function startSensors() {
  dom.permissionSection.hidden = true;
  dom.compassSection.hidden = false;
  dom.tiltSection.hidden = false;
  dom.yieldSection.hidden = false;
  dom.statusSection.hidden = false;
  dom.footer.hidden = false;
  dom.nosensorSection.hidden = true;

  document.body.classList.add('sensors-active');

  compass.start(onSensorUpdate);
  state.sensorsActive = true;
}

function showNoSensorFallback() {
  dom.permissionSection.hidden = true;
  dom.nosensorSection.hidden = false;
  dom.yieldSection.hidden = false;
  dom.statusSection.hidden = false;

  // Show optimal yield info without sensors
  if (state.lat !== null) {
    dom.yieldCurrent.textContent = '— kWh/kWp';
    dom.yieldOptimal.textContent = `${state.optimalYield.toLocaleString()} kWh/kWp`;
    dom.yieldLoss.textContent = 'Sensors needed';
    dom.yieldPct.textContent = '—';
    dom.statusText.textContent = 'Use values above to align panel';
    dom.statusYield.textContent = `Optimal: ~${state.optimalYield.toLocaleString()} kWh/kWp/yr`;
    dom.statusSection.className = 'status';
  }
}

// ===========================================================================
// Sensor Update Loop
// ===========================================================================

let _rafId = null;

function onSensorUpdate({ heading, tilt }) {
  state.currentHeading = heading;
  state.currentTilt = tilt;

  // Throttle DOM updates to animation frames
  if (_rafId) return;
  _rafId = requestAnimationFrame(() => {
    _rafId = null;
    updateUI();
  });
}

// ===========================================================================
// UI Update — Called on every animation frame with new sensor data
// ===========================================================================

function updateUI() {
  const { currentHeading, currentTilt, optimalTilt, optimalAzimuth, lat, optimalYield } = state;
  if (currentHeading === null || lat === null) return;

  // -----------------------------------------------------------------------
  // 1. Compute yield from live sensor readings
  // -----------------------------------------------------------------------
  const useTilt = currentTilt !== null ? currentTilt : optimalTilt;
  state.currentYield = estimateYieldKwhPerKwp(lat, useTilt, currentHeading);
  state.currentPct = optimalYield > 0
    ? Math.round((state.currentYield / optimalYield) * 100)
    : 0;

  // -----------------------------------------------------------------------
  // 2. Update Compass
  // -----------------------------------------------------------------------
  dom.compassNeedle.setAttribute('transform', `rotate(${currentHeading} 150 150)`);
  dom.headingValue.textContent = Math.round(currentHeading);
  dom.headingCardinal.textContent = azimuthToCardinal(currentHeading);

  // Heading delta + directional guidance
  const azDelta = angleDelta(currentHeading, optimalAzimuth);
  const absAzDelta = Math.abs(azDelta);

  if (absAzDelta <= THRESHOLD_ON_TARGET) {
    dom.headingDelta.textContent = 'On target ✓';
    dom.headingDelta.className = 'compass__delta delta--on-target';
    dom.compassGuideArrow.setAttribute('opacity', '0');
  } else {
    const dir = azDelta > 0 ? 'clockwise' : 'counter-clockwise';
    const arrow = azDelta > 0 ? '↻' : '↺';
    dom.headingDelta.textContent = `${arrow} Rotate ${Math.round(absAzDelta)}° ${dir}`;
    dom.headingDelta.className = absAzDelta <= THRESHOLD_CLOSE
      ? 'compass__delta delta--close'
      : 'compass__delta delta--off';

    // Point the guide arrow toward the target direction
    dom.compassGuideArrow.setAttribute('transform', `rotate(${optimalAzimuth} 150 150)`);
    dom.compassGuideArrow.setAttribute('opacity', absAzDelta <= THRESHOLD_CLOSE ? '0.5' : '0.7');
  }

  // -----------------------------------------------------------------------
  // 3. Update Tilt
  // -----------------------------------------------------------------------
  if (currentTilt !== null) {
    const tiltAngle = Math.min(90, Math.max(0, currentTilt));
    positionTiltIndicator(tiltAngle);
    dom.tiltValue.textContent = Math.round(currentTilt);

    const tiltDiff = currentTilt - optimalTilt;
    const absTiltDiff = Math.abs(tiltDiff);

    if (absTiltDiff <= THRESHOLD_ON_TARGET) {
      dom.tiltDelta.textContent = 'Perfect tilt ✓';
      dom.tiltDelta.className = 'tilt__delta delta--on-target';
      dom.tiltGuideArrow.setAttribute('opacity', '0');
    } else {
      const dir = tiltDiff > 0 ? 'down' : 'up';
      const arrow = tiltDiff > 0 ? '▽' : '△';
      dom.tiltDelta.textContent = `${arrow} Tilt ${dir} ${Math.round(absTiltDiff)}°`;
      dom.tiltDelta.className = absTiltDiff <= THRESHOLD_CLOSE
        ? 'tilt__delta delta--close'
        : 'tilt__delta delta--off';

      // Position directional arrow near the target on the arc
      positionTiltGuideArrow(optimalTilt, tiltDiff);
      dom.tiltGuideArrow.setAttribute('opacity', absTiltDiff <= THRESHOLD_CLOSE ? '0.5' : '0.7');
    }
  }

  // -----------------------------------------------------------------------
  // 4. Update Yield Panel (live from sensor readings)
  // -----------------------------------------------------------------------
  updateYieldDisplay();

  // -----------------------------------------------------------------------
  // 5. Update Status
  // -----------------------------------------------------------------------
  updateStatus();
}

// ===========================================================================
// Yield Display — driven by sensor readings
// ===========================================================================

function updateYieldDisplay() {
  const { currentYield, optimalYield, currentPct } = state;
  if (currentYield === null || optimalYield === null) return;

  // Percentage text
  dom.yieldPct.textContent = `${currentPct}%`;

  // Circular gauge arc
  const pctClamped = Math.min(100, Math.max(0, currentPct));
  const offset = GAUGE_CIRCUMFERENCE * (1 - pctClamped / 100);
  dom.yieldArc.setAttribute('stroke-dashoffset', offset.toFixed(1));

  // Gauge color based on yield percentage
  let gaugeColor, panelClass;
  if (currentPct >= 97) {
    gaugeColor = 'var(--success)';
    panelClass = 'yield yield--on-target';
  } else if (currentPct >= 85) {
    gaugeColor = 'var(--amber)';
    panelClass = 'yield yield--close';
  } else {
    gaugeColor = 'var(--red)';
    panelClass = 'yield yield--off';
  }
  dom.yieldArc.setAttribute('stroke', gaugeColor);
  dom.yieldSection.className = panelClass;

  // Current yield value
  dom.yieldCurrent.textContent = `${currentYield.toLocaleString()} kWh/kWp`;

  // Loss
  const lossKwh = optimalYield - currentYield;
  if (lossKwh <= 0) {
    dom.yieldLoss.textContent = 'None';
    dom.yieldLoss.style.color = 'var(--green-dark)';
  } else {
    dom.yieldLoss.textContent = `−${lossKwh.toLocaleString()} kWh/kWp`;
    dom.yieldLoss.style.color = '';
  }
}

// ===========================================================================
// Status Bar — overall alignment state
// ===========================================================================

function updateStatus() {
  const { currentHeading, currentTilt, optimalTilt, optimalAzimuth, currentPct } = state;
  if (currentHeading === null) return;

  const azDelta = Math.abs(angleDelta(currentHeading, optimalAzimuth));
  const tiltDelta = currentTilt !== null ? Math.abs(currentTilt - optimalTilt) : 999;

  const azOnTarget = azDelta <= THRESHOLD_ON_TARGET;
  const tiltOnTarget = tiltDelta <= THRESHOLD_ON_TARGET;
  const azClose = azDelta <= THRESHOLD_CLOSE;
  const tiltClose = tiltDelta <= THRESHOLD_CLOSE;

  // Fire haptic feedback on threshold crossings
  updateHaptics(azOnTarget, tiltOnTarget, azClose, tiltClose);

  const checkSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const targetSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
  const sunSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';

  if (azOnTarget && tiltOnTarget) {
    dom.statusSection.className = 'status status--on-target';
    dom.statusText.textContent = 'Perfectly aligned!';
    dom.statusIcon.innerHTML = checkSvg;
    dom.statusYield.textContent =
      `Tilt: ${Math.round(currentTilt)}° · Azimuth: ${Math.round(currentHeading)}° (${azimuthToCardinal(currentHeading)})`;
  } else if (azClose && tiltClose) {
    dom.statusSection.className = 'status status--close';
    dom.statusText.textContent = 'Almost there…';
    dom.statusIcon.innerHTML = targetSvg;
    dom.statusYield.textContent =
      `${currentPct}% of maximum — adjust a few degrees`;
  } else {
    dom.statusSection.className = 'status status--off';
    dom.statusText.textContent = 'Aligning…';
    dom.statusIcon.innerHTML = sunSvg;
    dom.statusYield.textContent =
      `${currentPct}% of maximum — follow the guidance above`;
  }
}

// ===========================================================================
// Compass Zone Arcs — colored zones around the target azimuth
// ===========================================================================

/**
 * Draw SVG arc paths for ±10° (amber) and ±3° (green) zones around target.
 * Arcs sit on the compass outer ring at radius 135.
 */
function updateCompassZoneArcs(targetAz) {
  const cx = 150, cy = 150, r = 135;

  dom.compassZoneAmber.setAttribute('d',
    describeArc(cx, cy, r, targetAz - THRESHOLD_CLOSE, targetAz + THRESHOLD_CLOSE));
  dom.compassZoneGreen.setAttribute('d',
    describeArc(cx, cy, r, targetAz - THRESHOLD_ON_TARGET, targetAz + THRESHOLD_ON_TARGET));
}

/**
 * Draw SVG arc paths for ±10° (amber) and ±3° (green) zones around target tilt.
 */
function updateTiltZoneArcs(targetTilt) {
  const amberLo = Math.max(0, targetTilt - THRESHOLD_CLOSE);
  const amberHi = Math.min(90, targetTilt + THRESHOLD_CLOSE);
  const greenLo = Math.max(0, targetTilt - THRESHOLD_ON_TARGET);
  const greenHi = Math.min(90, targetTilt + THRESHOLD_ON_TARGET);

  dom.tiltZoneAmber.setAttribute('d',
    describeTiltArc(TILT_CX, TILT_CY, TILT_R, amberLo, amberHi));
  dom.tiltZoneGreen.setAttribute('d',
    describeTiltArc(TILT_CX, TILT_CY, TILT_R, greenLo, greenHi));
}

// ===========================================================================
// SVG Helpers
// ===========================================================================

/** Describe a circular arc path for the compass (0°=up/North, clockwise). */
function describeArc(cx, cy, r, startAngle, endAngle) {
  // Convert compass degrees (0=N, clockwise) to SVG degrees (0=right, clockwise)
  const s = startAngle - 90;
  const e = endAngle - 90;
  const sRad = s * Math.PI / 180;
  const eRad = e * Math.PI / 180;

  const x1 = cx + r * Math.cos(sRad);
  const y1 = cy + r * Math.sin(sRad);
  const x2 = cx + r * Math.cos(eRad);
  const y2 = cy + r * Math.sin(eRad);

  const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;

  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/**
 * Describe a tilt arc path.
 * Tilt 0° is at the left (180° in standard), 90° is at the top (90° in standard).
 */
function describeTiltArc(cx, cy, r, tiltLo, tiltHi) {
  // Map tilt → standard angle: angle = 180 - tilt
  const aStart = (180 - tiltHi) * Math.PI / 180;  // higher tilt = further right
  const aEnd = (180 - tiltLo) * Math.PI / 180;

  const x1 = cx + r * Math.cos(aStart);
  const y1 = cy - r * Math.sin(aStart);
  const x2 = cx + r * Math.cos(aEnd);
  const y2 = cy - r * Math.sin(aEnd);

  const sweep = (tiltHi - tiltLo) > 90 ? 1 : 0;

  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${sweep} 0 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/**
 * Position the tilt directional guide arrow near the target on the arc.
 * Arrow points toward the target tilt (up or down along the arc).
 */
function positionTiltGuideArrow(targetTilt, tiltDiff) {
  const arcAngle = 180 - targetTilt;
  const rad = arcAngle * Math.PI / 180;
  const arrowR = TILT_R - 18;
  const x = TILT_CX + arrowR * Math.cos(rad);
  const y = TILT_CY - arrowR * Math.sin(rad);

  // Rotate arrow to point along the arc toward target
  const arrowRotation = tiltDiff > 0 ? arcAngle + 90 : arcAngle - 90;

  dom.tiltGuideArrow.setAttribute('transform',
    `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${arrowRotation.toFixed(1)})`);
}

// ===========================================================================
// SVG Generators
// ===========================================================================

/**
 * Generate compass tick marks (every 10°, major every 30°).
 */
function generateCompassTicks() {
  const svg = dom.compassTicks;
  let html = '';
  for (let deg = 0; deg < 360; deg += 10) {
    const isMajor = deg % 30 === 0;
    const y1 = isMajor ? 18 : 22;
    const y2 = isMajor ? 38 : 32;
    const sw = isMajor ? 2 : 1;
    const op = isMajor ? 0.5 : 0.25;
    html += `<line x1="150" y1="${y1}" x2="150" y2="${y2}" `
         + `stroke="var(--ink)" stroke-width="${sw}" stroke-linecap="round" `
         + `opacity="${op}" transform="rotate(${deg} 150 150)"/>`;
  }
  svg.innerHTML = html;
}

/**
 * Generate tilt arc tick marks (every 10°, 0° to 90°).
 * Arc: center (150,140), radius 120, from 180° to 0° (left to right = 0° to 90° tilt).
 */
function generateTiltTicks() {
  const svg = dom.tiltTicks;
  let html = '';

  for (let deg = 0; deg <= 90; deg += 10) {
    const arcAngle = 180 - deg;
    const rad = arcAngle * Math.PI / 180;
    const isMajor = deg % 30 === 0;

    const outerR = TILT_R + (isMajor ? 10 : 5);
    const innerR = TILT_R - (isMajor ? 3 : 0);

    const x1 = TILT_CX + innerR * Math.cos(rad);
    const y1 = TILT_CY - innerR * Math.sin(rad);
    const x2 = TILT_CX + outerR * Math.cos(rad);
    const y2 = TILT_CY - outerR * Math.sin(rad);

    const sw = isMajor ? 1.5 : 0.8;
    const op = isMajor ? 0.4 : 0.2;

    html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" `
         + `x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" `
         + `stroke="var(--ink)" stroke-width="${sw}" stroke-linecap="round" `
         + `opacity="${op}"/>`;

    if (isMajor && deg > 0 && deg < 90) {
      const labelR = TILT_R + 18;
      const lx = TILT_CX + labelR * Math.cos(rad);
      const ly = TILT_CY - labelR * Math.sin(rad);
      html += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" `
           + `font-size="10" fill="var(--ink-light)" text-anchor="middle" `
           + `dominant-baseline="central" font-family="var(--font-sans)" opacity="0.5">`
           + `${deg}°</text>`;
    }
  }

  svg.innerHTML = html;
}

/**
 * Position the tilt target marker on the arc.
 */
function positionTiltTarget(tiltDeg) {
  const arcAngle = 180 - tiltDeg;
  const rad = arcAngle * Math.PI / 180;
  const x = TILT_CX + TILT_R * Math.cos(rad);
  const y = TILT_CY - TILT_R * Math.sin(rad);
  dom.tiltTarget.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
}

/**
 * Update the tilt indicator (needle) on the arc.
 */
function positionTiltIndicator(tiltDeg) {
  const r = 110;
  const arcAngle = 180 - tiltDeg;
  const rad = arcAngle * Math.PI / 180;
  const x2 = TILT_CX + r * Math.cos(rad);
  const y2 = TILT_CY - r * Math.sin(rad);

  const line = dom.tiltIndicator.querySelector('line');
  if (line) {
    line.setAttribute('x2', x2.toFixed(1));
    line.setAttribute('y2', y2.toFixed(1));
  }
}
