# SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
PVsyst-style loss chain for a grid-connected PV system.

Loss categories (applied in order, all as fractional reductions):
  1. Irradiance: IAM (angle-of-incidence modifier) — applied per-timestep in energy.py
  2. DC: soiling, LID, mismatch, DC wiring
  3. AC: inverter clipping handled by pvlib; AC wiring, transformer, availability
"""

from __future__ import annotations
from dataclasses import dataclass, field
import numpy as np
import pandas as pd
import pvlib


@dataclass
class LossBudget:
    # --- Irradiance losses ---
    iam_model: str = "physical"    # 'physical' (AR glass) | 'ashrae' | 'none'

    # --- DC losses (applied after electrical model) ---
    soiling: float = 0.02          # Dust/soiling on glass [fraction]
    lid: float = 0.015             # Light-induced degradation, first year [fraction]
    mismatch: float = 0.01         # Module-to-module mismatch [fraction]
    dc_wiring: float = 0.015       # Ohmic losses in DC cables [fraction]

    # --- AC losses (applied after inverter) ---
    availability: float = 0.01    # Planned + unplanned downtime [fraction]
    ac_wiring: float = 0.005       # AC cable ohmic losses [fraction]
    transformer: float = 0.01      # Step-up transformer (0 if no transformer) [fraction]

    @property
    def total_dc_loss(self) -> float:
        """Combined DC loss factor (multiplicative)."""
        return 1.0 - (
            (1 - self.soiling)
            * (1 - self.lid)
            * (1 - self.mismatch)
            * (1 - self.dc_wiring)
        )

    @property
    def total_ac_loss(self) -> float:
        """Combined AC loss factor (multiplicative)."""
        return 1.0 - (
            (1 - self.availability)
            * (1 - self.ac_wiring)
            * (1 - self.transformer)
        )

    @property
    def dc_factor(self) -> float:
        return (1 - self.soiling) * (1 - self.lid) * (1 - self.mismatch) * (1 - self.dc_wiring)

    @property
    def ac_factor(self) -> float:
        return (1 - self.availability) * (1 - self.ac_wiring) * (1 - self.transformer)

    def as_dict(self) -> dict[str, float]:
        return {
            "Soiling":         self.soiling,
            "LID":             self.lid,
            "Mismatch":        self.mismatch,
            "DC wiring":       self.dc_wiring,
            "Availability":    self.availability,
            "AC wiring":       self.ac_wiring,
            "Transformer":     self.transformer,
        }


def compute_iam(aoi_deg: pd.Series, model: str = "physical") -> pd.Series:
    """
    Angle-of-incidence modifier applied to the direct beam component.

    Parameters
    ----------
    aoi_deg : Series of angle-of-incidence values in degrees
    model   : 'physical' (antireflective glass), 'ashrae', or 'none'

    Returns
    -------
    iam : Series, values in [0, 1]
    """
    aoi = aoi_deg.clip(lower=0, upper=90)
    if model == "physical":
        return pd.Series(pvlib.iam.physical(aoi), index=aoi_deg.index)
    elif model == "ashrae":
        return pd.Series(pvlib.iam.ashrae(aoi), index=aoi_deg.index)
    else:
        return pd.Series(np.ones(len(aoi_deg)), index=aoi_deg.index)


def apply_dc_losses(p_dc: pd.Series, losses: LossBudget) -> pd.Series:
    """Apply soiling, LID, mismatch, DC wiring losses to DC power."""
    return p_dc * losses.dc_factor


def apply_ac_losses(p_ac: pd.Series, losses: LossBudget) -> pd.Series:
    """Apply availability, AC wiring, transformer losses to AC power."""
    return p_ac * losses.ac_factor


def build_loss_waterfall(
    gross_irradiance_kwh: float,
    poa_kwh: float,
    iam_kwh: float,
    gross_dc_kwh: float,
    net_dc_kwh: float,
    gross_ac_kwh: float,
    net_ac_kwh: float,
    losses: LossBudget,
) -> dict[str, float]:
    """
    Build a loss waterfall dict mapping loss label → kWh lost.

    Stages:
      Gross ETR
        → Optical/shading losses (ETR - POA)
        → IAM losses (POA - IAM-corrected)
        → Temperature losses (implicit in electrical model)
        → Soiling
        → LID
        → Mismatch
        → DC wiring
        → Inverter losses (DC - AC)
        → Availability
        → AC wiring
        → Transformer
        = Net yield
    """
    optical   = max(gross_irradiance_kwh - poa_kwh, 0.0)
    iam_loss  = max(poa_kwh - iam_kwh, 0.0)
    temp_loss = max(iam_kwh - gross_dc_kwh, 0.0)        # cell heating
    soiling   = gross_dc_kwh * losses.soiling
    lid_loss  = gross_dc_kwh * (1 - losses.soiling) * losses.lid
    mismatch  = gross_dc_kwh * (1 - losses.soiling) * (1 - losses.lid) * losses.mismatch
    dc_wire   = gross_dc_kwh * (1 - losses.soiling) * (1 - losses.lid) * (1 - losses.mismatch) * losses.dc_wiring
    inv_loss  = max(net_dc_kwh - gross_ac_kwh, 0.0)
    avail     = gross_ac_kwh * losses.availability
    ac_wire   = gross_ac_kwh * (1 - losses.availability) * losses.ac_wiring
    transformer = gross_ac_kwh * (1 - losses.availability) * (1 - losses.ac_wiring) * losses.transformer

    return {
        "Horizon & far shading": optical,
        "IAM (angle of incidence)": iam_loss,
        "Temperature derating": temp_loss,
        "Soiling": soiling,
        "LID": lid_loss,
        "Mismatch": mismatch,
        "DC wiring": dc_wire,
        "Inverter": inv_loss,
        "Availability": avail,
        "AC wiring": ac_wire,
        "Transformer": transformer,
    }


def performance_ratio(net_yield_kwh: float, ghi_kwh_m2: float, peak_power_kw: float) -> float:
    """
    Performance Ratio = actual yield / reference yield.
    PR = E_net / (H_ghi * P_peak)
    where H_ghi is in kWh/m² and P_peak in kW.
    """
    ref = ghi_kwh_m2 * peak_power_kw
    return net_yield_kwh / ref if ref > 0 else 0.0
