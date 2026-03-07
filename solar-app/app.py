# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Solar Advisor — Energy-advisor grade PV yield simulation.

Data: PVGIS TMY (20+ year satellite synthesis) via pvlib
Physics: PVsyst-equivalent one-diode SDM, Perez sky diffuse, Faiman thermal, IAM

Run:
    streamlit run app.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
import pandas as pd
import streamlit as st

from core.climate import fetch_tmy
from core.system import load_cec_modules, load_cec_inverters
from core.energy import run_simulation, compute_orientation_grid, peak_power_kw
from ui.sidebar import render_sidebar
from ui import charts

# ---------------------------------------------------------------------------
# Page configuration
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Solar Advisor",
    page_icon="☀",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .metric-box {
        background: #1e1e2e; border-radius: 8px; padding: 12px 16px;
        text-align: center; border: 1px solid #333;
    }
    .metric-value { font-size: 1.6rem; font-weight: 700; color: #F5A623; }
    .metric-label { font-size: 0.75rem; color: #aaa; margin-top: 2px; }
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Load databases (cached across all sessions)
# ---------------------------------------------------------------------------
with st.spinner("Loading module and inverter databases…"):
    cec_modules   = load_cec_modules()
    cec_inverters = load_cec_inverters()

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
cfg = render_sidebar(cec_modules, cec_inverters)

# ---------------------------------------------------------------------------
# Session state: climate data
# ---------------------------------------------------------------------------
if "tmy_df" not in st.session_state:
    st.session_state["tmy_df"] = None
    st.session_state["data_source"] = ""

if cfg["fetch_climate"] or st.session_state["tmy_df"] is None:
    with st.spinner("Fetching PVGIS TMY data… (may take a few seconds)"):
        try:
            tmy_df, source = fetch_tmy(cfg["lat"], cfg["lon"])
            st.session_state["tmy_df"] = tmy_df
            st.session_state["data_source"] = source
        except Exception as e:
            st.error(f"Climate data fetch failed: {e}")
            st.stop()

tmy_df     = st.session_state["tmy_df"]
data_source = st.session_state["data_source"]

# ---------------------------------------------------------------------------
# Run main simulation for selected orientation
# ---------------------------------------------------------------------------
with st.spinner("Running simulation…"):
    result = run_simulation(
        tmy_df=tmy_df,
        lat=cfg["lat"],
        lon=cfg["lon"],
        elevation_m=cfg["elevation_m"],
        tilt_deg=cfg["tilt_deg"],
        panel_az_deg=cfg["panel_az_deg"],
        module_params=cfg["module_params"],
        inverter_params=cfg["inverter_params"],
        inverter_type=cfg["inverter_type"],
        n_modules=cfg["n_modules"],
        strings_per_inverter=cfg["strings_per_inverter"],
        n_inverters=cfg["n_inverters"],
        loss_budget=cfg["loss_budget"],
        albedo=cfg["albedo"],
        data_source=data_source,
    )

# ---------------------------------------------------------------------------
# Persistent summary metrics bar
# ---------------------------------------------------------------------------
st.markdown("---")
pk_kw = result.peak_power_kw
cols = st.columns(7)
metrics = [
    ("DC Peak",       f"{pk_kw:.1f} kWp"),
    ("Annual Yield",  f"{result.annual_yield_kwh:,.0f} kWh"),
    ("Specific Yield",f"{result.specific_yield_kwh_kwp:,.0f} kWh/kWp"),
    ("Perf. Ratio",   f"{result.performance_ratio * 100:.1f}%"),
    ("Cap. Factor",   f"{result.capacity_factor * 100:.1f}%"),
    ("Avg Daily",     f"{result.annual_yield_kwh / 365:.1f} kWh/day"),
    ("Data Source",   data_source.split(",")[0]),
]
for col, (label, value) in zip(cols, metrics):
    col.markdown(
        f'<div class="metric-box"><div class="metric-value">{value}</div>'
        f'<div class="metric-label">{label}</div></div>',
        unsafe_allow_html=True,
    )
st.markdown("---")

# ---------------------------------------------------------------------------
# Main tabs
# ---------------------------------------------------------------------------
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "Annual Summary",
    "Orientation Optimizer",
    "Monthly Breakdown",
    "Daily Irradiance",
    "Sun Path",
])

