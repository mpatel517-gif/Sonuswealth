# Settings — Pass 1 Conformance (A1)

**Screen:** Sonuswealth Settings
**Component(s):** `src/screens/Settings.jsx` (in-overlay) + `src/screens/Account.jsx` (out-of-Settings auth surface, reached via Onboarding only).
**Inventory:** `settings-inventory-v1.md` (v1, 99 rows).
**Method:** A1 — every inventory row checked against build for `Identified` (present, right region, right content). Spec used for intent only. FDs treated as fixed (FD-NAME-1, FD-LOGO-1, FD-MASCOT-1, FD-CROSS-1, FD-ST-1, FD-ST-2, FD-ST-3).
**Date:** 2026-05-18.

Severities applied per orchestrator rules:
- **DB** = DEMO-BLOCKING (user-visible legacy brand string, FD-NAME-1 violation; or interactive-looking-but-dead chrome).
- **F** = FUNCTIONAL (wrong wiring, hidden setting per FD-ST-1, hardcoded value that should reconcile).
- **P** = POLISH (a11y, label clarity, format).
- No severity = pure PASS row.

Region 17 (cross-screen reconciliation) is A6-scope; A1 only records whether the **control** exists on Settings. Where no control exists, A1 = FAIL with the FD-ST-1 reasoning.

Region 18 (Account.jsx) checked as a standalone surface per inventory note. Routing coherence with ST-OUT-01 is explicitly out-of-scope until auth lands.

---

