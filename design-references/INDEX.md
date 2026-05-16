# CAELIXA DESIGN REFERENCES — INDEX

All design files are READ-ONLY for Claude Code. Track B chat (Claude.ai) owns updates.
Visual analysis flow: render component → screenshot at 480px → post to Opus chat with spec section + design filename → fix drift → commit.

**Design self-criticism note (applies from A2 onwards):** Before each screen-build session, identify the 3 weakest design decisions in the relevant files below. Surface to Opus chat before writing any screen code.

---

## ACTIVE DESIGN FILES

| Design file | Implements (spec section) | Status | Notes |
|-------------|---------------------------|--------|-------|
| `caelixa-design-deliverables/previews/caelixa-home-dark-375.png` | `2-Product-home-v1_1.md` — full home layout · dark theme | ACTIVE | 375px · primary mobile breakpoint |
| `caelixa-design-deliverables/previews/caelixa-home-dark-390.png` | `2-Product-home-v1_1.md` — full home layout · dark theme | ACTIVE | 390px · iPhone 14/15 Pro |
| `caelixa-design-deliverables/previews/caelixa-home-dark-430.png` | `2-Product-home-v1_1.md` — full home layout · dark theme | ACTIVE | 430px · iPhone 14/15 Plus |
| `caelixa-design-deliverables/previews/caelixa-home-light-375.png` | `2-Product-home-v1_1.md` — full home layout · light theme | ACTIVE | 375px |
| `caelixa-design-deliverables/previews/caelixa-home-light-390.png` | `2-Product-home-v1_1.md` — full home layout · light theme | ACTIVE | 390px |
| `caelixa-design-deliverables/previews/caelixa-home-light-430.png` | `2-Product-home-v1_1.md` — full home layout · light theme | ACTIVE | 430px |
| `caelixa-design-deliverables/previews/caelixa-home-375.png` | `2-Product-home-v1_1.md` — full home layout | ACTIVE | Default (dark assumed) |
| `caelixa-design-deliverables/previews/caelixa-home-390.png` | `2-Product-home-v1_1.md` — full home layout | ACTIVE | Default |
| `caelixa-design-deliverables/previews/caelixa-home-430.png` | `2-Product-home-v1_1.md` — full home layout | ACTIVE | Default |
| `caelixa-design-deliverables/pages/preview.html` | `2-Product-home-v1_1.md` — interactive home prototype | ACTIVE | Open in browser for full interactive reference |
| `caelixa-design-deliverables/logo/caelixa-logo-horizontal-dark.svg` | All screens — dark mode nav + splash | ACTIVE | Primary dark logo |
| `caelixa-design-deliverables/logo/caelixa-logo-horizontal-light.svg` | All screens — light mode nav + splash | ACTIVE | Primary light logo |
| `caelixa-design-deliverables/logo/caelixa-app-icon.svg` | App icon · PWA manifest | ACTIVE | Vector source |
| `caelixa-design-deliverables/logo/caelixa-app-icon-1024.png` | App store · splash | ACTIVE | 1024px |
| `caelixa-design-deliverables/logo/caelixa-mark-transparent.svg` | Standalone mark · loading states | ACTIVE | Transparent bg |
| `caelixa-design-deliverables/logo/caelixa-mark-mono.svg` | Monochrome usage | ACTIVE | Single colour contexts |
| `caelixa-design-deliverables/docs/caelixa-brand-notes.md` | All screens — colour · motion · typography | ACTIVE | Dark: deep graphite + soft blue. Light: white/mist + slate + calm blue. Motion: C arc first → bars → pulse → wordmark. |

---

## BRAND EXPLORATION (historical — not for direct implementation)

| File | Notes |
|------|-------|
| `caelixa-design-deliverables/brand-exploration/caelixa-logo-comparison.png` | Three logo route comparison |
| `caelixa-design-deliverables/brand-exploration/caelixa-v1-arc-motion.gif` | Arc route motion study |
| `caelixa-design-deliverables/brand-exploration/caelixa-v2-lift-motion.gif` | Lift route motion study |
| `caelixa-design-deliverables/brand-exploration/caelixa-v3-tile-motion.gif` | Tile route motion study |
| `caelixa-design-deliverables/brand-exploration/caelixa-brand-preview.html` | Full brand preview page |

---

## MISSING / PENDING DESIGNS

These will be added in future Track B sessions before the relevant screen-build sessions.

| Screen | Spec | Required before |
|--------|------|-----------------|
| MyMoney treemap + tile grid | `2-Product-mymoney-v2_1.md` | A6 |
| Cashflow chart + funded-ratio card | `2-Product-cashflow-v1_1.md` | A3 |
| Tax & Estate CoI odometer | `2-Product-tax-estate-v1_1.md` | A8 |
| Timeline runway chart | `2-Product-timeline-v1_1.md` | A9 |
| Risk overlay | `2-Product-risk-layer-v1_1.md` | A9 |
| Triple-anchor component | `2-Product-home-v1_1.md §6.3` | A2 |
| Onboarding flow | `2-Product-onboarding-v0_5.md` | s05 |

---

— end of INDEX.md —
