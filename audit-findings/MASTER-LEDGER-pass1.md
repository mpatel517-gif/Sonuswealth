# Sonuswealth — Master Audit Ledger (All 10 Screens, Pass-1)
**Date:** 2026-05-18
**Stage:** B pass-1 complete across all 10 primary surfaces
**Next step:** Wave 4 — fix severity-first (all DEMO-BLOCKING before any FUNCTIONAL)

---

## DEMO-BLOCKING tally by screen

| Screen | DB count | Worst finding |
|--------|----------|---------------|
| Cashflow | ~14 | Silent mock fallback — 4 chart components show fabricated authoritative data when engine null |
| Decision Engine | 13 | Brand filter gap; Ask bypass; commit broken; VITE key exposed to user |
| MyMoney | 12 | All 4 balance-sheet tiles dead; Priority cards describe-only; FCA advice copy |
| Risk | 12 | Overlay drops all props (entire overlay dead); score labelled "Health score"; lifeEventPaths stub returns [] |
| Tax & Estate | 8 | £1.5m BPR factual error; InheritanceStory CTA dead; zero year-by-year IHT projections |
| Timeline | 8 | All calendar rows static div (zero drillable); goal-create route missing; GoalSeek handles 4/12 metrics |
| Settings | 8 | Account.jsx invents own score formula (never calls calcFQ()); 3× "FQ" legacy strings |
| Reports | 2 | FCA disclaimer completely absent (no BRAND import) |
| Data Capture | 1 | Raw internal codes (BOND_ON, EIS, VCT) as user-facing wrapper options |
| Home | 1 | pension-drawdown routes to 'tax' instead of 'money' in ACTION_ROUTE_OVERRIDE |
| **TOTAL** | **~79** | |

---

## Cross-cutting themes (fix families, not one-by-one)

### Theme A — Hardcoded tax constants (affects MyMoney, Cashflow, Risk, Tax & Estate)
Every place `60000`, `10000`, `268275`, `1073100` appear as JSX literals must be replaced with `TAX.pensionAA`, `TAX.mpaa`, `TAX.lsa`, `TAX.lsdba`. One Morph sweep across `src/`.

### Theme B — Silent mock / fabricated data fallbacks (Cashflow, MyMoney)
Cashflow: PoSChart, SequenceStressVis, EfficientFrontier, ScenarioMatrix all render synthetic data when engine is null. MyMoney: `CAT_MONTHLY_DRIFT` constants produce identical sparklines. Pattern: replace `data || mockData` with `data ?? <EmptyState />`.

### Theme C — FD-NAME-1 violations (Settings, Decision Engine)
Settings: `Account.jsx` uses "FQ", "Financial Quotient", never calls `calcFQ()`. Decision Engine: `fca-rewrite.js` only filters consequence text — brand drift can appear in statement/option names. Fix: sweep Account.jsx for FQ strings; extend `fcaRewriteTree()` to full tree.

### Theme D — FCA advice framing (MyMoney, Risk, Tax & Estate)
MyMoney Priority card bodies: "Max pension contributions — Highest-return action available." Risk: shock cards show £ figures + prescriptive mitigations with no "estimate · not advice" inline. Tax & Estate CoI odometer implies single path. Pattern: reframe directives as "options include" + add inline FCA chip.

### Theme E — FD-CROSS-1 violations — dead handoffs (MyMoney, Risk, Timeline, Decision Engine, Home)
- MyMoney CoI rows: `<div>` no onClick → should route to `PensionDrillDown`
- Risk shock cards: dead-end at description → need per-shock owning-surface button
- Risk mitigation rows: zero onClick → need per-mitigation owning-surface button
- Timeline calendar rows: all static `<div>` → need per-entry onNav routing
- Decision Engine: Ask `intent='act'` never opens DE tree → fix one handler
- Home: `ACTION_ROUTE_OVERRIDE['pension-drawdown']` = `'tax'` → change to `'money'`