## 1. A1 Verdict Table

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| **Region 1 — Shell / chrome** | | | | |
| ST-CHR-01 | PASS | — | `OverlayShell` wrapper present, screen title "Settings" passed in. a11y attrs (`role="dialog"`, `aria-modal`, `aria-label`) are owned inside `OverlayShell` (not visible in this file) — A1 satisfied at the structural level; a11y is A6 scope. | Settings.jsx:316–320 |
| ST-CHR-02 | PASS | — | Back button wired in `onBack`: closes detail panel if open, else calls `onClose?.()`. Dual behaviour matches inventory. | Settings.jsx:318 |
| ST-CHR-03 | PASS | — | Title `"Settings"` rendered via `OverlayShell` prop. | Settings.jsx:317 |
| ST-CHR-04 | PASS | — | Home pill wired via `onHome` prop forwarded to `OverlayShell`. Render depends on parent passing it. | Settings.jsx:289, 319 |
| ST-CHR-05 | PASS | — | Inventory says OverlayShell owns the global Escape handler. Not contradicted by Settings.jsx. (Cross-handler ordering risk is S-14 / POLISH, not A1.) | (in OverlayShell — referenced) |
| ST-CHR-06 | PASS | — | Local Escape handler installed with `capture: true`, only fires when `detail !== null`, calls `setDetail(null)` + `stopPropagation()`. Matches row. | Settings.jsx:307–313 |
| **Region 2 — Identity header** | | | | |
| ST-IDENT-01 | PASS | — | Gradient avatar with first character of `displayName \|\| name \|\| '?'`. | Settings.jsx:326–334 |
| ST-IDENT-02 | PASS | — | `entity.displayName \|\| entity.name` rendered. | Settings.jsx:337 |
| ST-IDENT-03 | PASS | — | Renders `"Stage {lifeStage ?? '—'} · {lifeStageName ?? '—'}"`. Structurally present. (A5 "Stage 3" plain-English concern is S-15, POLISH — not A1.) | Settings.jsx:340–342 |
| **Region 3 — Profile & Identity section** | | | | |
| ST-PROF-01 | PASS | — | `<Section title="Profile & identity">`. | Settings.jsx:346 |
| ST-PROF-02 | PASS | — | "My Profile" row, value = displayName/name, `onClick` → `setDetail('profile')`. | Settings.jsx:347–350 |
| ST-PROF-03 | PASS | — | "Financial Details" row, value `"View"` (static), `onClick` → `setDetail('financial')`. Static "View" is A6 concern, not A1. | Settings.jsx:351–355 |
| **Region 3a — Profile detail panel** | | | | |
| ST-PROF-D01 | PASS | — | `DetailPanel title="My Profile"` + ← Back wired to `setDetail(null)`. | Settings.jsx:517–518 |
| ST-PROF-D02 | PASS | — | Name InfoRow with full fallback chain. | Settings.jsx:519 |
| ST-PROF-D03 | PASS | — | Age InfoRow, `entity.age \|\| '—'`. | Settings.jsx:520 |
| ST-PROF-D04 | PASS | — | Life stage InfoRow combines `lifeStage` + `lifeStageName`. | Settings.jsx:521 |
| ST-PROF-D05 | PASS | — | Jurisdiction InfoRow reads `entity?.jurisdictionContext?.primary \|\| 'United Kingdom'`. | Settings.jsx:522–523 |
| ST-PROF-D06 | PASS | — | Type InfoRow, `entity.type \|\| 'individual'`. | Settings.jsx:524 |
| ST-PROF-D07 | PASS | — | Entity ID InfoRow present (`entity.id \|\| '—'`). Identified per inventory. (Seed S-09 macOS-principle critique is POLISH, not A1 — A1 just checks presence.) | Settings.jsx:525 |
| ST-PROF-D08 | PASS | — | Phase-2 explainer footer rendered ("Profile editing is coming in Phase 2…"). | Settings.jsx:526–530 |
| **Region 3b — Financial Details detail panel** | | | | |
| ST-FIN-D01 | PASS | — | `DetailPanel title="Financial Details"` + ← Back. | Settings.jsx:534–535 |
| ST-FIN-D02 | PASS | — | Target income InfoRow with `fmt(entity.targetIncome)`/yr. | Settings.jsx:536–537 |
| ST-FIN-D03 | PASS | — | Higher-rate taxpayer InfoRow, Yes/No. | Settings.jsx:538–539 |
| ST-FIN-D04 | PASS | — | Drawdown InfoRow, `fmt(entity.drawdown)`/yr or "Not started". A3-link absence is FUNCTIONAL (seed S-17), not A1. | Settings.jsx:540–541 |
| ST-FIN-D05 | PASS | — | Net worth InfoRow, `fmt(fq.netWorthVal)`. Same caveat as ST-FIN-D04. | Settings.jsx:542–543 |
| ST-FIN-D06 | PASS | — | Phase-2 explainer footer ("Editing is coming in Phase 2…"). | Settings.jsx:544–548 |
| **Region 4 — Households & Sharing** | | | | |
| ST-HH-01 | PASS | — | Section header "Households & sharing". | Settings.jsx:359 |
| ST-HH-02 | PASS | — | Row "Households", `phase2={true}`, no `onClick` → FD-ST-2 honest stub. | Settings.jsx:360–361 |
| **Region 5 — Connected Services** | | | | |
| ST-CONN-01 | PASS | — | Section header "Connected services". | Settings.jsx:365 |
| ST-CONN-02 | PASS | — | Row "Connected accounts", `phase2={true}`. | Settings.jsx:366–367 |
| **Region 6 — Privacy & Security** | | | | |
| ST-SEC-01 | PASS | — | Section header "Privacy & security". | Settings.jsx:371 |
| ST-SEC-02 | PASS | — | Row "Security", `phase2={true}`. | Settings.jsx:372–373 |
| **Region 7 — Feeds & Reports** | | | | |
| ST-FEED-01 | PASS | — | Section header "Feeds & reports". | Settings.jsx:377 |
| ST-FEED-02 | PASS | — | "IFA Access" row, value `"IFA account"` / `"No IFA linked"`, `onClick` → `setDetail('ifa')`. | Settings.jsx:378–381 |
| ST-FEED-03 | PASS | — | Row "Reports & feeds", `phase2={true}`. | Settings.jsx:382–383 |
| **Region 7a — IFA detail panel** | | | | |
| ST-IFA-D01 | PASS | — | DetailPanel "IFA Access" + ← Back. | Settings.jsx:552–553 |
| ST-IFA-D02 | PASS | — | Account type InfoRow on IFA branch ("Independent Financial Adviser"). | Settings.jsx:556 |
| ST-IFA-D03 | PASS | — | Firm InfoRow on IFA branch, `entity.firmName \|\| '—'`. | Settings.jsx:557 |
| ST-IFA-D04 | PASS | — | Client count InfoRow on IFA branch. | Settings.jsx:558 |
| ST-IFA-D05 | PASS | — | "Linked IFA: None" InfoRow on non-IFA branch. | Settings.jsx:562 |
| ST-IFA-D06 | PASS | — | Phase-2 explainer "Link an IFA to share your Sonuswealth profile…". Brand string is `Sonuswealth` (FD-NAME-1 compliant). | Settings.jsx:563–567 |
| **Region 8 — Notifications** | | | | |
| ST-NOTIF-01 | PASS | — | Section header "Notifications". | Settings.jsx:387 |
| ST-NOTIF-02 | PASS | — | Row "Notifications", `phase2={true}`. | Settings.jsx:388–389 |
| **Region 9 — Personalisation** | | | | |
| ST-PERS-01 | PASS | — | Section header "Personalisation". | Settings.jsx:393 |
| ST-PERS-02 | PASS | — | Theme row Badge `colour="#8A4AF5" glyph="◐"` + label "Theme". | Settings.jsx:394–399 |
| ST-PERS-03 | PASS | — | `ThemePill value={theme} onChange={onThemeChange}` rendered. Propagation/`aria-pressed` are A6/POLISH (S-10). | Settings.jsx:399, 242–263 |
| ST-PERS-04 | PASS | — | Hide-balances row Badge + label. | Settings.jsx:401–406 |
| ST-PERS-05 | PASS | — | Sub-label "Replaces £ amounts with ••••". | Settings.jsx:408–411 |
| ST-PERS-06 | PASS | — | Hide-balances toggle button wired to `setHideBalances`, `aria-pressed` set, LS write-through via `useEffect`. Engine-event emission gap is A6 (S-06). | Settings.jsx:413–427, 297 |
| **Region 10 — Plans (longevity + plan list)** | | | | |
| ST-PLAN-01 | PASS | — | Section header "Plans". | Settings.jsx:432 |
| ST-PLAN-02 | PASS | — | Longevity row Badge + label "Longevity band". | Settings.jsx:433–438 |
| ST-PLAN-03 | PASS | — | Sub-label `Plan to age {...}` using LONGEVITY_BANDS lookup. | Settings.jsx:440–442 |
| ST-PLAN-04 | PASS | — | Conservative (85) pill via `LongevityPill`. | Settings.jsx:444, 52–76 |
| ST-PLAN-05 | PASS | — | Median (88) pill. | Settings.jsx:444, 37–41 |
| ST-PLAN-06 | PASS | — | Optimistic (92) pill. | Settings.jsx:444, 37–41 |
| ST-PLAN-07 | **FAIL** | DB | "Protection plan" row rendered via `PlanRow`, **no `onClick` handler defined anywhere in `PlanRow`** — row paints a Current/Stale/Not-started chip but tapping it does nothing. Confirms Seed S-04. CLAUDE.md §9 "interactive-looking but dead = FAIL" → DEMO-BLOCKING. | Settings.jsx:79–125, 446–448 |
| ST-PLAN-08 | **FAIL** | DB | "Drawdown plan" row — same `PlanRow` component, no `onClick`. | Settings.jsx:79–125, 446–448 |
| ST-PLAN-09 | **FAIL** | DB | "Estate plan" row — same. | Settings.jsx:79–125, 446–448 |
| ST-PLAN-10 | **FAIL** | DB | "Cashflow plan" row — same. | Settings.jsx:79–125, 446–448 |
| ST-PLAN-11 | PASS | — | Status chip rendered with `planStaleness().severity` colour-coding; labels "Current"/"Stale"/"Not started" present. | Settings.jsx:84–90, 117–122 |
| ST-PLAN-12 | PASS | — | "Last reviewed" line rendered with ISO slice or "No active plan" fallback. (Hardcoded ISO format is POLISH per S-16.) | Settings.jsx:111–115 |
| ST-PLAN-13 | PASS | — | Glyphs `⛨ ⊿ ◇ ≋` rendered. | Settings.jsx:45–49, 105 |
| **Region 11 — Data & Documents** | | | | |
| ST-DATA-01 | PASS | — | Section header "Data & documents". | Settings.jsx:452 |
| ST-DATA-02 | PASS | — | Row "Document vault", `phase2={true}`. (Inconsistency with extant `Vault.jsx` flagged in S-11 as FUNCTIONAL — not A1.) | Settings.jsx:453–454 |
| ST-DATA-03 | PASS | — | Row "Export & delete", `phase2={true}`. | Settings.jsx:455–456 |
| **Region 12 — Help & Support** | | | | |
| ST-HELP-01 | PASS | — | Section header "Help & support". | Settings.jsx:460 |
| ST-HELP-02 | PASS | — | Row "Help & support", `phase2={true}`. | Settings.jsx:461–462 |
| **Region 13 — Subscription & Billing** | | | | |
| ST-SUB-01 | PASS | — | Section header "Subscription & billing". | Settings.jsx:466 |
| ST-SUB-02 | PASS | — | Row "Subscription & billing", `phase2={true}`. | Settings.jsx:467–468 |
| **Region 14 — Regulatory & Compliance** | | | | |
| ST-REG-01 | PASS | — | Section header "Regulatory & compliance". | Settings.jsx:472 |
| ST-REG-02 | PASS | — | Row "Compliance & disclaimers", `phase2={true}`. | Settings.jsx:473–474 |
| **Region 15 — About & Legal** | | | | |
| ST-ABOUT-01 | PASS | — | Section header "About & legal". | Settings.jsx:478 |
| ST-ABOUT-02 | PASS | — | "Tax Rules" row, value = `rulesVer`, `onClick` → `setDetail('taxrules')`. | Settings.jsx:479–482 |
| ST-ABOUT-03 | PASS | — | Row `label={`About ${BRAND.name}`}`, value `v{BRAND.version}`, `onClick` → `setDetail('about')`. Label resolves to "About Sonuswealth". | Settings.jsx:483–487 |
| **Region 15a — Tax Rules detail panel** | | | | |
| ST-TAX-D01 | PASS | — | DetailPanel "Tax Rules" + ← Back. | Settings.jsx:573–574 |
| ST-TAX-D02 | PASS | — | Rules version InfoRow = `rulesVer` (entity override else `BRAND.rulesVersion`). | Settings.jsx:575 |
| ST-TAX-D03 | PASS | — | Data as of InfoRow = `dataDate`. | Settings.jsx:576 |
| ST-TAX-D04 | PASS | — | Jurisdiction InfoRow. | Settings.jsx:577–578 |
| ST-TAX-D05 | **FAIL** | F | Tax year **hardcoded** as string literal `"2026/27 UK"` instead of reading from rules bundle. Drifts on next rules version. Confirms Seed S-08. | Settings.jsx:579 |
| ST-TAX-D06 | PASS | — | Applied since InfoRow = `BRAND.appliedSince`. | Settings.jsx:580 |
| ST-TAX-D07 | PASS | — | Next rules change InfoRow = `BRAND.nextRulesDate`. | Settings.jsx:581 |
| ST-TAX-D08 | PASS | — | Tax Rules explainer footer present, uses canonical "Wealth Score" and interpolates `BRAND.nextRulesDate`. | Settings.jsx:582–585 |
| **Region 15b — About detail panel** | | | | |
| ST-AB-D01 | PASS | — | DetailPanel `title={`About ${BRAND.name}`}` + ← Back. | Settings.jsx:592–593 |
| ST-AB-D02 | PASS | — | App InfoRow = `BRAND.name` ("Sonuswealth"). | Settings.jsx:594 |
| ST-AB-D03 | PASS | — | Version InfoRow = `v{BRAND.version}`. | Settings.jsx:595 |
| ST-AB-D04 | PASS | — | Rules bundle InfoRow = `BRAND.rulesBundle` ("UK-2026.1"). A5 cryptic-string concern is POLISH, not A1. | Settings.jsx:596 |
| ST-AB-D05 | PASS | — | Applied since InfoRow. | Settings.jsx:597 |
| ST-AB-D06 | PASS | — | Next rules date InfoRow. | Settings.jsx:598 |
| ST-AB-D07 | PASS | — | Data last updated InfoRow. | Settings.jsx:599 |
| ST-AB-D08 | **FAIL** | **DB** | **Scoring engine row hardcoded as `"FINIO-1.0"`** — user-facing legacy brand string. Direct FD-NAME-1 violation. Inventory marked this as DEMO-BLOCKING; orchestrator brief calls it out by name. Confirms Seed S-01. | Settings.jsx:600 |
| ST-AB-D09 | **FAIL** | P | Risk engine row hardcoded as `"RISK-1.0"` — A5 plain-meaning concern only; "RISK" is not a legacy brand string under FD-NAME-1, so POLISH (not DB). Identified per inventory row. | Settings.jsx:601 |
| ST-AB-D10 | PASS | — | About disclaimer block renders `BRAND.disclaimer` + appended FCA boundary sentence using `BRAND.name`. | Settings.jsx:602–610 |
| **Region 16 — Sign Out + footer** | | | | |
| ST-OUT-01 | PASS | — | "Sign Out" row rendered, `danger={true}`, onClick fires `onClose?.()` + `window.location.href = '/'`. Identified. (No-confirm-modal and no-auth-wired concerns are FUNCTIONAL per Seed S-05; A2/A3 scope.) | Settings.jsx:491–504 |
| ST-FOOT-01 | PASS | — | Footer brand line `{BRAND.name} · {BRAND.rulesLabel(rulesVer, dataDate)}` rendered. Resolves to "Sonuswealth · Rules: UK-2026.1 · Last verified: April 2026". FD-NAME-1 compliant. | Settings.jsx:506–509 |
| ST-FOOT-02 | PASS | — | "Not financial advice" line present in same block. | Settings.jsx:509 |
| **Region 17 — Cross-screen reconciliation hooks (A1 = control presence)** | | | | |
| ST-X-01 | PASS | — | Theme control present (ST-PERS-03). Propagation correctness = A6. | Settings.jsx:399 |
| ST-X-02 | PASS | — | Hide-balances control present (ST-PERS-06) with LS persistence. Event-bus emission gap = A6 (S-06). | Settings.jsx:413–427, 297 |
| ST-X-03 | PASS | — | Longevity-band control present (ST-PLAN-04/05/06). Engine wiring gap noted (engine support "comes in s02a") = A6 / FUNCTIONAL (S-04 separately). | Settings.jsx:444 |
| ST-X-04 | PASS | — | Plan staleness read via `planStaleness()` — control on Settings is read-only by design (Settings is consumer, not owner of "last reviewed"). | Settings.jsx:81, 84–90 |
| ST-X-05 | **FAIL** | F | **No currency or locale control on this surface.** FD-ST-1 says these MUST be exposed or honestly stubbed. Neither a live control nor a Phase-2-labelled row exists. Hidden setting. Confirms Seed S-07. | Settings.jsx (whole file — grep `currency`/`locale` returns nothing) |
| ST-X-06 | PASS | — | Notification cadence honestly stubbed (ST-NOTIF-02 `phase2={true}`). FD-ST-2 compliant. | Settings.jsx:388–389 |
| ST-X-07 | **FAIL** | F | **No withdrawal-cadence control on this surface.** FD-ST-1 says it must be exposed here or honestly stubbed (or its ownership transferred to Cashflow with a tease here). Neither present. Hidden setting. Confirms Seed S-07. | Settings.jsx (no row exists) |
| ST-X-08 | PASS | — | Data-export schedule covered by "Export & delete" Phase-2 stub (ST-DATA-03). FD-ST-2 compliant. | Settings.jsx:455–456 |
| ST-X-09 | PASS | — | Account closure / delete covered by same "Export & delete" stub. FD-ST-2 compliant. Phase-2 must add a confirmation modal (out of A1 scope). | Settings.jsx:455–456 |
| ST-X-10 | **FAIL** | F | **No jurisdiction picker on this surface.** Jurisdiction appears read-only in Profile detail panel (ST-PROF-D05) — there is no control to change it. FD-ST-1 violation. Hidden setting. Multi-jurisdiction users blocked. Confirms Seed S-07. | Settings.jsx:522–523; no control elsewhere |
| **Region 18 — Account.jsx (out-of-Settings auth surface)** | | | | |
| ST-ACCT-01 | PASS | — | Card container present with blurred dashboard preview behind 🔒. | Account.jsx:61–81 |
| ST-ACCT-02 | PASS | — | Lock emoji + "Your dashboard is ready" rendered. | Account.jsx:78–79 |
| ST-ACCT-03 | **FAIL** | **DB** | Title literal `"Unlock your FQ"`. **"FQ" is legacy brand abbreviation** (Financial Quotient — pre-Sonuswealth nomenclature). FD-NAME-1 mandates canonical "Wealth Score". Confirms Seed S-02 (DEMO-BLOCKING). Orchestrator brief calls this out by name. | Account.jsx:85 |
| ST-ACCT-04 | **FAIL** | **DB** | Sub-copy literal `"Create your free account to see your personalised Financial Quotient dashboard."` **"Financial Quotient" is the legacy long-form** of FQ. Direct FD-NAME-1 violation. Confirms Seed S-02. | Account.jsx:87 |
| ST-ACCT-05 | PASS | — | Score number rendered. (Hardcoded local formula instead of `calcFQ()` = A6 reconcile fail per S-03 / FUNCTIONAL — not A1; A1 just checks the tile is present.) | Account.jsx:44–45, 96 |
| ST-ACCT-06 | **FAIL** | **DB** | Label literal `"Your estimated FQ"`. Same legacy brand abbreviation. FD-NAME-1 violation. Confirms Seed S-02. | Account.jsx:98 |
| ST-ACCT-07 | PASS | — | Band/stage/age line rendered (`{band.name} · {stage} · Age {age}`). A6 duplication of engine logic is S-03 / FUNCTIONAL. | Account.jsx:99 |
| ST-ACCT-08 | PASS | — | Google waitlist button rendered, `disabled`, labelled `"Continue with Google (waitlist)"`. CTA-honesty compliant. | Account.jsx:106–119 |
| ST-ACCT-09 | PASS | — | Apple waitlist button same shape. | Account.jsx:106–119 |
| ST-ACCT-10 | PASS | — | Email input — controlled, `autoComplete="email"`, labelled, `required`. | Account.jsx:131–150 |
| ST-ACCT-11 | PASS | — | Password input — controlled, `autoComplete="new-password"`, label includes "(this stays on your device — Phase 2)" honesty caveat. | Account.jsx:152–170 |
| ST-ACCT-12 | PASS | — | Submit button "Join waitlist" wired to `joinWaitlist()` which forwards full obData payload to `onEnter()`. | Account.jsx:174–181, 52–59 |
| ST-ACCT-13 | PASS | — | Footer pre-launch note rendered. ("Terms of Service" no-link concern is S-12 / POLISH — not A1.) | Account.jsx:184–186 |

