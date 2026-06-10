Title:         Scenario Coverage Map — UK life-money questions vs the two answer surfaces
Version:       1.0
Date:          2026-06-10
Status:        DOCUMENTED
Cluster:       2-Product / 3-Engine (Decision Engine + Ask Sonu)
File name:     SCENARIO-COVERAGE-MAP.md
Purpose:       Enumerate common UK personal-finance life questions, map each to the Decision Catalogue (DE-xx) or Ask Sonu, find the gaps, and give mechanical recipes to fill them — staying inside information/guidance/storage (never advice/sales).

**Summary:** Coverage sweep of ~80 real UK money questions against the 40-decision catalogue and the 25-play Ask Sonu engine; the headline structural gap is that Ask Sonu has NO definitional/explainer layer ("what is an annuity?" only works if the LLM is up), and several high-frequency life events (windfall/gift received, bonus, childcare/Child Benefit, first home, redundancy-as-explainer, pension consolidation, scams) have thin or no coverage.
**Tags:** #decision-engine #ask-sonu #coverage #fca-boundary
**Updated:** 2026-06-10

---

## ⚠️ Brief correction (read first)

The brief said "~49-decision catalogue across 9 categories." The code says **40 decisions (DE-01..DE-40) across 8 categories**. There is no standalone Decisions tab — decisions surface as per-screen "Decisions you can make here" drawers keyed by `DECISION_CATEGORIES[].home` (`money | flow | tax | risk`). Numbers in this doc are against the real 40/8.

Ask Sonu's knowledge = **25 "plays"** in `knowledge-graph.js` (`PLAYS` array). A play is an *action recommendation* (one-liner + detail + `compute_impact` £ math + legal citation + FCA line), NOT a definition. This distinction drives most of the gaps below.

---

## (a) RANKED GAP LIST — highest impact uncovered first

Impact = (how often a real UK user asks it) × (how badly both surfaces currently handle it).

