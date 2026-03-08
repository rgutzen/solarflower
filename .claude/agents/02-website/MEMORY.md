# Agent 02 — Website: Persistent Memory

_Update this file after every working session._
_Last updated: 2026-03-07_

## Scope
- **Directory:** `/home/rgutzen/01_PROJECTS/solarflower/website/`
- **Base prompt:** `.claude/agents/02-website/02_website.md`
- **Do NOT modify:** any file outside `website/`

## Current State

**V1 complete.** Static landing page built and running.

### Files created
```
website/
├── index.html              (238 lines) — Semantic HTML, all sections
├── styles.css              (678 lines) — Full responsive design
├── main.js                 (63 lines)  — Scroll reveal, nav state
└── assets/
    ├── logo.svg            — Sunflower/solar-panel hybrid icon
    └── hero-illustration.svg — Animated sun + panel scene
```

## Decisions Made

- [x] **Tech stack:** Plain HTML/CSS/JS — zero build step, zero dependencies
- [x] **Typography:** System font stack (Inter → Segoe UI → system-ui)
- [x] **Color palette:** Amber `#F5A623` primary, Blue `#2D7DD2` secondary, Ink `#1a1a2e` text
- [x] **Buttons:** Dark text on amber (8.42:1), white on blue-dark (9.08:1) — all WCAG AA
- [x] **Layout:** CSS Grid cards, responsive breakpoints at 960px / 480px
- [x] **Animations:** IntersectionObserver reveal-on-scroll, CSS hover transitions, SVG sun pulse
- [ ] Deployment target: TBD (GitHub Pages, Netlify, etc.)
- [ ] Domain name: TBD

## Design Constraints (from base prompt)
- Accent color: `#F5A623` (brand, matches web-app) ✅
- Responsive: mobile + desktop ✅
- No tracking scripts ✅
- Semantic HTML with accessibility (contrast ratio ≥ 4.5:1) ✅
- SPDX license header on every file ✅

## Accessibility Audit (all PASS AA)
- Ink on white: 17.06:1
- Ink-light on white: 8.68:1
- Dark text on amber btn: 8.42:1
- White on amber hover: 5.28:1
- White on blue-dark btn: 6.58:1
- Badge text: all ≥ 4.5:1
- Focus-visible outlines: 2px amber
- Keyboard navigable: all links + buttons

## Links Embedded
- Web-App: `http://localhost:8501` (placeholder)
- Notebook: `https://github.com/rgutzen/solarflower/blob/main/solar_panel_power.ipynb`
- GitHub: `https://github.com/rgutzen/solarflower`
- Mobile: `#coming-soon` (greyed out)

## TODO / Next Iteration
- [ ] Deploy to GitHub Pages or Netlify
- [ ] Update Web-App link once deployed
- [ ] Add favicon (PNG fallback for browsers that don't support SVG favicon)
- [ ] Consider adding a "How it works" section or architecture diagram
- [ ] Add OG image for social sharing
- [ ] Test on real mobile devices
