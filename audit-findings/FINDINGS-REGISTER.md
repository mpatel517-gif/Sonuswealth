# Whole-App Review — FINDINGS REGISTER

**Program:** `~/.claude/plans/yes-i-want-you-sequential-elephant.md` · **Started:** 2026-06-11
**Severity:** P0 wrong numbers/broken flow · P1 dead UI/data loss · P2 jargon/UX confusion · P3 polish
**Status:** OPEN · IN-WAVE · CLOSED · DEFERRED(reason)
**Ask#:** founder asks 1–10 · D-lanes D1–D12 (see plan)

---

## VERIFIED BASELINE (W0, 2026-06-11)

| Harness | Result |
|---|---|
| `tests/run-ask-sonu-coverage.mjs` | 26/122 (21%) PASS · 46 WRONG_LEAD · 50 FAIL — matches expectation |
| `tests/sa-computation.mjs` | ✓ green (23 personas) |
| `tests/tax-income-tieout.mjs` | ✓ green (23 personas, 5 invariants) |
| `tests/reports-sp1-tieout.mjs` | ✓ 27/27 |
| `npm run build` | ✓ clean (note: index chunk 1.56MB — D4 row below) |

**Inherited-claim verification:**
| Claim | Verdict |
|---|---|
| "5 MyMoney drills TODO" (README-DRILLSTACK) | **STALE** — all 5 files exist AND have the DrillStackProvider retrofit. README corrected 2026-06-11. |
| "Reports = 30% stub" (explorer) | **STALE** — full SP-1 viewer (drawer → sub-drawer → full-screen) merged 2026-06-10, 27/27 tie-outs. |
| Data-capture explorer findings (manual live; Upload/Scan gated; OB placeholder; missing fields) | **VERIFIED** in source (REAL_PARSER_WIRED=false, anthropic-vision.js unwired, no /api/parse). |
| Ask Sonu 27 plays / 11 lenses / zero-coverage domains | **VERIFIED** via coverage harness baseline. |

