# W5-5c — Open Banking vendor spike + decision

Title: Open Banking / account-aggregation vendor decision
Version: 1.0
Date: 2026-06-12
Status: OPEN — needs founder decision + commercial contract
Cluster: 5-Data-capture
Purpose: pick the aggregation vendor so the "Connect bank / broker" channel can move from placeholder to build.

**Summary:** Compares TrueLayer vs Yapily vs Salt Edge for UK Open Banking + investment aggregation; recommends a path; the build is contract-gated (no code until keys + DPA exist).
**Tags:** #data-capture #open-banking #vendor #external-gated
**Updated:** 2026-06-12

---

## Why this is a doc, not code

The "Connect bank / broker" tile in `DataCapture.jsx` is a Phase-2 placeholder.
Building it requires a **regulated commercial relationship** (the aggregator is
the AISP under FCA PSD2; Sonuswealth consumes their API), production client
credentials, a signed DPA, and a redirect/consent flow registered with the
vendor. None of that can be written ahead of the contract — so this wave
deliverable is the decision input, not a half-built integration that would sit
dead (CLAUDE.md §9 CTA-honesty).

## Options

| | TrueLayer | Yapily | Salt Edge |
|---|---|---|---|
| Model | Regulated AISP (you ride their licence) | "Infrastructure" — you can be the AISP or ride theirs | Regulated + white-label |
| UK bank coverage | Excellent (strongest UK retail) | Excellent | Good, broader EU/global |
| Investment/pension data | Limited (mostly current/savings) | Limited | Limited |
| Pricing | Per-connected-user / per-call tiers | Per-call, dev-friendly free tier | Per-connection |
| Data residency | UK/EU | UK/EU | EU + global |
| Onboarding friction | Sandbox fast; prod needs commercials | Sandbox fast; flexible licence | Heavier compliance onboarding |
| Best when | Consumer UK retail aggregation, fastest UK go-live | You want to grow into your own AISP licence | You need EU/India/global breadth |

## The hard truth on scope

Open Banking covers **bank + card balances and transactions**. It does **NOT**
cover the assets that dominate a Sonuswealth net worth — SIPPs, ISAs, GIAs,
DB pensions, property, business equity. Those need:
- broker/platform APIs (often bespoke, e.g. interactive investor, HL — limited/no public API),
- pension dashboards (the UK Pensions Dashboards Programme — still rolling out, connection date TBD),
- or continued manual / document capture (W5-5a + 5b).

So OB is a **convenience layer for the cash slice**, not the primary capture
path. Sequencing it after document parsing (5b) is correct.

## Recommendation

1. **Default to TrueLayer** for the first UK build — strongest retail coverage,
   fastest path to a working cash-account connect, you ride their AISP licence
   (no FCA authorisation needed on day one).
2. **Scope it narrowly**: cash + card balances/transactions only. Set the
   product copy so users don't expect it to pull pensions/investments — those
   stay on document capture until platform APIs / Pensions Dashboards mature.
3. **Defer the build** until: (a) founder signs commercials + DPA, (b) prod
   client credentials issued, (c) a consent/redirect UX is designed. Track the
   Pensions Dashboards Programme separately — it's the real unlock for the
   pension slice and is regulator-driven, not vendor-driven.

## Build checklist (post-contract, do NOT start before)

- [ ] Store client secret in Supabase function secrets (never repo/vault).
- [ ] `connect-bank` edge function: initiate consent → handle redirect → exchange code.
- [ ] Map vendor account/transaction payload → `ASSET_VALUE_UPDATED { category:'cash' }` events (reuse the existing reducer route).
- [ ] Consent expiry + re-auth UX (OB consents lapse every 90 days).
- [ ] FP-5 provenance: source='feed', confidence=1.0 for confirmed balances.
- [ ] §9.5 tie-out: connected balance → NW moves by that amount.

## Decision needed from founder

- Approve TrueLayer (or override)? 
- Approve the narrow cash-only scope for v1?
- Greenlight commercials so the build can be scheduled?
