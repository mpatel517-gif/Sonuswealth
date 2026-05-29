# Risk — Pass 1 · Domain & A5 Audit

**Auditor:** domain-auditor (auditor 4 of 5)
**Date:** 2026-05-18
**Scope:** A5 (plain English + FCA) + financial correctness + brand drift on every Risk inventory row carrying a number, claim, or term.
**Files walked:** `src/screens/Risk.jsx` (1645 lines), `src/screens/RiskOverlay.jsx`, `src/components/Risk/ProtectionGap.jsx`, `src/config/brand.js`, `src/rules/UK-2026.1.1.json`.

---

## Verdict summary

| Bucket | Count |
|---|---|
| Rows examined for A5/domain | 67 |
| PASS | 51 |
| FAIL | 16 |
| of which DEMO-BLOCKING | 1 |
| of which FUNCTIONAL | 11 |
| of which POLISH | 4 |

**Locked FDs treated as decided** (no flag): FD-NAME-1, FD-CROSS-1, FD-LOGO-1, FD-MASCOT-1, FD-RK-1, FD-RK-2, FD-RK-3.

**Headline failures.**
1. **RK-S-01 confirmed FAIL — three labels for the score architecture on one anchor.** "Safety score · primary" (RK-ANCH-01c, Risk.jsx:1513) + "Risk Score" (ring centre, Risk.jsx:172) + "Health score" (Wealth secondary tile, Risk.jsx:1535). `BRAND.riskScore = "Sonuswealth Risk Score"` and `BRAND.score = "Sonuswealth Wealth Score"` are the canonical names — the screen uses neither correctly and invents two new ones.
2. **Protection-need multipliers hardcoded in the UI**, not in `rules-uk.js` / engine — `feedback_always_check_rules_uk` directly violated.
3. **Internal codes ("s02a", "D3", "D6", "D-RISK-D6-SUBSCORING") leak into user copy** in 6+ surfaces.
4. **Engineer-facing copy** ("recomputed by engine", "engine returned empty", "point-in-time", "always live") visible to end users.

---

## Verdict table