**New family persona:** `persona-family.json` (Bob & Helen Parr, `?demo=family`) — UI-shape lift of mrT-family fixture. Renders on ALL 6 tabs, zero NaN/crash. NW £409k (engine excludes children's JISA). Badge renders "B&" (cosmetic, P3).

---

## W3a — CLOSED (2026-06-12, main-thread, commit-after-each, no agent fleet)

| ID | Sev | Fix | Verification | Commit |
|---|---|---|---|---|
| F-210 | P1 | `protection` surfaced from `monthlySurplus()` + added as expenditure/outflow line in income + cashflow statements → children sum to net | Structural (symmetric add) + reports-sp1 27/0 | eb99162 |
| F-518 | P0 | Bundle key-map rewired — `b.cgt`/`b.iht`/`b.sdlt` dead paths → real `capitalGains`/`inheritanceTax`/`property` homes; CGT + BPR/AIM + gift block now tracks the active bundle (was frozen literals) | Node: all keys resolve to bundle values; build green | eb99162 |
| F-003-RC | P1 | `ConfidenceChip` coerces 'high'/'medium'/'low' string confidence → 0–1 (no more NaN%) | Logic fix | eb99162 |
| F-205 | P2 | Consequence chips map raw engine keys (cashflow_30yr…) → plain English; unmapped humanised | Logic fix | eb99162 |
| F-413 | P0 | DataCapture manual/parsed Add silently dropped — added `toAssetEventPayload()` adapter mapping capture shape → reducer-routable `{category,itemType,fields}` | **LIVE**: seeded cash capture → NW £1.75m→£1.87m, Cash +£123,456 | 87f170f |
| F-419 | P0 | Captures lost on reload — always-on localStorage mirror (persist/hydrate/clear), auto-seed on persona mount | **LIVE**: event survived reload + re-hydrated | 2ff2f73 |
| F-201 | P2 | Supabase "missing env" console.error spam (expected demo path) → one console.info | **LIVE**: 0 console errors (was 24+) | df7896d |
| F-202 | P2 | `fontVariantNumeric` SVG-attribute warning → moved to `style` in 3 components | Build green | df7896d |
| F-312 | P0 | Gift IHT taxed whole gift — rewrote `giftClockProjection` (annual exemption + chronological NRB cumulation; only slice above NRB taxed; CLT/PET tagged) | Node: £3k→£0 (was £960); £400k PET→£28,800 on £72k above NRB | 51d4fea |
| F-310 | P0 | "IHT after moves" stuck at £0 — fq `ihtWaterfall` delegates to canonical tax-estate-engine one (rich shape); kills the duplicate | **LIVE**: mrt now shows live slider-responsive figure (was £0) | 80108c3 |

**Still OPEN (not addressed this pass):** F-311 (pre/post-2027 IHT base + waterfall-vs-exposure reconciliation), F-309 (canonical `rnrbEffective` — 3 disagreeing RNRB), F-308 (CGT tile vs detail), F-114 (BPR relief > total assets), F-500/501/502 broader surplus/NW/IHT canonical-reader consolidation.

---

## W3-tail / W4 / W6 — CLOSED (2026-06-12, continued)

| Wave | Item | Fix | Verification | Commit |
|---|---|---|---|---|
| W3-tail FCA | F-405/427-429/611 | Removed fabricated citations ("FA 1996 s.156 spousal ISA" → real ITA 2007 / TCGA 1992 s.58 basis; demo "spousal ISA transfer" → APS); onboarding no longer "recommend portfolios"; synthesizer lead reframed from definitive recommendation → option framing (RAO Art 53 boundary). Every play already renders FCA disclaimer. | Build green; coverage unchanged 26/122 | 7f1e8d0 |
| W4 | Plain English (ask #6) | "Balance Sheet" → "What you own & owe (Balance Sheet)" + Income/Cashflow statements, across registry + builders + MoneyXDrawer; `<Term>` glossary extended (CGT, AEA, PSA, AA, decumulation, S24, BADR). | Build green; reports-sp1 27/0 | a77279f |
| W6 | AI engine mortgage domain (ask #9) | New DEBT concern + 4 sub-intent concerns + 4 classifier rules + 4 FCA-safe plays (overpay/remortgage/offset/equity-release); harness themeKeywordMap extended. Precise sub-intent routing (no wrong-domain answers). | **Coverage 26→36/122 (21%→30%)**; all 8 MORT + INH-02 PASS; routing verified per-query | 4e1204d |

**W6 — COMPLETE (2026-06-12).** Ask Sonu coverage **26→94/122 (21%→77%)**, clearing the ≥90/122 (75%) target. Built ~75 FCA-safe plays across mortgage, cash, investment, business-exit, property, lifestyle, tax, IHT/estate, inheritance and protection domains — each with a sub-intent concern + classifier rules so queries route to the RIGHT play (no wrong-domain answers, which would breach the FCA F-436 boundary). Fixed two real classifier bugs (the `ific`-in-"sacrifice" relocation false-match; the "protect" → preserve-intent filter). All play rates kept qualitative where they move (BADR/IR/CGT) with genuine statute citations, so the accuracy-auditor stays clean. Engine harnesses (reports-sp1 27/0, tax-income, sa-computation) all green — no regressions from the new plays. The remaining ~28 deterministic misses (some RET/XB/HC/EDU edge scenarios) fall to the LLM narrative layer per decision #2 (deterministic ≥75% + LLM for edge cases).

**W5 — COMPLETE to the code boundary (2026-06-12).**
- **5a (manual fields)** — new `PROFILE_FIELD_SET` event + reducer fold + "Household & income" DataCapture channel. Three LIVE fields (each writes the exact canonical field the engine already reads, verified, no dead paths): current-year pension contributions (→ AA headroom moved £24k→£8k on £40k, canonical-metrics tie-out), partner income (→ uk-risk survivor calc), dependent child (→ HICBC/RNRB/protection-need). NI-record + itemised-expense capture deliberately omitted — no live engine reader yet (would be dead paths); flagged for an engine-reader pass first. Commit `2bad5fb`.
- **5b (`/api/parse`)** — `supabase/functions/parse-document` Claude Vision parser, deploy-ready, mirrors ask-sonu-proxy security. INERT until founder sets `ANTHROPIC_API_KEY` + deploys + flips `REAL_PARSER_WIRED` (kept off so no dead path looks live). README documents activation + §9.5 verification. Commit `fa33c93`.
- **5c (open banking)** — vendor decision doc `audit-findings/W5-OPEN-BANKING-SPIKE.md`: recommend TrueLayer, cash-only v1 scope, build deferred to post-contract (regulated AISP relationship + DPA + prod credentials required first). Commit `fa33c93`.
- **5d (persistence)** — already closed in W3 (F-419 localStorage mirror).
**Founder-gated remainder (cannot be done in code):** set the Anthropic key + deploy parse-document; sign OB commercials. Both are activation steps, not unbuilt code.

**W7 — COMPLETE (2026-06-12).** Commit `df1e43a`.
- **F-010 (perf/D4)** route-level code-splitting: `lazy()` the 9 heavy tab screens behind one `<Suspense>` in the Dashboard tab switch. Index chunk **1.56MB → 1.01MB (−35%)**; TaxEstate/Cashflow/Timeline/MyMoney chunks now fetched on first visit only. Verified LIVE (Home eager + Cashflow + TaxEstate lazy all render, no stuck spinner, clean hard-reload boot).
- **F-011 (P3)** couple avatar initials "Bob & Helen Parr" → was "B&", now "BH" (aligned Dashboard to the Sidebar `/[\s&]/` split).
- **chart-or-table-decider sweep:** verdict CLEAN. Only 4 files use `<table>` — the SA100/SA110 tax computation (statutory format, must stay tabular), Legal terms (text), Cashflow, Risk. No mis-applied text-table that should be a chart; the app is already chart-dense (radar/sankey/marimekko/sparklines). Forcing chart conversions would be cosmetic churn + regression risk on a working statutory computation — not done deliberately.
- **brand consistency (D10):** CLEAN — zero `Caelixa`/`Finio` strings in any user-facing JSX.

**W8 — COMPLETE (2026-06-12).** Closeout + 10-ask evidence map at `audit-findings/W8-CLOSEOUT-EVIDENCE-MAP.md`. Final gate green: build (397 modules), reports-sp1 27/0, tax-income (24 personas), sa-computation (24 personas), Ask Sonu 94/122 (77%). **The W0→W8 program is code-complete.** Founder activation items remain (🔴 rotate exposed secrets; activate parse-document with the Anthropic key; sign OB commercials) and two engine consolidations are deliberately deferred against the green tie-out (F-309/F-311 IHT; F-001/F-004 household/pension reconciliation).

---

## FINDINGS

| ID | Screen/Area | Sev | Ask# | Finding | Status | Wave |
|---|---|---|---|---|---|---|
| F-001 | Engine/income | P0 | D1/D11 | **Partner income not consumed by engine.** Family persona: Bob £68.5k + Helen £22k (`employmentPartner`, mirrors `statePensionPartner` convention) — engine counts only £68.5k → Cashflow shows −£14k/yr deficit for a household actually in surplus. Same class as the spouse-income capture gap. Needs: canonical couple-income reader + capture path. | OPEN | W3/W5 |
| F-002 | Engine/tax | P1 | D1/3 | **HICBC (child-benefit charge) not computed anywhere.** Family persona sits at ANI ~£67.8k, squarely in the £60–80k claw-back band (£1,739/yr at stake) — no surface mentions it. Research table has the 2026/27 rules; needs engine fn + Tax-tab surface + Ask play. | OPEN | W3/W6 |
| F-003 | Cashflow | P0 | 4 | "NaN%" renders in the what-if "Retire now at 62 — phased SIPP drawdown" card (`cashflow_30yr`), found 2026-06-10 during Ask validation. | OPEN | W3 |
| F-004 | Engine/pension | P0 | D1 | Pension-contribution silent-zero class: current-year contributions read from 5+ disagreeing fields; only family persona populates `pensionContributions` root key. Needs canonical consolidation (memory `reference_pension_contribution_plumbing`). | OPEN | W3 |
| F-005 | State/persistence | P1 | D7/8 | Events fire-and-forget to Supabase, no localStorage fallback → manual entries can be lost on reload. | OPEN | W3/W5 |
| F-006 | DataCapture | P1 | 8 | Upload/Scan = dead UI (`REAL_PARSER_WIRED=false`); `anthropic-vision.js` unwired; `/api/parse` missing; prod parser 'real' unregistered → silent failure if enabled. | OPEN | W5 |
| F-007 | DataCapture | P1 | 8 | No capture path: spouse income, dependants, NI record/qualifying years, expense line-items. (Pension contribs → F-004.) | OPEN | W5 |
| F-008 | Ask Sonu | P1 | 9 | Zero plays for business/cash/investment/mortgage/property/lifestyle (26/122 coverage); matcher wrong-lead ~38%. | OPEN | W6 |
| F-009 | All screens | P2 | 6 | 7 blocker jargon terms surface-level with no plain-English (IHT, RNRB, nil-rate band, SIPP, AEA, CGT, PET, decumulation) + accountant report names. | OPEN | W4 |
| F-010 | Build | P2 | D4 | index chunk 1.56MB (414KB gz), mymoney 570KB, engine 704KB — no route-level code splitting. | OPEN | W7 |
| F-011 | Header | P3 | D7 | Family persona avatar badge renders "B&" (name-truncation on "Bob & Helen Parr"). | OPEN | W7 |
| F-012 | Docs | P3 | D6 | Stale-docs class: README-DRILLSTACK misled 2 audit agents (corrected); sweep other READMEs/status docs in W1. | OPEN | W1 |
| F-600 | Security | **P0** | D2 | Production Supabase **service_role** JWT (RLS-bypass, exp 2090) hardcoded in tracked scripts on PUBLIC repo + in git history. **Scrubbed from HEAD (`b881637`); ROTATION PENDING — founder must rotate in Supabase dashboard + decide repo visibility.** Anon key in client bundle verified normal. | IN-WAVE (rotation = founder) | W1-F |
| F-601 | Security | P1 | D2 | Two DeepSeek API keys hardcoded in 4 tracked launcher scripts (public + history). Scrubbed from HEAD (`b881637`); **rotation pending — founder, DeepSeek console.** | IN-WAVE (rotation = founder) | W1-F |
| F-611 | Compliance | P1 | D3 | Ask Sonu "Sonu's call" = single lead play personalised to user data + verbatim imperative play strings ("Sell the lot, immediately re-buy inside ISA") — risks the FCA Art. 53 personal-recommendation test; disclaimers alone don't cure it. Needs copy-softening pass (option-framing, not imperatives) + legal sign-off pre-launch. | OPEN | W2 memo + W6 |

*(W1 agents append from F-013 with their fragment prefix; main session dedupes.)*
