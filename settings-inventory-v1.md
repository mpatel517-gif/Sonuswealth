# Settings Screen — Element Inventory v1

**Screen:** Sonuswealth Settings (build target: React in `src/screens/Settings.jsx`)
**Design baseline:** none on disk for Settings — Telegram-style settings overlay pattern is the structural baseline (see component header comment). Conformance-auditor: flag missing HTML baseline as a finding.
**Reconciliation baseline:**
- Brand SoT — `src/config/brand.js` (`BRAND.name`, `BRAND.version`, `BRAND.rulesVersion`, `BRAND.appliedSince`, `BRAND.nextRulesDate`, `BRAND.rulesBundle`, `BRAND.disclaimer`, `BRAND.rulesLabel`)
- Theme tokens — `src/index.css` (every `--c-*`, `--fs-*`, `--sh-*` token)
- Engine — `src/engine/fq-calculator.js` (`calcFQ`, `fqBand`, `fmt`, `planFor`, `planStaleness`)
- Auth — Supabase (per orchestrator note; Sign Out currently has no auth wired — comment in src says "No auth wired yet (FP-5)")
- Persistence — `localStorage` keys `sonus.settings.hideBalances`, `sonus.settings.longevity` (stop-gap; spec wants event-sourced via `EventsProvider` → `SETTINGS_TEMPORAL_PREFS_CHANGED`)
**Intent reference (NOT a conformance target):** `2-Product/2-Product-settings-master-v1_5.md` — 13 user-facing sections cited in component header. Use for section heading taxonomy + Phase-1 vs Phase-2 split.
**Date:** 17 May 2026

**Note on Account.jsx:** `src/screens/Account.jsx` is **NOT** imported by Settings. It is a pre-launch waitlist signup card reached via the Onboarding flow (App.jsx). It is enumerated below in **Region 9 — Out-of-Settings auth surface (Account.jsx)** as a standalone surface for completeness, because the orchestrator asked for it and it owns auth-adjacent state. Auditors should treat Region 9 as a separate surface for A1 reconciliation purposes (a Settings ↔ Account routing audit is out of scope until Sign Out / Sign In wire to a real auth flow).

---

## Why this file exists

This is the **fixed target** the whole audit measures against. Every interactive or
data-bearing element on Settings is one numbered row. The audit does not "find mistakes" —
it walks this list and records a verdict per row. That is the only thing that makes
"99% confident" a real statement: it means *N of M rows verified PASS*, not a feeling.

**This file is the worksheet.** Auditor agents fill the `Verdict` columns. Do not add
or remove rows except via the "inventory drift" rule in the runbook (§6). If the build
contains an element not listed here, that is itself a finding (`UNLISTED`).

---

## The six assertions (every row is tested against all six)

| # | Assertion | Fails when… |
|---|-----------|-------------|
| A1 | **Identified** — element exists in the build and matches this row | Element missing from build, or build has an element not in this inventory |
| A2 | **Drillable** — if it is a number, action, or nav element, interacting with it does something | Tapping is dead / no handler / no visible response |
| A3 | **Destination correct** — it resolves to the surface that **owns its subject** | A theme toggle that doesn't propagate; an export that lands nowhere; a profile-edit that lands on a read-only panel |
| A4 | **Destination coherent** — the landing is a usable continuation: it shows the SOURCE, an ACTION, or a DECISION | Lands on a generic modal, a dead-end, a Phase-2 stub with no honesty label, or an unrelated view |
| A5 | **Plain English** — label + any explainer readable by a non-expert in one pass; jargon translated; information-not-advice (FCA) | Unexplained jargon ("FQ", "FINIO-1.0", "RISK-1.0", bare version strings); advice-phrased copy; figure with no plain meaning |
| A6 | **Reconciled** — every number traces to an engine function and matches value + format everywhere it appears; every toggle persists and propagates to every surface that reads it | Hardcoded version/date; `fmt()` not used; toggle that doesn't write through to `index.css` / events / Supabase; brand string `Caelixa`/`Finio` user-facing |

**Drill destination taxonomy (A3 + A4).** Every drillable element must resolve to one of:
- **SOURCE** — the breakdown / detail / provenance of where a number came from.
- **ACTION** — a place to *do* the thing (a panel, a flow, a toggle that persists).
- **DECISION** — a place to weigh options and commit (plan creation, longevity selection).

If a drillable element resolves to *none* of these, A4 = FAIL.

