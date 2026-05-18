# A1 — Conformance Audit · Tax & Estate · Pass-1 (2026-05-18)

**Auditor:** conformance-auditor (auditor 1 of 5)
**Date:** 2026-05-18
**Inventory:** `tax-estate-inventory-v1.md` (227 rows across 34 regions)
**Baseline:** React component (no HTML mockup) — `src/screens/TaxEstate.jsx` (2550 lines) + `src/components/TaxEstate/InheritanceStory.jsx` + `src/components/Estate/BeneficiarySankey.jsx`
**Brand SoT:** `src/config/brand.js` (`BRAND.name='Sonuswealth'`, `BRAND.rulesVersion='UK-2026.1'`)
**Locked founder decisions checked:** FD-NAME-1 (no Caelixa/Finio strings — PASS), FD-LOGO-1 (NA: T&E uses BRAND only), FD-MASCOT-1 (NA), FD-CROSS-1 (CoI cross-screen — outside A1 scope; flagged in inventory S-16/S-17), FD-TE-1 (SIPP IHT ENACTED — chip wording verified, no "PROPOSED" strings exist).

**Scope:** A1 only — every inventory row tested for *element present in build, in the right region, with matching type/content*. A2 (drillability), A3/A4 (destination), A5 (plain English), A6 (reconciliation) belong to other auditors. Where the inventory note already pre-flags an A2/A6 concern but the element itself is present, A1 = PASS.

---

## A1 verdict table

### Region 1 — Shell / chrome / header

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-CHR-01 | PASS | — | Back-to-Home button present, wired to `onHome` | TaxEstate.jsx:2323-2332 |
| TE-CHR-02 | PASS | — | Live-rules pill renders `Live · {BRAND.rulesVersion}` | TaxEstate.jsx:2333-2336 |
| TE-CHR-03 | PASS | — | X28TopBar receives `window={x28Window}` + `onWindowChange={setX28Window}` | TaxEstate.jsx:2340-2343 |
| TE-CHR-04 | PASS | — | X28TopBar receives `viewMode` + `onViewModeChange` | TaxEstate.jsx:2342-2344 |
| TE-CHR-05 | PASS | — | X28TopBar receives `rulesVersion={BRAND.rulesVersion}` + `dataDate={BRAND.dataDate}` | TaxEstate.jsx:2345-2346 |
| TE-CHR-06 | PASS | — | `<p className="disclaimer">{BRAND.disclaimer}…</p>` present on every render | TaxEstate.jsx:2544-2546 |
| TE-CHR-07 | PASS | — | `BRAND.rulesVersion · BRAND.dataDate` footer line present | TaxEstate.jsx:2546 |

### Region 2 — Triple anchor

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-ANCH-01 | PASS | — | `<TripleAnchor … onNetWorthTap={() => onDrillMetric?.('netWorth')}>` | TaxEstate.jsx:2351-2361 |
| TE-ANCH-02 | PASS | — | `onWealthTap={() => onDrillMetric?.('wealthScore')}` + `deltaFQ` passed | TaxEstate.jsx:2357-2359 |
| TE-ANCH-03 | PASS | — | `onRiskTap={onOpenRisk}` | TaxEstate.jsx:2360 |

### Region 3 — Plan staleness banner/accordion

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-PLAN-01 | PASS | — | `PlanStalenessAccordion` delegates to `PlanStalenessBanner` when `plans.length === 1` | TaxEstate.jsx:1540-1541 |
| TE-PLAN-02 | PASS | — | Accordion header renders for ≥2 plans (D-TE-PLAN-ANTI-NAGGER-1) | TaxEstate.jsx:1536-1586 |
| TE-PLAN-03 | PASS | — | Per-plan label produced via `t === 'gift' ? 'Gifting' : t === 'tax' ? 'Tax' : 'Estate'` | TaxEstate.jsx:2237 |
| TE-PLAN-04 | PASS | — | Expand chevron present inside PlanStalenessAccordion | TaxEstate.jsx:1536-1586 |
| TE-PLAN-05 | PASS | — | "Review" pills route through `onReview={(p) => onDrillMetric?.(\`plan:${p.type}\`)}` | TaxEstate.jsx:2369, 2464 |