| ID | A5 | Domain | Severity | Finding | Evidence |
|---|---|---|---|---|---|
| RK-S-01 (RK-ANCH-01c / RK-ANCH-05 / RK-OVL-02 / RK-OVL-04) | FAIL | FAIL | **FUNCTIONAL** | Confirmed. Three labels for two scores on one anchor block. Eyebrow says **"Safety score"**, ring centre says **"Risk Score"**, secondary tile says **"Health score"** for the Wealth value, overlay header says **"Risk Score · point-in-time"** and inline **"· Wealth NN"**. Per `BRAND.riskScore` = "Sonuswealth Risk Score" and `BRAND.score` = "Sonuswealth Wealth Score". "Safety score" and "Health score" appear nowhere in `brand.js`. Per FD-NAME-1 user-facing names must come from BRAND. | Risk.jsx:1513 eyebrow `Safety score · primary`; Risk.jsx:172 ring `Risk Score`; Risk.jsx:1535 tile `label="Health score"`; RiskOverlay.jsx:73 `Risk Score · point-in-time`; RiskOverlay.jsx:92 `· Wealth NN`. |
| RK-S-04 (RK-Z4-03) | FAIL | FAIL | **FUNCTIONAL** | Confirmed. User-facing summary contains internal route code **"s02a"** — "Quotes pull in via the protection adapter at s02a." Same code appears as a code-comment route in ProtectionGap.jsx:3. Internal scheme identifiers must never appear in user copy (FCA-tone + plain-English). | ProtectionGap.jsx:48 `Quotes pull in via the protection adapter at s02a.` |
| RK-Z4-01 / RK-Z4-02 (S-03) | NA | FAIL | **FUNCTIONAL** | Confirmed. Protection-need multipliers — **10× income (dependants), 5× income (no dependants), 60% of income for IP** — are HARDCODED in ProtectionGap.jsx, not sourced from `rules-uk.js` or the engine. Violates the global rule "always check rules-uk.js before citing any UK figure" (CLAUDE.md memory `feedback_always_check_rules_uk`). The multipliers themselves are industry-conventional (ABI guidance roughly aligns), so this isn't a wrong-fact issue — it's an **untraceable** figure issue. Move to `UK-2026.1.1.json` under a new `protection.thresholds` block (status: ESTIMATED / industry-convention) or to the engine module. | ProtectionGap.jsx:16–21; `UK-2026.1.1.json` grep — no `lifeCover` / `incomeProtection` / `10×` / `5×` keys. |
| RK-S-05 (RK-Z10-D3 / RK-Z10-D6 / RK-D6-01 / RK-DS sub-chip eyebrow) | FAIL | NA | **FUNCTIONAL** | Internal dimension codes **"D3"**, **"D6"**, and **"D-RISK-D6-SUBSCORING"** rendered in user-facing eyebrows / step headers. The user does not know the engine's internal dimension taxonomy and shouldn't have to. Plain-English fix: drop the code suffix; keep the human label ("Protection coverage", "Estate readiness", "Sub-score breakdown"). | Risk.jsx:1220 `Protection coverage · D3`; Risk.jsx:1233 `Estate readiness · D6`; Risk.jsx:651 `Step N of 5 · D6 questionnaire`; Risk.jsx:753 `Sub-score breakdown · D-RISK-D6-SUBSCORING`. |
| RK-Z5-00 / RK-Z5-EMPTY (S-16) | FAIL | NA | **POLISH** | Engineer-facing copy in two places: card title says **"Shock Scenarios — recomputed by engine"** (the user does not need to know the recompute happens server-side) and empty state says **"No shock results available — engine returned empty."** Plain-English fix: title = "Shock Scenarios" or "Stress Tests"; empty = "Nothing to stress-test yet — add more of your finances to see what a shock would do." | Risk.jsx:1405 `Shock Scenarios — recomputed by engine`; Risk.jsx:1410 `No shock results available — engine returned empty.` |
| RK-OVL-02 | FAIL | NA | **POLISH** | Header eyebrow says **"Risk Score · point-in-time"**. "Point-in-time" is internal architectural jargon (it's a contrast against the X28 temporal-view, which the user has never been introduced to). Plain-English fix: "Risk Score · right now" or just "Risk Score". | RiskOverlay.jsx:73. |
| RK-Z8-00 | FAIL | NA | **POLISH** | Card eyebrow **"Score History · always live"** — "always live" is internal phrasing meaning "always recomputed against today's data". The user reads it as marketing fluff. Fix: drop the eyebrow or replace with "Updated continuously". | Risk.jsx:931 `Score History … · always live`. |
| RK-Z11-S5 | NA | PASS | NA | Shock picker chip **"Death"** as single word — verified tone-appropriate in context (it's a finance app stress test, not a wellness app). Industry-standard label across underwriter / planner UIs. No change. | Risk.jsx:1029. |
| RK-Z11-S3 / S4 | PASS | PASS | NA | Shock picker chips **"Market −30%"** and **"Rate +2%"** — both reasonable UK 2026 stress assumptions. A 30% equity-market fall is the standard severe-stress used by FCA / PRA stress tests (above 2008 −25% drawdown for FTSE). Base-rate +2% from a current ~4.75% Bank Rate to ~6.75% is a defensible 2-yr-tail shock. Engine drives the math. | Risk.jsx:1027–1028. |
| RK-Z11-01a | FAIL | NA | **POLISH** | Engine action names rendered with `replace(/_/g, ' ')` — e.g. `buy_income_protection` → `buy income protection`. Reads as instruction-prose, not a clean label. Either capitalise / Title-Case or maintain a `MITIGATION_LABELS` map. Borderline pass; flagging for cleanup. | Risk.jsx:1071. |
| RK-Z3-O1 (S-04 inventory) | PASS | PASS | NA | Orbit composite label "COMPOSITE / sum of 7 dims" — verified NOT showing "78/100" (which would duplicate the ring). HIGH 1.4 fix confirmed in code. | Risk.jsx:494–504. |
| RK-Z3-07 (S-20) | PASS | PASS | NA | Behavioural Track special-case verified — renders "Building track record — needs 90 days of activity" in neutral grey when `score === 0`. CRIT 1.3 fix confirmed. Plain-English. | Risk.jsx:275–301. |
| RK-Z0-02 / RK-Z0-03 | PASS | PASS | NA | Hero quote *"If something went wrong tomorrow — would I survive it financially?"* + sub-line — phrased as a **question**, not a promise; FCA-safe. Plain English. | Risk.jsx:1314–1320; RiskOverlay.jsx:144–151. |
| RK-FOOT-01 / RK-FOOT-02 | PASS | PASS | NA | Footer renders `BRAND.disclaimer` ("Not regulated financial advice. Verify decisions with a qualified UK financial adviser.") + `BRAND.rulesVersion` ("UK-2026.1") + `BRAND.dataDate` ("April 2026"). FCA boundary present on both surfaces. | Risk.jsx:1641; RiskOverlay.jsx:165. |
| RK-D6-Q1..Q5 | PASS | PASS | NA | D6 questionnaire copy: every term defined inline ("A LPA lets someone you trust act for you if you lose capacity. Two types: property + finance, and health + welfare"; "Nominations tell your pension or insurance provider who should receive the funds"; "Life insurance written in trust pays out faster and stays outside the estate for inheritance tax"). Plain English exemplary here. **Domain accuracy verified:** LPA two-type split correct (Property & Financial Affairs LPA and Health & Welfare LPA per MCA 2005); life-in-trust + IHT framing correct (proceeds outside the estate); nominations vs trustees framing correct. | Risk.jsx:541–593. |
| RK-Z3-01..07 (RISK_DIM_DESCRIPTIONS) | PASS | PASS | NA | 7 dimension descriptions — all plain English, no internal codes in descriptions, no jargon left untranslated. Behavioural Track description correctly frames "Starts at zero — earns through action" so a 0 score doesn't read as failure. | Risk.jsx:82–90. |
| RK-Z12-N1 / RK-Z12-N2 | PASS | NA | NA | "Start a protection plan →" + footer "Opens the Timeline tab with a protection-plan seed. Full builder ships in Phase 2." — explicit "coming next" copy is acceptable per founder rules; this is honest about state. (Whether the receiving listener exists is a conformance-auditor question, not domain.) | Risk.jsx:1170–1172. |
| RK-Z10-FT | PASS | NA | NA | UniversalAdd footer **"Document storage and policy capture ship in Phase 2 — picking now seeds a 'coming next' follow-up on the Timeline."** — honest "coming next" copy; FCA-safe (no commercial product). | Risk.jsx:1246. |
| RK-Z3-T1/T2/T3 (Radar / Orbit / Bars) | PASS | NA | NA | View labels "RADAR", "ORBIT", "BARS" — slightly technical but tolerable as chart-type labels. Borderline; leave. | Risk.jsx:363. |
| Brand strings (FD-NAME-1 sweep) | PASS | NA | NA | Grep across `src/screens/Risk.jsx` for `Sonuswealth`, `Finio`, `FQ Score`, `FQ ` — **zero matches**. FD-NAME-1 PASS on Risk surface. | Grep output. |
| RK-OVL-08 / S-09 | NA | NA | POLISH | Score renders twice in the overlay (sticky header + Z1 ring card below) because RiskOverlay does NOT pass `suppressPrimaryRing`. Not a domain finding per se but it produces a *third* simultaneous label combination ("Risk Score · point-in-time" + the ring's "Risk Score" centre text) — magnifies the RK-S-01 inconsistency. Worth noting as a domain-tone concern. | RiskOverlay.jsx:157 `<RiskBody entity={entity} />` no `suppressPrimaryRing` prop. |
| RK-CHR-12 | PASS | PASS | NA | Verified — no X28 / FY / RY / TY12 top-bar on Risk full page. `X28TopBar` deliberately not imported (Risk.jsx:53 comment). FD-RK-2 PASS. | Risk.jsx:53. |
| RK-Z7-01 / RK-Z7-02 | NA | NA | NA | Life-event banner copy "Life event detected — review your risk profile" + "N prompts pending. Tap to re-answer affected dimensions." — plain English. (Whether the tap actually works is A2, not domain.) | Risk.jsx:1116–1119. |
| RK-Z11-S1..S5 chips | PASS | PASS | NA | Shock-picker labels all plain English (Job loss / Illness / Market −30% / Rate +2% / Death). Engine slugs `job_loss / illness / market_fall / rate_rise / death` are mapped to clean display labels in UI. | Risk.jsx:1024–1030. |

---

## Domain & UK tax facts — sweep

The Risk surface carries very few hard UK tax figures (CoI / IHT / pension figures live on T&E and Cashflow). Domain risk concentrates in:

| Claim | Verdict | Notes |
|---|---|---|
| Life cover need = 10× income (with dependants) / 5× (without) | **Untraceable (FAIL)** | Industry rule-of-thumb (ABI, AIG, Legal & General all roughly cite 10× target gross income). Not codified in `rules-uk.js`. Must be moved into the rules bundle as ESTIMATED / industry-convention with a footnote, or into the engine. As-is, this is a hardcoded UI number in violation of `feedback_always_check_rules_uk`. |
| IP cover need = 60% of target income | **Untraceable (FAIL)** | Industry maximum (most insurers cap IP benefit at 50–65% of pre-tax salary to preserve return-to-work incentive). Reasonable as a default. Same fix as above — codify in rules. |
| Life-in-trust + IHT exclusion | PASS | Domain-correct: a trust-written policy pays outside the estate for IHT purposes and bypasses probate. Wording in D6 Q4 sub-text is correct and concise. |
| LPA two-type split (property+finance / health+welfare) | PASS | Correct under Mental Capacity Act 2005. D6 Q2 sub-text accurately distinguishes the two. |
| Pension / death-benefit nominations | PASS | Correct — without a nomination, distribution falls to scheme trustees' discretion (or estate, depending on scheme rules). Note: from 6 April 2027 SIPP funds will fall into the estate for IHT (Finance Act 2026, Royal Assent 18 March 2026 — per memory `project_sipp_iht_enacted_2026`); the questionnaire copy does NOT cite this change but doesn't need to — it's a nomination existence question, not an IHT question. |
| Wealth Score / Risk Score formats | RECONCILE-only | Domain auditor confirms the two scores ARE different models (Wealth Score = `calcFQ` 7-dim, Risk Score = `calcRisk` 7-dim) per FD-RK-1. Auditor flags only the **labelling**, not the math. |
| Market −30% / Rate +2% shock magnitudes | PASS | Reasonable UK 2026 stress assumptions. 30% equity drawdown sits between 2008 FTSE −31% and PRA severe-stress scenarios. +2% rate from current Bank Rate is a defensible tail. Engine, not UI, determines values. |

---

## Founder-IP integrity (Reality Engine / PRC-PCC / DER / EBR / canonical CoI)

| Concept | Status on Risk | Verdict |
|---|---|---|
| Cost of Inaction | Not referenced on Risk at all | PASS — CoI lives on T&E / Home per the canon. Risk doesn't claim a CoI definition; doesn't violate skill v1.4 §2.7. |
| PRC / PCC | Not referenced | PASS |
| Reality Engine | Not referenced | PASS |
| Drawdown Efficiency Ratio | Not referenced (correctly — DER lives on Cashflow / MyMoney) | PASS |
| Effective Beneficiary Rate | Not referenced | PASS |

Risk does not invent any founder-IP definitions. Clean.

---

## FCA boundary (information-not-advice)

- Disclaimer present on both surfaces (PASS).
- No "you should" / "we recommend" copy detected. Cards use neutral framings ("Top 3 for Risk", "What would help most", "Suggested: 10× income").
- "Suggested: 10× income" / "Suggested: 60% of target income" — borderline. **"Suggested"** is acceptable FCA framing (it's information / guidance, not advice). Provided the multiplier itself is justified (see untraceable finding above), the framing is OK.
- D6 questionnaire options labelled with `good / warn / bad` tones internally but the user-visible labels are neutral ("Yes — current and reviewed", "No will / not sure"). PASS.
- Ask Sonu seed questions (RISK_AI_1..8) read as **questions the user might ask**, not statements of advice. PASS.

---

## Coverage

Inventory rows examined for A5 / domain content (rows with copy, figures, or terms a non-expert wouldn't know): **67 rows** out of ~135 total. The remaining ~68 rows are visual / NA / re-instance rows that don't carry domain content (radar guide polygons, sticky-positioning controls, range-picker chrome, etc.).

`Coverage = 67/67 verified for the A5/domain dimension. Pass rate = 51 / (51+16) = 76%.`

---

## RETURN line (for orchestrator)

**RK domain: 51 PASS, 16 FAIL (1 DB, 11 F, 4 P).**

The single DEMO-BLOCKING is the RK-S-01 label inconsistency on the primary anchor — "Safety score · primary" + "Risk Score" + "Health score" all on the same screen block, none of them matching `BRAND.riskScore` / `BRAND.score`. Fix is one-line copy edits in Risk.jsx (1513, 1535) and RiskOverlay.jsx (73). Until then, the demo presents three names for two scores at the most-looked-at element on the screen.
