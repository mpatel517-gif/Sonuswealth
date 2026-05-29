# PRODUCT — Sonuswealth

> Synthesised from existing canonical sources, not from a one-line prompt. Authority: BRAND v2026-05-09 (`src/config/brand.js`), Foundation v1.11, dynamic-crunching-wall.md §2 (PP-1–PP-10), Home v1.4 spec.

## Register

**product** — this is the in-app UI (Home, Money, Cashflow, Tax, Risk, Timeline). Marketing pages are a separate concern (a future register=brand surface).

## Users

UK individuals with non-trivial financial complexity — multiple pension wrappers (SIPP + workplace DC + DB), ISA / GIA, BTL or main residence, possibly EIS / VCT / BPR-qualifying business, possibly a director loan account or trust. **Not** day-traders, **not** simple-cash-only retail. The user already knows their financial life is too tangled to hold in a spreadsheet.

Secondary user: the user's **IFA** (per IFA Practice v1.0) — reads adviser-mode tabs, writes Notes, generates client reports.

The product must work for a *novice* on the surface (macOS principle, PP-2) and a *power user* on drill (PP-3 nth-degree drillability).

## Brand

- **Name:** Sonuswealth (D-NAME-2, 9 May 2026 — supersedes Sonuswealth, Finio)
- **Mascot:** Sonu (owl, friendly AI persona)
- **Tagline:** *"Intelligence without the noise."*
- **Score names:** Sonuswealth Wealth Score (0–100, 8 weighted dimensions), Sonuswealth Risk Score (0–100, 7 weighted dimensions; higher = more protected)
- **Domain:** sonuswealth.com (consumer)

## Tone

**Information, guidance, and storage — never a sales platform** (PP-1, locked). No product recommendations, no broker links, no commercial surfacing. FCA boundary on every output. Plain English mandatory (PP-9) — no internal codes (X25, X28, FQ, CoI, APQ, PRC/PCC, ANI, RNRB, BPR, LPA) visible in UI.

Voice: descriptive, never directive. *"Your IHT exposure is £340k at current trajectory."* Not *"You should consolidate your pensions."*

## Strategic Principles (locked)

| ID | Principle |
|---|---|
| **PP-1** | Information, guidance, and storage — never a sales platform |
| **PP-2** | macOS principle: simple surface, depth on tap |
| **PP-3** | Drillable to the nth degree — every number is a tap-target |
| **PP-4** | Four-dimension view across every tab (Actual / Forecast / Plan / Scenario) |
| **PP-5** | Cross-tab ripple via single canonical `rippleEffect()` function |
| **PP-6** | Engine is source of truth, screens are presentation only |
| **PP-7** | No fake precision — incomplete data → range + confidence + provenance |
| **PP-8** | IFA-vs-end-user view distinction |
| **PP-9** | Plain English mandatory (no internal codes in UI) |
| **PP-10** | Manual entry = high trust (confidence 1.0). AI ingest = confidence-flagged |

## Anti-references

What we explicitly are **not**:

- **Voyant / Iress fact-find tools** — they're IFA-only, joyless, no design polish, gated by a paying adviser
- **Moneybox / Plum** — single-product growth funnels, sales of in-app investment, no advisory depth
- **Mint / YNAB** — budgeting-led, no wealth-stack thinking, no UK tax integration
- **Personal Capital / Empower** — advisor-lead-gen surface dressed as a tool, US-only
- **Generic SaaS dashboards** — Stripe Atlas, Notion-as-finance-tool, Linear-for-money, Vercel-for-pension. Sonuswealth is **finance-native**, not a generic dashboard with money fields.
- **"AI fintech" first-training-data reflexes** — neon mint on black, generic gradient hero metric, gradient-text big number, "AI-powered" everywhere, hero card with confetti milestone celebrations.

## Anti-patterns to avoid

- Hero-metric template (huge number + small label + supporting stats + gradient — SaaS cliché)
- Side-stripe borders on alert cards (current code has them — flag for revision)
- Identical card grids (icon + heading + 2 lines, repeated)
- Modals as first thought (use inline / progressive)
- Loud milestone celebrations (PP §13.10: quiet milestones — background glow, no confetti)

## Success criteria

A returning user can answer **three questions in <10 seconds without scrolling** on the Home tab:
1. Where do I stand financially overall? (triple-anchor)
2. What changed since I last looked? (daily delta)
3. What is the one thing I should do today? (top-1 priority action)

If they cannot, the screen has failed.
