# CAELIXA SCREEN CONTRACTS — DESIGN LOCK DOCUMENT

**Generated:** 2 May 2026
**Purpose:** Define every screen's cards, graphs, data sources, and user journeys BEFORE build
**Workflow:** Founder approves each screen contract → Claude builds all screens → DeepSeek tests

---

## APPROVAL STATUS

| Screen | Contract Status | Founder Approval | Build Status |
|--------|----------------|------------------|--------------|
| Home | DRAFT | PENDING | NOT STARTED |
| MyMoney | DRAFT | PENDING | NOT STARTED |
| Cashflow | DRAFT | PENDING | NOT STARTED |
| Tax & Estate | DRAFT | PENDING | NOT STARTED |
| Timeline | DRAFT | PENDING | NOT STARTED |
| Risk (overlay) | DRAFT | PENDING | NOT STARTED |
| Settings | DRAFT | PENDING | NOT STARTED |
| Auth/Security | DRAFT | PENDING | NOT STARTED |
| Onboarding | DRAFT | PENDING | NOT STARTED |
| Ask | DRAFT | PENDING | NOT STARTED |

---

## DESIGN CHALLENGES (Per CLAUDE.md — 3 weakest decisions per screen)

Will be populated during Design Review Sprint after contract approval.

---

# 1. HOME SCREEN (HomeV2.jsx)

## 1.1 Purpose
Answer in 60 seconds:
1. "Did my Score move since I last looked?" (0-10s)
2. "What has actually changed?" (10-25s)
3. "What is the cost of doing nothing?" (25-40s)
4. "What should I do today?" (40-60s)

## 1.2 Screen Zones (13 zones, top to bottom)

| Zone | Name | Cards | Data Source |
|------|------|-------|-------------|
| 1 | Triple-Anchor | Net Worth tile, Caelixa Wealth Score tile, Risk Score tile | `calcNetWorth()`, `calcFQ()`, `calcRisk()` |
| 2 | Daily Delta Strip | Biggest mover card, Biggest event card, Most urgent change card | `computeSinceLastVisit()` |
| 3 | CoI Odometer | Live ticking £/day + 4 action path mini-cards | `costOfInaction()` |
| 4 | State Tiles | Safety Net, Debt Free, FI, Beneficiary (horizontal strip) | `safetyNetState()`, `debtFreeState()`, `fiState()`, `beneficiaryState()` |
| 5 | Score Journey | 4 bars (today, +1 action, +6mo, +all) + 12mo history line | `whatActionWouldItTake()`, `calcScoreHistory()` |
| 6 | Composite Trajectory | 4-layer chart (your line, cohort median, projected fan, scenarios) | `compositeTrajectory()` |
| 7 | Composition Treemap | Asset/liability proportions | `calcNetWorth()` breakdown |
| 8 | Cohort Journey | Rank heat-strip + peer comparison | `cohortRankHistory()` |
| 9 | Reality Engine | 3 concentric rings (Personal, System, External) | `realityEngineState()` |
| 10 | PRC/PCC Spread | Micro spread bar (capital efficiency) | `prcPccCurrent()` |
| 11 | Calendar + Decision Peek | Upcoming deadlines, last committed decision | `calcAPQTimeline()` |
| 12 | Priority Actions + AI | Top-3 APQ items + AI weekly narrative | `calcAPQ()` |
| 13 | Not Tracked Yet | Missing data prompts | entity gaps analysis |

## 1.3 Charts

| Chart | Type | Interactive? | Drill Target |
|-------|------|--------------|--------------|
| Triple-anchor delta sparks | Spark lines | Tap → drill | FQBreakdown / Risk overlay / MyMoney |
| CoI odometer | Live counter | Tap path → Take Action | Take Action explorer |
| State tile progress bars | Horizontal bars | Tap → MyMoney drill | MyMoney §16 |
| Score journey bars | Bar chart + line | Drag → recompute | Live simulation |
| Composite trajectory | Multi-layer line | Tap → event at date | Timeline |
| Composition treemap | Treemap | Tap tile → category | MyMoney drill |
| Cohort heat-strip | Heat map | Tap cell → month detail | N/A |
| Reality Engine rings | Concentric circles | Tap ring → factor list | Factor explanation |
| PRC/PCC bar | Horizontal bar | Tap → Cashflow §7 | Cashflow PRC/PCC |

