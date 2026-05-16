# DESIGN — Sonuswealth

> Synthesised from `src/index.css` (520 lines) + `src/styles/design-tokens.css` (397 lines) + `src/config/brand.js`. Authority chain: Stitch reference HTML + founder direction 2026-05-11.

## Two themes, two named palettes

| Mode | Name | Strategy |
|---|---|---|
| Dark | **Mathematical Resonance** | Deep navy ground, mathematical-teal accent, coral risk, gold reserved for diff/X29 |
| Light | **Digital Sterling** | Warm off-white, indigo primary, deep red alert. **No green** — indigo carries success too |

Theme follows the founder's explicit physical scene:
- *"User checking their wealth picture before bed on phone in a dim room"* → dark default
- *"IFA reviewing client at desk under fluorescent office light"* → light mode primary for laptop

## Color tokens (OKLCH-equivalent hex, dark)

```
--c-bg       #051424   page ground
--c-bg2      #0c1119   section grouping
--c-surface  #122131   tile fill base
--c-surface2 #1a2a3d   elevated tile
--c-surface3 #273647   highest elevation

--c-text     #d4e4fa   primary
--c-text2    #a9b5c8   muted
--c-text3    #8793a7   tertiary / labels

--c-acc      #5ddbc2   Mathematical Teal — PRIMARY ACCENT
--c-acc2     #7aa7ff   blue — DATA-VIS ONLY (wrapper segments)
--c-acc3     #ff6f7d   coral — RISK / ALERT
--c-gold     #ffbd59   gold — RESERVED FOR DIFF (X29 change-since-last-view)
--c-violet   #ba8cff   data-vis only
```

**Discipline:** 5 functional dark colors only — text, mint (success), coral (risk), gold (diff), neutral. Violet + blue are reserved for data encoding (wrapper segments in MyMoney composition bar; risk dim breakdown). Don't decorate with them.

Gold is the diff-only color. If gold appears anywhere it isn't communicating "changed since last view", that's a bug.

## Color tokens (light)

```
--c-bg       #faf9fc   warm off-white (NOT iOS grey)
--c-surface  #ffffff   pure white tile
--c-text     #1a1c1e

--c-acc      #1c3fe7   Action Indigo — primary accent + success (replaces green)
--c-acc3     #ba1a1a   deep red — alert / leak
--c-gold     #b96d00   dim gold — diff only
```

Light mode has **no green**. Indigo carries success state — confirmation, achieved milestones, healthy score bands.

## Typography

- **Family:** Inter (`'Inter', ui-sans-serif, system-ui, ...`)
- **Floor policy (set 21 Apr 2026):**
  - Body text minimum 14px (`--fs-body`)
  - Secondary / metadata floor 13px (`--fs-small`)
  - 11px only for uppercase 0.8px-tracked labels (`--fs-label`)
  - Hero numbers 28px on triple-anchor (`--fs-hero`), 36px standalone (`--fs-hero-lg`)
- **Weight ladder:** 400 / 600 / 700 / 800 only. No arbitrary 780/820/850/880.
- **Letter spacing:** -0.5px hero, 0 body, 0.8px uppercase labels, 1.2px extra-tracked headers.

## Layout

- **Spacing rhythm:** 4 / 8 / 12 / 16 / 20 / 28 / 40 px (`--space-xs` through `--space-3xl`). Don't invent intermediate values.
- **Radii:** 6 / 10 / 14 / 20 / 999 px. RevealCards use 20. Pill chips use 999.
- **Card surface (dark):** `linear-gradient(180deg, rgba(18,33,49,.86), rgba(9,20,36,.92))` with `inset 0 1px 0 rgba(255,255,255,.06)` inset highlight.
- **Shadows (dark):** small `0 1px 2px / .20`, medium `0 4px 12px / .25`, large `0 12px 32px / .32`.
- **Shadows (light):** ambient, never harsh: `0 2px 7px / .07` small, `0 24px 60px / .13` large.

## Components

| Class | Purpose |
|---|---|
| `.sw-card` | Base card surface — gradient fill, hairline border, inset highlight |
| `.sw-tile` | Tile primitive — used in MyMoney domain tiles |
| `.sw-chip` (+ `-mint / -blue / -coral / -amber / -violet`) | Pills + chips with tinted semantic backgrounds |
| `.sw-eyebrow` | Uppercase 11px 0.8-tracked label (section headers) |
| `.sw-hero-md` | 22px score number used in compact contexts |
| `.sw-press` | Press state with active scale + opacity |
| `.sw-lift` | Hover lift (translateY -1px + shadow bump) |
| `.sw-cascade-halo` | Counter-up halo on cascading recompute (§13.6 What-If Cinema) |
| `.sw-tab-slide` | Keyed wrapper that re-fires child mount animations on viewMode change |

## Motion

- Easing: exponential ease-out (ease-out-quart / quint / expo). **No bounce, no elastic.**
- Durations: fast 200ms (`--dur-fast`), micro animations under 300ms, cinema-banner 1.2s cubic-bezier(0.16, 1, 0.3, 1).
- `prefers-reduced-motion` honored globally in `src/styles/animations.css`.
- Don't animate CSS layout properties.

## Charts / Data viz

- **Radar:** theme-aware tokens — `--c-radar-fill / stroke / glow / ring / axis / node-bg`. Dark = teal, light = indigo.
- **Score Journey lines:** Wealth = `--c-acc`, Risk = `--c-acc2`, NW = `--c-acc3`. Plan target = dashed `--c-gold`.
- **Confidence band:** widens for projection horizon. Use `--c-acc3-bg` fill, opacity 0.10.
- **Diff state (X29):** gold (`--c-gold`) only. Never use gold for anything else.

## Responsive behavior

- **Mobile** (<768px): single column, bottom-tab nav, hero numbers 28px
- **iPad** (768–1023px): 2-col tile grid, bottom-tab nav retained
- **Laptop** (≥1024px): sidebar nav (Shell/Sidebar.jsx), 3-col tile grid, max-width 1280px content area, bottom-tab hidden

## Existing violations to flag (audit candidates)

- **Side-stripe borders** on Priority Action cards (`borderLeft: '4px solid ${critical.colour}'`). Currently used to flag severity. Per impeccable: rewrite with full border, background tint, or leading icon.
- **Z0 orientation pill** uses a gradient background (`linear-gradient(90deg, rgba(0,229,168,0.10), var(--c-surface))`) which is fine, but the dismissible-banner pattern repeats in stale-data prompt + cinema banner. Risk of pattern fatigue.
- **Plan staleness banner** also uses left-stripe (yellow). Same anti-pattern.

These should be addressed in a future `/impeccable polish` pass, not in the current radar-restoration scope.