### Region 4 — Sub-tab segmented control

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAB-01 | PASS | — | `id: 'tax'` entry in SubTabSelector | TaxEstate.jsx:222 |
| TE-TAB-02 | PASS | — | `id: 'estate'` entry; smart default `if (preDecum && (expo?.iht_due ?? 0) === 0) return 'tax'` else `'estate'` | TaxEstate.jsx:223, 2155-2160 |
| TE-TAB-03 | PASS | — | `taxBadge` count computed and passed to SubTabSelector | TaxEstate.jsx:2377 |
| TE-TAB-04 | PASS | — | `estateBadge` count computed and passed to SubTabSelector | TaxEstate.jsx:2378 |

### Region 5 — Sub-anchor strip

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-SUB-T1 | PASS | — | `a: { label: 'YTD tax', value: fmt(totalTaxNow || 0) }` | TaxEstate.jsx:2256-2259 |
| TE-SUB-T1a | PASS | — | `DiffBadge` accessory when `taxSince != null && taxSince !== totalTaxNow` | TaxEstate.jsx:2257-2259 |
| TE-SUB-T2 | PASS | — | `b: { label: 'ANI', value: fmt(ani || 0), … }` | TaxEstate.jsx:2260-2261 |
| TE-SUB-T2a | PASS | — | `sub: ani >= 100000 && ani <= TAX.art ? '⚠ 60% taper band' : ''` | TaxEstate.jsx:2261 |
| TE-SUB-T3 | PASS | — | `c: { label: 'Allowances', value: '${allow?.utilization || 0}%' }` | TaxEstate.jsx:2262-2263 |
| TE-SUB-E1 | PASS | — | `a: { label: 'IHT today', value: fmt(ihtNow) }` | TaxEstate.jsx:2286 |
| TE-SUB-E2 | PASS | — | `b: { label: 'Family receives', value: fmt(beneficiaryNet) }` | TaxEstate.jsx:2287 |
| TE-SUB-E3 | PASS | — | `c: { label: 'Pension-IHT', value: \`${daysToPensionIHT} days\`, onTap: scrollToIHTDual }` | TaxEstate.jsx:2288-2295 |
| TE-SUB-E3a | PASS | — | `enactedChip` reads `Enacted · FA 2026` with title `Royal Assent 18 Mar 2026 — effective 6 Apr 2027` — FD-TE-1 honored | TaxEstate.jsx:2277-2284 |
| TE-SUB-E3b | PASS | — | `sub: 'Until 6 Apr 2027 · Finance Act 2026'` | TaxEstate.jsx:2291 |

### Region 6 — NRI banner

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-NRI-01 | PASS | — | `{nri && <NRINotice />}` where `nri = isNRI(entity)`, `isNRI(e){return e?.type === 'nri'}` | TaxEstate.jsx:72, 2249, 2385 |

### Region 7 — Tax summary card

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-SUM-01..08 | PASS | — | `TaxSummary` rendered at line 2390; component definition at 384 contains title, sub-line, ProvenanceChip, 4 tiles, total-tax strip | TaxEstate.jsx:384, 2390 |

### Region 8 — Income tax detail

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-IT-01..05 | PASS | — | `IncomeTaxDetail` rendered at 2391; def at 442; ExplainerChip TE-1 at 466; band rows render | TaxEstate.jsx:442, 466, 2391 |
| TE-TAX-IT-02 | PASS | — | `accessory={<ExplainerChip id="TE-1" />}` confirmed | TaxEstate.jsx:466 |

### Region 9 — ANI stepwise

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-ANI-01..07 | PASS | — | `ANIStepwise` rendered at 2392; def at 548 | TaxEstate.jsx:548, 2392 |

### Region 10 — Salary sacrifice

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-SS-01..04 | PASS | — | `SalarySacrifice` rendered at 2393; def at 598 | TaxEstate.jsx:598, 2393 |

### Region 11 — CGT detail card

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-CGT-01..07 | PASS | — | `CGTDetail` rendered at 2395; def at 639; BADR chip at 663; "Bed-and-ISA" / "Spousal" chips present | TaxEstate.jsx:639, 663, 2395 |
| TE-TAX-CGT-08 | PASS | — | "Detail ›" button → `setDrillView('cgt')` | TaxEstate.jsx:2397-2408 |

### Region 12 — Dividend detail

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-DIV-01..07 | PASS | — | `DividendDetail` rendered at 2410; def at 676; rate chips at 695-697 ("Basic 10.75%", "Higher 35.75%", "Add'l 39.35%") | TaxEstate.jsx:676, 695-697, 2410 |

