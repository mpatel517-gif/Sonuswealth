# My Money Screen — Element Inventory v1 (SEED)

**Screen:** Sonuswealth My Money (build: `src/screens/MyMoneyScreen.jsx`)
**Status:** **SEED — built from build screenshots (17 May 2026), not from the component.**
The `inventory-builder` agent must complete and correct this against the actual React
component in the repo before the five auditors run. Screenshot-derived rows are marked
`(scrn)`; the builder confirms each against code, adds everything the screenshots cannot
show (sub-tab contents, overlays, handlers), and flips the header to non-SEED.
**Design baseline:** My Money HTML mockup if one exists in the repo; else the component.
**Spec / intent reference:** `2-Product-mymoney-v2_*.md` (in the repo / Drive `2-Product`).
**Reconciliation baseline:** engine — `rules-uk.js` / `fq-calculator.js`.

---

## How to use

Identical discipline to `home-inventory-v1.md`: every element is one row; the audit walks
rows and records a verdict per row; the six assertions (A1–A6) and the
SOURCE/ACTION/DECISION drill rule apply. See `home-inventory-v1.md` for the full legend —
not repeated here.

`Verdict`: `PASS` · `FAIL` · `NA` · `UNVERIFIED` (default) · `BLOCKED`.
`Owns-subject destination`: the *expected* drill target, routed by the element's domain.

## Screen context (from tracker v5.83 — verify against component)

My Money is the **19-domain** money surface: twin-anchor, balance sheet with sub-tabs,
5-method drawdown, director gate. Pension / SIPP / drawdown is **owned here** — this is
where Home's "Start pension drawdown" action should land.

## Confirmed founder decisions

| FD | Decision |
|----|----------|
| FD-NAME-1 | Product name is **Sonuswealth** (D-NAME-2, locked 9 May 2026, `src/config/brand.js` is SoT). Casing: logo lowercase, body sentence-case, slogans all-caps allowed. Caelixa / Finio in user-facing strings = FAIL. See `home-inventory-v1.md` for full rule. |
| FD-CROSS-1 | Every critical action is a **surface-instance**, not a pointer — each surface owns its own angle/layout/data. My Money owns **the doing** for pension/SIPP/drawdown (the canonical surface). Other surfaces (Home/T&E/Timeline/Cashflow/Risk) each present their own angle of the same action with their own data. See `home-inventory-v1.md` for the angles table. Supersedes prior FD-MM-2 wording. |
| FD-LOGO-1 | Brand assets at `Codex UI/deliverables/sonuswealth-site/assets/`. See home-inventory FD-LOGO-1. |
| FD-MASCOT-1 | Sonnu (owl), 6 life-stage forms. Placement = Wave 7. See home-inventory FD-MASCOT-1. |
| FD-MM-1 | Layout order frozen — audit fixes what exists, adds no components (Waves 0–6). |

---

## ELEMENT TABLE (seed — incomplete; builder extends)

### Region 1 — Shell / chrome
Same as Home `H-CHR-01..12`. Reconcile the sidebar + topbar score chip identically.

### Region 2 — Cashflow banner (top)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-BAN-01 | Headline "−£10.0k · spending records income this month" (scrn) | DATA | SOURCE — Cashflow detail | UNVERIFIED | copy is unclear English (A5); reconcile sign + value |
| MM-BAN-02 | "Liquid cash covers 12.0 months at this rate" notice (scrn) | DATA | SOURCE — cash runway detail | UNVERIFIED | |
| MM-BAN-03 | Income-vs-spend bar (scrn) | DATA | SOURCE — Cashflow | UNVERIFIED | |
| MM-BAN-04 | Mini-tile — Monthly income £0 (scrn) | DATA | SOURCE — income detail | UNVERIFIED | **£0 for a £3.63m persona — likely data wiring gap** |
| MM-BAN-05 | Mini-tile — Withdrawals £10k (scrn) | DATA | SOURCE — withdrawals detail | UNVERIFIED | |
| MM-BAN-06 | Mini-tile — Debt payments £0 (scrn) | DATA | SOURCE — debt detail | UNVERIFIED | |
| MM-BAN-07 | Mini-tile — Committed £0 (scrn) | DATA | SOURCE — commitments detail | UNVERIFIED | |

### Region 3 — Triple-score row

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-SCR-01 | Net Worth card (£3.63m) (scrn) | ANCHOR | SOURCE — balance sheet (R8) | UNVERIFIED | `netWorth(e)`; must equal Home + R8 |
| MM-SCR-02 | Wealth Score card (47) (scrn) | ANCHOR | SOURCE — score breakdown | UNVERIFIED | `calcFQ(e)`; must equal Home value |
| MM-SCR-03 | Risk Score card (56) (scrn) | ANCHOR | SOURCE — Risk screen | UNVERIFIED | `calcRisk(e)`; must equal Home value |