## 1.4 User Journeys

1. **Score check flow:** Land → Triple-anchor (5s) → Daily delta (10s) → Done
2. **Action flow:** Land → CoI odometer → Tap path → Take Action commit
3. **Deep dive flow:** Land → Score journey → Drag bars → Simulate → Commit
4. **State check flow:** Land → State tiles → Tap tile → View journey → Set target

## 1.5 Empty States

| Scenario | Behavior |
|----------|----------|
| New user (no data) | Show onboarding CTA, greyed zones |
| Partial data | Show hatched confidence, "Improve accuracy" prompts |
| Stale data (>30 days) | Show "(stale)" labels, refresh CTAs |

---

# 2. MYMONEY SCREEN (MyMoney.jsx)

## 2.1 Purpose
Personal balance sheet — answer in 30 seconds:
1. "What do I own, and what do I owe, right now?"
2. "What is each asset doing for me?"
3. "Am I making progress on my goals?"
4. "What am I leaving on the table by not acting?"

## 2.2 Screen Structure (top to bottom)

| Section | Cards | Data Source |
|---------|-------|-------------|
| Rules version label | UK-2026.1 chip | bundle version |
| Triple-anchor | NW, FQ, RS tiles | engine |
| Assets/Liabilities row | Thin summary row | `calcNetWorth()` |
| Asset composition strip | Proportional bar + legend | asset breakdown |
| Asset categories list | Pensions, Property, ISAs, Portfolio, Cash, Other | per-category engine functions |
| Liabilities list | Mortgages, Loans, Credit | debt breakdown |
| Income section | Present sources only | entity.income |
| Cashflow Health strip | Safe withdrawal, current drawdown, cash runway | `monthlyFlow()`, `calcRisk().liquidity_buffer` |
| State tiles | Safety Net, Debt Free, FI, Beneficiary | state-tiles-engine |
| CoI strip | £/day odometer | `costOfInaction()` |
| Jurisdictional sections | NRI assets, Thai assets, Overseas property (conditional) | entity.jurisdictions |
| Disclaimer | FCA text + rules version | config |
| Global "+" button | Fixed lower-right | N/A |

## 2.3 Charts

| Chart | Type | Purpose |
|-------|------|---------|
| Composition strip | Proportional bar | Asset allocation at a glance |
| Category sparklines | Mini line charts | 3-month trend per category |
| State tile progress | Horizontal progress bars | Goal progress |
| Cashflow health bars | Triple horizontal bars | Allocation pressure |

## 2.4 Drill-Down Overlays

| Drill | Trigger | Content |
|-------|---------|---------|
| Pension detail | Tap pension row | SIPP/workplace breakdown, drawdown simulator |
| Property detail | Tap property row | Equity, rental yield, LTV |
| Debt detail | Tap debt row | Payment schedule, payoff scenarios |
| ISA detail | Tap ISA row | Contribution tracker, wrapper splits |
| Cash detail | Tap cash row | Account breakdown, interest comparison |

## 2.5 User Journeys

1. **Balance check:** Land → NW tile (3s) → Asset composition (5s) → Done
2. **Add asset:** Land → "+" button → Type picker → Form → Verify → Save
3. **Deep dive:** Land → Tap category → Drill overlay → Simulate → Take Action
4. **Goal check:** Land → State tiles → Tap tile → Journey view

---

# 3. CASHFLOW SCREEN (Cashflow.jsx) — NEW BUILD REQUIRED

## 3.1 Purpose
Sustainability over time — answer in 35 seconds:
1. "How am I doing right now?" (5s)
2. "What did I earn vs spend this month?" (10s)
3. "Will my plan last?" (15s)
4. "What's the cost of doing nothing?" (5s)

## 3.2 Three Sections

### Section A — NOW (7 elements)