# ---- Tab 1: Annual Summary ------------------------------------------------
with tab1:
    col_wf, col_monthly = st.columns([1, 1])
    with col_wf:
        st.plotly_chart(
            charts.loss_waterfall(result.loss_waterfall, result.annual_yield_kwh),
            use_container_width=True,
        )
    with col_monthly:
        st.plotly_chart(
            charts.monthly_summary(result.monthly_yield_kwh_day, result.monthly_pr),
            use_container_width=True,
        )

    # Loss budget table
    with st.expander("Loss Budget Detail"):
        losses_dict = cfg["loss_budget"].as_dict()
        loss_df = pd.DataFrame({
            "Loss Category": list(losses_dict.keys()),
            "Loss [%]": [f"{v*100:.2f}%" for v in losses_dict.values()],
            "Energy Lost [kWh/yr]": [
                f"{result.loss_waterfall.get(k, 0):.0f}"
                for k in losses_dict.keys()
            ],
        })
        st.dataframe(loss_df, use_container_width=True, hide_index=True)

    # Export
    with st.expander("Download Results"):
        import io, json

        monthly_export_df = pd.DataFrame({
            "Month": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
            "Avg_daily_yield_kWh_day": result.monthly_yield_kwh_day.values.round(3),
            "Performance_Ratio": (result.monthly_pr * 100).values.round(2),
        })

        summary = {
            "location": {
                "lat": cfg["lat"], "lon": cfg["lon"], "elevation_m": cfg["elevation_m"],
            },
            "orientation": {
                "tilt_deg": cfg["tilt_deg"], "azimuth_deg": cfg["panel_az_deg"],
            },
            "system": {
                "peak_power_kw": round(result.peak_power_kw, 3),
                "n_modules": cfg["n_modules"],
            },
            "results": {
                "annual_yield_kwh": round(result.annual_yield_kwh, 1),
                "specific_yield_kwh_kwp": round(result.specific_yield_kwh_kwp, 1),
                "performance_ratio_pct": round(result.performance_ratio * 100, 2),
                "capacity_factor_pct": round(result.capacity_factor * 100, 2),
                "avg_daily_yield_kwh": round(result.annual_yield_kwh / 365, 2),
                "data_source": data_source,
            },
            "monthly_yield_kwh_day": {
                m: round(v, 3)
                for m, v in zip(
                    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
                    result.monthly_yield_kwh_day.values,
                )
            },
            "loss_waterfall_kwh": {k: round(v, 1) for k, v in result.loss_waterfall.items()},
        }

        col_dl1, col_dl2 = st.columns(2)
        with col_dl1:
            st.download_button(
                "Download Monthly CSV",
                monthly_export_df.to_csv(index=False),
                file_name="solar_advisor_monthly.csv",
                mime="text/csv",
                use_container_width=True,
            )
        with col_dl2:
            st.download_button(
                "Download Full Summary JSON",
                json.dumps(summary, indent=2),
                file_name="solar_advisor_summary.json",
                mime="application/json",
                use_container_width=True,
            )

# ---- Tab 2: Orientation Optimizer -----------------------------------------
with tab2:
    tilt_arr = np.arange(0, 91, cfg["tilt_step"])
    az_arr   = np.arange(0, 360, cfg["az_step"])

    run_sweep = st.button("Run Orientation Sweep", type="primary", use_container_width=False)
    if run_sweep or "energy_grid" not in st.session_state:
        with st.spinner(f"Computing {len(tilt_arr) * len(az_arr)} orientations…"):
            energy_grid = compute_orientation_grid(
                tmy_df=tmy_df,
                lat=cfg["lat"],
                lon=cfg["lon"],
                elevation_m=cfg["elevation_m"],
                module_params=cfg["module_params"],
                inverter_params=cfg["inverter_params"],
                inverter_type=cfg["inverter_type"],
                n_modules=cfg["n_modules"],
                strings_per_inverter=cfg["strings_per_inverter"],
                n_inverters=cfg["n_inverters"],
                loss_budget=cfg["loss_budget"],
                tilt_arr=tilt_arr,
                az_arr=az_arr,
                albedo=cfg["albedo"],
            )
            st.session_state["energy_grid"] = energy_grid
            st.session_state["tilt_arr"] = tilt_arr
            st.session_state["az_arr"]   = az_arr

    if "energy_grid" in st.session_state:
        eg = st.session_state["energy_grid"]
        ta = st.session_state["tilt_arr"]
        aa = st.session_state["az_arr"]

        fig_hm, opt_tilt, opt_az, opt_kwh = charts.orientation_heatmap(
            eg, ta, aa, cfg["tilt_deg"], cfg["panel_az_deg"]
        )
        st.plotly_chart(fig_hm, use_container_width=True)

        col_a, col_b = st.columns(2)
        with col_a:
            st.plotly_chart(
                charts.yield_vs_tilt(eg, ta, aa, cfg["panel_az_deg"], cfg["tilt_deg"]),
                use_container_width=True,
            )
        with col_b:
            delta = opt_kwh - result.annual_yield_kwh
            st.metric("Optimal orientation",
                      f"Tilt {opt_tilt:.0f}°, Az {opt_az:.0f}°",
                      f"+{delta:.0f} kWh/yr vs selected" if delta > 0 else f"{delta:.0f} kWh/yr")
            st.metric("Optimal annual yield", f"{opt_kwh:,.0f} kWh/yr")
            st.metric("Your selection", f"{result.annual_yield_kwh:,.0f} kWh/yr",
                      f"Tilt {cfg['tilt_deg']}°, Az {cfg['panel_az_deg']}°")

