# Tie-Out Report — 2026-05-28

Engine canonical readers vs displayed DOM values, per (persona × tieout-key).

**Run:** 2026-05-28T15:01:03.490Z
**Scope:** 13 personas × 9 tieout keys = 117 cells max.

## Summary

| Verdict | Count |
|---|---|
| PASS | 182 |
| FAIL | 0 |
| MISSING_DISPLAY (engine expects a value, DOM has none) | 0 |
| NO_EXPECTED (scraped persona not in expected set) | 0 |

## Balance-sheet consistency (NW vs Assets − Liabilities)

CLAUDE.md §9.5 Gate 2: every hero strip showing NW + Assets + Liabilities must satisfy NW = A − L. This is independent of the engine tie-out — it tests display-layer arithmetic only.

| Persona | Displayed NW | Displayed Assets | Displayed Liabilities | A − L | NW − (A − L) | Verdict |
|---|---|---|---|---|---|---|
| a | £3,900,000 | £4,080,000 | £180,000 | £3,900,000 | £0 | ✅ PASS |
| b | £1,535,000 | £1,535,000 | £0 | £1,535,000 | £0 | ✅ PASS |
| c | £11,109,000 | £11,109,000 | £0 | £11,109,000 | £0 | ✅ PASS |
| d | £51,600 | £80,000 | £28,400 | £51,600 | £0 | ✅ PASS |
| e | £6,260,000 | £6,260,000 | £0 | £6,260,000 | £0 | ✅ PASS |
| f-22 | £-36,600 | £7,400 | £44,000 | £-36,600 | £0 | ✅ PASS |
| f-32 | £132,000 | £458,000 | £326,000 | £132,000 | £0 | ✅ PASS |
| f-45 | £665,000 | £850,000 | £185,000 | £665,000 | £0 | ✅ PASS |
| f-58 | £1,711,000 | £1,753,000 | £42,000 | £1,711,000 | £0 | ✅ PASS |
| f-72 | £1,935,000 | £1,935,000 | £0 | £1,935,000 | £0 | ✅ PASS |
| f-89 | £1,588,000 | £1,588,000 | £0 | £1,588,000 | £0 | ✅ PASS |
| g | £366,000 | £746,000 | £380,000 | £366,000 | £0 | ✅ PASS |
| mrt-core | £698,390 | £1,055,040 | £356,650 | £698,390 | £0 | ✅ PASS |

## Engine ↔ DOM Findings

### ✅ PASS — 163 cells matched

<details><summary>Expand pass detail</summary>

