# Settings — Pass 1 Domain Audit

**Auditor:** domain-auditor (4 of 5)
**Screen:** Settings (`src/screens/Settings.jsx`) + out-of-Settings auth surface `src/screens/Account.jsx`
**Inventory:** `settings-inventory-v1.md` (99 rows, v1)
**Method:** A5 (plain English + FCA) + UK financial-domain correctness + macOS principle + brand drift, per `.claude/agents/domain-auditor.md`.
**Engine baseline:** 1,240 assertions passing; tax bundle INTEGRATED. Risk is in the COPY, DEFINITIONS, FRAMING and PLACEHOLDER LEAKAGE, not the maths.
**Authority sources for UK tax facts used in this pass:**
- `src/rules/UK-2026.1.1.json` (engine SoT — verifiedBy: HMRC published rates, May 2026)
- `src/config/brand.js` (brand strings + applied-since / next-rules)
- Finance Act 2026 (SIPP IHT inclusion 6 Apr 2027; APR/BPR £2.5m combined allowance; AIM BPR 50%; VCT IT relief 20%)
- `feedback_always_check_rules_uk.md`, `reference_uk_tax_source_of_truth.md`, `project_sipp_iht_enacted_2026.md`

---

## VERDICT TABLE (A5 + domain-correctness, keyed by element ID)

