# Caelixa Master Audit — REBUILD (2026-05-25)

**Engine version:** Sonuswealth-1.0
**Rules versions:** UK-2021.1.1 … UK-2026.1.1 (year-correct, not silently-2026)
**Plan reference:** `~/.claude/plans/why-do-you-have-async-balloon.md`
**Predecessor:** `tests/reports/MASTER-AUDIT-2026-05-21.md`

---

## Headline — rebuild vs 2026-05-21 baseline

| Metric | 2026-05-21 baseline | 2026-05-25 rebuild | Delta |
|---|---|---|---|
| Total runs | 552 | **666** | +114 (mrT + historical now in matrix) |
| PASS | 47 (8.6%) | **579 (86.9%)** | **+532 PASS** |
| WARN | 480 (87.0%) | **64 (9.6%)** | **−416 cleared** |
| FAIL | 19 (3.4%) | **23 (3.5%)** | +4 net (composition very different) |
| Elapsed | 27.6 min | 26.5 min | similar |
| Tokens | 505,800 | 839,995 | +334k (more cells) |
| Cost | $0.25 | **$0.42** | +$0.17 |

PASS rate jumped from 8.6% → 86.9%. The 87% WARN noise from before (missing spousal context, missing income mapping) is gone. **The snapshot.mjs + validator.mjs fixes prescribed on 2026-05-21 worked.**

---

## Transition diff (per cell)

| Transition | Count |
|---|---|
| PASS→PASS | 47 |
| **WARN→PASS** | **468** (the noise cleared) |
| WARN→WARN | 8 |
| **FAIL→PASS** | **12 of 19 (63%)** |
| FAIL→WARN | 6 |
| FAIL→FAIL | 1 (persona-a 2025/26 — same income-tax bug) |
| **WARN→FAIL** | **4** (year-correct rules exposed bugs the 2026-on-everything mask hid) |
| NEW→PASS | 52 (mrT+historical first-run passes) |
| NEW→WARN | 50 (36 mrT C9 couple + 14 misc) |
| **NEW→FAIL** | **18** (new cells, root-cause clustered below) |

---

## The 23 FAILs — clustered by root cause

### Cluster 1 — persona-a (Bruce) historical income tax (5 FAILs)

| Cell | NW | Verdict |
|---|---|---|
| persona-a 2021/22 | £2.73m | Income tax miscalculated + RNRB taper error |
| persona-a 2022/23 | £3.11m | Income tax incorrect for 2022/23 |
| persona-a 2023/24 | £3.64m | Income tax miscalculated; cashflow deficit unaddressed |
| persona-a 2024/25 | £3.57m | Income target not met; cashflow deficit |
| persona-a 2025/26 | £3.73m | Income tax incorrect for basic-rate taxpayer with £96k draw |

**Diagnosis:** REAL engine bug. Income tax computation is wrong for Bruce's decumulation profile when running pre-2026 tax bundles. Baseline hid this (everything ran 2026 rules). Phase A3 made it visible. → Phase C fix.

### Cluster 2 — mrT-landlord IHT (6 FAILs, all years)

All 6 years: `IHT calculation inconsistent: gross estate £1.439M vs net worth £923k`.

**Diagnosis:** VALIDATOR FALSE POSITIVE. The £516k gap = mortgage outstanding (debts reduce NW but not IHT gross estate — correct UK IHT). DeepSeek prompt doesn't model this. → Update `validator.mjs` prompt: "IHT gross estate excludes mortgage/loan deduction unless funeral/charity-bound." Would clear all 6.

### Cluster 3 — historical-series sparse-data fixtures (8 FAILs)

| Persona | Years | Pattern |
|---|---|---|
| persona-series-E | 2022/23, 2023/24, 2026/27 | NW=£0, income=£0, tagged "higher-rate" |
| persona-series-G | 2021/22, 2022/23, 2023/24, 2024/25, 2026/27 | NW=£0, income=£0, tagged "higher-rate" |

**Diagnosis:** FIXTURE DATA QUALITY. Historical-series JSONs are skeletons. Not engine bugs. → Phase D: populate properly, OR exclude from validation matrix.