| Element | Type | Data Source |
|---------|------|-------------|
| Cashflow waterfall | Stacked bar | `monthlyFlow()` |
| E/D split tile | Ratio display | entity.expenses categorization |
| Expense categories list | Card list with sparklines | entity.expenses |
| Bill calendar | 30-day calendar view | entity.bills |
| Subscription tracker | List with cancel CTAs | entity.subscriptions |
| Surplus allocator | Interactive allocation UI | surplus from monthlyFlow |
| Liquidity Buffer card | Months-bar visual | `calcRisk().liquidity_buffer` |

### Section B — TRAJECTORY (8 elements)

| Element | Type | Data Source |
|---------|------|-------------|
| Sticky controls | Horizon/target/CMA pickers | user preferences |
| SWR regime picker | Toggle (4%/VPW/G-K) | `swrRegime()` |
| Funded-ratio gauge | Circular gauge | `fundedRatio()` |
| PoS headline | Large % number | `probabilityOfSuccess()` |
| Monte Carlo fan | Fan chart | `fiveCashflowScenarios()` |
| Sequence-of-returns stress | Risk indicator | `sequenceOfReturnsVulnerability()` |
| Guyton-Klinger corridor | Corridor chart | `guytonKlinger()` |
| 5 cashflow scenarios | Scenario cards | `fiveCashflowScenarios()` |

### Section C — DEPTH (7 elements)

| Element | Type | Data Source |
|---------|------|-------------|
| CoI sticky headline | Live counter | `costOfInaction()` |
| PRC/PCC spread | Bar chart | `prcPccSpread()` |
| Reality Engine | 3-ring display | `realityEngineFactorisation()` |
| Max-drawdown tolerance | Comparison visual | entity.riskTolerance |
| Efficient frontier | Scatter plot | `portfolioEfficiency()` |
| FI progress | Progress tile | `fiState()` |
| Confidence summary | Table | computed confidence |

## 3.3 User Journeys

1. **Monthly check:** Land → Waterfall (5s) → E/D split (3s) → Done
2. **Retirement planning:** Land → Section B → Funded ratio → PoS → Scenarios
3. **Cost discovery:** Land → Section C → PRC/PCC → Reality Engine → Actions

---

# 4. TAX & ESTATE SCREEN (TaxEstate.jsx)

## 4.1 Purpose
Tax optimization and estate planning — two sub-tabs

## 4.2 TAX SUB-TAB (10 elements)

| Rank | Element | Data Source |
|------|---------|-------------|
| 1 | Tax Year Header (days remaining) | bundle.taxYear |
| 2 | This-year summary | `taxThisYear()` |
| 3 | Income tax detail | `incomeTaxDetail()` |
| 4 | NICs detail | `nicsDetail()` |
| 5 | CGT detail | `cgtDetail()` |
| 6 | Dividend tax | `dividendTaxDetail()` |
| 7 | Allowances strip | `allowanceTracker()` |
| 8 | Drag tracker | `taxDrag()` |
| 9 | Drawdown matrix | `drawdownMatrix()` |
| 10 | Self Assessment | `selfAssessment()` |

## 4.3 ESTATE SUB-TAB (10 elements)

| Rank | Element | Data Source |
|------|---------|-------------|
| 1 | CoI headline (sticky) | `costOfInaction()` |
| 2 | IHT exposure summary | `ihtExposure()` |
| 3 | IHT waterfall (multi-slider) | `ihtWaterfall()` |
| 4 | Gift clock | `giftClockProjection()` |
| 5 | Trusts | `trustPeriodicCharge()`, `trustContribution()` |
| 6 | Nominations | `nominationStatus()` |
| 7 | Will & LPA | `willLpaStatus()` |
| 8 | Beneficiary chain (Sankey) | `beneficiaryChain()` |
| 9 | RNRB planning | `rnrbTaper()` |
| 10 | BPR holdings | `bprClock()`, `bprQualifyingValue()`, `bprAllowanceTracker()` |

## 4.4 Charts

| Chart | Type | Sub-tab |
|-------|------|---------|
| Marginal rate stack | Stacked bar | Tax |
| Allowances strip | Progress bars | Tax |
| Drawdown matrix | Heat map grid | Tax |
| CoI odometer | Live counter | Estate |
| IHT waterfall | Multi-slider waterfall | Estate |
| Gift clock | Timeline rings | Estate |
| Beneficiary Sankey | Flow diagram | Estate |
| BPR clock ring | Circular progress | Estate |

