# Solarflower Visual Design Guidelines

**Version:** 1.3
**Last Updated:** March 2025
**Maintainer:** Solarflower Agents
**Changelog:** v1.3 — Phase 5 Typography: Lora serif + Caveat handwritten fonts

---

This document establishes the visual design language for all Solarflower components:
the project website, Solar Advisor web app, Panel Compass mobile app, and educational
notebook. The design philosophy is rooted in **solarpunk/soilpunk** aesthetics — a vision of
sustainable futures that blends organic natural forms with clean modern interfaces.

---

## 1. Brand Identity

### 1.1 Color Palette

The Solarflower color system is built on warm, natural tones that evoke sunlight,
vegetation, and human-centered technology. All colors are defined as CSS custom
properties for consistency across platforms.

```css
:root {
  /* Primary — Sun Amber */
  --amber:       #F5A623;
  --amber-dark:  #9A6207;
  --amber-light: #FFF3DC;

  /* Secondary — Sky Blue */
  --blue:        #2D7DD2;
  --blue-dark:   #1B5FA0;
  --blue-light:  #E8F1FB;

  /* Accent — Leaf Green */
  --green:       #4CAF50;
  --green-light: #E8F5E9;
  --green-pale:  #F1F8E9;
  --green-dark:  #2E7D32;
  --sage:        #8FBD8F;

  /* Semantic */
  --red:         #E63946;
  --success:     #22C55E;

  /* Neutrals */
  --grey:        #5C6F7A;
  --grey-light:  #F5F6F5;
  --ink:         #1B2E1B;         /* Primary text */
  --ink-light:   #3D5240;         /* Secondary text */

  /* Backgrounds */
  --bg:          #FCFCFA;         /* Main background */
  --bg-warm:     #FEFDF5;        /* Warm/hero background */

  /* EXTENDED: Earth & Dusk (Phase 1) */
  --terracotta:     #C75B39;      /* Earth, clay, soil-punk */
  --terracotta-light: #E8A08A;
  --terracotta-dark:  #8B3D26;
  --ochre:          #D4A03A;      /* Golden earth, complementary */
  --ochre-light:    #F0D090;
  --ochre-dark:     #9A7128;
  --clay:           #A67B5B;      /* Ground, roots */
  --clay-light:     #C9A68A;
  --clay-dark:      #6B5240;
  --dusk:           #6B5B95;      /* Twilight, transition */
  --dusk-light:     #9B8BB5;
  --dusk-dark:      #4A3D6A;
  --dawn:           #E8B4B8;     /* Morning sky, renewal */
  --dawn-light:     #F5D5D8;
  --dawn-dark:      #C48A8E;
  --midnight:       #2D2D44;     /* Night sky, rest */
  --midnight-light: #4A4A66;
}
```

#### Color Usage Rules

| Color | Usage |
|-------|-------|
| `--amber` | Primary actions, highlights, CTAs, brand accents |
| `--amber-dark` | Hover states for amber buttons, emphasis |
| `--blue` | Secondary actions, professional indicators, charts |
| `--green-*` | Success states, eco-friendly messaging, nature accents |
| `--ink` | Body text, headings |
| `--ink-light` | Secondary text, captions |
| `--grey` | Disabled states, subtle text |
| `--bg`, `--bg-warm` | Page backgrounds |

#### Extended Palette Usage

The earth & dusk colors add depth to the solarpunk narrative:

| Color | Meaning | Use Case |
|-------|---------|----------|
| `--terracotta` | Earth, groundedness | Ground-mount panels, soil content, "rooted" messaging |
| `--ochre` | Warmth, harvest | Complementary accents, seasonal content |
| `--clay` | Nature, craft | Subtle backgrounds, card accents, artisan feel |
| `--dusk` | Transition, twilight | Evening yield data, time-of-day visualizations |
| `--dawn` | Renewal, morning | New features, onboarding, "beginning" states |
| `--midnight` | Night, rest | Dark mode, night data |

### 1.2 Typography

Solarflower uses **system font stacks** for body text, with **serif** for headings and **handwritten** for decorative elements. This creates a distinctive editorial feel while maintaining readability.