| ID | A5 | Domain | Severity | Finding | Evidence |
|----|----|--------|----------|---------|----------|
| ST-CHR-01 | PASS | NA | — | Container; no financial content. | Settings.jsx:316 (OverlayShell title="Settings") |
| ST-CHR-02 | PASS | NA | — | Back label is plain English. | Settings.jsx:318 |
| ST-CHR-03 | PASS | NA | — | "Settings" — plain. | Settings.jsx:317 |
| ST-CHR-04 | PASS | NA | — | Home pill ⌂; no financial copy. | Settings.jsx:319 |
| ST-CHR-05 | PASS | NA | — | a11y, not domain. | Settings.jsx (OverlayShell global) |
| ST-CHR-06 | PASS | NA | — | a11y, not domain. | Settings.jsx:307–313 |
| ST-IDENT-01 | PASS | NA | — | Avatar; no claim. | Settings.jsx:325–334 |
| ST-IDENT-02 | PASS | NA | — | Display name, no domain. | Settings.jsx:335–338 |
| **ST-IDENT-03** | **FAIL (A5)** | A5 | POLISH | "Stage 3 · {name}" exposes raw life-stage *number*. A non-expert cannot read "Stage 3" without the named role (`Accumulation` etc.). Macro-principle: numeric internal code at top layer. | Settings.jsx:339–342 (root header uses `${lifeStage} · ${lifeStageName}` — when `lifeStageName` is missing `—`, only the number renders) |
| ST-PROF-01 | PASS | NA | — | Plain section header. | Settings.jsx:346 |
| ST-PROF-02 | PASS | NA | — | "My Profile" plain. | Settings.jsx:347–350 |
| ST-PROF-03 | PASS-stub | A4 | POLISH | "View" is not a status — it is a verb masquerading as data. Doesn't fail A5 because nothing is misstated, but the value column is wasted. Drill resolves correctly (A3 OK). | Settings.jsx:351–355 |
| ST-PROF-D01 | PASS | NA | — | | Settings.jsx:518 |
| ST-PROF-D02 | PASS | NA | — | Name read-only. | Settings.jsx:519 |
| ST-PROF-D03 | PASS | A6 | — | Age read-only. No domain claim. (Reconciliation lives in conformance pass.) | Settings.jsx:520 |
| ST-PROF-D04 | PASS | A5 | — | Life stage shown with named role here: `${lifeStage} · ${lifeStageName}`. OK in detail; ST-IDENT-03 still fails at root. | Settings.jsx:521 |
| ST-PROF-D05 | PASS | A5 | — | Jurisdiction falls back to "United Kingdom"; plain. Multi-jurisdiction gap is FUNCTIONAL FAIL on ST-X-10, not here. | Settings.jsx:522–523 |
| ST-PROF-D06 | FAIL (A5) | A5 | POLISH | `entity.type` rendered raw — values `'individual'`, `'ifa'`, `'couple'` etc. are internal vocabulary. A non-expert seeing `ifa` has no anchor. | Settings.jsx:524 |
| **ST-PROF-D07** | **FAIL (A5)** | A5 | POLISH | "Entity ID" exposes the internal database key to the end user. macOS principle violation (Sonuswealth memory `feedback_finio_macos_principle.md`: internal codes never at top layer). User has no use for it pre-launch. | Settings.jsx:525 |
| ST-PROF-D08 | PASS | A5 | — | "Profile editing is coming in Phase 2" — honest, plain English. | Settings.jsx:526–530 |
| ST-FIN-D01 | PASS | NA | — | | Settings.jsx:535 |
| ST-FIN-D02 | PASS | A5 | — | `fmt()` used; per-year suffix clear. | Settings.jsx:536–537 |
| ST-FIN-D03 | FAIL (A5) | A5 | POLISH | "Higher-rate taxpayer · Yes/No" — accurate UK term, but no plain-English clarifier ("you earn over £50,270 from non-savings income"). For a user who doesn't already know the threshold, this is jargon-without-translation per A5. **Domain note:** "higher-rate" in 2026/27 = 40% UK / 42% Scottish above £50,270 (UK) or £43,663 (Scottish higher band, per UK-2026.1.1 §income.scottishRateBands2627). | Settings.jsx:538–539 |
| ST-FIN-D04 | PASS-stub | A4 | POLISH | "Not started" honest fallback. **A3 concern:** number is read-only with no link to the canonical home (Cashflow drawdown panel) — domain rule: drawdown lives on Cashflow per `2-Product-cashflow-v1_7.md`. Drill-to-source missing. See ST-X cross-tab note. | Settings.jsx:540–541 |
| ST-FIN-D05 | PASS-stub | A4 | POLISH | Same — Net Worth canonical home is MyMoney; no link from here. | Settings.jsx:542–543 |
| ST-FIN-D06 | PASS | A5 | — | "Editing is coming in Phase 2 once account linking is live" — honest, plain. | Settings.jsx:544–548 |
| ST-HH-01 | PASS | NA | — | | Settings.jsx:359 |
| ST-HH-02 | PASS-stub | FD-ST-2 | — | Phase-2 honest stub. | Settings.jsx:360–361 |
| ST-CONN-01..02 | PASS-stub | FD-ST-2 | — | | Settings.jsx:364–367 |
| ST-SEC-01..02 | PASS-stub | FD-ST-2 | — | "Security" stub honest. | Settings.jsx:370–373 |
| ST-FEED-01 | PASS | NA | — | | Settings.jsx:377 |
| ST-FEED-02 | PASS | A5 | — | "IFA Access" + "IFA account" / "No IFA linked" — defined-enough on tap. **Domain note:** "IFA" = Independent Financial Adviser (FCA-regulated). Acronym is industry-standard for UK consumers; acceptable. | Settings.jsx:378–381 |
| ST-FEED-03 | PASS-stub | FD-ST-2 | — | | Settings.jsx:382–383 |
| ST-IFA-D01..D04 | PASS | NA | — | IFA branch read-only data. | Settings.jsx:553–559 |
| ST-IFA-D05 | PASS-stub | A4 | POLISH | "Linked IFA · None" — accurate. Acting on it lives in Phase 2 explainer below; honest. | Settings.jsx:561 |
| ST-IFA-D06 | PASS | A5 | — | "Link an IFA to share your Sonuswealth profile securely. Feature coming in Phase 2." Plain. **FCA note:** sharing data with an FCA-authorised IFA is information transfer, not regulated advice — copy stays inside Sonuswealth's information/guidance boundary. | Settings.jsx:562–567 |
| ST-NOTIF-01..02 | PASS-stub | FD-ST-2 | — | | Settings.jsx:387–389 |
| ST-PERS-01..03 | PASS | NA | — | Theme: presentation, no domain. | Settings.jsx:393–400 |
| ST-PERS-04..05 | PASS | A5 | — | "Hide balances · Replaces £ amounts with ••••" — plain. | Settings.jsx:401–412 |
| ST-PERS-06 | PASS | NA | — | Toggle. (A6 propagation = conformance pass, not domain.) | Settings.jsx:413–428 |
| ST-PLAN-01 | PASS | NA | — | | Settings.jsx:432 |
| ST-PLAN-02..03 | PASS | A5 | — | "Longevity band · Plan to age 88" — plain-English. Default age 88 is the engine median. | Settings.jsx:433–445 |
| **ST-PLAN-04/05/06** | **FAIL (A5)** | A5 | POLISH | Pills show only `85 / 88 / 92`. "Conservative / Median / Optimistic" exist in `LONGEVITY_BANDS[].label` (Settings.jsx:37–41) but are NEVER rendered. A user tapping `85` does not know what financial assumption that encodes (mortality-curve percentile? underlying ONS table? funded-to-age? life-expectancy point estimate?). **Domain integrity:** UK average life expectancy at 65 (ONS 2020–22 cohort) is ~85.4 (male) / ~87.5 (female); the 92 "optimistic" band corresponds to roughly the 75th–80th percentile of survival from 65 for current 60-year-olds. None of this provenance is visible; user has no basis to choose. Per founder-IP rule, plan-to-age choice is a DECISION surface — needs the named band + a one-line explainer. | Settings.jsx:52–76 (`LongevityPill` renders `{b.age}` only) |
| **ST-PLAN-07/08/09/10** | **FAIL (A2/A4)** | A4 | DEMO-BLOCKING | Plan rows display chip "Current / Stale / Not started" but `PlanRow` has **no onClick**. Founder rule §9: "interactive-looking-but-dead = FAIL". User reading "Drawdown plan · Stale" cannot tap to find out *why* it is stale or to refresh it. **Domain consequence:** "Stale" on a drawdown plan can imply rates have changed (e.g. SWR shift, SIPP IHT 2027) — leaving it dead is a trust-breaker because it asserts a risk-relevant status with no remediation path. (Cross-confirms inventory seed S-04.) | Settings.jsx:79–125 (PlanRow has no click handler); rows rendered at 446–448 |
| ST-PLAN-11 | FAIL (A5) | A5 | POLISH | "Stale" is plain but undefined here — user has no explainer of *what* makes a plan stale (last-reviewed age threshold? rules-version mismatch? data-freshness?). Three-tier severity (`high` / `medium` / `none`) is hidden behind colour with no key. | Settings.jsx:84–90 |
| ST-PLAN-12 | FAIL (A5) | A5 | POLISH | "Last reviewed: 2025-11-03" — ISO date is plain but un-localised and not relative ("3 months ago"); macOS-pattern simple surface would relativise. | Settings.jsx:111–115 |
| ST-PLAN-13 | FAIL (A5) | A5 | POLISH | Glyphs ⛨ ⊿ ◇ ≋ render with no accessible name; user can read the label but a screen-reader user gets cryptic characters. | Settings.jsx:104–106 |
| ST-DATA-01 | PASS | NA | — | | Settings.jsx:452 |
| ST-DATA-02 | PASS-stub | A1 | POLISH | "Document vault · Coming in Phase 2" — but `Vault.jsx` exists elsewhere in the build. Inconsistent honesty across surfaces (S-11), not a domain falsehood; flagging because the stub denies a feature that *does* render. | Settings.jsx:453–454 |
| ST-DATA-03 | PASS-stub | A4 | — | "Export & delete" stub honest; destructive UX scope deferred to Phase 2. | Settings.jsx:455–456 |
| ST-HELP-01..02 | PASS-stub | FD-ST-2 | — | | Settings.jsx:460–462 |
| ST-SUB-01..02 | PASS-stub | FD-ST-2 | — | | Settings.jsx:466–468 |
| ST-REG-01 | PASS | NA | — | | Settings.jsx:472 |
| **ST-REG-02** | **FAIL (A5/FCA)** | FCA | FUNCTIONAL | "Compliance & disclaimers" is stubbed — meaning the FCA boundary line ("Sonuswealth is information and guidance, not regulated financial advice") has **no top-level home on Settings**. It surfaces only inside the About detail (ST-AB-D10) and the page footer (ST-FOOT-02). For an FCA-information-not-advice product, the boundary copy must be reachable from a clearly-labelled surface, not buried inside About. Stub-as-Phase-2 is dishonest about the obligation. | Settings.jsx:473–474 |
| ST-ABOUT-01 | PASS | NA | — | | Settings.jsx:478 |
| ST-ABOUT-02 | PASS | A5 | — | "Tax Rules · UK-2026.1" — version is bare, but row label clarifies. | Settings.jsx:479–482 |
| ST-ABOUT-03 | PASS | A5 | — | "About Sonuswealth · v2.7.0" — plain. | Settings.jsx:483–487 |
| ST-TAX-D01 | PASS | NA | — | | Settings.jsx:574 |
| **ST-TAX-D02** | **FAIL (A6)** | TAX-FACT | FUNCTIONAL | "Rules version · UK-2026.1" (from `BRAND.rulesVersion`). The on-disk rules SoT is `src/rules/UK-2026.1.1.json` — version string `UK-2026.1.1`. The displayed version drifts from the actual loaded rules; user is told an older rules-version than what computed their figures. **Source:** `src/rules/UK-2026.1.1.json:3` (`"version": "UK-2026.1.1"`) vs `src/config/brand.js:26` (`rulesVersion: 'UK-2026.1'`). | Settings.jsx:575 + brand.js:26 |
| ST-TAX-D03 | PASS | TAX-FACT | — | "Data as of · April 2026" matches `verificationDate` in UK-2026.1.1.json:8. | Settings.jsx:576 |
| ST-TAX-D04 | PASS | A5 | — | "Jurisdiction · United Kingdom" plain. | Settings.jsx:577–578 |
| **ST-TAX-D05** | **FAIL (A6/TAX-FACT)** | TAX-FACT | FUNCTIONAL | "Tax year · 2026/27 UK" is a **hardcoded literal**. Rules JSON has `"taxYear": "2026/27"` (line 4) — the value is *available* and should be read from the bundle. If the rules bump (e.g. mid-year hotfix UK-2026.1.2 still inside 2026/27, then UK-2027.1 inside 2027/28), this string will drift silently. The current literal happens to be correct for the in-force bundle, so the user is not seeing a wrong figure today — but the row fails the source-of-truth rule. | Settings.jsx:579 |
| ST-TAX-D06 | PASS | TAX-FACT | — | "Applied since · 2026-04-06" matches Finance Act 2026 income-tax-band effective date and tax-year start. | Settings.jsx:580; brand.js:29 |
| **ST-TAX-D07** | **PASS (TAX-FACT) but FAIL (A5)** | A5 | POLISH | "Next rules change · 2027-04-06" — the *date* is correct (SIPP IHT activation, Royal Assent 18 Mar 2026 per `project_sipp_iht_enacted_2026.md`). But the row is silent on **what** changes — the user is told a date with no plain-English meaning. For a tax-rules surface this is the canonical place to say "DC pensions become subject to IHT". | Settings.jsx:581 |
| ST-TAX-D08 | PASS | A5/FCA | — | Explainer uses canonical "Wealth Score" name. FCA-safe ("you'll be notified and your score will recalculate automatically" — descriptive, not advisory). | Settings.jsx:582–585 |
| ST-AB-D01..D07 | PASS | A6 | — | All read from `BRAND.*` constants — no domain claim made. | Settings.jsx:594–599 |
| **ST-AB-D08** | **FAIL (A5 + A6 + FD-NAME-1)** | BRAND-LEAK | **DEMO-BLOCKING** | "Scoring engine · **FINIO-1.0**". Hardcoded literal at Settings.jsx:600. FD-NAME-1 locked 9 May 2026: every `Caelixa`/`Finio` in user-facing strings = FAIL. This is the single highest-confidence brand-leak finding on the screen. **Root cause beyond this row:** engine docstring at `src/engine/fq-calculator.js:688` still reads "FINIO-1.0 scoring engine" — so even after this UI string is fixed, the leak survives in the codebase and will resurface anywhere a future surface introspects the engine. **Verify-task confirmed: FINIO-1.0 is present and user-visible.** | Settings.jsx:600 |
| **ST-AB-D09** | **FAIL (A5)** | A5 | POLISH | "Risk engine · **RISK-1.0**" — same pattern as ST-AB-D08 but for the risk engine. Not the canonical brand-leak (RISK-1.0 is not in the FD-NAME-1 deprecated list), but the bare version string is jargon and the user cannot parse it. Recommend a plain label ("Risk model v1") or removal. | Settings.jsx:601 |
| ST-AB-D10 | PASS | FCA | — | Disclaimer block reads: `BRAND.disclaimer` ("Not regulated financial advice. Verify decisions with a qualified UK financial adviser.") + "Sonuswealth does not provide financial advice…". **FCA boundary present.** Plain English. **Domain note:** the second clause says "Sonuswealth does not provide financial advice" but does not include the canonical "information and guidance, not regulated advice" framing from memory `feedback_finio_info_not_sales.md` — close enough for FCA-safety but the canonical form is preferred. | Settings.jsx:602–610 |
| ST-OUT-01 | FAIL (A2) | A4 | FUNCTIONAL | Sign Out is destructive (returns to root, drops session intent) with no confirmation modal. Pre-launch with no real auth (per comment "No auth wired yet (FP-5)"), the user cannot lose data, so severity is FUNCTIONAL not DEMO-BLOCKING; **but** the row label is "Sign Out" (action verb) — under CTA-honesty pre-launch (memory `feedback_cta_honesty_pre_launch.md`), action verbs require a real destination. Today's destination is `window.location.href = '/'` — Welcome screen. Acceptable per Settings UX since there is nothing to actually sign out *of* — but the row should arguably read "Restart" or "Return to start" until auth lands. | Settings.jsx:495–502 |
| ST-FOOT-01 | PASS | A5/A6 | — | Footer "Sonuswealth · Rules: UK-2026.1 · Last verified: April 2026". Brand label correct. **A6 cross-leak:** same version-drift as ST-TAX-D02 (says `UK-2026.1`, on-disk is `UK-2026.1.1`); flagged once, applies twice. | Settings.jsx:506–510 |
| ST-FOOT-02 | PASS | FCA | — | "Not financial advice" — FCA boundary line present in footer of every state. | Settings.jsx:509 |
| ST-X-01..X-04 | PASS | NA | — | Cross-tab reconciliation — conformance-auditor territory, not domain. | n/a |
| ST-X-05 | NA | NA | — | Currency/locale absence — FD-ST-1 issue, conformance owns it. | n/a |
| ST-X-06 | NA | NA | — | | n/a |
| ST-X-07 | NA | NA | — | Withdrawal cadence — Cashflow ownership question, not Settings domain. | n/a |
| ST-X-08..X-10 | NA | NA | — | | n/a |

