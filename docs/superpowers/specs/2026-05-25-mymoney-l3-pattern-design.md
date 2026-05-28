# MyMoney L3 Panel Pattern — Design Doc

**Date:** 2026-05-25
**Author:** Claude (Opus 4.7) + founder (Mihir)
**Skill:** superpowers:brainstorming
**Phase:** Sonuswealth master schedule §3 (frontend rebuild starts here)
**Next:** superpowers:writing-plans → implementation plan → execution

---

## Summary

Rebuild MyMoney to ship the founder's "drillable to nth degree" promise (PP-3) honestly: 19 L3 panels (one per spec domain) built on a single reusable `<L3Panel>` primitive, every drillable number opens a full L4 panel, every chart opens a full L4 chart panel with time-window controls. Plain English mandatory (PP-9). Mr T is the validation fixture — every domain must render with real data. Desktop-first (1440×900 + 1920×1080); mobile is a deferred cross-tab phase.

**Tags:** #mymoney #l3-panel #l4-drill #drillablechart #ripple #engine-prereqs #karpathy #pp-3 #pp-9
**Updated:** 2026-05-25

---

## §1 — Context

### 1.1 Why this exists

The 2026-05-23 gap audit said MyMoney was structurally complete but L3 panels existed for only 1 of 20 domains. Disk state showed 6 panels exist, but consolidated (InvestmentsDrillDown bundles ISA+GIA+EIS+Bonds; BusinessDrillDown likely bundles H+I+X; ProtectionDrillDown likely bundles J+K+L). Founder declared "the layout is not perfect" and asked for full skill-chain before any code lands.

### 1.2 Founder constraints (locked in conversation 2026-05-25)

| Constraint | Source |
|---|---|
| **Mr T is the validation fixture** — every domain must render at L3 quality with real data | Founder Q1 answer |
| **Engine work is in scope** — events fold, IHT chips, ripple migration all ship | Founder Q2 answer |
| **Desktop first** — 1440×900 + 1920×1080. Mobile is a separate cross-tab phase later | Founder Q3 answer |
| **"In-depth testing first to avoid duplicated work later"** | Founder principle, restated |
| **"Do it properly while we can"** | Founder, restated 4+ times |

### 1.3 Five locked design decisions (this doc captures them)

1. **L3 architecture:** C-prime hybrid slot model
2. **Domain → panel mapping:** 19 L3 panels, strict 1-to-1 per spec domain
3. **L3 placement:** Full-screen replace with pinned anchors + breadcrumb
4. **Drillability:** Full L4 panel for every drillable number (Option B). Plain English mandatory. Chart drill via `<DrillableChart>` primitive.
5. **Engine sequencing:** Hybrid — true prereqs (E1, F4) first, others alongside consumers

---

## §2 — Architecture

### 2.1 Three primitives ship from this phase

```
<L3Panel>            — Reusable detail-panel shell with slot architecture
<L4NumberPanel>      — Drill-down panel for any number (formula + source + breakdown chart)
<DrillableChart>     — Reusable chart with time-window + comparison + annotation controls
```

Every domain L3 module is a thin shape declaration that imports `<L3Panel>` and configures slots. Every number on every L3/L4 uses a `<DrillableNumber>` wrapper that opens `<L4NumberPanel>` on tap. Every chart uses `<DrillableChart>` which opens its full-screen drill on tap.

### 2.2 L3 slot architecture (C-prime hybrid)