### Region 4 — "Your wealth shape"

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-WS-01 | Composition bar + segments (scrn) | DATA | SOURCE — each segment → its asset class | UNVERIFIED | each segment drillable; reconcile % to R9 asset values |
| MM-WS-02 | Wealth-shape chevron (scrn) | ACTION | SOURCE — full composition detail | UNVERIFIED | |

### Region 5 — Health progress rows

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-HP-01 | Retirement funded 65% (scrn) | DATA | SOURCE — retirement funding detail | UNVERIFIED | reconcile to engine |
| MM-HP-02 | Estate efficiency "64p/£" (scrn) | DATA | SOURCE — Tax & Estate | UNVERIFIED | jargon — A5 plain-English check |
| MM-HP-03 | Tax shelter usage 0% (scrn) | DATA | SOURCE — tax shelter detail | UNVERIFIED | **"0%" contradicts £800k ISA in R9 — reconciliation FAIL** |

### Region 6 — "What to do next"

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-ACT-01 | Critical action — Start pension drawdown (£412k) (scrn) | ACTION | ACTION — dedicated pension drawdown panel (this screen, FD-MM-2) | UNVERIFIED | **£412k vs Home design £340K — reconcile; same action as Home H-ACT-01, must route + value-match** |
| MM-ACT-02 | Action sub-rows / mapping bullets (scrn) | DATA | — | UNVERIFIED | **placeholder text "mapping inbound / draft inbound" visible to user — A5 FAIL** |
| MM-ACT-03 | "Which pot to draw down from first" row (scrn) | ACTION | DECISION — drawdown sequencing (5-method) | UNVERIFIED | |

### Region 7 — Balance sheet

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-BS-00 | Section header "Tap any tile to drill…" (scrn) | DATA | NA | UNVERIFIED | promises drillability — A2/A4 must hold for every tile |
| MM-BS-01 | Sub-tab — Balance sheet (active) (scrn) | ACTION | tab content | UNVERIFIED | |
| MM-BS-02 | Sub-tab — Income (scrn) | ACTION | tab content | UNVERIFIED | content not visible — builder enumerates |
| MM-BS-03 | Sub-tab — Cash flow (scrn) | ACTION | tab content | UNVERIFIED | content not visible — builder enumerates |
| MM-BS-04 | Sub-tab — Insurance (scrn) | ACTION | tab content | UNVERIFIED | content not visible — builder enumerates |
| MM-BS-05 | Sub-tab — Bonds (scrn) | ACTION | tab content | UNVERIFIED | content not visible — builder enumerates |
| MM-BS-06 | Total Net Worth panel (£3.63m) + chevron (scrn) | DATA | SOURCE — asset detail | UNVERIFIED | must equal MM-SCR-01 |
| MM-BS-07 | Assets / Liabilities bar (scrn) | DATA | SOURCE | UNVERIFIED | **"−£0" liabilities — fmt() signed-zero FAIL** |
| MM-BS-08 | Side card — Other assets +£0 (scrn) | DATA | SOURCE | UNVERIFIED | "+£0" — fmt() check |
| MM-BS-09 | Side card — Last updated (scrn) | DATA | SOURCE — data freshness | UNVERIFIED | |
| MM-BS-10 | Side card — Projected (scrn) | DATA | SOURCE — projection | UNVERIFIED | |
| MM-BS-11 | Side card — Cash buffer (scrn) | DATA | SOURCE — cash runway | UNVERIFIED | reconcile to MM-BAN-02 |

