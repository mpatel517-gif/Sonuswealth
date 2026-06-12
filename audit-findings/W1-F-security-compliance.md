# W1-F — Security / Privacy + FCA Compliance Audit

Title: W1-F security-privacy + FCA advice-boundary audit
Version: 1.0
Date: 2026-06-11
Status: DOCUMENTED
Cluster: 4-Operations (due diligence, whole-app review Wave 1)
File name: audit-findings/W1-F-security-compliance.md
Purpose: Static security/privacy sweep + formal FCA advice-boundary pass (clears T12 debt where marked PASS)

**Summary:** One CRITICAL (production Supabase service_role key on PUBLIC GitHub), two HIGH, four MEDIUM, plus a formal FCA pass list. No XSS surface, npm audit clean, no live Anthropic key anywhere in repo or history.
**Tags:** #security #compliance #fca #audit
**Updated:** 2026-06-11

Method: static analysis only. `npm audit` run locally. One GitHub metadata call (`gh repo view`) to confirm repo visibility — no calls to production Supabase.

---

## SEVERITY SUMMARY

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 1 | F-600 |
| HIGH | 2 | F-601, F-611 |
| MEDIUM | 4 | F-602, F-604, F-606, F-608 |
| LOW | 4 | F-609, F-612, F-613, F-614 |
| INFO / PASS | 6 | F-615…F-620 |

---

## JOB 1 — SECRETS SWEEP

### F-600 · CRITICAL · Production Supabase **service_role** key committed to a PUBLIC GitHub repo
The repo `origin` is `https://github.com/mpatel517-gif/Sonuswealth.git` and `gh repo view` confirms **visibility: PUBLIC**. Three git-tracked files hardcode the same service_role JWT:

- `scripts/sync-macro-data.js:8`
- `scripts/test-persona-snapshots-updated.mjs:16`
- `tests/harness/run-automated-harness.mjs:18`

The JWT payload decodes to `role: service_role`, project ref `yknnfglfbpcyxcllrvmd`, **exp 2090** (effectively never expires). That ref matches the production Supabase URL baked into `dist/assets/index-B0TqoACy.js` — this is the live project. A service_role key **bypasses Row Level Security entirely**: anyone who finds it on GitHub can read, modify, or delete every row in every table (entities, events, net-worth history, personas) and call any RPC. It is also in git history (commits incl. `e872a29`, `39f4eff`), so deleting the lines does not remove exposure.

**Remediation (in order, today):**
1. Rotate the service_role key in the Supabase dashboard (Settings → API → roll JWT secret / new secret keys). Rotation invalidates every copy in history — do this FIRST; it makes history-scrubbing optional.
2. Make the repo private (or accept that the whole codebase + fixtures are public — see F-602).
3. Replace the literals with `process.env.SUPABASE_SERVICE_ROLE_KEY` in all three scripts (OS env var per founder security posture, no .env).
4. Check Supabase auth/db logs for unfamiliar access since first push.
5. Add a pre-commit secret scan (gitleaks or the existing CI grep extended to `eyJ` + service_role) — the CI gate at `.github/workflows/ci.yml:162` only scans `dist/`, which is why these survived.

### F-601 · HIGH · DeepSeek API keys committed + public
Git-tracked, on public GitHub, and in history (commits `bcade42`, `1c77647`):
- `test-deepseek.ps1:2` and `start-with-deepseek.bat:8` — `sk-***DEEPSEEK-KEY-2-REDACTED***…`
- `ds.bat:6` and `hermes-ds.bat:11` — `sk-***DEEPSEEK-KEY-1-REDACTED***…`

`.gitignore` already admits the problem ("Scripts with hardcoded API keys — MUST refactor to env var + rotate key") but only ignores `deepseek-direct.mjs` — the four files above were left tracked. Rotate both DeepSeek keys, switch the scripts to `$env:DEEPSEEK_API_KEY`, untrack the .bat/.ps1 launchers.

### F-602 · MEDIUM · Entire codebase + product IP is public
Independent of keys: the public repo exposes the full engine (tax logic, decision engine, knowledge graph plays), persona fixtures, internal audit docs (`MASTER-AUDIT-PLAN.md`, handover notes), and the production Supabase project URL. If this is unintentional, flip to private when rotating F-600.