## 4.5 User Journeys

1. **Tax check:** Tax tab → This-year summary → Allowances strip → Done
2. **IHT planning:** Estate tab → CoI → IHT waterfall → Drag sliders → See impact
3. **Gift planning:** Estate tab → Gift clock → Add gift → See 7-year countdown
4. **Nomination review:** Estate tab → Nominations → Flag stale → Update

---

# 5. TIMELINE SCREEN (Plan.jsx → rename to Timeline.jsx)

## 5.1 Purpose
Forward-looking planning — 6 sections

## 5.2 Six Sections

### Section A — Life Stage

| Element | Data Source |
|---------|-------------|
| Life stage strip | `lifeStageFor()` |
| Next milestone countdown | `calcMilestones()` |

### Section B — Score Journey

| Element | Data Source |
|---------|-------------|
| Twin-score hero (FQ + RS) | `calcFQ()`, `calcRisk()` |
| Score-journey bars | `whatActionWouldItTake()` |
| FQ 12-mo history line | `calcScoreHistory()` |
| RS 12-mo history line | `calcRiskHistory()` |

### Section C — Action Calendar

| Element | Data Source |
|---------|-------------|
| Statutory calendar | bundle deadlines |
| APQ timeline | `calcAPQTimeline()` |
| CoI chips | `costOfInaction()` |

### Section D — Decision Log

| Element | Data Source |
|---------|-------------|
| Decision cards | entity.decisions |
| Re-explain button | AI Ask |
| Undo/modify actions | Take Action |

### Section E — Scenario Library

| Element | Data Source |
|---------|-------------|
| Saved scenarios | `listScenarios()` |
| Compare mode | scenario comparison engine |
| Save as scenario | `saveScenario()` |

### Section F — Goals & Milestones

| Element | Data Source |
|---------|-------------|
| Goal cards | entity.goals |
| Milestone pins | `calcMilestones()` |
| Progress bars | `calcGoalProgress()` |

## 5.3 User Journeys

1. **Status check:** Land → Section A (5s) → Section B scores (10s) → Done
2. **Planning:** Land → Section C calendar → Review deadlines → Set reminders
3. **What-if:** Land → Section E → Create scenario → Compare → Decide

---

# 6. RISK OVERLAY (Risk.jsx)

## 6.1 Purpose
Resilience assessment — overlay (not a tab)

## 6.2 Trigger
Tap Risk Score tile anywhere → opens overlay

## 6.3 Overlay Zones (13 zones)

| Zone | Content | Data Source |
|------|---------|-------------|
| 1 | Risk Score header + band | `calcRisk()` |
| 2 | 5x5 Financial Profile cross-map | `financialProfile()` |
| 3 | 7-dimension breakdown bars | `calcRisk().dimensions` |
| 4 | Dimension drill (D1-D7) | per-dimension engine |
| 5 | Shock scenarios (5 cards) | `runShock()`, `riskShockSuite()` |
| 6 | Confidence indicator | computed confidence |
| 7 | Data completeness | entity gaps |
| 8 | Score history | `calcRiskHistory()` |
| 9 | Take Action top 3 | `calcAPQ()` filtered |
| 10 | Document Vault link | vault status |
| 11 | What would help most | `whatWouldHelpMost()` |
| 12 | BTR growth path | `projectBTR()` |
| 13 | Report generation | PDF export |

## 6.4 Shock Scenarios

| Shock | Name | Engine |
|-------|------|--------|
| 1 | Job loss | `runShock(entity, 'job_loss')` |
| 2 | Illness | `runShock(entity, 'illness')` |
| 3 | Market fall | `runShock(entity, 'market_fall')` |
| 4 | Rate rise | `runShock(entity, 'rate_rise')` |
| 5 | Death | `runShock(entity, 'death')` |

## 6.5 User Journeys

1. **Quick check:** Open → Zone 1 score → Zone 3 dimensions → Close
2. **Deep analysis:** Open → Zone 5 shocks → Tap shock → See impact → Actions
3. **Improvement:** Open → Zone 11 "What would help" → Take Action