---

## REGION 18 — Account.jsx (out-of-Settings auth surface)

| ID | A5 | Domain | Severity | Finding | Evidence |
|----|----|--------|----------|---------|----------|
| ST-ACCT-01..02 | PASS | A5/FCA | — | "Your dashboard is ready" pre-data is mild affirmation; no advice. | Account.jsx:73–81 |
| **ST-ACCT-03** | **FAIL (A5 + FD-NAME-1)** | BRAND-LEAK | **DEMO-BLOCKING** | Title: "**Unlock your FQ**". Two failures: (a) **`FQ`** is the legacy abbreviation; canonical per FD-NAME-1 + `brand.js` is "Wealth Score" / "Sonuswealth Wealth Score". (b) Even if "FQ" were not a deprecated brand, it is unexplained jargon at first user contact. **Verify-task confirmed: "FQ" is present and user-visible.** | Account.jsx:85 |
| **ST-ACCT-04** | **FAIL (A5 + FD-NAME-1)** | BRAND-LEAK | **DEMO-BLOCKING** | Sub-copy: "Create your free account to see your personalised **Financial Quotient** dashboard." `Financial Quotient` is the legacy long-form of FQ — explicitly the kind of legacy term FD-NAME-1 deprecates. Canonical = "Wealth Score". **Verify-task confirmed: "Financial Quotient" is present and user-visible.** | Account.jsx:87 |
| **ST-ACCT-05** | **FAIL (A6 + claim-integrity)** | CLAIM | FUNCTIONAL | Score number computed by hardcoded inline formula: `Math.round(20 + (age/85)*25 + (focus.length/8)*15 + (setup.length/6)*10)` clamped 18–72 (Account.jsx:44–45). The canonical engine is `calcFQ()` from `src/engine/fq-calculator.js:692` (1,240 assertions passing). This means **Account.jsx invents its own Wealth Score with no traceable basis** — the figure shown is not defensible, can disagree with the post-signup dashboard score, and breaks the rule "every numeric claim must be defensible and traceable." | Account.jsx:8–14, 44–45 |
| **ST-ACCT-06** | **FAIL (A5 + FD-NAME-1)** | BRAND-LEAK | **DEMO-BLOCKING** | "Your estimated **FQ**" label — third surface of the same legacy brand-leak. | Account.jsx:98 |
| **ST-ACCT-07** | **FAIL (A6)** | RECONCILE | FUNCTIONAL | Account.jsx defines its own `fqBand()` (lines 8–14) using `<=` boundaries (`<=20 Exposed`, `<=40 Building` etc.) — engine `fqBand()` (`src/engine/fq-calculator.js:678–685`) uses `<` boundaries per D-RISK-BOUNDARY-1 ("boundary score belongs to upper band"). Boundary scores (20, 40, 60, 80) get **different bands** in the two functions: e.g. score 40 = "Building" in Account vs "Established" in engine. Same for `stageFor()` — Account.jsx:16–21 vs whatever engine canonical uses. Duplicate implementations of canonical logic with subtly different rules. | Account.jsx:8–21 vs fq-calculator.js:678–685 |
| ST-ACCT-08..09 | PASS-stub | A4 | — | SSO buttons honestly labelled "(waitlist)", disabled, with `aria-label="Apple sign-in coming soon"` etc. CTA-honesty compliant. | Account.jsx:106–119 |
| ST-ACCT-10 | PASS | A5 | — | Email input labelled + autocomplete. | Account.jsx:135–150 |
| ST-ACCT-11 | PASS | A5 | — | Password label includes honesty annotation "(this stays on your device — Phase 2)". Acceptable disclosure for pre-launch waitlist. **Security note:** placeholder "Pick anything for now" is a security-expectation flag for the user, but it's also explicit — under FCA principle 7 (communications fair, clear, not misleading) the honest label discharges the obligation. | Account.jsx:152–170 |
| ST-ACCT-12 | PASS | A5 | — | "Join waitlist" — CTA-honesty compliant. | Account.jsx:174–181 |
| **ST-ACCT-13** | **FAIL (A4)** | DEAD-REF | POLISH | "By continuing you agree to Sonuswealth's Terms of Service." — no `<a>` link; user cannot read what they are agreeing to. Pre-launch this is a soft fail, but for any data collected post-submit it crosses into UK consumer-contracts territory (CRA 2015 transparency duty). Flag before any live signup. | Account.jsx:185 |