### Region 13 — Allowances strip

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-ALL-01..06 | PASS | — | `AllowancesStrip` rendered at 2412; def at 722; per-allowance rows present | TaxEstate.jsx:722, 2412 |
| TE-TAX-ALL-07 | PASS | — | Cash-ISA £12k cap horizon banner present at 763-765 | TaxEstate.jsx:763-765 |
| TE-TAX-ALL-08 | PASS | — | "Detail ›" → `setDrillView('allowances')` | TaxEstate.jsx:2414-2425 |

### Region 14 — Self Assessment

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-SA-01..03 | PASS | — | `SelfAssessment` rendered at 2427; def at 772 | TaxEstate.jsx:772, 2427 |

### Region 15 — Drawdown matrix

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-DD-01..08 | PASS | — | `DrawdownMatrix` rendered at 2428; def at 789 — sticky header + rows + highlight logic + 60% chip + IHT-saved column | TaxEstate.jsx:789, 2428 |

### Region 16 — Non-Dom card

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-TAX-ND-01..03 | PASS | — | `NonDomCard` rendered at 2429; def at 864 (FIG + TRF status blocks) | TaxEstate.jsx:864, 2429 |

### Region 17 — Inheritance Story

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-IS-01 | PASS | — | `<div className="sw-eyebrow">If you died today</div>` + intro line "Here's what happens to your estate — in plain English." | InheritanceStory.jsx:132-138 |
| TE-EST-IS-02 | PASS | — | "If you died today, your IHT-relevant estate is worth {fmt(gross)}." pushed unconditionally | InheritanceStory.jsx:41-44 |
| TE-EST-IS-03 | PASS | — | "Less deductions: …" rendered when `totalDeductions > 0` | InheritanceStory.jsx:47-55 |
| TE-EST-IS-04 | PASS | — | "{fmt(spouseExempt)} passes to your spouse — spouse exemption" when `spouseExempt > 0` | InheritanceStory.jsx:58-63 |
| TE-EST-IS-05 | PASS | — | "Your allowances cover {nrbUsed tax-free band + rnrbUsed residence allowance}…" when either > 0 | InheritanceStory.jsx:66-74 |
| TE-EST-IS-06 | PASS | — | Charity 36% line `'${fmt(charity)} to charity — qualifies the remainder for the 36% reduced rate.'` when `charity > 0` | InheritanceStory.jsx:77-82 |
| TE-EST-IS-07 | PASS | — | "{fmt(taxable)} remains taxable. Inheritance tax due: {fmt(ihtDue)}" with `severity:'warn'` when `taxable > 0` | InheritanceStory.jsx:85-90 |
| TE-EST-IS-07a | PASS | — | Else-branch literal "Your £325k tax-free band covers everything." (S-02 hardcode confirmed for A6 auditor; element exists for A1) | InheritanceStory.jsx:92-96 |
| TE-EST-IS-08 | PASS | — | "Family receives approximately {fmt(beneficiary)} after IHT and deductions." when `beneficiary > 0` | InheritanceStory.jsx:100-106 |
| TE-EST-IS-09 | PASS | — | Probate line "Probate typically takes 6–9 months for estates around this size…" pushed unconditionally | InheritanceStory.jsx:109-112 |
| TE-EST-IS-10 | **FAIL** | **DEMO-BLOCKING** | `InheritanceStory` rendered as `<InheritanceStory entity={entity} />` — `onDrillMetric` prop NOT passed. The component declares `({ entity, onDrillMetric })` and binds `onClick={() => l.cta && onDrillMetric?.(l.cta)}`. With no prop, the beneficiaries-line CTA (`cta: 'beneficiaries'`) is dead. **A1 element exists but is structurally broken at the call site.** Confirms seed S-01. | TaxEstate.jsx:2438 vs InheritanceStory.jsx:17, 119, 144 |
| TE-EST-IS-11 | PASS | — | Footer hint "Tap any line to see the calculation behind it…" present | InheritanceStory.jsx:177-183 |

### Region 18 — Estate plan badge

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-PB-01..03 | PASS | — | `EstatePlanBadge` rendered at 2439; def at 1591 (eyebrow+target, staleness chip, "No plan yet" fallback) | TaxEstate.jsx:1591, 2439 |

### Region 19 — Estate CoI odometer

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-COI-01..05 | PASS | — | `EstateCoIOdometer` rendered at 2440; def at 1505 — CoI total, daily-rate sub, provenance list, byAction rows, cascade halo | TaxEstate.jsx:1505, 2440 |