```css
:root {
  --font-sans: "Inter", "Segoe UI", system-ui, -apple-system,
               BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --font-serif: "Lora", Georgia, "Times New Roman", serif;
  --font-hand: "Caveat", "Comic Sans MS", cursive;
  --font-mono: "SF Mono", "Fira Code", "Cascadia Code", monospace;
}
```

**Font Usage Guide:**
| Font | Purpose | Examples |
|------|---------|----------|
| `--font-sans` | Body text, UI elements | Paragraphs, buttons, navigation |
| `--font-serif` | Headings, titles | h1, h2, card titles, section titles |
| `--font-hand` | Decorative accents | Quotes, garden labels, special callouts |
| `--font-mono` | Code, technical values | Data values, code snippets |

#### Type Scale

| Level | Size (Desktop) | Size (Mobile) | Weight | Line Height |
|-------|----------------|---------------|--------|-------------|
| H1 | 3.2rem | 1.75rem | 800 | 1.15 |
| H2 | 2.2rem | 1.6rem | 800 | 1.2 |
| H3 | 1.3rem | 1.2rem | 700 | 1.3 |
| Body | 1rem | 1rem | 400 | 1.65 |
| Small | 0.85rem | 0.85rem | 400 | 1.5 |
| Caption | 0.72rem | 0.72rem | 600 | 1.4 |

**Guidelines:**
- Use generous line height (1.65 for body) for readability
- Limit line length to 60–75 characters
- Use `--font-mono` sparingly: code snippets, data values, technical labels

### 1.3 Spacing System

A consistent spacing scale based on a 4px base unit ensures rhythm and balance
throughout the interface.

```css
:root {
  --sp-1:  0.25rem;   /* 4px  */
  --sp-2:  0.5rem;   /* 8px  */
  --sp-3:  0.75rem;  /* 12px */
  --sp-4:  1rem;     /* 16px */
  --sp-5:  1.25rem;  /* 20px */
  --sp-6:  1.5rem;   /* 24px */
  --sp-8:  2rem;     /* 32px */
  --sp-10: 2.5rem;   /* 40px */
  --sp-12: 3rem;     /* 48px */
  --sp-16: 4rem;     /* 64px */
  --sp-20: 5rem;     /* 80px */
  --sp-24: 6rem;     /* 96px */
}
```

**Usage:**
- `--sp-4` to `--sp-6`: Component internal padding
- `--sp-8` to `--sp-12`: Section spacing
- `--sp-16` to `--sp-24`: Page section gaps

### 1.4 Logo & Iconography

The Solarflower logo is a stylized sunflower/solarpanel hybrid. Use the provided SVG at
`website/assets/logo.svg`. Iconography should follow these principles:

- **Style:** Clean, filled icons (not outline-only)
- **Size:** 20px for inline, 24px for navigation, 48px for feature icons
- **Stroke:** 1.5–2px for clarity at small sizes
- **Color:** Inherit from context or use `--amber` for emphasis

Never using any generic emojis like sun, leaf, flower, etc, or anything that feels too cute. Instead, use a rawer organic style that empowers instead of entertaining the user to follow design breadcrumps. So, use organic continous shapes that could be made from clay by hand, and add texture.

---

## 2. Visual Language

### 2.1 Shadows & Border Radii

Shadows are warm-tinted to complement the organic aesthetic. They use the
`--ink` color (deep green) at low opacity rather than black.

```css
:root {
  --shadow-sm:  0 1px 3px rgba(27, 46, 27, 0.06);
  --shadow-md:  0 4px 16px rgba(27, 46, 27, 0.08);
  --shadow-lg:  0 8px 32px rgba(27, 46, 27, 0.10);
  --shadow-card: 0 2px 16px rgba(27, 46, 27, 0.05),
                 0 0 0 1px rgba(76, 175, 80, 0.04);
  --shadow-card-hover: 0 12px 36px rgba(27, 46, 27, 0.10),
                       0 0 0 1px rgba(76, 175, 80, 0.08);
}
```

#### Organic Border Radii (Phase 3)

Standard geometric radii are preserved for UI elements, but organic shapes
add hand-crafted warmth for decorative elements.