```
┌─ <L3Panel sections={[…]}> ──────────────────────────────────────────┐
│                                                                     │
│  ┌─ FIXED TOP ──────────────────────────────────────────────────┐   │
│  │  1. Hero            — big number, 12mo+ chart, view-mode    │   │
│  │  2. Tax treatment   — IT / CGT / IHT 3-row (per spec §2.3)  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ VARIABLE MIDDLE (domain declares) ─────────────────────────┐   │
│  │  3..N. Domain-specific sections                              │   │
│  │     · Pension: AA position · LSA · Charges · Contributions   │   │
│  │     · ISA: Allowance · Holdings · Performance · Contribs     │   │
│  │     · Property: Per-property valuation · Rental P&L · S24    │   │
│  │       · CGT position · Mortgage profile                      │   │
│  │     · Cash: Per-account · Interest · Rate review · Liquidity │   │
│  │     · etc.                                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ FIXED BOTTOM ──────────────────────────────────────────────┐   │
│  │  N+1. Estate position  — IHT chip from T&E (cross-tab)      │   │
│  │  N+2. Data confidence  — FP-4 bar · add-doc · missing list  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The 4 fixed sections enforce the cross-cutting promises (tax discoverability, estate awareness, data honesty, drillable hero). The variable middle preserves spec fidelity per domain. Single primitive, max reuse.

### 2.3 Placement (locked: full-screen replace with pinned chrome)

```
┌─ Top bar (60px, pinned across all L levels) ─────────────────────────┐
│  ← Back to Money    Money › Pensions   [NW £727k] [W70] [R74]       │
├──┬──────────────────────────────────────────────────────────────────┤
│  │  Time view: [Today][Forecast][Plan][What-if]  [Tax year 26/27]   │
│ S│                                                                  │
│ I│  ╔═════════════════════════════════════════════════════════════╗ │
│ D│  ║  HERO — £205,500 [↑£18.5k YTD] [✦chart 5Y default]          ║ │
│ E│  ╚═════════════════════════════════════════════════════════════╝ │
│ B│  ╔═════════════════════════════════════════════════════════════╗ │
│ A│  ║  TAX TREATMENT — Income tax · Capital gains · Inheritance  ║ │
│ R│  ╚═════════════════════════════════════════════════════════════╝ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │  │ AA position  │ │ Tax-free cash│ │ Fund charges │             │
│  │  └──────────────┘ └──────────────┘ └──────────────┘             │
│  │  ╔═════════════════════════════════╗ ╔════════════════════════╗ │
│  │  ║  ESTATE POSITION (from T&E)    ║ ║  DATA CONFIDENCE       ║ │
│  │  ╚═════════════════════════════════╝ ╚════════════════════════╝ │
│  │                                                                  │
└──┴──────────────────────────────────────────────────────────────────┘
```

Triple anchor + breadcrumb + sidebar persist across L1 → L2 → L3 → L4 → L5+. The L3 content area replaces, never overlays. L4 number drill replaces the L3 content area with breadcrumb growing "Money › Pensions › AA carry-forward". Same for L4 chart drill.

### 2.4 Drillability (locked: Option B — full L4 panels)

Three patterns under one principle (PP-3 + PP-2):

1. **Default surface = simple.** L3 shows the answer ("£18,750 of £60,000 used"). Sub-text in plain English ("£41,250 left this year + £142,000 unused from earlier years"). One sentence per concept.

2. **Drillable cue = visual.** Every drillable number gets a dotted-underline. Every drillable chart gets a dotted-edge hint. User knows what's tap-targetable.

3. **L4 = full panel, breadcrumb grows.** Tap a drillable number → L4 panel replaces L3 content. Same for charts. Breadcrumb chain grows. Back button traverses up.

Same primitive (`<L4NumberPanel>`) handles all ~160 number drills:
- Section 1: Big restated number + plain-English explanation
- Section 2: Formula breakdown (auto-rendered from engine output)
- Section 3: Source provenance (where the data came from, when, confidence)
- Section 4: Visual breakdown (chart of the calculation, e.g. AA used per year)
- Section 5: Action chips (X24 mode 2 — "top up", "edit", "review")
- Section 6: "What-if this were different?" affordance (X24 mode 3)

### 2.5 Plain English (PP-9, strictly enforced)

| Statutory | Plain English (primary) |
|---|---|
| AA / Annual Allowance | Pension contribution limit |
| Tapered AA | Reduced contribution limit |
| Carry-forward | Unused allowance from earlier years |
| LSA / PCLS | Tax-free cash |
| MPAA | Reduced pension limit (after first withdrawal) |
| OCF | Fund charges |
| IT / CGT / IHT | Income tax / Capital gains tax / Inheritance tax |
| RNRB / NRB | Residence allowance / Estate allowance |
| BPR / BADR | Business relief / Business sale relief |
| S24 | Mortgage interest restriction |
| ANI | Adjusted income |
| LPA | Power of attorney |
| X28 (4-mode) | Time view: Today · Forecast · Plan · What-if |
| FAD / UFPLS | Pension withdrawal methods |
| Scenario | What-if |
| Actual | Today |

Statutory shown in parens **only on first occurrence per panel**. After that, plain English only. Source-of-truth file: `src/copy/plain-english.js`. Grep audit before ship: zero raw statutory codes outside that file.

---

## §3 — Domain → Panel mapping (19 L3 panels)

| # | Spec Domain | L3 Panel | Status |
|---|---|---|---|
| 1 | A · Pension wrappers (SIPP / DC / DB / state pension) | `PensionL3` | Refactor existing PensionDrillDown onto primitive |
| 2 | B · Pension access (FAD / UFPLS / annuity) | (nested inside #1 per spec §5.1) | Lives as middle section in PensionL3 |
| 3 | C · ISA wrappers | `ISAL3` | NEW (split from existing InvestmentsDrillDown) |
| 4 | D · GIA / brokerage | `GIAL3` | NEW (split from InvestmentsDrillDown) |
| 5 | E · EIS / SEIS / VCT | `TaxAdvantagedL3` | NEW (split from InvestmentsDrillDown) |
| 6 | F · Investment bonds (onshore / offshore) | `BondsL3` | NEW (split from InvestmentsDrillDown) |
| 7 | G · Property (residence / BTL) | `PropertyL3` | Refactor existing PropertyDrillDown onto primitive |
| 8 | H · Business assets (BPR / APR / BADR) | `BusinessL3` | Refactor BusinessDrillDown onto primitive |
| 9 | I · Employee share schemes (EMI / SAYE / RSU) | `ShareSchemesL3` | NEW (split from BusinessDrillDown if currently bundled) |
| 10 | J · Personal protection (life / CI / IP / in-trust) | `ProtectionL3` | Refactor ProtectionDrillDown onto primitive |
| 11 | K · General insurance | `GeneralInsuranceL3` | NEW (split from ProtectionDrillDown if currently bundled) |
| 12 | L · Business insurance | `BusinessInsuranceL3` | NEW (split from ProtectionDrillDown if currently bundled) |
| 13 | M · Cash & savings | `CashL3` | NEW |
| 14 | N · Liabilities (mortgage / loan / card) | `LiabilitiesL3` | Refactor existing LiabilitiesDrillDown onto primitive |
| 15 | O · Income streams | `IncomeL3` | NEW |
| 16 | U · Alternatives (crypto / gold / art / PE) | `AlternativesL3` | NEW |
| 17 | V · Family obligations | `FamilyObligationsL3` | NEW |
| 18 | W · State benefits | `StateBenefitsL3` | NEW |
| 19 | X · Director / Ltd company | `DirectorL3` | NEW |

**Net:** 19 L3 panels. 5 existing panels refactor onto primitive (Pension, Property, Business, Protection, Liabilities). 14 new builds. InvestmentsDrillDown is decomposed into 4 panels (ISA, GIA, TaxAdvantaged, Bonds).

---

## §4 — File structure

### 4.1 New shared primitives

```
src/components/MyMoney/L3/
  L3Panel.jsx                  ← THE primitive — slot architecture
  L4NumberPanel.jsx            ← Drill-down panel for any number
  DrillableNumber.jsx          ← Wrapper that opens L4NumberPanel on tap
  DrillableChart.jsx           ← Chart wrapper that opens L4ChartPanel
  L4ChartPanel.jsx             ← Drill-down panel for any chart
  L3Sections/
    HeroSection.jsx            ← Fixed top — big number + sparkline
    TaxTreatmentSection.jsx    ← Fixed top — IT/CGT/IHT 3-row
    EstatePositionSection.jsx  ← Fixed bottom — IHT chip from T&E
    DataConfidenceSection.jsx  ← Fixed bottom — FP-4 bar