### Cluster 4 — Cross-border RNRB (3 FAILs)

| Cell | Verdict |
|---|---|
| mrT-uk-in 2025/26 | IHT inconsistent; missing asset allocation |
| mrT-uk-in 2026/27 | Same as above |
| mrT-uk-th 2026/27 | RNRB incorrectly set to £0 for estate under £2M |

**Diagnosis:** REAL engine bug. RNRB should taper £175k→£0 between estate £2m→£2.35m, not jump to £0. → Phase C.

### Cluster 5 — mrT-divorced NW walker (1 FAIL)

`mrT-divorced 2024/25 — Net worth mismatch: assets sum to £525.8k but engine reports £333.3k`

**Diagnosis:** REAL engine bug. NW walker missing divorce-specific asset categories. → Phase C.

### Triage summary

| Cluster | Cells | Type |
|---|---|---|
| 1. Bruce historical income tax | 5 | Real engine bug |
| 2. mrT-landlord IHT | 6 | Validator false positive |
| 3. Historical sparse data | 8 | Fixture data quality |
| 4. Cross-border RNRB | 3 | Real engine bug |
| 5. mrT-divorced NW | 1 | Real engine bug |
| **Real engine bugs** | **9** | (was 19 — 53% reduction) |
| Validator false positives | 6 | (Phase C prompt edit) |
| Fixture quality issues | 8 | (Phase D) |

---

## The 64 WARNs — clustered

- **36 C9 couple-NRB**: 6 mrT couple fixtures × 6 years — engine doesn't read nested `individual.partner`. Documented; Phase C fix.
- **8 WARN→WARN**: known low-data persistent issues.
- **20 misc**: distributed, mostly mild drift signals.

---

## What this validates

1. **The May 22-25 harness edits work.** 468 of 480 WARNs cleared; 12 of 19 FAILs cleared. Was non-obvious before this re-run.
2. **Year-correct bundles surface NEW bugs** previously hidden by silent 2026-on-everything fallback (persona-a historical FAILs).
3. **C8-C12 catch a different bug class than DeepSeek.** C9 found 36 couple-NRB cells; no C12 (math-sanity) hits — those bugs are MyMoney-rendering-side, not engine snapshot.
4. **9 real engine bugs remain** (vs original 19). Phase C entry list.

---

## Phase C entry points

The MyMoney audit can resume on a defensible foundation. Real engine bugs from this audit fold into Phase C's BLOCK list:

1. Bruce historical income tax (5 cells, persona-a 2021/22-2025/26)
2. Cross-border RNRB taper (3 cells, mrT-uk-in × 2 years + mrT-uk-th 2026/27)
3. mrT-divorced NW walker (1 cell)
4. Validator prompt: IHT gross-estate-vs-NW reconciliation (6 false positives to clear)
5. Engine couple detection for nested `individual.partner` shape (36 WARN cells)

Plus the original MyMoney audit findings from `2026-05-25-mymoney-synthesis.md`:
- BLOCK-1: 3 metric tiles wrong (TIME_COVERED, INCOME_BUFFER, CASH cover)
- BLOCK-2: Pension relief overstated 17×
- BLOCK-3: FCA boundary breach in 2 strings
- BLOCK-4: "Optimised" / "STRONG BUFFER" regulated-sounding labels
- BLOCK-5: SIPP £850k silent on IHT-2027 on MyMoney

---

## Reproducibility

```sh
DATA_SOURCE=json node tests/harness/runner.mjs --all-personas --hybrid
node scripts/diff-audit-vs-baseline.mjs <newReport.md>
node scripts/build-coverage-manifest.mjs
```

Reports:
- This audit (raw): `tests/reports/audit-6653d865-1779748100063.md` (390KB+)
- Diff JSON: `tests/reports/audit-diff-*.json`
- Coverage manifest: `tests/coverage-manifest.md`
- Phase A summary: `docs/superpowers/audits/2026-05-25-phase-A-results.md`

---

**Author:** Phase A+B execution (Claude + founder). Completed 2026-05-25.