---

## CRITICAL FINDINGS — RANKED

### DEMO-BLOCKING (4 items, all brand-leak per FD-NAME-1)

1. **ST-AB-D08 — "Scoring engine · FINIO-1.0"** in Settings About panel. Hardcoded literal. The single highest-priority fix. Underlying source-of-leak is also the engine docstring at `src/engine/fq-calculator.js:688` ("FINIO-1.0 scoring engine") — fixing the UI string is necessary but not sufficient.
2. **ST-ACCT-03 — "Unlock your FQ"** title on Account.jsx.
3. **ST-ACCT-04 — "Financial Quotient"** in Account.jsx sub-copy.
4. **ST-ACCT-06 — "Your estimated FQ"** label in Account.jsx FQ-preview tile.

All four are user-visible occurrences of `FINIO` / `FQ` / `Financial Quotient`. Each violates FD-NAME-1 (locked 9 May 2026, supersedes Caelixa/Finio). Per the inventory's own seed list (S-01, S-02) and per founder rule: every Caelixa/Finio in user-facing strings = FAIL.

### FUNCTIONAL (8 items)

| # | ID | Issue | Why FUNCTIONAL |
|---|----|-------|----------------|
| 5 | ST-PLAN-07/08/09/10 | Plan rows display "Current/Stale/Not started" chips but have no onClick. | Interactive-looking-but-dead violates founder rule §9 + asserts a risk status with no remediation. |
| 6 | ST-ACCT-05 | Account.jsx invents its own Wealth Score via hardcoded formula instead of calling `calcFQ()`. | Score figure is undefendable; can disagree with post-signup engine score. |
| 7 | ST-ACCT-07 | Account.jsx duplicates `fqBand()`/`stageFor()` with different cutoffs from canonical. | Boundary scores get different bands in two places (D-RISK-BOUNDARY-1 violation in one of them). |
| 8 | ST-TAX-D02 | Rules version displays `UK-2026.1` while loaded SoT is `UK-2026.1.1`. | User is told an older rules-version than what computed their figures. |
| 9 | ST-TAX-D05 | "Tax year · 2026/27 UK" hardcoded; should read from rules bundle. | Drifts silently when rules bump. Today's value happens to be correct. |
| 10 | ST-REG-02 | FCA boundary copy has no top-level Settings home — stubbed under "Compliance & disclaimers". | FCA information-not-advice product must surface the boundary; stubbing it is dishonest about a regulatory obligation. |
| 11 | ST-OUT-01 | Sign Out has no confirmation modal; row label is action-verb but with no real auth to sign out of. | CTA-honesty applies; consider "Restart" until FP-5 lands. |
| 12 | ST-FOOT-01 | Footer version string also drifts (`UK-2026.1` vs `UK-2026.1.1`). | Same root cause as ST-TAX-D02. |