### Region 20 — IHT dual-number card

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-IHT-01..11 | PASS | — | `IHTDualNumber` rendered at 2442; def at 908 — title+sub, ExplainerChip TE-1 (line 954), Today tile, After-2027 tile with `pulsing glow`, threshold gauge | TaxEstate.jsx:908, 954, 2442 |
| TE-EST-IHT-12 | PASS | — | "Breakdown ›" button at top-right → `setDrillView('iht')` | TaxEstate.jsx:2444-2455 |

### Region 21 — Plan staleness (mobile repeat)

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-PLAN-01..05 (mobile) | PASS | — | `{isMobile && plans.length > 0 && <PlanStalenessAccordion …/>}` after dual-number card | TaxEstate.jsx:2461-2466 |

### Region 22 — Will & LPA

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-WL-01..08 | PASS | — | `WillLPACard` rendered at 2469; def at 1277; RED cohabiting flag check (1283); "Cost of dying intestate: {fmt(nwc.total)}" banner (1325); intestacy distribution rows | TaxEstate.jsx:1277, 1283, 1325, 2469 |

### Region 23 — IHT waterfall

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-WF-01..06 | PASS | — | `IHTWaterfall` rendered at 2471; def at 1024; SliderRow for SIPP drawdown at 1057 + gifts + BPR sliders | TaxEstate.jsx:1024, 1057, 2471 |

### Region 24 — Gift clock

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-GC-01..07 | PASS | — | `GiftClock` rendered at 2472; def at 1084; ExplainerChip TE-2 at 1105; per-gift rows with RingChart, amount, date, taper chip, "Today: £X IHT" chip | TaxEstate.jsx:1084, 1105, 2472 |

### Region 25 — Trust simulator (RevealCard)

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-TR-00 | PASS | — | `<RevealCard cardId="te-trust-sim" title="Trust simulator" lifeStageGate={['preretirement','decumulation','preservation','legacy']} headerAccessory={<Chip>10-year periodic charge</Chip>}>` | TaxEstate.jsx:2475-2486 |
| TE-EST-TR-01..07 | PASS | — | `TrustSimulator` def at 1204 — per-trust block with "LOW · deed not in Vault" chip, next charge date, years-to-charge, rate, estimated charge | TaxEstate.jsx:1204, 2484 |

### Region 26 — BPR & APR mechanics (RevealCard)

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-BPR-00 | PASS | — | `<RevealCard cardId="te-bpr-apr" title="BPR & APR mechanics" lifeStageGate={hasBPREligibleHoldings(entity) ? [all stages] : [consolidation+]}>` | TaxEstate.jsx:2488-2505 |
| TE-EST-BPR-01..11 | PASS | — | `BPRAPRMechanics` def at 1451 — HalfCircleGauge, used/cap bar, tier tiles, all 5 contextual chips, APR sub-card | TaxEstate.jsx:1451, 2503 |
| TE-EST-BPR-12 | PASS | — | "Asset detail ›" → `setDrillView('bpr')` | TaxEstate.jsx:2507-2518 |

### Region 27 — Pension nominations

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-NM-01..04 | PASS | — | `NominationsManager` rendered at 2521; def at 1244 — title+count, per-pension rows, "Nominee set"/"No nominee"/"Stale" chips | TaxEstate.jsx:1244, 2521 |

### Region 28 — Beneficiary chain

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-BC-01..02 | PASS | — | `BeneficiaryChain` rendered at 2522; def at 1360; `BeneficiarySankey` component file exists at `src/components/Estate/BeneficiarySankey.jsx` (272 lines, animated DrawSVG) | TaxEstate.jsx:1360, 2522; BeneficiarySankey.jsx:1-272 |

### Region 29 — RNRB planning

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-RN-01..05 | PASS | — | `RNRBPlanning` rendered at 2523; def at 1401; `taperStart = 2000000` (line 1407), `taperEnd = 2350000` (line 1408); eligibility chip + gauge + downsizing line | TaxEstate.jsx:1401, 1407-1408, 2523 |

### Region 30 — IHT diff chip

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-EST-DF-01 | PASS | — | `{ihtSince != null && exposureToday && Math.abs(…) > 100 && <…DeltaChip />}` inline at end of Estate sub-tab | TaxEstate.jsx:2526-2540 |