### Secrets sweep — PASS items
- **No live Anthropic key** anywhere in working tree or full git history. `git log --all -p -S "sk-ant-api03"` yields only the placeholder `sk-ant-api03-YOUR-KEY-HERE` (env.template, docs). The historical retirewise leak (memory `project_api_key_rotation_needed`) is not present in THIS repo's history.
- `.gitignore` covers `.env`, `.env.*`, `*.env`; `.env.local` exists on disk and is NOT tracked. `git log --diff-filter=A` shows only `env.template` ever added (no real env file ever committed).
- Client Supabase config correctly uses `import.meta.env.VITE_SUPABASE_URL/ANON_KEY` (`src/lib/supabase.js:18-19`); anon key in the bundle is by-design safe (RLS).
- CI has a dist-level secrets-scan gate (`ci.yml:154-166`) — good, but extend to source + `eyJ` patterns per F-600.5.

---

## JOB 2 — DEPENDENCIES

### F-615 · PASS · npm audit clean
`npm audit`: **0 vulnerabilities** (info/low/moderate/high/critical all 0). Runtime deps are minimal and healthy: `@supabase/supabase-js ^2.106`, `react ^19.2.4`, `react-dom ^19.2.4`. Dev deps current (vite 8, eslint 9). No abandoned or known-risky packages. `playwright ^1.48` is a year stale but dev-only; bump opportunistically.

---

## JOB 3 — CLIENT-SIDE DATA EXPOSURE

### F-604 · MEDIUM · Plaintext financial data + auth tokens in localStorage
On a shared or compromised machine (founder's threat model: compromised twice), any process can read:

| Key / writer | Contents |
|---|---|
| Supabase session (`persistSession: true`, supabase.js:72) | **access + refresh JWTs — theft = account takeover until expiry** |
| `sonuswealth.te.snapshot.{entityId}` (TaxEstate.jsx:189) | full tax & estate snapshot (income, IHT exposure, allowances) |
| `sw_onboarding_progress` (Onboarding.jsx:415) | complete intake answers (income, assets, family) |
| tax-history (state/tax-history.js:48) | multi-year tax computations |
| report-snapshots, drillMemory, Dashboard TY store, de/persistence + learning-log, scenario JSON via safe-storage | financial positions, decisions explored, what-if history |

None of this is encrypted at rest (localStorage never is). Mitigations to consider: keep session in memory + refresh-token-only persistence, encrypt app snapshots with a key derived from the session, clear `sw_*` keys on signOut (verify signOut currently leaves the financial snapshots behind — it does), and document residual risk. Severity MEDIUM not HIGH because demo personas are fixtures and real-user rollout hasn't happened; raise to HIGH at launch.

### F-616 · PASS / INFO · External network calls — complete inventory
The app speaks to exactly these endpoints (grep of fetch/axios/WebSocket/sendBeacon — axios not used):
1. **Supabase** (auth + REST, anon key, RLS) — `src/lib/supabase.js`.
2. **`{SUPABASE_URL}/functions/v1/ask-sonu-proxy`** — Ask.jsx:995, llm-router.js:402, de/tree-generator.js:41. All three require a Supabase session JWT (`Authorization: Bearer`); no client-side Anthropic key (L1-1 done properly). Proxy enforces JWT + origin-allowlist CORS (`supabase/functions/ask-sonu-proxy/index.ts`).
3. **`/api/parse`** (anthropic-vision.js) — explicitly NOT WIRED; documented contract only.
4. **Content-pull URL** (useContent.js:86) — GET-only copy bundle, cached in sessionStorage.
5. **`api.anthropic.com` direct from browser** — ONLY in the legacy prototype `retirewise_v9_step2_v8.html` (see F-606), not in `src/`.

### Ask-Sonu LLM payload — precise documentation (llm-router.js `summarisePersona`, lines 44-81)
What leaves the device to the proxy (and on to Anthropic): the **user's free-text query**, prior clarification answers (`knownFacts`), tax-year-state summary, lens summaries, play menu, plus these persona fields: **age** (or derived from dob), **marital status**, **work status**, **annual income £**, **pension total £**, **ISA total £**, **GIA/investments £**, **home value £**, **cash £**, **dependents count + ages**, **jurisdiction**. NOT sent: name, email, addresses, account numbers, holding/provider names, transaction data. This is a deliberately compact aggregate summary — good. Residual notes: (a) the free-text query itself can contain anything the user types; (b) Ask.jsx:1002 `buildSystemPrompt(entity, currentTab)` is a second payload path — same class of aggregates, keep both in sync with any future privacy notice; (c) dependents' ages are technically children's data — fine under legitimate interest but mention in the privacy policy.

### F-606 · MEDIUM · Legacy prototype ships a direct-to-Anthropic key input
`retirewise_v9_step2_v8.html` (tracked, public per F-602) takes a pasted `sk-ant-…` key (line 1373) and calls `api.anthropic.com` from the browser (line 2441). It's the same pattern that produced the historical key leak. Delete the file from the repo (it's a pre-Sonuswealth prototype, not part of the build).