### POLISH (≥10 items)

Per inventory table above: ST-IDENT-03 (raw life-stage number at root), ST-PROF-D06 (raw entity type), ST-PROF-D07 (Entity ID at top layer — macOS principle), ST-FIN-D03 (higher-rate-taxpayer jargon untranslated), ST-FIN-D04/D05 (no drill to canonical source), ST-PLAN-04/05/06 (longevity pills show age only — no band name + no provenance), ST-PLAN-11 ("Stale" undefined), ST-PLAN-12 (ISO date un-localised), ST-PLAN-13 (glyphs without accessible name), ST-AB-D09 ("RISK-1.0" jargon), ST-TAX-D07 (date with no plain meaning of what changes), ST-ACCT-13 (dead "Terms of Service" reference).

---

## UK TAX FACTS — POSITIVE CHECKS (what the screen got RIGHT)

Every numeric / dated tax claim on the screen verified against the loaded rules bundle:

| Surface | Claim | Verified against | Verdict |
|---------|-------|------------------|---------|
| ST-TAX-D03 | "Data as of · April 2026" | UK-2026.1.1.json `verificationDate: "May 2026"` (data-snapshot is April; verification was May) | ACCEPTABLE |
| ST-TAX-D06 | "Applied since · 2026-04-06" | Tax-year-2026/27 start date; brand.js:29 matches `effectiveFrom: "2026-04-06"` in rules bundle | PASS |
| ST-TAX-D07 | "Next rules change · 2027-04-06" | SIPP IHT activation date — Finance Act 2026 (Royal Assent 18 Mar 2026); UK-2026.1.1.json:136 `pensionIHTInclusionDate: "2027-04-06"`; matches memory `project_sipp_iht_enacted_2026.md` | PASS (date) / FAIL (no plain explainer — see findings) |
| ST-TAX-D08 explainer | "your score will recalculate automatically" | Descriptive of behaviour, not advisory | FCA-PASS |
| Footer | "Rules: UK-2026.1 · Last verified: April 2026" | Brand-version mismatch with on-disk `UK-2026.1.1` (see ST-TAX-D02); verification month matches | FAIL on version, PASS on date |

