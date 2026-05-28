# MyMoney Static Code Audit — 2026-05-25

Scope: `src/screens/MyMoney.jsx` (3502 lines) + `src/components/MyMoney/{Investments,Property,Business,Protection,Liabilities}DrillDown.jsx` + `BalanceSheet.jsx` + `CategoryTile.jsx` + `TileGrid.jsx` + `DrillContextStub.jsx`. Routing checked against `src/screens/Dashboard.jsx` + `src/engine/driver-engine.js`.

Format: `[SEVERITY] file:line — what's wrong — one-line fix`

---

## CRITICAL

**[CRITICAL] `src/components/MyMoney/TileGrid.jsx:505-538` — "What moved your net worth this month" bars are visually invisible.**
`maxVal = Math.max(...bars.map(b => Math.abs(b.value) + (b.isBase ? 0 : prev)))` — but only base bars (Opening/Closing) actually use that scale; delta bars divide their absolute value by the SAME maxVal that is dominated by the opening NW (e.g. £3.9m). Result: a £1k–£4k movement renders as `(1000 / 3_900_000) * 100 = 0.025%` of bar width — sub-pixel. The legend reads correctly but the chart shows nothing. Fix: compute `maxDelta = Math.max(...attrBars.map(b => Math.abs(b.value)))` and scale delta bars off `maxDelta`, render base bars on a separate row OR use a log/signed-area scale.

**[CRITICAL] `src/components/MyMoney/DrillContextStub.jsx:77-95` — "Ask Sonu about this" inside every drill panel does a hard navigation to `/ask?q=...`.**
It is a plain `<a href={askHref}>` with `askHref = '/ask?q=<encoded>'`. The app uses a tab-state router (`Dashboard.setTab`), not URL routing. Clicking the chip inside PensionDrillDown / InvestmentsDrillDown / PropertyDrillDown / BusinessDrillDown / ProtectionDrillDown fires a real browser navigation to `/ask?...` — which the SPA doesn't serve, so it either 404s on a real server, or in the Vite dev server falls back to `index.html` with `tab='home'`, dropping all drill state. This is the most plausible root cause of bug #1 ("ends up on the same screen as CoI"): both the CoI drill-tap on Home (`pushDetail('coi')`) and the Ask-Sonu chip leave the user looking at the Home tab (or the Ask screen rendered identically) because both side-effects route through the same fallback. Fix: replace `<a href>` with `<button onClick={() => window.dispatchEvent(new CustomEvent('sonus:ask', { detail: { question: askQuestion } }))}>` — the pattern already used by MyMoney's Director Intelligence cards (MyMoney.jsx:3265).

**[CRITICAL] `src/screens/MyMoney.jsx:2480-2482 + 3471-3499` — Pension drill and per-category drills can stack/overlap.**
`drillPension` (bool) and `drillCat` (string) are independent state. If user is in PensionDrillDown and a CoI row routes via `setDrillCat('investments')` (line 2898 — `else if (r.id === 'investments' || r.id === 'cash' || r.id === 'alternatives')`), BOTH panels render simultaneously as fixed overlays. Whichever has the higher z-index wins visually, but state from the first is preserved and not closed. Fix: collapse to a single `[activeDrill, setActiveDrill]` with values `'pension' | 'investments' | 'property' | 'business' | 'protection' | 'liabilities' | null`, and set to null in every entry-point handler.

**[CRITICAL] `src/engine/driver-engine.js:59` — Any unknown metric returns identical "Driver tree pending" terminal frame.**
`default: return terminal(metric, 0, 'Driver tree pending')`. Combined with bug #1's fallback path, every drill that calls `onDrillMetric('pensionDetail')` or similar lands on the SAME placeholder DetailOverlay (CoI included only if metric is literally 'coi'). Fix: explicitly route pension subdrills to `'pension:scheme'`, `'pension:nominations'`, etc., and add cases. At minimum, make the terminal frame include `metric` prominently in the title so the user sees WHICH drill failed.

---

## HIGH

**[HIGH] `src/screens/MyMoney.jsx:2761-2778` — TripleAnchor: Net Worth + Wealth Score tap handlers depend on Dashboard's `pushDetail`, which resolves to `terminal('netWorth', 0, ...)` → only 2 sub-drivers (assets/liabilities) and no actionable detail.**
`onNetWorthTap={() => onDrillMetric?.('netWorth')}` does fire, but the resulting `DetailOverlay` shows a 2-line terminal — not the rich drill the founder expects. Fix: route NW tap to scroll into `BalanceSheet` section or open a richer NW driver tree.

