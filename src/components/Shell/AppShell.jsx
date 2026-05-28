/**
 * src/components/Shell/AppShell.jsx
 *
 * S2 shell chrome (Phase 5 scaffold, 2026-05-28)
 *
 * STATUS: SCAFFOLD — not yet wired into App.jsx. Migration of 7 screens
 * is deferred to a focused session (see DEFERRED-S2-APPSHELL-2026-05-28.md
 * for plan). This file defines the API contract and slot layout so the
 * migration can land in one atomic commit later, with predictable visual
 * outcomes.
 *
 * Why scaffold instead of inline migration:
 *   - Each of the 7 screens currently inlines its own chrome with subtle
 *     differences (Risk inverts primary anchor, Cashflow has its own mode
 *     strip, Tax has a tax-year filter no other screen renders).
 *   - Forcing a unified AppShell now would either drop those screen-
 *     specific behaviours or pollute the shell with conditional logic.
 *   - The right migration order is:
 *       1. Lock the slot contract (this file)
 *       2. Per-screen audit: which slots does it use, which doesn't it
 *       3. Migrate one screen at a time with snap-verify
 *
 * Slot contract:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ <TopBar>      logo · global search · profile chip                │
 *   │ <Anchors>     NW · Wealth Score · Risk · CoI (TripleAnchor /     │
 *   │                Risk-primary variant per route)                   │
 *   │ <ChromeBar>   tax-year filter · mode strip · breadcrumb          │
 *   │ <Content>     children — the screen body                         │
 *   │ <AskPill>     fixed bottom-right ASK SONU pill                   │
 *   │ <Footer>      FCADisclaimerFooter (variant=footer)               │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Migration plan (each step is its own commit):
 *   M1. Home   — already uses TripleAnchor + anchor row; migrate first
 *   M2. MyMoney — similar TripleAnchor pattern
 *   M3. Cashflow — has its own mode strip; merge into ChromeBar
 *   M4. TaxEstate — has the tax-year filter; lift into ChromeBar
 *   M5. Risk   — inverts anchor (Risk-primary); slot variant required
 *   M6. Timeline — gridded layout; check ChromeBar collision
 *   M7. MoneyIncome / Business / Protection / Trusts — sub-routes,
 *       inherit from parent MyMoney shell
 *
 * Each migration commit must:
 *   - Pass §9.5 Gate 1 (MCP screenshot at 3 viewports × 2 themes)
 *   - Numeric tie-out unchanged (no anchor value drift)
 *   - Console: zero new warnings
 */

import FCADisclaimerFooter from './FCADisclaimerFooter.jsx'

/**
 * Shell wrapping a route's content. Each slot is optional — pass `null`
 * to suppress (e.g. Welcome screen has no anchors).
 */
export default function AppShell({
  topBar = null,
  anchors = null,
  chromeBar = null,
  askPill = null,
  showDisclaimer = true,
  children,
}) {
  return (
    <div className="sw-app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {topBar && <header className="sw-app-shell-topbar">{topBar}</header>}
      {anchors && <div className="sw-app-shell-anchors">{anchors}</div>}
      {chromeBar && <div className="sw-app-shell-chrome">{chromeBar}</div>}
      <main className="sw-app-shell-content" style={{ flex: 1 }}>
        {children}
      </main>
      {showDisclaimer && <FCADisclaimerFooter />}
      {askPill && <div className="sw-app-shell-ask-pill">{askPill}</div>}
    </div>
  )
}