```

### 4.2 Per-domain L3 modules (19 files, thin)

```
src/components/MyMoney/L3/domains/
  PensionL3.jsx                ← Imports L3Panel, declares middle sections
  ISAL3.jsx
  GIAL3.jsx
  TaxAdvantagedL3.jsx
  BondsL3.jsx
  PropertyL3.jsx
  BusinessL3.jsx
  ShareSchemesL3.jsx
  ProtectionL3.jsx
  GeneralInsuranceL3.jsx
  BusinessInsuranceL3.jsx
  CashL3.jsx
  LiabilitiesL3.jsx
  IncomeL3.jsx
  AlternativesL3.jsx
  FamilyObligationsL3.jsx
  StateBenefitsL3.jsx
  DirectorL3.jsx
```

Each module ~100-200 lines. Imports `<L3Panel>` and declares its middle sections.

### 4.3 Per-domain middle section modules (~50 total)

```
src/components/MyMoney/L3/sections/
  AAPositionSection.jsx         ← Used by PensionL3
  LSASection.jsx                ← Used by PensionL3
  FundChargesSection.jsx        ← Used by PensionL3, ISAL3, GIAL3
  ContributionsSection.jsx      ← Used by PensionL3, ISAL3
  ISAAllowanceSection.jsx       ← Used by ISAL3
  CGTPositionSection.jsx        ← Used by GIAL3, BondsL3, PropertyL3
  ReliefHorizonSection.jsx      ← Used by TaxAdvantagedL3
  Bond5pctSection.jsx           ← Used by BondsL3
  PerPropertySection.jsx        ← Used by PropertyL3
  RentalPnLSection.jsx          ← Used by PropertyL3
  S24Section.jsx                ← Used by PropertyL3
  MortgageProfileSection.jsx    ← Used by PropertyL3, LiabilitiesL3
  BPRPositionSection.jsx        ← Used by BusinessL3
  ShareholdingSection.jsx       ← Used by BusinessL3
  VestingSection.jsx            ← Used by ShareSchemesL3
  PerPolicySection.jsx          ← Used by ProtectionL3, GeneralInsuranceL3
  ProtectionGapSection.jsx      ← Used by ProtectionL3
  PerAccountSection.jsx         ← Used by CashL3
  InterestRateReviewSection.jsx ← Used by CashL3
  LiquidityBandSection.jsx      ← Used by CashL3
  PerLoanSection.jsx            ← Used by LiabilitiesL3
  IncomeBreakdownSection.jsx    ← Used by IncomeL3
  TaxBandPositionSection.jsx    ← Used by IncomeL3
  StatePensionForecastSection.jsx ← Used by StateBenefitsL3
  CompanyDashboardSection.jsx   ← Used by DirectorL3
  ANISection.jsx                ← Used by DirectorL3
  DirectorRemixSection.jsx      ← Used by DirectorL3
  ... (~25 more)