### Theme F — CoI inconsistency (MyMoney, Home, Timeline, Tax & Estate, Cashflow)
Multiple inconsistencies:
- Timeline `costOfInaction(entity)` vs Home `costOfInaction(entity, 'sipp_iht')` — same row, two values
- Tax & Estate + Cashflow: show `byDomain.estatePlanning` slice only
- CoI domain coverage: engine aggregates 12+ domains but `COI_DOMAIN_META` only has 10 keys
- MyMoney CoI sort uses regex extraction vs Home's numeric `totalCoI().byDomain`
Fix: standardise all CoI displays to `totalCoI(entity, bundle)` aggregate; fix domain coverage.

### Theme G — Engine-level bugs (affects multiple screens)
- `varianceFor()` only handles `mode2 === 'plan'`; forecast/scenario modes return 0 → VarianceBadge dead on every screen using X28 mode (`fq-calculator.js:1659`)
- `lifeEventPaths` returns `[]` for all personas → Risk Z7 banner permanently absent (`fq-calculator.js:1812–1815`)
- `surplus > 0` instead of `>= 0` → `−£0` display when balanced (`MyMoney.jsx:1136`)
- CoI aggregates 9 domains not 12 → systematic under-reporting (`fq-calculator.js:1984`)

---

## Fix queue — severity-first order

### Batch 1: Engine fixes (unblocks multiple screens simultaneously)
| Fix | Screens unblocked | File |
|-----|------------------|------|
| Fix `varianceFor()` for forecast/scenario modes | MyMoney, Decision Engine | fq-calculator.js:1659 |
| Fix CoI to aggregate 12 domains (add propertyDecisions) | All screens showing CoI | fq-calculator.js:1984 |
| Fix `surplus >= 0` signed-zero | MyMoney | MyMoney.jsx:1136 |
| Fix `lifeEventPaths` stub | Risk | fq-calculator.js:1812–1815 |

### Batch 2: One-line / near-one-line fixes (high impact, low effort)
| Fix | Screen | File:line |
|-----|--------|-----------|
| `ACTION_ROUTE_OVERRIDE['pension-drawdown']` → `'money'` | Home | HomeScreen.jsx:117 |
| Add `BRAND.disclaimer` + BRAND import to Reports | Reports | Reports.jsx |
| Fix `BOND_ON`/`EIS`/`VCT` → labelled objects in WRAPPERS | Data Capture | DataCapture.jsx:737 |
| `<span>` → `<button onClick={() => setDrillPension(true)}>` (drawdown CTA) | MyMoney | MyMoney.jsx:2393 |
| `RiskOverlay.jsx:157` — thread all 4 missing props to `<RiskBody>` | Risk | RiskOverlay.jsx:157 |
| Replace LSA `268275` with `TAX.lsa` in Math.min() | MyMoney | MyMoney.jsx:2003,2005 |
| Fix BPR "£1m" → `fmt(TAX_JSON.inheritanceTax.aprBprCombinedAllowance)` | Tax & Estate | TaxEstate.jsx:1482 |
| Add `onDrillMetric` prop to InheritanceStory | Tax & Estate | TaxEstate.jsx:2438 |
| Remove "VITE_ANTHROPIC_API_KEY not set" user-facing error | Decision Engine | DE source |
| Add `Dashboard.jsx` `sonus:navigate` listener + plan→timeline migration | Risk | Dashboard.jsx |
| Extend `fcaRewriteTree()` to full tree (statement, option names, rationale) | Decision Engine | tree-generator.js |
| Wire Ask `intent='act'` → `setDecisionEngine` | Decision Engine | Ask.jsx |

