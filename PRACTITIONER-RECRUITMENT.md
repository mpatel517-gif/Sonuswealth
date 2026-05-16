# Sonuswealth — Specialist Practitioner Recruitment Brief

**Purpose:** Identify and engage the 10 specialist practitioner types Sonuswealth needs to validate the Decision Engine spec, sign off formula correctness, and audit live cases on an ongoing basis. One person doesn't cover all domains — this is a panel, not a hire.

**Status:** Pre-launch UK personal finance intelligence app. Founder: Mihir Patel. Today: 2026-05-15.

**Regulatory posture:** Sonuswealth is an **information / guidance / storage** platform — NOT regulated financial advice. Specialists are engaged as **reviewers and auditors of the platform's logic and outputs**, not as advisers to end users. They do not have a regulated advisory relationship with any platform user. This must be in their letter of engagement.

---

## The 10 specialisations

Tiered. Tier 1 = required before any live user. Tier 2 = required before scaling beyond first 1,000 users. Tier 3 = required at the relevant feature launch.

### Tier 1 — Minimum viable panel (5 practitioners)

#### 1. Chartered Tax Adviser (CTA)

**Qualification:** CTA (Chartered Institute of Taxation). ATT acceptable for junior reviewer.
**Specialism:** UK personal income tax, dividend tax, CGT, savings tax, ANI, HICBC.
**Where to find:**
- Chartered Institute of Taxation directory → www.tax.org.uk → "Find a CTA"
- LinkedIn search: "CTA UK personal tax private client"
- Mid-tier accountancy firms (BDO, RSM, Mazars, MHA, Crowe) — private client departments
**The work:**
- Review every tax formula in the spec against current UK 2026/27 rules
- Audit 30 sample cases on engagement (single user, married couple, director, landlord, retired, non-UK-domiciled)
- Quarterly rule-freshness review (after Spring + Autumn Budgets, after Finance Acts)
- Spot-check 10 random live cases per quarter once platform is live
**Time commitment:** 30-40 hrs initial setup; ~6 hrs/quarter ongoing.
**Fee range UK 2026:** £350-700/hr. Initial engagement ~£15-25K. Annual retainer £6-15K.
**Vetting questions:**
- "Walk me through how the personal allowance taper interacts with pension contributions and gift aid in 2026/27."
- "What's your view on the Finance Act 2026 SIPP IHT change taking effect April 2027?"
- "Have you reviewed a fintech's tax engine before?" (Bonus if yes.)

#### 2. Chartered Financial Planner (DipPFS + AF7 minimum, Chartered preferable)

**Qualification:** Chartered Financial Planner (CFP) status from the CII / Personal Finance Society. AF3 (pension transfers) + AF7 (pension decumulation) advanced exams critical for the pension/drawdown work.
**Specialism:** Drawdown, sustainable withdrawal rates, retirement planning, wrapper sequencing, investment suitability framework.
**Where to find:**
- Personal Finance Society directory → www.thepfs.org → "Find a financial planner"
- LinkedIn: "Chartered Financial Planner AF7 UK"
- Independent IFA networks: Quilter Financial Planning (but they may have exclusivity), Best Practice IFA Society, Money Marketing directory
- Boutique IFA practices (often more willing to consult)
**The work:**
- Review drawdown maths (Bengen 4%, Guyton-Klinger guardrails, bucket strategy, floor-and-upside)
- Sign off on sequence-of-returns risk modelling (paired with the Actuary)
- Audit suitability framework — does the engine surface the right questions?
- Review FCA Consumer Duty handling
**Time commitment:** 40-50 hrs initial; ~8 hrs/quarter ongoing.
**Fee range:** £300-600/hr. Initial £15-30K. Annual £8-20K.
**Vetting:**
- "Talk me through your preferred drawdown method and why."
- "How would you handle a 55-year-old with £800K SIPP + £200K ISA wanting early retirement to spend £40K/yr — what are the key risks?"
- "What's your view on the 4% rule's current applicability under UK tax + 2026/27 inflation conditions?"

#### 3. STEP-Qualified Trust & Estate Practitioner (TEP)

