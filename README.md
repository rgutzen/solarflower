# Solarflower

**Understand, simulate, and optimize solar panel yield — from first principles to professional-grade calculations.**

---

## Components

### [Solar Panel Power](notebook/solar_panel_power.ipynb) — Educational Notebook
A step-by-step computational article deriving solar panel yield from first principles.
Covers solar geometry, atmospheric physics, POA irradiance, cell temperature, and
annual energy integration — written for a general audience, with interactive visualizations.

### [Solar Advisor](solar-app/) — Energy Advisor Web App
Production-grade PV yield simulation for any location worldwide.
- **Climate data:** PVGIS TMY synthesized from 20+ years of satellite observations
- **Physics:** PVsyst-equivalent — Perez sky diffuse, Faiman thermal, one-diode SDM, IAM
- **Components:** CEC database (15,000+ modules, 3,000+ inverters) + PVsyst `.pan`/`.ond` import
- **Tools:** Orientation optimizer, monthly breakdown, daily irradiance, sun path

```bash
cd solar-app
pip install -r requirements.txt
streamlit run app.py        # opens at http://localhost:8501
```

### Website — Landing Page *(coming soon)*
Project landing page linking all components.

### Panel Compass — Mobile App *(coming soon)*
PWA helper for orienting a solar panel on-site: real-time compass and tilt guidance
toward the optimal orientation for the user's location.

---

## License

[AGPL-3.0-or-later](LICENSE) — free for personal, research, and educational use.
Commercial licensing available — see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).
Contact: robin.gutzen@outlook.com
