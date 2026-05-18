# Domain Audit — MyMoney pass-1

**Auditor:** domain-auditor (A5 + UK financial domain)
**Date:** 2026-05-18
**Screen:** `src/screens/MyMoney.jsx`
**Engine:** `src/engine/fq-calculator.js` + `src/engine/canonical-metrics.js`
**Rules SoT:** `app-prototype/rules-uk.js` (verified 2026-05-15, tax year 2026/27)
**Disclaimer SoT:** `src/config/brand.js` → `BRAND.disclaimer`

> Engine maths carries 1,240 passing assertions. Domain risk on this screen is concentrated in **copy, definitions, framing, and placeholder leakage** — not arithmetic.

---

## A5 + Domain Verdict Table

| Element ID | Element | A5 Verdict | Domain Verdict | Finding |
|------------|---------|-----------|----------------|---------|
| MM-COI-01 | "Cost of doing nothing" panel header | PASS | PASS | Neutral framing; no FCA issue |
| MM-COI-02 | `totalCoI` aggregate figure + `coiForDomain` rows | PASS | **FAIL-SCOPE** | CoI aggregate covers 9 engine domains (fq-calculator.js:1975–1986), not 12 canonical. `propertyDecisions` is hardcoded 0 (stub). Spec requires NPV across all 12 domains. |
| MM-COI-03 | `coiCashflowVariants` "Cost of waiting" drawdown sub-tab | PASS | **FAIL-NARROW** | Sub-label `Drawdown · Wrapper choice` makes CoI look like a pension/wrapper-only concept. CoI is aggregate across all domains per Foundation v1.11 §0.1. Copy must not imply narrower scope. |
| MM-PRI-04 | Priority card "Estate efficiency Xp/£" | **FAIL-A5** | PASS (maths) | `p/£` is unexplained jargon. Non-expert user cannot deduce that 64p/£ = 64p in every £1 of estate reaches beneficiaries after IHT. No plain-English tooltip at the top layer. |
| MM-PRI-04-act | Priority card action text: `Nominate pension, put life cover in trust, and use the £3k annual gift allowance — all IHT-free.` | **FAIL-FCA** | PASS (fact) | "Nominate pension, put life cover in trust" is prescriptive instruction directing a specific action — crosses from information to guidance/advice. FCA COBS 9A boundary. Rephrase as "Options include…" |
| MM-PRI-03-act | Priority card action text: `Max pension contributions — £1 costs only 60p after 40% tax relief. Highest-return action available.` | **FAIL-FCA** | PASS (arithmetic) | "Highest-return action available" is an advice-phrased recommendation. The 60p/£ arithmetic is correct (40% relief on a higher-rate taxpayer), but "Highest-return" asserts a personal recommendation. Rephrase: "For a 40% taxpayer, pension relief means £1 contribution costs 60p net — typically the most tax-efficient first step." |
| MM-CLF-02 | Cliff-edge copy: `A £{pensionToSolve} pension contribution pulls you below it` / `keeps you below the cliff` | **FAIL-FCA** | PASS (maths) | "A £X contribution pulls/keeps you below" is prescriptive personal advice. Correct framing: "A £X contribution would be needed to bring ANI below £100k — confirm with an adviser before acting." |
| MM-CLF-02b | Cliff-edge copy: `60% effective rate` | PASS | PASS | Correctly described as effective marginal rate (PA taper at 50p/£ on £2 income = 60%); accurate. |
| MM-OVL-PEN | Pension overlay: LSA hardcoded `£268,275` | PASS | **FAIL-HARDCODE** | `MyMoney.jsx:1996,2003,2005` hardcodes 268275 and 1073100 as literals. `rules-uk.js` governance rule states "Never hardcode a threshold in HTML/JSX. Read from RULES.*". These figures are correct for 2026/27 but will silently go stale at any legislative change. |
| MM-OVL-PEN | Pension overlay: LSDBA hardcoded `£1,073,100` | PASS | **FAIL-HARDCODE** | Same as above; `MyMoney.jsx:1997,2004`. Correct value but violates RULES.* governance. |
| MM-OVL-PEN | LSA/LSDBA copy: "lifetime cap" / "combined cap" | PASS | PASS | Accurate and plain-English. LSA = £268,275 (Finance Act 2023, in force). LSDBA = £1,073,100. Both ENACTED per rules-uk.js. |
| MM-OVL-PEN | Pension overlay: "25% tax-free" | PASS | PASS | Correct; subject to LSA/LSDBA headroom already disclosed. |
| MM-DER-01 | Drawdown efficiency panel: `drawdownEfficiencyRatio` | PASS | **FAIL-IP-DEF** | `canonical-metrics.js:194–220`: `drawdownEfficiencyRatio` is a founder-IP concept. The build assigns it a specific formula: `actual_drawdown ÷ (pension_pot × 4.5%)`. This asserts an implementation for a named IP stub. Engine defines the term rather than leaving it as a stub. Severity depends on founder sign-off — if this formula is approved, PASS. If not, this definition leaks before the IP is locked. |
| MM-PRC-01 | `prcPccSpread` — imported but not rendered | PASS | **FAIL-IP-STUB** | `MyMoney.jsx:33` imports `prcPccSpread`. `canonical-metrics.js:155–192` defines PRC = liquid + 5yr surplus; PCC = annual essentials × leverage. This is an active definition for a founder-IP term. Not rendered on screen so no user-visible harm, but definition is live in engine. Needs founder confirmation. |
| MM-EBR-01 | `effectiveBeneficiaryRate` definition | PASS | **FAIL-IP-DEF** | `canonical-metrics.js:223–274`: EBR = net_to_heirs ÷ gross_estate using post-2027 SIPP-in-estate rules. This is a plausible HMRC-consistent definition. However Effective Beneficiary Rate is listed as founder IP. If the formula is approved by founder, PASS. If not, same risk as DER. |
| MM-NRI-02 | "India bundle loading — DTAA computations pending" | **FAIL-A5** | PASS | Placeholder text visible in live UI when entity has NRI flag. `MyMoney.jsx:3397`. "DTAA computations pending" is developer jargon; user sees it as a broken state label. Must be replaced with a user-facing status line or hidden until DTAA is implemented. |
| MM-BS-0c | Per-tile sparklines back-cast from `CAT_MONTHLY_DRIFT` constants | PASS | **FAIL-INTEGRITY** | Sparklines imply historical data they don't have. Charts are synthetic back-projection from drift constants (`MyMoney.jsx:3126–3131`). Displaying them without a "estimated" label is a claim-integrity issue — user may believe they're seeing real price history. |
| MM-MA-01 | Marriage allowance: "You qualify — saves the tax shown" | PASS | **FAIL-FCA-SOFT** | "You qualify" is a declarative eligibility statement without a caveat that eligibility depends on the entity's self-reported data accuracy. Minor FCA framing risk; add "based on information provided." |
| MM-SIPP-IHT | SIPP IHT status | PASS | PASS | `brand.js:30` correctly sets `nextRulesDate: '2027-04-06'` and rules-uk.js flags `sipp_iht.status: 'ENACTED'` with effective date 6 April 2027, Finance Act 2026. No stale copy found. |
| MM-STATE-PEN | State pension figure | PASS | **WARN** | State pension read from `entity.income.statePension.annual` (user-supplied) rather than rules-uk.js canonical (£12,547.60/yr for 2026/27, rules-uk.js). No hardcoded stale figure, but the screen does not warn if entity data is older. Low severity. |
| MM-ISA | ISA allowance references | PASS | PASS | `canonical-metrics.js:33` uses `ISA_CAP = 20000`. Matches rules-uk.js `isa.annual_allowance: 20000` ENACTED. Correct. |
| MM-AA | Pension annual allowance references | PASS | PASS | `canonical-metrics.js:34` uses `PENSION_AA = 60000`. Matches rules-uk.js `pension.annual_allowance: 60000` ENACTED. Correct. |
| MM-NRB | NRB/RNRB in `effectiveBeneficiaryRate` | PASS | PASS | `canonical-metrics.js:35–36` uses `NRB = 325000`, `RNRB = 175000`. Both correct per HMRC (Finance Act 2020, unchanged). |
| MM-CGT | CGT AEA references | PASS | PASS | `coiForDomain` investments branch does not reference CGT AEA directly; uses ISA drag calculation. No stale CGT figure found. |
| MM-MPAA | MPAA references | PASS | PASS | Not explicitly displayed on this screen. rules-uk.js correctly records £10,000 ENACTED. |
| MM-FCA-FOOTER | `BRAND.disclaimer` on main screen + pension overlay | PASS | PASS | `MyMoney.jsx:2140,3415` renders `BRAND.disclaimer` = "Not regulated financial advice. Verify decisions with a qualified UK financial adviser." Present on screen and in pension overlay. Meets A5 minimum. |
| MM-COI-COPY-01 | CoI row copy from `coiForDomain` — pensions branch | PASS | PASS | "£Xk of tax relief gone forever if not used by 5 April" — factually correct, no advice framing. |
| MM-COI-COPY-02 | CoI row copy — investments (ISA) branch | PASS | **WARN-FCA-SOFT** | "if you shelter £Xk into your ISA" — mild action implication, not a hard advice failure. Acceptable as information copy. |
| MM-COI-COPY-03 | CoI row copy — protection branch: "putting the policy in trust fixes it" | **FAIL-FCA** | PASS (fact) | "fixes it" is prescriptive. Reframe: "placing in trust could remove it from the estate — take advice before restructuring." |
| MM-COI-COPY-04 | CoI row copy — liabilities / cash branches | PASS | PASS | Informational framing. Correct arithmetic. |
| MM-DEC-06 | Empty-state drawdown plan `<span>` not `<button>` | NA (interaction) | PASS | Domain scope not applicable here. |
| MM-S-14 | "India bundle loading — DTAA computations pending" (duplicate) | **FAIL-A5** | PASS | See MM-NRI-02 above. |

