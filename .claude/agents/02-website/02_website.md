# Agent Prompt: Website — Project Landing Page

## Your Role
You are working on the **Website** component of the Solarflower project.
Your task is to design and build a visually sleek, modern landing page that introduces
the Solarflower project and directs visitors to its individual components.

## Design Guidelines

**You MUST follow the visual design specifications in:**
`.claude/shared/design-guidelines.md`

See also the implementation roadmap: `.claude/shared/design-roadmap.md`

The current website already implements this aesthetic. Use the design guidelines to:
- Maintain consistent color usage (amber `#F5A623`, blue `#2D7DD2`, greens)
- Use the CSS variables provided in Section 6.1
- Follow the component patterns (buttons, cards, navigation) in Section 3
- Apply the organic decorations (blobs, vines, waves) as described in Section 2.3
- Ensure accessibility requirements are met (Section 4)

## Project Context

The Solarflower project has four components. You work on component 3:

1. **SciComm Notebook** (`notebook/solar_panel_power.ipynb`) — interactive educational article
2. **Web-App** (`solar-app/`) — production Streamlit energy-advisor app (complete, running)
3. **Website** (`website/`) — YOUR COMPONENT
4. **Mobile-App** (`mobile-app/`) — on-site orientation helper app

**Repository root:** `/home/rgutzen/01_PROJECTS/solarflower/`
**License:** AGPL-3.0-or-later
**Copyright:** Robin Gutzen — robin.gutzen@outlook.com

## What to Build

A standalone static website in `website/` that:
- Serves as the **project landing page** (the first thing a visitor sees)
- Introduces the project clearly and compellingly in a few sentences
- Presents the four components as distinct cards/sections, each with:
  - What it is and who it's for
  - A link / call to action
- Is **visually polished**: think modern, clean, solar-energy aesthetic
- Works without a build step if possible (plain HTML/CSS/JS), or uses a minimal framework

## Suggested File Structure

```
website/
├── index.html          Main landing page
├── styles.css          (or inline / Tailwind CDN)
├── assets/
│   ├── logo.svg        (create a simple SVG or placeholder)
│   └── ...
└── README.md           (optional: how to serve locally)
```

If you choose a framework (e.g., Next.js, Astro, SvelteKit), create a proper project
scaffold, but prefer minimal build complexity. A single well-crafted `index.html` with
modern CSS is perfectly appropriate.

## Design Direction

**Aesthetic:** Clean, modern, science-forward. Think: white/off-white background,
warm amber/orange accent color (#F5A623 is used in the app — consider reusing it),
generous whitespace, subtle shadows, readable typography.

**Feel:** Professional but approachable. This is both a tool for engineers and an
educational resource for curious people. Avoid dark/techy hacker aesthetic; prefer
something a solar energy consultant or a science educator would feel proud linking to.

**Responsive:** Must work on mobile and desktop.

## Content to Include

### Hero Section
- Project name: **Solarflower**
- One-line tagline, e.g.: "Understand, simulate, and optimize solar panel yield — from first principles to professional-grade calculations."
- Optional: a simple animated or static SVG/illustration of sun + panel

### Four Component Cards

**1. Solar Panel Power — Educational Notebook**
- Audience: curious learners, students, educators
- Description: A step-by-step computational article deriving solar panel yield from first principles — solar geometry, atmospheric physics, panel temperature, electrical model.
- CTA: "Explore the Notebook" → link to notebook (GitHub or nbviewer URL)

**2. Solar Advisor — Energy Advisor Web App**
- Audience: homeowners, installers, energy consultants
- Description: Professional-grade yield simulation for any location worldwide. Real PVGIS climate data, PVsyst-equivalent physics, interactive orientation optimizer.
- CTA: "Open the App" → link to deployed Streamlit app (or localhost:8501 as placeholder)
- Highlight: "PVGIS TMY data · PVsyst-equivalent physics · 15,000+ module database"

**3. Panel Compass — Mobile App** *(coming soon)*
- Audience: installers, DIY homeowners
- Description: Point your phone at the roof and get real-time tilt and compass guidance to align your solar panel to the optimal orientation for your location.
- CTA: "Coming Soon" (greyed out / badge)

**4. Open Source**
- Brief note on AGPL-3.0 license
- GitHub link: https://github.com/rgutzen/solarflower
- Invitation to contribute

### Footer
- Copyright: © 2025 Robin Gutzen
- License badge: AGPL-3.0
- GitHub link
- Contact: robin.gutzen@outlook.com (for commercial licensing)

## Technical Requirements

- No tracking scripts, no analytics, no external fonts that violate privacy (use system fonts or Google Fonts with self-hosted fallback)
- All external CDN links (Tailwind, fonts) should have a `crossorigin` attribute and integrity hash if possible
- Semantic HTML: use `<main>`, `<section>`, `<article>`, `<header>`, `<footer>` correctly
- Accessibility: all images have `alt` text; color contrast ratio ≥ 4.5:1; keyboard-navigable

## SPDX License Header

Add to every source file:
```html
<!-- SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com> -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
```
For CSS/JS files use the appropriate comment syntax.

## Placeholder Links

Until the app is deployed and the mobile app exists, use these placeholders:
- Web-App: `http://localhost:8501` (note: "or self-host the Streamlit app")
- Notebook: `https://github.com/rgutzen/solarflower/blob/main/notebook/solar_panel_power.ipynb`
- GitHub: `https://github.com/rgutzen/solarflower`
- Mobile: `#coming-soon`

## Coordination Notes

- Do NOT modify files outside `website/`.
- The `solar-app/` Streamlit app uses color `#F5A623` as accent — you may reuse this for brand consistency.
- Memory and plans are in `.claude/memory/MEMORY.md`.
- The project is already on GitHub at `https://github.com/rgutzen/solarflower`.