---

## 2. UNLISTED (build contains, inventory does not)

| Element | Region | Evidence |
|---------|--------|----------|
| `calcFQ(entity)` + `fqBand(fq.total)` computation in `Settings` body (lines 300–301), but the resulting `fq`/`band` are **only consumed in `ST-FIN-D05`** (`fq.netWorthVal`) — `band` is computed and discarded. Not an A1 finding against an inventory row, but a code smell: the computation suggests a score panel was once rendered here. Per FD-ST-3 the canonical score lives on Home; this dead `band` derivation is consistent with the inventory note about the removed `finioscore` panel. **Treat as informational, not a finding** — but flag for FD-ST-3 regression watch in future passes. | between regions | Settings.jsx:300–301 |

No genuine UNLISTED DOM element found. Every visible row/section in the build maps to an inventory ID.

---

## 3. DECISION-NEEDED (founder, no severity)

| # | Topic | Build state | Spec / FD state | Why a decision is needed |
|---|-------|-------------|-----------------|--------------------------|
| D1 | **No HTML baseline for Settings.** | None on disk. | Inventory header explicitly notes the absence: "Telegram-style settings overlay pattern is the structural baseline (see component header comment). Conformance-auditor: flag missing HTML baseline as a finding." | Founder must either (a) commission a Stitch/HTML baseline for Settings, or (b) bless the current React render as the conformance baseline for future passes. Without one, Pass 2 has no design truth to walk against beyond this inventory. |
| D2 | **Risk engine label "RISK-1.0".** | Hardcoded literal alongside the legacy "FINIO-1.0". | FD-NAME-1 covers "Caelixa" / "Finio" / "FQ" / "Financial Quotient". "RISK-1.0" is not a legacy *brand* — it's a cryptic version label. Inventory rates it A5 only. | Founder decides: hide engine version strings from the user entirely (macOS principle), rename to plain English ("Wealth Score engine v1.0" / "Risk Score engine v1.0"), or accept as developer-info displayed to all users. Auditor cannot pick. |
| D3 | **Where does jurisdiction live?** | Settings shows jurisdiction read-only in Profile detail panel (ST-PROF-D05). No control. | FD-ST-1: configuration owned by Settings. But ST-X-10 marks "no jurisdiction picker" as hidden setting / FAIL. | Founder decides whether jurisdiction is (a) a Settings-owned preference that needs a picker (FD-ST-1 path), or (b) an Onboarding-only one-shot, in which case Profile detail should show it as locked + a re-link to Onboarding. Currently it's neither. |
| D4 | **Where does withdrawal cadence live?** | Nowhere in Settings. | FD-ST-1 lists it as a Settings-owned preference. Inventory notes "or lives on Cashflow — verify ownership." | Founder decides ownership: Settings (add control) or Cashflow (add tease here pointing to Cashflow). Inventory cannot resolve this. |
| D5 | **Document vault duality.** | Settings shows "Document vault" as Phase-2 stub (ST-DATA-02). But `src/screens/Vault.jsx` exists and is reachable from other surfaces. | FD-ST-2 (Phase-2 honesty) vs. cross-surface coherence. | Founder decides: promote the row to a real link into `Vault.jsx` (drop `phase2={true}`), or hide `Vault.jsx` from other entry points until Phase 2. The current state is incoherent — same feature, two different honesty postures. |
| D6 | **Settings ↔ Account routing on Sign Out.** | ST-OUT-01 fires `window.location.href = '/'` with no real auth, no confirm. Account.jsx is a separate surface reached via Onboarding, not by Sign-Out. | Out of A1 scope per inventory ("not in scope until real auth lands"). | Listed only so it is not forgotten when auth lands in Phase 2 / FP-5. No decision needed now. |

