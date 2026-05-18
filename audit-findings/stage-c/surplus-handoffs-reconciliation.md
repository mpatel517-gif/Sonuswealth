# Stage C — Surplus + Handoffs Reconciliation
**Date:** 2026-05-18

---

## Valid tab IDs (from Dashboard.jsx)

Defined in `TABS` array (lines 41–46) and validated in `readTabParam()` (line 146):

| ID | Label |
|----|-------|
| `home` | Overview |
| `money` | My Money |
| `flow` | Cashflow |
| `tax` | Tax |
| `risk` | Risk |
| `timeline` | Timeline |

Special: `'de'` is intercepted by `handleHomeNav` (line 180) before reaching `setTabSafe` — opens Decision Engine overlay, not a tab switch. `'ask'` is NOT a valid tab ID (Ask is a floating pill, D-ASK-1). Legacy `'plan'` shims to `'timeline'` (FIX-10).

---

## Surplus consistency

| Surface | Function used | Display format | Sign convention |
|---------|---------------|----------------|-----------------|
| **HomeScreen** | `cashflowHealth(entity).surplus` (indirect — `cashflowHealth` calls `monthlySurplus` internally, line 2242 of fq-calculator.js) | `+£X` or `£X` via `fmt(Math.abs(cf.surplus))` with `+` prefix when positive; `—` when zero (line 798) | Positive = surplus |
| **MyMoney** | `monthlySurplus(entity)` directly (lines 1136, 2660); also inline deficit check line 2554 | `fmt(surplus)/month` in urgentSignal strings (line 2696); `fmt(Math.abs(surplus))` for deficit signal (line 2693) | `m.surplus \|\| -(m.deficit \|\| 0)` — signed: positive = surplus, negative = deficit |
| **Cashflow** | `monthlySurplus(entity, CMA_BUNDLE)` (line 145, 568) — passes `CMA_BUNDLE` context arg | `{surplusMo >= 0 ? '' : '−'}{fmt(Math.abs(surplusMo))}/mo` (line 225); also annualised `fmt(surplusAnn)/yr` | Separate surplus/deficit fields from engine; display uses manual sign prefix |

**Consistency notes:**
- All three ultimately derive from `monthlySurplus()` in `fq-calculator.js`.
- HomeScreen uses the intermediate `cashflowHealth().surplus` field (a score-component sub-field, not the raw £/mo value). This is the surplus *score* (0–100 scaled) only used for the state tile label/state — the £ value shown on the tile (line 798) uses `cf.surplus` which IS the raw monthly surplus passed through from `cashflowHealth`.
- Cashflow passes `CMA_BUNDLE` as second arg to `monthlySurplus`; MyMoney and HomeScreen (via `cashflowHealth`) do not. If `CMA_BUNDLE` overrides any income/spending fields, the Cashflow figure could diverge from the other two surfaces.
- Sign convention is consistent across all three: positive = surplus, negative = deficit.
- Display format inconsistency: HomeScreen shows `+£X` (with plus prefix for positive), MyMoney shows `£X/month` in text strings, Cashflow shows `£X/mo` with manual `−` prefix. Minor but cosmetic.

---

## Handoff route audit