### Batch 3: Structural fixes (require more work)
| Fix | Screen | Notes |
|-----|--------|-------|
| Extend `onView` switch for cash/income/alternatives/obligations | MyMoney | MyMoney.jsx:3187 |
| Priority cards: replace string expansion with real routing | MyMoney | MyMoney.jsx:2354 |
| Wire CoI rows onClick → PensionDrillDown | MyMoney | MyMoney.jsx:2891–2908 |
| Remove mock fallback from 4 Cashflow chart components | Cashflow | PoSChart, SequenceStressVis, EfficientFrontier, ScenarioMatrix |
| Remove internal spec codes from Cashflow UI (`O-CF-RULES-07` etc.) | Cashflow | Cashflow.jsx:938,2314 |
| Wire all calendar rows with per-entry onNav routing | Timeline | Timeline.jsx CalendarEntryRow |
| Fix goal-create route or redirect to openGoalSeek() | Timeline | Dashboard.jsx:471–505 |
| Risk: `onAddProtection` prop threading | Risk | Risk.jsx:1633–1638 |
| Risk shock cards: add FCA chip + owning-surface handoff button | Risk | Risk.jsx:891–898 |
| Risk mitigation rows: add onClick per-row | Risk | Risk.jsx:1063–1084 |
| Account.jsx: replace FQ strings + remove local formula, use calcFQ() | Settings | Account.jsx |
| Morph sweep: replace all hardcoded TAX constants with TAX.* | All | src/ codebase-wide |
| Standardise all CoI displays to totalCoI() aggregate | All | Multiple files |

### Batch 4: FCA framing fixes
| Fix | Screen | Notes |
|-----|--------|-------|
| Reframe Priority card directive copy to options framing | MyMoney | MyMoney.jsx:2263,2271–2272 |
| Add "est · not advice" inline chip to Risk shock cards | Risk | Risk.jsx:858–901 |
| Add "est · not advice" inline chip to Risk mitigation rows | Risk | Risk.jsx:1055–1093 |
| Soften cliff-edge copy with adviser caveat | MyMoney | MyMoney.jsx:996–997 |

---

## Passing verdicts worth noting

- **Home**: No Caelixa/Finio anywhere. What-If shows 12 scenarios (FD-1 satisfied). PensionDrawdownPanel is a real ACTION surface.
- **Tax & Estate**: SIPP IHT correctly shows ENACTED (Finance Act 2026, Royal Assent 18 March 2026). No "PROPOSED" anywhere. All 7 NRB/RNRB/IHT rate figures correct.
- **Data Capture**: No FD-NAME-1 violations in user-facing strings. Mock gate (`mockBlockedForRealUser`) works correctly.
- **Reports**: No Caelixa/Finio in current stub. Phase-2 brand-leak gate needed before PDF renderer ships.
- **Risk**: All 7 risk dimensions present. Max scores sum to 100. Radar uses `bandColour` from engine. D7 zero-guard present.

---

## DECISION-NEEDED for founder (cross-screen)

| # | Question | Screens |
|---|----------|---------|
| DN-01 | Founder-IP: DER, PRC/PCC, EBR have live engine formulas. Ship as-is or hold for sign-off? | MyMoney |
| DN-02 | DrawdownMatrixPanel — Wave 7+ feature or delete dead code? | MyMoney |
| DN-03 | Synthetic sparklines — label "estimated" and keep, or remove until real history available? | MyMoney |
| DN-04 | PivotView components (Income/CF/Insurance/Bonds) — need their own pass-1b audit? ~30 inventory rows not traced. | MyMoney |
| DN-05 | SippIhtCountdown on Home — add to inventory v2 or Wave 7? | Home |
| DN-06 | StateTilesCard on Home — add to inventory or flag vs FD-3 frozen layout? | Home |
| DN-07 | RP-NW-10: Does Net Worth report require BRAND.disclaimer? FD-RP-3 marks it "borderline." | Reports |
| DN-08 | Risk Z7 life-event banner — fix `lifeEventPaths` stub now or defer to Wave 7? | Risk |

---

## Next: Wave 4 — fix severity-first

**Rule:** fix every DEMO-BLOCKING across every screen before touching any FUNCTIONAL.
**Order:** Batch 1 (engine) → Batch 2 (one-liners) → Batch 3 (structural) → Batch 4 (FCA framing).
**After each batch:** run `npm run test` + interaction smoke. A fix that breaks a green test is reverted.