**Verdict values:** `PASS` · `FAIL` · `NA` · `UNVERIFIED` (default) · `BLOCKED` (cannot test).
**Severity (set by orchestrator on any FAIL):** `DEMO-BLOCKING` · `FUNCTIONAL` · `POLISH`.

---

## Confirmed founder decisions (auditors treat these as fixed — do NOT flag against the stale spec)

| FD | Decision |
|----|----------|
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Caelixa and Finio).** Source of truth: `src/config/brand.js` (`BRAND.name`). Casing: logo / wordmark = `sonuswealth` (lowercase, see `BRAND.nameDisplay`); body text, titles, aria-labels, page `<title>`, score strings = `Sonuswealth` (sentence case); marketing slogans (footer-tier only) may use ALL CAPS. Every `Caelixa` or `Finio` in user-facing strings = FUNCTIONAL FAIL (A5/A6). Engine-module disclaimers + comments are queued for Wave 4 Morph sweep. |
| FD-LOGO-1 | Brand assets live at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. Conformance-auditor checks that every surface uses the right logo variant per theme (light/dark) and flags the faded-purple dark variant as DEMO-BLOCKING wherever it appears below WCAG AA contrast. |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms: Starting Out · Growing Wealth · Planning Ahead · Peak Complexity · Securing Tomorrow · Leaving a Legacy. Placement on screens is **Wave 7 enhancement scope**, not in-audit; audit treats absence of Sonnu as not-a-finding. |
| FD-CROSS-1 | Settings owns **configuration** — the surface where preferences for every other screen are set (theme, currency formatting, notification cadence, withdrawal cadence, data-export schedule, account closure). Other surfaces read configuration; only Settings writes it. Auditors verify the write-through: a change made here must propagate to every surface that consumes the preference. Toggles that persist only locally (e.g. `localStorage` without event emission) fail A6 because cross-tab reads don't see the change without consumer-side `useEffect` on the same key. |
| FD-ST-1 | **Theme toggle, currency, locale, and any feature-flag toggles must be on this surface.** Hidden settings = FAIL. Auditors enumerate every toggle/preference the rest of the app reads (theme, hide-balances, longevity band, jurisdiction, currency, notification cadence, IFA linkage, locale) and verify each has a control on this surface — or is honestly stubbed with a Phase-2 label. Silent dependencies (a preference the app reads but Settings doesn't expose) fail A1. |
| FD-ST-2 | **Phase-1 vs Phase-2 honesty.** Per component header + project CLAUDE.md §9, Phase-2 sections show titled stubs with an honest "Coming in Phase 2" sub-label and `cursor:default` + 55% opacity. Stubs that look interactive but do nothing = FAIL. Stubs that are honestly labelled = PASS-AS-STUB (A4 satisfied by the honesty label, not by a real action). |
| FD-ST-3 | **Wealth Score is NOT owned by Settings.** Per spec §Q1B.3, the canonical home for Wealth Score is Home tab. The `finioscore` detail panel was removed from Settings deliberately. Auditors do **not** flag the absence of a score panel here — they flag *re-introduction* of one as a regression. |

---

## ELEMENT TABLE

> `Owns-subject destination` is the **expected** A3/A4 target — the auditor checks the
> build against this. Where it reads "dedicated panel," a coherent in-context drill
> (DetailPanel or sub-screen) is acceptable; a bare close/back is not. For Phase-2 stubs,
> the expected destination is "honestly-labelled stub" — not a real surface.

### Region 1 — Shell / chrome (OverlayShell)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-CHR-01 | OverlayShell `role="dialog"` wrapper | NAV | NA (container) | UNVERIFIED | a11y — `aria-modal="true"`, `aria-label="Settings"` |
| ST-CHR-02 | Back button (← Back) | ACTION | parent screen (or close detail panel if `detail !== null`) | UNVERIFIED | dual behaviour: inside detail panel → setDetail(null); else → onClose() |
| ST-CHR-03 | Title "Settings" | DATA | NA (display) | UNVERIFIED | A5 |
| ST-CHR-04 | Home pill (⌂ Home, top-right) | NAV | Home screen | UNVERIFIED | rendered only when `onHome` prop passed — verify it's wired by parent |
| ST-CHR-05 | Escape key handler (OverlayShell global) | ACTION | calls onBack | UNVERIFIED | conflicts possible with ST-CHR-06 |
| ST-CHR-06 | Escape key handler (Settings-local, only when detail panel open) | ACTION | setDetail(null) + stopPropagation | UNVERIFIED | dual handlers — verify order; capture=true means local runs first |

### Region 2 — Identity header

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-IDENT-01 | Avatar circle (gradient + initial) | DATA | NA (display) | UNVERIFIED | shows `entity.displayName/name` first char; '?' fallback |
| ST-IDENT-02 | Display name | DATA | NA (display) | UNVERIFIED | `entity.displayName \|\| entity.name` |
| ST-IDENT-03 | Life-stage line "Stage X · Name" | DATA | NA (display) | UNVERIFIED | A5 — "Stage 3" with no plain meaning; `—` fallback when missing — RECONCILE: lifeStage source |

### Region 3 — §S1 Profile & Identity section

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-PROF-01 | Section header "Profile & identity" | DATA | NA | UNVERIFIED | A5 |
| ST-PROF-02 | Row — "My Profile" | ACTION | DetailPanel `profile` (ST-PROF-D*) | UNVERIFIED | value column shows entity name (duplicate of ST-IDENT-02) |
| ST-PROF-03 | Row — "Financial Details" | ACTION | DetailPanel `financial` (ST-FIN-D*) | UNVERIFIED | value column shows static "View" — RECONCILE: not a real status |

### Region 3a — Profile detail panel (`detail === 'profile'`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-PROF-D01 | DetailPanel header "My Profile" + ← Back | NAV | back to root list | UNVERIFIED | local back button inside panel; redundant with OverlayShell back |
| ST-PROF-D02 | InfoRow — Name | DATA | NA (read-only) | UNVERIFIED | `entity.displayName \|\| entity.name \|\| '—'` |
| ST-PROF-D03 | InfoRow — Age | DATA | NA (read-only) | UNVERIFIED | RECONCILE: should compute from DoB or be editable; currently hardcoded read |
| ST-PROF-D04 | InfoRow — Life stage | DATA | NA (read-only) | UNVERIFIED | A5 — "Stage 3 · Accumulation" — needs plain-English explainer |
| ST-PROF-D05 | InfoRow — Jurisdiction | DATA | NA (read-only) | UNVERIFIED | falls back to `'United Kingdom'`; multi-jurisdiction users not handled |
| ST-PROF-D06 | InfoRow — Type | DATA | NA (read-only) | UNVERIFIED | shows `entity.type \|\| 'individual'`; "ifa" leaks here without UI handling |
| ST-PROF-D07 | InfoRow — Entity ID | DATA | NA (read-only) | UNVERIFIED | A5 — internal ID shown to user; macOS principle violation (internal code at top layer) |
| ST-PROF-D08 | Phase-2 explainer footer | DATA | NA | UNVERIFIED | "Profile editing is coming in Phase 2" — A5/FD-ST-2 honesty |

### Region 3b — Financial Details detail panel (`detail === 'financial'`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-FIN-D01 | DetailPanel header "Financial Details" + ← Back | NAV | back to root list | UNVERIFIED | |
| ST-FIN-D02 | InfoRow — Target income | DATA | SOURCE — engine targetIncome | UNVERIFIED | `fmt(entity.targetIncome)`/yr; `—` fallback |
| ST-FIN-D03 | InfoRow — Higher-rate taxpayer | DATA | SOURCE — engine isHigherRateTaxpayer | UNVERIFIED | Yes/No — RECONCILE: derived from income? hardcoded? |
| ST-FIN-D04 | InfoRow — Drawdown | DATA | SOURCE — Cashflow drawdown panel | UNVERIFIED | "Not started" fallback; A3 — should this be a link to Cashflow? per drawdown ownership |
| ST-FIN-D05 | InfoRow — Net worth | DATA | SOURCE — My Money asset breakdown | UNVERIFIED | `fmt(fq.netWorthVal)`; A3 — link to My Money? |
| ST-FIN-D06 | Phase-2 explainer footer | DATA | NA | UNVERIFIED | "Editing is coming in Phase 2 once account linking is live" — A5/FD-ST-2 |

### Region 4 — §S2 Households & Sharing (Phase-2 stub)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-HH-01 | Section header "Households & sharing" | DATA | NA | UNVERIFIED | |
| ST-HH-02 | Row — "Households" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | `phase2={true}`, no onClick — FD-ST-2 compliance check |

### Region 5 — §S3 Connected Services (Phase-2 stub)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-CONN-01 | Section header "Connected services" | DATA | NA | UNVERIFIED | |
| ST-CONN-02 | Row — "Connected accounts" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2 compliance |

### Region 6 — §S4 Privacy & Security (Phase-2 stub)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-SEC-01 | Section header "Privacy & security" | DATA | NA | UNVERIFIED | |
| ST-SEC-02 | Row — "Security" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2 compliance |

### Region 7 — §S5 Feeds & Reports

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-FEED-01 | Section header "Feeds & reports" | DATA | NA | UNVERIFIED | |
| ST-FEED-02 | Row — "IFA Access" | ACTION | DetailPanel `ifa` (ST-IFA-D*) | UNVERIFIED | value shows "IFA account" or "No IFA linked" based on entity.type |
| ST-FEED-03 | Row — "Reports & feeds" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2 compliance |

### Region 7a — IFA Access detail panel (`detail === 'ifa'`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-IFA-D01 | DetailPanel header "IFA Access" + ← Back | NAV | back to root list | UNVERIFIED | |
| ST-IFA-D02 | InfoRow — Account type (IFA branch) | DATA | NA (read-only) | UNVERIFIED | renders only when `entity.type === 'ifa'` |
| ST-IFA-D03 | InfoRow — Firm (IFA branch) | DATA | NA (read-only) | UNVERIFIED | `entity.firmName \|\| '—'` |
| ST-IFA-D04 | InfoRow — Client count (IFA branch) | DATA | NA (read-only) | UNVERIFIED | `entity.clientCount \|\| '—'` |
| ST-IFA-D05 | InfoRow — Linked IFA (non-IFA branch) | DATA | NA (read-only) | UNVERIFIED | shows "None" — A2/A3 — no way to link an IFA from this surface (Phase 2) |
| ST-IFA-D06 | Phase-2 explainer (non-IFA branch) | DATA | NA | UNVERIFIED | "Link an IFA to share your Sonuswealth profile securely. Feature coming in Phase 2." — A5/FD-ST-2 |

### Region 8 — §S6 Notifications (Phase-2 stub)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-NOTIF-01 | Section header "Notifications" | DATA | NA | UNVERIFIED | |
| ST-NOTIF-02 | Row — "Notifications" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2 compliance; FD-ST-1 — notification cadence is a Settings-owned preference, must be exposed (currently stubbed = OK pre-launch) |

### Region 9 — §S7 Personalisation

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-PERS-01 | Section header "Personalisation" | DATA | NA | UNVERIFIED | |
| ST-PERS-02 | Theme row — Badge + label "Theme" | DATA | NA (label) | UNVERIFIED | A5 |
| ST-PERS-03 | Theme pill toggle (Dark/Light) | ACTION | ACTION — flips `theme` prop via `onThemeChange` | UNVERIFIED | RECONCILE: all surfaces — change must propagate via parent state to every surface (`--c-*` tokens in index.css). A11y — buttons lack `aria-pressed` |
| ST-PERS-04 | Hide-balances row — Badge + label "Hide balances" | DATA | NA (label) | UNVERIFIED | A5 |
| ST-PERS-05 | Hide-balances explainer "Replaces £ amounts with ••••" | DATA | NA (sub-label) | UNVERIFIED | A5 |
| ST-PERS-06 | Hide-balances toggle switch | ACTION | ACTION — writes `localStorage` key `sonus.settings.hideBalances`; aria-pressed wired | UNVERIFIED | RECONCILE: all surfaces — every `<Num/>` / `fmt()` consumer must `useEffect` on the same LS key. SEED: persistence is `localStorage` only, no event emission; spec §Q1B.1 X6 wants event-sourced — A6 risk |

### Region 10 — §S-plans Plans (longevity + plan list)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-PLAN-01 | Section header "Plans" | DATA | NA | UNVERIFIED | |
| ST-PLAN-02 | Longevity row — Badge + label "Longevity band" | DATA | NA (label) | UNVERIFIED | A5 |
| ST-PLAN-03 | Longevity sub-label "Plan to age N" | DATA | NA (display) | UNVERIFIED | `LONGEVITY_BANDS.find(...)?.age \|\| 88` — RECONCILE: 88 default vs engine default |
| ST-PLAN-04 | Longevity pill — Conservative (85) | ACTION | DECISION — sets longevity band, writes LS | UNVERIFIED | shows AGE label not band name — A5 risk |
| ST-PLAN-05 | Longevity pill — Median (88) | ACTION | DECISION — sets longevity band, writes LS | UNVERIFIED | RECONCILE: all surfaces — Cashflow/Timeline/Risk projections read this |
| ST-PLAN-06 | Longevity pill — Optimistic (92) | ACTION | DECISION — sets longevity band, writes LS | UNVERIFIED | engine support flagged as "comes in s02a" — SEED: not wired to engine yet |
| ST-PLAN-07 | Plan row — Protection plan (PlanRow component) | ACTION | DECISION — protection plan creation/review | UNVERIFIED | reads `planFor(entity, 'protection')`; chip = Current / Stale / Not started; **no onClick handler on the row** — A2 FAIL likely |
| ST-PLAN-08 | Plan row — Drawdown plan | ACTION | DECISION — drawdown plan creation/review (Cashflow) | UNVERIFIED | same — no onClick |
| ST-PLAN-09 | Plan row — Estate plan | ACTION | DECISION — estate plan creation/review (Tax & Estate) | UNVERIFIED | same — no onClick |
| ST-PLAN-10 | Plan row — Cashflow plan | ACTION | DECISION — cashflow plan creation/review (Cashflow) | UNVERIFIED | same — no onClick |
| ST-PLAN-11 | Plan row status chip (Current/Stale/Not started) | DATA | SOURCE — plan staleness detail | UNVERIFIED | colour-coded via `planStaleness().severity`; A5 — "Stale" with no explainer |
| ST-PLAN-12 | Plan row "Last reviewed: YYYY-MM-DD" | DATA | NA (display) | UNVERIFIED | `plan.lastReviewedAt`; `'—'` fallback; A6 — date format hardcoded ISO not localised |
| ST-PLAN-13 | Plan row glyph (⛨ ⊿ ◇ ≋) | DATA | NA (display) | UNVERIFIED | A5 — non-standard glyphs without label |

### Region 11 — §S8 Data & Documents (Phase-2 stub)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-DATA-01 | Section header "Data & documents" | DATA | NA | UNVERIFIED | |
| ST-DATA-02 | Row — "Document vault" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2 — but there IS a Vault.jsx screen — SEED: vault is reachable elsewhere but stubbed here, inconsistent |
| ST-DATA-03 | Row — "Export & delete" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2; destructive "delete" stubbed = OK pre-launch but flag for Phase 2 — confirmation modal required |

### Region 12 — §S9 Help & Support (Phase-2 stub)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-HELP-01 | Section header "Help & support" | DATA | NA | UNVERIFIED | |
| ST-HELP-02 | Row — "Help & support" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2 compliance |

### Region 13 — §S10 Subscription & Billing (Phase-2 stub)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-SUB-01 | Section header "Subscription & billing" | DATA | NA | UNVERIFIED | |
| ST-SUB-02 | Row — "Subscription & billing" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2 compliance |

### Region 14 — §S11 Regulatory & Compliance (Phase-2 stub)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-REG-01 | Section header "Regulatory & compliance" | DATA | NA | UNVERIFIED | |
| ST-REG-02 | Row — "Compliance & disclaimers" (Phase 2) | STUB | honestly-labelled stub | UNVERIFIED | FD-ST-2; A5 — FCA boundary line lives in Tax Rules / About instead — verify it's reachable somewhere |

### Region 15 — §S12 About & Legal

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-ABOUT-01 | Section header "About & legal" | DATA | NA | UNVERIFIED | |
| ST-ABOUT-02 | Row — "Tax Rules" | ACTION | DetailPanel `taxrules` (ST-TAX-D*) | UNVERIFIED | value shows `rulesVer` (e.g. "2026.1") — A5 plain meaning |
| ST-ABOUT-03 | Row — "About Sonuswealth" | ACTION | DetailPanel `about` (ST-AB-D*) | UNVERIFIED | value shows `v{BRAND.version}` — A6 reconcile to brand.js |

### Region 15a — Tax Rules detail panel (`detail === 'taxrules'`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-TAX-D01 | DetailPanel header "Tax Rules" + ← Back | NAV | back to root list | UNVERIFIED | |
| ST-TAX-D02 | InfoRow — Rules version | DATA | SOURCE — rules bundle | UNVERIFIED | `entity.rulesVersion \|\| BRAND.rulesVersion`; RECONCILE: rules-uk.js / fq-calculator TAX |
| ST-TAX-D03 | InfoRow — Data as of | DATA | SOURCE — data freshness | UNVERIFIED | `entity.dataLastUpdated \|\| BRAND.dataDate` |
| ST-TAX-D04 | InfoRow — Jurisdiction | DATA | SOURCE — jurisdiction context | UNVERIFIED | UK default |
| ST-TAX-D05 | InfoRow — Tax year | DATA | NA (display) | UNVERIFIED | **HARDCODED "2026/27 UK"** — A6 FAIL: should come from rules bundle, not literal |
| ST-TAX-D06 | InfoRow — Applied since | DATA | NA (display) | UNVERIFIED | `BRAND.appliedSince` |
| ST-TAX-D07 | InfoRow — Next rules change | DATA | NA (display) | UNVERIFIED | `BRAND.nextRulesDate` |
| ST-TAX-D08 | Tax Rules explainer footer | DATA | NA | UNVERIFIED | A5 — mentions "Wealth Score" by canonical name; uses `BRAND.nextRulesDate` interpolation |

### Region 15b — About detail panel (`detail === 'about'`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-AB-D01 | DetailPanel header "About Sonuswealth" + ← Back | NAV | back to root list | UNVERIFIED | title interpolates `BRAND.name` — A6 |
| ST-AB-D02 | InfoRow — App | DATA | NA | UNVERIFIED | `BRAND.name` |
| ST-AB-D03 | InfoRow — Version | DATA | NA | UNVERIFIED | `v{BRAND.version}` |
| ST-AB-D04 | InfoRow — Rules bundle | DATA | NA | UNVERIFIED | `BRAND.rulesBundle` — A5: cryptic for non-experts |
| ST-AB-D05 | InfoRow — Applied since | DATA | NA | UNVERIFIED | `BRAND.appliedSince` |
| ST-AB-D06 | InfoRow — Next rules date | DATA | NA | UNVERIFIED | `BRAND.nextRulesDate` |
| ST-AB-D07 | InfoRow — Data last updated | DATA | NA | UNVERIFIED | `dataDate` |
| ST-AB-D08 | InfoRow — Scoring engine | DATA | NA | UNVERIFIED | **HARDCODED "FINIO-1.0"** — A5/A6/FD-NAME-1 FAIL: "FINIO" is the legacy brand string, user-facing |
| ST-AB-D09 | InfoRow — Risk engine | DATA | NA | UNVERIFIED | **HARDCODED "RISK-1.0"** — A5 plain meaning |
| ST-AB-D10 | About disclaimer block | DATA | NA | UNVERIFIED | `BRAND.disclaimer` + appended "Sonuswealth does not provide financial advice…" — A5/FCA |

### Region 16 — Sign Out + footer

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-OUT-01 | Sign Out row (danger=true) | ACTION | ACTION — sign out + return to root | UNVERIFIED | calls `onClose()` then `window.location.href = '/'`; **no auth wired (FP-5)**; **no confirmation modal** — SEED: destructive without confirm |
| ST-FOOT-01 | Footer brand line "Sonuswealth · {rulesLabel(rulesVer, dataDate)}" | DATA | NA | UNVERIFIED | `BRAND.rulesLabel(...)` — A6 |
| ST-FOOT-02 | Footer "Not financial advice" | DATA | NA | UNVERIFIED | A5/FCA — must be present on every state |

### Region 17 — Cross-screen reconciliation hooks (not visual elements, but auditable)

These rows verify Settings's role as **configuration owner** (FD-CROSS-1, FD-ST-1). They have no DOM element but each is an audit obligation.

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-X-01 | Theme propagation | RECONCILE | every surface re-renders with new `--c-*` tokens | UNVERIFIED | RECONCILE: all surfaces — theme prop must flow to App → every screen |
| ST-X-02 | Hide-balances propagation | RECONCILE | every `<Num/>` / `fmt()` consumer reads LS key | UNVERIFIED | RECONCILE: all surfaces — currently LS-only, consumers must `useEffect` on key — A6 risk |
| ST-X-03 | Longevity-band propagation | RECONCILE | Cashflow / Timeline / Risk projection horizons | UNVERIFIED | RECONCILE: all surfaces — engine support pending (s02a) |
| ST-X-04 | Plan staleness propagation | RECONCILE | Home plan-strip + canonical plan surfaces | UNVERIFIED | reads-only here; verify same `planStaleness()` value used on Home |
| ST-X-05 | Currency / locale toggle | RECONCILE | NO control exists | UNVERIFIED | **FD-ST-1 FAIL: no currency or locale control on this surface** — SEED: hidden setting |
| ST-X-06 | Notification cadence | RECONCILE | NO control exists; stubbed | UNVERIFIED | FD-ST-1 — stub is OK pre-launch per FD-ST-2 |
| ST-X-07 | Withdrawal cadence | RECONCILE | NO control exists | UNVERIFIED | **FD-ST-1 FAIL: no withdrawal-cadence control** — SEED: hidden setting (or lives on Cashflow — verify ownership) |
| ST-X-08 | Data-export schedule | RECONCILE | NO control exists; stubbed | UNVERIFIED | FD-ST-1 — stub is OK pre-launch per FD-ST-2 |
| ST-X-09 | Account closure / delete | RECONCILE | stubbed under "Export & delete" | UNVERIFIED | FD-ST-1 — stub is OK pre-launch; Phase 2 must include confirmation modal |
| ST-X-10 | Jurisdiction toggle | RECONCILE | NO control exists; read-only in Profile detail | UNVERIFIED | **FD-ST-1 FAIL: no jurisdiction picker** — SEED: hidden setting (multi-jurisdiction users blocked) |

### Region 18 — Out-of-Settings auth surface (Account.jsx, standalone)

> Account.jsx is **not imported by Settings.jsx**. It is the pre-launch waitlist signup
> reached via Onboarding (App.jsx). Listed here because the orchestrator asked to
> enumerate it. Auditors treat this as a separate surface for A1 reconciliation; cross-
> surface coherence between Settings's Sign Out (ST-OUT-01) and Account.jsx's "Join
> waitlist" is **not** in scope until real auth lands (Phase 2 / FP-5).

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| ST-ACCT-01 | Card container (blurred dashboard preview behind lock) | DATA | NA (display) | UNVERIFIED | A5/FCA — "Your dashboard is ready" affirmation pre-data |
| ST-ACCT-02 | Lock emoji 🔒 + "Your dashboard is ready" | DATA | NA (display) | UNVERIFIED | A5 |
| ST-ACCT-03 | Title "Unlock your FQ" | DATA | NA (display) | UNVERIFIED | **A5/FD-NAME-1 risk: "FQ" is jargon and is the legacy brand abbreviation; spec uses "Wealth Score"** |
| ST-ACCT-04 | Sub-copy "Create your free account to see your personalised Financial Quotient dashboard." | DATA | NA (display) | UNVERIFIED | **A5/FD-NAME-1 FAIL likely: "Financial Quotient" is the legacy long-form of FQ — Sonuswealth canon is "Wealth Score"** |
| ST-ACCT-05 | FQ preview tile — score number | DATA | SOURCE — computed locally, not engine | UNVERIFIED | **HARDCODED FORMULA**: `Math.round(20 + (age/85)*25 + (focus.length/8)*15 + (setup.length/6)*10)` clamped 18-72 — A6 FAIL: does not call `calcFQ()` |
| ST-ACCT-06 | FQ preview tile — "Your estimated FQ" label | DATA | NA (display) | UNVERIFIED | A5/FD-NAME-1 — "FQ" jargon |
| ST-ACCT-07 | FQ preview tile — band/stage/age line | DATA | NA (display) | UNVERIFIED | uses local `fqBand()` and `stageFor()` — A6: duplicates engine logic with different cutoffs |
| ST-ACCT-08 | Google waitlist button (disabled) | STUB | honestly-labelled stub | UNVERIFIED | label "Continue with Google (waitlist)" — CTA-honesty pre-launch (memory) |
| ST-ACCT-09 | Apple waitlist button (disabled) | STUB | honestly-labelled stub | UNVERIFIED | same; aria-label "Apple sign-in coming soon" |
| ST-ACCT-10 | Email input | DATA | NA (form field) | UNVERIFIED | controlled, `autoComplete="email"`, labelled, required |
| ST-ACCT-11 | Password input | DATA | NA (form field) | UNVERIFIED | controlled, `autoComplete="new-password"`, labelled; **placeholder "Pick anything for now" + label "this stays on your device — Phase 2"** — A5 honesty OK but pre-launch security expectation must be flagged |
| ST-ACCT-12 | "Join waitlist" submit button | ACTION | ACTION — calls `onEnter(payload)` | UNVERIFIED | bundles email/password/obData and forwards to App.jsx; CTA-honesty compliant |
| ST-ACCT-13 | Footer pre-launch note | DATA | NA | UNVERIFIED | "Pre-launch waitlist — nothing is stored remotely yet. By continuing you agree to Sonuswealth's Terms of Service." — A5; "Terms of Service" link is implied but **no link** — SEED: dead reference |

---

## SEED FINDINGS (pre-identified — agents start with these, then extend)

These are *already known* from reading the component. They are not the list — they are the
proof the method works. Agents must confirm each, assign severity, and find the rest.

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| S-01 | ST-AB-D08 | Scoring engine row hardcoded as "FINIO-1.0" — user-facing legacy brand string, violates FD-NAME-1 | DEMO-BLOCKING |
| S-02 | ST-ACCT-03 / ST-ACCT-04 / ST-ACCT-06 | Account.jsx surfaces "FQ" / "Financial Quotient" — legacy nomenclature, canonical is "Wealth Score" per FD-NAME-1 | DEMO-BLOCKING |
| S-03 | ST-ACCT-05 / ST-ACCT-07 | Account.jsx computes its own FQ via hardcoded formula + duplicate `fqBand()` instead of calling engine `calcFQ()` / `fqBand()` — A6 reconciliation fail, two scores possible | FUNCTIONAL |
| S-04 | ST-PLAN-07 / ST-PLAN-08 / ST-PLAN-09 / ST-PLAN-10 | Plan rows display chip + last-reviewed date but `PlanRow` has **no onClick** — chip claims "Current/Stale" but tapping the row does nothing (A2 FAIL); founder rule §9 says interactive-looking-but-dead = FAIL | DEMO-BLOCKING |
| S-05 | ST-OUT-01 | Sign Out is a destructive action with no confirmation modal and no real auth wired ("FP-5" per comment) — fires `window.location.href = '/'` blind | FUNCTIONAL |
| S-06 | ST-PERS-06 / ST-PERS-03 | Hide-balances and theme persist via `localStorage` only — no event emission to `EventsProvider`; spec §S7.5 expects `SETTINGS_TEMPORAL_PREFS_CHANGED`; cross-tab reads require every consumer to `useEffect` on the same key — A6 propagation risk | FUNCTIONAL |
| S-07 | ST-X-05 / ST-X-07 / ST-X-10 | Hidden settings: no currency toggle, no withdrawal cadence, no jurisdiction picker — FD-ST-1 says these MUST be exposed on this surface (or honestly stubbed). Currently neither | FUNCTIONAL |
| S-08 | ST-TAX-D05 | Tax year shown as hardcoded literal "2026/27 UK" instead of reading from rules bundle — drifts when rules update | FUNCTIONAL |
| S-09 | ST-PROF-D07 | "Entity ID" surfaced in profile detail — internal identifier shown to end user (macOS principle violation: internal codes never at top layer) | POLISH |
| S-10 | ST-PERS-03 | Theme toggle buttons lack `aria-pressed` on each option (parent wrapper has it for hide-balances toggle but not theme); inconsistent a11y | POLISH |
| S-11 | ST-DATA-02 | "Document vault" stubbed as Phase 2 but `Vault.jsx` screen exists elsewhere — inconsistent: real screen reachable from other surfaces but presented here as not-yet-built | FUNCTIONAL |
| S-12 | ST-ACCT-13 | Account.jsx footer references "Sonuswealth's Terms of Service" as if linked, but no `<a>` tag — dead reference | POLISH |
| S-13 | ST-PLAN-04 / ST-PLAN-05 / ST-PLAN-06 | Longevity pills show ages (85/88/92) as button labels — band names (Conservative/Median/Optimistic) only appear in the sub-label, not on the buttons — A5 plain meaning | POLISH |
| S-14 | ST-CHR-05 / ST-CHR-06 | Two Escape-key handlers compete (OverlayShell global + Settings-local); only the local one runs `stopPropagation` and only when detail panel open — handler-order regression risk | POLISH |
| S-15 | ST-IDENT-03 / ST-PROF-D04 | "Stage 3" lifeStage shown numeric without plain-English meaning at root; detail panel shows "Stage 3 · Accumulation" but root still cryptic — A5 | POLISH |
| S-16 | ST-PLAN-12 | Plan last-reviewed date hardcoded as ISO `YYYY-MM-DD` slice — not localised, not relative ("3 months ago"), not in line with macOS-pattern simple surface | POLISH |
| S-17 | ST-FIN-D04 / ST-FIN-D05 | Financial Details panel shows Drawdown and Net Worth as read-only with no link to canonical surface (Cashflow / My Money) — A3/A4: a number with no drill to source | FUNCTIONAL |

---

## COVERAGE MATH (this replaces "99% confident")

Total inventory rows (count at audit time; v1 = 99 rows including sub-rows and Region 17 reconciliation hooks + Region 18 Account.jsx).

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100% (every row has a verdict).
The audit **terminates** per the runbook stopping rule — not at a round number.
"99% confident" is only a legitimate claim when Coverage = 100% and it is restated as:
*"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

---

*— end settings-screen-element-inventory-v1.md —*
