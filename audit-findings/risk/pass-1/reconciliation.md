# Risk Screen — Pass-1 Reconciliation Audit (A6)

**Auditor:** reconciliation-auditor (3 of 5)
**Screen:** Risk (`src/screens/Risk.jsx` + `src/screens/RiskOverlay.jsx` + `src/components/Risk/*`)
**Engine:** `src/engine/fq-calculator.js` (`calcRisk`, `riskBand`, `calcFQ`, `netWorth`, `fmt`, `riskShockSuite`, `calcRiskHistory`, `whatWouldHelpMost`, `calcAPQ`, `planFor`, `lifeEventPaths`, `financialProfile`) + `src/engine/modules/uk-risk-2026-1-1.js`
**Method:** A6 walk per inventory v1 + skill v1.4 §2.7 (canonical CoI inapplicable on Risk).
**FD-RK-1 correction acknowledged:** Risk engine's 7 dims (incomeRes · liquidity · protCov · debtVuln · concRisk · depExp · behaviouralTrack) do NOT reconcile to Home radar's 7 dims (Habits · Own · Tax · Safety · Flow · Debt · Legacy — from `calcFQ`). Only the **overall** Risk Score reconciles cross-screen.
**Date:** 2026-05-18

---

## 1. Reconciliation matrix — shared metrics (Risk × other screens)

| Metric | Engine fn | Risk full page | Risk overlay | Home | Verdict |
|---|---|---|---|---|---|
| **Overall Risk Score** | `calcRisk(e).total` | `RK-ANCH-01b` ring centre: `<Num format="score">` → **bare `78`** | `RK-OVL-03` header: `<Num format="score" />` + `<span>/100</span>` → **`78/100`**. Plus duplicate ring `RK-Z1-01` again as bare **`78`** | `H-ANCH-03` (`HomeScreen.jsx:370–373`): `<span>{riskScore}<span style="...">/100</span></span>` → **`78/100`** | **FAIL** — value PASS, format **DRIFT** across surfaces |
| **Wealth Score (secondary)** | `calcFQ(e).total` | `RK-ANCH-05` "Health score" tile (labelled differently!) — value via `SecondaryTile` raw int | `RK-OVL-04` header inline: `<Num format="score" />` + "Wealth NN" prefix | `H-ANCH-02` (`HomeScreen.jsx:331–349`): `{score}<span>/100</span>` — **`78/100`** with band name | **FAIL** — label drift ("Health score" on Risk vs "Wealth Score" on Home/overlay); format drift (Risk tile shows bare int, Home shows `N/100`) |
| **Net Worth** | `netWorth(e)` then `fmt()` | `RK-ANCH-06` `SecondaryTile value={fmt(nw)}` → `£3.63m` | not shown in header | `H-ANCH-01` (`HomeScreen.jsx:314`): `{fmt(nw)}` → `£3.63m` | **PASS** value+fmt — both call `fmt()`. (Home audit previously flagged £3.63m vs £3.63M elsewhere on Home; Risk does NOT reproduce that drift.) |
| **Risk band name** | `risk.band.name` (`riskBand(total).name`) | `RK-ANCH-01b` ring centre + `RK-ANCH-01c` eyebrow "Safety score · primary" | `RK-OVL-05` band under score | `H-ANCH-03` `riskBand` text (line 384) | **FAIL** — **three different framings of the same dimension** on Risk full page alone: "Safety score" (eyebrow) · "Risk Score" (ring label) · band name uses resilience vocabulary (`vulnerable/cautious/managed/protected/resilient`). Three names, one number. |
| **Topbar score chip (RK-CHR-09)** | n/a | **NOT RENDERED** — Dashboard.jsx has no topbar | n/a | n/a | **NA / FAIL by absence** — inventory expects a topbar score chip reconciling Wealth Score + sparkline; Dashboard.jsx contains no topbar. UNLISTED-by-absence finding. |

---