---

## JOB 4 — XSS SURFACE

### F-617 · PASS · No XSS sinks found
- `dangerouslySetInnerHTML`: **0 occurrences** in `src/`.
- `.innerHTML =`, `insertAdjacentHTML`, `document.write`: **0 occurrences** in `src/`.
- `eval(` / `new Function(`: **0 occurrences** in `src/`.
- User-entered strings (asset names, labels, Ask queries) render exclusively through JSX text nodes → React auto-escaping applies everywhere. Clean pass.

---

## JOB 5 — AUTH POSTURE

Architecture (auth.js / state/auth.jsx / step-up.js) is sound for v0: normalised error handling, email verification surfaced, TOTP MFA + AAL2 plumbing present, step-up modal coalescing, 5-min elevation window, OAuth redirect uses `window.location.origin`.

### F-608 · MEDIUM · Step-up auth fails OPEN
`src/lib/step-up.js:80-83`: if `StepUpProvider` isn't mounted, `requireStepUp` resolves `{ ok: true }` ("test/SSR safety"). Any future refactor that renders a sensitive commit path outside the provider silently loses the step-up gate, and nothing alerts. Also `verifyPassword` (line 124) re-runs `signInWithPassword` — it works, but it mints a fresh session as a side effect and is an online password oracle (mitigated by Supabase rate limits). Recommend: fail CLOSED outside demo (`if (!_openModal && !isDemo) return { ok:false }`), and log a console.error on the fail-open branch so tests still pass but misuse is visible.

### F-609 · LOW · Demo mode separation — acceptable, with one design note
`?demo=X` (App.jsx:255-291) bypasses the auth gate into the full app. Containment is real: demo resolves only fixture personas from `ENTITIES` (unknown ids get an error panel, App.jsx:231), `event-store.js` no-ops without an authed user→entity mapping (`currentEntityId()` returns null), and `llm-router`/`tree-generator`/Ask all hard-require a session JWT before any proxy call — so demo users cannot spend Anthropic money or write to Supabase. Demo cannot "leak into" an authed session's data: `isDemoMode` short-circuits persona resolution to the URL param, and authed flow requires `auth.isAuthenticated`. Residual: the demo bypass ships unconditionally in production builds (no `import.meta.env.PROD` guard), so anyone can explore the full product with fixtures via URL param — fine for a founder-demo phase, revisit at launch (it also exposes every route to scraping/teardown).

---

## JOB 6 — FCA ADVICE-BOUNDARY SWEEP

Codebase shows systematic, engineered boundary discipline — this is the strongest part of the audit. PASS list first, then flags.

### PASS surfaces (formal compliance pass — clears T12 where listed)
| Surface | Evidence |
|---|---|
| Canonical disclaimer string | `src/config/brand.js:29` — "Information and guidance only. Not personal advice. Verify decisions with a qualified FCA-authorised adviser before acting." |
| Home (Dashboard) | `FCADisclaimerFooter` rendered (Dashboard.jsx:915); HomeScreen.jsx:2308 boundary line |
| MyMoney | BRAND.disclaimer ×2 (MyMoney.jsx:2802, 4598) |
| Cashflow | BRAND.disclaimer footer (Cashflow.jsx:2032) + per-solver disclaimers (1293, 4346, 5911) |
| Tax & Estate | BRAND.disclaimer (TaxEstate.jsx:4249) + SA computation always-visible disclaimer (SAComputationView.jsx:215-220) |
| Risk | BRAND.disclaimer (Risk.jsx:2253) + inline "General information, not personal advice" (1949) |
| Timeline | boundary footer (Timeline.jsx:2998) |
| Settings | BRAND.disclaimer (Settings.jsx:662) |
| Welcome | boundary line (Welcome.jsx:232) |
| Ask (chat) | disclaimer at input (Ask.jsx:1132) + **output rewrite map** ("you should"→"one option is to", Ask.jsx:90-91) + system-prompt prohibition (Ask.jsx:264) |
| AskSonuFlow | FCA disclaimer (746) |
| Decision Engine v1 | FCA_BOUNDARY const (DecisionEngine.jsx:37) + export boundary line (1551) |
| Decision Engine v2 | covered via DecisionTree footer (components/DecisionTree/index.jsx:426-431) |
| DE pipeline | dedicated `src/de/fca-rewrite.js` regex pass + composer rule (composer.js:395,406) + follow-up disclaimer (follow-up.js:135) |
| Solver/engine outputs | FCA_DISCLAIMER attached to results: decumulation-solver.js:31, decumulation-sequence.js:232, scenario-engine.js:316/361, sa-computation.js:58 |
| Reports | deterministicNarrative.js:4 ("you could consider" max); ReportsViewer footer (186) |
| MoneyIncome / MoneyTrusts | footer boundary lines (MoneyIncome.jsx:655/860, MoneyTrusts.jsx:456) |
| WhatYouCanDo component | explicit "No 'you should buy/sell/transfer'" contract (WhatYouCanDo.jsx:12) |
| Performance promises | NONE found. Every "guaranteed" hit is product mechanics (DB pensions/annuities genuinely guarantee income) with risk caveats, not return promises. No "will grow", no urgency-pressure copy. |
| Product/provider steering | None found; no broker links, no named-provider recommendations (consistent with info-not-sales memory). |

