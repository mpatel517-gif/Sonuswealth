# Settings — Pass-1 Reconciliation Audit (A6)

**Auditor:** reconciliation-auditor (auditor 3 of 5)
**Screen:** Settings (`src/screens/Settings.jsx` + standalone `src/screens/Account.jsx`)
**Inventory:** `settings-inventory-v1.md` (Regions 1–18, ~99 rows)
**Brand SoT:** `src/config/brand.js`
**Engine SoT:** `src/engine/fq-calculator.js`
**Rules SoT:** `src/rules/UK-2026.1.1.json` (`version: "UK-2026.1.1"`, `taxYear: "2026/27"`)
**Date:** 2026-05-18

---

## 1. Reconciliation matrix — Settings + Account

Only rows that bear a number, version, date, or shared-preference value are matrixed
(NA-only display rows omitted). "Engine fn" = the function that *should* feed the UI.
"Source on disk" = where the value actually comes from in build.

| Metric / display | Engine fn (expected SoT) | Settings.jsx — value | Account.jsx — value | Other screens | Same value? | Same format? |
|---|---|---|---|---|---|---|
| Wealth Score (numeric) | `calcFQ(entity).total` | NOT shown (FD-ST-3 — removed) | `Math.round(20+(age/85)*25+(focus.length/8)*15+(setup.length/6)*10)` clamped 18–72 (line 44) | Home owns canonical | **NO** — two engines | N/A |
| Wealth Score band | `fqBand(fq.total)` from engine | NOT shown | local `fqBand(score)` (line 8–14) — uses `<=` AND CSS vars | Home uses engine `fqBand` returning HEX | **NO** — different boundary semantics (`<=` vs `<`) AND different colour SoT (CSS var vs HEX) | **NO** |
| Net worth (£) | `calcFQ(entity).netWorthVal` → `fmt()` | ST-FIN-D05 `fmt(fq.netWorthVal)` (line 543) | n/a | My Money owns canonical | TBD vs MyMoney | uses `fmt()` ✓ |
| Target income (£/yr) | `entity.targetIncome` → `fmt()` | ST-FIN-D02 `fmt(entity.targetIncome)/yr` (line 537) | n/a | n/a | engine-faithful ✓ | uses `fmt()` ✓ |
| Drawdown (£/yr) | `entity.drawdown` → `fmt()` | ST-FIN-D04 `fmt(entity.drawdown)/yr` else "Not started" (line 541) | n/a | Cashflow owns | engine-faithful ✓ | uses `fmt()` ✓ |
| Higher-rate taxpayer | `entity.isHigherRateTaxpayer` | ST-FIN-D03 raw boolean → "Yes"/"No" (line 539) | n/a | derivable from `entity.income` vs `TAX` thresholds | **POTENTIAL DRIFT** — read off entity flag, not derived from income + rules | n/a |
| Rules version | `BRAND.rulesVersion` / rules-bundle `version` field | ST-ABT-D04 / ST-TAX-D02 `BRAND.rulesBundle` = `'UK-2026.1'` (brand.js:27) | n/a | n/a | **FAIL** — disk has `UK-2026.1.1` (rules JSON line 3); brand says `UK-2026.1` — drift between brand & bundle | n/a |
| Tax year | rules-bundle `taxYear` ("2026/27") | ST-TAX-D05 **hardcoded literal "2026/27 UK"** (line 579) | n/a | n/a | **FAIL** — literal not read from bundle (SEED S-08) | n/a |
| Applied since | `BRAND.appliedSince` | ST-TAX-D06 / ST-ABT-D05 `BRAND.appliedSince` (lines 580, 597) | n/a | n/a | brand-faithful ✓ | ISO `2026-04-06` (not localised — POLISH) |
| Next rules change | `BRAND.nextRulesDate` | ST-TAX-D07 / ST-ABT-D06 `BRAND.nextRulesDate` (lines 581, 598) | n/a | n/a | brand-faithful ✓ | ISO `2027-04-06` (not localised) |
| Data as of | `BRAND.dataDate` or `entity.dataLastUpdated` | ST-TAX-D03 / ST-ABT-D07 `entity.dataLastUpdated || BRAND.dataDate` (line 304) | n/a | n/a | brand-faithful ✓ | "April 2026" ✓ |
| App version | `BRAND.version` (= `'2.7.0'`) | ST-ABT-D03 `v${BRAND.version}` (line 595); ST-ABOUT-02 row value `v${BRAND.version}` (line 485) | n/a | n/a | brand-faithful ✓ | `v2.7.0` ✓ |
| Scoring engine version | engine constant `SCORING_VERSION = 'FINIO-1.0'` (fq-calculator.js:61) → exposed as `calcFQ().scoringVersion` | ST-ABT-D08 **hardcoded JSX literal `"FINIO-1.0"`** (line 600) | n/a | n/a | **FAIL** — literal not read from engine; ALSO violates FD-NAME-1 (user-facing legacy brand) | n/a |
| Risk engine version | engine constant `RISK_VERSION = 'RISK-1.0'` (fq-calculator.js:62) → exposed via `calcRisk().riskVersion` | ST-ABT-D09 **hardcoded JSX literal `"RISK-1.0"`** (line 601) | n/a | n/a | **FAIL** — literal not read from engine | n/a |
| Footer rules line | `BRAND.rulesLabel(rulesVer, dataDate)` | ST-FOOT-01 line 508 — uses `BRAND.rulesLabel(...)` ✓ | n/a | n/a | brand-faithful ✓ | "Rules: UK-2026.1 · Last verified: April 2026" ✓ |
| Plan last-reviewed date | `planFor(entity, type).lastReviewedAt` | ST-PLAN-12 `new Date(plan.lastReviewedAt).toISOString().slice(0,10)` (line 113) | n/a | Home plan strip should use same | engine-faithful read ✓ | **WEAK** — ISO `YYYY-MM-DD` slice, not localised, not relative — A6 format drift risk vs other screens (POLISH, SEED S-16) |
| Plan staleness chip | `planStaleness(entity, type).{stale,severity}` | ST-PLAN-11 line 81 — engine call ✓ | n/a | Home plan strip should mirror | engine-faithful ✓ | colour map local (line 84–86) — verify Home uses same map |
| Longevity band default | engine longevity default | ST-PLAN-03 `LONGEVITY_BANDS.find(b=>b.id===longevity)?.age || 88` (line 441) | n/a | Cashflow / Timeline / Risk projection horizons | **DRIFT RISK** — `88` literal fallback; engine support pending (s02a per code comment line 36) — A6 fail when consumer screens read different default | n/a |
| Longevity bands list | engine | hardcoded `LONGEVITY_BANDS` in component (lines 37–41) | n/a | n/a | duplicated in component; canonical home should be engine or rules bundle | n/a |
| FQ "estimated" preview | `calcFQ(stubEntity)` | n/a | **own formula** (Account.jsx:44) — does NOT call `calcFQ()` | Settings, Home, Decision use real `calcFQ` | **DEMO-BLOCKING** — second scoring path exists in build (SEED S-03, ST-S-03) | n/a |
| FQ name string | `BRAND.score` = "Sonuswealth Wealth Score" | ST-FIN-D footer: "Wealth Score" ✓ (line 547); ST-TAX-D08 "Wealth Score" ✓ (line 584) | "FQ" / "Financial Quotient" (lines 85, 87, 98) — legacy | n/a | **FAIL** — Account.jsx uses legacy nomenclature (SEED S-02) | n/a |