---

## 4. Brand-drift sweep (extra pass — verified each user-facing string against FD-NAME-1)

Settings.jsx:
- All `BRAND.name` interpolations resolve to "Sonuswealth". ✓
- "Wealth Score" appears in `ST-FIN-D06` and `ST-TAX-D08` explainer — canonical. ✓
- IFA Phase-2 explainer uses "Sonuswealth profile" (Settings.jsx:565–566). ✓
- About disclaimer block uses `${BRAND.name}` — resolves to "Sonuswealth". ✓
- **Single drift: `"FINIO-1.0"` hardcoded literal at Settings.jsx:600 (ST-AB-D08).** DB.

Account.jsx:
- **Three drifts (all DB):**
  - `"Unlock your FQ"` (Account.jsx:85 — ST-ACCT-03).
  - `"Create your free account to see your personalised Financial Quotient dashboard."` (Account.jsx:87 — ST-ACCT-04).
  - `"Your estimated FQ"` (Account.jsx:98 — ST-ACCT-06).
- "Sonuswealth's Terms of Service" footer (Account.jsx:185) is FD-NAME-1 compliant. ✓
- No "Caelixa" or "Finio" tokens found in either file.

No other Caelixa / Finio / FQ / Financial Quotient strings present in the two audited components.

---

## 5. Coverage math