---

# 7. SETTINGS SCREEN (Settings.jsx)

## 7.1 Purpose
14-section configuration overlay

## 7.2 Sections

| Section | Name | Key Features |
|---------|------|--------------|
| S1 | Profile | Name, DOB, jurisdiction, life stage display |
| S2 | Security | Passkeys, 2FA, FaceID, sessions, password |
| S3 | Privacy | AI consent, data sharing toggles |
| S4 | Partners & Household | Partner invite, permissions, activity log |
| S5 | Notifications | Channel + category toggles |
| S6 | Appearance | Theme (light/dark), hide-balances, accessibility |
| S7 | Language & Region | Locale, currency, timezone, year-mode |
| S8 | Data & Storage | Export, deletion, audit log |
| S9 | Subscription & Billing | Plan display, payment method, invoices |
| S10 | Connected Services | Aggregator connections, OAuth links |
| S11 | Finio Lab | Founder-only experiments |
| S12 | Help & Support | Contact, FAQ, chat |
| S13 | Legal & Regulatory | Terms, privacy policy, FCA disclosure |
| S14 | About | Version, changelog, rules bundle info |

## 7.3 Security Section Detail (S2)

| Feature | Implementation |
|---------|----------------|
| Password management | Change password, forgot password flow |
| 2FA setup | TOTP app setup, backup codes |
| FaceID/TouchID | Biometric enrollment |
| Passkey management | WebAuthn registration, device list |
| Active sessions | List with revoke capability |
| Login history | Chronological audit |
| Security recommendations | Password strength, 2FA prompts |

## 7.4 Theme Toggle (S6)

| Setting | Options |
|---------|---------|
| Theme | System / Light / Dark |
| Hide balances | Toggle |
| Reduced motion | Toggle |
| Font size | Default / Large / Extra Large |

---

# 8. AUTH/SECURITY FLOWS — NEW BUILD REQUIRED

## 8.1 Account Creation Flow

| Step | Screen | Features |
|------|--------|----------|
| 1 | Welcome | Entry mode picker (per Onboarding §3) |
| 2 | Email entry | Email input, continue button |
| 3 | Email verification | 6-digit code entry, resend |
| 4 | Password creation | Requirements display, strength meter |
| 5 | Optional: 2FA setup | Skip or setup TOTP |
| 6 | Optional: Biometric | Skip or enable FaceID/TouchID |
| 7 | Profile basics | Name, DOB picker |
| 8 | Jurisdiction | Country selection |
| 9 | Complete | Transition to onboarding Q1 |

## 8.2 Login Flow

| Method | Flow |
|--------|------|
| Email + Password | Email → Password → 2FA (if enabled) → Home |
| Passkey | Passkey prompt → Home |
| Biometric | FaceID/TouchID → Home |
| Magic link | Email → Click link → Home |

## 8.3 Security Features

| Feature | Location | Step-up Level |
|---------|----------|---------------|
| View balances | Everywhere | L0 (none) |
| Edit asset value | MyMoney drill | L1 (session) |
| Change jurisdiction | Settings S1 | L2 (biometric/password) |
| Delete account | Settings S8 | L3 (password + 2FA + wait) |
| Export all data | Settings S8 | L2 |
| Change password | Settings S2 | L2 |
| Add passkey | Settings S2 | L2 |
| View audit log | Settings S8 | L1 |

## 8.4 Password Requirements

- Minimum 12 characters
- Mix of uppercase, lowercase, numbers
- No common passwords (Have I Been Pwned check)
- Strength meter visual

## 8.5 Recovery Flow

| Scenario | Flow |
|----------|------|
| Forgot password | Email → Reset link → New password → Login |
| Lost 2FA device | Email → Backup code → Disable 2FA → Re-setup |
| Lost all devices | Email → Support flow → Identity verification |

## 8.6 Document Vault Security

| Feature | Protection |
|---------|------------|
| Access vault | L1 step-up |
| Upload document | L1 |
| Download document | L1 |
| Share with adviser | L2 |
| Delete document | L2 |

---

# 9. ONBOARDING FLOW

## 9.1 Purpose
Classify user into archetype in under 5 minutes

