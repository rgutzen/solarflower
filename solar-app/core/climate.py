# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Climate data fetching: PVGIS TMY (primary) + Open-Meteo fallback.

PVGIS TMY is synthesized from 20+ years of satellite data (SARAH3/ERA5),
making it more representative than any single calendar year.
"""

import requests
import numpy as np
import pandas as pd
import pvlib


def fetch_tmy(lat: float, lon: float) -> tuple[pd.DataFrame, str]:
    """
    Fetch Typical Meteorological Year data for a location.

    Tries PVGIS first; falls back to Open-Meteo most-recent full year.

    Returns
    -------
    tmy_df : DataFrame
        Hourly TMY with columns: ghi, dni, dhi, temp_air, wind_speed, pressure
        Index: DatetimeIndex (8760 rows, non-leap year)
    source : str
        Human-readable description of the data source used.
    """
    try:
        return _fetch_pvgis_tmy(lat, lon)
    except Exception:
        pass
    try:
        return _fetch_openmeteo_year(lat, lon, year=2023)
    except Exception:
        pass
    return _clear_sky_fallback(lat, lon), "Clear-sky model (offline fallback)"


def _fetch_pvgis_tmy(lat: float, lon: float) -> tuple[pd.DataFrame, str]:
    data, months_selected, inputs, meta = pvlib.iotools.get_pvgis_tmy(
        latitude=lat,
        longitude=lon,
        outputformat="json",
        usehorizon=True,
        startyear=2005,
        endyear=2023,
        map_variables=True,
    )
    # pvlib returns: ghi, dhi, dni, temp_air, wind_speed, pressure (mapped names)
    cols = ["ghi", "dhi", "dni", "temp_air", "wind_speed", "pressure"]
    missing = [c for c in cols if c not in data.columns]
    if missing:
        # Attempt common alternative names
        rename = {
            "G(h)": "ghi", "Gb(n)": "dni", "Gd(h)": "dhi",
            "T2m": "temp_air", "WS10m": "wind_speed", "SP": "pressure",
        }
        data = data.rename(columns=rename)
    for col in cols:
        if col not in data.columns:
            if col == "pressure":
                data["pressure"] = 101325.0
            else:
                data[col] = 0.0
    df = data[cols].copy()
    df.index = _reindex_tmy(df.index)
    source = f"PVGIS TMY ({months_selected[0][0]}–{months_selected[-1][0]}), satellite SARAH3/ERA5"
    return df, source


def _fetch_openmeteo_year(lat: float, lon: float, year: int) -> tuple[pd.DataFrame, str]:
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": f"{year}-01-01",
        "end_date": f"{year}-12-31",
        "hourly": ",".join([
            "shortwave_radiation",
            "direct_normal_irradiance",
            "diffuse_radiation",
            "temperature_2m",
            "windspeed_10m",
            "surface_pressure",
        ]),
        "timezone": "UTC",
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    j = resp.json()["hourly"]
    df = pd.DataFrame({
        "ghi":        j["shortwave_radiation"],
        "dni":        j["direct_normal_irradiance"],
        "dhi":        j["diffuse_radiation"],
        "temp_air":   j["temperature_2m"],
        "wind_speed": j["windspeed_10m"],
        "pressure":   [p * 100 for p in j["surface_pressure"]],  # hPa → Pa
    }, index=pd.to_datetime(j["time"]))
    # Drop Feb 29 for leap years; keep 8760 hours
    df = df[~((df.index.month == 2) & (df.index.day == 29))]
    df = df.iloc[:8760]
    df.index = _reindex_tmy(df.index)
    return df, f"Open-Meteo historical data {year} (ERA5/SARAH3)"


def _clear_sky_fallback(lat: float, lon: float) -> pd.DataFrame:
    """Ineichen clear-sky model — used only when all APIs are unreachable."""
    loc = pvlib.location.Location(lat, lon)
    times = pd.date_range("2023-01-01", periods=8760, freq="1h", tz="UTC")
    cs = loc.get_clearsky(times, model="ineichen")
    df = cs.rename(columns={"ghi": "ghi", "dni": "dni", "dhi": "dhi"})
    df["temp_air"] = 15.0
    df["wind_speed"] = 2.0
    df["pressure"] = 101325.0
    df.index = _reindex_tmy(df.index)
    return df


def _reindex_tmy(index: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Normalize TMY index to a standard non-leap year (2023) in UTC."""
    n = len(index)
    return pd.date_range("2023-01-01", periods=n, freq="1h", tz="UTC")