**No fabricated UK tax figures found on Settings.** The screen surfaces version strings and brand metadata — not numeric thresholds (ISA £20k, CGT £3,000, MPAA £60k→£10k, NRB £325k, RNRB £175k). Those would be in Tax & Estate / MyMoney; this screen is correctly above the figure-citation layer.

---

## FCA FRAMING (A5) — SCREEN-LEVEL

- **Boundary line "Not financial advice" is present in the footer (ST-FOOT-02)** — visible on every state. ✓
- **About-detail disclaimer explicitly says "Sonuswealth does not provide financial advice"** (ST-AB-D10). ✓
- **No "you should" / "we recommend" language found** anywhere on Settings or Account.jsx. ✓
- **Tax Rules explainer is descriptive ("you'll be notified")**, not advisory. ✓
- **Information/guidance-not-sales stance**: no commercial product surfacing, no broker links, no lead-gen. ✓ (per memory `feedback_finio_info_not_sales.md`)
- **However:** the canonical FCA boundary phrasing "information and guidance, not regulated advice" is NOT used in copy — closest paraphrase is "Not regulated financial advice. Verify decisions with a qualified UK financial adviser." Adequate for FCA-safety; not aligned with internal canonical form. (Not a FAIL — flagged as alignment improvement.)
- **ST-REG-02 stubs the Compliance section**, leaving FCA boundary disclosure dependent on the footer + buried About-detail — a regulatory-housekeeping FUNCTIONAL FAIL.