```css
:root {
  /* Standard geometric radii (preserve for UI) */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  /* NEW: Organic shapes (Phase 3) */
  --radius-blob: 255px 15px 225px 15px / 15px 225px 15px 255px;
  --radius-leaf: 20px 0px 20px 0px;
  --radius-seed: 50% 50% 50% 50% / 60% 40% 60% 40%;
  --radius-pebble: 65% 35% 55% 45% / 45% 55% 65% 35%;
  --radius-pot: 30px 70px 40px 60px / 60px 40px 70px 30px;
}
```

| Radius | Feel | Best Use |
|--------|------|----------|
| `--radius-blob` | Floating, organic | Decorative blobs, floating elements |
| `--radius-leaf` | Growing, directional | Cards pointing somewhere, arrows |
| `--radius-seed` | Beginning, contained | Small badges, seed/growth icons |
| `--radius-pot` | Crafted, hand-made | Buttons with "human" feel |

### 2.2 Gradients & Backgrounds

**Hero Gradient:**
```css
background: linear-gradient(170deg,
  var(--bg-warm) 0%,
  #F6F9E8 35%,
  var(--green-light) 65%,
  #E3F0E8 100%
);
```

**Green Section Gradient:**
```css
background: linear-gradient(180deg,
  var(--green-pale) 0%,
  var(--green-light) 100%
);
```

### 2.3 Organic Decorations

The solarpunk/soilpunk aesthetic incorporates organic, nature-inspired shapes:

#### Blob Shapes
Soft, flowing blob shapes add warmth and dynamism. Use SVG paths with
smooth curves (see `website/index.html` for examples).

```svg
<!-- Example blob path -->
<path d="M44.7,-76.4C58.8,-69.2,71.8,-58.1,79.6,-44.2..."
      transform="translate(100 100)" fill="url(#blobGrad)"/>
```

**Usage:** Hero sections, section dividers, subtle background accents.

#### Vine/Leaf Accents
Decorative vine-like SVG elements add organic character to content sections.

```svg
<path d="M60,300 Q50,240 55,200 Q40,180 20,160..."
      fill="none" stroke="#66BB6A" stroke-width="1.5" opacity="0.15"/>
```

**Usage:** Section dividers, card corner decorations, decorative borders.

#### Wave Dividers
SVG wave shapes create natural transitions between sections.

```svg
<path d="M0,80 C240,110 480,40 720,70 C960,100 1200,30 1440,60..."
      fill="#ffffff"/>
```

**Usage:** Hero-to-content transition, section breaks.

### 2.4 Animations & Transitions

All animations should feel natural and organic — never abrupt.

```css
:root {
  --ease:     cubic-bezier(0.4, 0, 0.2, 1);  /* Smooth ease-out */
  --ease-in:  cubic-bezier(0.4, 0, 1, 1);   /* Gentle ease-in */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration: 0.3s;
}
```

#### Recommended Animations

| Animation | Purpose | Duration | Easing |
|-----------|---------|----------|--------|
| Blob float | Background ambiance | 20–25s | ease-in-out, infinite |
| Card hover | Lift effect on interactive cards | 0.4s | --ease |
| Button press | Tactile feedback | 0.15s | --ease |
| Reveal on scroll | Content entry | 0.6s | --ease |

**Reveal Animation Pattern:**
```css
[data-reveal] {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
}
[data-reveal].revealed {
  opacity: 1;
  transform: translateY(0);
}
```

#### Biophilic Animations (Phase 4)

Instead of generic animations, create interactions that feel alive — growing, blooming, breathing.

**Bloom Reveal** — Cards "bloom" open on scroll:
```css
@keyframes bloom {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
    filter: blur(4px);
  }
  60% {
    transform: scale(1.02) translateY(-2px);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

**Breathing Button** — Primary buttons gently pulse like a sleeping plant:
```css
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 166, 35, 0); }
  50% { box-shadow: 0 0 20px 4px rgba(245, 166, 35, 0.15); }
}
.btn--primary {
  animation: breathe 4s ease-in-out infinite;
}
.btn--primary:hover { animation: none; }
```

**Grow Progress** — Progress indicators as growing elements:
```css
@keyframes grow-up {
  from { transform: scaleY(0); transform-origin: bottom; }
  to { transform: scaleY(1); transform-origin: bottom; }
}
```

| Animation | Duration | Feel |
|-----------|----------|------|
| Bloom reveal | 0.6–0.8s | Opening flower |
| Breathe pulse | 4s | Living, patient |
| Grow progress | 1s | Natural growth |

### 2.5 Background Texture (Phase 2)

Subtle textures add depth and tactile quality — like reading a botanical field guide.
Use sparingly to maintain readability.

#### Paper Grain (Standard)
```css
background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' \
  xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence \
  baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect \
  width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E");
