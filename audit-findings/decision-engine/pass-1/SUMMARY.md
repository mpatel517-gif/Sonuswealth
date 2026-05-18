---
Title: Decision Engine — Pass 1 Audit Summary
Version: 1.0
Date: 2026-05-18
Status: DOCUMENTED
Cluster: 10-All Clusters / Audit
File name: SUMMARY.md
Purpose: Merged summary across all 5 auditors. Counts, DEMO-BLOCKING table, coverage, top 3 fix priorities.
---

## 1. Severity counts

| Severity | Count |
|----------|-------|
| DEMO-BLOCKING | 13 |
| FUNCTIONAL | 13 |
| POLISH | 0 |
| DECISION-NEEDED | 1 |
| UNLISTED | 3 |

---

## 2. All DEMO-BLOCKING findings

| # | ID(s) | Finding | Seed |
|---|-------|---------|------|
| DB-01 | DE-ERR-01 | VITE_ANTHROPIC_API_KEY not set surfaced as end-user error message | S-02 |
| DB-02 | DE-ERR-04 / DE-OPT-04 | Options count not enforced — 2 or 5 options render silently, FD-DE-1 violated | S-03/S-05 |
| DB-03 | DE-IDLE-04/06 / DE-OPT-07 / DE-TREE-11 | tree.horizon not required in schema — starter chips produce trees with no time-projection | S-12 |
| DB-04 | DE-TREE-03 / DE-OPT-CARD-05 | FCA-rewrite brand filter covers consequence text only — tree.statement, option names, rationale, recommendation NOT filtered. Caelixa/Finio drift undetected. FD-NAME-1. | S-14 |
| DB-05 | DE-OPT-CARD-09 | LLM-invented metric keys bypass engine registry — values render as apparent facts | S-07 |
| DB-06 | DE-ENT-01 | HomeScreen has no entry to DecisionEngineV2 — Ask panel only | S-15 |
| DB-07 | DE-ENT-02 | Ask.jsx intent=act sets showActionChips, NOT setDecisionEngine. DE tree never opened. Silent FD-CROSS-1 bypass. | S-13 |
| DB-08 | DE-ENT-08 | Commit exit: planId returned but modal closes without Timeline navigation. No plan confirmation shown. | S-16 |
| DB-09 | (C1 scenario) | Non-engine-validated consequence values not anchored to user entity snapshot | S-07 |
| DB-10 | (C2 scenario) | Time-projection mandatory per FD-DE-1 but tree.horizon optional; zero enforcement | S-12 |
| DB-11 | (C3 count) | FD-DE-1 4-option pattern unguarded — any LLM run can return 2 or 3 options | S-03 |
| DB-12 | (C5 scenario) | Commit closes modal without reaching owning surface; sequence steps have no surface links | S-16/S-08 |
| DB-13 | (C7 brand) | Brand filter gap makes FD-NAME-1 unenforceable at runtime for option names and decision statement | S-14 |

Unique root causes: 8 (DB-09..13 restate DB-05/03/02/08/04).

---

## 3. Coverage

Total inventory rows: 67. Rows with verdict: 67. Coverage = 100%.
PASS: 44. FAIL (any severity): 23. Pass rate: 66%.

---

## 4. Top 3 fix priorities

### Priority 1 — Extend brand filter to ALL user-visible string fields (DB-04 / DB-13)

FD-NAME-1 is DEMO-BLOCKING locked. One LLM run outputting "Caelixa Score" in tree.statement kills a demo.
Fix: in fca-rewrite.js, apply fcaRewriteTree() to tree.statement, option name/summary/rationale, and tree.recommendation.rationale before returning from tree-generator.js.
Effort: Low.

### Priority 2 — Fix commit exit routing + add time-projection + option count guards (DB-08 + DB-02 + DB-03)

These three together determine whether the DE core loop (submit → options → commit) works end-to-end.
- Commit: after onCommit({planId}), navigate to Timeline with planId
- Schema: add required horizon field to option object in tree-generator JSON schema
- Count guard: validate options.length === 4 after generation; retry or throw if not
Effort: Medium.

### Priority 3 — Wire Ask.jsx intent=act to open DE tree (DB-07)

Most-used DE entry path is a silent bypass. Users asking decision-shaped questions get Ask inline chips not a DE tree.
Fix: change Ask.jsx action === 'act' handler from setShowActionChips(true) to setDecisionEngine({open:true, initialQuery}) and confirm DecisionEngineV2 panel is mounted in Ask parent.
Effort: Low.

---

## 5. DECISION-NEEDED

DE-ENT-04: MyMoney drawdown currently routes to Cashflow per FD-CROSS-1. Should drawdown option-weighing (UFPLS vs FAD vs annuity) also spawn a DE tree? Needs founder closure.