**Qualification:** STEP membership with TEP designation. Solicitor or chartered accountant background.
**Specialism:** Wills, trusts (discretionary, bare, interest-in-possession), IHT planning, LPAs, gift-with-reservation, cross-border estate, pension death-benefit nominations.
**Where to find:**
- STEP UK directory → www.step.org → "Find a member"
- LinkedIn: "STEP TEP UK private client"
- Private client departments at law firms: Withers, Forsters, Farrer & Co, Charles Russell Speechlys, Hunters
- Mid-tier accountancy firms with STEP-qualified partners
**The work:**
- Review IHT formulas (NRB, RNRB taper above £2M, BPR, charity uplift, pre/post-2027 pension rules)
- Sign off on trust modelling (entry charge, 10-year periodic, exit charge)
- Audit gift-with-reservation logic + normal-expenditure-out-of-income calculation
- Review LPA + capacity-loss scenario handling
**Time commitment:** 25-35 hrs initial; ~5 hrs/quarter.
**Fee range:** £400-800/hr (solicitor partner rates higher). Initial £15-25K. Annual £6-12K.
**Vetting:**
- "Walk me through the IHT consequence of placing £500K into a discretionary trust today versus a 7-year PET."
- "How does the residence nil-rate band taper work above £2M and how does it interact with downsizing relief?"
- "What changes post-April 2027 for pension death benefits and how should that affect nomination strategy now?"

#### 4. FCA-Experienced Compliance Consultant

**Qualification:** Ex-FCA staff OR senior compliance officer at an FCA-authorised firm (≥10 yrs experience). CISI Investment Operations Certificate or similar.
**Specialism:** FCA Conduct of Business Sourcebook (COBS), PERG 8 (advice perimeter), Consumer Duty 2023, financial promotions rules.
**Where to find:**
- FCA Register → search for compliance consultancies authorised as Section 21 approvers
- Specialist consultancies: Bovill, Eversheds Sutherland (consulting arm), Compliancy Services, Cosegic
- LinkedIn: "FCA compliance consultant fintech"
**The work:**
- Review every user-facing string against the FCA boundary (information/guidance/storage vs advice)
- Sign off on disclaimer placement and Consumer Duty handling
- Audit Ask AI responses (highest-risk surface)
- Review live monitoring framework (financial promotion approval, complaint handling)
**Time commitment:** 30-40 hrs initial; ~6 hrs/quarter + spot-checks.
**Fee range:** £300-600/hr. Initial £12-22K. Annual £8-18K.
**Vetting:**
- "Where do you draw the PERG 8 line between 'one option is to do X' and 'you should do X'?"
- "Under Consumer Duty, what's our obligation when a user's situation suggests advice is genuinely needed but they won't book one?"
- "How would you approve AI-generated finance content for compliance in 2026?"

#### 5. Fellow of the Institute and Faculty of Actuaries (FIA)

**Qualification:** FIA (or FFA) — full Fellowship of the IFoA. Pension or life-insurance specialism.
**Specialism:** Mortality (ONS life tables, longevity adjustment), Monte Carlo simulation, sequence-of-returns risk, annuity pricing, stochastic modelling.
**Where to find:**
- Institute & Faculty of Actuaries directory → www.actuaries.org.uk
- LinkedIn: "FIA actuary pensions UK independent consultant"
- Smaller actuarial consultancies: Spence & Partners, Cartwright, Hymans Robertson (smaller engagements)
- Retired-but-active partner-level actuaries at Big 4
**The work:**
- Sign off on mortality + longevity + sequence-risk modelling
- Audit Monte Carlo simulator implementation (number of paths, seed determinism, fat-tail handling)
- Review annuity-pricing logic + IL annuity vs level comparison
- Validate sustainability projections against industry benchmarks
**Time commitment:** 20-30 hrs initial; ~4 hrs/quarter.
**Fee range:** £400-800/hr. Initial £10-20K. Annual £6-12K.
**Vetting:**
- "How would you model sequence-of-returns risk for a 55-year-old retiring with £1M today — what distributions and assumptions?"
- "What's your view on using log-normal vs fat-tailed return distributions for retirement projections?"
- "How do you handle the inflation-uplift on State Pension across a 30-year projection?"

---

### Tier 2 — Required before scaling beyond first 1,000 users

#### 6. CFA Charterholder (Investment Strategist)