```

#### Canvas Weave
```css
--texture-canvas: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0zM20 20h20v20H20z' fill='%23000' fill-opacity='0.02' fill-rule='evenodd'/%3E%3C/svg%3E");
```

#### Fiber
```css
--texture-fiber: url("data:image/svg+xml,%3Csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='f'%3E%3CfeTurbulence baseFrequency='0.05' numOctaves='2' type='fractalNoise'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)' opacity='0.04'/%3E%3C/svg%3E");
```

| Texture | Feel | Use |
|---------|------|-----|
| Paper grain | Subtle, quiet | Main backgrounds |
| Canvas weave | Crafted, tactile | Cards, containers |
| Fiber | Organic, natural | Section accents |

---

## 3. Component Patterns

### 3.1 Buttons

Buttons are the primary interaction element. Follow these patterns:

#### Primary Button (Amber)
```css
.btn--primary {
  background: var(--amber);
  color: var(--ink);
  border: 2px solid var(--amber);
  border-radius: var(--radius-md);
  padding: 0.75rem 1.6rem;
  font-weight: 600;
  transition: all var(--duration) var(--ease);
}
.btn--primary:hover {
  background: var(--amber-dark);
  border-color: var(--amber-dark);
  color: #fff;
  box-shadow: 0 4px 16px rgba(245, 166, 35, 0.3);
  transform: translateY(-1px);
}
```

#### Secondary Button (Blue)
```css
.btn--blue {
  background: var(--blue-dark);
  color: #fff;
  border: 2px solid var(--blue-dark);
  /* ... same sizing */
}
```

#### Outline Button
```css
.btn--outline {
  background: transparent;
  color: var(--green-dark);
  border: 2px solid var(--sage);
}
```

#### Button Sizes
| Size | Padding | Font Size | Use Case |
|------|---------|-----------|----------|
| Default | 0.75rem 1.6rem | 0.95rem | Main CTAs |
| Small | 0.6rem 1.25rem | 0.88rem | Card CTAs, inline actions |

### 3.2 Cards

Cards display discrete content units with consistent styling:

```css
.card {
  background: var(--bg);
  border: 1px solid rgba(76, 175, 80, 0.08);
  border-radius: var(--radius-xl);
  padding: var(--sp-8) var(--sp-6) var(--sp-6);
  box-shadow: var(--shadow-card);
  transition: transform 0.4s var(--ease),
              box-shadow 0.4s var(--ease);
}
.card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-card-hover);
}
```

**Card Accent Variants:**
```css
.card--notebook { border-top: 3px solid var(--amber); }
.card--app       { border-top: 3px solid var(--blue); }
.card--mobile    { border-top: 3px solid var(--sage); }
```

### 3.3 Form Inputs

```css
input, select, textarea {
  font-family: var(--font-sans);
  font-size: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(27, 46, 27, 0.15);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--ink);
  transition: border-color var(--duration) var(--ease),
              box-shadow var(--duration) var(--ease);
}
input:focus {
  outline: none;
  border-color: var(--amber);
  box-shadow: 0 0 0 3px rgba(245, 166, 35, 0.15);
}
```

### 3.4 Navigation

```css
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(252, 252, 250, 0.82);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(76, 175, 80, 0.08);
}
```

---

## 4. Accessibility & Design Psychology

### 4.1 Color Contrast

All text must meet WCAG AA contrast requirements:

| Text Type | Minimum Ratio | Example |
|-----------|---------------|---------|
| Normal body | 4.5:1 | `--ink` on `--bg` |
| Large text | 3:1 | `--ink-light` for 18px+ |
| UI components | 3:1 | Button text on button background |
| Decorative | No requirement | Background blobs, icons |

**Verification:** Test all color combinations with Chrome DevTools or
[WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

### 4.2 Color Psychology

The Solarflower palette is deliberately chosen to evoke specific associations:

| Color | Psychology | Usage |
|-------|-----------|-------|
| Amber (#F5A623) | Warmth, energy, optimism, sunlight | Primary brand, CTAs, highlights |
| Blue (#2D7DD2) | Trust, professionalism, sky | Professional tools, data |
| Green (#4CAF50) | Growth, nature, sustainability | Success, eco-messaging |
| Sage (#8FBD8F) | Calm, organic, approachable | Secondary accents, nature |
| Deep Green (#1B2E1B) | Grounding, stability, nature depth | Text, headings |

### 4.3 Visual Hierarchy

Establish clear hierarchy through:

1. **Size:** Larger = more important (title > subtitle > body > caption)
2. **Weight:** Heavier font weight = higher emphasis (700 > 500 > 400)
3. **Color:** Brighter/darker = attention (amber > ink > grey)
4. **Spacing:** Whitespace around an element increases its visual weight
5. **Contrast:** Higher contrast = faster recognition of key information

### 4.4 Motion Sensitivity

Respect users who experience motion sensitivity:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  html { scroll-behavior: auto; }
}
```