---

## Findings Detail

### FAIL-1 · CoI 9-domain instead of 12-canonical (MM-COI-02)
**File:** `src/engine/fq-calculator.js:1975–1986`
**Issue:** `totalCoI` aggregates 9 domains: `drawdown, wrapperSequencing, contributions, taxAllowances, estatePlanning, protection, debt, gifting, investmentStrategy`. The `propertyDecisions` domain is hardcoded `0` with comment "founder-IP — see openItem". Foundation v1.11 §0.1 specifies 12 canonical domains (A–L per the architecture master). The gap between displayed aggregate and true 12-domain NPV means the CoI figure is systematically understated. The `coiForDomain` switch (`canonical-metrics.js:280–346`) also only handles: pensions, investments, property, business, protection, liabilities, cash — 7 of 12.
**Correct position:** CoI must be aggregate NPV across all 12 canonical domains. `propertyDecisions` and any others currently zeroed must either be implemented or disclosed as "estimate excludes [domain]".
**Severity:** FUNCTIONAL (not demo-blocking; the number renders, but it's structurally incomplete)

---

### FAIL-2 · CoI sub-tab implies pension/wrapper narrowing (MM-COI-03)
**File:** `src/screens/MyMoney.jsx:1467–1471`
**Issue:** The 5th drawdown-method tab is labelled `'Cost of waiting'` with `sub: 'Drawdown ${fmt(coiV.drawdown)} · Wrapper choice ${fmt(coiV.wrapper)}'`. This positions CoI as a drawdown/wrapper concept. Placement under the drawdown method selector further reinforces the narrowing. Any user reading this sub-tab label will believe CoI = pension + wrapper decisions only.
**Correct position:** This is the `coiCashflowVariants` sub-figure, which is a legitimate cashflow-specific slice of CoI. It should be labelled "Cashflow CoI estimate" or similar, with a note that the full CoI appears in the panel above.
**Source:** Foundation v1.11 §0.1; inventory MM-COI-02 notes.
**Severity:** FUNCTIONAL

---

### FAIL-3 · "Estate efficiency Xp/£" unexplained jargon (MM-PRI-04)
**File:** `src/screens/MyMoney.jsx:2267–2268`
**Issue:** `label: 'Estate efficiency'`, `value: '${Math.round((ebr.rate || 0) * 100)}p/£'`. The `p/£` unit is opaque to any non-specialist. A user with no financial background cannot infer that 64p/£ means 64 pence of every £1 of their estate will reach their family. There is no inline explanation or ExplainerChip at the rendered label level.
**Correct position:** Either add an ExplainerChip inline (macOS principle: jargon depth on tap), or rewrite as `64% reaches heirs` with tooltip explaining the IHT deduction. The inventory flags this as seed MM-S-07 (FUNCTIONAL).
**Source:** FCA Consumer Duty (PRIN 12) — information must be understandable to the target market.
**Severity:** FUNCTIONAL

---

### FAIL-4 · Prescriptive action copy in Priority cards — FCA boundary breach (MM-PRI-04-act, MM-PRI-03-act)
**File:** `src/screens/MyMoney.jsx:2263, 2271–2272`

Copy 1 (MM-PRI-03-act):
> `Max pension contributions — £1 costs only 60p after 40% tax relief. Highest-return action available.`

Copy 2 (MM-PRI-04-act):
> `Nominate pension, put life cover in trust, and use the £3k annual gift allowance — all IHT-free.`

**Issue:** "Max pension contributions" is an instruction. "Highest-return action available" is a personal recommendation asserting relative superiority over other options. "Put life cover in trust" is a directive. Under FCA COBS 9A and the Consumer Duty framework (PRIN 12), these cross from generic information into personal recommendation/advice because they direct specific actions to a specific individual based on their data.
**Correct position:** Reframe as information about options. E.g.: "For a 40% taxpayer, pension contributions attract relief — £1 contributed costs 60p net. Consider speaking to an adviser about whether this fits your plan." "Options to reduce IHT exposure include pension nomination, placing life cover in trust, and annual gifts — each has conditions that vary by circumstance."
**Source:** FCA COBS 9A (suitability); FCA Consumer Duty PRIN 12; Sonuswealth positioning = information/guidance/storage NOT sales.
**Severity:** DEMO-BLOCKING (FCA framing failure visible to users)

---

### FAIL-5 · Cliff-edge contribution copy is prescriptive advice (MM-CLF-02)
**File:** `src/screens/MyMoney.jsx:996–997`
> `A £{pensionToSolve} pension contribution pulls you below it.`
> `A £{pensionToSolve} pension contribution keeps you below the cliff.`

**Issue:** "A £X contribution pulls/keeps you below" is a prescriptive directive specifying the exact amount and the action. While the arithmetic is correct (ANI < £100k after contribution), directing a user to make a specific pension contribution of a named amount is a personal recommendation under FCA COBS 9A.
**Correct position:** "To bring adjusted net income below £100k, pension contributions of approximately £X would typically be needed — verify with an adviser before acting, as other income adjustments may apply."
**Source:** FCA COBS 9A.1.
**Severity:** DEMO-BLOCKING

---

### FAIL-6 · LSA/LSDBA hardcoded as literals (MM-OVL-PEN)
**File:** `src/screens/MyMoney.jsx:1996–1997, 2003–2005`
Values 268275 and 1073100 appear 3× as bare numeric literals in JSX, in violation of `rules-uk.js` governance preamble: "Never hardcode a threshold in HTML/JSX. Read from RULES.*"
**Correct position:** These values must be imported from the RULES bundle or a config constant sourced from rules-uk.js. Current values are correct (Finance Act 2023, ENACTED, unchanged for 2026/27), so no user-facing error today — but will silently go stale.
**Source:** rules-uk.js governance preamble; `app-prototype/rules-uk.js:1–10`.
**Severity:** FUNCTIONAL (governance violation, not a wrong figure)

---

### FAIL-7 · Founder-IP terms assigned definitions without sign-off (MM-DER-01, MM-PRC-01, MM-EBR-01)
**File:** `src/engine/canonical-metrics.js:155–274`

Three founder-IP concepts have live engine implementations:
- **Drawdown Efficiency Ratio:** `actual ÷ (pension × 4.5%)`. A specific formula is now in production.
- **PRC/PCC Spread:** `PRC = liquid + 5yr surplus; PCC = essentials × leverage`. Live formula with labels "Personal Risk Capacity" and "Personal Capital Cost" in code comments.
- **Effective Beneficiary Rate:** `net_to_heirs ÷ gross_estate` using post-2027 SIPP rules. Rendered on screen as `p/£` in Priority card.

**Issue:** These are flagged as founder-IP in the audit brief. If the founder has approved these formulas, they are PASS. If not, the build has asserted definitions for unspecified concepts. The EBR formula is factually sound (standard IHT analysis), but the naming is proprietary.
**Note:** `prcPccSpread` is imported but not rendered in the UI — lower risk. `effectiveBeneficiaryRate` IS rendered (Priority card MM-PRI-04).
**Source:** Audit brief §2 — "If the build asserts a definition for these, FAIL it."
**Severity:** FUNCTIONAL (pending founder sign-off review)

---

### FAIL-8 · Placeholder text visible to users — DTAA (MM-NRI-02 / MM-S-14)
**File:** `src/screens/MyMoney.jsx:3397`
```
India bundle loading — DTAA computations pending
```
This renders when `entity.individual?.isNRI` is truthy. "DTAA computations pending" is developer jargon. A user sees a broken state label rather than a meaningful message.
**Correct position:** Either hide the NRI section entirely until DTAA is implemented, or replace with: "India-held assets are shown below. Tax treaty (DTAA) calculations are not yet available — consult a cross-border tax adviser."
**Source:** Audit brief §5; FCA Consumer Duty — information must be clear and not misleading.
**Severity:** FUNCTIONAL (only triggers on NRI entities)

---

### FAIL-9 · Protection CoI copy is prescriptive (MM-COI-COPY-03)
**File:** `src/engine/canonical-metrics.js:320–323`
> `placing the policy in trust fixes it`

"Fixes it" is advice framing — implies a certain and sufficient remedy. Trust arrangements have conditions (trust deed, trustees, ongoing administration). The word "fixes" overstates certainty and directs action.
**Correct position:** "Placing the policy in trust could remove the payout from your estate — take specialist advice before restructuring."
**Source:** FCA COBS 9A; Consumer Duty clear, fair, not misleading.
**Severity:** FUNCTIONAL

---

### FAIL-10 · Per-tile sparklines imply historical data they lack (MM-BS-0c)
**File:** `src/screens/MyMoney.jsx:3126–3131` (drift constants), `src/screens/MyMoney.jsx:3143–3153` (sparkline wiring)
Sparklines are computed from static monthly drift constants (`pension: 0.0025/mo, property: 0.0033/mo`, etc.) and back-projected as if they were observed history. No label warns the user this is a synthetic projection, not actual account history.
**Issue:** Displaying synthetic data as visual history is misleading under FCA Consumer Duty PRIN 12 (fair, clear, not misleading). It does not meet the "honest stub" standard in §9 of the vault's CLAUDE.md.
**Correct position:** Label sparklines "estimated trend" or hide them until real time-series data is available.
**Severity:** FUNCTIONAL

---

### WARN-1 · State pension uses entity-supplied figure, not rules-uk.js canonical
**File:** `src/screens/MyMoney.jsx:617–621`
State pension read from `entity.income.statePension.annual`. This is correct design (user's actual entitlement may differ from the full new state pension). However the screen does not surface a warning if the entity's state pension value is implausibly low or absent — a user who hasn't entered it sees £0 silently, with no prompt to add it.
**Severity:** LOW / UX gap

---

## Proposed Severity Per FAIL

| FAIL | Severity | Rationale |
|------|----------|-----------|
| FAIL-1 · CoI 9-domain | FUNCTIONAL | Systematic understatement; no user-visible error but structurally incomplete |
| FAIL-2 · CoI narrowing copy | FUNCTIONAL | Misleading impression of scope |
| FAIL-3 · Estate efficiency jargon | FUNCTIONAL | Consumer Duty plain language; macOS principle violated |
| FAIL-4 · Priority card advice copy | **DEMO-BLOCKING** | FCA COBS 9A personal recommendation framing — cannot go live |
| FAIL-5 · Cliff-edge contribution directive | **DEMO-BLOCKING** | FCA COBS 9A personal recommendation with named £ amount |
| FAIL-6 · Hardcoded LSA/LSDBA | FUNCTIONAL | Governance violation; not wrong today |
| FAIL-7 · Founder-IP definitions | FUNCTIONAL | Pending founder review; EBR is rendered |
| FAIL-8 · DTAA placeholder | FUNCTIONAL | Developer jargon visible to NRI users |
| FAIL-9 · Protection CoI "fixes it" | FUNCTIONAL | Mild FCA framing |
| FAIL-10 · Synthetic sparklines | FUNCTIONAL | Consumer Duty misleading visual |

---

## Coverage

**Inventory rows checked:** ~95 (all regions in mymoney-inventory-v1.md traversed)
**Total inventory rows:** ~120 (including unverified data rows)

**Audit scope:** All rows carrying a financial figure, claim, or UK tax/FCA-relevant term. Pure data-wiring rows (£0 rendering, routing bugs) excluded — those belong to conformance.md.

**Hard-verified against source:**
- rules-uk.js: ISA £20k ✓, Pension AA £60k ✓, MPAA £10k ✓, CGT AEA £3k ✓, NRB £325k ✓, RNRB £175k ✓, SIPP IHT ENACTED effective 6 Apr 2027 ✓, State pension £12,547.60/yr 2026/27 ✓
- FCA disclaimer: present on main screen (line 3415) and pension overlay (line 2140) ✓
- "you should" / "we recommend" phrasing: **0 matches** (no hard advice language found)
- Advice boundary failures found in **action body copy** of Priority cards and cliff-edge copy (prescriptive directives, not "you should" phrasing — functionally equivalent)

**Items requiring founder decision before closure:**
1. FAIL-7 — confirm Drawdown Efficiency Ratio, PRC/PCC, EBR formulas are approved IP definitions
2. FAIL-1 — confirm which of the 12 canonical domains are intentionally deferred vs must be implemented before launch