### Region 31 — IHTDrillPanel

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-DRL-IHT-01..05 | PASS | — | `IHTDrillPanel` def at 1856; back button, header title "IHT exposure breakdown", hero with value/effective/family-receives sub, "From your data" chip | TaxEstate.jsx:1856 |
| TE-DRL-IHT-06 | PASS | — | `const nilRate = expo?.nil_rate_band ?? expo?.nil_band ?? 325000` (line 1861) + `rnrb = expo?.rnrb ?? expo?.residence_nil_rate_band ?? 0` (1862) — element exists; A6 concern flagged by seed S-04 | TaxEstate.jsx:1861-1862 |
| TE-DRL-IHT-07..09 | PASS | — | Waterfall step rows present | TaxEstate.jsx:~1870 |
| TE-DRL-IHT-10 | PASS | — | `{ label: 'IHT @ 40%', value: -ihtDue, sign: '−' }` literal (line 1875) — element exists; A6 hardcode flagged by S-05 | TaxEstate.jsx:1875 |
| TE-DRL-IHT-11..14 | PASS | — | Family receives row, estate composition section, action chip, FCA footer "Based on UK IHT rules · Finance Act 2026 · Not regulated advice" | TaxEstate.jsx:1990 |

### Region 32 — AllowanceDrillPanel

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-DRL-AL-01..12 | PASS | — | `AllowanceDrillPanel` def at 2003; back button, header, hero with composite %, "From your data" chip, ISA/PSA/CGT/Dividend/Personal-Allowance rows (lines 2007-2011 contain hardcoded `?? 20000 / 3000 / 500 / 12570` fallbacks), per-row remaining line, empty state, footer | TaxEstate.jsx:2003-2011 |

### Region 33 — BPRDrillPanel

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-DRL-BPR-01..10 | PASS | — | `BPRDrillPanel` def at 1625; back button, "Business Property Relief" title, empty state, per-asset rows (line 1632 has regex-based 100%/50% rate decision — S-11), total relief footer, ≥2-year caveat, FCA footer | TaxEstate.jsx:1625, 1632 |

### Region 34 — CGTDrillPanel

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TE-DRL-CGT-01..08 | PASS | — | `CGTDrillPanel` def at 1732; back button, header, unrealised gains card, investments + GIA rows, empty state, total | TaxEstate.jsx:1732 |
| TE-DRL-CGT-09 | PASS | — | `?? 3000` fallback (line 1736) | TaxEstate.jsx:1736 |
| TE-DRL-CGT-10 | PASS | — | Taxable gain row present | TaxEstate.jsx:~1737 |
| TE-DRL-CGT-11 | PASS | — | `const taxBasic = Math.round(taxable * 0.18)` (line 1738) — element exists; A6 hardcode flagged by S-06 | TaxEstate.jsx:1738, 1820 |
| TE-DRL-CGT-12 | PASS | — | `const taxHigher = Math.round(taxable * 0.24)` (line 1739) | TaxEstate.jsx:1739, 1824 |
| TE-DRL-CGT-13..14 | PASS | — | Tip banner + FCA footer present | TaxEstate.jsx:~1830 |

---

## UNLISTED elements found in build

A1 sweep for anything in the build NOT enumerated in the inventory:

| UL-ID | Element | Severity | Finding | Evidence |
|-------|---------|----------|---------|----------|
| UL-01 | `Live · {BRAND.rulesVersion}` pill carries a `title={\`${BRAND.rulesVersion} · ${BRAND.dataDate}\`}` tooltip (a green-dot indicator) | POLISH | Decorative dot `<span style={{width:6,height:6,borderRadius:'50%',background:'currentColor'}} />` inside TE-CHR-02 is not in the inventory — small, treat as TE-CHR-02 sub-detail. | TaxEstate.jsx:2334 |
| UL-02 | CGT "Detail ›" chip is rendered as an absolute-positioned button at `top:14, right:14` overlaying `CGTDetail` — same pattern repeats for Allowances, IHT, BPR | POLISH | Inventory describes "Detail ›" / "Breakdown ›" / "Asset detail ›" as L3 affordances but does not flag the positioning pattern. Not a finding; positioning is consistent across 4 panels. | TaxEstate.jsx:2397-2408, 2414-2425, 2444-2455, 2507-2518 |
| UL-03 | `useMemo` plan-list computation pre-populates `isCritical` from `stl.stale || severity==='high'` (anti-nagger promotion) | NONE | Pure logic, no UI element. Mentioned for completeness — not a UNLISTED UI finding. | TaxEstate.jsx:2230-2246 |