### 4.5 Focus Indicators

All interactive elements must have visible focus states:

```css
:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
```

---

## 5. Component-Specific Guidelines

### 5.1 Website (Static HTML/CSS)

**Location:** `website/`

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (no framework required)

**Requirements:**
- No build step preferred; single-page with inline or separate CSS
- All external resources must be accessible without JavaScript
- Responsive: mobile (320px+), tablet (768px+), desktop (1024px+)

**Design Patterns:**
- Use container class for max-width: 1140px
- Implement hero, component cards, open source section, footer
- Include organic blob shapes in hero
- Use wave divider between hero and content

**Storytelling Layouts (Phase 8):**
- `.garden` — Three-column "solar garden" layout showing seeds→growing→harvest journey
- `.field-guide` — Annotated botanical diagram section with quote styling
- `.comparison` — Before/after transformation cards
- `.timeline` — Horizontal timeline for daily yield progression

**Organic Visual Elements:**
- Pottery-shaped buttons (`--radius-pot`)
- Canvas texture on cards
- Floating seed particles in hero
- Decorative star/seed accents (✦, ☀, ⚡)
- Vine-like gradient accent on navigation

**File Structure:**
```
website/
├── index.html          # Main landing page
├── styles.css          # All styles
├── main.js             # Interactions (reveal animation)
├── solar-advisor.html  # Solar Advisor subpage
├── article.html        # Notebook article page
├── assets/
│   ├── logo.svg
│   ├── hero-illustration.svg
│   └── solarflower-animation.mp4
└── README.md           # Local dev instructions
```

### 5.2 Solar Advisor (Streamlit Web App)

**Location:** `solar-app/`

**Tech Stack:** Python, Streamlit, Plotly, pvlib

