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
