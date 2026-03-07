# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
PV system component definitions.

Supports three module/inverter sources:
  1. pvlib's built-in CEC/Sandia databases (thousands of real products)
  2. PVsyst .pan / .ond file upload (parsed via pvlib.iotools.read_panond)
  3. Simple parametric spec (user-entered STC values)
"""

from __future__ import annotations
import io
import numpy as np
import pandas as pd
import pvlib
import streamlit as st


# ---------------------------------------------------------------------------
# CEC / Sandia database helpers
# ---------------------------------------------------------------------------

@st.cache_resource
def load_cec_modules() -> pd.DataFrame:
    """Load pvlib's bundled CEC module database (~15 000 modules)."""
    return pvlib.retrieve_sam("cecmod")


@st.cache_resource
def load_cec_inverters() -> pd.DataFrame:
    """Load pvlib's bundled CEC inverter database (~3 000 inverters)."""
    return pvlib.retrieve_sam("cecinverter")


def search_modules(query: str, db: pd.DataFrame, n: int = 50) -> list[str]:
    """Return up to n module names that contain the query string (case-insensitive)."""
    q = query.lower()
    return [name for name in db.columns if q in name.lower()][:n]


def search_inverters(query: str, db: pd.DataFrame, n: int = 50) -> list[str]:
    q = query.lower()
    return [name for name in db.columns if q in name.lower()][:n]


def get_module_params(name: str, db: pd.DataFrame) -> pd.Series:
    """Return CEC parameters for a named module."""
    return db[name]


def get_inverter_params(name: str, db: pd.DataFrame) -> pd.Series:
    """Return CEC parameters for a named inverter."""
    return db[name]


# ---------------------------------------------------------------------------
# PVsyst .pan / .ond file import
# ---------------------------------------------------------------------------

def load_panond(uploaded_file) -> dict:
    """
    Parse a PVsyst .pan or .ond file uploaded via st.file_uploader.

    Returns a dict with keys:
      'type'   : 'module' | 'inverter'
      'name'   : str
      'params' : pd.Series (pvlib-compatible parameter set)
    """
    raw = uploaded_file.read()
    # pvlib.iotools.read_panond expects a file-like object or path
    content = io.StringIO(raw.decode("utf-8", errors="replace"))
    try:
        result = pvlib.iotools.read_panond(content)
    except Exception as exc:
        raise ValueError(f"Could not parse PVsyst file: {exc}") from exc

    # read_panond returns a dict; detect module vs inverter by key presence
    if "I_sc_ref" in result or "Isc" in result:
        params = _map_pvsyst_module(result)
        return {"type": "module", "name": uploaded_file.name, "params": params}
    else:
        params = _map_pvsyst_inverter(result)
        return {"type": "inverter", "name": uploaded_file.name, "params": params}


def _map_pvsyst_module(raw: dict) -> pd.Series:
    """Map PVsyst .pan parameters to pvlib CEC-compatible names."""
    mapping = {
        "Isc": "I_sc_ref",
        "Voc": "V_oc_ref",
        "Impp": "I_mp_ref",
        "Vmpp": "V_mp_ref",
        "muISC": "alpha_sc",         # A/°C
        "muVocSpec": "beta_oc",      # V/°C (or %/°C — pvlib expects V/°C)
        "muPmpReq": "gamma_r",       # %/°C
        "NCelS": "cells_in_series",
        "RShunt": "R_sh_ref",
        "Rp_0": "R_sh_0",
        "RSerie": "R_s",
        "Gamma": "a_ref",
        "Pmpp": "pdc0",
        "GRef": "EgRef",
    }
    d = {}
    for pvsyst_key, pvlib_key in mapping.items():
        if pvsyst_key in raw:
            d[pvlib_key] = raw[pvsyst_key]
    # Ensure required keys exist with safe defaults
    defaults = {
        "EgRef": 1.121, "dEgdT": -0.0002677,
        "adjust": 0.0, "IL_ref": None,
        "I0_ref": None, "R_sh_exp": 5.5,
    }
    for k, v in defaults.items():
        d.setdefault(k, v)
    return pd.Series(d)


def _map_pvsyst_inverter(raw: dict) -> pd.Series:
    """Map PVsyst .ond parameters to a pvlib PVWatts-compatible dict."""
    # PVsyst .ond: Pnom (W), Vnom (V), EurEff (European efficiency)
    d = {
        "Paco": raw.get("Pnom", raw.get("PNomConv", 5000.0)),
        "Pdco": raw.get("Pnom", 5000.0) / max(raw.get("EurEff", 0.96), 0.01),
        "Vdco": raw.get("Vnom", raw.get("VNomEur", 400.0)),
        "Pso":  raw.get("Pthreshold", 10.0),
        "C0": -2e-6, "C1": -1e-5, "C2": 2e-4, "C3": -7e-5,
        "Pnt": raw.get("Night_Loss", 2.0),
    }
    return pd.Series(d)


# ---------------------------------------------------------------------------
# Simple parametric module (user-entered STC values)
# ---------------------------------------------------------------------------

def parametric_module(
    pdc0: float,
    v_mp: float,
    i_mp: float,
    v_oc: float,
    i_sc: float,
    temp_coeff_pmax: float = -0.004,
    cells_in_series: int = 60,
) -> pd.Series:
    """
    Build a minimal CEC-compatible module parameter set from STC values.
    Uses the pvlib desoto / pvsyst SDM fitting approach approximation.
    """
    # Ideality factor approximation
    Vt = 0.02585  # thermal voltage at 25°C
    a_ref = cells_in_series * 1.3 * Vt  # ~1.3 diode ideality
    # Series resistance from fill factor approximation
    FF_ideal = (v_mp / v_oc) * (i_mp / i_sc)
    r_s = (v_oc - v_mp) / i_sc * (1 - FF_ideal) * 0.5

    return pd.Series({
        "pdc0":           pdc0,
        "V_mp_ref":       v_mp,
        "I_mp_ref":       i_mp,
        "V_oc_ref":       v_oc,
        "I_sc_ref":       i_sc,
        "alpha_sc":       i_sc * 0.0005,          # 0.05%/°C of Isc
        "beta_oc":        temp_coeff_pmax * v_oc, # approx
        "gamma_r":        temp_coeff_pmax * 100,  # %/°C → store as fraction
        "cells_in_series": cells_in_series,
        "R_s":            r_s,
        "R_sh_ref":       v_oc / (i_sc * 0.002),
        "R_sh_0":         v_oc / (i_sc * 0.0005),
        "a_ref":          a_ref,
        "EgRef":          1.121,
        "dEgdT":          -0.0002677,
        "adjust":         0.0,
        "IL_ref":         None,
        "I0_ref":         None,
    })


def pvwatts_inverter(pdc0_kw: float, eff_pct: float = 96.0) -> pd.Series:
    """Minimal PVWatts-style inverter parameters."""
    pdc0_w = pdc0_kw * 1000
    return pd.Series({
        "pdc0": pdc0_w,
        "eta_inv_nom": eff_pct / 100,
        "eta_inv_ref": 0.9637,
    })
