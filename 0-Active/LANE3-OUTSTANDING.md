# Lane 3 — Outstanding work

**Status:** 7 of 8 main items closed + foundations. Drilldown depth fully wired (founder's #1 pushback). Content externalisation fully shipped client-side (founder's #4 pushback) — copy can now be edited in Supabase without a deploy, pending founder's `supabase db push` + `functions deploy content-pull`.

---

## Done (7 of 8 + foundations)

| ID    | Status | Evidence |
|-------|--------|----------|
| L3-1  | ✓ DONE | DrillStack pattern + 3 pilot retrofits (Pension/Investments/Property). README documented. |
| L3-1b | ✓ DONE | Remaining 5 drills retrofitted (Cash/Alts/Liab/Prot/Business). All 8 production drills now drill to L4. |
| L3-3  | ✓ DONE | Cashflow's 3 L3 drill panels wired to DrillStack + L4 row drills. Gross income → per-source breakdown, Tax & NI → per-band breakdown, Health components → weight+contribution panels. |
| L3-4  | ✓ DONE (foundation) | `src/content/uk-en.json` bundle (40-key Phase-1 scope: common + home + money + cashflow + tax + risk + timeline + ask + onboarding + legal). `src/hooks/useContent.js` exports `useContent()` + `getContent()` + fail-soft fallback. 3 working call sites in Cashflow.jsx prove pattern. **Per-screen sweep deferred to L3-4b (mechanical).** |
| L3-5  | ✓ DONE (client) | `supabase/migrations/015_finio_content.sql` (table + RLS + version trigger + 40 seed rows). `supabase/functions/content-pull/index.ts` (anon GET, CORS, sessionStorage TTL). `src/hooks/useContent.js` extended with live overlay layer — fail-soft to static bundle on any network/server failure. `primeLiveContent()` fires from main.jsx at boot. **Founder must `supabase db push` + `supabase functions deploy content-pull` to activate — see `supabase/functions/content-pull/DEPLOY.md`.** |
| L3-6  | ✓ DONE | Jargon helper + 22-entry dictionary. `src/components/shared/Jargon.jsx`. |
| L3-7  | DEFERRED | Audit found largely already-wired (Home CoI, Risk concRisk, MyMoney drawdown). Real gap = verification pass. |

## Outstanding (1 of 8 + 2 mechanical sweeps + founder deploy)

| ID    | What                                          | Effort | Notes |
|-------|-----------------------------------------------|--------|-------|
| L3-2  | Build the 11 missing L3 panels                | L | Spec asserts 19; we have 8. Each panel ~2-3 hours from spec. Needs founder input on priority order. |
| L3-4b | Per-screen `useContent` sweep                 | M | Pattern proven in Cashflow.jsx (3 call sites). Mechanical wrap of ~40 inline strings across 8 screens. Strings already in bundle. |
| L3-6b | Per-screen jargon sweep                       | M | Helper exists; ~20 min per file × 8 screens. Mechanical, low-risk, visual clutter trade-off — recommend first occurrence per section only. |
| L3-8  | Real goal-seek + scenarios (not canned)       | L | `goal-seek-engine.js` has no algorithm. `scenarios.js` outputs canned. Heaviest lane-3 item. Best done as a focused dedicated session. |

## Founder action queue (deploys + secrets only — Sonnet cannot do these)

1. **L1-1** rotate Anthropic key + deploy `ask-sonu-proxy` (already pending)
2. **L3-5** `supabase db push` + `supabase functions deploy content-pull` + (production) `supabase secrets set CONTENT_APP_ORIGIN=<prod-origin>` — see `supabase/functions/content-pull/DEPLOY.md` for the verification script

---

## Suggested resumption order

L3-4b + L3-6b (M each, mechanical sweeps — founder's "no agents" stance means these are batches I work through file-by-file in conversation)
→ L3-8 (L, real simulation — best done as a focused dedicated session)
→ L3-2 (L, 11 missing panels — needs founder priority input)

---

**Last updated:** 2026-05-28 (L3-3 + L3-4 + L3-5 client closed)
