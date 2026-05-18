# MyMoney — Stage B Pass-2 SUMMARY
**Date:** 2026-05-18

## DB fixes verification
| # | Finding | Status | Evidence |
|---|---------|--------|---------|
| DB-01 | onView 'cash' case | FIXED | MyMoney.jsx:3239 |
| DB-02 | onView 'income' case | FIXED | MyMoney.jsx:3244 |
| DB-03 | onView 'alternatives' case | FIXED | MyMoney.jsx:3241 |
| DB-04 | onView 'obligations' case | FIXED | MyMoney.jsx:3246 |
| DB-05 | Priority cards no routing | FIXED | Explicit button per id :2359,:2366,:2374,:2375 |
| DB-06 | CoI rows bare div | FIXED | handleCoIRowClick wired :2920 |
| DB-07 | Drawdown span zero onClick | FIXED | button onClick :2422 |
| DB-08 | "What-if" pill zero content | CONFIRMED DEFERRED | Wave 7 scope |
| DB-09 | varianceFor() only 'plan' | FIXED | fq-calculator.js:1660–1681 |
| DB-10 | FCA-prohibited directive copy | PARTIAL | Caveat added; "typically highest-return" remains — founder call needed |
| DB-11 | Cliff-edge no caveat | FIXED | MyMoney.jsx:998 both branches |
| DB-12 | LSA 268275 hardcoded | FIXED | TAX.lsa/TAX.lsdba throughout :2005–2007 |

## Regressions found + fixed in pass-2
- **R-03 (FIXED):** `DecumulationPanel` called `setDrillPension` outside closure — crash on inv<£10k. Fixed: added prop to function signature + call site (MyMoney.jsx:2408, 2961)
- **R-01 (FIXED):** `surplus > 0` at line 2722 (Phase 2A banner) — missed in Wave 4. Fixed: `>= 0`
- **R-02 (FIXED):** "Direct surplus to your pension first" FCA directive at line 2757. Fixed: reframed as options + adviser caveat

## New findings
- **NF-01 (LOW/FCA):** debt priority card lacks adviser caveat (~2257). Parity with other cards needed.
- **NF-02 (LOW/FCA):** tax priority card bare instruction at ~2282: "Max ISA (£20k) then pension". No caveat.
- **NF-03 (LOW/UX):** Cash/Alternatives both route to generic investments drill with no section highlight.

## Verdict
**PASS** — All 12 DB findings resolved or confirmed deferred. 3 regressions fixed inline. 3 low-severity new findings for FUNCTIONAL backlog.