1. **Definitional / "what is X" questions have no deterministic home.** "What is an annuity?", "what's drawdown?", "what's an ISA vs a SIPP?", "what is BPR?" — Ask Sonu's deterministic path returns `off_ontology` ("rephrase in terms of retirement, tax, IHT…") because no classifier RULE and no *definitional* play exists. It only answers if the LLM proxy is reachable (Outcome C freeform). **This is the founder's exact annuity complaint and it is structural, not a content hole.** Fix = add a glossary/explainer knowledge type (see Recipe B variant).
2. **Windfall / cash gift / lottery received — "I got £X, how do I invest it."** Partially covered: DE-33 (inheritance) is ~90% the same logic, DE-32 (redundancy payout) and the cash-deployment plays (`deploy_cash_isa_first`, `emergency_fund_first`, `gilt_ladder_for_dated_spend`, `psa_optimisation`) cover the *deployment* tail. But there is **no DE titled for a gift/windfall**, so a user typing "I received a cash gift" finds nothing in the catalogue and lands on inheritance only if they think to look there. **EXTENSION of DE-33, not a new build** (see flag below).
3. **Annuities as a decision are covered; annuities as a concept are not.** DE-02 ("Buy a guaranteed income now, or wait?") and DE-38 ("Adding a guaranteed income later") cover the *decision*. But "what is an annuity / how does it work / level vs escalating / single vs joint life / enhanced" has no explainer. A pre-retiree who doesn't yet know the word can't reach DE-02. Pair the explainer gap (#1) with a deep-link into DE-02/DE-38.
4. **Childcare & Child Benefit / tax-free childcare / 30 free hours.** No DE, no play, no classifier rule. High-frequency for the family stage and tax-cliff-relevant (HICBC at £60k–£80k 2026/27). GAP.
5. **First home / saving a deposit / LISA / Help to Buy successor / shared ownership.** DE-06 mentions LISA as an *option inside* "which ISA"; there is no DE for "I'm buying my first home." The whole FTB journey (deposit, LISA bonus, stamp-duty relief, mortgage affordability) is uncovered as a life event. GAP.
6. **Pension consolidation / "I have 5 old pensions, should I combine them?"** No DE, no play. Extremely common. DE-37 covers DB transfer only. GAP.
7. **Bonus / large one-off income this year.** Partly covered by `taper_pension_relief` play (the £100k–£125,140 60% trap) but ONLY via Ask, and only if income lands in the taper band. No DE for "I'm getting a £30k bonus, what do I do." GAP (catalogue), PARTIAL (Ask).
8. **Scams / fraud / "is this a scam" / pension liberation.** No coverage either surface. Rising real-user need, brand-trust relevant, and pure information (FCA ScamSmart). GAP.
9. **Student loans / graduate repayment / Plan 2 vs 5 / should I overpay.** No coverage. Early-career staple. GAP.
10. **Marriage Allowance / spouse income shifting for non-investors.** DE-24 covers "sharing assets with your spouse" (capital/CGT); the £1,260 Marriage Allowance transfer and basic spousal income planning is thinner. Ask `split_sipp_spouse` is drawdown-only. PARTIAL.

(Full per-question audit in section (d). Other notable GAPs surfaced there: salary-sacrifice childcare/EV, Help with mortgage arrears / payment difficulty, equity release explainer vs DE-12 decision, NHS/DB pension specifics, multiple-pots withdrawal *order*, state pension top-up/voluntary NICs, capital gains on crypto/shares basics, IHT gift 7-year taper explainer, power of attorney "what is it", protection "do I even need it" triage.)

---

## (b) THE TWO "HOW TO EXTEND" RECIPES

### Recipe A — Add a new Decision (DE-41) to the Catalogue

A DE entry is spread across **4 files**. All four must be edited or the decision renders half-built. No new screen is created — it joins an existing category drawer.

1. **`src/engine/decision-catalogue.js`**
   - Add to `DECISION_TYPES_ALL`: `{ id: 'DE-41', title: '<plain-English title>', status: 'live' }`.
     Title is plain English (founder rule); technical term only in parentheses where it aids recognition.
   - Add the id to the right entry in `DECISION_CATEGORIES[].ids` — this decides which screen (`home: money|flow|tax|risk`) shows it and in which drawer. (If it needs a brand-new category, add a `DECISION_CATEGORIES` object with `id,label,icon,home,ids` — but prefer reusing the 8 existing.)

2. **`src/engine/decision-content.js`** — add `'DE-41': { objective: { decision, why, goal }, options: { <pathId>: { plain, goodIf }, ... } }`.
   - `objective` = the 3 plain-English framing lines (what the decision is / why it matters / the goal).
   - `options` keys are the **path ids** and MUST match the path ids used in `decision-engine.js` `pathDefs` AND in `decision-commit-content.js` exactly.
   - Descriptive only — NO hardcoded £/% (engine supplies live figures; enforced by accuracy-auditor).

3. **`src/engine/decision-commit-content.js`** — add `'DE-41': { reviewHint, options: { <pathId>: { checklist: [...] } } }`.
   - One `checklist` (array of plain action strings) per path id. No "you should", no "best", no "we will…", no £/% — information/storage tone only.

4. **`src/engine/decision-engine.js`** — add the executable logic: a `pathDefs` block for DE-41 (the option/path ids + how each path is scored/computed against the persona). This is what makes the decision *compute* rather than just display. (Grep an existing simple DE such as DE-14 or DE-33 as the template; mirror its path-id naming so content/commit/engine stay aligned.)

   Verification: path ids must be identical across files 2/3/4; titles/grouping live only in file 1. After adding, the decision auto-appears in the owning screen's drawer via `categoriesForScreen(screen)` (filters `status === 'live'`). No screen code change needed.

**When to use Recipe A:** the question is a genuine *decision with options the user picks between* and a committable action checklist (e.g. "should I consolidate my old pensions", "how do I save for a first home"). These deserve a structured, drillable, commit-and-revisit surface.

### Recipe B — Add knowledge to Ask Sonu

Ask Sonu has **two answer engines**: an LLM path (Claude Sonnet via the Supabase `ask-sonu-proxy` edge function — needs `VITE_SUPABASE_URL` + an authenticated session; falls back if absent) and a deterministic path (`classifier.js` → `matcher.js` → `synthesizer.js`, no key needed). To make Ask reliably answer a NEW topic on BOTH paths:

1. **Add a play to `src/engine/ask-sonu/knowledge-graph.js`** (`PLAYS` array). Fields: `id, title, one_liner, detail, triggers (CONCERNS.*), weight (per-concern 0-1), prerequisites, counter_indications, needs_fact (FACTS.*), compute_impact (persona[,state]) => {gbp_saved,time_horizon,certainty,why}, citation (REAL UK legislation/HMRC/FCA), category, alternatives, fca_boundary`. The LLM can only pick play ids that exist here (validated post-call), and all £ math + citations come from the play, never the LLM.
2. **Add a classifier RULE in `src/engine/ask-sonu/classifier.js`** (`RULES` array): `{ match: /regex/i, concerns: { [CONCERNS.X]: weight }, resources: [...] }` so the deterministic path can route the query to the new play when the LLM is down. Without this, the deterministic path returns `off_ontology` for the new topic.
3. **If the topic introduces a new concern**, add it to `CONCERNS` in `ontology.js` (and a `PLAY_INTENT` entry in classifier.js so the self-critique guard knows which intents the play serves: `draw|preserve|restructure|plan`).
4. **Wire advisors** via `play-actions.js` `ADVISORS_BY_CATEGORY` / `getActionSteps(playId)` for the new category if it's new.

**Recipe B variant — DEFINITIONAL knowledge (the annuity fix).** Plays are action patterns and assume the user knows the term. To answer "what is an annuity?" deterministically you need a **new knowledge type**, not a play: a lightweight `GLOSSARY`/`EXPLAINERS` map (term → plain-English definition + 2-3 sentence how-it-works + variants + the DE/play it links to + FCA line). Then:
   - Add a classifier branch for "what is / what's / explain / how does … work / difference between" → return an explainer instead of a play.
   - Each explainer deep-links to the relevant decision (annuity → DE-02/DE-38) or play, so the user moves from "understand it" to "decide on it."
   - This is the single highest-leverage Ask change: it converts every off-ontology definitional miss into a deterministic hit and removes the LLM dependency for the most common beginner questions.

**When to use Recipe B:** the question is conversational/exploratory, spans multiple concerns, or is definitional. Ask handles the long tail; the catalogue handles the structured, committable decisions.

**Positioning constraint (both recipes):** every fill stays information/guidance/storage. No "buy this", no "you should", no product/broker surfacing, no lead-gen. FCA boundary line on every play/explainer. Numbers come live from the engine.

---

## (c) 10-LINE SUMMARY

1. Catalogue = 40 decisions / 8 category drawers (not 49/9); Ask Sonu = 25 action "plays" + an LLM reasoning layer.
2. The catalogue answers *structured decisions*; Ask answers the *conversational long tail* — they are complementary, not redundant.
3. Biggest gap is architectural: Ask has **no definitional/glossary layer**, so "what is an annuity?" only works when the LLM proxy is live (deterministic path says "rephrase").
4. Ask needs an LLM (Supabase proxy + Claude Sonnet) for anything off the 25 plays; the deterministic fallback only matches those 25 via keyword→concern rules.
5. "Received a cash gift — how to invest it" is **~90% DE-33 (inheritance)** plus the cash-deployment plays — extend DE-33's framing/aliases, do NOT build new.
6. Annuities-as-a-decision are covered (DE-02, DE-38); annuities-as-a-concept are not — pair an explainer with a deep-link into DE-02.
7. High-frequency life events with NO coverage: childcare/Child Benefit, first-home/deposit, pension consolidation, scams, student loans, bonus-as-event.
8. Decumulation has decisions (DE-01/02/37/38) but thin explainers for withdrawal *order across multiple pots*, DB/NHS specifics, and "which pot first."
9. Recipe A (new DE) touches 4 files with path-id alignment; Recipe B (Ask) = play + classifier rule (+ glossary type for definitions).
10. Every fill must stay information/guidance/storage — no "buy/you should", FCA line always, £ from engine.

---

## (d) FULL PER-QUESTION COVERAGE AUDIT

Surfaces: **DE-xx** = Decision Catalogue id · **Ask:play_id** = an existing Ask Sonu play · **Ask:LLM** = only answerable via the LLM freeform path (no deterministic match) · **Ask:gloss** = needs a new explainer/glossary entry.

Covered = YES (live, fits) / PARTIAL (adjacent but not direct, or one surface only) / GAP (nothing fits).

### Early-career / accumulation
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "How much emergency fund should I have and where?" | DE-13 / Ask:emergency_fund_first | YES | DE-13 "Your emergency fund: how much and where"; play `emergency_fund_first` | — |
| "Better return on my spare cash?" | DE-14 / Ask:deploy_cash_isa_first | YES | DE-14; plays `deploy_cash_isa_first`, `psa_optimisation` | — |
| "Which ISA should I use?" | DE-06 | YES | DE-06 with cash/S&S/LISA/blend options in decision-content | — |
| "Should I overpay my mortgage or invest?" | DE-08 | YES | DE-08 with overpay/offset/invest/split | — |
| "How much should I pay into my pension?" | DE-03 | YES | DE-03 + carry-forward option | — |
| "Where should my pension money go (workplace vs SIPP)?" | DE-04 | YES | DE-04 | — |
| "Should I do salary sacrifice into my pension?" | DE-05 | YES | DE-05 | — |
| "Should I overpay my student loan?" | Ask:gloss / DE | GAP | no DE, no play, no classifier rule for student loans | New DE or Ask play+rule (Plan 2/5, write-off horizon) |
| "I'm getting a bonus — what should I do with it?" | DE / Ask:taper_pension_relief | PARTIAL | `taper_pension_relief` only fires in £100k–£125,140 band, Ask-only | New DE-41 "Making the most of a bonus"; broaden play |
| "What is an ISA / SIPP / GIA?" | Ask:gloss | GAP | definitional; off_ontology on deterministic path | Recipe B variant (glossary) |
| "How does compound growth / pound-cost averaging work?" | Ask:gloss | GAP | definitional | Recipe B variant |

### Family — childcare, school, marriage, divorce
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "Tax-free childcare / 30 free hours / which is better?" | DE / Ask | GAP | no DE, no play, no rule | New DE or Ask play (childcare schemes, HICBC interaction) |
| "Will I lose Child Benefit if I earn more (HICBC)?" | Ask:gloss/play | GAP | no coverage; cliff at £60k–£80k 2026/27 | Ask play + classifier rule (tie to taper logic) |
| "How do I pay for school / university fees?" | DE-30 | YES | DE-30 "Paying for school or university" | — |
| "Can I afford a career break?" | DE-31 / Ask | YES | DE-31; Ask FIRE/career-break classifier rule | — |
| "We're getting married — what changes financially?" | Ask:will_revocation_on_marriage / DE | PARTIAL | play covers will revocation; no DE for marriage; Marriage Allowance missing | New DE or play (Marriage Allowance £1,260, will, IHT spousal) |
| "We live together but aren't married — what's the risk?" | Ask:cohab_ip_gap | YES (Ask) | play `cohab_ip_gap` + classifier rule | Consider DE for the structured version |
| "I'm getting divorced — how do I split things?" | DE-34 / Ask:pension_sharing_divorce | YES | DE-34; play `pension_sharing_divorce` + classifier+implied-fact | — |
| "We're having a baby — what should we sort?" | Ask | PARTIAL | classifier rule maps baby→protection/education but no dedicated play/DE | New play/DE (protection, will, JISA, childcare) |
| "Should I open a Junior ISA / child pension?" | Ask:gloss / DE | GAP | not in DE-06 options, no play | Extend DE-06 or new Ask play |

### Property — buying, BTL, remortgage
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "I'm buying my first home — how do I prepare?" | DE / Ask | GAP | DE-06 mentions LISA as an option only; no FTB journey | New DE "Buying your first home" (deposit, LISA, SDLT relief, affordability) |
| "Keep, rent, or sell a property I own?" | DE-09 | YES | DE-09 with keep/let/sell paths | — |
| "Which mortgage deal should I take next?" | DE-10 | YES | DE-10 fix2/fix5/tracker/offset | — |
| "I'm a landlord — how does the tax work (s24)?" | DE-11 | YES | DE-11 hold/incorporate/sell | — |
| "Should I buy a buy-to-let?" | DE-11 / Ask | PARTIAL | DE-11 assumes you already own; classifier has BTL rule but weak play backing | Extend DE-11 entry path or new Ask play for *acquisition* |
| "Should I remortgage / is now a good time?" | DE-10 | YES | DE-10 covers next-deal choice | — |
| "What is equity release / is it right for me?" | DE-12 / Ask:gloss | PARTIAL | DE-12 decision exists; no explainer for the wary first-timer | Add glossary explainer → deep-link DE-12 |
| "I'm struggling with mortgage payments — what now?" | Ask / DE | GAP | no coverage (forbearance, payment holidays) | New Ask play (info-only: lender forbearance, MoneyHelper) |

### Income shocks — redundancy, bonus, windfall, inheritance, gift, lottery
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "What do I do with a redundancy payout?" | DE-32 | YES | DE-32 | — |
| "I got an inheritance — what should I do?" | DE-33 | YES | DE-33 "What to do with an inheritance" | — |
| **"I received a cash gift — how do I invest it?"** | DE-33 (extend) | PARTIAL | ~90% identical to DE-33 logic but no gift-titled entry / search alias | **EXTEND DE-33** — add gift/windfall aliasing + framing (see flag) |
| "I won the lottery / had a windfall — now what?" | DE-33 (extend) / Ask | PARTIAL | same deployment logic; no windfall entry | EXTEND DE-33 framing to "inheritance/gift/windfall" |
| "I have a lump of maturing cash — where do I put it?" | Ask:deploy_cash_isa_first / DE-14 | YES (Ask) | cash plays incl. purpose-disambiguation in llm-router | Consider DE for structured version |
| "I'm worried about a sudden income drop — buffer?" | Ask:emergency_fund_first / DE-13 | YES | play + DE-13 | — |

### Business owner
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "Salary vs dividends as a director?" | DE-25 | YES | DE-25 | — |
| "How do I sell my business tax-efficiently?" | DE-35 / Ask | YES | DE-35; classifier business-exit rule (BADR) | — |
| "How do I clear a director's loan?" | DE-36 | YES | DE-36 | — |
| "Should I invest in EIS/SEIS for tax relief?" | DE-26 | YES | DE-26 | — |
| "VCT for tax relief?" | DE-27 | YES | DE-27 | — |
| "Business relief (BPR) to cut IHT?" | DE-28 / Ask:aim_bpr | YES | DE-28; play `aim_bpr` | — |
| "Should I incorporate / set up a Ltd?" | DE / Ask | GAP | no DE for incorporation decision (DE-11 only for property) | New Ask play or DE |
| "What pension can I run through my company?" | DE-04 / Ask | PARTIAL | DE-04 mentions SIPP; employer/company contribution specifics thin | Extend DE-04 or new play |

### Pre-retirement
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "Should I transfer my final-salary (DB) pension?" | DE-37 | YES | DE-37 | — |
| "I have 5 old pensions — should I combine them?" | DE / Ask | GAP | no DE, no play for consolidation | New DE "Combining your old pensions" (info: lost guarantees, exit fees, charges) |
| "Am I on track to retire / how big a pot do I need?" | (other screens) / Ask | PARTIAL | covered by Cashflow/Timeline funded-ratio, not Ask/DE | Cross-link; optional Ask play |
| "Should I top up State Pension (voluntary NICs)?" | Ask:gloss / defer_state_pension | PARTIAL | `defer_state_pension` covers deferral, not buying missing years | New play (Class 3 NICs top-up) + rule |
| "What's my State Pension and when do I get it?" | Ask:gloss | GAP | no explainer | Glossary/play |
| "Should I take the 25% tax-free cash?" | DE-01 / Ask:phase_tfc | YES | DE-01; play `phase_tfc` | — |

### Decumulation — drawdown, annuities, multiple pots, DB/NHS, withdrawal order
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "Take my pension all at once or bit by bit?" | DE-01 | YES | DE-01 lump/phased/defer | — |
| "Buy an annuity now or wait?" | DE-02 / Ask:phase_tfc(adj) | YES | DE-02 buy_now/defer/drawdown | — |
| **"What IS an annuity / how does it work?"** | Ask:gloss | GAP | no explainer; LLM-only | **Glossary explainer + deep-link DE-02/DE-38** (the founder's complaint) |
| "Annuity types — level vs escalating, single vs joint, enhanced?" | Ask:gloss | GAP | no content | Glossary explainer |
| "Add a guaranteed income later in retirement?" | DE-38 | YES | DE-38 | — |
| "How do I withdraw across multiple pots tax-efficiently (order)?" | Ask / DE | PARTIAL | engine has decumulation-sequence modules; not surfaced as DE/Ask Q&A | New Ask play "withdrawal order" citing the sequencer |
| "Which pot do I draw first — ISA, GIA, or pension?" | Ask:preserve_pension_pre_2027 (adj) | PARTIAL | preservation play implies order pre-2027 but not a general "order" answer | New play tying to decumulation-sequence |
| "How do I avoid triggering MPAA?" | Ask:mpaa_avoidance | YES (Ask) | play `mpaa_avoidance` | — |
| "Can I phase my tax-free cash to save tax?" | Ask:phase_tfc | YES | play `phase_tfc` | — |
| "Split drawdown with my spouse?" | Ask:split_sipp_spouse | YES | play `split_sipp_spouse` | — |
| "How does NHS / public-sector (DB) pension work in retirement?" | Ask:gloss / DE-37 | PARTIAL | DE-37 = transfer decision only; no NHS specifics | Glossary/play for DB/NHS income mechanics |
| "Should I defer my State Pension?" | Ask:defer_state_pension | YES | play `defer_state_pension` | — |
| "How long will my money last (sequence risk)?" | (Cashflow/Timeline) / Ask | PARTIAL | engine covers; not a DE/Ask Q&A | Cross-link |

### Estate / IHT / gifting
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "How do I give money to family tax-efficiently?" | DE-15 / Ask:surplus_income_gifting | YES | DE-15; play `surplus_income_gifting` | — |
| "How does the 7-year gift rule / taper work?" | Ask:gloss | PARTIAL | gifting plays exist but no plain explainer of PET/taper | Glossary explainer |
| "Which type of trust should I use?" | DE-16 | YES | DE-16 | — |
| "Which type of will do I need?" | DE-17 | YES | DE-17 | — |
| "What is Power of Attorney / do I need one?" | DE-18 / Ask:lasting_poa | YES | DE-18; play `lasting_poa` | — |
| "How do I cut my IHT bill before April 2027 (pensions)?" | Ask:preserve_pension_pre_2027 | YES | play + classifier 2027 rule | — |
| "Charity giving to cut IHT (10% rule)?" | DE-29 / Ask:charity_10pct_iht | YES | DE-29; play `charity_10pct_iht` | — |
| "How do I pay for long-term care?" | DE-40 / Ask:care_fee_buffer | YES | DE-40; play `care_fee_buffer` | — |
| "What is the nil-rate band / residence NRB?" | Ask:gloss | GAP | definitional | Glossary explainer |
| "I'm leaving the UK — what's the IHT tail?" | DE-39 / Ask:iht_tail_post_departure | YES | DE-39; play `iht_tail_post_departure` | — |

### Protection / insurance
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "What life cover do I need?" | DE-19 | YES | DE-19 | — |
| "Critical illness cover — add or top up?" | DE-20 | YES | DE-20 | — |
| "Income protection — which type?" | DE-21 / Ask:income_protection_gap | YES | DE-21; play `income_protection_gap` | — |
| "Do I even need insurance / which first?" | Ask:gloss / triage | PARTIAL | individual DEs exist but no triage "where to start" | New Ask play (protection triage, info-only) |
| "Should life cover be written in trust?" | Ask:gloss | PARTIAL | mentioned in cohab_ip_gap alt; no standalone | Extend DE-19 or glossary |

### Tax — allowances, SA, CGT
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "How do I use my CGT allowance?" | DE-22 | YES | DE-22 | — |
| "Can I use investment losses to cut tax?" | DE-23 | YES | DE-23 | — |
| "Share assets with my spouse to cut tax?" | DE-24 | YES | DE-24 | — |
| "Move taxable investments into an ISA (bed & ISA)?" | DE-07 / Ask:bed_and_isa | YES | DE-07; play `bed_and_isa` | — |
| "I earn near £100k — how do I avoid the 60% trap?" | Ask:taper_pension_relief | YES (Ask) | play + classifier taper rule | Consider DE for structured version |
| "Do I need to file a Self Assessment / how?" | Ask:gloss | GAP | engine has SA computation but no DE/Ask Q&A explainer | Glossary explainer (info-only; app doesn't file) |
| "Marriage Allowance — can I transfer £1,260?" | Ask:gloss / DE | GAP | not covered (DE-24 is capital, not the MA transfer) | New play/explainer |
| "How is savings interest taxed (PSA)?" | Ask:psa_optimisation | YES | play `psa_optimisation` | — |
| "How is dividend income taxed?" | Ask:gloss / DE-25 | PARTIAL | DE-25 covers salary-vs-dividend decision, not the allowance explainer | Glossary explainer |
| "How is crypto / shares CGT calculated?" | Ask:gloss | GAP | no explainer (DE-22 is the *use the allowance* decision) | Glossary explainer |

### Debt
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "Overpay mortgage or invest spare money?" | DE-08 | YES | DE-08 | — |
| "Should I clear my director's loan?" | DE-36 | YES | DE-36 | — |
| "I have credit-card / personal debt — what order to pay?" | Ask / DE | GAP | no DE/play for consumer debt (avalanche/snowball, info-only) | New Ask play or DE (info: prioritise by rate, free debt advice) |
| "Should I consolidate my debts?" | Ask / DE | GAP | no coverage | New Ask play (info-only, signpost StepChange/MoneyHelper) |
| "Equity release to clear debt?" | DE-12 | PARTIAL | DE-12 exists for the decision; debt-clearance angle not framed | Extend DE-12 framing |

### Cross-cutting / misc high-frequency
| Question | Best surface | Covered? | Evidence | Fix |
|---|---|---|---|---|
| "Is this a scam / pension liberation / cold call?" | Ask:gloss | GAP | no coverage either surface | New Ask play (FCA ScamSmart, info-only) — brand-trust win |
| "What is X?" (any term) | Ask:gloss | GAP | no glossary; deterministic returns off_ontology | **Recipe B variant — glossary type** |
| "Should I relocate abroad?" | Ask (relocation plays) | YES | `srt_day_count_discipline`, `fig_window_utilise`, `destination_cost_reality_check`, `iht_tail_post_departure`, healthcare/schooling plays + classifier | — |
| "Healthcare continuity if I move abroad?" | Ask:healthcare_continuity_plan | YES | play | — |
| "Schools if I move abroad with kids?" | Ask:schooling_continuity_plan | YES | play | — |
| "FIRE / can I retire early?" | DE-31 / Ask | PARTIAL | DE-31 career break; FIRE classifier rule but thin play backing | New play "is FIRE feasible" tying to Cashflow funded-ratio |

---

## (e) FLAGS (as required by brief)

- **DE-33 already covers ~90% of "received a cash gift — how to invest it."** "What to do with an inheritance" (DE-33) is the same underlying logic: a lump arrives, deploy it across emergency fund → ISA/pension wrappers → CGT-aware GIA, with IHT awareness on onward gifting. **This is an EXTENSION, not a new build.** Cheapest fix: in `decision-catalogue.js` keep DE-33's id but widen its title/framing (e.g. "What to do with a windfall — inheritance, gift, or lump sum") and add search/alias terms so "gift" and "windfall" resolve to it; mirror in `decision-content.js` `objective`. Do NOT spin up DE-41 for gifts. (Source of received-gift income tax: a gift of cash from an individual is not itself taxable income to the recipient — the explainer must say this plainly and stay info-only.)

- **Annuity / decumulation gaps are real and split in two:**
  1. *Decision* coverage exists — DE-01 (how to take it), DE-02 (annuity now vs wait), DE-38 (annuity later), plus drawdown plays (`phase_tfc`, `split_sipp_spouse`, `mpaa_avoidance`, `defer_state_pension`).
  2. *Explainer* coverage does NOT — "what is an annuity", annuity types, "which pot do I draw first / in what order", and DB/NHS income mechanics have no deterministic home. The withdrawal-*order* gap is notable because the engine already has `decumulation-sequence.js` / `decumulation-plan.js` doing the maths — the gap is purely a surfaced Q&A/play, not new calculation. Fill via Recipe B variant (glossary) + one "withdrawal order" play that cites the existing sequencer.

- **Structural flag:** Ask Sonu cannot answer ANY definitional question without the LLM. If the Supabase proxy/key is unavailable, every "what is…" goes to `off_ontology`. Adding the glossary type (Recipe B variant) is the single change that removes the LLM dependency for the highest-frequency beginner questions and directly fixes the founder's annuity example.
