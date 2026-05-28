# Phase A — results checkpoint (before B1 hybrid run)

**Date:** 2026-05-25
**Plan:** `~/.claude/plans/why-do-you-have-async-balloon.md`
**Status:** Phase A1-A6 COMPLETE. B1 (full hybrid) kicked off.

---

## What landed

| # | Item | Outcome |
|---|---|---|
| A1 | UI persona routing | `src/App.jsx:25` `mrt: personaA` → `mrt: mrTCore` + `mrt-core` route. Dev badge in `Sidebar.jsx` (`data-testid="entity-identity-badge"`) asserts entity.id matches persona token; green ✓ if match, red ⚠ if not. Verified: `?demo=mrt` → "Mr T · 35", `?demo=a` → "Bruce Wayne · 62". |
| A2 | 5 missing UK tax bundles | `UK-2021.1.1.json` through `UK-2025.1.1.json` written. Each carries year-correct rates + mid-year event metadata (HSC Levy 2022 NIC reverse, CGT 18/24 from 30 Oct 2024, NIC employee 12→10→8% etc). |
| A3 | asOfDate selection in engine | `data-source.js` — silent fallback removed (now THROWS), `selectRuleBundle(taxYear, asOfDate)` added, `applyMidYearEvents` overlays dated rate changes. `snapshot.mjs` rewired to call it. Verified: 2021/22 loads UK-2021.1.1, 2026/27 loads UK-2026.1.1, NW differs per year. |
| A4 | mrT family in runner + Supabase | `runner.mjs --family mrT` resolves 13 fixtures (was empty before). `--all-personas` extended to include `main + matrix + mrT + historical = 111 personas`. `supabase/migrations/013_seed_mrT_personas.sql` written (idempotent INSERT). |
| A5 | C8-C12 validator | `rule-validator.mjs` extended: C8 required-keys, C9 couple-consistency, C10 income-conservation, C11 as-of-date label, C12 math sanity (catches the MyMoney 150yr time-covered / 52× income-buffer bug class). |
| A6 | Coverage manifest | `scripts/build-coverage-manifest.mjs` + `tests/coverage-manifest.md`. Every cell explicit: 6/6 UK years, 111 personas across 4 families, 5 jurisdiction gaps surfaced (India/Thailand/Canada/Ireland/Australia). |

---

## Rules-only run results (`DATA_SOURCE=json --all-personas`, 666 cells, 30 sec)

```
  PASS:  630 (94.6%)
  WARN:   36 (5.4%)
  FAIL:    0
```

Baseline for comparison (2026-05-21 rules-only): **539 PASS / 13 WARN / 0 FAIL** across 552 cells.

PASS rate is comparable (~95%) but **coverage shifted from validating-2026-against-everything to validating-each-year-against-its-own-bundle**. The 666 cells include 13 mrT fixtures × 6 years = 78 cells that had never been validated.

### What the 36 WARNs are

**All 36 are C9 (couple-consistency) on 6 mrT couple fixtures × 6 years.** No noise from C1-C8 / C10-C12.

```
Couple persona but no spousal_nrb_available flag AND engine nrb=£325,000 (expected ≥ £650,000)
```

**Cells affected:** mrT-couple, mrT-family, mrT-landlord, mrT-ltd-director, mrT-sole-trader, mrT-uk-th — each × 6 years.

**Root cause (engine bug surfaced, fix deferred to Phase C):**

The 13 mrT-*.json fixtures use a nested `individual.{...}` + `partner.{...}` schema. The engine reads `entity.partner` / `entity.spouse` at root and returns NRB = £325k — treating couple personas as singles. The real UK effective NRB for couples should be £650k via transferable NRB. `iht.nrb` reflects engine output, so it shows £325k. C9 catches the mismatch.

Note: persona-b (Fred & Wilma, also a couple, in Bruce-shape) did **NOT** trigger C9 — the engine handles persona-b correctly. This is specifically an **mrT-fixture-shape vs engine-reader** mismatch.

### Why this is the founder's named ask, made concrete

Before Phase A: 13 mrT fixtures never entered the matrix → 36 buggy cells were invisible.
After Phase A: matrix includes mrT → buggy cells surface as labelled, ticketed WARN rows.
C9 wasn't writable before A4 (no mrT in matrix) → no bug to detect.

The bug existed forever. Now it's labelled and surfaced — not a silent gap.

---

## Cell-count derivation (the "552-run" mystery resolved)

| Source | Cell count | Personas |
|---|---|---|
| 2026-05-21 baseline `--all-personas` (Supabase) | 552 | 92 = 7 main + 85 matrix (Supabase had 85 matrix rows then) |
| Today `--all-personas` (Supabase, no migration applied) | 510 | 85 = 7 main + 78 matrix (someone dropped 7 matrix rows since May 21) |
| Today `--all-personas` (`DATA_SOURCE=json`) | **666** | **111** = 7 main + 84 matrix + 13 mrT + 7 historical |

The 2026-05-21 "552" was real but **only via Supabase mode and only on 7+85 personas**. Today's 666 is the JSON-source-of-truth count and surfaces mrT for the first time. Once migration 013 is applied to Supabase, both modes converge.

---

## What B1 will do

`DATA_SOURCE=json node tests/harness/runner.mjs --all-personas --hybrid` — 666 cells through DeepSeek validation. Expected:
- ~30 min wall-clock (extrapolating from baseline 552 → 27.6 min)
- ~$0.36 (extrapolating from $0.25 / 552)
- Goal: verify the 19 FAILs from 2026-05-21 cleared after `snapshot.mjs` + `validator.mjs` edits, surface any new persona/year cells that FAIL under the year-correct bundle + C8-C12 checks.

---

## Open follow-ups (Phase C / Phase D)

1. **Engine bug** (C9 finding): wire engine's couple detection to read `entity.individual.partner` / `entity.partner` for mrT-shape fixtures, OR write a `normaliseFixture()` adapter that lifts nested fields to root. Phase C/D.
2. **mrT UI rendering**: only mrT-core is UI-renderable (Bruce-schema). The other 12 fixtures are engine-test-only until a normaliser lands. PERSONA_LIST in App.jsx only exposes mrt-core.
3. **Multi-jurisdiction**: India/Thailand/Canada/Ireland/Australia bundles still stub. mrT-uk-in + mrT-uk-th fixtures reference UK+IN / UK+TH but engine only computes UK side. Phase D.
4. **C9 baseline**: 36 WARNs persist until engine is fixed. B1 should report a stable 36-WARN baseline so future runs detect regressions.

---

**Files touched in Phase A:**
- `src/App.jsx`
- `src/components/Shell/Sidebar.jsx`
- `src/lib/data-source.js`
- `src/rules/UK-2021.1.1.json` (new)
- `src/rules/UK-2022.1.1.json` (new)
- `src/rules/UK-2023.1.1.json` (new)
- `src/rules/UK-2024.1.1.json` (new)
- `src/rules/UK-2025.1.1.json` (new)
- `tests/harness/snapshot.mjs`
- `tests/harness/runner.mjs`
- `tests/harness/rule-validator.mjs`
- `scripts/build-coverage-manifest.mjs` (new)
- `scripts/diff-audit-vs-baseline.mjs` (new)
- `supabase/migrations/013_seed_mrT_personas.sql` (new)
- `tests/coverage-manifest.md` (generated)
- `docs/superpowers/audits/2026-05-25-phase-A-results.md` (this file)