**[HIGH] `src/screens/MyMoney.jsx:1167-1175` — SurplusTile hero number "+£X / left over" is bare text, not drillable.**
`<div className="sw-hero-md"><Num value={amt} format="currency" animate /></div>` — no wrapper, no TappableNumber, no onClick. Tap on the £ number does nothing. Same for the 4 MetricTiles below (line 1218-1221: Monthly income / Essentials / Debt payments / Committed). Fix: wrap hero in `<TappableNumber value={amt} question="What changed in my cashflow this month?" context={{metric:'monthlySurplus'}}>`.

**[HIGH] `src/components/MyMoney/TileGrid.jsx:340-345` — Liquidity sub-bar segments (Liquid/Pension/Illiquid/Alt) have NO onClick.**
Bare `<div>` segments — visual only. User cannot drill into "Liquid" to see what counts as liquid. Same for the dot legend chips at lines 309-336. Fix: wrap each in a `<button>` calling `onView(category)`.

**[HIGH] `src/components/MyMoney/CategoryTile.jsx:222-228` — Per-tile hero £ value is bare text inside the parent tile's onClick.**
The whole tile is clickable, but the £ number cannot be selected or has no `<TappableNumber>` wrapper for asking "what if". Composition chips (lines 257-269) likewise non-tappable. Combined with TileGrid liquidity bar (HIGH above), 4 of the founder's listed "should be tappable" affordances all fail in the same way: bare text inside a card-level onClick. Fix: wrap each in `TappableNumber` with category-specific scenario question.

**[HIGH] `src/components/MyMoney/InvestmentsDrillDown.jsx:146` — Subtitle "X holdings" wrong for legacy-schema personas.**
`${items.length} holdings` where `items = a.investments || []`. Legacy schema stores ISA in `a.isa.value` and GIA in `a.portfolio.value` (numbers), which line 116-118 folds into `byWrapper.ISA / byWrapper.GIA` so `total > 0` but `items.length === 0`. For persona-a / Mr T-derived personas this shows `£X holdings · 0 holdings` next to a real total. Fix: compute count as `items.length + (a.isa?.value > 0 ? 1 : 0) + (a.portfolio?.value > 0 ? 1 : 0)` and pluralise.

**[HIGH] `src/screens/MyMoney.jsx:2895-2924` — CoI list `setDrillPension(true)` on pension row opens the SAME PensionDrillDown as everywhere else.**
This is intentional but means the user has no way to see a CoI-specific framing of the pension issue (e.g. "you'd save £X by drawing down to £37,700 instead of inaction"). The drill discards the CoI context. Fix: pass `initialPreset` or a CoI banner prop to PensionDrillDown when entered via CoI.

**[HIGH] `src/screens/MyMoney.jsx:1781-1784` — PensionDrillDown swallows `ihtDynamic` errors silently.**
`try { ... } catch { /* engine may not yet compute — silent */ }`. If the engine fails on a particular persona, the IHT-saved tile (line 2070) shows `£0` rather than `—`, making it look like the plan saves nothing. Fix: track an `engineError` flag and render `—` + a small "engine unavailable" badge instead of zero.

**[HIGH] `src/components/MyMoney/LiabilitiesDrillDown.jsx:135` — Subtitle pluralisation wrong: "1 loans".**
`${allLoans.length} loans`. Fix: `${allLoans.length} loan${allLoans.length === 1 ? '' : 's'}`.

**[HIGH] `src/components/MyMoney/BusinessDrillDown.jsx:112` — Subtitle: "1 co · 1 scheme" — abbreviated AND mis-pluralised.**
`${companies.length} co · ${shareSchemes.length} scheme`. "co" reads as a typo; both nouns need plural handling. Fix: `${companies.length} compan${companies.length === 1 ? 'y' : 'ies'} · ${shareSchemes.length} scheme${shareSchemes.length === 1 ? '' : 's'}`.

**[HIGH] `src/screens/MyMoney.jsx:1937-1939` — `TAX.mpaa ?? 10000` — fallback hardcoded.**
If `TAX.mpaa` is missing from engine constants, `10000` ships to the user as a real number. The September 2026 Budget changes thresholds; hardcoding falls silently out of date. Fix: throw / log a warning in dev, fail the tile to "—" in prod.

**[HIGH] `src/screens/MyMoney.jsx:982-986` — `CliffEdgeWarning` only shows when `distance > 20_000`. Off-by-one direction.**
`if (distance > 20_000) return null` — but `distance = cliff - ani`. For ANI = £79,000, distance = £21,000, banner hides. For ANI = £80,001, distance = £19,999, banner shows. That's the founder's intended cutoff. BUT — for ANI = £150k (well past cliff), distance = -£50k, condition is `-50000 > 20000 = false`, so the banner shows (correctly, with "past" copy). Confusing logic; functionally correct only by accident. Fix: rewrite as `if (distance > 20_000) return null; const past = ani > cliff` for clarity.

