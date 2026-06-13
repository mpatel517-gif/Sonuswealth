Title: Master Item Tracker — every item raised, one place
Version: 1.0
Date: 2026-06-13
Status: OPEN
Cluster: All
File name: 0-Active/MASTER-ITEM-TRACKER.md
Purpose: The single consolidated list of every item the founder raised across this
chat and prior ones, with honest status. Supersedes scattered tracking (task list,
memory, review-issues/*). Update as items close.

**Summary:** one tracker covering the original 13-item UX list, the import/validation
work, the "themes not yet fixed" set, and older registers needing re-verification.
**Tags:** #all-clusters #tracking
**Updated:** 2026-06-13

Status key: ✅ done+verified · 🔄 partial · ☐ open · ↗ engine/data-layer · ⟳ needs re-verify vs current build

---

## A. The original 13-item list (+ import, item 14)

| # | Item | Status | Where |
|---|------|--------|-------|
| 1 | Horizon shows last 5 years (per-year tax record) | ✅ | `TaxYearHistory.jsx` in T&E; ties to SA £9,249 |
| 2 | Reports hard to reach | ✅ | Chrome "⎙ Reports" chip + Dashboard route (#41) |
| 3 | Tax rules 2026/27 hardcoded in copy | ✅ | tax-copy sweep → `TAX.taxYear` (#39) |
| 4 | Dead Today/Future/Plan/WhatIf tabs | ✅ | X28 `modes` prop; per-tab pruning (#38) |
| 5 | Logical drawers, not long lists | 🔄 | T&E/SA/Timeline drawered; **remaining long lists open (#44)** |
| 6 | Everything drill-downable | 🔄 | hero/most surfaces drill; **sweep remaining (#44)** |
| 7 | Risk + Timeline reviewed properly | ✅ | Risk (#42) + Timeline drawers (#43) real passes |
| 8 | Reports formatted terribly | ✅ | `@media print` Theme F + ReportsViewer printable (#41) |
| 9 | Can't make decisions from the info | ✅ | decision-path pattern (#45) |
| 10 | What's the correct decision path | ✅ | DeficitBanner → options → "see what each does" (#45) |
| 11 | Blue Ask pill + −£900 hero dominates Home | ✅ | calm search prompt + compact DeficitBannerView (#36) |
| 12 | Data capture — see functions on screen | ✅ | promoted out of More menu; chrome chip (#12/#37) |
| 13 | Self-assessment layout → collapsible | ✅ | SectionDrawer per SA page (#40) |
| 14 | Import buttons dead + taxonomy validation | ✅ | VTM engine + spreadsheet mapping grid + grouping (#47/#48) |

## B. Import / data-integrity (founder's "no number to the wrong account")

| Item | Status | Where |
|------|--------|-------|
| Validation engine (classify→target→validate→commit) | ✅ | `import-validation.js`; strict classifier (isa→loan hazard fixed) |
| Spreadsheet → mapping-review grid | ✅ | `SpreadsheetImport.jsx`; verified live (gate holds, junk blocks) |
| Liability target dedup (no duplicate mortgage) | ✅ | `resolveTarget` scans liabilities (verified: matched) |
| Key activation for real parsing | ✅ | env-driven, zero source edits; `KEY-ACTIVATION-STEPS.md` (founder runs) |
| Share VTM gate across manual + parsed FP-5 paths | ☐ | #49 — today only spreadsheet uses it |
| `classifyAsset('isa')` → null (ISA is a wrapper) | ☐ | #49 |
| Audit non-strict `classifyLiability` write-path callers | ☐ | #49 |

## C. "Themes reported and not fixed" — deferred from P1–P7 / earlier audits

| Theme | Item | Status |
|-------|------|--------|
| A | `targetIncome` `||30000` vs `||50000` inconsistency | ☐ ↗ needs golden-vector + tie-out run |
| B/C | methodology drill + decision-path onto hero numbers (NW, IHT, retirement) | 🔄 ↗ pattern exists; roll-out incomplete |
| D | live-path audit of dead-pathed Liabilities/Pensions modellers | ☐ (memory: built but possibly unreachable) |
| F | ~17 inline side-stripe borders + ~29 sub-11px typography elements | 🔄 (de-striped several; full sweep open) |
| — | Risk a11y: 0 semantic headings / 11 eyebrow-divs | ☐ per-instance pass |

## D. Older registers — re-verify against current build (⟳)

These predate recent work and may be partly resolved. Each needs a live check before action.

| Source | Item | Status |
|--------|------|--------|
| `_extracted-issues.txt` | "Move choices next to money sections — looks bare" | ⟳ |
| `_extracted-issues.txt` | 2 info-only tiles should be drillable | ⟳ (overlaps #6/#44) |
| `_extracted-issues.txt` | Drill → "back to MyMoney to see details" | ⟳ |
| `_extracted-issues.txt` | Only 6 cashflow tiles — research more; correct sequence; sparklines on all | ⟳ |
| `_extracted-issues.txt` | "Monthly flow −11k vs cashflow −7k don't match" | ⟳ ↗ (memory: surplus-clamp / NET=surplus−deficit) |
| `_extracted-issues.txt` | Unify "dig in" / "view detail" label across screens | ⟳ |
| `mymoney-cashflow-sweep-register.md` | open rows | ⟳ |
| `temporal-drilldown-audit-2026-06-02.md` | P1 projection-unify, P2 tax-copy, P3 drillability, P4 leaks | 🔄 (P0 fixed; rest queued) |

## E. Founder-gated / external (not mine to close)

| Item | Status |
|------|--------|
| Rotate exposed Supabase service_role + DeepSeek keys | ☐ founder |
| Set ANTHROPIC_API_KEY secret + deploy parse-document | ☐ founder |
| Open-banking vendor decision (TrueLayer/Yapily) | ☐ founder decision |

---

## Proposed order (disjoint code areas first, engine-risk serial)

1. **#44** drawers/drill sweep on remaining long lists (UI, low risk) — closes 13-list #5/#6.
2. **#49** share VTM gate across manual + parsed paths + isa-wrapper (data integrity, finishes import).
3. **D-register re-verify** (⟳ pass) — one live sweep, mark each done/real-open; fold real-opens here.
4. **Theme F** side-stripe + typography sweep (mechanical, grep-driven).
5. **Theme B/C** methodology+decision-path roll-out onto hero numbers.
6. **Theme A** targetIncome reconciliation (engine; golden-vectors + tie-out gate).
7. **Theme D** dead-path modeller audit + Risk a11y headings.

Each step: build green + live MCP verify + commit/push per CLAUDE.md §9 / §9.5.
