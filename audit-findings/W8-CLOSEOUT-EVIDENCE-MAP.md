# W8 — Closeout: 10-Ask Evidence Map

Title: Whole-app review program — closeout + evidence map
Version: 1.0
Date: 2026-06-12
Status: COMPLETE (code waves) — founder activation items remain
Cluster: 10-All-Clusters
Purpose: map every founder ask to delivered evidence; record what is done, what is founder-gated, and what is deliberately deferred.

**Summary:** The W0→W8 program is code-complete. Every ask has a concrete, verified delivery or an honest reason it is externally gated. Two items need the founder (key rotation + parse/OB activation); two engine consolidations are deliberately deferred against the green tie-out baseline.
**Tags:** #closeout #audit #evidence
**Updated:** 2026-06-12

---

## Final verification (the gate, not a summary)

| Check | Result |
|---|---|
| `npm run build` | ✓ clean — 397 modules, built 335ms |
| `tests/reports-sp1-tieout.mjs` | ✓ 27/27 |
| `tests/tax-income-tieout.mjs` | ✓ 24 personas, 5 invariants hold |
| `tests/sa-computation.mjs` | ✓ 24 personas, POA/ledger/loss checks pass |
| `tests/run-ask-sonu-coverage.mjs` | **94/122 (77%)** — up from 26/122 (21%) baseline |
| Code-split verified live | Home (eager) + Cashflow + TaxEstate (lazy) render, clean reboot |
| Pension-capture verified live | AA relief headroom £24k → £8k on a £40k contribution (tie-out) |
| Brand leak (Caelixa/Finio) | 0 in user-facing JSX |

## Ask → delivery → evidence

| # | Ask | Delivered | Evidence / commit |
|---|---|---|---|
| 1 | Find issues | W1 full-app audit → register; W3 fixed 10 P0/P1 | FINDINGS-REGISTER W3a; `eb99162`/`87f170f`/`2ff2f73`/`51d4fea`/`80108c3` |
| 2 | Enhancements | W6 AI engine (+68 scenarios), W5 household capture, W7 perf | `21c3c01`, `2bad5fb`, `df1e43a` |
| 3 | Gaps | Dead data-capture path (F-413), lost-on-reload (F-419), £0 IHT waterfall (F-310) | `87f170f`, `2ff2f73`, `80108c3` |
| 4 | Errors | NaN% chip (F-003-RC), gift-IHT taxing whole gift (F-312), bundle dead-keys (F-518) | `eb99162`, `51d4fea` |
| 5 | Recommendations + charts | Chart-decider sweep (verdict: tables are statutory/legal, correctly tabular); app already chart-dense | W7 register entry |
| 6 | Plain English ("no one knows Balance Sheet") | Renamed statements ("What you own & owe (Balance Sheet)") + `<Term>` glossary +7 terms | W4 `a77279f` |
| 7 | Redesign | Code-splitting −35% index chunk (F-010); couple avatar fix (F-011) | W7 `df1e43a` |
| 8 | Data capture missing | 5a household fields LIVE; 5b parse-document deploy-ready; 5c OB vendor decision; 5d persistence done | `2bad5fb`, `fa33c93`, `2ff2f73` |
| 9 | My own AI engine | Ask Sonu 21% → 77% — ~75 FCA-safe plays across 10 domains, sub-intent routing | W6 `21c3c01` |
| 10 | Anything else (D-lanes) | FCA boundary (fabricated citations removed, option-framing), brand-leak clean, perf | `7f1e8d0`, W7 |

## Founder activation items (cannot be done in code)

1. **🔴 Rotate the exposed secrets** — Supabase service_role JWT + DeepSeek keys were on the public repo (scrubbed from HEAD `b881637`, but rotation is the only real fix). Supabase dashboard + DeepSeek console + decide repo visibility. **This is the highest-priority open item.**
2. **Activate parse-document** — `supabase secrets set ANTHROPIC_API_KEY` + deploy + flip `REAL_PARSER_WIRED`. Until then Upload/Scan stay on the honest empty-state.
3. **Open banking** — sign TrueLayer commercials + DPA before the connect-bank build can start.

## Deliberately deferred (with reason)

- **F-309 / F-311 (IHT canonical-reader consolidation)** — 3 disagreeing RNRB paths + pre/post-2027 base mismatch. High regression risk against the green £287k hero tie-out. Needs a dedicated canonical-reader refactor + baseline re-verification, not a rushed inline edit (CLAUDE.md §9.5). 
- **F-001 / F-004 (household-income + pension-contribution engine consolidation)** — W5-5a now writes the canonical fields, but the *full* multi-field reconciliation (partner income into household cashflow tax; the 5-field pension-contribution split) is an engine-layer refactor. Capture path is LIVE for the fields with confirmed readers; the rest flagged.
- **Ask Sonu remaining ~28 misses** — concentrated in cross-border (XB 6/8), HC/EDU/FAM edge cases. Per decision #2 (hybrid), these fall to the LLM narrative layer, not more deterministic plays.

## Independent due-diligence lanes (D1–D12) status

D1/D11 calc — wrong-key + dead-path classes fixed (F-518, F-310, F-312); deeper golden-vector audit is the standing pre-launch gate (memory `project_independent_calc_audit_required`). D2 security — secrets scrubbed, rotation = founder. D3 FCA — boundary pass done (`7f1e8d0`). D4 perf — code-split −35%. D5 a11y / D12 mobile — not separately swept this program (candidate for a dedicated pass). D6 architecture / D9 test posture — assessed; engine-layer reconciliation is the deferred F-309/F-311/F-001/F-004 work. D7 resilience — per-tab ErrorBoundary confirmed; Suspense fallback added. D8 edge personas — family persona built + renders on all tabs. D10 launch — brand clean; key rotation outstanding.