**[HIGH] `src/screens/MyMoney.jsx:3024-3026` — `isaUsedYTD` mis-reads spec field.**
`.filter(inv => (inv.type || '').toLowerCase().includes('isa'))`. For a JISA / LISA / IFISA the type string contains "isa" so this passes — but reading `i.contribution_current_tax_year` assumes a specific field name not present on all personas. For personas where the field is missing, `isaUsedYTD = 0`, so the context line says "£20k of tax-free ISA room left" for someone who's already maxed. Fix: prefer engine `allowanceTracker(entity).isa.used` (already imported at line 41).

---

## MEDIUM

**[MEDIUM] `src/components/MyMoney/TileGrid.jsx:505` — `maxVal` uses `Math.abs(b.isBase ? b.value : b.value)` — the ternary is a no-op.**
Both branches return `Math.abs(b.value)`. Dead code that obscures intent. Fix: simplify to `Math.abs(b.value)` and reconsider the whole scaling (see CRITICAL #1).

**[MEDIUM] `src/screens/MyMoney.jsx:1779` — `ihtWithSchedule = 0` initial — if `try{}` block fails before assignment, `ihtDelta = ihtCurrent - 0 = ihtCurrent`, falsely showing a "saved" amount equal to current IHT.**
Defensive `let` init is wrong default. Fix: initialise to `null` and guard the display: `ihtDelta != null && ihtDelta > 0 ? fmt(ihtDelta) : '—'`.

**[MEDIUM] `src/screens/MyMoney.jsx:3163-3169` — `coiForDomain(entity, c.id)` called per-tile, then again in the CoI ranked list at 2861.**
Double calls per render, including the regex extraction comment at line 2853. Memoise once and pass down. Fix: hoist `const coiByDomain = useMemo(...)`.

**[MEDIUM] `src/screens/MyMoney.jsx:2032-2036` — Sparkline path uses `series.map(p => +p.balance || 0)` — but `sippProjectionSeries` may return numbers not objects.**
If `series[i]` is a number, `p.balance` is `undefined`, defaults to 0, sparkline flatlines. Fix: `const v = typeof p === 'number' ? p : (+p.balance || 0)`.

**[MEDIUM] `src/components/MyMoney/CategoryTile.jsx:158-201` — SVG sparkline gradient ID uses `useId()` which is good, but the `<defs>` block re-creates every render.**
Not a correctness bug — performance-ish. Acceptable but worth noting if many tiles render simultaneously.

**[MEDIUM] `src/screens/MyMoney.jsx:2718-2723` — `nwMoM_` computed from `entity.trajectories.netWorthHistory` but the bridge clause embeds it in copy without rounding.**
`fmt(nwMoM_)` — fine, but if `nwMoM_` is 0.4 it shows `£0`. Add threshold: only show bridge if `Math.abs(nwMoM_) >= 100`.

**[MEDIUM] `src/screens/MyMoney.jsx:3014` — Income tile rendered with `rows: []` but spec keeps it as a "sign-post to Cashflow".**
TileGrid passes empty rows → CategoryTile shows "—" hero. Empty-state copy is missing for the income tile. Fix: add `empty: 'See Cashflow for monthly income detail.'`.

**[MEDIUM] `src/components/MyMoney/PropertyDrillDown.jsx:90` — `btls = Array.isArray(a.property) ? a.property : []` ignores `entity.rental_portfolio.properties`.**
The MyMoney parent rowsForProperty (MyMoney.jsx:426) DOES read `rental_portfolio.properties`. The drill-down does not. Personas with BTL only in `rental_portfolio` see an empty BTL section despite the tile showing a value. Fix: also fold `entity.rental_portfolio?.properties` into `btls`.

**[MEDIUM] `src/components/MyMoney/LiabilitiesDrillDown.jsx:119-120` — LTV uses only `a.residence.value`, ignores joint ownership share.**
For a 50%-owned residence the LTV is overstated (mortgage attributed in full, value halved by spec at MyMoney.jsx:413). Fix: `residenceValue = (+a.residence?.value || 0) * (+a.residence?.ownershipShare || 1)`.

**[MEDIUM] `src/screens/MyMoney.jsx:2944` — `pivot === 'balance-sheet'` IIFE is 280 lines of inline logic.**
Maintainability red flag. Has nothing to do with bugs but increases the surface for them. Suggestion: extract `<BalanceSheetPivot ... />`.

**[MEDIUM] `src/components/MyMoney/ProtectionDrillDown.jsx:143` — Subtitle "X/4 core" uses `coreCount` but plural always.**
Same pattern as Liabilities/Business — `${coreCount}/4 core · ${fmt(totalLifeCover)} life cover` reads OK in numeric form but lacks fallback when no protection at all (says "0/4 core"). Fix: guard with `coreCount === 0 ? 'No protection on file' : ...`.

**[MEDIUM] `src/components/MyMoney/InvestmentsDrillDown.jsx:115` — `acc[w] = (acc[w] || 0) + (+it.value || +it.balance || 0)` ignores `+it.balance_gbp`.**
Spec items often use `balance_gbp`. Subtotals undercount. Fix: `+(it.balance_gbp ?? it.balance ?? it.value ?? 0)`.

**[MEDIUM] `src/screens/MyMoney.jsx:3149-3162` — Sparkline "back-cast" creates fake historical data.**
Constant per-month growth rate applied retroactively. User sees a smooth line that looks like real history. Comment acknowledges it's "not real history" but UI gives no signal. Fix: add an "est." badge to the sparkline (CategoryTile already does so at line 194-198, but the est-data origin is undocumented in the tile UI).

---

## LOW

**[LOW] `src/screens/MyMoney.jsx:1010-1011` — Disclaimer copy says "A pension contribution of around £X" but `pensionToSolve = Math.abs(distance)` when past cliff.**
Rounding to nearest k would be friendlier. Cosmetic.

**[LOW] `src/screens/MyMoney.jsx:1305` — `Take-home (${a.confidence})` exposes engine confidence value in user-visible copy.**
If `confidence === 'low'` user sees "Take-home (low)". PP-9 lite — engine vocabulary leak. Fix: drop the parenthetical or translate to "estimated".

**[LOW] `src/screens/MyMoney.jsx:2089` — Button label "Commit DRAWDOWN_SCHEDULE_SET" leaks event-bus enum to user.**
Visible label after user edits the drawdown schedule. PP-9 violation. Fix: "Save plan" / "Commit changes".

**[LOW] `src/screens/MyMoney.jsx:2256` — "All five metrics are healthy" hardcoded "five" — counts now show 5 if all bands === 'good' but safety tile can be excluded (line 2189) producing 4 metrics.**
Fix: `All ${allTiles.length} metrics are healthy`.

**[LOW] `src/components/MyMoney/BusinessDrillDown.jsx:189` — `<Chip>Corp tax 19/25%</Chip>` hardcoded — 19/25 is FY24 marginal/main; check current rate band.**
Fix: source from `TAX` constants.

**[LOW] `src/screens/MyMoney.jsx:467` — `(+l.apr || +l.interest_rate || 0) * 100` formats as `${...}% APR` without `.toFixed(1)`.**
Shows "5.250000000001% APR" on float-imprecise values. Fix: `.toFixed(1)`.

**[LOW] `src/screens/MyMoney.jsx:3070-3084` — `+(entity.liabilities.mortgage.rate) * 100` in the same expression as `mortgageRate` lookup repeats parsing.**
Cosmetic refactor.

**[LOW] `src/components/MyMoney/PropertyDrillDown.jsx:154` — `purchased {residence.purchase_date || 'n/a'}` — "n/a" leaks for missing data.**
Use "—" per the design system convention seen elsewhere.

**[LOW] `src/components/MyMoney/InvestmentsDrillDown.jsx:194` — CGT section copy says "First £3,000 of gain is tax-free per year" — verify against `TAX.cgaAllowance`.**
Hardcoded `cgtAnnualExempt = 3000` (line 135). Same risk as MPAA. Fix: import from engine.

---

## Summary

- **CRITICAL**: 4
- **HIGH**: 11
- **MEDIUM**: 12
- **LOW**: 8
- **TOTAL**: 35

Pattern findings (affects multiple files):
1. **Bare numbers everywhere**: Triple anchor (works via Tile onClick), Surplus hero (broken), MetricTiles (broken), BalanceSheet rows (broken in BalanceSheet.jsx but TileGrid replaces it with clickable CategoryTiles — partial). Founder's "nothing is drillable" complaint is concentrated in SurplusTile + TileGrid liquidity bar + per-tile composition chips.
2. **Plural mis-handling across all 5 drill subtitles** (Investments, Property, Business, Protection, Liabilities).
3. **All drill panels share one footgun**: `<a href="/ask?q=...">` in DrillContextStub does hard navigation — likely the root cause of bug #1.
4. **Driver tree fallback is identical for every unknown metric**, producing perceived "same screen" for any drill that hasn't been wired.