| From | To | Route used | Valid? |
|------|----|------------|--------|
| Home → Tax (SIPP IHT countdown) | Tax | `onNav?.('tax')` (line 441) | ✅ |
| Home → Timeline (PlanProgressStrip) | Timeline | `onNav?.('timeline')` (line 656) | ✅ |
| Home → various (StateTilesCard) | money / risk / flow / tax | `onNav?.(tile.route)` — values: `'money'`, `'risk'`, `'flow'`, `'tax'` (lines 783–810) | ✅ |
| Home → various (DimExplainerStub) | money / tax / risk / flow | `onNav(route)` from DIM_EXPLAINER map — values: `'money'`, `'tax'`, `'risk'`, `'flow'` (lines 849–855) | ✅ |
| Home → tax/money (CoIDrillPanel) | tax / money | `onNav?.(row.screen)` — values: `'tax'`, `'money'` (lines 934–942) | ✅ |
| Home → money (APQDrillPanel pension-drawdown) | money | `onNav?.('money')` (line 1106) | ✅ |
| MyMoney → Tax (PriorityCards estate row) | Tax | `onNav?.('tax')` (line 2307) | ✅ |
| MyMoney → Cashflow (PriorityCards tax row) | Cashflow | `onNav?.('cashflow')` (line 2315) | ❌ **BUG** — `'cashflow'` is not a valid tab ID; valid ID is `'flow'` |
| MyMoney → Cashflow (obligations row) | Cashflow | `onNav?.('cashflow')` (lines 2867, 3182) | ❌ **BUG** — same issue, two call sites |
| MyMoney → Timeline (plan review) | Timeline | `onNav('timeline', ...)` (line 2621) | ✅ |
| MyMoney → Tax sub-routes | Tax | `onNav?.('tax', { sub: 'ani' \| 'director-extraction' \| 's24' })` (lines 3226–3228) | ✅ (tab ID valid; sub-routing depends on TaxEstate consuming payload) |
| MyMoney → Ask | Ask (floating pill) | `onNav?.('ask', { prefill: q })` (line 3229, called at lines 3257, 3264) | ❌ **BUG** — `'ask'` is not a tab ID; Ask is a floating pill (D-ASK-1). `setTabSafe('ask')` will silently no-op (not in valid list) or navigate nowhere |
| Risk → MyMoney (mitigationRoute) | money | `onNav?.('money')` (line 1070) | ✅ |
| Risk → Tax (mitigationRoute) | Tax | `onNav?.('tax')` (line 1073) | ✅ |
| Risk → Cashflow (mitigationRoute) | Cashflow | `onNav?.('flow')` (line 1076) | ✅ |
| Risk (ShockCard handoff) | dynamic | `onNav?.(handoff.nav)` (line 875) | ⚠️ depends on `handoff.nav` data values — not audited here |
| Risk → (no onNav prop wired in Dashboard) | — | Dashboard line 504: `<Risk ... />` — no `onNav` prop passed | ❌ **BUG** — Risk's `onNav` is always `undefined`; all `mitigationRoute` and `ShockCard` nav calls silently no-op |
| Timeline → Tax (sa-deadline, trust-gift) | Tax | `onNav('tax')` (line 809) | ✅ |
| Timeline → MyMoney (isa-reset, nominations, mortgage-fix) | money | `onNav('money')` (line 813) | ✅ |
| Timeline → Cashflow (state-pension) | Cashflow | `onNav('flow')` (line 815) | ✅ |
| Timeline → Risk | Risk | `onNav?.('risk', { source: 'timeline-anchor' })` (line 2396) | ✅ |
| Timeline → dynamic (default calendar entries) | various | `onNav(e.navTarget \|\| 'money')` (line 818) | ⚠️ depends on `navTarget` field values in data |
| TaxEstate → (no onNav prop) | — | No `onNav` prop defined or passed to TaxEstate | ℹ️ TaxEstate has no outbound nav (spec: owns its angle) |
| Dashboard → Home (handleHomeNav) | home/de | intercepts `'de'` → Decision Engine overlay; else `setTabSafe(id)` | ✅ |

---

## Inconsistencies found

### BUG-1 (HIGH) — Risk screen receives no `onNav` prop from Dashboard
- **File:** `Dashboard.jsx` line 504
- **Code:** `<Risk entity={entity} onHome={goHome} onDrillMetric={pushDetail} onCommit={handleCommit} />`
- `onNav` is missing. Every mitigation route and ShockCard handoff in Risk silently no-ops.
- **Fix:** Add `onNav={setTabSafe}` to the Risk render call.

### BUG-2 (HIGH) — MyMoney uses `'cashflow'` instead of `'flow'` (3 call sites)
- **File:** `MyMoney.jsx` lines 2315, 2867, 3182
- `'cashflow'` is not in the valid tab ID set. `setTabSafe('cashflow')` will silently do nothing (the whitelist check at Dashboard line 146 returns null; `setTab` reverts to current tab or home).
- **Fix:** Replace all three occurrences of `'cashflow'` with `'flow'`.

### BUG-3 (MEDIUM) — MyMoney routes to `'ask'` which is not a tab (2 call sites)
- **File:** `MyMoney.jsx` line 3229, triggered at lines 3257 and 3264
- `goAsk(q)` calls `onNav?.('ask', { prefill: q })`. Ask is a floating pill (D-ASK-1), not a tab. `setTabSafe('ask')` will silently no-op.
- **Fix:** Either (a) wire Ask via a dedicated `onAskAI` prop (already exists on HomeScreen, pattern in Dashboard line 477), or (b) add `'de'`-style interception in `handleHomeNav` / `setTabSafe` for `'ask'` that opens the Ask sheet.

### NOTE — Cashflow uses `CMA_BUNDLE` arg, others do not
- Not necessarily a bug — `CMA_BUNDLE` may be `undefined` or an empty object that changes nothing. But if it overrides income/spending, the surplus figure on Cashflow could differ from MyMoney and HomeScreen for the same entity. Needs separate validation.

---

## Verdict

**NEEDS-WORK**

Three bugs before this gate passes:
1. `Risk` has no `onNav` prop wired → all mitigation nav is dead.
2. `MyMoney` uses `'cashflow'` (×3) instead of valid `'flow'` → cashflow navigation dead in three places.
3. `MyMoney` routes to `'ask'` (×2) which is not a tab → Ask prefill from BTL/BPR action cards silently fails.

Surplus engine source is consistent (all three screens derive from `monthlySurplus()`). Sign convention is consistent. Display formatting has minor cosmetic differences (`+£X` vs `£X/mo`) but is not a data integrity issue.
