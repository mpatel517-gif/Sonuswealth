# Sonuswealth — Nice-to-Haves Register

**Created:** 2026-05-23
**Source:** 6 spec-vs-code gap audits at `C:\Users\Powernet\Desktop\finio\.planning\gap-audits\`

This file captures features observed during audits that aren't in spec but would plausibly improve the product. Founder reviews periodically; approved items get promoted to spec and folded into the master schedule.

**Status legend:**
- 🟢 APPROVED — promote to spec
- 🟡 PARKED — keep for later review
- 🔴 REJECTED — not pursuing
- ⚪ UNREVIEWED — captured, awaiting founder

---

## From Cashflow audit (8 items)

| # | Item | Status | Notes |
|---|---|---|---|
| CF-N1 | Sequence-of-returns hedging UI panel | ⚪ | engine `sequenceOfReturnsHedgingHandler` exists in uk-risk; no UI surface |
| CF-N2 | Tax-loss harvesting calendar | ⚪ | supplement §A tax payment schedule with "use CGT AEA before April 5" |
| CF-N3 | Inflation regime selector (CPI / CPIH / RPI / personal-basket) | ⚪ | HNW users may want alternatives |
| CF-N4 | Cash-buffer auto-rebalance suggestion | ⚪ | if B1 drifts below 18mo target, suggest rebalance |
| CF-N5 | Per-scenario CSV export | ⚪ | IFAs likely want to export 5-scenario comparison for client packs |
| CF-N6 | Withdrawal-rate-to-longevity curve | ⚪ | interactive: "if you live to 95 vs 100, safe rate is X% vs Y%" |
| CF-N7 | Healthcare cost projection (post-retirement) | ⚪ | currently no line item beyond NHS-assumed-free |
| CF-N8 | Care-cost scenario | ⚪ | LTC needs not projected; later-life-adviser lens has insight not surfaced |

## From MyMoney audit (10 items)

| # | Item | Status | Notes |
|---|---|---|---|
| MM-N1 | Per-row sparkline (12-month trend) on each asset row | ⚪ | currently value only |
| MM-N2 | ESG / values-aligned flag per asset (especially equities) | ⚪ | could feed Investment Adviser lens |
| MM-N3 | Cost-basis tracking for GIA + employee share schemes | ⚪ | CGT readiness blocked without this |
| MM-N4 | Provider consolidation suggestion | ⚪ | "you have 3 ISAs across 3 providers; consolidating saves ~£60/yr fees" |
| MM-N5 | Asset-level dividend yield + projected income chip | ⚪ | per-row chip on GIA holdings |
| MM-N6 | Property auto-valuation refresh | ⚪ | Land Registry / Zoopla pull for residence value |
| MM-N7 | Loan amortisation projection in liabilities | ⚪ | mortgage payoff date + total interest over remaining life |
| MM-N8 | Spouse-asset linking (joint-planning view) | ⚪ | for IFA + couple personas |
| MM-N9 | Currency hedge view (cross-border NRI persona) | ⚪ | GBP / native split |
| MM-N10 | "What would happen if I sold this?" mode on every asset row | ⚪ | routes to Decision Engine |

## From Tax & Estate audit (10 items)

| # | Item | Status | Notes |
|---|---|---|---|
| TE-N1 | Tax-year vs calendar-year toggle on every chart | ⚪ | IFAs sometimes want CY view |
| TE-N2 | Real-time tax-position chip in app header | ⚪ | always-visible "tax due so far this year" |
| TE-N3 | CGT cost-basis bulk import | ⚪ | upload historical buy/sell to compute realised gains |
| TE-N4 | IHT pre-2027 vs post-2027 toggle | ⚪ | explicit before/after April 6 2027 comparison (currently implicit) |
| TE-N5 | Charity 10% rule calculator | ⚪ | leaving 10%+ to charity drops IHT rate 40%→36%; often missed |
| TE-N6 | Trust-vs-direct gift simulator | ⚪ | visual gift outright vs discretionary trust |
| TE-N7 | DGT (Discounted Gift Trust) modeller | ⚪ | explicit DGT card |
| TE-N8 | Cross-border IHT preview (India-UK DTA) | ⚪ | for NRI persona |
| TE-N9 | APR farmland holding period tracker | ⚪ | similar to BPR clock but for agricultural property |
| TE-N10 | Estate beneficiary tax-bracket modeller | ⚪ | "if you leave £X to person Y, their effective rate is Z%" |

## From Risk audit (8 items)

| # | Item | Status | Notes |
|---|---|---|---|
| RK-N1 | Per-shock probability calibration | ⚪ | currently qualitative; quantitative adds depth |
| RK-N2 | Risk-tolerance personality test | ⚪ | separate from risk capacity; FCA-aware version |
| RK-N3 | Lifetime risk-budget allocation view | ⚪ | how much "risk credit" by life stage |
| RK-N4 | Couple risk profile differential | ⚪ | for married personas; flag major divergence |
| RK-N5 | What-if shock simulator (interactive) | ⚪ | drag slider, see effect |
| RK-N6 | Insurance-product-fit chip on protection gap | ⚪ | "this gap is typically addressed by X type of cover" |
| RK-N7 | Risk-history annotation | ⚪ | let user tag what life event caused past changes |
| RK-N8 | Behavioural-finance nudge library | ⚪ | micro-interventions to improve D7 BTR |

## From Timeline audit (10 items)

| # | Item | Status | Notes |
|---|---|---|---|
| TL-N1 | Annual review prompt | ⚪ | "12 months since last review — schedule one?" |
| TL-N2 | Tax-year-end countdown bar (always visible) | ⚪ | days-to-April-5 chip |
| TL-N3 | Multi-year scenario comparison overlay | ⚪ | 2 saved scenarios side-by-side on score-journey chart |
| TL-N4 | Calendar export (.ics) | ⚪ | statutory dates to personal calendar |
| TL-N5 | Adviser-shared timeline (read-only link) | ⚪ | IFA mode shares with client (FCA-compliant) |
| TL-N6 | Pension contribution anniversary tracker | ⚪ | "your AA window for 2024–25 closes in 47 days" |
| TL-N7 | Life-event auto-detection from MM data | ⚪ | mortgage→zero triggers milestone "mortgage cleared" |
| TL-N8 | Future-tense narrative card ("Sonu in 5 years") | ⚪ | plain-English summary |
| TL-N9 | D7 BTR behaviour streak chip | ⚪ | per-month consistency badge |
| TL-N10 | Plan version history with diff | ⚪ | show saved-plan versions + what changed |

## From Home audit (10 items)

| # | Item | Status | Notes |
|---|---|---|---|
| HM-N1 | Personalised greeting by recent activity | ⚪ | "you committed a plan yesterday" |
| HM-N2 | Today's news affecting finances banner | ⚪ | Z9-adjacent: rate-change / Budget alerts |
| HM-N3 | One-tap quick-add floating button | ⚪ | "log expense / log income / log gift" without going to Data Capture |
| HM-N4 | "21 days reviewed in a row" streak chip | ⚪ | D7 BTR positive feedback |
| HM-N5 | Spouse / partner shared anchor | ⚪ | partner's NW + FQ alongside (couple personas) |
| HM-N6 | "What changed since yesterday" digest card | ⚪ | automated diff narrative |
| HM-N7 | Voice-summary playback (60s audio) | ⚪ | accessibility + commute-friendly |
| HM-N8 | Sonnu mascot life-stage variation | ⚪ | different illustration by persona stage |
| HM-N9 | Anonymous peer-percentile chip | ⚪ | FCA-careful: same life stage, not "you're behind" |
| HM-N10 | "What does the IFA see?" preview mode | ⚪ | for end-user; also IFA-mode preview |

---

## Cross-cutting (apply to multiple tabs)

| # | Item | Affected tabs | Status |
|---|---|---|---|
| X-N1 | Universal "I want this different" affordance (X24 Mode 3) | every tab | ⚪ promoted to PP-3 enforcement work |
| X-N2 | Hide-balances privacy mode | every tab | ⚪ shared component |
| X-N3 | Adviser-shared link generator | every tab | ⚪ FCA-careful read-only |
| X-N4 | Voice narration of any panel | accessibility | ⚪ |
| X-N5 | Dark/light/high-contrast theme triple | every tab | ⚪ |

---

## From Onboarding audit (6 items)

| # | Item | Status | Notes |
|---|---|---|---|
| OB-N1 | Skip-to-import flow | ⚪ | Voyant / FE Analytics / Selectapension export bypass |
| OB-N2 | Demo-mode toggle (Bruce Wayne sandbox) | ⚪ | prospects play without real info |
| OB-N3 | Onboarding pause + resume | ⚪ | save partway |
| OB-N4 | Onboarding shareable link (IFA→client with practice context) | ⚪ | |
| OB-N5 | Couple onboarding (parallel sessions with sync) | ⚪ | |
| OB-N6 | Migration audit (Voyant mappings + anomalies before commit) | ⚪ | |

## From Data Capture audit (7 items)

| # | Item | Status | Notes |
|---|---|---|---|
| DC-N1 | Drag-and-drop upload zone (anywhere on page) | ⚪ | |
| DC-N2 | Bulk upload with progress | ⚪ | 20 PDFs, per-file status |
| DC-N3 | Re-parse button (user-triggered) | ⚪ | |
| DC-N4 | Provider auto-detection (HL / Vanguard / AJ Bell format) | ⚪ | route to specialist parser |
| DC-N5 | Bank statement diff (12mo upload + anomaly surface) | ⚪ | |
| DC-N6 | OCR confidence threshold slider | ⚪ | tune auto-accept |
| DC-N7 | Personalised upload sequence ("you said SIPP — upload latest") | ⚪ | |

## From Document Vault audit (8 items)

| # | Item | Status | Notes |
|---|---|---|---|
| DV-N1 | Document expiry warnings (passport, insurance renewal) | ⚪ | |
| DV-N2 | OCR full-text search across all docs | ⚪ | |
| DV-N3 | Annotation layer (IFA notes on documents) | ⚪ | |
| DV-N4 | Version history per document | ⚪ | replace keeps prior |
| DV-N5 | Sharing audit log (IFA/solicitor access) | ⚪ | regulator-ready |
| DV-N6 | Document templates library (blank LPA/EoW drafts) | ⚪ | |
| DV-N7 | Stale document chip ("Will is 12yrs old") | ⚪ | |
| DV-N8 | Bundle export (ZIP for accountant/IFA handover) | ⚪ | |

## From Notifications audit (7 items)

| # | Item | Status | Notes |
|---|---|---|---|
| NT-N1 | Smart batching (collapse 5 in 10min to digest) | ⚪ | |
| NT-N2 | Quiet hours (user-set no-notif window) | ⚪ | |
| NT-N3 | Notification preview in Settings | ⚪ | see what fires today |
| NT-N4 | Per-tab notification badge dot | ⚪ | |
| NT-N5 | "Why am I seeing this?" chip → explainer | ⚪ | |
| NT-N6 | IFA notification analytics (ack vs dismiss) | ⚪ | |
| NT-N7 | Channel preferences per type (in-app/email/SMS/push) | ⚪ | |

## From Reports audit (7 items)

| # | Item | Status | Notes |
|---|---|---|---|
| RP-N1 | Report diff view (this-quarter vs last-quarter) | ⚪ | |
| RP-N2 | One-page executive summary | ⚪ | |
| RP-N3 | Audio summary (60-sec narration) | ⚪ | |
| RP-N4 | HMRC-friendly Tax Summary format | ⚪ | accountant-accepted |
| RP-N5 | Voyant-style export (for IFA migrators) | ⚪ | |
| RP-N6 | Annotated PDF (IFA marks up pre-send) | ⚪ | |
| RP-N7 | Multi-language export (Hindi/Gujarati) | ⚪ | NRI personas |

## From IFA Practice audit (8 items)

| # | Item | Status | Notes |
|---|---|---|---|
| IF-N1 | Client review template auto-gen | ⚪ | review-meeting prep doc |
| IF-N2 | Bulk action across clients | ⚪ | "mark all reviewed this quarter" |
| IF-N3 | Referral pipeline tracker | ⚪ | visible practice funnel |
| IF-N4 | CPD hours auto-log | ⚪ | every interaction counts |
| IF-N5 | Client satisfaction pulse (quarterly survey) | ⚪ | |
| IF-N6 | Practice benchmarking (anonymous vs other practices) | ⚪ | |
| IF-N7 | Compliance audit replay (every action logged) | ⚪ | regulator-ready |
| IF-N8 | Voyant-data-mapping wizard during IFA onboarding | ⚪ | cross with OB-N1 |

## From Settings audit (8 items)

| # | Item | Status | Notes |
|---|---|---|---|
| ST-N1 | Section search bar (13 sections is a lot) | ⚪ | |
| ST-N2 | Recent settings changes log (S11 visible audit trail) | ⚪ | |
| ST-N3 | Export entire settings as portable file | ⚪ | backup/restore |
| ST-N4 | Theme schedule (auto-switch by time of day) | ⚪ | |
| ST-N5 | Sonnu personality slider (formal/casual/playful) | ⚪ | |
| ST-N6 | Currency display preference (primary GBP + secondary INR/USD) | ⚪ | NRI personas |
| ST-N7 | Per-tab "default view" preset | ⚪ | which tab opens at launch |
| ST-N8 | Settings impact preview ("if X changes, Y changes too") | ⚪ | |

## From Security/Auth audit (8 items)

| # | Item | Status | Notes |
|---|---|---|---|
| AU-N1 | Passkey / WebAuthn (passwordless, modern) | ⚪ | |
| AU-N2 | Magic link option (passwordless via email) | ⚪ | |
| AU-N3 | Per-tab unlock (Vault + Estate require biometric) | ⚪ | |
| AU-N4 | Time-limited access tokens (solicitor 7-day grant) | ⚪ | |
| AU-N5 | Account-recovery dual-trustee (2-of-2 for HNW) | ⚪ | |
| AU-N6 | Anti-phishing word (user-set, shown at login) | ⚪ | |
| AU-N7 | Suspicious-login alert (geo / device fingerprint) | ⚪ | |
| AU-N8 | Compliance audit export (every auth event) | ⚪ | regulator-ready |

---

## How this list works

1. **Capture by default.** During audits, anything observed that's not in spec gets logged here (⚪ UNREVIEWED).
2. **Founder reviews monthly.** Each item → 🟢 / 🟡 / 🔴.
3. **🟢 APPROVED items promote** to the relevant 2-Product spec + get added to the master schedule §3 build checklist.
4. **🟡 PARKED items wait** for v2 / post-launch review.
5. **🔴 REJECTED items archive** with a one-line rationale.

**Items in this register are NOT in the master schedule yet.** They are explicitly excluded until promoted.

---

*Register v2 · 2026-05-23 · 120 items captured across 6 core-tab audits + 8 ancillary-tab audits + 5 cross-cutting.*