### F-611 · HIGH · Ask Sonu's personalised "lead play" is recommendation-shaped — get counsel sign-off before launch
Structural, not copy. The synthesizer (`src/engine/ask-sonu/synthesizer.js:7` "Sonu's call") and llm-router pick ONE lead play **for this specific user using their actual financial data**, and the play library carries imperative steps: knowledge-graph.js:596 "Sell £20k from GIA, re-buy inside ISA"; play-actions.js:115 "Sell the lot, immediately re-buy inside ISA…"; play-actions.js:20 "Open a SIPP for them…". A personal recommendation = advice on a specific course of action presented as suitable for the person, based on their circumstances (PERG 8.30A / Art. 53 RAO) — disclaimers do not undo that test, and several plays touch RETAIL INVESTMENT PRODUCTS (SIPP, ISA wrapper moves). Mitigations already in place are real (rewrite maps, challenge paths, no product/provider names, "one option" framing at render), but the lead-play selection mechanic itself is the thing a regulator would probe. Given the boundary is existential: (1) route the KG `one_liner`/action-step strings through fca-rewrite (currently the DE pipeline has it; the Ask-Sonu play strings render verbatim), (2) reframe steps as conditional mechanics ("Selling GIA units and re-buying inside an ISA makes future growth tax-free") rather than imperatives, (3) have FCA counsel review the Ask Sonu flow end-to-end before real users. The MANDATORY independent-calc-audit gate (memory) should add this as a compliance line item.

### F-612 · LOW · Copy nits (fix in a sweep)
- `StatePensionPanel.jsx:135` "you should reach the maximum entitlement of …" → "you would reach" (avoid outcome-assurance phrasing).
- `persona-d.json:272` / `persona-f.json:191` "exactly where you should be" — fixture copy that renders in-product; rephrase ("in line with the typical benchmark at 28").
- `decision-content.js:476` immediate_exit option "Leave the UK this year." + goodIf "You must move now…" — imperative inside an options grid; soften to descriptive.

### F-613 · LOW · Disclaimer coverage gap — MoneyBusiness
`MoneyBusiness.jsx` has one sub-card footer ("Information only — not advice", line 297) but no screen-level FCADisclaimerFooter/BRAND.disclaimer, unlike every sibling screen. One-line fix. (Onboarding also has none, but it collects rather than recommends — acceptable.)

### F-614 · LOW · AppShell exists but only Dashboard uses it
`components/Shell/AppShell.jsx` centralises the disclaimer (`showDisclaimer=true` default) but only Dashboard imports it; every other screen hand-rolls the footer. Works today (coverage verified above) but each new screen re-creates F-613 risk. Migrate screens onto AppShell or add a lint/test asserting BRAND.disclaimer renders per route.

---

## TOP REMEDIATION ORDER
1. **F-600 today:** rotate Supabase service_role key; make repo private; env-var the 3 scripts; check access logs.
2. **F-601 today:** rotate both DeepSeek keys; untrack the 4 launcher scripts.
3. **F-611 pre-launch:** FCA counsel review of Ask Sonu lead-play mechanic; route KG strings through fca-rewrite.
4. F-606 delete retirewise prototype; F-608 fail-closed step-up; F-604 localStorage hardening + signOut purge; F-613/612 copy sweep.
