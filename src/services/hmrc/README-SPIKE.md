# HMRC API import — research spike (M5)

**Status:** SPIKE / no integration code · **Date:** 2026-06-09 · **Owner:** founder + Claude
**Scope guard:** This milestone is **import (read) only** — pulling a user's prior-year figures to seed the tax-history store ([src/state/tax-history.js](../../state/tax-history.js)). **Submission to HMRC is explicitly OUT of scope** and gated behind a separate milestone **plus FCA/compliance + legal review** (founder decision 2026-06-08). Submitting makes Sonuswealth a tax agent — different liability, different authorisation, different product posture.

**Purpose of the spike:** decide go / no-go on automated prior-year import, and if go, the architecture. Until then, prior-year data enters via manual entry + document upload ([PriorYearSAForm](../../components/TaxEstate/PriorYearSAForm.jsx)), which already works.

---

## 1. Which API

Two distinct HMRC product families — pick by what we actually need (read prior-year totals):

| API family | What it exposes | Fit |
|---|---|---|
| **MTD for Income Tax (ITSA)** | Quarterly updates, business income, **End-of-Period Statement / final declaration** retrieval. Becomes mandatory in phases from Apr 2026 (≥£50k) / Apr 2027 (≥£30k). | The strategic long-term source; rich but heavyweight, oriented to *submission* not casual read. |
| **Self Assessment APIs** (incl. *Individual Calculations*, *Self Assessment Accounts*, *Obligations*) | Retrieve tax calculations, liabilities, payments on account, account balance, filing obligations. | **Best fit for read-only prior-year import** — `Self Assessment Account API` returns balances + POA; `Individual Calculations` returns the computed liability per year. |
| **Individual Income / Individual Tax** (older) | PAYE income, NI. | Partial; supplementary. |

**Recommendation for the spike:** evaluate the **Self Assessment Account API** + **Individual Calculations API** first — they directly return the figures the carry-forward ledger + POA base need (prior-year liability, POA made, balances). MTD-ITSA retrieval endpoints are the fallback / future.

---

## 2. Auth — the real blocker

- **OAuth2 user-restricted flow** (authorization code grant). Scopes e.g. `read:self-assessment`. Refresh tokens ~18 months. The user authorises Sonuswealth at HMRC's consent screen, redirected back with a code → exchange for access token.
- **Individual vs agent authorisation:**
  - *Individual* — the taxpayer authorises us to read **their own** data. Simplest. This is the route for the consumer product.
  - *Agent* — we act on behalf of clients (the accountant route). Requires an **HMRC agent services account** + per-client authorisation. **Out of scope** — that's the "we are a tax agent" path tied to submission.
- **Fraud-prevention headers (mandatory, the hard part):** every call must send `Gov-Client-*` / `Gov-Vendor-*` headers (device id, screen, timezone, public IP, user-agent, MAC, etc.). HMRC actively rejects/score-penalises missing or implausible headers. A **pure browser SPA cannot source many of these reliably** (no MAC, IP via the request, etc.) and CORS + secret handling rule out calling HMRC directly from the client.

---

## 3. Architecture implication

A browser-only call is a non-starter (fraud headers + token secrecy + CORS). The integration **must** go through a server component:

- **Supabase Edge Function** on the existing [src/lib/event-store.js](../../lib/event-store.js) / supabase seam: holds the OAuth client secret, performs the token exchange + refresh, assembles the fraud-prevention headers server-side (with the documented `Gov-Client-*` set forwarded from the client where the browser legitimately has them — screen, timezone, user-agent — and server-derived ones for IP), calls HMRC, returns normalised figures.
- Client flow: button "Import from HMRC" → redirect to HMRC consent → callback to edge function → edge function fetches prior-year calc/account → returns figures → pre-fills [PriorYearSAForm](../../components/TaxEstate/PriorYearSAForm.jsx) → user confirms (FP-5 verify) → `upsertPriorYear`. **Same confirm-before-trust contract as upload.**

---

## 4. Sandbox / build path (if go)

1. Register on HMRC **Developer Hub**; create a sandbox application; get client id/secret + redirect URI.
2. Create **sandbox test users** (individual) with seeded SA data.
3. Prove the OAuth round-trip + one `Self Assessment Account` read end-to-end against sandbox, with a minimal fraud-header set, from a throwaway edge function.
4. Validate the fraud-header acceptance (HMRC has a `Test Fraud Prevention Headers` API that scores your headers — use it).
5. Only then design production: token storage (encrypted, per-user, in Supabase), refresh, consent re-prompt, error/lapsed-auth UX.

---

## 5. Go / no-go recommendation

**Provisional: defer to post-launch.** Rationale:
- Manual + upload capture already unblocks the accuracy goal (the figures flow into the ledger + POA today).
- The auth + fraud-header + edge-function build is substantial (weeks), and the durable persistence layer (Supabase) is **currently inert in demo** — HMRC import has no home until real persistence lands.
- It introduces a regulated-adjacent surface (reading official tax data) that wants the same compliance review the submission path needs.

**Trigger to revisit:** once (a) real Supabase persistence is live, and (b) there's user demand for auto-import over manual entry. Then run the 5-step sandbox proof above as a 1-week timeboxed spike before committing.

---

## 6. References to confirm during the spike (do not trust from memory)
- HMRC Developer Hub — API catalogue, the current SA + MTD-ITSA endpoint list and versions.
- `Create Test User` + `Test Fraud Prevention Headers` APIs.
- The current mandatory `Gov-Client-*` / `Gov-Vendor-*` header spec (it changes; verify live).
- MTD-ITSA mandation timeline (≥£50k Apr 2026, ≥£30k Apr 2027, lower bands TBC) — confirm current thresholds against [rules-uk] before citing to users.