```

Sections are pure components that take `{ entity, taxYearState, ripple }` and render. Reuse aggressively — `CGTPositionSection` is the same code on GIA, Bonds, Property.

### 4.4 Engine additions

```
src/engine/
  time-series.js               ← E1 — getTimeSeries(entity, metric, window, granularity)
  events-fold.js               ← C2 — ASSET_VALUE_UPDATED reducer
  iht-cross-tab.js             ← C3 — read T&E entity output, emit per-asset chips
  ripple.js                    ← Already exists (Phase 2c) — extend with MyMoney scope
```

### 4.5 Plain English

```
src/copy/
  plain-english.js             ← Single source of truth — statutory → plain
```

---

## §5 — Engine wiring

### 5.1 E1 — `getTimeSeries`

```js
/**
 * Returns time-series data for any metric, scoped to a time window.
 * Powers every sparkline + every L4 chart drill.
 *
 * @param {object} entity
 * @param {string} metric          — 'pension_value', 'isa_value', 'iht_exposure', 'net_worth', etc.
 * @param {string} window          — '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y' | 'All' | {from, to}
 * @param {string} granularity     — 'day' | 'week' | 'month' | 'quarter' | 'year'
 * @returns {object} {
 *   points: [{ date, value, contribution?, withdrawal?, event? }],
 *   window,
 *   granularity,
 *   confidence: 'high' | 'medium' | 'low',
 *   dataStartDate,
 *   dataEndDate,
 *   gaps: [{ from, to, reason }]
 * }
 */
export function getTimeSeries(entity, metric, window, granularity = 'month') { … }
```

Reads from `entity.trajectories.*` first (per Phase 2 Batch A), falls through to `trajectorySeeder` for personas without trajectory data. Data honesty (PP-7): if window exceeds available data, returns the available portion + gaps array. Never synthesises. `DrillableChart` renders gaps as visible discontinuities (greyed band) with a tooltip explaining each gap's reason.

### 5.2 F4 — `useRipple` migration

Current state: MyMoney.jsx and ~80% of its children import directly from `fq-calculator.js`. This violates PP-5 (single ripple path) and means cross-tab ripple doesn't fire when MyMoney mutates entity.

Migration:
1. Replace direct `calcFQ` / `calcRisk` / `netWorth` / `monthlySurplus` calls with `const ripple = useRipple(entity, ['balance_sheet','scores','tax','cashflow','iht'])`
2. Replace direct `import { TAX }` with `useRipple` access where applicable
3. Verify ripple_contract.mjs regression still passes after migration

### 5.3 C3 — IHT cross-tab chips

```js
/**
 * Returns per-asset IHT chips that MyMoney tiles render alongside the asset.
 * Cross-tab read: source of truth is T&E entity output.
 *
 * @param {object} entity
 * @param {object} ripple   — output of rippleEffect, already computed
 * @returns {Map<assetId, {position, daysToActivation, exposure, action}>}
 */
