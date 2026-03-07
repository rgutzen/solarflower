# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Streamlit sidebar controls — returns all user-configured parameters.
"""

from __future__ import annotations
import streamlit as st
import pandas as pd
import numpy as np

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
      loss_budget,
      tilt_step, az_step,
      fetch_climate (bool)
    """
    st.sidebar.title("Solar Advisor")

    cfg = {}

    # -----------------------------------------------------------------------
    # 1. Location
    # -----------------------------------------------------------------------
    with st.sidebar.expander("Location", expanded=True):
        cfg["lat"] = st.slider("Latitude [°]", -90.0, 90.0, 52.5, 0.5,
                               help="Positive = Northern hemisphere")
        cfg["lon"] = st.slider("Longitude [°]", -180.0, 180.0, 13.4, 0.5)
        cfg["elevation_m"] = st.number_input("Elevation [m]", 0, 5000, 100, 50)
        cfg["fetch_climate"] = st.button("Fetch Climate Data", use_container_width=True)

    # -----------------------------------------------------------------------
    # 2. Panel Orientation
    # -----------------------------------------------------------------------
    with st.sidebar.expander("Orientation", expanded=True):
        cfg["tilt_deg"] = st.slider("Tilt [°]", 0, 90,
                                    _optimal_tilt_guess(cfg["lat"]),
                                    help="0° = horizontal, 90° = vertical")
        cfg["panel_az_deg"] = st.slider(
            "Azimuth [°]", 0, 359,
            0 if cfg["lat"] < 0 else 180,
            help="0°/360° = North, 90° = East, 180° = South, 270° = West",
        )
        cfg["albedo"] = st.slider("Ground albedo", 0.05, 0.50, 0.20, 0.01,
                                  help="Reflectivity of ground surface (grass ≈ 0.20, snow ≈ 0.60)")

    # -----------------------------------------------------------------------
    # 3. System Configuration
    # -----------------------------------------------------------------------
    with st.sidebar.expander("PV System", expanded=True):
        # --- Module ---
        st.markdown("**Module**")
        module_source = st.radio("Module source", ["CEC Database", "PVsyst .pan file", "Simple spec"],
                                 horizontal=True, key="mod_src")

        if module_source == "CEC Database":
            mod_query = st.text_input("Search module", "Canadian Solar", key="mod_q")
            mod_names = sys_mod.search_modules(mod_query, cec_modules)
            if mod_names:
                mod_sel = st.selectbox("Module", mod_names, key="mod_sel")
                module_params = sys_mod.get_module_params(mod_sel, cec_modules)
            else:
                st.warning("No matching modules. Try a different search term.")
                module_params = _default_module_params()
        elif module_source == "PVsyst .pan file":
            pan_file = st.file_uploader("Upload .pan file", type=["pan"], key="pan_up")
            if pan_file:
                try:
                    result = sys_mod.load_panond(pan_file)
                    module_params = result["params"]
                    st.success(f"Loaded: {result['name']}")
                except Exception as e:
                    st.error(f"Parse error: {e}")
                    module_params = _default_module_params()
            else:
                st.info("Upload a PVsyst .pan file to use manufacturer-specific parameters.")
                module_params = _default_module_params()
        else:
            module_params = _render_simple_module_spec()

        cfg["module_params"] = module_params

        # --- Inverter ---
        st.markdown("**Inverter**")
        inv_source = st.radio("Inverter source", ["CEC Database", "PVsyst .ond file", "PVWatts"],
                              horizontal=True, key="inv_src")

        if inv_source == "CEC Database":
            inv_query = st.text_input("Search inverter", "SMA", key="inv_q")
            inv_names = sys_mod.search_inverters(inv_query, cec_inverters)
            if inv_names:
                inv_sel = st.selectbox("Inverter", inv_names, key="inv_sel")
                inverter_params = sys_mod.get_inverter_params(inv_sel, cec_inverters)
                cfg["inverter_type"] = "sandia"
            else:
                st.warning("No matching inverters.")
                inverter_params = _default_inverter_params()
                cfg["inverter_type"] = "pvwatts"
        elif inv_source == "PVsyst .ond file":
            ond_file = st.file_uploader("Upload .ond file", type=["ond"], key="ond_up")
            if ond_file:
                try:
                    result = sys_mod.load_panond(ond_file)
                    inverter_params = result["params"]
                    cfg["inverter_type"] = "sandia"
                    st.success(f"Loaded: {result['name']}")
                except Exception as e:
                    st.error(f"Parse error: {e}")
                    inverter_params = _default_inverter_params()
                    cfg["inverter_type"] = "pvwatts"
            else:
                st.info("Upload a PVsyst .ond file.")
                inverter_params = _default_inverter_params()
                cfg["inverter_type"] = "pvwatts"
        else:
            pdc0_kw = st.number_input("Inverter AC power [kW]", 0.5, 500.0, 5.0, 0.5)
            eta_pct  = st.slider("Inverter efficiency [%]", 90.0, 99.5, 97.0, 0.5)
            inverter_params = sys_mod.pvwatts_inverter(pdc0_kw, eta_pct)
            cfg["inverter_type"] = "pvwatts"

        cfg["inverter_params"] = inverter_params

        # --- String / array sizing ---
        st.markdown("**Array sizing**")
        col1, col2 = st.columns(2)
        with col1:
            cfg["n_modules"] = st.number_input("Modules total", 1, 10000, 20, 1)
        with col2:
            cfg["strings_per_inverter"] = st.number_input("Modules/string", 1, 100, 10, 1)
        cfg["n_inverters"] = st.number_input("Inverters", 1, 1000, 2, 1)

        # Derived info
        from core.energy import peak_power_kw
        pk = peak_power_kw(module_params, cfg["n_modules"])
        st.caption(f"DC peak: **{pk:.1f} kWp**")

    # -----------------------------------------------------------------------
    # 4. Loss Budget
    # -----------------------------------------------------------------------
    with st.sidebar.expander("Loss Budget", expanded=False):
        iam_model = st.selectbox(
            "IAM model",
            ["physical", "ashrae", "none"],
            format_func=lambda x: {"physical": "Physical (AR glass)", "ashrae": "ASHRAE", "none": "None"}[x],
        )
        soiling     = st.slider("Soiling [%]", 0.0, 10.0, 2.0, 0.5) / 100
        lid         = st.slider("LID [%]", 0.0, 3.0, 1.5, 0.1) / 100
        mismatch    = st.slider("Mismatch [%]", 0.0, 3.0, 1.0, 0.1) / 100
        dc_wiring   = st.slider("DC wiring [%]", 0.0, 5.0, 1.5, 0.1) / 100
        availability = st.slider("Availability [%]", 95.0, 100.0, 99.0, 0.1) / 100
        availability = 1.0 - availability  # convert to loss fraction
        ac_wiring   = st.slider("AC wiring [%]", 0.0, 3.0, 0.5, 0.1) / 100
        transformer = st.slider("Transformer [%]", 0.0, 3.0, 1.0, 0.1) / 100

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
        st.caption(f"Combined non-inverter losses: **{total_loss:.1f}%**")

    # -----------------------------------------------------------------------
    # 5. Orientation sweep settings
    # -----------------------------------------------------------------------
    with st.sidebar.expander("Orientation Sweep", expanded=False):
        cfg["tilt_step"] = st.select_slider("Tilt step [°]", [5, 10, 15], value=5)
        cfg["az_step"]   = st.select_slider("Azimuth step [°]", [10, 15, 20], value=10)
        n_tilt = len(range(0, 91, cfg["tilt_step"]))
        n_az   = len(range(0, 360, cfg["az_step"]))
        st.caption(f"Grid: {n_tilt} × {n_az} = {n_tilt * n_az} orientations")

    return cfg


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _optimal_tilt_guess(lat: float) -> int:
    """Simple heuristic: tilt ≈ |lat| × 0.76 + 3.1 (Jacobson & Jadhav 2018)."""
    return int(abs(lat) * 0.76 + 3.1)


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
    st.caption("Enter datasheet STC values:")
    col1, col2 = st.columns(2)
    with col1:
        pdc0   = st.number_input("P_mp [W]", 50, 1000, 400, 10)
        v_mp   = st.number_input("V_mp [V]", 1.0, 200.0, 34.0, 0.5)
        v_oc   = st.number_input("V_oc [V]", 1.0, 250.0, 41.0, 0.5)
    with col2:
        i_mp   = st.number_input("I_mp [A]", 0.1, 20.0, float(pdc0/v_mp), 0.1)
        i_sc   = st.number_input("I_sc [A]", 0.1, 25.0, float(i_mp * 1.06), 0.1)
        tc_p   = st.number_input("Temp. coeff. P [%/°C]", -1.0, 0.0, -0.40, 0.01)
    cells  = st.number_input("Cells in series", 20, 144, 66, 1)
    return sys_mod.parametric_module(pdc0, v_mp, i_mp, v_oc, i_sc, tc_p / 100, cells)