## 9.2 Flow Sequence

| Step | Screen | Duration | Output |
|------|--------|----------|--------|
| §0 | Entry mode picker | <10s | entry_mode |
| §0A | Jurisdiction (4 questions) | <30s | jurisdiction, citizenship, cross_border, currency |
| §0B | Language selection | <10s | ui_language |
| Q1 | Age (DOB picker) | <10s | dob, life_stage |
| Q2 | Relationship status | <30s | relationship_status |
| Q3 | Annual income | <10s | annual_income + **triple-anchor activates** |
| Q4 | Savings + investments | <15s | liquid_assets band |
| Q5 | Home ownership | <15s | home_ownership_status |
| Q6 | Pension | <20s | pension_wrappers |
| Q7 | Debts | <15s | debts summary |
| Q8 | Protection | <15s | protection_coverage |
| Q9 | Children/dependants | <15s | dependants |
| Q10 | Biggest financial question | <20s | primer_intent |
| Partner detail | (if partnered) | 30-60s | partner info |
| Archetype questions | 5 additional | 30-60s | classifier inputs |
| Classifier | (background) | <1s | archetype_assignment |
| Welcome | Archetype reveal | <10s | first-action queue |

## 9.3 Screen Components

| Screen | Components |
|--------|------------|
| Entry mode | 4 tiles (Real user, IFA, Company, Exploring) |
| Jurisdiction | Country picker, citizenship multi-select, cross-border Y/N, currency picker |
| DOB | Date picker with age display |
| Relationship | RH-1a tree (single, partnered, etc.) |
| Income | Slider or input with band display |
| Each Q | Single question, clear options, progress bar, back button |
| Triple-anchor | NW/FQ/RS tiles updating live from Q3 onwards |

---

# 10. ASK SCREEN (Ask.jsx)

## 10.1 Purpose
AI assistant for financial questions

## 10.2 Three Capability Tiers

| Tier | Name | Capability |
|------|------|------------|
| Explain | Answer questions | Read entity, explain concepts |
| Model | Run scenarios | What-if calculations |
| Act | Execute actions | Commit to Take Action (with step-up) |

## 10.3 Screen Components

| Component | Purpose |
|-----------|---------|
| Chat interface | Message history |
| Input bar | Voice + text input |
| Suggested questions | Context-aware prompts |
| Action cards | Executable suggestions |
| Scope indicator | Current context (tab or global) |

## 10.4 FCA Guardrails

- No "you should" phrasing
- No directive language
- Always include adviser caveat
- Regulatory filter on all outputs

---

# TEST SCRIPT REQUIREMENTS

## Coverage Matrix

| Screen | Unit Tests | Integration Tests | Visual Tests | E2E Tests |
|--------|-----------|-------------------|--------------|-----------|
| Home | Engine functions | Data flow | Screenshot comparison | Full journey |
| MyMoney | Per-category | CRUD operations | Layout check | Add asset flow |
| Cashflow | Section A/B/C | Scenario runs | Charts render | Planning flow |
| Tax & Estate | 23 functions | Sub-tab switch | IHT waterfall | Gift clock flow |
| Timeline | 5 functions | Section navigation | Calendar render | Scenario save |
| Risk | Shock functions | Overlay open/close | Cross-map render | Shock drill |
| Settings | Per-section | Step-up auth | Theme switch | Full setup |
| Auth | Each flow | Login/logout | Form validation | Full signup |
| Onboarding | Classifier | Question flow | Progress bar | Full flow |
| Ask | Response gen | Context scope | Chat render | Query flow |

## Test Categories

1. **Smoke tests** — Does it render without crashing?
2. **Engine tests** — Do functions return expected shapes?
3. **R08 validation** — Do fixture personas produce expected ranges?
4. **Visual QA** — Do screenshots match expected layouts?
5. **Journey tests** — Can user complete key flows?
6. **Edge cases** — Empty states, error states, boundary values

---

# NEXT STEPS

1. **Founder reviews this document**
2. **Approves/rejects each screen contract**
3. **Claude builds all approved screens**
4. **DeepSeek runs test script**
5. **Fix loop until 0 failures**

---

**END OF SCREEN CONTRACTS**
