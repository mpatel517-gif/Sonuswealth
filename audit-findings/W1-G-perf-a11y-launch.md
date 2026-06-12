# W1-G — Performance + Accessibility + Launch Readiness + Mobile

**Agent:** W1-G (relaunch) · **Date:** 2026-06-11 · **Status:** IN PROGRESS — sections appended as completed
**Finding IDs:** F-700..F-799

---
## Section 1 — PERFORMANCE

### 1.1 Build output (confirmed, vite 8.0.8 / rolldown, 397 modules, exit 0)

| Chunk | Size | gzip |
|---|---|---|
| index-B0TqoACy.js | **1,592.23 kB** | 422.50 kB |
| engine-CvjlZBWM.js | 717.88 kB | 213.85 kB |
| mymoney-CV3FVlgw.js | 570.18 kB | 148.49 kB |
| charts-BIIU11tf.js | 304.28 kB | 94.58 kB |
| vendor-react | 178.35 kB | 56.34 kB |
| charts-cashflow | 32.28 kB | 7.92 kB |
| index.css | 30.69 kB | 7.49 kB |

**F-700 (HIGH) — No route-level code splitting; first paint ships ~3.4 MB JS (≈940 kB gzip).**
`vite.config.js:33-44` does `manualChunks` only (vendor/engine/charts/mymoney). There is **zero dynamic `import()`** in the app: `src/App.jsx:3-33` statically imports Welcome/Onboarding/Account/Dashboard/Legal/PanelPreviewGallery, and `src/screens/Dashboard.jsx:12-39` statically imports ALL 20+ screens (HomeScreen, FQBreakdown, MyMoney, Cashflow, TaxEstate, Risk, RiskOverlay, Timeline, Ask, Settings, DataCapture, Vault, NotificationCentre, Reports, IFAPractice, DecisionEngine, DecisionEngineV2, MagicShowcase, MoneyIncome…). `manualChunks` splits files into separate chunks but every chunk is still a static dependency of the entry — the browser downloads all of them up front. The vite.config comment ("engine + charts load lazily") is **wrong**: nothing is lazy without `import()` boundaries.

**F-701 (HIGH) — 429 kB of persona JSON baked into the index chunk.**
`src/App.jsx:35-68` statically imports 22 persona/fixture JSONs (`src/rules/personas/*.json`, 429 kB raw, 972 kB on disk dir). 13 of them are mrT engine-test fixtures that mostly render a "not UI-renderable" notice (App.jsx:53-56) — pure dead weight for every real user. This is a large slice of the 1.59 MB index chunk.

**F-702 (MEDIUM) — Route-level code-split plan (concrete):**
1. In `Dashboard.jsx`, convert every screen import to `const MyMoney = React.lazy(() => import('./MyMoney.jsx'))` etc.; wrap the tab-body switch in one `<Suspense fallback={<TabSkeleton/>}>`. Keep HomeScreen eager (default tab).
2. In `App.jsx`, lazy Onboarding/Account/Legal/PersonaSelect/PanelPreviewGallery (pre-auth screens render Welcome only).
3. Persona JSONs → `const loadPersona = (id) => import(\`./rules/personas/persona-${id}.json\`)` registry; keep persona-a (default Bruce) eager. mrT fixtures load only on `?demo=mrt-*`.
4. Engine note: `App.jsx:12,19,31` imports `bundle-wiring`/`persona-normalizer`/`cma` at boot, so the 718 kB engine chunk stays on the critical path unless those three boot helpers are extracted into a tiny `engine-boot` module (manualChunks rule for `/src/engine/(bundle-wiring|persona-normalizer|cma)`) — do this or engine still blocks first paint.
5. Expected outcome: first paint ≈ vendor-react 178 kB + app shell ~250-350 kB + HomeScreen deps (≈150-250 kB gzip total vs 940 kB today); mymoney 570 kB + charts 304 kB + TaxEstate/Cashflow code load on tab entry; warning at `chunkSizeWarningLimit: 800` can drop back to 500.

