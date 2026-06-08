Title: Decision Engine (DE-01…DE-40) Correctness Sweep — fix map
Version: 1.0
Date: 2026-06-05
Status: DOCUMENTED
Cluster: 3-Engine (decision-engine.js)
File name: de-correctness-audit-2026-06-05.md
Purpose: Inventory every hardcoded / stale financial figure in src/engine/decision-engine.js and map it to the canonical TAX bundle key (or a new key to add). The correctness floor under all 40 cases before any depth work. Founder directive 2026-06-05: "fix all 40 for correctness first."

**Summary:** Every £/% literal in simulateAction + enumeratePaths + generateRecommendation mapped to its TAX bundle key; 4 missing keys to add to _buildTAX; the stale figures (BADR 14%→18%, VCT 30%→20%, S455 33.75%→bundle, director salary £9,100→£5,000) are factually wrong for 2026/27, not just hardcoded.
**Tags:** #engine #decision-engine #uk-tax #correctness #bundle
**Updated:** 2026-06-05

> Rule: NO £/% financial figure literal in decision-engine.js. Every one reads from `TAX` (from `_bundle.js`). Heuristics that are NOT tax figures (growth %, market rates, operational fees like LPA registration, deputy cost, voluntary NIC price) may stay literal but should carry a comment. Behavioural proxies (e.g. `Math.max(0, 80-age)` survival weighting) are model assumptions, not tax — leave.

## A. NEW BUNDLE KEYS TO ADD (_buildTAX in _bundle.js)
| Key | Value | Source |
|---|---|---|
| `redundancyTaxFree` | 30000 | ITEPA 2003 s403 — £30k termination exemption |
| `badrLifetimeLimit` | 1000000 | TCGA 1992 s169N — BADR £1m lifetime cap |
| `jisaAllowance` | 9000 | Junior ISA annual subscription limit |
| `laCareUpperCapital` | 23250 | Care Act 2014 (England) upper capital limit for LA funding |

## B. simulateAction — CALC literals → bundle key
| Case | Literal (current) | Fix |
|---|---|---|
| DE-09 | `(propertyValue-125000)*0.24` | `0.24`→`TAX.cgtHigher`; 125000 gain-proxy → comment as assumed gain base |
| DE-09 | `*0.40` / `*0.10` IHT | `0.40`→`TAX.ihtRate` |
| DE-11 | `Math.min(income,125140)`, `>50270`, `*0.20` | `125140`→`TAX.art`, `50270`→`TAX.brt`, `0.20`→`(TAX.hr-TAX.br)` |
| DE-15 | `annualExempt=3000`, `pet*0.40` | `3000`→`TAX.annualGiftExemption`, `0.40`→`TAX.ihtRate` |
| DE-16 | `*0.40` | `TAX.ihtRate` |
| DE-17 | `(TAX.nrb||325000)+(TAX.rnrb||175000)` | keep (already bundle); drop literal fallbacks |
| DE-22 | `harvested*0.24` | `TAX.cgtHigher` |
| DE-23 | `offset*0.24` | `TAX.cgtHigher` |
| DE-26 | `0.50`/`0.30` relief | `TAX.seisITRate`/`TAX.eisITRate` |
| DE-28 | `bprInvest*0.40` | `TAX.ihtRate` |
| DE-29 | `income>50270`, `*0.20` | `TAX.brt`, `(TAX.hr-TAX.br)` |
| DE-32 | `Math.min(30000,lumpSum)` | `TAX.redundancyTaxFree` |
| DE-34 | `*0.24`, `*0.40` | `TAX.cgtHigher`, `TAX.ihtRate` |
| DE-35 | `*0.14` (STALE), `1000000`, `*0.24` | `TAX.badrRate`, `TAX.badrLifetimeLimit`, `TAX.cgtHigher` |
| DE-36 | `*0.3375` (STALE) | `TAX.s455Rate` |
| DE-39 | `*0.24`, `*0.40` | `TAX.cgtHigher`, `TAX.ihtRate` |
| DE-40 | `carePerYear=60000`, `*0.40` | care cost = market assumption (comment); `0.40`→`TAX.ihtRate` |

## C. COPY (summaries / paths / steps) — STALE or hardcoded → interpolate TAX
| Case | Copy figure | Fix |
|---|---|---|
| DE-25 | "£9,100 (2026 secondary NI threshold)" ×2 (summary+step) | STALE → `TAX.employerNICThreshold` (£5,000) |
| DE-25 | "attract 35.75%" | `TAX.s455Rate`-adjacent? No — dividend upper. `TAX.dividendHR` is 35.75% ✓ keep/verify |
| DE-35 | "reduces CGT to 14%", "first £1m", "standard 24%", "up to £100k" | STALE → `TAX.badrRate`, `TAX.badrLifetimeLimit`, `TAX.cgtHigher`; recompute the £ saving |
| DE-27 | "VCT income tax relief (30%)", "£5k (£1,500 relief)", "£200k (max, 30% relief)" | STALE → `TAX.vctITRate` (20%) |
| DE-36 | "Section 455 charge of 33.75%" | STALE → `TAX.s455Rate` |
| DE-01 | "basic-rate band (£50,270)" (summary, step) | `TAX.brt` |
| DE-03 | "adjusted income > £260,000" | `TAX.taperedAAAdj` |
| DE-07 | "annual exempt amount (£3k)" | `TAX.cgaAllowance` |
| DE-09 | step "24%", "£3,000" | `TAX.cgtHigher`, `TAX.cgaAllowance` |
| DE-15 | "annual exemption (£3k…)", step "£325,000 NRB" | `TAX.annualGiftExemption`, `TAX.nrb` |
| DE-22 | "just £3,000 (2026)" | `TAX.cgaAllowance` |
| DE-30 | "Junior ISA (£9,000/yr)" ×2 | `TAX.jisaAllowance` |
| DE-37 | "CETV exceeds £30,000", path "CETV > £30k" | `TAX.safeguardedAdviceThreshold` |
| DE-40 | "assets fall below £23,250 (England, 2026)" | `TAX.laCareUpperCapital` |
| DE-32 | "first £30,000…/£30k" ×2 | `TAX.redundancyTaxFree` |

## D. LEAVE AS-IS (not tax figures — comment only)
LPA registration £164 (DE-18), deputy cost £3,500 (DE-18), voluntary NIC £824/yr (DE-31), market savings rates 4.5%/~5% (DE-13/14), growth 5-7% proxies, `Math.max(0,80-age)` survival weighting, Gift-Aid 25% (structural), 10%→IHT-36% rule (structural, but 40%/36% could read TAX.ihtRate). EIS/SEIS annual limits £200k/£1m (no bundle key; comment).

## E. VERIFY POST-FIX (agent calc audit)
- DE-35 recompute: BADR saving = `saleProceeds*cgtHigher − min(proceeds,limit)*badrRate − max(0,proceeds-limit)*cgtHigher`. At £500k → 500k*0.24 − 500k*0.18 = £30k saving (was showing £50k at 0.14). Confirm copy "£X saving" matches.
- DE-36: s455 = bal*TAX.s455Rate; confirm > divTax still holds.
- DE-25: copy threshold == calc `optSalary` cap == TAX.employerNICThreshold.
- Grep decision-engine.js for any remaining bare `0.14|0.24|0.40|0.3375|30000|50270|125140|325000|260000|9100|23250` → 0 in tax contexts.