export function ihtChipsForMyMoney(entity, ripple) { … }
```

Activates Estate section of every L3. For SIPP: "£205k enters your estate Apr 2027". For BTL property: "£198k exposure if no relief planning". For BPR-qualifying business: "£0 IHT — qualifies for business relief from 2024-04".

### 5.4 C2 — Events fold reducer

```js
/**
 * Reduces ASSET_VALUE_UPDATED + related envelopes into entity diff.
 * Wired into the existing EventsProvider applyEvents() chain.
 *
 * Supported envelope types:
 *   ASSET_VALUE_UPDATED  → mutates entity.assets.[path].value
 *   ASSET_ADDED          → appends to entity.assets.[domain]
 *   ASSET_REMOVED        → tombstones entity.assets.[id] (soft delete)
 *   ASSET_RENAMED        → mutates entity.assets.[id].name
 *
 * Returns a NEW entity object (immutable per PP-6).
 */
export function foldAssetEvent(entity, envelope) { … }
```

Enables L4 edit affordances. Without this, AddItemSheet writes hit the event store but don't fold back into the entity that MyMoney reads — looks like edits "disappear".

---

## §6 — Build sequence (7 waves)

```
Wave 0  ─ Engine prereqs                              (1-2 weeks)
            • E1 — getTimeSeries primitive + engine function
            • F4 — useRipple migration of MyMoney
            • Refactor existing 6 panels onto useRipple
            • plain-english.js scaffold + audit infrastructure

Wave 1  ─ L3 batch 1 — Investing wrappers + Cash      (~1 week)
            • L3Panel + L4NumberPanel + DrillableNumber primitives
            • ISA L3, GIA L3, TaxAdvantaged L3, Bonds L3 (split from existing)
            • Cash L3 (new build)
            • Sections: AAPosition, CGTPosition, ISAAllowance, FundCharges,
              Bond5pct, ReliefHorizon (typo fix), PerAccount, LiquidityBand

Wave 0.5 ─ C3 — IHT cross-tab chips                    (3-5 days)
            • ihtChipsForMyMoney engine function
            • Estate section activates on SIPP/Property/Business tiles
            • Existing L1 tiles get inline IHT chip if applicable

Wave 2  ─ L3 batch 2 — Income/State/Director/Business (~1 week)
            • Income L3, State Benefits L3, Director Co L3
            • Business assets L3 + Share schemes L3 (split if bundled)
            • Property L3 refactor for multi-property support
            • Sections: IncomeBreakdown, TaxBandPosition, StatePensionForecast,
              CompanyDashboard, ANI, BPRPosition, Shareholding, Vesting

Wave 0.75 ─ C2 — Events fold reducer                   (3-5 days)
            • foldAssetEvent + 4 envelope types
            • Wire into EventsProvider applyEvents chain
            • L4 edit affordances unlock

Wave 3  ─ L3 batch 3 — Protection/Alts/Family + refactors (~1 week)
            • Protection L3 (split from current)
            • General Insurance L3 + Business Insurance L3
            • Alternatives L3, Family Obligations L3
            • Pension L3 refactor onto new primitive
            • Liabilities L3 refactor onto new primitive
            • Sections: PerPolicy, ProtectionGap, PerAsset, Dependant, PerLoan

Wave 4  ─ L4 chart drill panels                        (~1 week)
            • DrillableChart primitive
            • L4ChartPanel with full controls
            • Wire ~30 charts across MyMoney
            • Retroactively wire Home Score Journey, Risk radar, Cashflow charts

Wave 5  ─ Cross-cutting polish                         (~3-5 days)
            • A2 — daily NW cause-chain
            • A3 — rules version label (UK-2026.1.1)
            • PP-3 audit — every number wrapped in DrillableNumber
            • PP-9 audit — grep zero raw statutory codes outside plain-english.js
            • B3 X24 mode-3 "I want this different" affordance audit
            • B4 X29 visual-diff contract

Wave 6  ─ /impeccable audit + sonus-financial-analyst  (~3 days)
            • a11y, broken routes, contrast, tap targets, console errors
            • IFA + tax + FCA pass against UK-2026.1.1