**Qualification:** CFA charterholder. Buy-side or wealth-management background.
**Specialism:** Asset allocation, factor exposure, rebalancing thresholds, wrapper sequencing.
**Where to find:** CFA UK Society directory → www.cfauk.org. LinkedIn: "CFA wealth management UK". Boutique wealth managers (Saunderson House, Killik & Co, Cazenove Capital).
**The work:** Review allocation maths, rebalancing logic, factor exposure detection.
**Fee range:** £300-600/hr. Initial £10-15K.

#### 7. Cross-Border Tax Specialist

**Qualification:** CTA + cross-border specialism, OR US/UK-qualified tax specialist for relocation scenarios involving US persons.
**Specialism:** Double tax agreements (DTAs), statutory residence test (SRT), split-year treatment, deemed domicile, FIG regime (replacing non-dom from April 2025), QROPS.
**Where to find:** Big 4 mobility teams (KPMG, EY, PwC, Deloitte), specialist firms (Buzzacott, Smith & Williamson / Evelyn Partners), LinkedIn: "cross-border tax adviser UK private client".
**The work:** Sign off on relocation, dual-residence, domicile scenarios. Critical for any user planning to leave UK.
**Fee range:** £500-900/hr. Initial £12-22K.

#### 8. Mortgage & Property Finance Specialist (CeMAP+)

**Qualification:** CeMAP qualified. CeRER for equity release. Lifetime mortgage / RIO specialism preferred.
**Specialism:** Affordability calculations, stress-tests, LTV bands, BTL S24, lifetime mortgages, equity release.
**Where to find:** Equity Release Council member firms (Key, Age Partnership, More 2 Life). LinkedIn: "CeRER lifetime mortgage UK". Specialist BTL brokers.
**The work:** Sign off on mortgage formula spec, BTL stress tests, equity release scenarios.
**Fee range:** £200-400/hr. Initial £6-12K.

---

### Tier 3 — Required at relevant feature launch

#### 9. Behavioural Finance Specialist

**Qualification:** PhD in behavioural economics OR senior researcher at a behavioural finance consultancy (Oxford Risk, Behavioural Insights Team alumni). Industry experience at a robo-adviser or wealth manager.
**Specialism:** Cognitive biases, framing effects, regret minimisation, loss aversion detection.
**Where to find:** Oxford Risk, Behavioural Insights Team (now Nesta-affiliated), university finance departments (Imperial, Warwick, Oxford). Authors of published papers on retail finance behaviour.
**The work:** Review the engine's behavioural annotation layer + Decision Wheel weight calibration.
**Fee range:** £400-800/hr. Initial £8-15K.

#### 10. Banking & FSCS Specialist

**Qualification:** Ex-PRA / ex-FCA, OR senior compliance at a retail bank. Strong knowledge of UK deposit protection mechanics.
**Specialism:** FSCS licence groupings, deposit protection, joint-account doubling, temporary high balance (£1M for 6 months).
**Where to find:** Compliance consultancies (Bovill, Cosegic), ex-PRA staff on LinkedIn, banking-compliance practices at Eversheds / Linklaters.
**The work:** Sign off on FSCS exposure calculator + licence-group mappings.
**Fee range:** £400-600/hr. One-off engagement, ~10-15 hrs, ~£5-8K. Ongoing minimal (only when banking sector consolidates / licences change).

---

## What every practitioner is signing up to

**The engagement letter (signed before any work):**

1. **Scope.** Reviewing Sonuswealth's Decision Engine logic, formulas, and sample outputs for accuracy and compliance. NOT providing regulated advice to any Sonuswealth user. NOT being held out by Sonuswealth as the user's adviser.
2. **Confidentiality.** Sonuswealth's internal logic, prompts, decomposition rules, and roadmap are confidential. NDA pre-engagement.
3. **Liability.** Practitioner is signing off on the **correctness of the formulas/logic they review**. Liability for actual user outcomes remains with Sonuswealth's information/guidance/storage positioning and the user's own decisions or own external adviser.
4. **Sign-off mechanism.** For each formula/scenario reviewed, the practitioner records in a structured form: `validator: {name, qualification, date}`, `verdict: {pass/fail/pass-with-conditions}`, `conditions: [list]`. This is stored as the engine's audit trail.
5. **Rule freshness commitment.** Each practitioner commits to reviewing within 4 weeks of major fiscal events (Budget, Finance Act assent, FCA policy statements affecting their domain).

---

## Engagement model options

**Option A — Per-case retainer.** Each practitioner is paid per case reviewed (initial 30 cases at fixed price, then ongoing per audit). Predictable cost. Best for budget control.

