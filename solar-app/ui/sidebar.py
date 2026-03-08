# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Streamlit sidebar controls — returns all user-configured parameters.
"""

from __future__ import annotations
import streamlit as st
import pandas as pd
import numpy as np
import requests

from core.losses import LossBudget
from core import system as sys_mod


def render_sidebar(
    cec_modules: pd.DataFrame,
    cec_inverters: pd.DataFrame,
) -> dict:
    """
    Render all sidebar controls and return a configuration dict with keys:
      lat, lon, elevation_m,
      tilt_deg, panel_az_deg, albedo,
      module_params, inverter_params, inverter_type,
      n_modules, strings_per_inverter, n_inverters,
      loss_budget, degradation_rate,
      horizon_azimuths, horizon_elevations,
      econ (dict with Economics parameters),
      tilt_step, az_step,
      fetch_climate (bool)
    """
    st.sidebar.title("Solar Advisor")
    st.sidebar.caption(
        "Enter your location and system details below, then click "
        "**Fetch Climate Data** to run the simulation."
    )

    cfg = {}

    # -----------------------------------------------------------------------
    # 1. Location
    # -----------------------------------------------------------------------
    with st.sidebar.expander("📍 Location", expanded=True):

        # City geocoding — primary, intuitive input
        city_input = st.text_input(
            "Search by city or address",
            placeholder="e.g. Munich, Germany",
            key="city_search",
            help="Type any city, town, or address — we'll look up the coordinates automatically.",
        )
        if st.button("Look up →", use_container_width=True, key="geocode_btn"):
            if city_input.strip():
                with st.spinner("Finding location…"):
                    coords = _geocode(city_input)
                if coords:
                    st.session_state["geo_lat"] = coords[0]
                    st.session_state["geo_lon"] = coords[1]
                    st.session_state["geo_place"] = coords[2]
                else:
                    st.error("Location not found — try a more specific city name.")

        if "geo_place" in st.session_state:
            parts = st.session_state["geo_place"].split(",")
            st.success(f"📍 {parts[0].strip()}, {parts[-1].strip()}")

        st.caption("Or enter coordinates directly:")
        col_lat, col_lon = st.columns(2)
        with col_lat:
            cfg["lat"] = st.number_input(
                "Latitude [°]",
                min_value=-90.0, max_value=90.0,
                value=float(st.session_state.get("geo_lat", 52.5)),
                step=0.5, format="%.2f",
                help=(
                    "Degrees north (+) or south (−) of the equator.\n\n"
                    "Examples: London 51.5°, Madrid 40.4°, Sydney −33.9°"
                ),
            )
        with col_lon:
            cfg["lon"] = st.number_input(
                "Longitude [°]",
                min_value=-180.0, max_value=180.0,
                value=float(st.session_state.get("geo_lon", 13.4)),
                step=0.5, format="%.2f",
                help=(
                    "Degrees east (+) or west (−) of the prime meridian "
                    "(0° = Greenwich, UK)."
                ),
            )

        cfg["elevation_m"] = st.number_input(
            "Elevation [m above sea level]",
            min_value=0, max_value=5000, value=100, step=50,
            help=(
                "Your site's altitude. Higher elevations receive slightly more solar "
                "radiation because the atmosphere is thinner. "
                "Coastal and lowland sites: 0–100 m."
            ),
        )

        cfg["fetch_climate"] = st.button(
            "⬇ Fetch Climate Data",
            use_container_width=True,
            type="primary",
            help=(
                "Downloads 20+ years of typical weather data from the EU PVGIS "
                "satellite database (SARAH3/ERA5) for this location. "
                "This step is required before the simulation can run."
            ),
        )

    # -----------------------------------------------------------------------
    # 2. Panel Orientation
    # -----------------------------------------------------------------------
    with st.sidebar.expander("🧭 Panel Orientation", expanded=True):

        hemisphere = "Northern" if cfg["lat"] >= 0 else "Southern"
        ideal_dir  = "south (180°)"  if cfg["lat"] >= 0 else "north (0°)"
        st.info(
            f"You are in the **{hemisphere} hemisphere** — "
            f"panels should generally face {ideal_dir} to capture the most sunlight.",
            icon="💡",
        )

        default_tilt = _optimal_tilt_guess(cfg["lat"])
        cfg["tilt_deg"] = st.slider(
            "Tilt angle [°]",
            0, 90, default_tilt,
            help=(
                "How steeply the panels are tilted from horizontal.\n\n"
                "• **0°** = completely flat (like a skylight)\n"
                "• **30–40°** = typical rooftop pitch\n"
                "• **90°** = vertical (like a wall)\n\n"
                f"Recommended for your latitude: **{default_tilt}°**"
            ),
        )

        default_az = 0 if cfg["lat"] < 0 else 180
        az_val = st.slider(
            "Facing direction [°]",
            0, 359, default_az,
            help=(
                "The compass direction the panel surface faces.\n\n"
                "• **0°** = North  •  **90°** = East\n"
                "• **180°** = South  •  **270°** = West"
            ),
        )
        cfg["panel_az_deg"] = az_val
        st.caption(f"Panels face **{_az_label(az_val)}** ({az_val}°)")

        cfg["albedo"] = st.slider(
            "Ground reflectivity (albedo)",
            0.05, 0.50, 0.20, 0.01,
            help=(
                "How much sunlight the ground around the panels reflects back onto "
                "the underside of tilted panels.\n\n"
                "• **0.10–0.20** = grass, dark soil, asphalt\n"
                "• **0.25–0.35** = gravel, light concrete, sand\n"
                "• **0.50–0.80** = fresh snow (not selectable here — use 0.50 max)"
            ),
        )

    # -----------------------------------------------------------------------
    # 3. PV System
    # -----------------------------------------------------------------------
    with st.sidebar.expander("⚡ PV System", expanded=True):

        # --- Module ---
        st.markdown("**Solar panel model**")
        module_source = st.radio(
            "Specify panel by",
            ["CEC Database", "Simple spec", "PVsyst .pan file"],
            horizontal=True,
            key="mod_src",
            help=(
                "**CEC Database** — search 21,000+ real products by brand "
                "(recommended for most users).\n\n"
                "**Simple spec** — just enter peak power and a few values from "
                "the panel datasheet.\n\n"
                "**PVsyst .pan** — import a detailed manufacturer file "
                "from PVsyst software."
            ),
        )

        if module_source == "CEC Database":
            mod_query = st.text_input(
                "Search by brand or model",
                "Canadian Solar",
                key="mod_q",
                placeholder="e.g. SunPower, Jinko, LG, LONGi…",
            )
            mod_names = sys_mod.search_modules(mod_query, cec_modules)
            if mod_names:
                mod_sel = st.selectbox(
                    "Select panel model", mod_names, key="mod_sel",
                    help="Choose the specific model from the filtered list.",
                )
                module_params = sys_mod.get_module_params(mod_sel, cec_modules)
                p    = module_params
                pdc0 = float(p.get("pdc0", p.get("V_mp_ref", 30) * p.get("I_mp_ref", 8)))
                voc  = float(p.get("V_oc_ref", 0))
                if voc > 0:
                    st.caption(
                        f"Peak power: **{pdc0:.0f} W**  ·  "
                        f"Open-circuit voltage: {voc:.1f} V"
                    )
            else:
                st.warning("No matching panels — try a different brand name.")
                module_params = _default_module_params()

        elif module_source == "PVsyst .pan file":
            pan_file = st.file_uploader(
                "Upload .pan file", type=["pan"], key="pan_up",
                help=(
                    "PVsyst .pan files contain detailed one-diode model parameters "
                    "supplied by the panel manufacturer."
                ),
            )
            if pan_file:
                try:
                    result = sys_mod.load_panond(pan_file)
                    module_params = result["params"]
                    st.success(f"Loaded: {result['name']}")
                except Exception as e:
                    st.error(f"Could not read file: {e}")
                    module_params = _default_module_params()
            else:
                st.info("Upload a PVsyst .pan file to use your panel's exact parameters.")
                module_params = _default_module_params()

        else:
            module_params = _render_simple_module_spec()

        cfg["module_params"] = module_params

        st.divider()

        # --- Inverter ---
        st.markdown("**Inverter** *(converts solar DC power to household AC)*")
        inv_source = st.radio(
            "Specify inverter by",
            ["CEC Database", "PVWatts (simple)", "PVsyst .ond file"],
            horizontal=True,
            key="inv_src",
            help=(
                "**CEC Database** — search 3,000+ real inverters by brand "
                "(most accurate).\n\n"
                "**PVWatts** — specify efficiency as a percentage "
                "(simpler, slightly less accurate).\n\n"
                "**PVsyst .ond** — import a detailed manufacturer file."
            ),
        )

        if inv_source == "CEC Database":
            inv_query = st.text_input(
                "Search by brand",
                "SMA",
                key="inv_q",
                placeholder="e.g. SMA, Fronius, Huawei, Solis…",
            )
            inv_names = sys_mod.search_inverters(inv_query, cec_inverters)
            if inv_names:
                inv_sel = st.selectbox(
                    "Select inverter model", inv_names, key="inv_sel",
                )
                inverter_params = sys_mod.get_inverter_params(inv_sel, cec_inverters)
                cfg["inverter_type"] = "sandia"
                paco = float(inverter_params.get("Paco", 0)) / 1000
                if paco > 0:
                    st.caption(f"Rated AC output: **{paco:.1f} kW**")
            else:
                st.warning("No matching inverters.")
                inverter_params = _default_inverter_params()
                cfg["inverter_type"] = "pvwatts"

        elif inv_source == "PVsyst .ond file":
            ond_file = st.file_uploader(
                "Upload .ond file", type=["ond"], key="ond_up",
                help="PVsyst .ond files contain detailed inverter model parameters.",
            )
            if ond_file:
                try:
                    result = sys_mod.load_panond(ond_file)
                    inverter_params = result["params"]
                    cfg["inverter_type"] = "sandia"
                    st.success(f"Loaded: {result['name']}")
                except Exception as e:
                    st.error(f"Could not read file: {e}")
                    inverter_params = _default_inverter_params()
                    cfg["inverter_type"] = "pvwatts"
            else:
                st.info("Upload a PVsyst .ond file.")
                inverter_params = _default_inverter_params()
                cfg["inverter_type"] = "pvwatts"

        else:
            pdc0_kw = st.number_input(
                "Inverter rated AC power [kW]",
                0.5, 500.0, 5.0, 0.5,
                help=(
                    "The maximum AC power the inverter can deliver continuously. "
                    "Should be roughly equal to your array's DC peak power."
                ),
            )
            eta_pct = st.slider(
                "Inverter efficiency [%]",
                90.0, 99.5, 97.0, 0.5,
                help=(
                    "Fraction of DC solar power successfully converted to AC. "
                    "Modern string inverters: 97–99%  ·  Older models: 93–96%"
                ),
            )
            inverter_params = sys_mod.pvwatts_inverter(pdc0_kw, eta_pct)
            cfg["inverter_type"] = "pvwatts"

        cfg["inverter_params"] = inverter_params

        st.divider()

        # --- Array sizing ---
        st.markdown("**System size**")
        col1, col2 = st.columns(2)
        with col1:
            cfg["n_modules"] = st.number_input(
                "Total panels",
                1, 10000, 20, 1,
                help="Total number of solar panels in your installation.",
            )
        with col2:
            cfg["strings_per_inverter"] = st.number_input(
                "Panels per string",
                1, 100, 10, 1,
                help=(
                    "A 'string' is a chain of panels wired in series (positive-to-negative). "
                    "More panels per string = higher system voltage. "
                    "Typical for residential: 8–14 panels per string."
                ),
            )
        cfg["n_inverters"] = st.number_input(
            "Number of inverters",
            1, 1000, 2, 1,
            help=(
                "Most homes use 1–2 inverters. Larger rooftops and commercial "
                "systems use more. Micro-inverters: one per panel."
            ),
        )

        from core.energy import peak_power_kw
        pk = peak_power_kw(module_params, cfg["n_modules"])
        st.caption(f"Total DC peak power: **{pk:.1f} kWp** — {_size_label(pk)}")

    # -----------------------------------------------------------------------
    # 4. Loss Budget
    # -----------------------------------------------------------------------
    with st.sidebar.expander("🔧 Real-world Losses", expanded=False):
        st.caption(
            "Accounts for the gap between ideal lab performance and real-world output. "
            "The defaults represent a typical well-maintained rooftop system."
        )

        iam_model = st.selectbox(
            "Glass coating model",
            ["physical", "ashrae", "none"],
            format_func=lambda x: {
                "physical": "Anti-reflective glass (recommended)",
                "ashrae":   "Standard glass (ASHRAE formula)",
                "none":     "No angle correction",
            }[x],
            help=(
                "Models how much sunlight reflects off the panel glass when "
                "the sun is at a low angle. Anti-reflective (AR) coatings on "
                "modern panels reduce this loss. Choose 'Anti-reflective glass' "
                "unless you know your panels use standard glass."
            ),
        )

        soiling = st.slider(
            "Soiling — dust & dirt [%]",
            0.0, 10.0, 2.0, 0.5,
            help=(
                "Yield lost because dust, pollen, or bird droppings block light.\n\n"
                "• **1–3%** — regular rainfall, clean environment\n"
                "• **3–6%** — dry or dusty climate\n"
                "• **Up to 15%** — arid / desert sites without cleaning"
            ),
        ) / 100

        lid = st.slider(
            "First-year degradation — LID [%]",
            0.0, 3.0, 1.5, 0.1,
            help=(
                "**Light-Induced Degradation**: panels permanently lose a small amount "
                "of efficiency in their first weeks of sun exposure, then stabilise.\n\n"
                "• **1–2%** — standard monocrystalline (PERC)\n"
                "• **< 0.5%** — premium HJT / TOPCon technology\n"
                "• **~3%** — older multicrystalline panels"
            ),
        ) / 100

        mismatch = st.slider(
            "Module mismatch [%]",
            0.0, 3.0, 1.0, 0.1,
            help=(
                "No two panels are exactly identical — small differences in output "
                "reduce overall array performance.\n\n"
                "• **0.5–1%** — factory-sorted panels from same batch\n"
                "• **1–2%** — mixed batches or older installations"
            ),
        ) / 100

        dc_wiring = st.slider(
            "DC cable losses [%]",
            0.0, 5.0, 1.5, 0.1,
            help=(
                "Energy lost as heat in the DC cables between panels and inverter.\n\n"
                "• **0.5–1%** — short, well-sized cables\n"
                "• **1.5–2.5%** — longer cable runs"
            ),
        ) / 100

        availability_pct = st.slider(
            "System availability [%]",
            95.0, 100.0, 99.0, 0.1,
            help=(
                "Percentage of time the system is actually generating power. "
                "100% minus downtime from maintenance, faults, or grid outages.\n\n"
                "• **99–99.5%** — monitored system with remote access\n"
                "• **97–99%** — unmonitored or older system"
            ),
        )
        availability = 1.0 - availability_pct / 100

        ac_wiring = st.slider(
            "AC cable losses [%]",
            0.0, 3.0, 0.5, 0.1,
            help=(
                "Energy lost as heat in the AC cables from inverter to the meter.\n\n"
                "• **0.3–0.8%** — typical residential installation"
            ),
        ) / 100

        transformer = st.slider(
            "Transformer losses [%]",
            0.0, 3.0, 1.0, 0.1,
            help=(
                "Losses in a step-up transformer, if your system uses one. "
                "Most residential rooftop installations do **not** have a separate "
                "transformer — set this to 0% if unsure."
            ),
        ) / 100

        degradation_rate_pct = st.slider(
            "Annual module degradation [%/yr]",
            0.0, 2.0, 0.50, 0.05,
            help=(
                "Linear yield loss per year after first-year LID. "
                "Premium HJT/TOPCon: ~0.3%/yr  ·  Standard PERC: 0.4–0.7%/yr  ·  Budget: ~0.8%/yr"
            ),
        )
        cfg["degradation_rate"] = degradation_rate_pct / 100.0

        cfg["loss_budget"] = LossBudget(
            iam_model=iam_model,
            soiling=soiling,
            lid=lid,
            mismatch=mismatch,
            dc_wiring=dc_wiring,
            availability=availability,
            ac_wiring=ac_wiring,
            transformer=transformer,
        )

        total_loss = (
            cfg["loss_budget"].total_dc_loss + cfg["loss_budget"].total_ac_loss
        ) * 100
        st.caption(f"Combined system losses: **{total_loss:.1f}%**")

    # -----------------------------------------------------------------------
    # 5. Near Shading / Horizon Profile
    # -----------------------------------------------------------------------
    with st.sidebar.expander("🏔 Near Shading / Horizon", expanded=False):
        st.caption(
            "Enter the horizon elevation angle (° above horizontal) at 8 compass points. "
            "Use 0° for an unobstructed horizon. "
            "Obstacles like trees or chimneys block the **direct beam** when the sun "
            "is below your entered profile."
        )
        horizon_azimuths  = [0, 45, 90, 135, 180, 225, 270, 315]
        horizon_labels    = ["N (0°)", "NE (45°)", "E (90°)", "SE (135°)",
                             "S (180°)", "SW (225°)", "W (270°)", "NW (315°)"]
        col_hz_l, col_hz_r = st.columns(2)
        horizon_elevations = []
        for i, (az, label) in enumerate(zip(horizon_azimuths, horizon_labels)):
            col = col_hz_l if i % 2 == 0 else col_hz_r
            elev = col.number_input(
                label, min_value=0.0, max_value=60.0,
                value=0.0, step=0.5, key=f"hz_{az}",
            )
            horizon_elevations.append(elev)
        cfg["horizon_azimuths"]   = tuple(horizon_azimuths)
        cfg["horizon_elevations"] = tuple(horizon_elevations)
        if any(e > 0 for e in horizon_elevations):
            max_el  = max(horizon_elevations)
            max_dir = horizon_labels[horizon_elevations.index(max_el)]
            st.caption(f"Highest obstacle: **{max_el:.1f}°** towards {max_dir}")

    # -----------------------------------------------------------------------
    # 6. Economics
    # -----------------------------------------------------------------------
    with st.sidebar.expander("💶 Economics", expanded=False):
        st.caption(
            "Financial parameters to compute payback period, NPV, and LCOE. "
            "Defaults reflect the 2024 EU residential market."
        )
        system_cost_per_wp = st.number_input(
            "System cost [€/Wp]",
            min_value=0.1, max_value=5.0, value=1.10, step=0.05,
            help="All-in installed cost per watt-peak DC. EU residential: ~0.9–1.3 €/Wp (2024).",
        )
        electricity_price = st.number_input(
            "Electricity price [€/kWh]",
            min_value=0.01, max_value=1.0, value=0.30, step=0.01,
            help="Grid electricity price you displace (or feed-in tariff if all exported).",
        )
        price_escalation_pct = st.number_input(
            "Annual price escalation [%/yr]",
            min_value=0.0, max_value=10.0, value=2.0, step=0.5,
            help="Expected annual increase in electricity price.",
        )
        discount_rate_pct = st.number_input(
            "Discount rate [%/yr]",
            min_value=0.0, max_value=15.0, value=4.0, step=0.5,
            help="Opportunity cost of capital / WACC. ~4% homeowner, ~8% commercial.",
        )
        project_lifetime_yr = st.slider(
            "Project lifetime [years]", min_value=10, max_value=30, value=25, step=1,
        )
        col_fi1, col_fi2 = st.columns(2)
        with col_fi1:
            feed_in_fraction = st.number_input(
                "Feed-in fraction [%]",
                min_value=0, max_value=100, value=30, step=5,
                help="Fraction of production exported to grid. Remainder is self-consumed.",
            )
        with col_fi2:
            feed_in_tariff = st.number_input(
                "Feed-in tariff [€/kWh]",
                min_value=0.0, max_value=0.5, value=0.08, step=0.01,
                help="Payment per kWh exported. Set equal to electricity price for net-metering.",
            )
        cfg["econ"] = {
            "cost_per_wp":    system_cost_per_wp,
            "elec_price":     electricity_price,
            "escalation":     price_escalation_pct / 100.0,
            "discount":       discount_rate_pct / 100.0,
            "degradation":    cfg["degradation_rate"],   # shared with Loss Budget slider
            "lifetime_yr":    project_lifetime_yr,
            "feed_in_frac":   feed_in_fraction / 100.0,
            "feed_in_tariff": feed_in_tariff,
        }

    # -----------------------------------------------------------------------
    # 7. Orientation sweep settings
    # -----------------------------------------------------------------------
    with st.sidebar.expander("🔍 Optimizer Settings", expanded=False):
        st.caption(
            "Controls the resolution of the orientation sweep in the "
            "**Orientation Optimizer** tab. Finer steps give more precise results "
            "but take longer to compute."
        )
        cfg["tilt_step"] = st.select_slider(
            "Tilt step [°]",
            [5, 10, 15], value=5,
            help=(
                "How many degrees between each tilt angle tested.\n"
                "5° = high precision  •  15° = fastest"
            ),
        )
        cfg["az_step"] = st.select_slider(
            "Azimuth step [°]",
            [10, 15, 20], value=10,
            help=(
                "How many degrees between each direction tested.\n"
                "10° = high precision  •  20° = fastest"
            ),
        )
        n_tilt = len(range(0, 91, cfg["tilt_step"]))
        n_az   = len(range(0, 360, cfg["az_step"]))
        st.caption(f"Grid: {n_tilt} × {n_az} = **{n_tilt * n_az} orientations**")

    return cfg


# ---------------------------------------------------------------------------
# Geocoding
# ---------------------------------------------------------------------------

def _geocode(query: str) -> tuple[float, float, str] | None:
    """
    Geocode a place name to (lat, lon, display_name) using OpenStreetMap Nominatim.
    Returns None if the location cannot be found or the request fails.
    """
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": "SolarAdvisor/1.0 (github.com/rgutzen/solarflower)"},
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"]), data[0]["display_name"]
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _optimal_tilt_guess(lat: float) -> int:
    """Simple heuristic: tilt ≈ |lat| × 0.76 + 3.1 (Jacobson & Jadhav 2018)."""
    return int(abs(lat) * 0.76 + 3.1)


def _az_label(az: float) -> str:
    """Convert azimuth degrees to a compass direction label."""
    dirs = [
        "North", "North-East", "East", "South-East",
        "South", "South-West", "West", "North-West",
    ]
    return dirs[round(az / 45) % 8]


def _size_label(pk_kw: float) -> str:
    """Describe system size in plain language."""
    if pk_kw < 2:    return "very small (off-grid / outbuilding)"
    if pk_kw < 6:    return "small residential"
    if pk_kw < 15:   return "residential"
    if pk_kw < 50:   return "small commercial"
    return "commercial / utility-scale"


def _default_module_params() -> pd.Series:
    """Generic 400 W monocrystalline module (STC)."""
    return sys_mod.parametric_module(
        pdc0=400.0, v_mp=34.0, i_mp=11.76,
        v_oc=41.0, i_sc=12.5,
        temp_coeff_pmax=-0.004, cells_in_series=66,
    )


def _default_inverter_params() -> pd.Series:
    return sys_mod.pvwatts_inverter(pdc0_kw=5.0, eff_pct=97.0)


def _render_simple_module_spec() -> pd.Series:
    st.caption(
        "Enter the values from your panel's datasheet (available on the manufacturer's website):"
    )
    col1, col2 = st.columns(2)
    with col1:
        pdc0 = st.number_input(
            "Peak power P_mp [W]", 50, 1000, 400, 10,
            help="Maximum power output under standard test conditions (STC). "
                 "This is the wattage on the label — e.g. '400 W panel'.",
        )
        v_mp = st.number_input(
            "Voltage at max power V_mp [V]", 1.0, 200.0, 34.0, 0.5,
            help="Operating voltage at maximum power point. Typical: 28–45 V for residential panels.",
        )
        v_oc = st.number_input(
            "Open-circuit voltage V_oc [V]", 1.0, 250.0, 41.0, 0.5,
            help="Voltage when the panel is disconnected (no current flowing). "
                 "Always higher than V_mp.",
        )
    with col2:
        i_mp = st.number_input(
            "Current at max power I_mp [A]", 0.1, 20.0, float(pdc0 / v_mp), 0.1,
            help="Operating current at maximum power point. Typical: 8–14 A.",
        )
        i_sc = st.number_input(
            "Short-circuit current I_sc [A]", 0.1, 25.0, float(i_mp * 1.06), 0.1,
            help="Current when the panel terminals are short-circuited. "
                 "Always slightly higher than I_mp.",
        )
        tc_p = st.number_input(
            "Temperature coefficient [%/°C]", -1.0, 0.0, -0.40, 0.01,
            help="How much power is lost per degree Celsius above 25°C. "
                 "Typical: −0.35 to −0.45 %/°C. Found on the datasheet as 'γ_Pmp'.",
        )
    cells = st.number_input(
        "Cells in series",
        20, 144, 66, 1,
        help=(
            "Number of solar cells connected in series inside the panel. "
            "60-cell ≈ older 1.6 m panels  •  72-cell ≈ commercial  •  "
            "120/132/144 half-cut ≈ modern residential"
        ),
    )
    return sys_mod.parametric_module(pdc0, v_mp, i_mp, v_oc, i_sc, tc_p / 100, cells)