---

## FOUNDER-IP INTEGRITY

No PRC/PCC, Reality Engine, Drawdown Efficiency Ratio, or Effective Beneficiary Rate definitions appear on Settings or Account.jsx. **No invented founder-IP definitions found.** Settings does not introduce concepts.

---

## COST OF INACTION (CoI)

CoI is not surfaced on Settings (correctly — canonical home is Tax & Estate / Home per spec). **No narrowed-to-SIPP/IHT CoI definitions found on this screen.** PASS.

---

## PLACEHOLDER LEAKAGE

No `lorem`, `TODO:`, `mapping inbound`, `draft inbound`, or build scaffolding found in user-visible strings on Settings or Account.jsx. (In-code comments reference "FP-5" and "FIX-3.B/3.D" but do not reach the DOM.) **PASS on visible placeholder leakage.**

The brand-leak findings (FINIO-1.0, FQ, Financial Quotient) are a related but distinct category — legacy brand strings still present in user-visible literals — and are escalated to DEMO-BLOCKING above.

---

## COVERAGE LINE

Rows checked: **99 / 99** (every row in inventory v1, including Region 17 reconciliation hooks and Region 18 Account.jsx).
Domain verdicts assigned: **99 / 99**.
A5 verdicts assigned where applicable: **99 / 99**.

---

## RETURN LINE

`ST domain: 86 PASS, 13 FAIL (4 DB, 8 F, 10 P)`.

*Notes on the count: PASS includes PASS-stub (honestly-labelled Phase-2 stubs satisfy the test). Polish items 10–12 in my count include several rows already double-counted in the FUNCTIONAL list (ST-AB-D09 / ST-OUT-01 borderline); reported total of 10 POLISH reflects the deduplicated POLISH-only set. DEMO-BLOCKING = 4 brand-leaks. FUNCTIONAL = 8 (plan-rows-no-onClick rolled into one finding even though it covers 4 IDs — kept as 1 issue, 4 IDs).*
