# Wave 0 — Verification audit (W0-T9 + T15)

**Audit date:** 2026-05-25
**Branch:** mymoney-l3-rebuild
**Final commit before audit:** 559fa6e — `refactor(MyMoney): migrate top-level from direct fq-calc to useRipple (Wave 0 F4 / T8)`

---

## What was verified

### 1. Static structural integrity
All 5 separate drilldown files (`PropertyDrillDown`, `BusinessDrillDown`, `ProtectionDrillDown`, `LiabilitiesDrillDown`, `InvestmentsDrillDown`) confirmed unchanged at commit 559fa6e. `git log --stat 559fa6e` shows T8 touched only:
- `src/screens/MyMoney.jsx` (+41/-9 lines)
- `docs/superpowers/plans/wave0-post-migration-snap.json` (+255 new)

Zero collateral changes on drilldown files. PensionDrillDown remains inline within `MyMoney.jsx`; its sub-component-scope direct imports (`ihtDynamic`, `investable`, `guardrail`) are honestly noted in the W0-T1 inventory as un-migratable via top-level `useRipple`.

### 2. No fq-calc leakage in drilldown files
`grep "from.*fq-calculator" src/components/MyMoney/{Property,Business,Protection,Liabilities,Investments}DrillDown.jsx`: zero matches. Drilldowns receive entity-derived data via props from the parent `MyMoney` component.

Four non-drilldown helpers under `src/components/MyMoney/` retain direct fq-calc imports by design (out of F4 scope):
- `WhatIfLibrary.jsx`, `TileGrid.jsx`, `StateTileRow.jsx`, `PivotView.jsx`

### 3. Vite build
```
vite v8.0.8 building client environment for production...
✓ 216 modules transformed.
✓ built in 414ms
```
Clean. One pre-existing chunk-size warning (unrelated to F4 — present before Wave 0).

### 4. Per-persona engine snapshot (7 personas)
All personas load and `rippleEffect()` computes without throwing. No NaN, no Infinity in `scores` or `balance_sheet` subtrees.

```
mrT-core:   NW=726890   FQ=70   Risk=74  Surplus=0
persona-a:  NW=3900000  FQ=69   Risk=71  Surplus=0
persona-b:  NW=1535000  FQ=43   Risk=63  Surplus=0
persona-c:  NW=11175000 FQ=76   Risk=80  Surplus=2500
persona-d:  NW=51600    FQ=49   Risk=47  Surplus=1820
persona-e:  NW=6260000  FQ=100  Risk=82  Surplus=833
persona-g:  NW=366000   FQ=53   Risk=27  Surplus=0
```

Mr T = 727k NW · 70 FQ · 74 Risk — matches T2 baseline target.

### 5. Test-suite regression
- `tests/ripple-contract.mjs`: **103/103 pass · 0 fail**
- `tests/engine/time-series.test.mjs`: **29/29 pass · 0 fail**
- `tests/components/L3Panel.smoke.test.mjs`: **53/53 pass · 0 fail**

Matches T7 baseline exactly.

### 6. Mr T snapshot diff
- baseline: `docs/superpowers/plans/wave0-baseline-snap.json` (W0-T2)
- post-migration: `docs/superpowers/plans/wave0-post-migration-snap.json` (W0-T8)
- diff after stripping `computed_at` / `computedAt` / `elapsedMs` / `timestamp`: **CLEAN** (byte-identical)

---

## Conclusion

Wave 0 ships clean. F4 migration is honestly behaviour-neutral as required by the task contract. Ready for W0-T16 founder approval gate.

## What the founder should check at the approval gate

1. Run `npm run dev` and visit `http://localhost:5174/?demo=mrt&tab=money`
2. Verify the Triple anchor renders: **£727k NW · 70 Wealth · 74 Risk**
3. Click each L1 tile (Pension, Property, Business, Protection, Liabilities, Investments) — each drilldown should open
4. Console: zero errors
5. URL-flag through the other 6 personas (`?demo=a` .. `?demo=g`) — all should load without error
6. If satisfied: approve → proceed to **Wave 1** (Investing wrappers split + Cash L3)

## Reproducibility

Re-run any check via:
- Per-persona snapshot: `node scripts/wave0-verify-personas.mjs`
- Mr T snapshot diff: `node scripts/wave0-snap-diff.mjs`
- Regression suite: `node tests/ripple-contract.mjs && node tests/engine/time-series.test.mjs && node tests/components/L3Panel.smoke.test.mjs`
- Build: `npx vite build`