### 1.2 Render hot-spots (top 10, file:line)

| # | ID | Sev | Location | Issue |
|---|---|---|---|---|
| 1 | F-703 | HIGH | `Cashflow.jsx:1673-1677` | `calcFQ(entity)`, `calcRisk(entity)`, `netWorth(entity)` called bare in the top-level screen render body (next to a correctly-memoised `cashflowHealth` at :1681). Cashflow has **62 useState** hooks — every keystroke/slider/scrub anywhere in the screen re-runs all three engine passes. |
| 2 | F-704 | HIGH | `MyMoney.jsx` whole file | 4,781 lines, only **9 useMemo**. Engine calls bare in render: `calcAllIncome` :1152, `monthlySurplus` :1395, `calcANI`+`calcPersonalAllowance`+`calcPSA`+`calcHICBC`+`calcMarriageAllowance` :1527-1532, `ihtDeltaPrePost2027` :4001, `projectValue` :4184/4190, `amortise` :4480. Any parent state change recomputes the full tax stack. |
| 3 | F-705 | MED | `TaxEstate.jsx` | `te_ihtExposure(entity)` independently recomputed in ≥6 components (:1841, :1851 postPension variant, :2534, :2586, :3188, :3564) plus `te_*Detail` per-section (:856-1450). Same entity, same answer, no shared memo/context — N full IHT computations per render pass. |
| 4 | F-706 | MED | `Cashflow.jsx:4988-4991, 5416-5419, 6164-6167` | Three scrubber components each run `calcAge` + `monthlySurplus(entity, getActiveCMA())` via bare IIFEs in render — these are the ScrubTrack hosts, so they re-run **per scrub frame**. |
| 5 | F-707 | MED | `MyMoney.jsx:1527-1532` (ANIPanel) | Five chained tax calcs (ANI→PA→PSA→HICBC→MA) recomputed whenever the panel re-renders, incl. RevealCard open/close toggles. |
| 6 | F-708 | LOW | `TaxEstate.jsx:3564` | `te_ihtExposure` + `calcAge` inside a `useState` initialiser — runs once, OK, but duplicates work already done by the 6 sites above; symptom of the missing shared selector layer. |
| 7 | F-709 | LOW | `MagicShowcase.jsx:75-78` | Manual rAF loop with `setCoi`/`setScore` per frame, **no cancelAnimationFrame on unmount** — unmount during the 800 ms tween → setState-after-unmount. Only un-cleaned animation loop found. |
| 8 | F-710 | LOW | `SecuritySettings.jsx:31-35` | `setInterval` effect with `[elevatedTick]` deps — interval torn down and recreated **every second**. Not a leak (cleanup exists) but pointless churn; deps should be `[]` keyed on elevation state. |
| 9 | F-711 | LOW | `Cashflow.jsx:3083` | `calcAge(entity)` IIFE in render of cohort component — cheap individually, pattern repeats ~6× across the file. |
| 10 | F-712 | INFO | Timer hygiene elsewhere is GOOD | `useAnimation.jsx:89-93` cancels rAF; `Ask.jsx:895`, `AskSonuFlow.jsx:123`, `Whisper.jsx:39` all clearInterval. No other leaks found. |

## Section 2 — ACCESSIBILITY (grep-based)