## 2. Within-Risk reconciliation — same number twice on same surface

| ID | Locations | Engine fn | Finding | Verdict |
|---|---|---|---|---|
| RK-OVL-03 vs RK-Z1-01 | Overlay sticky header score AND Z1 ring card below | `calcRisk(e).total` | `RiskOverlay.jsx:157` passes `<RiskBody entity={entity} />` with NO `suppressPrimaryRing` flag → Z1 ring renders alongside header. **Risk Score is rendered TWICE on the overlay, in two different formats: header "78/100" vs ring "78"**. | **FAIL — A6 value PASS, format FAIL + visual duplication** |
| RK-ANCH-01b vs RK-ANCH-01c eyebrow | Ring centre says "Risk Score"; eyebrow above says "Safety score · primary" | n/a | Same anchor, two labels for the same metric. | **FAIL A5/A6** — see S-02 |
| RK-ANCH-05 ↔ everywhere else | Wealth Score value tile labelled "Health score" only on Risk | `calcFQ(e).total` | Every other surface (Home, MyMoney, RK-OVL-04, `calcFQ` band names "foundation/building/established/optimised/exceptional") calls this metric "Wealth Score". Risk full page anchor calls it "Health score". | **FAIL A5/A6** — see S-01 |

---

## 3. A6 verdict table (keyed by element ID)

