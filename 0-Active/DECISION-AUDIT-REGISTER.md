# Decision-Engine Audit Register (40 decisions × BM-1..BM-16)

**Status:** DOCUMENTED · **Updated:** 2026-06-06 · **Source:** multi-agent audit vs [DECISION-BENCHMARK.md](DECISION-BENCHMARK.md), adversarially verified.
**Summary:** 180 findings across 40 decisions; 0 confirmed DEMO-BLOCKING (all reviewed ones demoted to FUNCTIONAL); ~120 FUNCTIONAL, ~55 POLISH. Five-to-seven shared fixes clear the overwhelming majority.

## Benchmark coverage (decisions failing each item)
| BM | Theme | Count |
|---|---|---|
| BM-1 | Unknowns must be explicit/adjustable `estimated` assumptions | ~18 |
| BM-2 | No hardcoded UK tax figures | ~5 |
| BM-3 | Right metric bucket + honest label | **~28** |
| BM-4 | Correct sign of tax/IHT delta | 4 (DE-15,29,35,36) |
| BM-5 | Post-Apr-2027 pension-in-estate | 2 (DE-04,09) |
| BM-6 | Option-aware factor set (not identical chips) | ~14 |
| BM-7 | Income options quantify tax + net "you keep" | ~14 |
| BM-8 | One label everywhere for one quantity | ~8 |
| BM-9 | Right comparison axis; no fabricated proxy ranking | ~10 |
| BM-10 | Per-option what-if (not isProperty-gated) | ~17 |
| BM-11 | Lever flows through to ranking | ~8 + all engine paths |
| BM-12 | Per-decision methodology rules | **all 40** |
| BM-14 | Multi-factor Answer | 1 (DE-34) |
| BM-15 | No product endorsement / directive framing | 3 (DE-27,28,34) |

## Generalisable fixes (do first)
- **G-1 (BM-12, clears 40):** `decision-engine.js:1268` `methodology.rules` is a hardcoded pension/IHT trio for every decision → replace with a per-`decisionType` rules map emitting the rules the calc actually used.
- **G-6 (BM-3/8, clears ~28):** `NW_METRIC_LABEL` is consumed only in StepOptions → thread it into StepAnswer, StepCommit, BeforeAfterBar, buildAdviserSummary so a tax saving never reads "Net worth" on the verdict. Add missing keys (DE-03 'Tax relief', DE-22/23/24/25/35 'Tax saved', DE-26/27 'Income-tax relief', DE-31 'Savings drawn', DE-40 'Care cost').
- **G-2 (BM-6, clears ~14):** suppress any £0 chip (kills "Inheritance tax £0" noise) + per-decision factor spec.
- **G-4 (BM-10, clears ~17):** generalise WhatIfPanel beyond `isProperty` via `leverFor` + `simulateAction` params.
- **G-5 (BM-1, clears ~18):** route silent market literals through labelled `status:'estimated'` assumption rows bound to entity data.
- **G-3 (BM-9, clears ~6):** smart `chartKey` — force IHT/income primary where nw is a proxy.
- **G-7 (BM-11, clears ~8):** rank engine paths on `simulation.delta`, not the `riskMap[riskLevel]` heuristic.

## Wave plan
- **Wave 1 (front-end, no math risk, biggest coverage):** G-6 + G-2 + G-1 + BM-15 copy-strip. Verifiable by DOM scrape. ← START HERE.
- **Wave 2 (interactivity wiring):** G-4 + G-7 + G-5 + G-3.
- **Wave 3 (engine income-tax & sign — GATE ON independent calc-audit):** BM-7 residue (DE-01,02,05,07,08,11,24,25,33,37,38,40), BM-4 (DE-15,29,35,36).
- **Wave 4 (literals→TAX + compliance):** BM-2 removals; BM-15 (pull DE-27/28 product-name strip into Wave 1).

**Coverage boundary:** this is a STRUCTURAL audit (right bucket/label/provenance/option-awareness/lever-flow). BM-2/4/7 assert numbers are *correct* — only the independent golden-vector calc-audit certifies that. Do NOT mark Waves 3–4 done on green build + passing tests.

## Per-decision residue (after generalisations)
DE-01 literal 0.20/15000→`_marginalRate`; +drawdown income-tax rows. DE-02 deferral uplift vs copy mismatch. DE-04 summary claims IHT relief that engine zeroes (post-2027). DE-05 add employee NI. DE-07 read real GIA gain not 0.15. DE-08 compute each option's own £ not a spread. DE-09 `sell_isa` estate 250k pre-enactment date-aware. DE-10 per-deal interest + rate-rise. DE-11 §24 reads rental then discards — surface gross/net. DE-15 trust_gift ignores CLT entry charge. DE-16 trustValue||100000 no lever. DE-17 all wills iht=−8k/nw=0 identical. DE-18 deputyCost 3500 flat. DE-19/20 premium proxy `cover×0.002`. DE-21 no claim-quality axis. DE-22/23 drop ×1.1 shelter fudge. DE-24 isa_max 0.8× meaningless. DE-25 divRate/corpTax computed then unused. DE-26 cap relief at liability. DE-27 strip "Octopus/Foresight/Pembroke" + model dividend stream. DE-28 strip "Octopus AIM IHT" + chartKey→IHT. DE-29 legacy iht:1 inherits lifetime reclaim as death benefit. DE-30 all inputs silent guesses, no lever. DE-32 copy "40-45%" vs `_marginalRate`. DE-33 property never quantifies rent/§24; bank_hold flatlines £0. DE-34 nwDelta=0×factor → identical options, null chart on divorce. DE-35 no_badr loses BPR but shows £0 IHT. DE-36 model each option's real cash not 1/0.7/0.2 scaling. DE-37 emit income delta not NW proxy. DE-38 guaranteed income £/yr primary; annuity 0.50 needs lever. DE-39 0.15 gain on total NW. DE-40 deferredCost + ltc_insurance never modelled.
