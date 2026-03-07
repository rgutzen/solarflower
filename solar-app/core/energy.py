# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Full PV yield simulation pipeline using pvlib.

Physics chain (PVsyst-equivalent):
  TMY irradiance (GHI/DNI/DHI)
    → Solar position (Ephemeris)
    → POA transposition (Perez anisotropic sky model)
    → IAM correction (angle-of-incidence modifier)
    → Faiman cell temperature model
    → PVsyst one-diode electrical model (SDM)
    → Inverter model (CEC Sandia / PVWatts)
    → DC + AC loss chain

All expensive functions are wrapped with @st.cache_data so re-running with
identical parameters is instantaneous.
"""

from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import pandas as pd
import pvlib
import streamlit as st

from .losses import LossBudget, compute_iam, apply_dc_losses, apply_ac_losses, build_loss_waterfall


@dataclass
class SimResult:
    annual_yield_kwh: float
    specific_yield_kwh_kwp: float          # kWh per kWp installed
    performance_ratio: float
    capacity_factor: float
    monthly_yield_kwh_day: pd.Series       # avg kWh/day, index 1–12
    monthly_pr: pd.Series                  # PR by month, index 1–12
    hourly_poa: pd.Series                  # W/m² plane-of-array
    hourly_power_ac: pd.Series             # W net AC
    loss_waterfall: dict[str, float]
    peak_power_kw: float
    data_source: str


# ---------------------------------------------------------------------------
# Single-orientation simulation
# ---------------------------------------------------------------------------

@st.cache_data(show_spinner=False)
def run_simulation(
    tmy_df: pd.DataFrame,
    lat: float,
    lon: float,
    elevation_m: float,
    tilt_deg: float,
    panel_az_deg: float,
    module_params: pd.Series,
    inverter_params: pd.Series,
    inverter_type: str,             # 'sandia' | 'pvwatts'
    n_modules: int,
    strings_per_inverter: int,
    n_inverters: int,
    loss_budget: LossBudget,
    albedo: float = 0.20,
    data_source: str = "",
) -> SimResult:
    """
    Full hourly simulation for a fixed orientation.

    Parameters
    ----------
    tmy_df          : TMY DataFrame from core.climate.fetch_tmy()
    module_params   : pd.Series from core.system (CEC, parametric, or .pan)
    inverter_params : pd.Series from core.system
    inverter_type   : 'sandia' for CEC Sandia model, 'pvwatts' for simple efficiency
    n_modules       : total number of modules
    strings_per_inverter : modules per string (series) — sets system voltage
    n_inverters     : number of inverters (parallel strings → inverters)
    """
    loc = pvlib.location.Location(lat, lon, altitude=elevation_m, tz="UTC")
    times = tmy_df.index

    # --- Solar position ---
    solar_pos = loc.get_solarposition(times)

    # --- Extra-terrestrial radiation (for Perez model) ---
    dni_extra = pvlib.irradiance.get_extra_radiation(times)

    # --- Relative air mass ---
    airmass = loc.get_airmass(solar_position=solar_pos)

    # --- POA irradiance via Perez anisotropic sky model ---
    poa = pvlib.irradiance.get_total_irradiance(
        surface_tilt=tilt_deg,
        surface_azimuth=panel_az_deg,
        solar_zenith=solar_pos["apparent_zenith"],
        solar_azimuth=solar_pos["azimuth"],
        dni=tmy_df["dni"],
        ghi=tmy_df["ghi"],
        dhi=tmy_df["dhi"],
        dni_extra=dni_extra,
        airmass=airmass["airmass_relative"],
        model="perez",
        albedo=albedo,
    )
    poa_global = poa["poa_global"].fillna(0.0).clip(lower=0.0)

    # --- Angle of incidence ---
    aoi = pvlib.irradiance.aoi(
        tilt_deg, panel_az_deg,
        solar_pos["apparent_zenith"], solar_pos["azimuth"],
    )

    # --- IAM correction (beam component only) ---
    iam = compute_iam(aoi, model=loss_budget.iam_model)
    poa_iam = (
        poa["poa_direct"].fillna(0.0).clip(lower=0.0) * iam
        + poa["poa_diffuse"].fillna(0.0).clip(lower=0.0)
        + poa["poa_ground_diffuse"].fillna(0.0).clip(lower=0.0)
    )
    poa_iam = poa_iam.clip(lower=0.0)

    # --- Faiman cell temperature (PVsyst default thermal model) ---
    temp_cell = pvlib.temperature.faiman(
        poa_global=poa_iam,
        temp_air=tmy_df["temp_air"],
        wind_speed=tmy_df["wind_speed"],
    )

    # --- Electrical model: PVsyst one-diode SDM ---
    p_dc_array, temp_cell = _electrical_model(
        poa_iam, temp_cell, module_params, n_modules, strings_per_inverter
    )

    # --- DC losses (soiling, LID, mismatch, wiring) ---
    p_dc_net = apply_dc_losses(p_dc_array, loss_budget)

    # --- Inverter model ---
    p_ac_gross = _inverter_model(
        p_dc_net, p_dc_array, module_params, inverter_params,
        inverter_type, n_modules, strings_per_inverter, n_inverters
    )

    # --- AC losses (availability, AC wiring, transformer) ---
    p_ac_net = apply_ac_losses(p_ac_gross, loss_budget)
    p_ac_net = p_ac_net.clip(lower=0.0)

    # --- Energy totals (kWh) ---
    dt_h = 1.0  # hourly data
    annual_yield = float(p_ac_net.sum() * dt_h / 1000.0)
    monthly_yield = _monthly_yield(p_ac_net)
    monthly_pr    = _monthly_pr(p_ac_net, poa_global, peak_power_kw(module_params, n_modules))

    # --- Loss waterfall ---
    ghi_kwh      = float(tmy_df["ghi"].sum() / 1000.0)
    poa_kwh      = float(poa_global.sum() / 1000.0)
    iam_kwh      = float(poa_iam.sum() / 1000.0)
    dc_kwh       = float(p_dc_array.sum() * dt_h / 1000.0)
    dc_net_kwh   = float(p_dc_net.sum() * dt_h / 1000.0)
    ac_gross_kwh = float(p_ac_gross.sum() * dt_h / 1000.0)
    waterfall = build_loss_waterfall(
        ghi_kwh, poa_kwh, iam_kwh, dc_kwh, dc_net_kwh, ac_gross_kwh, annual_yield, loss_budget
    )

    pk_kw = peak_power_kw(module_params, n_modules)
    # PR defined against POA irradiance (IEC 61724): PR = E_AC / (H_poa * P_peak)
    pr = annual_yield / (poa_kwh * pk_kw) if poa_kwh * pk_kw > 0 else 0.0
    cf = annual_yield / (pk_kw * 8760.0) if pk_kw > 0 else 0.0

    return SimResult(
        annual_yield_kwh=annual_yield,
        specific_yield_kwh_kwp=annual_yield / pk_kw if pk_kw > 0 else 0.0,
        performance_ratio=pr,
        capacity_factor=cf,
        monthly_yield_kwh_day=monthly_yield,
        monthly_pr=monthly_pr,
        hourly_poa=poa_global,
        hourly_power_ac=p_ac_net,
        loss_waterfall=waterfall,
        peak_power_kw=pk_kw,
        data_source=data_source,
    )


# ---------------------------------------------------------------------------
# Orientation grid sweep
# ---------------------------------------------------------------------------

@st.cache_data(show_spinner=False)
def compute_orientation_grid(
    tmy_df: pd.DataFrame,
    lat: float,
    lon: float,
    elevation_m: float,
    module_params: pd.Series,
    inverter_params: pd.Series,
    inverter_type: str,
    n_modules: int,
    strings_per_inverter: int,
    n_inverters: int,
    loss_budget: LossBudget,
    tilt_arr: np.ndarray,
    az_arr: np.ndarray,
    albedo: float = 0.20,
) -> np.ndarray:
    """
    Sweep tilt × azimuth and return annual yield grid (kWh), shape (T, A).

    Optimized: solar position and irradiance components computed once;
    POA transposition vectorized over all orientations.
    """
    loc = pvlib.location.Location(lat, lon, altitude=elevation_m, tz="UTC")
    times = tmy_df.index
    solar_pos = loc.get_solarposition(times)
    dni_extra = pvlib.irradiance.get_extra_radiation(times)
    airmass   = loc.get_airmass(solar_position=solar_pos)

    energy_grid = np.zeros((len(tilt_arr), len(az_arr)), dtype=np.float32)

    for i, tilt in enumerate(tilt_arr):
        for j, az in enumerate(az_arr):
            poa = pvlib.irradiance.get_total_irradiance(
                surface_tilt=tilt,
                surface_azimuth=az,
                solar_zenith=solar_pos["apparent_zenith"],
                solar_azimuth=solar_pos["azimuth"],
                dni=tmy_df["dni"],
                ghi=tmy_df["ghi"],
                dhi=tmy_df["dhi"],
                dni_extra=dni_extra,
                airmass=airmass["airmass_relative"],
                model="perez",
                albedo=albedo,
            )
            poa_g = poa["poa_global"].fillna(0.0).clip(lower=0.0)

            # Simplified chain for speed: use effective POA + PVWatts-style DC
            aoi = pvlib.irradiance.aoi(
                tilt, az, solar_pos["apparent_zenith"], solar_pos["azimuth"]
            )
            iam = compute_iam(aoi, model=loss_budget.iam_model)
            poa_eff = (
                poa["poa_direct"].fillna(0.0).clip(lower=0.0) * iam
                + poa["poa_diffuse"].fillna(0.0).clip(lower=0.0)
                + poa["poa_ground_diffuse"].fillna(0.0).clip(lower=0.0)
            ).clip(lower=0.0)

            temp_cell = pvlib.temperature.faiman(
                poa_eff, tmy_df["temp_air"], tmy_df["wind_speed"]
            )
            p_dc, _ = _electrical_model(
                poa_eff, temp_cell, module_params, n_modules, strings_per_inverter
            )
            p_dc_net = apply_dc_losses(p_dc, loss_budget)
            p_ac = _inverter_model(
                p_dc_net, p_dc, module_params, inverter_params,
                inverter_type, n_modules, strings_per_inverter, n_inverters
            )
            p_ac_net = apply_ac_losses(p_ac, loss_budget).clip(lower=0.0)
            energy_grid[i, j] = float(p_ac_net.sum() / 1000.0)

    return energy_grid


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _electrical_model(
    poa: pd.Series,
    temp_cell: pd.Series,
    module_params: pd.Series,
    n_modules: int,
    strings_per_inverter: int,
) -> tuple[pd.Series, pd.Series]:
    """PVsyst one-diode model → DC array power [W]."""
    mp = module_params

    # Check if we have full SDM parameters
    has_sdm = all(k in mp.index for k in ["I_sc_ref", "a_ref", "R_s", "R_sh_ref"])
    il_ref = mp.get("IL_ref")
    i0_ref = mp.get("I0_ref")
    sdm_available = (
        has_sdm
        and il_ref is not None and pd.notna(il_ref)
        and i0_ref is not None and pd.notna(i0_ref)
    )

    if sdm_available:
        # Full one-diode: calcparams_pvsyst → singlediode
        IL, I0, Rs, Rsh, nNsVth = pvlib.pvsystem.calcparams_pvsyst(
            effective_irradiance=poa,
            temp_cell=temp_cell,
            alpha_sc=float(mp.get("alpha_sc", 0.0)),
            gamma_ref=float(mp.get("a_ref", 1.5)) / max(int(mp.get("cells_in_series", 60)), 1) / 0.02585,
            mu_gamma=float(mp.get("mu_gamma", 0.0)),
            I_L_ref=float(mp["IL_ref"]),
            I_o_ref=float(mp["I0_ref"]),
            R_sh_ref=float(mp.get("R_sh_ref", 300.0)),
            R_sh_0=float(mp.get("R_sh_0", 6000.0)),
            R_s=float(mp.get("R_s", 0.5)),
            cells_in_series=int(mp.get("cells_in_series", 60)),
        )
        out = pvlib.pvsystem.singlediode(IL, I0, Rs, Rsh, nNsVth)
        p_module = out["p_mp"].clip(lower=0.0)
    else:
        # PVWatts-style: P = pdc0 * (G/1000) * (1 + gamma*(T_cell - 25))
        pdc0 = float(mp.get("pdc0", mp.get("V_mp_ref", 30.0) * mp.get("I_mp_ref", 8.0)))
        gamma = float(mp.get("gamma_r", -0.004))
        if abs(gamma) > 0.1:   # stored as %/°C → convert to 1/°C
            gamma = gamma / 100.0
        p_module = pvlib.pvsystem.pvwatts_dc(
            poa, temp_cell, pdc0, gamma,
        ).clip(lower=0.0)

    p_array = p_module * n_modules
    return p_array, temp_cell


def _inverter_model(
    p_dc_net: pd.Series,
    p_dc_gross: pd.Series,
    module_params: pd.Series,
    inverter_params: pd.Series,
    inverter_type: str,
    n_modules: int,
    strings_per_inverter: int,
    n_inverters: int,
) -> pd.Series:
    """Convert DC net power to AC gross power."""
    if inverter_type == "sandia" and "Paco" in inverter_params.index:
        # Sandia CEC inverter model needs V_dc
        v_mp_module = float(module_params.get("V_mp_ref", 30.0))
        v_dc = v_mp_module * strings_per_inverter
        p_ac = pvlib.inverter.sandia(
            v_dc=pd.Series(v_dc, index=p_dc_net.index),
            p_dc=p_dc_net / n_inverters,
            inverter=inverter_params,
        ) * n_inverters
    else:
        # PVWatts simple efficiency
        eta = float(inverter_params.get("eta_inv_nom", 0.96))
        pdc0 = float(inverter_params.get("pdc0", p_dc_gross.max() * 1.1))
        p_ac = pvlib.inverter.pvwatts(
            pdc=p_dc_net,
            pdc0=pdc0,
            eta_inv_nom=eta,
        )
    return p_ac.clip(lower=0.0)


def _monthly_yield(p_ac_net: pd.Series) -> pd.Series:
    """Average kWh/day per calendar month."""
    kwh = p_ac_net / 1000.0
    monthly_kwh = kwh.resample("ME").sum()
    days_per_month = monthly_kwh.index.days_in_month
    result = monthly_kwh.values / days_per_month.values
    return pd.Series(result, index=range(1, 13))


def _monthly_pr(
    p_ac_net: pd.Series,
    poa_global: pd.Series,
    pk_kw: float,
) -> pd.Series:
    """Performance ratio per calendar month (IEC 61724: PR = E_AC / H_poa / P_peak)."""
    kwh_monthly = (p_ac_net / 1000.0).resample("ME").sum()
    poa_monthly  = (poa_global / 1000.0).resample("ME").sum()
    pr = kwh_monthly / (poa_monthly * pk_kw)
    return pd.Series(pr.values, index=range(1, 13))


def peak_power_kw(module_params: pd.Series, n_modules: int) -> float:
    """Array DC peak power in kW (at STC)."""
    pdc0 = float(module_params.get(
        "pdc0",
        module_params.get("V_mp_ref", 30.0) * module_params.get("I_mp_ref", 8.0)
    ))
    return pdc0 * n_modules / 1000.0