**Option B — Monthly retainer.** Each practitioner on a monthly retainer with allocated hours. Predictable availability. Best when ongoing work is steady.

**Option C — Practitioner panel via a firm.** Engage one mid-tier firm with multiple in-house specialists (e.g., a firm with CTA + DipPFS + STEP all under one roof). One contract, one invoice. Examples: Evelyn Partners (Smith & Williamson), Saffery, RSM private client, Killik & Co's planning arm. Easier to manage; potentially less specialist depth than independent practitioners.

**Option D — Hybrid.** Tier 1 critical (CTA, Chartered FP, STEP, FCA, Actuary) on Option B retainers. Tier 2 and 3 specialists engaged as Option A per-case as needed.

**Recommendation:** Option D. Start with 5 retained Tier 1 practitioners. Add Tier 2/3 per-case as scenarios needing their domain come online.

---

## Total cost envelope (UK 2026 estimates)

| Tier | Practitioners | Initial cost | Annual ongoing |
|---|---|---|---|
| Tier 1 (5) | CTA, CFP, STEP, FCA, FIA | £60-110K | £35-75K |
| Tier 2 (3) | CFA, X-border, Mortgage | £25-50K | £10-25K |
| Tier 3 (2) | Behavioural, Banking | £15-25K | £5-10K |
| **All 10** | | **£100-185K initial** | **£50-110K/yr ongoing** |

This is real money. Honest framing: building a financial-advice-accuracy product at the standard you described needs this investment. Most fintechs cut corners here. The corner-cutting is why most fintechs can't credibly compete with a full IFA.

**Cheaper paths if budget is tight:**

- **University partnerships.** Imperial Centre for Financial Technology, Bayes (City) Cass, Warwick Business School — academic reviewers at ~£100-200/hr but slower and less practical depth.
- **Retired-but-active partners.** Ex-Big 4 partners often consult at 50-70% of going rates.
- **Specialist firm contract (Option C).** Mid-tier firm with 4-6 specialists in-house: ~£60-90K initial + £30-50K annual. Single contract.
- **Insurance-backed validation.** Some PI insurers offer panel-of-experts review as part of product launch coverage.

---

## How to source the panel — the actual practical steps

1. **Define the scope document** — share Sonuswealth's mission, FCA positioning, product overview, and the specific work-package per practitioner type. (This file is the starting point.)
2. **Reach out via directory + LinkedIn** — initial cold outreach to 3-5 candidates per role. Brief intro email + Calendly link for 30-min intro call.
3. **Run the intro call** — vetting questions above. Check qualification, experience with fintech, PI insurance coverage, NDA willingness.
4. **Trial engagement** — engage top 1-2 candidates per role on a **small paid pilot**: review one scenario (e.g., DE-09 property) and produce a sample audit. Compare quality before committing to retainer.
5. **Sign engagement letter + NDA** — formal engagement with clear scope, liability, and sign-off mechanics.
6. **Onboard to the audit workflow** — practitioner gets read-only access to the engine's source-of-truth documents + structured audit form.

This recruitment effort itself takes ~4-8 weeks if run in parallel. Start now.

---

## What I (Claude / the platform) am doing in parallel

Authoring 11 new Claude prompt skills + upgrading 6 existing skills to producer mode. These are NOT substitutes for the human practitioners — they are the platform's first-pass author of the formula specs that the practitioners then audit. The skills propose; the practitioners dispose.

Skill list and authorship plan: see `.claude\sonuswealth-skills\SKILL-AUTHORSHIP-PLAN.md`.

---

## Open questions for founder before recruitment starts

1. **Budget envelope.** What's the realistic spend envelope on the Tier 1 panel for the first 6 months? This decides whether we go Option D (multi-practitioner) or Option C (single firm).
2. **Timing.** Recruitment in parallel with the build, or sequence (recruit first, then build)? Parallel is faster but means some formulas get re-worked after practitioner review. Sequential is slower but cleaner.
3. **Liability appetite.** Are you comfortable carrying the residual risk that the platform itself bears for "information/guidance/storage" positioning, with practitioners only signing off on technical correctness? Or do you want the engagement letter to push more liability to the practitioners?
4. **Geographic constraint.** UK-only practitioners, or are EU/US specialists acceptable for cross-border work?

These are commercial decisions, not technical. Yours to call.
