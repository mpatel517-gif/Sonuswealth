# finio src/ — 21 April 2026 drop
## Complete replacement for C:\Users\Mihir Patel.Mihir\Desktop\finio\src\

## Install

1. Back up your current src/ folder (timestamped zip — per your backup protocol).
2. Delete contents of C:\Users\Mihir Patel.Mihir\Desktop\finio\src\
3. Copy contents of this src/ folder into place.
4. `npm run dev` → test on localhost:5173 before deploying.

## What's new

**Drop 1 — Foundation** (new files + edits)
- `config/dimensions.js` — single source of truth for 7 dimensions; `narrativeFor(entity, key)` resolves per-persona risk/action/future strings from JSON.
- `components/shared/TripleAnchor.jsx` — shared triple-anchor component. Net worth + Finio Score + Risk Score, equal weight, identical rendering everywhere.
- `index.css` — added 6 font-size CSS variables: `--fs-hero-lg`, `--fs-hero`, `--fs-title`, `--fs-body`, `--fs-small`, `--fs-label`.
- `rules/personas/*.json` — all 7 personas gained `dimensionNarrative` block (7 dims × 3 strings each). Anna Finch: 6 snapshots × 7 dims × 3 strings = 126 strings.

**Drop 2/3 — Screens + Settings**
- `screens/Settings.jsx` — NEW. 12 sections, Telegram-style. Theme toggle wired. Hide-balances toggle. 6 detail panels. Phase-2 sections show honest "Coming in Phase 2" state — no faked functionality (FP-4 + FP-5 compliant).
- `screens/Dashboard.jsx` — radar is now default home screen. Bars view reachable at `?bars` URL param for founder reference. Gear icon added to top bar; opens Settings overlay.
- `screens/HomeScreenJit.jsx` — full rewrite. Uses shared dimensions + TripleAnchor. Zero-spike dot collapse fixed (MIN_FRAC 0.06 → 0.25). Card position uses SVG ref + getBoundingClientRect (replaces -180px hack). NWTraj series labels derived from guardrail(entity) + TAX.brl. Score-journey narrative from fqTrajectory output. Disclaimer uses BRAND.rulesLabel + entity.rulesVersion.
- `screens/HomeScreen.jsx` — TwinAnchor → TripleAnchor. Shared DIMENSIONS + narrativeFor. NWTraj labels dynamic. Dead TwinAnchor function removed.
- `screens/FQBreakdown.jsx` — shared DIMENSIONS + narrativeFor. Bruce-specific action amounts replaced with generic actions. Persona-specific examples removed from the UI layer (belong in persona JSON if ever restored).
- `components/Dashboard/SimulatorPanel.jsx` — DIM_ACTIONS de-Bruced. No more "£37,700/yr" / "£20k ISA" in generic simulator text.
- `screens/Welcome, PersonaSelect, Account, Onboarding, Ask, Plan, MyMoney, TaxEstate, Risk` — font-pass only. Sub-14 fonts raised to tokens.
- `App.jsx` — passes `onThemeChange={setTheme}` to Dashboard so Settings theme pill works.

## Known residual

- `Ask.jsx` contains Bruce-specific text in canned chat transcripts. Future work: per-persona chat content.
- `TaxEstate.jsx` reference to £37,700 is the UK basic-rate band — a tax fact, not a persona number. Correct as-is.
- Sub-floor fonts in final audit: 0 outside of comments/backup files.

## Testing checklist

- [ ] Radar home opens for all 7 personas without card misposition
- [ ] Zero-scoring dims still render as visible dots (not collapsed to centre)
- [ ] Tap each dim on radar — card appears directly beneath that dot
- [ ] Top-bar gear icon opens Settings
- [ ] Settings > Appearance > Theme pill switches dark/light live
- [ ] Settings > Hide balances toggle works
- [ ] Back button / Esc closes Settings
- [ ] Swap persona to Hermione / Anna / Priya — radar card copy reflects that persona
- [ ] `?bars` URL shows bars-view home (TripleAnchor at top)