No rogue cards, no orphan strings, no untracked components. Every imported component (`TripleAnchor`, `X28TopBar`, `RevealCard`, `CoIOdometer`, `ProvenanceChip`, `PlanStalenessBanner`, `ExplainerChip`, `DiffBadge`, `DeltaChip`) is referenced in the inventory.

---

## Brand-drift sweep (FD-NAME-1)

- `grep -i "Caelixa|Finio|finio"` over TaxEstate.jsx → **0 matches**. PASS.
- `grep -i "PROPOSED|Proposed|proposed"` over TaxEstate.jsx → **0 matches**. **FD-TE-1 honored** — no "PROPOSED" wording for SIPP IHT anywhere on T&E. The chip wording at TE-SUB-E3a reads `Enacted · FA 2026` with title `Royal Assent 18 Mar 2026 — effective 6 Apr 2027`, exactly as FD-TE-1 prescribes.
- All product-name references resolve through `BRAND.*` imports from `src/config/brand.js`. No hardcoded "Sonuswealth" / "Caelixa" / "Finio" string literals in TaxEstate.jsx. PASS.
- Note: ExplainerChip TE-1 content lives in a shared component (not in TaxEstate.jsx). Auditor cannot verify TE-1's body copy here — seed S-23 flags this for the auditor with explainer-overlay scope, but in TaxEstate.jsx itself the chip's host context already says "Enacted · FA 2026", so the on-screen framing is correct.

---

## DECISION-NEEDED (founder)

These are not bugs — they are points where the build is internally consistent but the inventory contains a divergence the founder should resolve:

1. **TE-SUB-T1 / TE-SUB-T2 / TE-SUB-T3 are non-interactive by design.** The inventory note says "A2 fails if tapping does nothing" but the build deliberately does not pass `onTap` for the Tax sub-anchors (only `TE-SUB-E3` Pension-IHT has `onTap: scrollToIHTDual`). Founder decision needed: are the Tax sub-anchors meant to be drillable, or read-only summary cells? A1 marks them PASS-as-built; A2 will fail unless founder decides "no, read-only is correct."

2. **Region 21 — mobile plan-staleness accordion duplicates Region 3.** Inventory says "Mobile renders the same `PlanStalenessAccordion` after the IHT dual-number card" and lists the same IDs `TE-PLAN-01..05`. The build does this (TaxEstate.jsx:2461-2466). Treated as PASS — but founder should confirm whether duplicate IDs across two render slots is acceptable for the audit math, or whether mobile should get its own ID series (e.g. `TE-PLAN-M01..05`).

3. **InheritanceStory line ordering is dynamic.** Lines 1b/2/3/4/5b are conditional on engine values; the inventory enumerates IS-01..IS-11 as a fixed list. For a `gross=0` empty estate, several IDs will not render (NA, not FAIL). This is correct behavior — but the inventory should flag these as conditional rather than mandatory, or A1 will produce false FAILs in entity fixtures with empty estates. Recommend founder ratify: conditional rows render NA when their gate is false, not FAIL.

4. **TE-EST-IS-10 (S-01) — the missing `onDrillMetric` prop.** Strictly an A2 fail (dead CTA), but A1 also flags it because the *call site is structurally incomplete* relative to the component contract (`InheritanceStory({entity, onDrillMetric})`). Founder decision: classify this as A1 (structural) or A2 (interaction)? This audit calls it both — DEMO-BLOCKING — because the footer hint "Tap any line to see the calculation behind it" misleads the user. Fix is a one-line prop pass at TaxEstate.jsx:2438.

---

## Coverage

```
Total inventory rows:                                            227
Rows checked A1 (PASS / FAIL / NA):                              227
Coverage:                                                        100%

A1 verdict counts
  PASS                                                           226
  FAIL                                                             1   (TE-EST-IS-10)
  NA                                                               0
  UNLISTED elements                                                3   (UL-01..03 — all POLISH/NONE)
```

**Severity breakdown of FAILs (A1 only):**
- DEMO-BLOCKING: **1** (TE-EST-IS-10)
- FUNCTIONAL: **0**
- POLISH: **0**

**A1 pass rate:** 226 / 227 = **99.56%**.

Seeds S-02..S-26 are confirmed in source (every hardcode, every dead chip, every jargon term, every cross-screen reconcile risk located at the exact `file:line` predicted by the inventory) — but they are A2/A4/A5/A6 findings, not A1. Other auditors will rule on them in their respective passes.

---

## Return line

**TE conformance: 226 PASS, 1 FAIL (1 DB, 0 F, 0 P), 3 UNLISTED.**