```
Total inventory rows:           99 (regions 1–18)
Rows verified:                  99
Rows UNVERIFIED:                 0
Coverage:                      100.0%
```

Verdict breakdown:
- **PASS:** 90
- **FAIL:** 9
- **NA:** 0 (every row was a real check)
- **UNVERIFIED:** 0

FAIL severity breakdown:
- **DEMO-BLOCKING (DB):** 6
  - ST-PLAN-07, ST-PLAN-08, ST-PLAN-09, ST-PLAN-10 (interactive-looking-but-dead plan rows, Seed S-04 confirmed).
  - ST-AB-D08 ("FINIO-1.0" hardcoded, FD-NAME-1 violation, Seed S-01 confirmed — **flagged by orchestrator brief**).
  - ST-ACCT-03, ST-ACCT-04, ST-ACCT-06 (Account.jsx "FQ" / "Financial Quotient" legacy nomenclature, Seed S-02 confirmed — **flagged by orchestrator brief**). Counted as **three IDs but one root cause** (Account.jsx FD-NAME-1 sweep); orchestrator brief counted ST-S-02/03 together as two seeds. To keep arithmetic clean against the brief I count each DB-severity ID individually → **6 DB total** (4 plan rows + 1 Settings.jsx brand string + 3 Account.jsx brand strings - 1 because ST-S-02/03 brief item ≈ ST-ACCT-03/04/06 = 3 IDs; net DB count by *unique ID* = 4 + 1 + 3 = **8** unique DB IDs).
  - **Reconciled DB count = 8 unique IDs**.
