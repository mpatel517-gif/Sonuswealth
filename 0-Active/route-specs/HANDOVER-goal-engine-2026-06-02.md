# Handover — Goal Engine build (autonomous overnight session 2026-06-02)

**Read this when you wake.** Built autonomously while you slept, per your "continue on your own". Stopped at a clean, fully-verified engine milestone — deliberately did NOT start the UI (needs your eyes + snaps).

## What exists now (12 commits, all on `main`, pushed)

The **one goal engine, both life stages** — pure, deterministic, **zero hardcoded tax**, **140 tests** green, build clean, regression-neutral (pure leaves).

| Module | What | Tests |
|---|---|---|
| `src/engine/goal-engine.js` | Goal model: 17-type taxonomy, normalise, lexicographic budgeting rule, derive goals from persona `plans[]` | 38 |
| `src/engine/withdrawal-tax.js` | Per-year UK tax (income/CGT/dividend/savings) + AllowanceLedger (temporal allowances) | 28 |
| `src/engine/decumulation-solver.js` | `solveDecumulation`: paths, network, schedule, 2027 flip, double-tax, lexicographic scoring, methodology, coverage | 57 |
| `src/engine/accumulation-solver.js` | `solveAccumulation`: on-track % + lever per goal (Mr T) | 17 |

Run all: `npm run test:goal-engine && npm run test:withdrawal-tax && npm run test:decum-solver && npm run test:accum-solver`

## The headline result (Bruce, `?demo=a`)
Lexicographic ranking of 4 withdrawal paths under his real goals, with the **£230k+ lifetime-tax spread** between best/worst draw order, the **post-2027 inherited-pension double-tax** correctly modelled (you caught this — draining the pension leaves heirs ~£1m more), true **net-target delivery** (£96k asked = £96k delivered), **PCLS** tax-free cash, and **inflation-uprated** spending so it honestly shows depletion (~age 87) instead of false 100% survival.

Mr T (`?demo=mrt`): 71% on track to £2.5m by 60, lever "save £1,230/mo more."

## ⚠️ The independent audit found CRITICAL bugs my own tests missed
I ran 3 parallel adversarial reviewers (IFA / tax-CTA / FCA-compliance). They found — and I fixed — bugs that **123 passing unit tests did not catch**, because my tests verified internal consistency (tax = Σtax) not correctness-vs-reality (deliver £96k *net*):
- **C1 gross/net conflation** — client asking £96k net was shown "funded" while actually £15-25k/yr short. FIXED (per-year gross-up).
- **C2 PCLS never modelled** — pension taxed 100%, ignoring 25% tax-free. FIXED.
- dividend/savings band ordering reversed; pension IHT-share understated; no inflation uprating; compliance copy steered toward recommendations. ALL FIXED.

**This is the proof for the mandatory independent calc audit** (memory: `project_independent_calc_audit_required.md`). Green tests are necessary, not sufficient.

## Deferred (surfaced honestly in `coverage`, not silently dropped)
- Spousal exemption / couples (Bruce is single, so his numbers are right; married personas would over-show death tax — banner added).
- Property as income source + property CGT (the reason Bruce "depletes" despite £2.25m property — it's not liquid-income in the model; caveat surfaced).
- s24 BTL mortgage-interest restriction; emergency tax; small-pots.
- **Dividend rate literal `0.1075` in fq-calculator** — the tax auditor flagged it may be the proposed +2% rate, not current. I did NOT change it blindly (changing tax rates without certainty is dangerous) — **needs verification against the bundle's ENACTED status.** Please confirm or flag for the independent audit.

## Next steps (in order)
1. **Step 2c** (task #40): the 5 withdrawal-*rate* methods (Bengen/GK/Vanguard/Bucket/floor+guardrail) — engine-side, I can do solo.
2. **Step 4**: `GoalPriorities` shared drag-rank primitive.
3. **Step 5** (task #41): the Cashflow UI — **do this with you**, not blind: goal-led hero, SolverPanel (network + selectable branch paths), MethodDrawer, "How we worked this out" panel. Engine emits everything it needs. Must pass §9.5 snaps. Compliance contract: label rank "highest under your priorities" NOT "optimal/best"; resilience NOT "probability".

Design doc (full): `~/.claude/plans/goal-engine-design.md`. Memory updated.
