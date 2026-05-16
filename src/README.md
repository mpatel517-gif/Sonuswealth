# Finio — Bruce Story Session 1 drop (22 April 2026)

Replace the `src/` folder in your project with the contents of this archive.

## What changed

### New files
- `state/events.jsx` — React context event store (FP-5 commit-path stub)
- `components/shared/OverlayShell.jsx` — unified overlay chrome (← Back top-left, optional Home pill, Escape key)

### Modified files
- `engine/fq-calculator.js` — multi-phase drawdown support (`sippProjection` + `ihtDynamic` accept scalar OR schedule array, backwards-compatible); new exports: `sippProjectionSeries`, `drawdownTotal`, `nominationStatus`, `hasStaleNomination`
- `App.jsx` — wrapped in `EventsProvider`, effective entity via hook
- `components/Dashboard/SimulatorPanel.jsx` — scroll-into-view on open, Ask-AI wired, commit button, no hard drawdown cap + guardrail×2 warning
- `screens/Dashboard.jsx` — threads persona + commit + AskAI callbacks; OverlayShell for FQBreakdown; `initialTab='actions'` when activeDim set
- `screens/HomeScreenJit.jsx` — SimulatorPanel fully wired with onCommit + onAskAI; "Full breakdown →" delegates to Dashboard (no more duplicate FQBreakdown render)
- `screens/MyMoney.jsx` — complete rewrite with PensionDrillDown overlay: multi-phase schedule editor, nomination review with stale flags, commit path
- `screens/TaxEstate.jsx` — removed duplicate TAX constant, imported from engine; drawdown cap now full-SIPP with guardrail×2 warning
- `screens/FQBreakdown.jsx` — new `embedded` prop (suppresses internal header when wrapped in OverlayShell)
- `screens/Settings.jsx` — migrated to OverlayShell
- `screens/Ask.jsx` — accepts `context` + `onClearContext` props (D05 entry-prompt wiring)

## Defects fixed
- **D01** — Multi-phase drawdown engine + schedule UI (FP-3 breach that drove §3A.8)
- **D02** — Drawdown cap rule (no hard cap, warning at guardrail×2)
- **D03** — Dim-card simulator scrolls into view on open
- **D04** — "Full breakdown →" opens at 'actions' tab when dim is active
- **D05** — "Ask AI about [dim]" now navigates to Ask tab with dim context
- **D06** — Commit path: simulator + pension schedule → event store → entity state
- **D07** — MyMoney pension drill-down panel (was: dead-end LineItemSheet)
- **D08** — Unified overlay chrome (OverlayShell)
- **D09** — Duplicate TAX constant removed from TaxEstate
- **D14** — Stale-nomination flag surfaced in MyMoney (Bruce's Aviva 6.9y old)

## Deferred to Session 2
D10, D11, D12, D13, D15, D16, D17, D18 — see handover doc in the project folder.

## Bruce's story end-to-end test path
1. PersonaSelect → pick Bruce Wayne
2. Home (radar) — triple anchor + radar + Cost of Inaction strip visible
3. Tap Estate dim dot → dim card appears with Bruce's narrative
4. Tap card → SimulatorPanel opens **and scrolls into view**
5. Move drawdown slider → see FQ delta, NW impact, IHT change
6. Tap **Commit changes** → event fires, home updates, Estate dim greener
7. Navigate to **My Money** via bottom nav
8. Tap **Pension** category row → PensionDrillDown overlay opens (← Back top-left, Home pill top-right)
9. Review the 3 schemes — **Aviva flagged as "Stale (6.9y)"** in orange
10. Tap **Mark reviewed** on Aviva row → event fires, Aviva now green
11. Pick a preset ("Basic-rate £37,700/yr") or edit the schedule row-by-row
12. Add a one-off year (e.g. Age 65: £200,000, reason: "Wedding")
13. See SIPP projection chart update; IHT saved vs no action metric
14. Tap **Commit schedule** → schedule written to event store, drill-down closes
15. Back in MyMoney → Income > Drawdown row now reflects year-1 amount
16. Back to Home → Estate dim score higher, Cost of Inaction lower

## How to test
```
# In project root
cp -r /path/to/src/* ./src/
npm run dev
# Open http://localhost:5173
```

For production:
```
git add .
git commit -m "Bruce Story Session 1: multi-phase drawdown + pension drill-down + event store + OverlayShell"
git push
```