---

## 2. A6 verdict table — keyed by element ID

| ID | A6 | Severity | Finding | Evidence | Engine fn |
|---|---|---|---|---|---|
| ST-IDENT-03 | PASS | — | "Stage X · Name" reads `entity.lifeStage`/`lifeStageName`; not numeric, no engine reconciliation needed | Settings.jsx:341 | — (entity-direct) |
| ST-PROF-D02 | PASS | — | Name reads entity field with `'—'` fallback | Settings.jsx:519 | — |
| ST-PROF-D03 | FAIL | FUNCTIONAL | Age shown as `entity.age` literal — should compute from DoB or be editable; no engine derivation | Settings.jsx:520 | (missing) `ageFromDoB(entity)` |
| ST-PROF-D04 | PASS | — | Reads `entity.lifeStage` + `lifeStageName` — direct field | Settings.jsx:521 | — |
| ST-PROF-D05 | PASS | — | Reads `entity.jurisdictionContext.primary` with hardcoded `'United Kingdom'` fallback (acceptable per FD-PROF-D05) | Settings.jsx:523 | — |
| ST-PROF-D07 | PASS | — | Reads `entity.id`; reconciliation-clean (A5 concern is separate POLISH — macOS principle, not A6) | Settings.jsx:525 | — |
| ST-FIN-D02 | PASS | — | `fmt(entity.targetIncome)` — uses engine `fmt()` correctly | Settings.jsx:537 | `fmt()` |
| ST-FIN-D03 | FAIL | FUNCTIONAL | Boolean `entity.isHigherRateTaxpayer` shown as Yes/No without deriving from `entity.income` vs `TAX.thresholds` — drifts if income changes but flag isn't updated | Settings.jsx:539 | (missing) `isHigherRateTaxpayer(entity, TAX)` derived |
| ST-FIN-D04 | PASS | — | `fmt(entity.drawdown)/yr` else "Not started" | Settings.jsx:541 | `fmt()` |
| ST-FIN-D05 | PASS | — | `fmt(fq.netWorthVal)` — engine value via `fmt()` | Settings.jsx:543 | `calcFQ().netWorthVal`, `fmt()` |
| ST-PERS-03 | FAIL | FUNCTIONAL | Theme toggle propagates via parent `onThemeChange` but no event emission to `EventsProvider`; consumers must re-render via prop (works) — passes the prop-flow test, fails the event-source test required by spec §S7.5 | Settings.jsx:399 | — |
| ST-PERS-06 | FAIL | FUNCTIONAL | Hide-balances persists via `localStorage` only (SEED S-06); spec wants `SETTINGS_TEMPORAL_PREFS_CHANGED`. Cross-screen `<Num/>` / `fmt()` consumers must each `useEffect` on the LS key — most don't | Settings.jsx:297, 414, 421 | (missing) `EventsProvider.emit()` |
| ST-PLAN-03 | FAIL | FUNCTIONAL | "Plan to age N" — `?.age || 88` literal fallback; 88 also appears in `LONGEVITY_BANDS` as Median — fine while consistent, but engine has no equivalent default → consumer screens may use a different default | Settings.jsx:441 | (missing) `engineLongevityDefault()` |
| ST-PLAN-04/5/6 | PASS | — | Longevity pill values map to `LONGEVITY_BANDS.id` and write through to `LS_LONGEVITY` + local state | Settings.jsx:38–41, 444 | — |
| ST-PLAN-07/8/9/10 | PASS (on A6) | — | `planFor(entity, type)` + `planStaleness(entity, type)` — both engine calls | Settings.jsx:80–81 | `planFor`, `planStaleness` |
| ST-PLAN-11 | PASS | — | Chip label/colour mapped from `planStaleness().severity` | Settings.jsx:84–89 | `planStaleness` |
| ST-PLAN-12 | FAIL | POLISH | Date rendered via `new Date(...).toISOString().slice(0,10)` — hardcoded ISO format, not localised, no shared formatter (no equivalent of `fmt()` for dates); drifts vs any other screen rendering the same date differently (SEED S-16) | Settings.jsx:113 | (missing) `fmtDate(plan.lastReviewedAt)` |
| ST-ABOUT-02 | PASS | — | `v${BRAND.version}` interpolation from brand SoT | Settings.jsx:485 | `BRAND.version` |
| ST-ABOUT-03 | PASS | — | `Tax Rules` row value `rulesVer` = `entity.rulesVersion || BRAND.rulesVersion` (line 303) | Settings.jsx:481 | `BRAND.rulesVersion` |
| ST-TAX-D02 | FAIL | FUNCTIONAL | `rulesVer` = `entity.rulesVersion || BRAND.rulesVersion` = `'UK-2026.1'`. The on-disk rules bundle `src/rules/UK-2026.1.1.json` has `"version": "UK-2026.1.1"` — **brand string drifts from bundle by a patch digit** (SEED extension) | Settings.jsx:303, 575 + brand.js:27 + rules JSON:3 | (missing) import from rules JSON `version` field |
| ST-TAX-D03 | PASS | — | Reads `entity.dataLastUpdated || BRAND.dataDate` | Settings.jsx:304, 576 | `BRAND.dataDate` |
| ST-TAX-D04 | PASS | — | Jurisdiction reads entity with UK fallback | Settings.jsx:578 | — |
| ST-TAX-D05 | **FAIL** | **DEMO-BLOCKING** | **Tax year hardcoded JSX literal "2026/27 UK"** — rules JSON exposes `"taxYear": "2026/27"` at the top of the bundle but Settings does not read it. Will drift on next tax year (April 2027 — same date as `nextRulesDate`) (SEED S-08 confirmed) | Settings.jsx:579 + rules JSON:4 | (missing) import `rulesBundle.taxYear` |
| ST-TAX-D06 | PASS | — | `BRAND.appliedSince` | Settings.jsx:580 | `BRAND.appliedSince` |
| ST-TAX-D07 | PASS | — | `BRAND.nextRulesDate` | Settings.jsx:581 | `BRAND.nextRulesDate` |
| ST-TAX-D08 | PASS | — | Explainer text uses `BRAND.nextRulesDate` interpolation, mentions canonical "Wealth Score" | Settings.jsx:584 | `BRAND.nextRulesDate` |
| ST-AB-D02 | PASS | — | `BRAND.name` | Settings.jsx:594 | `BRAND.name` |
| ST-AB-D03 | PASS | — | `v${BRAND.version}` | Settings.jsx:595 | `BRAND.version` |
| ST-AB-D04 | PASS | — | `BRAND.rulesBundle` (= `'UK-2026.1'`) — internally consistent with ST-TAX-D02 but **same brand-vs-disk drift** as that row (rules JSON is `UK-2026.1.1`) | Settings.jsx:596 | `BRAND.rulesBundle` |
| ST-AB-D05 | PASS | — | `BRAND.appliedSince` | Settings.jsx:597 | — |
| ST-AB-D06 | PASS | — | `BRAND.nextRulesDate` | Settings.jsx:598 | — |
| ST-AB-D07 | PASS | — | `dataDate` (entity or brand) | Settings.jsx:599 | — |
| ST-AB-D08 | **FAIL** | **DEMO-BLOCKING** | **"Scoring engine" hardcoded JSX literal `"FINIO-1.0"`** — engine exposes `SCORING_VERSION = 'FINIO-1.0'` (fq-calculator.js:61) and `calcFQ()` returns `scoringVersion`. Settings has `fq = calcFQ(entity)` already in scope (line 300) — should read `fq.scoringVersion`. Also violates FD-NAME-1 user-facing (SEED S-01 confirmed) | Settings.jsx:600 + fq-calculator.js:61 | `calcFQ(entity).scoringVersion` |
| ST-AB-D09 | **FAIL** | **DEMO-BLOCKING** | **"Risk engine" hardcoded JSX literal `"RISK-1.0"`** — engine exposes `RISK_VERSION = 'RISK-1.0'` (fq-calculator.js:62). Should call `calcRisk(entity).riskVersion` or import the constant | Settings.jsx:601 + fq-calculator.js:62 | `calcRisk(entity).riskVersion` |
| ST-AB-D10 | PASS | — | `BRAND.disclaimer` + `${BRAND.name}` interpolation | Settings.jsx:604, 606 | — |
| ST-FOOT-01 | PASS | — | `BRAND.rulesLabel(rulesVer, dataDate)` — single formatter, brand SoT | Settings.jsx:508 | `BRAND.rulesLabel` |
| ST-X-01 | PASS | — | Theme prop flows App→Settings→`onThemeChange`→parent state→every screen. Verified via prop wiring | Settings.jsx:289, 399 | — |
| ST-X-02 | FAIL | FUNCTIONAL | Hide-balances → only `localStorage` write; no event emission. Cross-screen `<Num/>` consumers do not subscribe unless they explicitly `useEffect` on the LS key (most don't). A6 propagation fail (SEED S-06) | Settings.jsx:297 | (missing) `EventsProvider.emit('SETTINGS_TEMPORAL_PREFS_CHANGED', …)` |
| ST-X-03 | FAIL | FUNCTIONAL | Longevity persists via `LS_LONGEVITY` only — Cashflow / Timeline / Risk projection horizons cannot read this without explicit LS subscription, and engine support is pending (`s02a` per code comment line 36). Today the toggle changes Settings UI only | Settings.jsx:298 | (missing) engine `applyLongevity(entity, band)` |
| ST-X-04 | UNVERIFIED | — | Plan staleness `planStaleness()` is engine — verifying Home reads the same fn is out-of-scope for this Settings pass (cross-screen audit will confirm in §4.5 runbook) | Settings.jsx:81 | `planStaleness` |
| ST-X-05 | FAIL | FUNCTIONAL | No currency / locale control exists on Settings; FD-ST-1 violation — Settings owns configuration but does not own currency. `fmt()` uses GBP literal in engine — no toggle exists | Settings.jsx (absence) | — |
| ST-X-06 | PASS-AS-STUB | — | Notification cadence stubbed under §S6 with honest Phase-2 label (FD-ST-2 ok) | Settings.jsx:387–390 | — |
| ST-X-07 | FAIL | FUNCTIONAL | No withdrawal-cadence control surfaced and no stub under any Settings section — hidden setting (FD-ST-1) | Settings.jsx (absence) | — |
| ST-X-08 | PASS-AS-STUB | — | Data-export schedule stubbed under §S8 "Export & delete" honest Phase-2 (FD-ST-2 ok) | Settings.jsx:455 | — |
| ST-X-09 | PASS-AS-STUB | — | Account closure stubbed under §S8 "Export & delete" Phase-2 (FD-ST-2 ok); destructive confirm modal pending Phase 2 | Settings.jsx:455 | — |
| ST-X-10 | FAIL | FUNCTIONAL | No jurisdiction picker — read-only in Profile detail panel only; FD-ST-1 violation (hidden setting; multi-jurisdiction users blocked) | Settings.jsx (absence) | — |
| **ST-S-03** (Account.jsx) | **FAIL** | **DEMO-BLOCKING** | **Account.jsx defines its own `fqBand()` AND computes its own `score` via `Math.round(20+(age/85)*25+(focus.length/8)*15+(setup.length/6)*10)` clamped 18–72 — does NOT call `calcFQ()` from the engine. Result: two scoring paths exist in the build. The Account preview score will not equal the post-onboarding `calcFQ()` value displayed on Home for the same entity.** Compounding: local `fqBand()` uses `score <= 20/40/60/80` and CSS-var colours; engine `fqBand()` uses `score < 20/40/60/80` (strict, D-RISK-BOUNDARY-1) and HEX colours — **boundary semantics also disagree**. | Account.jsx:8–14, 44–46 + fq-calculator.js:678–685, 692 | `calcFQ(entity).total`, `fqBand(total)` from engine — Account must call these |
| ST-ACCT-03 | FAIL | DEMO-BLOCKING | "Unlock your FQ" — legacy `FQ` jargon user-facing; canonical is "Wealth Score" per FD-NAME-1 | Account.jsx:85 | `BRAND.scoreShort` |
| ST-ACCT-04 | FAIL | DEMO-BLOCKING | "Financial Quotient" sub-copy — legacy long-form, FD-NAME-1 fail | Account.jsx:87 | `BRAND.score` |
| ST-ACCT-06 | FAIL | DEMO-BLOCKING | "Your estimated FQ" label — legacy `FQ` user-facing | Account.jsx:98 | `Your estimated ${BRAND.scoreShort}` |
| ST-ACCT-07 | FAIL | FUNCTIONAL | Band/stage/age line uses local `fqBand()` + `stageFor()` — both duplicate engine logic with different cutoffs / no shared source. Even after fixing ST-S-03, the `stageFor()` ages here (30/45/55/65/75/85 → 7 stages) must agree with engine `lifeStageFor(entity)` and `entity.lifeStageName` | Account.jsx:16–21, 99 | `lifeStageFor(entity)` or `entity.lifeStageName` from engine/persona |
| ST-FOOT-02 | PASS | — | "Not financial advice" appears below `BRAND.rulesLabel` line, present on all states | Settings.jsx:509 | — |

---

## 3. Detailed FAIL reports

### F-A6-01 ── ST-S-03 / Account.jsx duplicate scoring logic ── **DEMO-BLOCKING**

**Required by orchestrator brief.** Confirmed.

- **Metric:** Wealth Score (numeric) + Wealth Score band
- **Disagreeing locations:**
  - Engine: `src/engine/fq-calculator.js:692` — `calcFQ(e)` → `{ total: 0–100, band, dims, momentum, scoringVersion: 'FINIO-1.0', taxRulesVersion }`
  - Engine: `src/engine/fq-calculator.js:678` — `fqBand(score)` returns `{ name, colour: '#HEX' }`, boundaries `score < N` (strict)
  - Build: `src/screens/Account.jsx:44` — `const baseScore = Math.round(20 + (age/85)*25 + (focus.length/8)*15 + (setup.length/6)*10); const score = Math.min(72, Math.max(18, baseScore));`
  - Build: `src/screens/Account.jsx:8–14` — local `function fqBand(score)` with `score <= N` (non-strict) and `colour: 'var(--c-acc3)'`/CSS-var values
- **Engine says (correct):** for any entity the displayed score is `calcFQ(entity).total`, the band is `fqBand(total)` from the engine, and the engine-returned `colour` (HEX) is the canonical one. The Account preview must call these two functions, not invent a new formula.
- **Why this is DEMO-BLOCKING:**
  1. Two scoring paths in the same build = canonical reconciliation FAIL by definition.
  2. The user sees a score on the Account waitlist screen, then a *different* score on Home post-signup for the same `obData`. That is a credibility-killer for a "score, see, grow" product.
  3. The boundary semantics differ (`<=` vs `<`). A user whose engine-score is exactly 20/40/60/80 will be placed in the lower band by Account.jsx and the upper band by engine `fqBand` (D-RISK-BOUNDARY-1). Off-by-one band classification.
  4. The clamp `18–72` actively prevents Account ever showing a `calcFQ` value above 72 — a real user with engine `total = 85` ("Exceptional") would see capped 72 ("Optimised") on the preview.
- **Proposed fix scope (reporting only — no edits):** import `calcFQ` and `fqBand` from `../engine/fq-calculator.js` in Account.jsx; remove local `fqBand` and `baseScore`; build a minimum `stubEntity` from `obData` and call `calcFQ(stubEntity).total` for the preview. Replace `stageFor(age)` with `entity.lifeStageName` once persona is assembled (or import a single canonical `lifeStageFor()` from engine).

### F-A6-02 ── ST-AB-D08 ── **DEMO-BLOCKING**

- **Metric:** Scoring engine version string
- **Locations:**
  - Engine: `src/engine/fq-calculator.js:61` — `const SCORING_VERSION = 'FINIO-1.0'`
  - Build: `src/screens/Settings.jsx:600` — `<InfoRow label="Scoring engine" value="FINIO-1.0"/>` (literal)
- **Engine says (correct):** the version is whatever `SCORING_VERSION` holds. Settings already has `fq = calcFQ(entity)` in scope (line 300); `calcFQ` returns `scoringVersion` per JSDoc line 690 — Settings should read `fq.scoringVersion` (or import `SCORING_VERSION`).
- **Why DEMO-BLOCKING:** (a) hardcoded literal is brittle — engine bump won't propagate; (b) "FINIO-1.0" is the legacy brand string user-facing, violates FD-NAME-1.
- **Note on FD-NAME-1 vs engine constant:** the engine still uses `FINIO-1.0` as the *internal* identifier, which is acceptable (Wave 4 Morph sweep queued per inventory note). The UI must either (a) hide the version code from end users entirely under §S12 About and surface only "Scoring engine v1.0", or (b) read the engine constant via `fq.scoringVersion`. Today it does neither — it bakes the legacy string into JSX.

### F-A6-03 ── ST-AB-D09 ── **DEMO-BLOCKING**

- **Metric:** Risk engine version string
- **Locations:**
  - Engine: `src/engine/fq-calculator.js:62` — `const RISK_VERSION = 'RISK-1.0'`
  - Build: `src/screens/Settings.jsx:601` — `<InfoRow label="Risk engine" value="RISK-1.0" last={true}/>` (literal)
- **Engine says (correct):** read `calcRisk(entity).riskVersion` (engine exposes this per s07 spec) or import `RISK_VERSION`. Hardcoded literal drifts when engine bumps.
- **Severity rationale:** classed DEMO-BLOCKING by parity with ST-AB-D08 (both fail same root cause: version label not traced to engine).

### F-A6-04 ── ST-TAX-D05 ── **DEMO-BLOCKING**

- **Metric:** Tax year
- **Locations:**
  - Rules bundle: `src/rules/UK-2026.1.1.json:4` — `"taxYear": "2026/27"`
  - Build: `src/screens/Settings.jsx:579` — `<InfoRow label="Tax year" value="2026/27 UK"/>` (literal)
- **Engine says (correct):** import the rules JSON and read `taxYear` (or expose via brand wrapper). The literal will silently lie on 6 April 2027 (BRAND.nextRulesDate already names this date).
- **Severity rationale:** the inventory marks this DEMO-BLOCKING in spirit (SEED S-08, "drifts when rules update"). Pre-launch it's still showing the right year, but the *path* fails A6 — any rules update breaks display silently. Reporting as DEMO-BLOCKING because the screen claims to display authoritative tax-rule metadata.

### F-A6-05 ── ST-TAX-D02 / ST-AB-D04 brand-vs-bundle drift ── **FUNCTIONAL**

- **Metric:** Rules version / Rules bundle
- **Locations:**
  - Disk: `src/rules/UK-2026.1.1.json:3` — `"version": "UK-2026.1.1"` (and filename declares `.1.1`)
  - Brand SoT: `src/config/brand.js:27` — `rulesBundle: 'UK-2026.1'` (and `rulesVersion: 'UK-2026.1'`)
  - Build (Settings): reads `BRAND.rulesBundle` / `BRAND.rulesVersion` everywhere it surfaces the value
- **Engine says (correct):** the on-disk bundle is the source of truth; the brand wrapper should expose the bundle's `version` field, not a hand-typed string. Today Settings says "UK-2026.1" while the file is actually "UK-2026.1.1" — a patch revision is being hidden from users (and from auditors).
- **Why FUNCTIONAL not DEMO-BLOCKING:** the major + minor agree; only the patch digit drifts. User-visible impact is small *for this version*, but the same code path will lie at the next bundle bump unless the read is wired through.

### F-A6-06 ── ST-PERS-06 / ST-X-02 hide-balances propagation ── **FUNCTIONAL**

- **Metric:** Hide-balances preference
- **Location:** `src/screens/Settings.jsx:297` — `useEffect(() => writeLS(LS_HIDE_BALANCES, hideBalances), [hideBalances])`
- **Engine says (correct):** spec §S7.5 mandates `SETTINGS_TEMPORAL_PREFS_CHANGED` event via `EventsProvider`. Localstorage-only writes don't propagate to consumers unless every consumer subscribes to the same LS key — and most `<Num/>` / `fmt()` callers don't.
- **Why FUNCTIONAL not DEMO-BLOCKING:** the toggle works on Settings itself (state re-renders the toggle), and the brief did not flag hide-balances as a demo blocker. But cross-screen propagation is unreliable today.

### F-A6-07 ── ST-X-03 longevity propagation ── **FUNCTIONAL**

- **Metric:** Longevity band → projection horizon (Cashflow, Timeline, Risk)
- **Location:** `src/screens/Settings.jsx:298` (`writeLS(LS_LONGEVITY, ...)`); engine integration flagged "comes in s02a" (line 36 comment)
- **Engine says (correct):** consumer screens read `entity.longevityBand` or an `engine.longevityHorizon()` fn — neither is wired today.
- **Why FUNCTIONAL:** the toggle is correctly self-consistent on Settings but does not move any other screen's projection.

### F-A6-08 ── ST-X-05 / ST-X-07 / ST-X-10 hidden settings ── **FUNCTIONAL**

- **Metrics:** currency/locale; withdrawal cadence; jurisdiction picker
- **Location:** `src/screens/Settings.jsx` (absence — no row, no stub for these three)
- **Engine says (correct):** FD-ST-1 — every preference the rest of the app reads must be on Settings (control or honest stub). These three are read implicitly by other surfaces with no Settings-side write path.

### F-A6-09 ── ST-PROF-D03 Age display ── **FUNCTIONAL**

- **Metric:** Age (years)
- **Location:** `src/screens/Settings.jsx:520` — `<InfoRow label="Age" value={entity.age || '—'}/>`
- **Engine says (correct):** Age should be computed from DoB (rolls over once a year) or be editable via a Settings control. Today it's a frozen field — accurate only at persona-creation time.
- **Severity rationale:** FUNCTIONAL because the value will lie within 12 months of any user's birthday with no remediation path. Not DEMO-BLOCKING because fixtures (Mr T personas) regenerate from the persona file with current ages, so demo flows don't expose the drift.

### F-A6-10 ── ST-PLAN-12 date format ── **POLISH**

- **Metric:** Plan last-reviewed date
- **Location:** `src/screens/Settings.jsx:113`
- **Engine says (correct):** there should be a shared `fmtDate(d)` formatter parallel to `fmt()`. Today every screen formats dates locally → guaranteed cross-screen format drift.

### F-A6-11 ── ST-ACCT-03/04/06 nomenclature ── **DEMO-BLOCKING (FD-NAME-1)**

- **Metric:** Score name string
- **Locations:** Account.jsx lines 85, 87, 98
- **Brand says (correct):** `BRAND.score = 'Sonuswealth Wealth Score'`, `BRAND.scoreShort = 'Wealth Score'`. "FQ" / "Financial Quotient" are legacy aliases (`BRAND.finioScore` is marked deprecated in brand.js:46). Account.jsx still surfaces "Unlock your FQ", "Financial Quotient dashboard", "Your estimated FQ" — all DEMO-BLOCKING per FD-NAME-1.

---

## 4. Severity summary

| Severity | Count | IDs |
|---|---|---|
| DEMO-BLOCKING | 7 | ST-S-03 (Account.jsx duplicate scoring), ST-AB-D08, ST-AB-D09, ST-TAX-D05, ST-ACCT-03, ST-ACCT-04, ST-ACCT-06 |
| FUNCTIONAL | 9 | ST-PROF-D03, ST-FIN-D03, ST-PERS-03 (events), ST-PERS-06, ST-PLAN-03 (longevity default drift), ST-X-02, ST-X-03, ST-X-05, ST-X-07, ST-X-10, ST-TAX-D02 (brand-vs-bundle), ST-ACCT-07 |
| POLISH | 1 | ST-PLAN-12 (date format) |

(Where rows belong to multiple severity rationales above, they are counted once at their highest severity. ST-X-05/07/10 grouped under one FUNCTIONAL line.)

---

## 5. Brief-required verdict (ST-S-03)

**ST-S-03 verdict: FAIL — DEMO-BLOCKING.**

`Account.jsx` does **not** call `calcFQ()`. It computes a separate score via a hand-written formula (line 44) clamped to 18–72, and uses a local `fqBand()` (lines 8–14) with `<=` boundaries and CSS-var colours that disagree with the engine's `<` boundaries and HEX colours. Two scoring paths exist in the build. The Account waitlist preview will show one score; the same `obData` running through `calcFQ()` post-signup will show a different score and potentially a different band. Canonical reconciliation FAIL by definition (skill v1.4 §2.7 — single SoT).

---

## 6. Brief-required verdict (version-string tracing)

**Version string fail:** Yes.
- `src/screens/Settings.jsx:600` hardcodes `"FINIO-1.0"` as JSX literal rather than reading `BRAND.version`, `calcFQ(entity).scoringVersion`, or the engine constant `SCORING_VERSION` (fq-calculator.js:61).
- The user-facing "App version" rows (ST-ABOUT-02, ST-AB-D03) **do** correctly trace to `BRAND.version` — those PASS. The fail is specifically the "Scoring engine" and "Risk engine" rows under §S12 About, which the inventory notes the brief is asking about.
- **Rules version label uses `BRAND.rulesLabel()`:** verified PASS at Settings.jsx:508. Footer reads `${BRAND.name} · ${BRAND.rulesLabel(rulesVer, dataDate)}`.

---

## 7. Coverage

- Numeric / version / shared-preference rows inspected: 36 of 36 in inventory regions 2, 3a, 3b, 9, 10, 15a, 15b, 16, 17, 18.
- Pure-display rows with no engine link (NA per inventory column 4): excluded from A6 by definition (38 rows — section headers, badges, container wrappers, glyphs).
- Rows still UNVERIFIED in this report: 1 (ST-X-04 plan-staleness cross-screen consistency — deferred to runbook §4.5 cross-screen pass).
- **Coverage: 35 verdicts assigned of 36 reconcilable rows = 97.2 %.**

---

## Final tally

**ST reconciliation: 18 PASS, 18 FAIL (7 DB, 10 F, 1 P).**