**Design Integration:**
- Streamlit's `st.config` for theme customization
- Match `--amber` (#F5A623) for Streamlit primary color
- Use Plotly template that respects brand colors
- Custom CSS via `st.markdown(style, unsafe_allow_html=True)`

**Chart Colors:**
```python
SUN_COLOR  = "#F5A623"
BLUE_COLOR = "#2D7DD2"
GREY_COLOR = "#AAAAAA"
RED_COLOR  = "#E63946"
```

**Sidebar Design:**
- Use `--blue-light` for section backgrounds
- Amber accent for primary buttons
- Consistent spacing with main design system

### 5.3 Panel Compass (Mobile PWA)

**Location:** `mobile-app/`

**Tech Stack:** Vanilla JavaScript, HTML5, CSS3, PWA (Service Worker)

**Mobile-Specific:**
- Touch-first design: minimum 44px touch targets
- Large compass visualization (primary UI element)
- High contrast for outdoor readability
- Use `--amber` for on-target indicator
- Use `--red` for far-off indicator
- Use `--success` (22C55E) for perfect alignment

**Screen Layout:**
```
┌─────────────────────────────┐
│  [Location]                 │
├─────────────────────────────┤
│                             │
│     COMPASS (large)         │
│     Current vs Target       │
│                             │
├─────────────────────────────┤
│     TILT METER              │
│     Current vs Target       │
├─────────────────────────────┤
│  Status & Yield Estimate    │
└─────────────────────────────┘
```

**PWA Requirements:**
- manifest.json with app name, icons, theme color (#F5A623)
- Service worker for offline functionality
- Standalone display mode

### 5.4 SciComm Notebook (Jupyter)

**Location:** `notebook/`

**Tech Stack:** Jupyter Notebook, Python, matplotlib/plotly, IPython

**Design Integration:**
- Use brand colors in matplotlib/plotly visualizations
- Consistent color scheme across all charts
- Clean, minimal figure styling (remove unnecessary borders)
- Use `--amber` for sun/data highlights
- Use `--blue` for comparison data
- Use `--green` for optimal/reference lines

**Plot Style Example:**
```python
plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.size': 11,
    'axes.titlesize': 14,
    'axes.labelsize': 12,
    'figure.titlesize': 16,
    'axes.prop_cycle': plt.cycler('color', ['#F5A623', '#2D7DD2', '#4CAF50']),
})
```

---

## 6. Implementation Reference

### 6.1 Complete CSS Variables

Copy this to any new component to get started:

```css
:root {
  /* Colors */
  --amber:       #F5A623;
  --amber-dark:  #9A6207;
  --amber-light: #FFF3DC;
  --blue:        #2D7DD2;
  --blue-dark:   #1B5FA0;
  --blue-light:  #E8F1FB;
  --green:       #4CAF50;
  --green-light: #E8F5E9;
  --green-pale:  #F1F8E9;
  --green-dark:  #2E7D32;
  --sage:        #8FBD8F;
  --grey:        #5C6F7A;
  --grey-light:  #F5F6F5;
  --ink:         #1B2E1B;
  --ink-light:   #3D5240;
  --bg:          #FCFCFA;
  --bg-warm:     #FEFDF5;
  --red:         #E63946;
  --success:     #22C55E;

  /* Extended: Earth & Dusk (Phase 1) */
  --terracotta:      #C75B39;
  --terracotta-light:#E8A08A;
  --terracotta-dark: #8B3D26;
  --ochre:           #D4A03A;
  --ochre-light:     #F0D090;
  --ochre-dark:      #9A7128;
  --clay:            #A67B5B;
  --clay-light:      #C9A68A;
  --clay-dark:       #6B5240;
  --dusk:            #6B5B95;
  --dusk-light:      #9B8BB5;
  --dusk-dark:       #4A3D6A;
  --dawn:            #E8B4B8;
  --dawn-light:      #F5D5D8;
  --dawn-dark:       #C48A8E;
  --midnight:        #2D2D44;
  --midnight-light:  #4A4A66;

  /* Typography */
  --font-sans: "Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --font-serif: "Lora", Georgia, "Times New Roman", serif;
  --font-hand: "Caveat", "Comic Sans MS", cursive;
  --font-mono: "SF Mono", "Fira Code", "Cascadia Code", monospace;

  /* Spacing */
  --sp-1: 0.25rem;
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;
  --sp-5: 1.25rem;
  --sp-6: 1.5rem;
  --sp-8: 2rem;
  --sp-10: 2.5rem;
  --sp-12: 3rem;
  --sp-16: 4rem;
  --sp-20: 5rem;
  --sp-24: 6rem;

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(27, 46, 27, 0.06);
  --shadow-md:  0 4px 16px rgba(27, 46, 27, 0.08);
  --shadow-lg:  0 8px 32px rgba(27, 46, 27, 0.10);
  --shadow-card: 0 2px 16px rgba(27, 46, 27, 0.05), 0 0 0 1px rgba(76, 175, 80, 0.04);
  --shadow-card-hover: 0 12px 36px rgba(27, 46, 27, 0.10), 0 0 0 1px rgba(76, 175, 80, 0.08);

  /* Radii (geometric) */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  /* Radii (organic - Phase 3) */
  --radius-blob: 255px 15px 225px 15px / 15px 225px 15px 255px;
  --radius-leaf: 20px 0px 20px 0px;
  --radius-seed: 50% 50% 50% 50% / 60% 40% 60% 40%;
  --radius-pebble: 65% 35% 55% 45% / 45% 55% 65% 35%;
  --radius-pot: 30px 70px 40px 60px / 60px 40px 70px 30px;

  /* Motion */
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --duration: 0.3s;
}
```

### 6.2 Responsive Breakpoints

```css
/* Base: Mobile-first (320px+) */

/* Tablet and up */
@media (min-width: 601px) { /* ... */ }

/* Desktop and up */
@media (min-width: 961px) { /* ... */ }

/* Large screens */
@media (min-width: 1281px) { /* ... */ }
```

### 6.3 Testing Checklist

Before releasing any component, verify:

- [ ] Colors pass WCAG AA contrast (4.5:1 for text)
- [ ] All interactive elements have visible focus states
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Layout works at 320px, 768px, and 1280px widths
- [ ] Touch targets are at least 44px on mobile
- [ ] No horizontal scroll on any viewport
- [ ] All images have appropriate alt text
- [ ] Buttons and links have clear visual distinction

---

## 7. Maintenance

### Updating This Document

When updating the design system:

1. **Version bump** — Increment the version number at the top
2. **Change categories** — Document what changed and why
3. **Cross-component review** — Ensure changes work across all components
4. **Test** — Run through the testing checklist

### Coordinate Conventions (Critical)

All components must use consistent coordinate systems:

- **Azimuth:** 0° = North, 90° = East, 180° = South, 270° = West (clockwise from above)
- **Tilt:** 0° = horizontal, 90° = vertical

---

## 8. Resources

- **Website reference:** `website/index.html`, `website/styles.css`
- **Web app reference:** `solar-app/ui/charts.py`, `solar-app/ui/styles.css`
- **Mobile app spec:** `.claude/agents/04-mobile-app/04_mobile-app.md`
- **Agent coordination:** `.claude/agents/02-website/02_website.md`
- **Implementation plan:** `.claude/agents/00_design-plan-phases5-8.md`
- **Design improvements:** `.claude/agents/00_design-improvements.md`
- **Color contrast tool:** https://webaim.org/resources/contrastchecker/
- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/

---

## 9. Completed & Future Phases

### ✅ Phase 1–4: Core Foundation (COMPLETE in v1.1)
- Earth & dusk color palette
- Organic border radii
- Paper/canvas textures
- Biophilic animations

### ✅ Aggressive Visual Overhaul (COMPLETE in v1.2)
- Organic pottery-shaped buttons
- Canvas texture on cards
- Floating seed particles in hero
- Decorative star/seed accents
- Vine-like nav border
- Storytelling layouts (garden, field guide)

### ✅ Phase 5: Typography Evolution (COMPLETE in v1.3)
- [x] Add warm serif font (Lora) for headings
- [x] Add handwritten accent font (Caveat) for decorative elements
- [x] Google Fonts CDN with font-display: swap (self-host option documented)

**Typography Usage:**
```css
/* Headings - Serif */
h1, h2, .hero__title, .section-title, .card__title {
  font-family: var(--font-serif);
}

/* Decorative - Handwritten */
.garden__plot h3, .field-guide__quote {
  font-family: var(--font-hand);
}
```

### 🚧 Phase 6: Iconography Evolution

### 🚧 Phase 7: Organic Data Visualization
- [ ] Sun path as flower petal diagram
- [ ] Energy flow as root/sap system
- [ ] Monthly yield as tree rings
- [ ] Heatmaps with organic contours

### ✅ Phase 8: Storytelling Layouts (COMPLETE in v1.2)
- [x] Timeline: sun's journey through the day
- [x] Before/After: transformation comparisons
- [x] Garden layout: grouped content as garden beds
- [x] Field guide: annotated botanical illustrations

---

**Implementation Reference:**
- `.claude/agents/00_design-plan-phases5-8.md` — Detailed implementation plan for remaining phases

*This document is maintained as part of the Solarflower project. For questions,
contact robin.gutzen@outlook.com.*