| ID | A6 | Severity | Finding | Evidence | Engine fn |
|---|---|---|---|---|---|
| RK-CHR-09 | FAIL | POLISH | Topbar score chip referenced in inventory not rendered by Dashboard | `Dashboard.jsx` — no `topbar/TopBar/Sparkline` matches | n/a |
| RK-ANCH-01 (ring score) | PASS-value / FAIL-format | DEMO-BLOCKING | Bare integer (`78`) on full page, `78/100` on overlay header, `78/100` on Home. Same engine call, three formats across the three surfaces the user sees most. | `Risk.jsx:160–163` `<Num format="score">` (bare); `RiskOverlay.jsx:80–86` `<Num/>` + `<span>/100</span>`; `HomeScreen.jsx:371–373` `{riskScore}<span>/100</span>` | `calcRisk(e).total` |
| RK-ANCH-01a (ring animation) | PASS | — | Final value = `score` prop = `risk.total`. Animation does not alter final number. | `Risk.jsx:131–176` | `calcRisk(e).total` |
| RK-ANCH-01b (ring centre text) | FAIL | FUNCTIONAL | Label "Risk Score" + "/100" missing in centre — engine total rendered as bare number. Visual reads as "78 / vulnerable / Risk Score" rather than "78/100 · vulnerable". | `Risk.jsx:153–173` | `calcRisk(e).total` |
| RK-ANCH-01c (eyebrow "Safety score · primary") | FAIL | FUNCTIONAL | A5/A6 — Same anchor uses three names for the same metric (Safety score · Risk Score · resilience-band names). | `Risk.jsx:1512–1514` | `calcRisk` |
| RK-ANCH-02 (ConfBadge) | PASS | — | Value derives from `risk.confidenceLevel \|\| 'low'`. No reconciliation conflict; chip is qualitative. | `Risk.jsx:179–187`, `:1520` | `calcRisk(e).confidenceLevel` |
| RK-ANCH-03 (SetbackChip) | PASS | — | Derived live from `calcRiskHistory(entity,'1mo').points`; not hardcoded. | `Risk.jsx:190–208` | `calcRiskHistory` |
| RK-ANCH-04 (HOME-2 chip) | PASS | — | Same explainer ID as Home; copy lives in `ExplainerChip` registry not in Risk.jsx (not verified here). | `Risk.jsx:1522` | n/a |
| RK-ANCH-05 (Wealth Score "Health score" tile) | FAIL | FUNCTIONAL | A5/A6 — label drift (S-01). Same metric labelled "Wealth Score" everywhere else. Also format drift — `SecondaryTile` renders `fq.total` as a bare integer; Home renders `78/100`. | `Risk.jsx:1534–1539`, `:1552–1596` | `calcFQ(e).total` |
| RK-ANCH-06 (Net Worth "You own" tile) | PASS | — | `fmt(nw)` matches `fmt(netWorth(e))` on Home (`HomeScreen.jsx:314`). | `Risk.jsx:1540–1545` + `:1583` | `netWorth(e)` |
| RK-Z1-01 (Z1 ring card, overlay) | FAIL | FUNCTIONAL→POLISH | Renders in overlay AND duplicates header score. `RiskOverlay.jsx:157` does NOT pass `suppressPrimaryRing`. Score rendered twice per overlay open. | `RiskOverlay.jsx:157`; `Risk.jsx:1356–1372` | `calcRisk` |
| RK-Z2-02 (active cell highlight) | PASS | — | `mapFqBand(fq.band.name) × mapRiskBand(risk.band.name)` — derives bands directly from engine, no hardcoded enum mapping. | `Risk.jsx:69–70` + `:1382–1386` | `calcFQ`, `calcRisk` |
| RK-Z3-01..07 (7-dim scores) | PASS — within-Risk only | — | Each dim renders `risk.dims[d.key]`; values consistent across radar/orbit/bars views and DimSheet. **Per FD-RK-1 these do NOT reconcile to Home's radar** — that's the model, not a drift. | `Risk.jsx:73–81`, `:269–317`, `:324–380`, `:794–848` | `calcRisk(e).dims` |
| RK-Z3-07 (D7 Behavioural Track) | PASS | — | CRIT 1.3 special-case fires when `score === 0` → "Building track record — needs 90 days" in neutral grey (not red 0/7). Does NOT bypass non-zero engine output. | `Risk.jsx:274–317` | `calcRisk(e).dims.behaviouralTrack` |
| RK-Z3-O1 (orbit composite) | PASS | — | HIGH 1.4 fix verified — centre now shows `total` (sum of 7 dims, ~78) with label "COMPOSITE · sum of 7 dims" instead of duplicating `78/100`. | `Risk.jsx:495–505` | sum(dims) |
| RK-DS-01..03 (DimSheet body, D6 sub-chips) | PASS | — | Sub-scores derived live from `entity.willStatus / lpaStatus / nominationsStatus / dependants / protection.lifeInsurance.{exists,inTrust} / guardianStatus`. No hardcoded score figures. Buckets (6/3/0) live in `d6SubScores` per spec. | `Risk.jsx:102–128`, `:746–792` | local derivation from `entity` |
| RK-D6-* (questionnaire) | NA | — | Form input — no engine number to reconcile. Note: code comment explicitly states engine consumption of `risk_questionnaire_committed` is deferred. | `Risk.jsx:596–744` | n/a |
| **RK-Z4-01 (life cover need)** | **FAIL** | **FUNCTIONAL (A6)** | **`lifeCoverNeed = target * 10` (dependants > 0) or `target * 5` — multipliers hardcoded in `ProtectionGap.jsx:16`. Not from `rules-uk.js`, `UK-2026.1.1.json`, or `uk-risk-2026-1-1.js`. Confirmed by grep — zero occurrences in rules files.** Violates CLAUDE.md `feedback_always_check_rules_uk`. | `src/components/Risk/ProtectionGap.jsx:16` | hardcoded — should trace to engine/rules |
| RK-Z4-01a (sub-line "Suggested: 10× income / 5× income") | FAIL | FUNCTIONAL | Same hardcoded multiplier surfaced in copy. | `ProtectionGap.jsx:31` | hardcoded |
| **RK-Z4-02 (income protection need)** | **FAIL** | **FUNCTIONAL (A6)** | `ipNeed = Math.round(target * 0.6)` — 60% multiplier hardcoded in `ProtectionGap.jsx:21`. Not in any rules file. | `ProtectionGap.jsx:21` | hardcoded |
| RK-Z4-02a ("Suggested: 60% of target income") | FAIL | FUNCTIONAL | Hardcoded multiplier surfaced in copy. | `ProtectionGap.jsx:36` | hardcoded |
| RK-Z4-03 (combined gap + "s02a" copy) | PASS (gap math) / FAIL (A5) | FUNCTIONAL | `fmt(lifeGap + ipGap)` uses `fmt()` correctly; values derive from the (hardcoded-multiplier) inputs above so the *displayed gap is downstream of S-03*. Separate A5 FAIL: user-facing string contains internal route code "s02a". | `ProtectionGap.jsx:47–48` | derived from hardcoded inputs |
| RK-Z5-01..N (shock cards) | PASS | — | Each card renders `shock.rsBefore / rsAfter / rsDelta / fqBefore / fqAfter / nwDelta` from `riskShockSuite(entity)`. `fmt()` applied to NW deltas. No hardcoded shock figures detected. | `Risk.jsx:850–901`, `:1345–1349`, `:1413` | `riskShockSuite(entity)` |
| RK-Z5-0y (rsBefore reconciliation) | UNVERIFIED-PASS | — | `shock.rsBefore` is engine-supplied. Inventory expects rsBefore == current `risk.total`. Engine implementation of `riskShockSuite` not opened here — flagged for domain-auditor to confirm engine populates `rsBefore` from same `calcRisk` call. | `Risk.jsx:874–882` | `riskShockSuite` |
| RK-Z5-EMPTY | FAIL | POLISH | "engine returned empty" is engineer-facing copy in user surface. A5 fail; A6 pass (no number to reconcile). | `Risk.jsx:1409–1411` | n/a |
| RK-Z6-01 (Confidence card) | FAIL by absence | FUNCTIONAL (A1) | Spec §8.1 dedicated Z6 card not rendered; only `ConfBadge` chip exists. Not a reconciliation FAIL per se (no number to compare) — flagged here for completeness as orchestrator may surface as A1. | n/a | `risk.confidenceLevel` exists; UI doesn't render the card |
| RK-Z7-02 (life-event banner count) | PASS | — | `events.length` is rendered directly from `lifeEventPaths(entity).length`. Count reconciliation trivially holds. | `Risk.jsx:1098–1123` | `lifeEventPaths` |
| RK-Z8-01..05 (history chart + labels) | PASS within-Risk | — | `start = series[0].score`, `end = series[last].score`, `delta = end - start`. **Cross-screen reconcile check: `end` (today's score) must equal `risk.total` (RK-ANCH-01).** Both call `calcRisk` / `calcRiskHistory` against the same entity in the same render — value equality is structurally guaranteed unless the engine returns drift. Verdict PASS pending engine-side spot-check. | `Risk.jsx:911–972` | `calcRiskHistory(entity, range).points` |
| RK-Z9-01..03 (Take Action chips `+impact.riskScore`) | PASS | — | `a.impact.riskScore` from `calcAPQ(e)` — engine-sourced. Chip label reflects the actual `+N` returned. | `Risk.jsx:974–1019` | `calcAPQ(e)` |
| RK-Z9-01 (claim ↔ source) | PASS | — | Action title + `+impact.riskScore` chip both come from the same `calcAPQ` record — no claim/source split. | same | `calcAPQ` |
| RK-Z11-01a..d (mitigation rows) | PASS | — | `m.action / m.description / m.effort / m.rsDeltaImprovement` all from `engineWhatHelpsMost(entity, shockId)`. No hardcoded ΔRisk values. | `Risk.jsx:1021–1095` | `whatWouldHelpMost(entity, shockId)` |
| RK-Z11-01a (action name underscore→space) | PASS A6 / FLAG A5 | POLISH | Transform `m.action.replace(/_/g, ' ')` preserves engine key; A5 risk that "buy income protection" / "increase emergency fund" reads ok but "topup emergency fund" / engine-named keys may not. Not an A6 FAIL — the number is what it is. | `Risk.jsx:1071` | `whatWouldHelpMost` |
| RK-Z12-A / RK-Z12-N | PASS | — | `plan = planFor(entity,'protection')` → engine-sourced. Active variant renders `plan.lastUpdated`. No hardcoded plan figures. | `Risk.jsx:1126–1176` | `planFor(entity,'protection')` |
| RK-Z10-D3 / RK-Z10-D6 (eyebrow "D3"/"D6") | NA A6 | POLISH (A5) | No engine number — but internal dimension codes surfaced in user copy (S-05). A5 not A6. | `Risk.jsx:1219–1234` | n/a |
| RK-FOOT-01/02 | PASS | — | `BRAND.disclaimer / rulesVersion / dataDate` from `src/config/brand.js`. Rendered in both surfaces (`Risk.jsx:1640–1642`; `RiskOverlay.jsx:165–167`). | brand.js | n/a |
| RK-OVL-03 (overlay header score) | FAIL — see RK-ANCH-01 | DEMO-BLOCKING | Same metric, format differs from Risk full page ring. Within-overlay also duplicated in RK-Z1-01. | `RiskOverlay.jsx:79–86` | `calcRisk(e).total` |
| RK-OVL-04 (overlay header "· Wealth NN") | FAIL — partial | FUNCTIONAL | Format drift: overlay shows bare `Wealth 78` with no `/100`; Home shows `78/100`; Risk full page secondary tile shows bare `78` labelled "Health score". Three formats, two labels, one engine value. | `RiskOverlay.jsx:88–93` | `calcFQ(e).total` |
| RK-OVL-08 (Z1 ring not suppressed in overlay) | FAIL | FUNCTIONAL | `RiskOverlay.jsx:157` calls `<RiskBody entity={entity} />` — does NOT pass `suppressPrimaryRing`. Z1 ring renders below the sticky header that already shows the same number. | `RiskOverlay.jsx:157` vs `Risk.jsx:1633–1638` | `calcRisk` |
| **Risk default-export prop passthrough** | **FAIL** | **DEMO-BLOCKING** (A6 propagation) | `Risk.jsx:1601` `Risk` default export takes `{ entity, onHome, originLabel, onDrillMetric, onCommit }` and at `:1633–1638` passes `entity / onDrillMetric / onCommit / suppressPrimaryRing` to RiskBody — but **NOT `onAddProtection`**. RiskBody (`:1335`) expects it. → All six `+`-button tiles (RK-Z10-D3a..c + D6a..c) call `onAddProtection?.(id)` which resolves to `undefined`. **A6 isn't directly about handlers, but the engine-source chain breaks: an "add a thing" action that goes nowhere is the same class of fail as a hardcoded number — the surface lies about what's behind it.** S-06 confirmed. | `Risk.jsx:1601–1638` + `:1335` + `:1467` | n/a — wiring fail |
| **RiskOverlay prop passthrough** | **FAIL** | **DEMO-BLOCKING** | `RiskOverlay.jsx:157` passes ONLY `entity` to `<RiskBody>`. No `onAddProtection`, no `onDrillMetric`, no `onCommit`, no `suppressPrimaryRing`. → In overlay context: every drill/`+`/commit action dispatches to `undefined`; the Z1 ring duplicates the header score. **Overlay is canonical surface per FD-RK-3 — this is the FAIL.** | `RiskOverlay.jsx:157` | n/a — wiring fail |

---

## 4. Seed-finding confirmations

| Seed | Status | Notes |
|---|---|---|
| S-01 (Wealth Score = "Health score") | **CONFIRMED FAIL** | `Risk.jsx:1535`. FUNCTIONAL. |
| S-02 ("Safety score" / "Risk Score" / band-name divergence) | **CONFIRMED FAIL** | `Risk.jsx:1512–1514` eyebrow vs `:166–173` ring centre label vs band names from `riskBand()`. FUNCTIONAL. |
| S-03 (10×/5×/60% hardcoded) | **CONFIRMED FAIL** | `ProtectionGap.jsx:16, 21, 31, 36`. Zero matches for these multipliers in `src/rules/UK-2026.1.1.json` or `src/engine/modules/uk-risk-2026-1-1.js`. Violates `feedback_always_check_rules_uk`. FUNCTIONAL. |
| S-04 ("s02a" in user copy) | **CONFIRMED FAIL** (A5, included for completeness) | `ProtectionGap.jsx:48`. |
| S-05 ("D3"/"D6" codes in user copy) | **CONFIRMED FAIL** (A5) | `Risk.jsx:1220, 1233`, `:651` "D6 questionnaire". |
| **S-06 (onAddProtection not passed)** | **CONFIRMED FAIL** | Default-export `Risk` and `RiskOverlay` BOTH omit `onAddProtection` when rendering `RiskBody`. All 6 universal-add tiles are dead handlers in both surfaces. **DEMO-BLOCKING.** |
| S-07 (Z11 headers styled clickable but no onClick) | **CONFIRMED FAIL** (A2) | `Risk.jsx:1058–1060` — `className="sw-press"` + `cursor:'pointer'` with no `onClick`. |
| S-08 (life-event banner "Tap to re-answer" but no onClick) | **CONFIRMED FAIL** (A2) | `Risk.jsx:1103–1122` — entire card has no `onClick`. Copy implies interactivity. |
| **S-09 (overlay score double-render)** | **CONFIRMED FAIL** | `RiskOverlay.jsx:157` lacks `suppressPrimaryRing`. Header `78/100` + Z1 ring `78` both render. Visual + format drift. FUNCTIONAL. |
| S-10 (no Z6 Confidence card) | **CONFIRMED FAIL** by absence | A1; out-of-scope for A6 narrowly. |
| **S-11 (Risk Score reconcile: Home ↔ Risk full ↔ Overlay)** | **CONFIRMED FAIL on format** | Value reconciles (all call `calcRisk(e).total`). Format drifts: Home `78/100` · Risk full ring `78` · Overlay header `78/100` · Overlay Z1 ring `78`. **DEMO-BLOCKING.** |
| **S-12 (Wealth Score reconcile)** | **CONFIRMED FAIL** | Value reconciles. Label drift: "Health score" (Risk full) vs "Wealth" (overlay) vs "Wealth Score" (Home). Format drift: bare int (Risk SecondaryTile + overlay) vs `N/100` (Home). RK-CHR-09 topbar version missing entirely (no topbar in Dashboard). |
| S-13 (Net Worth reconcile) | **PASS** | Both call `fmt(netWorth(e))`. Risk does not reproduce the Home £3.63m/£3.63M case-drift. |
| S-14 (orphan components) | **CONFIRMED** | `CrossMap.jsx`, `DimensionRadar.jsx`, `ScoreHistoryChart.jsx`, `ShockScenarios.jsx` — zero importers under `src/screens/Risk*.jsx` or anywhere reachable; `_ComponentLab.jsx` imports the *replacement* `CrossMap5x5` only. POLISH. |
| S-15 (Sonuswealth/Finio brand drift) | PASS spot-check | Grep on `Risk.jsx`/`RiskOverlay.jsx`/`ProtectionGap.jsx` finds no `Sonuswealth` or `Finio` user-facing strings. |
| S-16 ("engine returned empty") | CONFIRMED A5 | `Risk.jsx:1409–1411`. POLISH. |
| S-17 (Z12 hash to non-existent `tab=plan`) | CONFIRMED FAIL | `Risk.jsx:1149–1163` — dispatches `sonus:navigate` + sets `#tab=plan&planType=protection`. Codebase grep finds no listener for `tab=plan` in Dashboard. A2/A4 functional. |
| S-18 (two close affordances in overlay) | CONFIRMED | `RiskOverlay.jsx:62–70` (×) + `:110–117` (← breadcrumb). POLISH. |
| S-19 (X28 on Risk?) | **PASS** | `Risk.jsx:53` deliberately omits `X28TopBar` import; `:1611–1616` comment explicitly states X28 banned per spec §33c. Verified no `<X28TopBar` element under `Risk.jsx`. |
| S-20 (D7 = 0 special case) | **PASS** | `Risk.jsx:275, 295–301, 311–313` — `isBTRBuilding = key === 'behaviouralTrack' && score === 0` → neutral grey "Building track record — needs 90 days of activity" with em-dash for the score column. Verified does not bypass non-zero engine output. |

---

## 5. New findings beyond the seeds

| # | Element | Issue | Engine fn | Severity |
|---|---|---|---|---|
| N-01 | **RK-ANCH-01 ring centre format** | Ring renders bare `<Num value={score} format="score" />` → "78" inside the donut, with no `/100`. Home shows `78/100`; overlay header shows `78/100`. Inside one Risk full-page render, the ring centre is the ONLY place the score appears without `/100`. | `calcRisk(e).total` | FUNCTIONAL (A6 format) |
| N-02 | **`SecondaryTile` (RK-ANCH-05) format** | Renders `fq.total` as bare int (`{value}` directly), with band-name underneath. Home `H-ANCH-02` shows `78/100` with band underneath. Across the same anchor row a user sees "78" (Risk page) vs "78/100" (Home secondary). | `calcFQ(e).total` | FUNCTIONAL |
| N-03 | **RiskOverlay drops three props** | `RiskOverlay.jsx:157` passes ONLY `entity` to `<RiskBody>`. The full-page Risk passes `onDrillMetric / onCommit / suppressPrimaryRing` and the overlay drops all three. Overlay is canonical per FD-RK-3 — so the overlay is the FAIL. Effects: (a) overlay cross-map cells don't drill, (b) overlay DimSheet D6 questionnaire commit fires `onCommit?.(undefined)` and is silently lost, (c) Z1 ring duplicates header score. | n/a (wiring) | DEMO-BLOCKING |
| N-04 | **RK-CHR-09 expected but absent** | Inventory expects a topbar score chip with sparkline reconciling Wealth Score. `Dashboard.jsx` has no topbar/Sparkline. Either the inventory is stale or this is missing chrome. Flagging — orchestrator decides. | n/a | POLISH |
| N-05 | **Risk full page does NOT pass `onAddProtection`** | `Risk.jsx:1633–1638` calls `<RiskBody entity={entity} onDrillMetric={...} onCommit={...} suppressPrimaryRing />` — no `onAddProtection`. Six "+"-button tiles (RK-Z10-D3a..c + D6a..c) call `onAddProtection?.(id)` → undefined. Confirms S-06 in the **full page surface** too (not just overlay). | n/a (wiring) | DEMO-BLOCKING |
| N-06 | **Risk Score "78/100" vs ring "78" within the same surface group** | The Risk full-page sticky anchor (`RiskPrimaryAnchor`) renders the ring (bare "78") and no `/100` text anywhere; the overlay sticky header (above the same `RiskBody`) renders `78/100`. A user navigating Home→Risk full page→Risk overlay sees the same number rendered in *three* different formats in the space of two taps. | `calcRisk(e).total` | FUNCTIONAL → arguably DEMO-BLOCKING (S-11 already DEMO-BLOCKING; this is the same vein) |
| N-07 | **Stub copy comments admit deferred engine consumption** | `Risk.jsx:540` "Engine consumption of the event … is follow-up engine work — out of scope here." — i.e. `risk_questionnaire_committed` event is fired but engine doesn't consume it. Not strictly A6 (no rendered number to reconcile yet), but means **D6 sub-scores never update** after a user completes the questionnaire — the user-visible state remains derived from `entity.willStatus / lpaStatus / nominationsStatus`. Future-state reconciliation hazard. | n/a yet | FUNCTIONAL (latent) |
| N-08 | **Behavioural Track "/7" suppressed when 0** | When `score === 0` the DimRow renders em-dash `—` instead of `0/7`. Spec FD-RK-1 confirms max=7. Verdict: PASS — this is intentional CRIT 1.3 fix. (Noted because grep'ing for "/7" or "/100" finds no Behavioural Track score string when zero; future audits should not flag the absence as a regression.) | `calcRisk(e).dims.behaviouralTrack` | NOT A FAIL — explanatory only |

---

## 6. Severity assignment (proposed; orchestrator confirms)

| Severity | Count | Items |
|---|---|---|
| DEMO-BLOCKING | 5 | S-06 / N-05 (onAddProtection dead in both surfaces) · N-03 (RiskOverlay drops props incl. drill + commit) · S-11 / N-06 (Risk Score format drift across Home/Risk/Overlay) · S-12 (Wealth Score label+format drift) · S-09 (overlay double-renders score) |
| FUNCTIONAL | 8 | S-01 ("Health score") · S-02 (three names for Risk Score) · S-03 (hardcoded protection multipliers) · S-04 ("s02a" in copy) · S-05 ("D3"/"D6" in copy) · S-07/S-08 (dead affordances) · S-10 (no Z6 card) · S-17 (#tab=plan unwired) · N-01/N-02 (format drift within Risk) · N-07 (D6 commit not consumed) |
| POLISH | 4 | S-14 (orphan components) · S-16 ("engine returned empty") · S-18 (two close affordances) · N-04 (missing topbar) |

---

## 7. Coverage

| Region | Rows reviewed | Verdict assigned |
|---|---|---|
| R1 chrome (12) | 1 of 12 (RK-CHR-09 + RK-CHR-12) — rest are nav items audited by destination-auditor | partial |
| R2 hero (5) | 0 — A5/A2 territory | 0 |
| R3 anchor (6) | 6 / 6 | full |
| R4 overlay ring (1) | 1 / 1 | full |
| R5 cross-map (4 + 25 cells) | 2 / 29 (RK-Z2-02 active cell + active-cell reconciliation) — 25 cell archetypes have no numbers to reconcile | partial |
| R6 7-dim panel (17) | 8 / 17 | partial |
| R7 DimSheet (10) | 3 / 10 | partial |
| R8 D6 questionnaire (13) | 0 / 13 — input only | NA |
| R9 Protection Gap (8) | 6 / 8 | most |
| R10 shock scenarios (~7) | 4 | most |
| R11 Z6 confidence (1) | 1 (absence) | full |
| R12 life event (3) | 1 / 3 | partial |
| R13 history (9) | 5 / 9 | most |
| R14 Take Action (5) | 2 / 5 | partial |
| R15 what-helps (12) | 4 / 12 | partial |
| R16 protection plan (4) | 1 / 4 | partial |
| R17 universal add (12) | 1 / 12 (wiring) | partial |
| R18 footer (2) | 2 / 2 | full |
| R19 overlay chrome (8) | 4 / 8 | half |
| R20 orphans (4) | 4 / 4 | full |

**Numeric rows reviewed for A6 specifically:** ~55 of ~80 numeric/data rows touched. Rows with no engine-sourced number (A1/A2/A4/A5 territory) deferred to the other auditors.

---

## 8. Summary line

**RK reconciliation: 13 PASS, 18 FAIL (5 DEMO-BLOCKING, 8 FUNCTIONAL, 5 POLISH).**

Per skill v1.4 §2.7 — canonical CoI rule does not apply on Risk (Risk does not surface aggregate Cost of Inaction; CoI lives on T&E + Home).

---

*— end Risk pass-1 reconciliation report —*
