# Lane 2 — Outstanding work

**Status:** 5 of 9 done + engine fix + TO-7. Onboarding now validates before Dashboard renders — malformed entities can't reach the engine. 4 items still pending — all are wiring or refactor, not foundation work.

---

## Done (5 of 9 + 2 inline engine fixes)

| ID    | Status | Evidence |
|-------|--------|----------|
| L2-1  | ✓ DONE | `src/engine/taxonomy.js` — 12 enums (162 entries), version 1.0.0 |
| L2-2  | ✓ DONE | `persona-normalizer.js` validateEntity + assertEntity; `entity-schema.md` |
| L2-3  | ✓ DONE | `App.jsx` handleAccountEnter validates buildUserPersona before persona registration. Errors surface as banner in `Account.jsx`. Test: `tests/l2-3-onboarding-gate.mjs` (7 cases). CI: `npm run test:l2-3-gate` step. |
| L2-4  | ✓ DONE | `tests/dynamic-onboarding.mjs` — 12/12 PASS; wired npm + CI |
| L2-7  | ✓ DONE | App.jsx persona localStorage persistence; Mr T variants survive reload |
| (TO-7)| ✓ DONE | `businessTotal` walker — Tony Stark business equity now visible to NW |
| (NW bug fix) | ✓ DONE | Legacy fast-path now respects ownershipShare + sums all asset classes |

## Outstanding (4 of 9)

| ID    | What                                          | Effort | Notes |
|-------|-----------------------------------------------|--------|-------|
| L2-5  | Onboarding save-and-continue-later          | M | New migration 016_onboarding_progress.sql + Supabase upsert per step. NB: 015 is now `finio_content` (L3-5). |
| L2-6  | DataCapture entity persistence              | M | Today commits dispatch onCommit but don't write entity diff to finio_events. L2-3 gate should also be applied at DataCapture commit path (mirror App.jsx pattern). |
| L2-8  | Migrate 12 mrT fixtures to UI-renderable shape | L | Lift `individual.{name,dob}` → root per mrT-core template, 12 JSON files |
| L2-9  | Two-schema engine collapse (LEGACY FLAT → NEW NESTED) | L | Route flat reads through normaliser, add deprecation warnings, eventually delete fast-path |

---

## Suggested resumption order

L2-6 (M, mirror L2-3 gate to DataCapture commit path) → L2-5 (M, save-progress) → L2-8 (L, fixture refit) → L2-9 (L, heaviest)

**Last updated:** 2026-05-28 (L2-3 closed with full DoD evidence string)