### Region 8 — Asset card grid (each card: figure · state · "View detail" · optional action)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-AST-01 | Pensions card (£850k) (scrn) | DATA+ACTION | SOURCE — pension detail; ACTION — drawdown panel | UNVERIFIED | has "pension drawdown available" CTA — verify route = FD-MM-2 |
| MM-AST-02 | Savings & Investments / ISA card (£800k) (scrn) | DATA+ACTION | SOURCE — ISA detail | UNVERIFIED | reconcile to MM-HP-03 tax-shelter % |
| MM-AST-03 | Property card (£1.80m) (scrn) | DATA+ACTION | SOURCE — property detail | UNVERIFIED | |
| MM-AST-04 | Business assets card (empty state) (scrn) | DATA | ACTION — add business asset | UNVERIFIED | empty state must offer an ACTION, not dead-end |
| MM-AST-05 | Protection card (empty state) (scrn) | DATA | ACTION — add protection / Risk | UNVERIFIED | |
| MM-AST-06 | Liabilities card (empty state) (scrn) | DATA | ACTION — add liability | UNVERIFIED | |
| MM-AST-07 | Cash card (£180k) (scrn) | DATA+ACTION | SOURCE — cash detail | UNVERIFIED | |
| MM-AST-08 | GIA card (scrn) | DATA+ACTION | SOURCE — GIA detail | UNVERIFIED | |
| MM-AST-09 | Accumulation card (£0) (scrn) | DATA | SOURCE | UNVERIFIED | confirm "£0" is real, not unwired |
| MM-AST-10 | Decumulation card (£0) (scrn) | DATA | SOURCE | UNVERIFIED | confirm "£0" is real, not unwired |
| MM-AST-0x | Per-card "View detail" link (scrn) | ACTION | SOURCE — that asset's detail | UNVERIFIED | **card states inconsistent — some have action CTAs, some not; flag inconsistency** |

### Region 9 — Tax allowances

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-TAX-00 | Section header "What you keep and what you're sheltering" (scrn) | DATA | NA | UNVERIFIED | |
| MM-TAX-01 | Tile — Tax kept after tax £0 (scrn) | DATA | SOURCE — tax detail | UNVERIFIED | "£0" — verify wired |
| MM-TAX-02 | Tile — ISA unused this tax year £20k (scrn) | DATA | SOURCE / ACTION — ISA | UNVERIFIED | reconcile to MM-HP-03 and Home ISA action |
| MM-TAX-03 | Row — "What you actually keep from what you earn →" (scrn) | ACTION | SOURCE — earnings/tax detail | UNVERIFIED | |
| MM-TAX-04 | Row — "Your free allowance — 0% used" (scrn) | DATA+ACTION | SOURCE — allowance detail | UNVERIFIED | "0% used" vs £20k unused — reconcile |

### Region 10 — Footer / Ask Sonu
Same as Home `H-FOOT-*` + Ask Sonu bar. FCA boundary line must be present.

### Region 11 — Sub-tab content + overlays
**Not visible in screenshots.** The inventory-builder must open the component and
enumerate: Income / Cash flow / Insurance / Bonds sub-tab contents, the director gate,
the 5-method drawdown panel, and every overlay/modal My Money imports.

---

## SEED FINDINGS (confirm, severity-assign, extend)

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| MM-S-01 | MM-BAN-04 | Monthly income shows £0 for a £3.63m drawdown persona — probable data-wiring gap; the −£10.0k headline depends on it | DEMO-BLOCKING |
| MM-S-02 | MM-HP-03 ↔ MM-AST-02 | "Tax shelter usage 0%" (critical) sits on the same screen as an £800k ISA — an £800k ISA is sheltered | DEMO-BLOCKING |
| MM-S-03 | MM-ACT-01 ↔ Home H-ANCH-04 | Cost of Inaction shows £412k here vs £340K on the Home design baseline — does not reconcile | DEMO-BLOCKING |
| MM-S-04 | MM-ACT-02 | Build placeholder text ("mapping inbound", "draft inbound") visible in the live UI | DEMO-BLOCKING |
| MM-S-05 | MM-AST-* | Asset cards in inconsistent states — some carry action CTAs, some empty states dead-end; "tap any tile to drill" is promised but not uniform | FUNCTIONAL |
| MM-S-06 | MM-BS-07/08 | `−£0` / `+£0` rendered — `fmt()` not handling signed zero | FUNCTIONAL |
| MM-S-07 | MM-HP-02 | "Estate efficiency 64p/£" — jargon with no plain-English meaning | FUNCTIONAL |
| MM-S-08 | MM-ACT-01 / MM-AST-01 | "Start pension drawdown" appears on My Money and Home — must route to the SAME dedicated drawdown panel and show the SAME impact figure | DEMO-BLOCKING |
| MM-S-09 | MM-SCR-01/02/03 | Net Worth £3.63m / Wealth 47 / Risk 56 appear to match Home — confirm as PASS, including format | (verify) |
| MM-S-10 | MM-AST-09/10, MM-TAX-01 | Multiple `£0` values — distinguish "genuinely zero" from "unwired / not yet loaded" | FUNCTIONAL |

---

## COVERAGE MATH

Same as `home-inventory-v1.md`. This is a SEED — Coverage cannot reach 100% until the
`inventory-builder` completes it against the React component (Region 11 especially).
"99% confident" is only valid when restated as "X of Y rows verified PASS."

---

*— end mymoney-inventory-v1.md (SEED) —*
