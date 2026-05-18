# Settings — Pass-1 Audit SUMMARY
**Screen:** Sonuswealth Settings (`src/screens/Settings.jsx` + `src/screens/Account.jsx`)
**Inventory:** `settings-inventory-v1.md` (99 rows, v1)
**Date:** 2026-05-18
**Auditors completed:** A1 (conformance), A2/A3/A4 (interaction), A6 (reconciliation), A5 (domain), scenario

---

## 1. Severity counts

| Severity | Count |
|----------|-------|
| DEMO-BLOCKING | 13 unique IDs |
| FUNCTIONAL | 11 |
| POLISH | 14 |
| PASS | 86 / 99 rows |

Coverage: **100%** (99/99 rows, 0 UNVERIFIED)

---

## 2. All DEMO-BLOCKING findings

| # | ID(s) | Finding | Evidence |
|---|-------|---------|----------|
| DB-1 | ST-PLAN-07..10 | Four PlanRow elements display Current/Stale/Not-started chips but have NO onClick handler. Interactive-looking-but-dead. Founder rule §9 explicit fail. | Settings.jsx:79-125, 446-448 |
| DB-2 | ST-AB-D08 | About panel hardcodes value="FINIO-1.0" for Scoring engine. Legacy brand string user-facing. FD-NAME-1 violation. fq.scoringVersion already available in scope. | Settings.jsx:600 |
| DB-3 | ST-AB-D09 | About panel hardcodes value="RISK-1.0" for Risk engine. Same root cause as DB-2 — engine constant not read. | Settings.jsx:601 |
| DB-4 | ST-ACCT-03 | Account.jsx title "Unlock your FQ" — FQ is legacy abbreviation. Canonical = Wealth Score. FD-NAME-1 violation. | Account.jsx:85 |
| DB-5 | ST-ACCT-04 | Account.jsx sub-copy "Financial Quotient dashboard" — legacy long-form. FD-NAME-1 violation. | Account.jsx:87 |
| DB-6 | ST-ACCT-06 | Account.jsx tile label "Your estimated FQ" — third FQ instance. FD-NAME-1 violation. | Account.jsx:98 |
| DB-7 | ST-ACCT-05/07 | Account.jsx computes its own score via hardcoded formula (lines 44-46), never calls calcFQ(). Local fqBand() uses <= boundaries vs engine < (D-RISK-BOUNDARY-1). Two scoring paths: waitlist preview score != post-signup dashboard score. | Account.jsx:8-14, 44-46 vs fq-calculator.js:678-685, 692 |
| DB-8 | ST-TAX-D05 | Tax Rules panel hardcodes value="2026/27 UK". Rules bundle exposes taxYear:"2026/27". Silently drifts on any rules update. | Settings.jsx:579 |

---

## 3. FUNCTIONAL findings (11)

| ID(s) | Issue |
|-------|-------|
| ST-OUT-01 | Sign Out fires window.location.href='/' immediately — no confirm modal, no auth, no session teardown |
| ST-FIN-D04 | Drawdown shown read-only, no drill to Cashflow (canonical home) |
| ST-FIN-D05 | Net worth shown read-only, no drill to My Money (canonical home) |
| ST-DATA-02 | Document vault stubbed Phase 2 but Vault.jsx exists elsewhere — inconsistent honesty |
| ST-X-02 | Hide-balances writes localStorage only, no EventsProvider emission; cross-screen consumers miss the change |
| ST-X-03 | Longevity writes localStorage only; engine support pending (s02a); downstream surfaces unaffected |
| ST-X-05 | No currency/locale control — FD-ST-1 violation (hidden setting; no row, no stub) |
| ST-X-07 | No withdrawal-cadence control — FD-ST-1 violation (hidden setting) |
| ST-X-10 | No jurisdiction picker — FD-ST-1 violation; multi-jurisdiction users blocked |
| ST-TAX-D02 | Rules version shows UK-2026.1 (brand.js) while on-disk SoT is UK-2026.1.1 (rules JSON) |
| ST-REG-02 | FCA boundary copy has no top-level Settings home; stubbed Phase 2 — dishonest about a regulatory obligation |

---

## 4. Coverage line

```
Inventory rows:   99
PASS:             86
FAIL:             13 (8 DB unique IDs, 11 FUNCTIONAL, 14 POLISH — some rows counted in multiple categories)
UNVERIFIED:        0
Coverage:        100%
```

All 17 seeds confirmed (none disputed).

---

## 5. Top 3 fix priorities

**P1 — Account.jsx FD-NAME-1 sweep + engine binding (DB-4/5/6/7)**
- `Account.jsx:85` → `Unlock your ${BRAND.scoreShort}`
- `Account.jsx:87` → `Wealth Score dashboard`
- `Account.jsx:98` → `Your estimated ${BRAND.scoreShort}`
- Replace lines 8-21 (local fqBand + stageFor) and lines 44-46 (hardcoded formula) with `calcFQ()` + engine `fqBand()` imported from `../engine/fq-calculator.js`

**P2 — Fix FINIO-1.0 / RISK-1.0 literals in About panel (DB-2/3)**
- `Settings.jsx:600` → `value={fq.scoringVersion}` (fq already computed at line 300) or hide row
- `Settings.jsx:601` → read from `calcRisk(entity).riskVersion` or rename to plain English

**P3 — Wire PlanRow onClick (DB-1)**
- Add onClick prop to PlanRow component (Settings.jsx:79)
- Route to canonical plan surface per plan type (Drawdown/Cashflow → Cashflow screen; Estate → T&E screen)
- Until destination exists: replace interactive PlanRow with phase2={true} Row stub to stop the "interactive-looking-but-dead" violation

---

## 6. Decision-needed

| # | Topic |
|---|-------|
| D1 | No HTML baseline for Settings — commission Stitch baseline or bless current React render |
| D2 | Engine version labels (FINIO-1.0 / RISK-1.0) — hide from users or rename to plain English |
| D3 | Jurisdiction picker — Settings-owned control or Onboarding-locked? |
| D4 | Withdrawal cadence — Settings row or Cashflow + reference here? |
| D5 | Document Vault — link to existing Vault.jsx or hide Vault from other surfaces until Phase 2 |