Wave 7  ─ Snap × inspect (final gate)                  (~1-2 days)
            • 1440×900 + 1920×1080 × dark + light × every L3 panel
            • Click every CTA, verify destination renders
            • Confirm Mr T renders all 19 domains with depth
            • Declare done only when audit-clean
```

**Total estimate:** 5-7 weeks of focused work (Opus 4.7, single agent, autonomous). Founder direction: "do it properly, not concerned with time."

---

## §7 — Cross-tab dependencies (§Q1.2 compliance)

MyMoney is canonical home for:

| Output | Consumers |
|---|---|
| Asset values + wrapper types | T&E (for IHT/CGT computation) |
| Income streams (Domain O) | Cashflow (essentials + discretionary) |
| Protection premiums (Domain J/K/L) | Cashflow (committed outflows) |
| Concentration / protection gaps / income resilience | Risk (D-dim feeds) |
| Canonical Net Worth | Home (anchor) |

MyMoney reads from:

| Input | Owner |
|---|---|
| Domain P expenditure total | Cashflow (essentials + discretionary aggregated) |
| IHT position chips (per asset) | T&E (via C3 engine function) |
| Drawdown framework teaser | Cashflow (existing) |

**Verification:** every commit during waves runs ripple_contract.mjs (regression). After each wave, manually verify other tabs still render without error.

---

## §8 — Mr T validation contract

Mr T (persona at `src/rules/personas/mrT-core.json`, fixture_version 2.0) is verified all-domain. Every L3 panel must render with real data when `?demo=mrt&tab=money` is loaded.

**Specific Mr T data expectations per domain:**

| Domain | Mr T data present | Must render |
|---|---|---|
| A Pension | 4 DC wrappers + 1 DB + 1 SSAS with loan-to-company | All 5 wrappers in PerWrapper section, AA usage £18,750/£60k, LSA £0/£268k, 4 nominations |
| B Pension access | Nested in A — no separate panel | "In payment" section is empty for Mr T (accumulation stage) |
| C ISA | Vanguard S&S £38,400 + Barclays Cash £8,200 | Both wrappers, allowance £10,500/£20k used |
| D GIA | Interactive Investor £24,800, embedded gain £5,400 | Holdings + CGT position with embedded gain |
| E EIS/SEIS/VCT | Octopus EIS £15k + SyndicateRoom SEIS £8k + Octopus VCT £12.5k | All 3 with relief schedule, holding period clocks |
| F Bonds | Pru Onshore £22k (40% 5% used) + Quilter Offshore £18.5k (20% 5% used) | Both, with 5% withdrawal allowance state |
| G Property | Residence £385k + BTL Manchester £198k (S24-restricted) | Per-property cards, rental P&L, S24 position |
| H Business | Synthetic Tech equity £145k (BPR + BADR qualifying) | BPR position, BADR eligibility |
| I Share schemes | EMI £18k (8k vested + 12k unvested) | Vesting schedule |
| J Protection | Life £350k (in trust) + CI £150k + IP £3.25k/mo + Relevant Life £400k + Key Person £250k | All 5 policies + gap analysis |
| K General insurance | **Empty in v2.0 fixture (gap)** — Home + Motor + Travel should be added before Wave 3 (per W0-T2 finding 2026-05-25) | Wave 3 builds the panel; fixture gap accepted as Wave 0 baseline. K panel renders "no insurance recorded" until fixture populated. |
| L Business insurance | **Empty in v2.0 fixture (gap)** — PI £1m + Cyber £250k should be added before Wave 3 (per W0-T2 finding 2026-05-25) | Wave 3 builds the panel; fixture gap accepted as Wave 0 baseline. L panel renders "no insurance recorded" until fixture populated. |
| M Cash | Monzo £6.2k + Chase £14.8k + Marcus £7.5k | All 3 accounts, blended rate, 5mo essentials |
| N Liabilities | Residence mortgage £215k + BTL mortgage £124k + student loan £15.8k + Amex £1.85k | All 4 |
| O Income | Director salary £12,570 + dividends £38k + rental £15k + interest £1.85k | All 4 streams + tax band position |
| U Alternatives | Wine collection £8.4k + ETH £5,160 + BTC £4,080 + PE fund £10k | All 4 |
| V Family obligations | Parent care £6k/yr | 1 obligation |
| W State benefits | State pension forecast £11,502 from age 67 | NI qualifying years 13, forecast |
| X Director | Synthetic Tech Ltd (sole director, 100% shareholding, turnover £220k) | Company dashboard + ANI position |

If any domain renders blank or partial against Mr T after its wave ships, the wave doesn't pass.

**Headline Mr T numbers (2026/27, UK-2026.1.1 bundle, verified W0-T2 2026-05-25):**

| Metric | Actual value | Notes |
|---|---|---|
| Net Worth | **£727k** | Was estimated £484k pre-v2.0 fixture rewrite — design doc captured stale numbers, now corrected |
| Wealth Score | **70 (Optimised)** | Was estimated 64 |
| Risk Score | **74 (Protected)** | Was estimated 65 |
| IHT exposure | **£113k** | Was estimated £0-8k. Mr T is single director with no direct descendants → RNRB unavailable, estate £782,800 vs £325k NRB. Correct fixture behaviour. |
| Monthly surplus | **deficit £552** | Cashflow is tight despite high asset values |
| Effective tax rate | **19.1%** | – |
| Funded ratio | **0.30** | Significantly under-funded vs target |

**Known summariser anomalies (pre-existing, must be preserved through Wave 0 F4 regression diff — fix in Wave 5 or later):**

1. Pension double-count in `balance_sheet.categories.pensions`
2. EIS/SEIS/VCT not aggregated into `balance_sheet.categories` (visible in netWorth but not in summariser buckets)
3. Bonds (onshore + offshore) same — visible in netWorth, missing from summariser
4. Alternatives (crypto + PE + wine) same
5. Business value missing from `balance_sheet.categories.business`
6. BTL mortgage + student loan + credit card missing from `balance_sheet.categories.liabilities` summary
7. Cash may under-report (one of the bank accounts not aggregated)

`netWorth()` is correct (£727k); `balance_sheet.categories` is lossy by ~£236k. Fix in a later wave to keep F4 attribution clean.

---

## §9 — Verification + acceptance gates

**Per-wave exit criteria:**

| Wave | Exit criteria |
|---|---|
| 0 | `getTimeSeries` returns valid data for every metric on Mr T. ripple_contract.mjs passes. All 6 existing panels render unchanged after F4 migration. |
| 1 | ISA / GIA / TaxAdvantaged / Bonds / Cash L3 panels render for Mr T. L4 number drill works on 3+ numbers per panel. Plain-english.js audit clean for these panels. |
| 0.5 | IHT chip renders on Mr T's SIPP (£205k), BTL (£198k), Business equity (£0 due to BPR). Estate section of all 5 Wave 1 panels now populated. |
| 2 | Income / State / Director / Business / Share schemes / Property L3 render for Mr T. Director Co dashboard shows £220k turnover. Property L3 shows both Residence + BTL with S24 chip. |
| 0.75 | AddItemSheet write persists through to MyMoney render (test: add £5k to GIA, observe value update on tile and L3). |
| 3 | Protection / Personal protection / General / Business insurance / Alternatives / Family / Pension refactor / Liabilities refactor all render for Mr T. All 19 panels live. |
| 4 | DrillableChart works on every chart in MyMoney + Home Score Journey + Risk radar trajectory. 5Y view available on Pension value. |
| 5 | PP-3 audit: every number wrapped in DrillableNumber. PP-9 audit: zero raw statutory codes outside plain-english.js. |
| 6 | /impeccable audit: 0 console errors, 0 broken routes, 100% WCAG AA contrast, all tap targets ≥44px. sonus-financial-analyst: 0 RATE MISMATCH findings against UK-2026.1.1. |
| 7 | Snap clean × 2 viewports × 2 themes × 19 panels = 76 snaps. Every CTA tap verified to non-blank destination. Mr T renders all 19 domains. |

**Master "done" gate:** Wave 7 clean + founder signs off after spending 30 minutes clicking around at 1440×900.

---

## §10 — Out of scope (this phase)

- Mobile reflow (< 768px viewport) — deferred to cross-tab mobile phase later
- iPad reflow (768-1023px) — same
- L5+ deeper drill — L4 is the depth ceiling this phase (we can extend later if spec demands)
- New asset capture forms per domain (§X.6) — generic AddItemSheet stays as-is for this phase; per-domain forms are nice-to-have not blocker
- Other tabs (Cashflow / T&E / Risk / Timeline / Home rebuild) — separate phases after this one
- Voyant-style CRUD (edit/delete per row inline) — L4 edit pattern covers this when Wave 0.75 lands
- AI-ranked goal-seek (G8) — deferred per dynamic-crunching-wall §3

---

## §11 — Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| F4 ripple migration breaks existing panels | Medium | Migrate one at a time; ripple_contract.mjs runs after each. |
| Mr T data gaps for some domain | Low (verified comprehensive) | Add data to fixture before wave that needs it. |
| L3Panel primitive can't accommodate Property's 5 middle sections | Low | Slot array is variable; tested with Property as a Wave 2 stress test. |
| Plain-English audit finds 100+ violations across existing code | High | Don't ship Wave 0 until alias map is in place and existing 6 panels are migrated. |
| C3 IHT chips reveal T&E engine bugs | Medium | Treat T&E bugs as P0 — fix inline. Cross-tab promise is a foundational principle. |
| Chart drill primitive gets overloaded with options | Medium | Lock the 4 control groups in §2.4. No more added without founder sign-off. |
| Cross-tab regression in other 5 tabs after F4 | Medium | Snap-test other tabs after Wave 0 + after each subsequent wave. |
| Engine hours blow scope | High (founder explicit: not concerned about time) | Founder direction stands. Don't compromise primitives to save days. |

---

## §12 — Open questions (none blocking)

All 5 brainstorming-phase questions resolved. The questions that emerge from build (per-domain spec interpretation edge cases) get raised inline during each wave.

---

## §13 — Decision audit trail

| Date | Decision | Source |
|---|---|---|
| 2026-05-25 | Phase scope = MyMoney rebuild before any other tab | Founder direction post-Phase 2 |
| 2026-05-25 | Mr T as validation fixture, all 20 domains | Founder Q1 answer |
| 2026-05-25 | Engine work in scope | Founder Q2 answer |
| 2026-05-25 | Desktop first, mobile separate phase | Founder Q3 answer |
| 2026-05-25 | C-prime hybrid slot architecture | Founder approval Q1 |
| 2026-05-25 | Option 1 strict 1-to-1 panel mapping | Founder pick Q2 (testing-first principle) |
| 2026-05-25 | Option C — full-screen replace with pinned anchors | Claude decided after founder said "you decide between B and C" Q3 |
| 2026-05-25 | Option B — full L4 panel for every drillable number | Founder pick Q4 |
| 2026-05-25 | PP-9 strict — plain English everywhere, statutory in parens only on first occurrence per panel | Founder catch + agreement Q4 |
| 2026-05-25 | DrillableChart primitive with time-window + comparison + annotations on every chart, every screen | Founder proposal Q4-extension |
| 2026-05-25 | Option C — hybrid engine sequencing | Founder pick Q5 |

---

## Appendix A — File-create checklist

For writing-plans skill to reference.

### A.1 New shared primitives (Wave 0-1)
- `src/components/MyMoney/L3/L3Panel.jsx`
- `src/components/MyMoney/L3/L4NumberPanel.jsx`
- `src/components/MyMoney/L3/DrillableNumber.jsx`
- `src/components/MyMoney/L3/DrillableChart.jsx`
- `src/components/MyMoney/L3/L4ChartPanel.jsx`
- `src/components/MyMoney/L3/L3Sections/HeroSection.jsx`
- `src/components/MyMoney/L3/L3Sections/TaxTreatmentSection.jsx`
- `src/components/MyMoney/L3/L3Sections/EstatePositionSection.jsx`
- `src/components/MyMoney/L3/L3Sections/DataConfidenceSection.jsx`
- `src/copy/plain-english.js`
- `src/engine/time-series.js`
- `src/engine/events-fold.js`
- `src/engine/iht-cross-tab.js`

### A.2 Per-domain L3 modules (19 files)
See §4.2.

### A.3 Per-domain middle sections (~25 files)
See §4.3.

### A.4 Files to refactor onto primitive (Wave 0)
- `src/components/MyMoney/PensionDrillDown.jsx`
- `src/components/MyMoney/PropertyDrillDown.jsx`
- `src/components/MyMoney/BusinessDrillDown.jsx`
- `src/components/MyMoney/ProtectionDrillDown.jsx`
- `src/components/MyMoney/LiabilitiesDrillDown.jsx`
- `src/components/MyMoney/InvestmentsDrillDown.jsx` (deprecate after split)

### A.5 Engine extensions
See §5.

---

*End of design doc.*
