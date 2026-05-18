---
Title: Home Screen — Stage B Pass-1 — Merged Audit Summary
Version: pass-1-stage-b
Date: 2026-05-18
Component: src/screens/HomeScreen.jsx v2.1 + src/components/Home/*
Inventory: home-inventory-v1.md (v1, 17 May 2026)
Auditors: A1 Conformance · A2/A3/A4 Interaction · A6 Reconciliation · A5 Domain · A5-Scenario
---

## 1. Severity counts

| Severity | Count |
|----------|-------|
| DEMO-BLOCKING | 1 |
| FUNCTIONAL | 12 |
| POLISH | 0 |
| DECISION-NEEDED | 3 |

---

## 2. DEMO-BLOCKING findings

| ID | Source | Element | One-line description | File:line |
|----|--------|---------|---------------------|-----------|
| INT-01 | interaction.md | H-ACT-01 / APQDrillPanel | Pension drawdown routes to 'tax' from APQDrillPanel; should be 'money' (MyMoney owns the doing per FD-CROSS-1) | HomeScreen.jsx:1105 and HomeScreen.jsx:117 |

Fix: L117 change 'pension-drawdown': 'tax' to 'money'. L1105 change onNav?.('tax') to onNav?.('money') or open PensionDrawdownPanel. The ActionsCard "Show me how" button already correctly opens PensionDrawdownPanel.

---

## 3. FUNCTIONAL findings (all 12)

| ID | Source | Element | Issue |
|----|--------|---------|-------|
| INT-02 | interaction.md | ACTION_ROUTE_OVERRIDE L117 | 'pension-drawdown': 'tax' wrong in map — latent bug compensated in ActionsCard but not APQDrillPanel |
| CON-01 | conformance.md | H-ACT-00 header | Says "What to do next" — no count label per inventory ("6 · ranked by impact") |
| REC-01 | reconciliation.md | H-ANCH-01 vs H-RAD-09 | Net Worth format drift: fmt() gives £3.63m; fmtNW() in RadarAnchor gives £3.63M — seed S-06 confirmed |
| REC-02 | reconciliation.md | CoIDrillPanel | COI_DOMAIN_META has 10 keys; engine has 12+ domains — missing domains silently dropped; total != sum of rows |
| DOM-01 | domain.md | AnchorRow donut L304 | Target score 68 hardcoded — should derive from entity plan target or engine constant |
| DOM-02 | domain.md | H-ANCH-04 label | "Cost of Inaction" unexplained inline — jargon for non-expert users |
| DOM-03 | domain.md | StateTilesCard | "FI Ratio" label is jargon; sub-text only partial explanation |
| DOM-04 | domain.md | SippIhtCountdown | "SIPP" and "IHT" acronyms unexplained inline |
| DOM-05 | domain.md | ActionsCard severity badges | CRIT/HIGH/MED/LOW have no legend or tooltip |
| DOM-06 | domain.md | AnchorRow donut gold arc | Gold dashed reference ring at 68% has no label |
| SCEN-04 | scenario.md | care scenario sub-text | "LPA" unexpanded (Lasting Power of Attorney) |
| SCEN-05 | scenario.md | business scenario sub-text | "BADR" unexpanded (Business Asset Disposal Relief) |

---

## 4. Coverage

Inventory rows: 57 approx (v1 including sub-rows)
Rows assessed: 56
PASS: 44 | FAIL: 2 | UNVERIFIED: 2 | UNLISTED: 6
Coverage: 56/57 = 98%

---

## 5. Top 3 fix priorities

P1 DEMO-BLOCKING — Fix pension drawdown routing
HomeScreen.jsx:117 change 'pension-drawdown': 'tax' to 'money'
HomeScreen.jsx:1105 change onNav?.('tax') to onNav?.('money') in APQDrillPanel

P2 FUNCTIONAL — Fix Net Worth format (seed S-06)
RadarAnchor.jsx: delete local fmtNW() function (L44-49); import and use shared fmt() from fq-calculator.js

P3 FUNCTIONAL — Expand CoIDrillPanel domain coverage
HomeScreen.jsx COI_DOMAIN_META (L932-943): add missing domains from totalCoI() byDomain output; at minimum add sipp_iht

---

## 6. Seeds resolved vs unresolved

S-01 DEMO-BLOCKING confirmed — APQDrillPanel routes to tax; ActionsCard Show me how is correct
S-02 FUNCTIONAL confirmed — INT-02 above
S-03 RESOLVED — Show me how now opens PensionDrawdownPanel (ACTION), not describe-only modal
S-04 UNVERIFIED — requires runtime
S-05 UNVERIFIED — CoI 2031 projection figure requires runtime
S-06 FUNCTIONAL confirmed — REC-01
S-07 RESOLVED — no stray 0% bar in v2.1
S-08 RESOLVED — copy says Timeline tab; onNav('timeline') correct
S-09 PASS — no Caelixa/Finio in user-facing copy
S-10 PASS — See all 12 confirmed; FD-1 satisfied
S-11 PASS conditional — DE delivers time projection

---

## 7. DECISION-NEEDED

D-CON-1: SippIhtCountdown not in inventory v1 — add to v2 or Wave 7 scope?
D-CON-2: StateTilesCard 6-tile row not in inventory v1 — add or flag vs FD-3 frozen layout?
D-CON-3: Header copy "What to do next" vs inventory "6 · ranked by impact" — accept build copy?
