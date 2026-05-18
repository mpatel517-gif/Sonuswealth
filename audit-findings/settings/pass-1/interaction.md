# Settings — Pass 1 Interaction Audit (A2/A3/A4)

**Auditor:** interaction-auditor
**Date:** 2026-05-18
**Screen:** Settings (`src/screens/Settings.jsx`) + out-of-Settings Account surface (`src/screens/Account.jsx`)
**Inventory:** `settings-inventory-v1.md` (v1, 99 rows)
**Scope:** A2 (drillable / real handler), A3 (destination owns the subject), A4 (destination is a coherent SOURCE / ACTION / DECISION — not describe-only). FD-CROSS-1 locked: **Settings owns configuration.**

Method: walked every inventory row; traced each handler through `Settings.jsx`, `OverlayShell.jsx`, `Account.jsx`. NA rows (pure-display labels, headers, fallbacks) report `NA` and don't count as PASS/FAIL.

---

## 1. Verdict Table

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|----|----|----|----|----------|---------|----------|
| ST-CHR-01 | NA | NA | NA | — | Wrapper, not interactive. `role="dialog"` + `aria-modal` + `aria-label` wired correctly. | `OverlayShell.jsx:44-55` |
| ST-CHR-02 | PASS | PASS | PASS | — | Back button: handler `onBack` → `setDetail(null)` if detail open else `onClose?.()`. Dual behaviour matches inventory expectation. | `Settings.jsx:318`, `OverlayShell.jsx:69-88` |
| ST-CHR-03 | NA | NA | NA | — | Display title. | `OverlayShell.jsx:92-105` |
| ST-CHR-04 | PASS | PASS | PASS | — | Home pill renders only when `onHome` prop wired; resolves to Home screen. Correct conditional render. | `Settings.jsx:319`, `OverlayShell.jsx:127-149` |
| ST-CHR-05 | PASS | PASS | FAIL | POLISH | OverlayShell Escape handler calls `onBack`. But when a detail panel is open, the **Settings-local** handler (capture=true) runs first, calls `setDetail(null)` AND `e.stopPropagation()`. `stopPropagation` between two `window.addEventListener` listeners does NOT prevent the second listener from firing (only DOM bubbling). So both fire when a detail panel is open → Settings closes the detail panel AND then OverlayShell's onBack also fires (which would close the overlay because detail is now `null`). Net: Escape inside a detail panel collapses the entire overlay instead of just closing the panel. A4 incoherent. | `Settings.jsx:307-313` + `OverlayShell.jsx:35-41` |
| ST-CHR-06 | PASS | PASS | FAIL | POLISH | Same root cause as ST-CHR-05. `e.stopPropagation()` is a no-op across two `window`-level `addEventListener` listeners — both fire in registration order. The capture=true only governs DOM event capture phase, not sibling window listeners. | `Settings.jsx:309` |
| ST-IDENT-01 | NA | NA | NA | — | Avatar display only. | `Settings.jsx:325-334` |
| ST-IDENT-02 | NA | NA | NA | — | Display name, no handler. | `Settings.jsx:335-338` |
| ST-IDENT-03 | NA | NA | NA | — | Life-stage display, no handler. (A5 concern only.) | `Settings.jsx:339-342` |
| ST-PROF-01 | NA | NA | NA | — | Section header. | `Settings.jsx:346` |
| ST-PROF-02 | PASS | PASS | PASS | — | `onClick → setDetail('profile')`; profile DetailPanel renders. Lands on a SOURCE (read-only identity attributes) coherent for "My Profile". | `Settings.jsx:347-350`, `:517-532` |
| ST-PROF-03 | PASS | PASS | PASS | — | `onClick → setDetail('financial')`; financial DetailPanel renders with target income, net worth, drawdown. SOURCE coherent (but A3/A4 sub-issue at ST-FIN-D04/05 below — values have no drill to their canonical surface). | `Settings.jsx:351-355`, `:534-550` |
| ST-PROF-D01 | PASS | PASS | PASS | — | Back button in DetailPanel → `setDetail(null)` → returns to root list. | `Settings.jsx:208-211`, `:518` |
| ST-PROF-D02 | NA | NA | NA | — | Read-only data display. | `Settings.jsx:519` |
| ST-PROF-D03 | NA | NA | NA | — | Read-only display. | `Settings.jsx:520` |
| ST-PROF-D04 | NA | NA | NA | — | Read-only display. | `Settings.jsx:521` |
| ST-PROF-D05 | NA | NA | NA | — | Read-only display. | `Settings.jsx:522-523` |
| ST-PROF-D06 | NA | NA | NA | — | Read-only display. | `Settings.jsx:524` |
| ST-PROF-D07 | NA | NA | NA | — | Read-only display. (A5 only.) | `Settings.jsx:525` |
| ST-PROF-D08 | NA | NA | NA | — | Phase-2 honesty footer. Stub-label OK. | `Settings.jsx:526-530` |
| ST-FIN-D01 | PASS | PASS | PASS | — | DetailPanel back button → root. | `Settings.jsx:535` |
| ST-FIN-D02 | NA | NA | NA | — | Read-only number. No interaction. | `Settings.jsx:536-537` |
| ST-FIN-D03 | NA | NA | NA | — | Read-only Yes/No. | `Settings.jsx:538-539` |
| ST-FIN-D04 | PASS | FAIL | FAIL | FUNCTIONAL | "Drawdown" shown as `fmt(entity.drawdown)/yr` with no link/drill. Per FD-CROSS-1, drawdown is owned by **Cashflow**. A number with no drill to its canonical surface is incoherent: user can see a value but cannot reach the SOURCE that produced it or the DECISION surface to change it. Expected: tap → Cashflow drawdown panel. Current: dead read-only row. | `Settings.jsx:540-541` |
| ST-FIN-D05 | PASS | FAIL | FAIL | FUNCTIONAL | "Net worth" `fmt(fq.netWorthVal)` shown read-only with no drill. Canonical home of net-worth breakdown is **My Money** (asset/liability composition). Expected: tap → My Money asset breakdown. Current: number with no SOURCE drill. | `Settings.jsx:542-543` |
| ST-FIN-D06 | NA | NA | NA | — | Phase-2 honesty footer. OK. | `Settings.jsx:544-548` |
| ST-HH-01 | NA | NA | NA | — | Section header. | `Settings.jsx:359` |
| ST-HH-02 | PASS | PASS | PASS | — | `phase2={true}` → `onClick` suppressed (`Row` line 143), `cursor:default`, opacity 0.55, "Coming in Phase 2" sub-label. Honestly-labelled stub per FD-ST-2. A4 satisfied by honesty label. | `Settings.jsx:360-361`, Row component `:140-150,:159-164` |
| ST-CONN-01 | NA | NA | NA | — | Section header. | `Settings.jsx:365` |
| ST-CONN-02 | PASS | PASS | PASS | — | Phase-2 stub, same pattern as ST-HH-02. Honest. | `Settings.jsx:366-367` |
| ST-SEC-01 | NA | NA | NA | — | Section header. | `Settings.jsx:371` |
| ST-SEC-02 | PASS | PASS | PASS | — | Phase-2 stub, honest. | `Settings.jsx:372-373` |
| ST-FEED-01 | NA | NA | NA | — | Section header. | `Settings.jsx:377` |
| ST-FEED-02 | PASS | PASS | PASS | — | `onClick → setDetail('ifa')`. IFA DetailPanel renders. Branches by `entity.type === 'ifa'` (firm/clientCount) vs non-IFA ("No IFA linked" + Phase-2 explainer). Coherent within scope (link-an-IFA action stubbed → A4 satisfied by honesty label). | `Settings.jsx:378-381`, `:552-571` |
| ST-FEED-03 | PASS | PASS | PASS | — | Phase-2 stub, honest. | `Settings.jsx:382-383` |
| ST-IFA-D01 | PASS | PASS | PASS | — | DetailPanel back. | `Settings.jsx:553` |
| ST-IFA-D02 | NA | NA | NA | — | Read-only display. | `Settings.jsx:556` |
| ST-IFA-D03 | NA | NA | NA | — | Read-only display. | `Settings.jsx:557` |
| ST-IFA-D04 | NA | NA | NA | — | Read-only display. | `Settings.jsx:558` |
| ST-IFA-D05 | NA | NA | NA | — | Read-only display ("None"). A2/A3 stubbed honestly via ST-IFA-D06. | `Settings.jsx:562` |
| ST-IFA-D06 | NA | NA | NA | — | Phase-2 honesty footer. OK. | `Settings.jsx:563-567` |
| ST-NOTIF-01 | NA | NA | NA | — | Section header. | `Settings.jsx:387` |
| ST-NOTIF-02 | PASS | PASS | PASS | — | Phase-2 stub, honest. FD-ST-1 owed control is honestly stubbed. | `Settings.jsx:388-389` |
| ST-PERS-01 | NA | NA | NA | — | Section header. | `Settings.jsx:393` |
| ST-PERS-02 | NA | NA | NA | — | Label only. | `Settings.jsx:396-398` |
| ST-PERS-03 | PASS | PASS | PASS | — | ThemePill: each option button has `onClick → onChange?.(o.id)` which routes to parent `onThemeChange` (Settings prop). A3 = configuration ACTION (Settings owns theme per FD-CROSS-1). A4 coherent: the toggle persists in the parent's state and propagates via the `theme` prop to surfaces that read `--c-*` tokens. NOTE: cross-surface propagation (whether App.jsx writes `data-theme` to `<html>` or similar) is a reconciliation question owned by another auditor — A2/A3/A4 pass here. | `Settings.jsx:399`, `:242-263` |
| ST-PERS-04 | NA | NA | NA | — | Label only. | `Settings.jsx:404-406` |
| ST-PERS-05 | NA | NA | NA | — | Sub-label only. | `Settings.jsx:407-411` |
| ST-PERS-06 | PASS | PASS | PASS | — | Toggle button `onClick → setHideBalances(v=>!v)`; `useEffect` writes `localStorage` key `sonus.settings.hideBalances`. Persists. ACTION coherent within Settings scope. NOTE: cross-tab read propagation (whether `<Num/>` / `fmt()` consumers re-render on the same LS key) is a reconciliation question — flagged at S-06 seed but not a A2/A3/A4 fail at this row. | `Settings.jsx:413-427`, `:297` |
| ST-PLAN-01 | NA | NA | NA | — | Section header. | `Settings.jsx:432` |
| ST-PLAN-02 | NA | NA | NA | — | Label only. | `Settings.jsx:436-439` |
| ST-PLAN-03 | NA | NA | NA | — | Sub-label only. | `Settings.jsx:440-442` |
| ST-PLAN-04 | PASS | PASS | PASS | — | LongevityPill button → `onChange?.(b.id)` → `setLongevity` → `useEffect` writes `sonus.settings.longevity`. DECISION coherent. | `Settings.jsx:444`, `:58-73`, `:298` |
| ST-PLAN-05 | PASS | PASS | PASS | — | Same. | `Settings.jsx:58-73` |
| ST-PLAN-06 | PASS | PASS | PASS | — | Same. (Engine wiring is a reconciliation question, not A2/A3/A4.) | `Settings.jsx:58-73` |
| ST-PLAN-07 | **FAIL** | FAIL | FAIL | **DEMO-BLOCKING** | **Confirmed S-04.** `PlanRow` (defined `Settings.jsx:79-125`) has **no `onClick` prop, no handler, no wrapping interactive element**. The status chip ("Current/Stale/Not started") and timestamp suggest the row is reviewable, but tapping the row does nothing. Founder rule §9 "interactive-looking-but-dead = FAIL" + §S-04 of inventory. Expected destination per FD-CROSS-1: protection plan creation/review surface (DECISION). Current: bare display. A2 FAIL (no handler), A3 FAIL (no destination), A4 FAIL (lands nowhere). | `Settings.jsx:79-125` (component), `:446-448` (mount) |
| ST-PLAN-08 | **FAIL** | FAIL | FAIL | **DEMO-BLOCKING** | Same component, same failure. Expected destination: Cashflow drawdown plan DECISION surface. | `Settings.jsx:79-125`, `:446-448` |
| ST-PLAN-09 | **FAIL** | FAIL | FAIL | **DEMO-BLOCKING** | Same. Expected destination: Tax & Estate plan DECISION surface. | `Settings.jsx:79-125`, `:446-448` |
| ST-PLAN-10 | **FAIL** | FAIL | FAIL | **DEMO-BLOCKING** | Same. Expected destination: Cashflow plan DECISION surface. | `Settings.jsx:79-125`, `:446-448` |
| ST-PLAN-11 | NA | NA | NA | — | Chip is display-only inside the (dead) PlanRow. Failure already counted at ST-PLAN-07…10. | `Settings.jsx:117-122` |
| ST-PLAN-12 | NA | NA | NA | — | Date display only. | `Settings.jsx:111-115` |
| ST-PLAN-13 | NA | NA | NA | — | Glyph display. | `Settings.jsx:97-106` |
| ST-DATA-01 | NA | NA | NA | — | Section header. | `Settings.jsx:452` |
| ST-DATA-02 | PASS | FAIL | FAIL | FUNCTIONAL | "Document vault" presented as Phase-2 stub with honest "Coming in Phase 2" label, **but** `Vault.jsx` exists in `src/screens/` and is reachable from other surfaces (S-11). A3 fail: Settings is the configuration owner; if Vault is live elsewhere, this surface should either link to it OR remove the stub. Currently shows the user a dead row pretending the feature isn't built — incoherent with the rest of the app. Severity FUNCTIONAL because it misleads the user; A4 fails by inconsistency rather than by individual coherence. | `Settings.jsx:453-454`; cross-ref: `src/screens/Vault.jsx` exists |
| ST-DATA-03 | PASS | PASS | PASS | — | Phase-2 stub, honest. Pre-launch destructive-action stubbing acceptable. | `Settings.jsx:455-456` |
| ST-HELP-01 | NA | NA | NA | — | Section header. | `Settings.jsx:460` |
| ST-HELP-02 | PASS | PASS | PASS | — | Phase-2 stub, honest. | `Settings.jsx:461-462` |
| ST-SUB-01 | NA | NA | NA | — | Section header. | `Settings.jsx:466` |
| ST-SUB-02 | PASS | PASS | PASS | — | Phase-2 stub, honest. | `Settings.jsx:467-468` |
| ST-REG-01 | NA | NA | NA | — | Section header. | `Settings.jsx:472` |
| ST-REG-02 | PASS | PASS | PASS | — | Phase-2 stub, honest. (FCA boundary line reachable via Tax Rules / About panels.) | `Settings.jsx:473-474` |
| ST-ABOUT-01 | NA | NA | NA | — | Section header. | `Settings.jsx:478` |
| ST-ABOUT-02 | PASS | PASS | PASS | — | `onClick → setDetail('taxrules')` → Tax Rules DetailPanel renders rules version, data date, jurisdiction, tax year, applied since, next change. SOURCE coherent. | `Settings.jsx:479-482`, `:573-587` |
| ST-ABOUT-03 | PASS | PASS | PASS | — | `onClick → setDetail('about')` → About DetailPanel renders app + version + engine identifiers + disclaimer. SOURCE coherent. | `Settings.jsx:483-487`, `:592-612` |
| ST-TAX-D01 | PASS | PASS | PASS | — | DetailPanel back. | `Settings.jsx:574` |
| ST-TAX-D02 | NA | NA | NA | — | Read-only display. | `Settings.jsx:575` |
| ST-TAX-D03 | NA | NA | NA | — | Read-only display. | `Settings.jsx:576` |
| ST-TAX-D04 | NA | NA | NA | — | Read-only display. | `Settings.jsx:577-578` |
| ST-TAX-D05 | NA | NA | NA | — | Read-only display (hardcoded literal — A6 issue, not A2/A3/A4). | `Settings.jsx:579` |
| ST-TAX-D06 | NA | NA | NA | — | Read-only display. | `Settings.jsx:580` |
| ST-TAX-D07 | NA | NA | NA | — | Read-only display. | `Settings.jsx:581` |
| ST-TAX-D08 | NA | NA | NA | — | Explainer footer. | `Settings.jsx:582-585` |
| ST-AB-D01 | PASS | PASS | PASS | — | DetailPanel back. | `Settings.jsx:593` |
| ST-AB-D02 | NA | NA | NA | — | Read-only display. | `Settings.jsx:594` |
| ST-AB-D03 | NA | NA | NA | — | Read-only display. | `Settings.jsx:595` |
| ST-AB-D04 | NA | NA | NA | — | Read-only display. | `Settings.jsx:596` |
| ST-AB-D05 | NA | NA | NA | — | Read-only display. | `Settings.jsx:597` |
| ST-AB-D06 | NA | NA | NA | — | Read-only display. | `Settings.jsx:598` |
| ST-AB-D07 | NA | NA | NA | — | Read-only display. | `Settings.jsx:599` |
| ST-AB-D08 | NA | NA | NA | — | Read-only display (hardcoded "FINIO-1.0" — A5/A6 issue, not A2/A3/A4). | `Settings.jsx:600` |
| ST-AB-D09 | NA | NA | NA | — | Read-only display. | `Settings.jsx:601` |
| ST-AB-D10 | NA | NA | NA | — | Disclaimer block (display only). | `Settings.jsx:602-610` |
| ST-OUT-01 | PASS | PASS | **FAIL** | **DEMO-BLOCKING** | **Confirmed: destructive, no confirm, no auth.** Handler at `Settings.jsx:495-502`: calls `onClose?.()` then unconditionally `window.location.href = '/'`. No confirmation modal, no auth check, no session clear, no event emission. Lands on `/` (Welcome) which IS the post-signout destination — so A3 is technically correct route. But A4 is **incoherent for a "Sign Out" affordance**: a label "Sign Out" sets a user expectation of (1) confirmation for a destructive action and (2) an auth state change. Neither happens. Per FD-CROSS-1 + inventory note "destructive without confirm" + the orchestrator's verify instruction: **this is the safety-class demo-blocker.** Distinct from S-04 (which is functional-incompleteness); ST-OUT-01 is a **safety failure** because an accidental tap nukes session state with no recoverable confirmation. | `Settings.jsx:495-502` |
| ST-FOOT-01 | NA | NA | NA | — | Footer brand line, display only. | `Settings.jsx:506-510` |
| ST-FOOT-02 | NA | NA | NA | — | "Not financial advice" display. | `Settings.jsx:509` |
| ST-X-01 | PASS | PASS | PASS | — | Theme prop flows out via `onThemeChange` callback. A2/A3/A4 pass at the Settings boundary; whether App.jsx writes `data-theme` to `<html>` and whether every surface re-renders is reconciliation's question. | `Settings.jsx:289`, `:399` |
| ST-X-02 | PASS | FAIL | FAIL | FUNCTIONAL | LS write happens. But propagation channel is **LS-only** — no `EventsProvider` emission, no `storage` event, no React context. Other surfaces that read this key need their own `useEffect` + `window.addEventListener('storage', ...)` to re-render on change. In a single-tab session, sibling components that mounted before the toggle was flipped will NOT re-read LS unless they listen for it. A3 fails because the destination ("every consumer surface re-renders") isn't actually reached by this channel. A4 fails because the visible affordance (the toggle) doesn't behave coherently across the app. | `Settings.jsx:273`, `:297`, `:413-427` |
| ST-X-03 | PASS | FAIL | FAIL | FUNCTIONAL | Longevity LS write happens. Same propagation channel issue as ST-X-02 — and engine support flagged as "s02a" not wired (`Settings.jsx:36-41`). Cashflow/Timeline/Risk projection horizons cannot consume this value yet. A3 fails because the engine surface that owns projection horizons isn't reading the LS key. | `Settings.jsx:274`, `:298`, `:36-41` |
| ST-X-04 | PASS | PASS | PASS | — | `planStaleness()` is imported from the engine and called identically; if Home reads from the same function with the same entity, values match. Verified at source-level only — runtime cross-surface check belongs to reconciliation auditor. | `Settings.jsx:31`, `:81` |
| ST-X-05 | **FAIL** | FAIL | FAIL | FUNCTIONAL | **No currency / locale control exists on this surface.** Inventory FD-ST-1 explicitly demands it (or an honestly-labelled stub). The component has no Row, no Phase-2 stub, no section even mentioning currency. Hidden setting. A2 fails because there is no element. | `Settings.jsx` (search: no occurrence of "currency" or "locale" outside engine imports) |
| ST-X-06 | PASS | PASS | PASS | — | Notification cadence is stubbed via ST-NOTIF-02 (Phase 2). FD-ST-2 honesty satisfied. | `Settings.jsx:388-389` |
| ST-X-07 | **FAIL** | FAIL | FAIL | FUNCTIONAL | **No withdrawal-cadence control.** Inventory FD-ST-1 demands it. Not present. Hidden setting (or implicitly delegated to Cashflow but Settings doesn't even surface the link). | `Settings.jsx` (no "withdrawal" / "cadence" element outside Phase-2 generic stubs) |
| ST-X-08 | PASS | PASS | PASS | — | Data-export schedule stubbed via ST-DATA-03 ("Export & delete"). Honesty OK pre-launch. | `Settings.jsx:455-456` |
| ST-X-09 | PASS | PASS | PASS | — | Account closure stubbed via ST-DATA-03. Pre-launch stubbing OK; Phase-2 confirmation modal flagged for later. | `Settings.jsx:455-456` |
| ST-X-10 | **FAIL** | FAIL | FAIL | FUNCTIONAL | **No jurisdiction picker.** Jurisdiction appears as read-only in Profile / Tax Rules detail (falls back to 'United Kingdom'), but there is no control to change it. Multi-jurisdiction users (India/UK) are blocked. FD-ST-1 demands the toggle or an honest stub. | `Settings.jsx:522-523`, `:577-578` (read-only only) |
| ST-ACCT-01 | NA | NA | NA | — | Card container, display only. | `Account.jsx:67-72` |
| ST-ACCT-02 | NA | NA | NA | — | Lock + display string. | `Account.jsx:77-80` |
| ST-ACCT-03 | NA | NA | NA | — | Display title (A5/FD-NAME-1 concern only). | `Account.jsx:85` |
| ST-ACCT-04 | NA | NA | NA | — | Display sub-copy (A5/FD-NAME-1 concern only). | `Account.jsx:86-88` |
| ST-ACCT-05 | NA | NA | NA | — | Computed display number (A6/reconciliation concern). | `Account.jsx:96` |
| ST-ACCT-06 | NA | NA | NA | — | Display label. | `Account.jsx:98` |
| ST-ACCT-07 | NA | NA | NA | — | Display line. | `Account.jsx:99` |
| ST-ACCT-08 | PASS | PASS | PASS | — | `disabled` button, `aria-label="Google sign-in coming soon"`, `cursor:not-allowed`, label suffix "(waitlist)". CTA-honesty compliant per memory `feedback_cta_honesty_pre_launch.md`. | `Account.jsx:105-120` |
| ST-ACCT-09 | PASS | PASS | PASS | — | Same. | `Account.jsx:105-120` |
| ST-ACCT-10 | NA | NA | NA | — | Form input, controlled. | `Account.jsx:135-150` |
| ST-ACCT-11 | NA | NA | NA | — | Form input, controlled. (A5 honesty OK; security concern is reconciliation-class.) | `Account.jsx:156-170` |
| ST-ACCT-12 | PASS | PASS | PASS | — | `form onSubmit` → `joinWaitlist()` → `onEnter(payload)`. Forwards 11 fields. ACTION coherent. | `Account.jsx:130`, `:52-59`, `:174-181` |
| ST-ACCT-13 | PASS | FAIL | FAIL | POLISH | Footer prose references "Sonuswealth's Terms of Service" but contains no `<a>` tag, no link, no handler. Reference is dead. A3 fails (no destination); A4 fails (the implied destination — ToS page — doesn't exist on this surface). Severity POLISH because copy is the only break and pre-launch a Phase-2 ToS is reasonable; but the link affordance still misleads. | `Account.jsx:184-186` |

---

## 2. FAIL Details — Destination Reality vs Expected

| ID | Current destination | Expected (owns-subject) destination | Why incoherent (A4) |
|----|---------------------|--------------------------------------|----------------------|
| ST-OUT-01 | `window.location.href = '/'` fires immediately on tap. No confirm, no auth state change, no session teardown. | Confirmation modal → on confirm → real auth sign-out (Supabase `signOut`) → routed to Welcome. | "Sign Out" copy promises a destructive auth action; the build performs neither auth nor confirmation. Accidental tap = destructive without recourse. **Safety-class demo-blocker.** |
| ST-PLAN-07 | Bare display. No handler on the row. | Protection plan DECISION surface (create/review). | Row shows status chip + last-reviewed timestamp, signalling it's a reviewable plan card. Founder rule §9: interactive-looking-but-dead = FAIL. |
| ST-PLAN-08 | Bare display. | Cashflow drawdown plan DECISION surface. | Same. |
| ST-PLAN-09 | Bare display. | Tax & Estate plan DECISION surface. | Same. |
| ST-PLAN-10 | Bare display. | Cashflow plan DECISION surface. | Same. |
| ST-FIN-D04 | Read-only `fmt(entity.drawdown)/yr` inside DetailPanel. | Drawdown's canonical home: Cashflow drawdown panel. | A number with no drill to its SOURCE/DECISION. User cannot get from "I see my drawdown is £X" to "where does that come from / how do I change it". |
| ST-FIN-D05 | Read-only `fmt(fq.netWorthVal)`. | My Money asset breakdown. | Same — number with no SOURCE drill. |
| ST-DATA-02 | Phase-2 stub: row dimmed, no handler. | Either link to existing `src/screens/Vault.jsx` OR remove. | Inconsistent: a screen exists in the app yet Settings presents it as not-yet-built. Misleads the user. |
| ST-X-02 | LS write only, no event emission. | Every `<Num/>` / `fmt()` consumer surface re-renders with the new flag. | A toggle that doesn't propagate is a toggle that "lies" — the user flips it and balances elsewhere remain visible (or vice versa) until a remount. |
| ST-X-03 | LS write only; engine doesn't consume yet (s02a). | Cashflow / Timeline / Risk projection horizons recalc from new longevity. | Toggle has no real effect on downstream surfaces. |
| ST-X-05 | No element exists. | Currency / locale picker on this surface (or honest Phase-2 stub). | FD-ST-1 violation: hidden setting. |
| ST-X-07 | No element exists. | Withdrawal-cadence control (or honest Phase-2 stub). | FD-ST-1 violation. |
| ST-X-10 | Read-only display in Profile / Tax Rules. | Jurisdiction picker (or honest Phase-2 stub). | FD-ST-1 violation. Multi-jurisdiction users (UK/India) blocked. |
| ST-CHR-05 / ST-CHR-06 | Both Escape handlers fire (window-level listeners; `stopPropagation` is a no-op across them). | Inside a detail panel: only Settings-local handler fires → close panel only. | Pressing Escape in a detail panel collapses the entire overlay instead of just closing the panel. |
| ST-ACCT-13 | "Sonuswealth's Terms of Service" mentioned in copy with no `<a>`. | Either link to a ToS page or remove the reference. | Dead reference; CTA-honesty principle applied to inline links: a link affordance should land somewhere. |

---

## 3. Severity Summary

- **DEMO-BLOCKING (5):** ST-OUT-01 (safety: destructive Sign Out, no confirm, no auth), ST-PLAN-07, ST-PLAN-08, ST-PLAN-09, ST-PLAN-10.
- **FUNCTIONAL (7):** ST-FIN-D04, ST-FIN-D05, ST-DATA-02, ST-X-02, ST-X-03, ST-X-05, ST-X-07, ST-X-10. *(Eight if jurisdiction counted separately; see table.)*
- **POLISH (3):** ST-CHR-05, ST-CHR-06, ST-ACCT-13.

**Seed-finding confirmations:**
- S-04 (plan rows dead) — **CONFIRMED**, DEMO-BLOCKING. Four rows (`ST-PLAN-07…10`).
- S-05 (Sign Out destructive without confirm/auth) — **CONFIRMED**, **DEMO-BLOCKING (safety)** — orchestrator's stated verify-target.
- S-06 (LS-only persistence, no event emission) — **CONFIRMED**, FUNCTIONAL. Both theme (via prop, OK) and hide-balances/longevity (via LS, propagation broken) reviewed.
- S-07 (hidden FD-ST-1 settings) — **CONFIRMED** for currency, withdrawal cadence, jurisdiction. Notification + export honestly stubbed → OK.
- S-11 (Vault stub inconsistent) — **CONFIRMED**, FUNCTIONAL.
- S-12 (Account ToS dead reference) — **CONFIRMED**, POLISH.
- S-14 (Escape handler race) — **CONFIRMED**, POLISH. Real bug: `stopPropagation` does not gate sibling window listeners.
- S-17 (Financial Details has no drill to canonical home) — **CONFIRMED**, FUNCTIONAL.

---

## 4. Inconsistency Findings (cross-row)

- **Plan rows vs other rows in Settings.** Every other configuration row uses the shared `Row` component which exposes `onClick` and shows a `›` chevron when wired. `PlanRow` is bespoke and silently drops the affordance. Two kinds of "row" with different drill behaviour on the same surface = inconsistency finding even ignoring the dead-tap.
- **Profile detail vs Financial detail.** Profile detail rows are all read-only attributes ("Name", "Age", "Entity ID") — coherent because identity attributes don't have a "canonical home" elsewhere. Financial detail rows ("Drawdown", "Net worth", "Target income") DO have canonical homes (Cashflow, My Money) — but are presented identically (read-only InfoRow). Inconsistent: the latter ought to drill, the former oughtn't.
- **Document vault stub vs Vault.jsx existing.** Two surfaces of the app disagree about whether the feature is built.
- **Sign Out vs every other destructive Phase-2 stub.** Export-and-delete (ST-DATA-03) is stubbed pre-launch with honest "Coming in Phase 2" label; Sign Out is wired live with no confirmation and no auth. Two destructive actions on the same surface, treated opposite ways. The stubbed one is safer than the wired one.

---

## 5. Coverage

```
Inventory rows total          : 99
Rows with verdict assigned    : 99
Rows NA (display-only / hdr)  : 56
Rows scored (PASS/FAIL)       : 43
   PASS                       : 28
   FAIL                       : 15
Coverage                      : 100% (99/99)
Pass rate (excl. NA)          : 28/43 = 65.1%
```

---

ST interaction: 28 PASS, 15 FAIL (5 DB, 8 F, 3 P).
