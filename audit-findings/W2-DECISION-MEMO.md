# W2 — Whole-App Audit: Triage + Decision Memo

**Date:** 2026-06-11 · **For:** founder sign-off before build waves · **Source:** 7 audit lanes (W1-A…G), ~150 findings on disk in `audit-findings/W1-*.md`
**Branch:** claude/ecstatic-curie-dj2UH

---

## Verdict in one line

The app's **surface is rich and the engine is sophisticated, but the same number is computed by 2–3 different code paths that disagree** — and captured data often never reaches the engine. The UI is ahead of its data integrity. Almost every "numbers don't match" you've caught by eye is one disease with many symptoms.

## THE meta-finding (the spine of W3)

**One concept → many code paths → contradictory outputs.** Every lane hit instances:

| Concept | Disagreement | Refs |
|---|---|---|
| Monthly surplus | +£464 vs −£900/mo (mrT); Home "crisis" vs "on-track" vs "first lever" for same £900 | F-500, F-200, F-207 |
| Net worth | £1.75m vs £1.02m (two engines) | F-501 |
| IHT | £430k vs £287k; RNRB shows £0 / £175k / £115k on one persona | F-502, F-309, F-311 |
| Tax constants | **33 of 81 `TAX.*` keys never resolve from the bundle** (`cgt.basicRate` vs real `capitalGains.basicRate`, BPR cap, gift exemptions, NIC, £100k cliff) → silently hardcoded → **the RULES year-switcher is partly fake** | F-518, F-115, F-322 |
| Pension contributions | read from 5+ fields; £0 on Tax/AA, £11k on Cashflow, same persona | F-004, F-107, F-305, F-207 |
| Debt service | £1k/mo shown vs £2,907/mo true (snake_case key unread) | F-102 |
| Captured data → engine | DataCapture manual Add **does nothing** (dead reducer); sole-trader £67k income unread; UI £25k vs taxed £67k | F-413, F-521, F-522 |
| Ask Sonu | loads a **different profile per mode**; fed the opposite engine from screens | F-434, F-500 |

**Root cause is structural, not 150 separate bugs:** no canonical readers. The fix that collapses ~60% of findings = **consolidate each concept to ONE reader** (surplus, net worth, contributions, essentials, allowance-tracker, the bundle key-map), exactly like the asset/liability taxonomy modules already do.

## P0 — must fix first (credibility / safety / data-loss)

1. **F-600/601 SECURITY** — production Supabase service_role key + DeepSeek keys were public. **Scrubbed from HEAD (`b881637`); ROTATION IS YOURS and still pending** (Supabase dashboard + DeepSeek console + repo→private).
2. **F-413 DataCapture is dead-wired** — the only live capture channel commits an event the reducer ignores; users type real figures, nothing saves, no error. + **F-419** every Add is lost on reload with no warning.
3. **F-518 bundle key-map** — 33 tax constants frozen regardless of tax year; fix the loader keys (data is correct, reader keys are wrong).
4. **Canonical-reader consolidation** — surplus / net-worth / IHT / pension-contributions / essentials (kills F-500/501/502/102/116/207/305…).
5. **F-312 / F-114 / F-310 tax-accuracy bugs** — £3k gift shows £960 IHT (should be £0); BPR relief £290k > £182k total assets; IHT-after-moves stuck at £0.

## P1 — FCA boundary (existential, pre-launch)

- **F-611 / F-427-429 / F-405 / F-436** — Ask Sonu gives a single personalised recommendation with imperative wording, picks the wrong-domain play (Bed-and-ISA "for IHT"; drawdown advice to a 35-year-old), shows **fabricated legal citations** ("FA 1996 s.156 spousal ISA" — ISAs began 1999), and onboarding promises to "recommend portfolios." Disclaimers don't cure the Art. 53 personal-recommendation test. Needs option-framing rewrite + citation audit + **your legal sign-off**.
- **F-410** password forwarded into the persona entity object.

## P2/P3 — plain English, dead UI, polish (W4/W7)
~90 findings: raw metric keys at surface (`cashflow_30yr`, `iht_year25`), internal "Spec §" leaks in onboarding, "STEP 1000 OF 11" counter, hide-balances toggle dead-wired (F-421), report statement columns showing duplicated/`"proj."` data, 92 icon buttons without aria-labels, iOS scroll-trap overlays, privacy/terms unreachable, no error tracking (launch-blind), no code-splitting (3.4MB first load). All catalogued with file:line.

---

## Decisions I need from you (blocking W3+)

1. **Key rotation** — confirm when done (P0, only you can).
2. **Repo visibility** — make `mpatel517-gif/Sonuswealth` **private** until launch? (recommended.)
3. **FCA fix depth now** — soften Ask Sonu to option-framing + fix citations now (engineering), but the **legal sign-off** is external; in scope this round or deferred to a pre-launch gate?
4. **BPR cap** — F-322: bundle says £2.5m, legislation I can date says £1m from Apr 2026. Confirm the figure or I web-verify before trusting either.
5. **Open banking** (from original plan) — TrueLayer/Yapily or defer to spike-only? (External vendor; never blocks other work.)
6. **Persistence model** — demo-only localStorage now, or wire real Supabase persistence this round? (Gates whether Add survives reload.)

## Proposed build sequence (token-efficient — NO agent fleet)

Lesson from W1: background agents are expensive and die on every session restart (we paid 2–3×). **Build waves run in the main thread, batched, commit-after-each** so work survives restarts and you can watch the diffs.

- **W3a Canonical readers** (the spine — collapses the most findings) → tests + tie-outs.
- **W3b** DataCapture wiring + persistence + reload-warning.
- **W3c** the 4 tax-accuracy bugs + bundle key-map.
- **W4** plain-English layer (rename + `<Term>` tooltips) — the one piece safe to parallelise as a single content agent if you want.
- **W5/W6/W7** data-capture fields, Ask-engine domain-gating + citations, redesign/charts.

Verification stays: `npm run build` + 4 harnesses + the one shared preview server (5173) + accuracy-auditor. No 7-server fleet.