| Persona | Tieout Key | Expected | Scraped |
|---|---|---|---|
| a | `home.nw` | £3,900,000 | £3,900,000 |
| a | `home.monthly-deficit` | £8,167 | £8,167 |
| a | `risk.nw` | £3,900,000 | £3,900,000 |
| a | `timeline.nw` | £3,900,000 | £3,900,000 |
| a | `tax.iht-today` | £1,088,000 | £1,088,000 |
| a | `tax.beneficiary-net` | £1,957,000 | £1,957,000 |
| a | `money.nw` | £3,900,000 | £3,900,000 |
| a | `money.assets` | £4,080,000 | £4,080,000 |
| a | `money.liabilities` | £180,000 | £180,000 |
| a | `money.cat.pensions` | £850,000 | £850,000 |
| a | `money.cat.investments` | £800,000 | £800,000 |
| a | `money.cat.property` | £2,250,000 | £2,250,000 |
| a | `money.cat.cash` | £180,000 | £180,000 |
| b | `home.nw` | £1,535,000 | £1,535,000 |
| b | `home.monthly-deficit` | £4,583 | £4,583 |
| b | `risk.nw` | £1,535,000 | £1,535,000 |
| b | `timeline.nw` | £1,535,000 | £1,535,000 |
| b | `tax.iht-today` | £0 | £0 |
| b | `tax.beneficiary-net` | £913,000 | £913,000 |
| b | `money.nw` | £1,535,000 | £1,535,000 |
| b | `money.assets` | £1,535,000 | £1,535,000 |
| b | `money.liabilities` | £0 | £0 |
| b | `money.cat.pensions` | £480,000 | £480,000 |
| b | `money.cat.investments` | £280,000 | £280,000 |
| b | `money.cat.property` | £340,000 | £340,000 |
| b | `money.cat.cash` | £95,000 | £95,000 |
| c | `home.nw` | £11,109,000 | £11,109,000 |
| c | `risk.nw` | £11,109,000 | £11,109,000 |
| c | `timeline.nw` | £11,109,000 | £11,109,000 |
| c | `tax.iht-today` | £3,766,000 | £3,766,000 |
| c | `tax.beneficiary-net` | £5,974,000 | £5,974,000 |
| c | `money.nw` | £11,109,000 | £11,109,000 |
| c | `money.assets` | £11,109,000 | £11,109,000 |
| c | `money.liabilities` | £0 | £0 |
| c | `money.cat.pensions` | £1,049,000 | £1,049,000 |
| c | `money.cat.investments` | £1,620,000 | £1,620,000 |
| c | `money.cat.property` | £8,000,000 | £8,000,000 |
| c | `money.cat.cash` | £125,000 | £125,000 |
| c | `money.cat.alternatives` | £315,000 | £315,000 |
| d | `home.nw` | £51,600 | £51,600 |
| d | `risk.nw` | £51,600 | £51,600 |
| d | `timeline.nw` | £51,600 | £51,600 |
| d | `tax.iht-today` | £0 | £0 |
| d | `tax.beneficiary-net` | £0 | £0 |
| d | `money.nw` | £51,600 | £51,600 |
| d | `money.assets` | £80,000 | £80,000 |
| d | `money.liabilities` | £28,400 | £28,400 |
| d | `money.cat.pensions` | £48,000 | £48,000 |
| d | `money.cat.investments` | £18,000 | £18,000 |
| d | `money.cat.cash` | £14,000 | £14,000 |
| e | `home.nw` | £6,260,000 | £6,260,000 |
| e | `risk.nw` | £6,260,000 | £6,260,000 |
| e | `timeline.nw` | £6,260,000 | £6,260,000 |
| e | `tax.iht-today` | £1,598,000 | £1,598,000 |
| e | `tax.beneficiary-net` | £3,047,000 | £3,047,000 |
| e | `money.nw` | £6,260,000 | £6,260,000 |
| e | `money.assets` | £6,260,000 | £6,260,000 |
| e | `money.liabilities` | £0 | £0 |
| e | `money.cat.pensions` | £680,000 | £680,000 |
| e | `money.cat.investments` | £3,720,000 | £3,720,000 |
| e | `money.cat.property` | £800,000 | £800,000 |
| e | `money.cat.cash` | £260,000 | £260,000 |
| f-22 | `home.nw` | £-36,600 | £-36,600 |
| f-22 | `risk.nw` | £-36,600 | £-36,600 |
| f-22 | `timeline.nw` | £-36,600 | £-36,600 |
| f-22 | `tax.iht-today` | £0 | £0 |
| f-22 | `tax.beneficiary-net` | £0 | £0 |
| f-22 | `money.nw` | £-36,600 | £-36,600 |
| f-22 | `money.assets` | £7,400 | £7,400 |
| f-22 | `money.liabilities` | £44,000 | £44,000 |
| f-22 | `money.cat.pensions` | £3,200 | £3,200 |
| f-22 | `money.cat.investments` | £1,800 | £1,800 |
| f-22 | `money.cat.cash` | £2,400 | £2,400 |
| f-32 | `home.nw` | £132,000 | £132,000 |
| f-32 | `home.monthly-deficit` | £1,470 | £1,470 |
| f-32 | `risk.nw` | £132,000 | £132,000 |
| f-32 | `timeline.nw` | £132,000 | £132,000 |
| f-32 | `tax.iht-today` | £0 | £0 |
| f-32 | `tax.beneficiary-net` | £170,000 | £170,000 |
| f-32 | `money.nw` | £132,000 | £132,000 |
| f-32 | `money.assets` | £458,000 | £458,000 |
| f-32 | `money.liabilities` | £326,000 | £326,000 |
| f-32 | `money.cat.pensions` | £38,000 | £38,000 |
| f-32 | `money.cat.investments` | £22,000 | £22,000 |
| f-32 | `money.cat.property` | £190,000 | £190,000 |
| f-32 | `money.cat.cash` | £18,000 | £18,000 |
| f-45 | `home.nw` | £665,000 | £665,000 |
| f-45 | `home.monthly-deficit` | £1,050 | £1,050 |
| f-45 | `risk.nw` | £665,000 | £665,000 |
| f-45 | `timeline.nw` | £665,000 | £665,000 |
| f-45 | `tax.iht-today` | £0 | £0 |
| f-45 | `tax.beneficiary-net` | £174,000 | £174,000 |
| f-45 | `money.nw` | £665,000 | £665,000 |
| f-45 | `money.assets` | £850,000 | £850,000 |
| f-45 | `money.liabilities` | £185,000 | £185,000 |
| f-45 | `money.cat.pensions` | £210,000 | £210,000 |
| f-45 | `money.cat.investments` | £88,000 | £88,000 |
| f-45 | `money.cat.property` | £260,000 | £260,000 |
| f-45 | `money.cat.cash` | £32,000 | £32,000 |
| f-58 | `home.nw` | £1,711,000 | £1,711,000 |
| f-58 | `home.monthly-deficit` | £480 | £480 |
| f-58 | `risk.nw` | £1,711,000 | £1,711,000 |
| f-58 | `timeline.nw` | £1,711,000 | £1,711,000 |
| f-58 | `tax.iht-today` | £0 | £0 |
| f-58 | `tax.beneficiary-net` | £652,000 | £652,000 |
| f-58 | `money.nw` | £1,711,000 | £1,711,000 |
| f-58 | `money.assets` | £1,753,000 | £1,753,000 |
| f-58 | `money.liabilities` | £42,000 | £42,000 |
| f-58 | `money.cat.pensions` | £680,000 | £680,000 |
| f-58 | `money.cat.investments` | £325,000 | £325,000 |
| f-58 | `money.cat.property` | £340,000 | £340,000 |
| f-58 | `money.cat.cash` | £68,000 | £68,000 |
| f-72 | `home.nw` | £1,935,000 | £1,935,000 |
| f-72 | `home.monthly-deficit` | £1,400 | £1,400 |
| f-72 | `risk.nw` | £1,935,000 | £1,935,000 |
| f-72 | `timeline.nw` | £1,935,000 | £1,935,000 |
| f-72 | `tax.iht-today` | £0 | £0 |
| f-72 | `tax.beneficiary-net` | £923,000 | £923,000 |
| f-72 | `money.nw` | £1,935,000 | £1,935,000 |
| f-72 | `money.assets` | £1,935,000 | £1,935,000 |
| f-72 | `money.liabilities` | £0 | £0 |
| f-72 | `money.cat.pensions` | £520,000 | £520,000 |
| f-72 | `money.cat.investments` | £430,000 | £430,000 |
| f-72 | `money.cat.property` | £410,000 | £410,000 |
| f-72 | `money.cat.cash` | £165,000 | £165,000 |
| f-89 | `home.nw` | £1,588,000 | £1,588,000 |
| f-89 | `home.monthly-deficit` | £2,000 | £2,000 |
| f-89 | `risk.nw` | £1,588,000 | £1,588,000 |
| f-89 | `timeline.nw` | £1,588,000 | £1,588,000 |
| f-89 | `tax.iht-today` | £385,200 | £385,200 |
| f-89 | `tax.beneficiary-net` | £1,077,800 | £1,077,800 |
| f-89 | `money.nw` | £1,588,000 | £1,588,000 |
| f-89 | `money.assets` | £1,588,000 | £1,588,000 |
| f-89 | `money.liabilities` | £0 | £0 |
| f-89 | `money.cat.pensions` | £120,000 | £120,000 |
| f-89 | `money.cat.investments` | £460,000 | £460,000 |
| f-89 | `money.cat.property` | £920,000 | £920,000 |
| f-89 | `money.cat.cash` | £88,000 | £88,000 |
| g | `home.nw` | £366,000 | £366,000 |
| g | `home.monthly-deficit` | £1,503 | £1,503 |
| g | `risk.nw` | £366,000 | £366,000 |
| g | `timeline.nw` | £366,000 | £366,000 |
| g | `tax.iht-today` | £0 | £0 |
| g | `tax.beneficiary-net` | £279,000 | £279,000 |
| g | `money.nw` | £366,000 | £366,000 |
| g | `money.assets` | £746,000 | £746,000 |
| g | `money.liabilities` | £380,000 | £380,000 |
| g | `money.cat.pensions` | £82,000 | £82,000 |
| g | `money.cat.investments` | £64,000 | £64,000 |
| g | `money.cat.property` | £580,000 | £580,000 |
| g | `money.cat.cash` | £20,000 | £20,000 |
| mrt-core | `home.nw` | £698,390 | £698,390 |
| mrt-core | `home.monthly-deficit` | £1,600 | £1,600 |
| mrt-core | `risk.nw` | £698,390 | £698,390 |
| mrt-core | `timeline.nw` | £698,390 | £698,390 |
| mrt-core | `tax.iht-today` | £0 | £0 |
| mrt-core | `tax.beneficiary-net` | £321,250 | £321,250 |
| mrt-core | `money.nw` | £698,390 | £698,390 |
| mrt-core | `money.assets` | £1,055,040 | £1,055,040 |
| mrt-core | `money.liabilities` | £356,650 | £356,650 |
| mrt-core | `money.cat.pensions` | £205,500 | £205,500 |
| mrt-core | `money.cat.property` | £583,000 | £583,000 |
| mrt-core | `money.cat.cash` | £28,500 | £28,500 |

</details>