# ---- Tab 3: Monthly Breakdown ---------------------------------------------
with tab3:
    show_optimal = st.checkbox("Compare with optimal orientation", value=True)

    monthly_opt = None
    if show_optimal and "energy_grid" in st.session_state:
        eg = st.session_state["energy_grid"]
        ta = st.session_state["tilt_arr"]
        aa = st.session_state["az_arr"]
        oi, oj = np.unravel_index(np.argmax(eg), eg.shape)
        with st.spinner("Simulating optimal orientation…"):
            opt_result = run_simulation(
                tmy_df=tmy_df,
                lat=cfg["lat"], lon=cfg["lon"], elevation_m=cfg["elevation_m"],
                tilt_deg=float(ta[oi]), panel_az_deg=float(aa[oj]),
                module_params=cfg["module_params"],
                inverter_params=cfg["inverter_params"],
                inverter_type=cfg["inverter_type"],
                n_modules=cfg["n_modules"],
                strings_per_inverter=cfg["strings_per_inverter"],
                n_inverters=cfg["n_inverters"],
                loss_budget=cfg["loss_budget"],
                albedo=cfg["albedo"],
            )
            monthly_opt = opt_result.monthly_yield_kwh_day

    st.plotly_chart(
        charts.monthly_summary(result.monthly_yield_kwh_day, result.monthly_pr, monthly_opt),
        use_container_width=True,
    )

    monthly_df = pd.DataFrame({
        "Month": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
        "Avg daily yield [kWh/day]": result.monthly_yield_kwh_day.values.round(2),
        "Performance Ratio [%]": (result.monthly_pr * 100).values.round(1),
    })
    if monthly_opt is not None:
        monthly_df["Optimal orientation [kWh/day]"] = monthly_opt.values.round(2)
    st.dataframe(monthly_df, use_container_width=True, hide_index=True)

# ---- Tab 4: Daily Irradiance ----------------------------------------------
with tab4:
    import datetime
    doy = st.slider(
        "Day of year", 1, 365, 172,
        format="%d",
        help="172 = June 21 (summer solstice N hemisphere)",
    )
    date_label = (datetime.date(2023, 1, 1) + datetime.timedelta(days=doy - 1)).strftime("%B %d")
    st.caption(f"Selected: **{date_label}**")

    st.plotly_chart(
        charts.daily_irradiance(
            tmy_df, cfg["lat"], cfg["lon"], cfg["elevation_m"],
            cfg["tilt_deg"], cfg["panel_az_deg"], cfg["albedo"], doy,
        ),
        use_container_width=True,
    )

# ---- Tab 5: Sun Path ------------------------------------------------------
with tab5:
    doy_sp = st.slider("Selected day", 1, 365, 172, key="doy_sp")
    st.plotly_chart(
        charts.sun_path_polar(cfg["lat"], cfg["lon"], cfg["elevation_m"], doy_sp),
        use_container_width=True,
    )
    st.caption(
        "Polar plot: center = zenith (sun directly overhead). "
        "Distance from center = zenith angle. Horizon = outer ring."
    )