- **FUNCTIONAL (F):** 4
  - ST-TAX-D05 (hardcoded "2026/27 UK").
  - ST-X-05 (no currency / locale control).
  - ST-X-07 (no withdrawal cadence control).
  - ST-X-10 (no jurisdiction picker).
- **POLISH (P):** 1
  - ST-AB-D09 ("RISK-1.0" plain-meaning).

Sum-check: 8 DB + 4 F + 1 P = 13 FAIL — but I counted 9 above. Reconciling: I was inconsistent in the table. Recounting from the table (FAIL rows):
1. ST-PLAN-07 (DB)
2. ST-PLAN-08 (DB)
3. ST-PLAN-09 (DB)
4. ST-PLAN-10 (DB)
5. ST-TAX-D05 (F)
6. ST-AB-D08 (DB)
7. ST-AB-D09 (P)
8. ST-X-05 (F)
9. ST-X-07 (F)
10. ST-X-10 (F)
11. ST-ACCT-03 (DB)
12. ST-ACCT-04 (DB)
13. ST-ACCT-06 (DB)

**Corrected: 13 FAIL total = 8 DB + 4 F + 1 P. PASS = 86.**

---

## 6. Return line

ST conformance: **86 PASS, 13 FAIL (8 DB, 4 F, 1 P), 0 UNLISTED.**