Scan: custom AST-lite scan over all src/*.jsx|js (`audit-findings/_w1g_a11y_scan.cjs`). Positives first: 0 `<img>` without alt; `TapTarget.jsx` enforces 44×44 + Enter/Space; skip-link present (`App.jsx:480`); `X28TopBar.jsx:362` uses proper `role="tab"`/`aria-selected`; OverlayShell + DrillStack both have `role="dialog"` + `aria-modal` + Escape handling.

### Top 15 issues

| # | ID | Sev | Location | Issue |
|---|---|---|---|---|
| 1 | F-713 | HIGH | 92 buttons app-wide | Icon/glyph buttons without `aria-label` (← ✕ ⋯ ◀ ▶ etc.). Worst clusters: `Cashflow.jsx:511,635` (✕ close buttons), `AddItemSheet.jsx:410,645` (← Back), `AskSonuFlow.jsx:159,606`, `DecisionTree/index.jsx:103`, `PivotView.jsx:614`. Full list reproducible via scan script. |
| 2 | F-714 | HIGH | OverlayShell.jsx (no focus mgmt) | `aria-modal="true"` + `role="dialog"` but **no focus trap, no initial focus, no focus restore** on close (zero `focus()` calls in file). Keyboard users stay focused on the launcher button BEHIND the full-screen overlay; SR told background is inert while keyboard can still reach it — WCAG 2.4.3 failure on every MyMoney/T&E drill. |
| 3 | F-715 | HIGH | `DrillStack.jsx:96-133` | Same pattern at L4: pushed panels never receive focus, pop never restores it. Lower panels get `opacity:0` + `pointerEvents:'none'` but remain in the DOM and in tab order (no `inert`/`aria-hidden`). Escape works (:80, capture-phase) — good — but focus is unmanaged. |
| 4 | F-716 | MED | 29 clickable divs | `<div onClick>` without role/tabIndex/onKeyDown — invisible to keyboard. Worst: `Risk.jsx` ×8 (:301,:649,:817,:1185,:1375,:1634,:1804,:1809), `HomeScreen.jsx` ×4 (:384,:459,:491,:787), `Dashboard.jsx:231,244,1048`, `DataCapture.jsx:599,628,805`, `CategoryTile.jsx:316,330`, `Onboarding.jsx:300,342`, `Timeline.jsx:1929`, `GoalSeekable.jsx:89`, `LiabilityTile.jsx:261`. |
| 5 | F-717 | MED | text <11px: **710 occurrences** | fontSize 10 ×442, 9 ×194, 8 ×72, 7 ×1, 0 ×1. fontSize≤9 concentrated in Cashflow charts: `CashflowWaterfall.jsx:92,183`, `FundedRatioGauge.jsx:265` (8px), `PoSChart.jsx:144`, `SequenceStressVis.jsx:96,152,197`, `ScenarioMatrix.jsx:164`, `EfficientFrontier.jsx:106`, `CalendarHeatmap.jsx:187`, `IHTDeltaCard.jsx:394,441`. DESIGN.md typography floor is being violated at scale. |
| 6 | F-718 | MED | `index.css:266` `.ib` | Topbar icon buttons hard-sized **34×34** — below 44px touch floor; these are the most-tapped controls (notifications, settings, theme). TapTarget exists but isn't used here. |
| 7 | F-719 | MED | Contrast PASS but fragile | Measured: dark `--c-text3` #95a1b5 on `--c-surface2` #1a2a3d ≈ **5.6:1** (pass); light #5a6678 on #efedf0 ≈ **5.0:1** (pass). P11-2 comments show tuning was done for `c-surface3`. BUT text3 is widely used at 10px (`.fca`, `.disclaimer`, `.data-date`, `.ni-lbl` index.css:255,269,309,619) — passing ratio + sub-floor size still reads as failure in practice. |
| 8 | F-720 | MED | `PivotView.jsx:614` | 10px-font `<button>` with no aria-label and tiny implied hit area — fails F-713 + F-717 + F-718 simultaneously. |
| 9 | F-721 | LOW | `Dashboard.jsx:231,244` | Persona/topbar chips as clickable divs in the app shell — present on EVERY screen, so the keyboard hole is global, not per-tab. |
| 10 | F-722 | LOW | `Onboarding.jsx:300,342` | Onboarding answer tiles unreachable by keyboard — a keyboard-only user cannot complete signup. Upgrade to HIGH if launch includes self-serve signup. |
| 11 | F-723 | LOW | `AssetDetailOverlay.jsx:429`, `StateTileRow.jsx:52` | More `aria-modal` dialogs sharing the no-focus-trap pattern (same fix as F-714 — one shared `useFocusTrap` hook fixes all four). |
| 12 | F-724 | LOW | `GoalSeekable.jsx:89` | Scrub/goal-seek affordance is pointer-only (div onClick, no keyboard alternative for value adjustment). |
| 13 | F-725 | LOW | `FundedRatioGauge.jsx:265` | 8px text inside SVG gauge — unreadable at any zoom for low-vision users; gauge has no text alternative. |
| 14 | F-726 | LOW | DataCapture.jsx:599,628,805 | Upload/scan affordances as clickable divs — capture flow not keyboard operable. |
| 15 | F-727 | INFO | Escape semantics inconsistent | OverlayShell Escape = back-one; DrillStack stopPropagation in capture phase to beat it (`DrillStack.jsx:81-86`) — works but ordering is fragile; document or centralise. |

## Section 3 — LAUNCH READINESS

**F-728 (HIGH) — index.html has no share/meta layer at all.**
`index.html` (17 lines): title is good ("Sonuswealth — wealth as a measurable, calmable signal") but there is **no meta description, no og:* / twitter:* share cards, no canonical, no theme-color, and no favicon `<link>`**. `public/favicon.svg` exists but is never referenced — browsers request `/favicon.ico` and 404. Any shared link renders bare. Also no `apple-touch-icon`.

**F-729 (HIGH) — Analytics and error tracking are scaffold-only; launch ships blind.**
`src/lib/observability.js:1-30` is an explicit Sentry+PostHog scaffold: "SDKs are NOT in package.json yet… every call is a no-op". `main.jsx:14` calls `initObservability()` but with no SDKs installed and no `VITE_SENTRY_DSN`/`VITE_POSTHOG_KEY` it silently skips. `ErrorBoundary.jsx:129` logs to console only. Net: zero production telemetry, zero crash reporting, zero conversion analytics. Activation path is documented in-file (npm i @sentry/react posthog-js + env vars) — it just hasn't been done. Privacy posture in the scaffold (autocapture disabled, EU host) is well thought out.

**F-730 (MED) — Privacy/Terms exist but are effectively unreachable.**
Content exists (`src/content/legal/privacy.md`, `terms.md`, `cookies.md`) and renders via `Legal.jsx` + `?legal=privacy|terms|cookies` (`App.jsx:529-542`). But the only UI link in the entire app is CookieBanner → cookies policy. Settings "About & legal" (`Settings.jsx:518-528`) contains only Tax Rules + About — **no Privacy or Terms rows**. `Account.jsx:314` says "By continuing you agree to Sonuswealth's Terms of Service" as **plain text, not a link**. A user cannot find the privacy policy without hand-typing a query param — non-starter for GDPR transparency and app-store review.

**F-731 (PASS/INFO) — Brand leak grep is clean in user-renderable strings.**
No "Caelixa"/"Finio" in any JSX copy. Survivors are all technical: CSS keyframe names `caelixaScan/Rise/Draw/Blink` (`index.css:238-246`, RadarChart/RadarAnchor animation refs), `caelixaScore` metric keys inside `src/rules/UK-2026.1.1.json` (never rendered — verified no JSX/js reads it), and `package.json name:"caelixa"` (ALLOWED, locked D-NAME-2). Watch-item: if methodology/provenance surfaces ever dump raw rule metric names, `caelixaScore` would leak.

**F-732 (MED) — No PWA layer.** No `manifest.json`/`manifest.webmanifest` anywhere, no service worker registration (grep clean across src + index.html), no theme-color. A mobile-first financial cockpit that can't be installed to home screen and has no offline shell.

**F-733 (LOW) — Font loading.** Google Fonts CSS is render-blocking; `index.html:10` preconnects to fonts.googleapis.com only — missing `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` for the actual font files. Also an external runtime dependency (consider self-hosting DM Sans for resilience + GDPR).

## Section 4 — MOBILE REALITY

**F-734 (HIGH) — Drill overlays are iOS scroll traps.**
Only ONE overlay locks body scroll: `DrillOverlay.jsx:49-58` (saves/restores `document.body.style.overflow`). The pattern actually used everywhere — `OverlayShell.jsx` (fixed inset:0), `DrillStack.jsx:106-117` (fixed, `overflowY:'auto'` panels), `AssetDetailOverlay.jsx`, `StateTileRow.jsx` — does NOT lock body scroll, and there is **zero `overscroll-behavior` anywhere in src or index.css**. On iOS Safari, when an inner overlay scroll hits its end the scroll chains to the page behind; with stacked L3→L4 panels (zIndex 600+i, lower panels still scrollable DOM) the rubber-band bleed-through is the classic nested-scroll trap. Fix: `overscroll-behavior: contain` on every overlay scroller + the DrillOverlay body-lock applied in OverlayShell.

**F-735 (MED) — safe-area-inset coverage is 4 call-sites, overlays have none.**
`env(safe-area-inset-*)` used only in `Dashboard.jsx:923` (tab bar), `Onboarding.jsx:635`, `PersonaSelect.jsx:255`, `Welcome.jsx:90`. Every full-screen overlay (OverlayShell, DrillStack with `position:sticky top:0` breadcrumb header at `DrillStack.jsx:135-141`) ignores them — with `viewport-fit=cover` set in index.html:8, drill headers render under the notch and bottom CTAs under the home indicator on iPhone. viewport-fit=cover without inset padding is worse than not setting it.

**F-736 (MED) — Fixed column-count grids at ≤480px (inline styles, no responsive fallback possible).**
Worst: `MyMoney.jsx:1555` `repeat(6, 1fr)` → ~55px cells at 375px width; `MyMoney.jsx:1476` + `IFAPractice.jsx:227,544` `repeat(4, 1fr)`; `MagicShowcase.jsx:1129,1511,1671` `repeat(3, 1fr)`; `Risk.jsx:772`, `DecisionEngine.jsx:1583` `repeat(2-3,1fr)` (acceptable). `Cashflow.jsx:6685` `repeat(7,1fr)` is a calendar — legitimate. Inline `style` can't carry media queries, so these never reflow; numbers inside 4-6 col cells at 375px will truncate/overlap.

**F-737 (LOW) — Keyboard overlap on capture forms: untested risk, no mitigation present.**
`AddItemSheet.jsx` (multi-step form) and `DataCapture.jsx` inputs live inside fixed-position overlays; no `visualViewport` listener, no `interactive-widget=resizes-content` in the viewport meta, no scroll-into-view on focus. No fixed-bottom input bars found (good — Ask uses sheet architecture), so severity is LOW, but on-device iOS verification is required before launch (grep cannot prove this one either way).

**F-738 (PASS) — Viewport meta is correct.** `index.html:8`: `width=device-width, initial-scale=1.0, viewport-fit=cover`; `maximum-scale`/`user-scalable=no` were deliberately removed (P12-3, WCAG 1.4.4). Pinch-zoom works.

---

## SUMMARY

| Severity | Count | IDs |
|---|---|---|
| HIGH | 10 | F-700, F-701, F-703, F-704, F-713, F-714, F-715, F-728, F-729, F-734 |
| MED | 13 | F-702, F-705, F-706, F-707, F-716, F-717, F-718, F-719, F-720, F-730, F-732, F-735, F-736 |
| LOW | 12 | F-708–F-711, F-721–F-726, F-733, F-737 |
| INFO/PASS | 4 | F-712, F-727, F-731, F-738 |

**3 worst:** F-700 (zero code-splitting — ~940 kB gzip JS on first paint, vite.config's "lazy" comment is false), F-729 (no live analytics or error tracking — launch ships blind, scaffold never activated), F-734 (every drill overlay is an iOS nested-scroll trap — no body lock, no overscroll-behavior anywhere).

**Status:** COMPLETE — all 4 sections. Scan script retained at `audit-findings/_w1g_a11y_scan.cjs` for reproducibility. No dev server was started.
