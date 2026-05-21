# Caelixa Architecture v0 — Synthesised Professional Brain

**Status:** DRAFT for founder review
**Date:** 2026-05-21
**Replaces:** the "5 Optimiser tiles" v0 demo definition

---

## 1. Vision in one paragraph

Caelixa runs the same persona data through **11 professional lenses** (tax accountant, pension specialist, trust lawyer, IFA, mortgage adviser, protection adviser, investment adviser, cross-border specialist, family-law specialist, later-life specialist, philanthropy adviser). Each lens produces its own observations, recommendations, red flags, and follow-up prompts. Where lenses **disagree**, the app shows the disagreement and the underlying assumption that drives it — letting the user decide which assumption holds for them. This is **information at advisor depth without being advice** — the user does the deciding, the app does the thinking.

---

## 2. Persona state schema

A persona is a typed JSON object with ~200 variables grouped into 12 sections. Schema enforced at engine boundary.

```yaml
PersonaState:
  meta:
    id: string                  # 'persona-a'
    dob: ISO_date               # source of age, not static integer
    jurisdiction: enum          # UK-rUK | UK-Scotland | UK-Wales | UK-NI | NRI | Other
    domicile: { status, uk_years_count }
    couple: bool
    spouse: PersonaState?       # recursive — couples are 2 personas
    dependants: [Dependant]     # ages, relationships
    
  income:
    employment: { salary, bonus, benefits }
    self_employment: { profit, class4_nic }
    pensions: { state, db, drawdown }
    rental: { gross, allowable_expenses }
    dividends: { uk, foreign }
    interest: { savings, gilts }
    other: { royalties, etc }
    
  assets:
    cash: { current, savings, isa_cash }
    investments: { isa_s_s, gia, sipp, ssas, vct, eis, seis, aim_bpr }
    property: { residence, btl_portfolio, fhl, commercial }
    business: { ltd_shares, sole_trade, partnerships }
    chattels: { art, jewellery, vehicles }
    crypto: { btc, eth, other }
    
  liabilities:
    mortgages: [{ outstanding, rate, term, type, ltv_origin }]
    loans: [{ outstanding, rate, term, purpose }]
    director_loan_account: { balance }
    
  pension_history:
    qualifying_years_ni: int    # for state pension calc
    contribution_history: [{ tax_year, gross, employer, employee }]
    crystallisation_events: [{ date, amount, type }]
    mpaa_triggered: { yes_no, date_if_yes }
    lta_protection: enum?       # FP14, FP16, IP14, IP16, none
    
  estate:
    will_status: enum           # in_place | outdated | none
    will_date: ISO_date
    lpa_financial: bool
    lpa_health: bool
    gifts: [{ date, recipient, amount, type }]
    beneficiaries: { direct_descendants_inherit, charity_pct }
    nrb_transferred_from_spouse: pct
    
  insurance:
    life: [{ sum_assured, term, in_trust }]
    income_protection: [{ benefit, term, deferred_period }]
    critical_illness: [...]
    
  preferences:
    risk_tolerance: int 1-10
    ethical_constraints: [esg, sharia, etc]
    time_horizon: years
    objectives_ranked: ['income','growth','legacy','security']
    
  flags:
    higher_rate_taxpayer: bool
    has_business: bool
    has_trust: bool
    is_director: bool
    is_landlord: bool
    
  history:
    snapshots: [{ tax_year, computed_state }]    # for time-travel
    significant_events: [{ date, type, impact }] # divorce, inheritance, etc
```

**Why this matters:** every lens reads from the same state. No lens has private data. Disagreements are about *interpretation*, not facts.

---

## 3. Lens interface

Every professional becomes a module implementing this interface.

```ts
interface Lens {
  id: string;                         // 'tax-accountant'
  name: string;                       // 'Tax Accountant'
  display_avatar: string;             // icon for UI
  expertise_domain: string[];         // ['income_tax', 'cgt', 'nic', ...]
  
  // STAGE 1 — observations: what THIS professional notices
  observe(state, asOfDate): Observation[];
  // returns: [{ type, severity, text, citation, finding_id }]
  
  // STAGE 2 — recommendations: ranked by THIS professional's value function
  recommend(state, asOfDate, objectives): Recommendation[];
  // returns: [{
  //   strategy_id, summary, impact: { gbp, time_horizon, certainty },
  //   risk: { reversibility, downside, complexity },
  //   citation: [HMRC_manual_ref, FA_section, ...],
  //   assumptions: { life_expectancy, returns, rule_stability },
  //   flip_conditions: 'if X then this advice reverses',
  //   FCA_boundary_note: string
  // }]
  
  // STAGE 3 — red flags: urgent items
  red_flags(state): RedFlag[];
  // returns: [{ urgency, action, deadline, cost_of_inaction_£ }]
  
  // STAGE 4 — what-if prompts: questions the user should ask
  what_if_prompts(state): string[];
  // returns: ['What if you sacrificed £20k into pension this year?', ...]
  
  // STAGE 5 — disagreement: where this lens conflicts with another
  disagree_with(other_recommendation, state): Disagreement?;
  // returns: { agree_on, disagree_on, driver_assumption, decision_for_user }
}
```

**Lens registry:**

```js
import { lens as taxAccountant } from './lenses/tax-accountant.js';
import { lens as pensionSpecialist } from './lenses/pension-specialist.js';
// ... 11 lenses

export const LENS_REGISTRY = [
  taxAccountant, pensionSpecialist, trustLawyer, ifaHolistic,
  mortgageAdviser, insuranceAdviser, investmentAdviser,
  crossBorderSpecialist, familyLawSpecialist,
  laterLifeAdviser, philanthropyAdviser
];

export function runAllLenses(state, asOfDate, objectives) {
  return LENS_REGISTRY.map(lens => ({
    lens_id: lens.id,
    observations: lens.observe(state, asOfDate),
    recommendations: lens.recommend(state, asOfDate, objectives),
    red_flags: lens.red_flags(state),
    what_if_prompts: lens.what_if_prompts(state),
  }));
}
```

---

## 4. Strategy registry

Strategies are first-class data, not code. Each strategy is a JSON file with metadata + a simulator function.

```yaml
StrategyDefinition:
  id: 'STRAT-PHASED-TFC'
  name: 'Phased tax-free cash crystallisation'
  domain: ['pension', 'drawdown']
  owning_lenses: ['pension-specialist', 'tax-accountant']
  
  applicability:
    # Predicate — returns true if persona can use this strategy
    expression: |
      persona.age >= 55
      AND persona.assets.investments.sipp.total > 0
      AND NOT persona.pension_history.crystallisation_events.includes('full_TFC')
    
  parameters:
    # Tunable inputs the user/UI can adjust
    crystallisation_years: { type: 'int', default: 10, min: 1, max: 30 }
    annual_chunk: { type: 'gbp', derived: 'sipp / crystallisation_years' }
    
  simulator:
    # Pure function: state -> state'
    function: 'simulators/phased_tfc.js'
    # Signature: (state, params, asOfDate) -> { new_state, side_effects, audit_trail }
    
  citation:
    primary: 'Pensions Tax Manual PTM063210'
    secondary: 'FA 2004 s.166'
    plain_english: 'You can crystallise pension in chunks instead of all at once. Each chunk is 25% tax-free + 75% taxable. Spread across years to stay in lower tax bands.'
    
  fca_boundary:
    note: 'Information only. Crystallisation is irreversible — speak to a qualified adviser before acting.'
    
  common_mistakes:
    - 'Crystallising all in one year and getting pushed into additional rate'
    - 'Not factoring in state pension when it starts'
    - 'Forgetting LSA limit of £268,275 across all crystallisations'
```

**Strategy file lives at `src/strategies/<strategy-id>.yaml`.** Engine loads all on startup. Validation: each strategy must have applicability + simulator + citation.

Total strategies in v1: **~150** (from the 26 Optimiser scenarios spec + 60 eligibility rules' "fix hints").

---

## 5. Impact function

The mathematical core. Given a strategy, what changes?

```ts
function simulate(state: PersonaState, strategy: Strategy, params: StrategyParams, asOfDate: Date): SimulationResult {
  // 1. Clone state
  const after = structuredClone(state);
  
  // 2. Apply strategy's transformations
  strategy.simulator(after, params, asOfDate);
  
  // 3. Recompute all engine outputs on after state
  const before_outputs = engineOutputs(state, asOfDate);
  const after_outputs = engineOutputs(after, asOfDate);
  
  // 4. Compute deltas across multiple dimensions
  return {
    before: before_outputs,
    after: after_outputs,
    delta: {
      net_worth: after_outputs.net_worth - before_outputs.net_worth,
      annual_tax: after_outputs.income_tax - before_outputs.income_tax,
      iht_exposure: after_outputs.iht_exposure - before_outputs.iht_exposure,
      annual_surplus: after_outputs.annual_surplus - before_outputs.annual_surplus,
      // ... ~20 metrics tracked
    },
    audit_trail: strategy.simulator.audit,  // every line of math
    assumptions_used: { ... },
    flip_conditions: { ... },
  };
}
```

**Audit trail is mandatory.** Every number changes can be traced back to its rule + formula. This is what makes us defensible (no hallucination) and trustworthy (user can verify).

---

## 6. Pareto / multi-objective ranker

Given N applicable strategies, rank them. But "rank" is multi-objective — no single ranking is right.

```ts
function rank(strategies: SimulationResult[], objectives: ObjectiveWeights): RankedStrategy[] {
  // 1. Normalise each metric to 0..1 across the candidate set
  // 2. Apply user-weighted objectives:
  //    score = w_income × Δ_income + w_growth × Δ_net_worth + w_legacy × (-Δ_iht) + ...
  // 3. Compute Pareto frontier — strategies where no other strategy dominates on ALL metrics
  // 4. Return frontier + dominated strategies labelled
  
  return strategies
    .map(s => ({ ...s, score: weightedScore(s, objectives), pareto_optimal: isOnFrontier(s, strategies) }))
    .sort((a, b) => b.score - a.score);
}
```

**UI implication:** user has objective sliders. Top-5 changes when sliders move. Always shows ranked list, but explicitly labels which are Pareto-optimal vs dominated.

---

## 7. Rationalise layer (LLM-mediated)

Lenses output structured data. Rationalise turns it into prose for the user.

**Constraints:**
- LLM can rephrase, NEVER invent numbers
- Every £ value in output must be traceable to engine
- Every claim must be cited
- FCA boundary line on every output

```ts
async function rationalise(recommendation, state, lens): Promise<RationalText> {
  const prompt = `
You are a ${lens.name} explaining a recommendation to a client.

Recommendation: ${JSON.stringify(recommendation)}
Client state (relevant fields): ${JSON.stringify(relevantState(state, recommendation))}
Citation: ${recommendation.citation}

Rules:
- Plain English, no jargon without explanation
- Use the £ values EXACTLY as given — do not round or recompute
- Cite the source in line: "(HMRC PTM063210)"
- End with: "Information only — speak to a qualified ${lens.name} before acting."
- 3-5 sentences for headline. Up to 200 words for drill-down.

Output JSON: { headline, drill_down, action_steps, caveats }
`;
  
  return await llm.complete(prompt, { model: 'deepseek-chat', temperature: 0.1 });
}
```

**Caching layer:** rationalise output is deterministic per (recommendation, state) hash. Cache for 30 days. Reduces cost dramatically.

---

## 8. Chart spec format

User said: "I want charts drawn up dynamically not prebuilt."

Charts become **data**, not React components:

```yaml
ChartSpec:
  type: 'auto'                   # let renderer pick best chart for this data shape
  # OR explicit:
  type: 'comparison_lines'       # line chart with N series
  type: 'sankey'                 # estate flow / income flow
  type: 'timeline'               # 7-year PET clock
  type: 'before_after_bars'      # 2-bar comparison
  type: 'heatmap'                # marginal rate by income
  type: 'gauge'                  # funded ratio
  type: 'tornado'                # sensitivity analysis
  type: 'monte_carlo_bands'      # probabilistic projections
  
  data: [{ x, y, series, label, ... }]
  
  semantics: 'iht_reduction_over_strategies'  # what this chart MEANS
  
  axes:
    x: { label, format, range }
    y: { label, format, range }
    
  annotations: [
    { x, y, text, type: 'threshold' | 'milestone' | 'cliff' }
  ]
  
  interactivity:
    - toggle_strategy
    - change_assumption
    - hover_tooltip
    - drill_down
```

**One generic renderer** in `src/components/ChartRenderer.jsx` reads a spec and renders. Adding a new chart type = registering a new sub-renderer, not duplicating code per use case.

LLM can produce chart specs on demand: "show me how my IHT changes if I gift £100k" → engine produces spec → renderer draws it.

---

## 9. Knowledge content layer

User said: "I want knowledge and information at the fingertips so that they don't need to go elsewhere."

A curated content store at `src/knowledge/`:

```
src/knowledge/
  glossary/
    isa.md
    sipp.md
    nrb.md
    ... (~200 terms)
  rules/
    income-tax/
      personal-allowance-taper.md
      basic-rate-band.md
      ...
    iht/
      rnrb.md
      seven-year-pet.md
      bpr.md
      ...
    pensions/
      annual-allowance.md
      mpaa.md
      lsa.md
      ...
  strategies/
    phased-tfc/
      explainer.md
      common-mistakes.md
      worked-example.md
      sources.md         # HMRC manual refs, FA sections
    ...
```

Every number in the UI has a "Why?" tap. Tap goes to the relevant knowledge file. Knowledge is **curated by domain experts**, **not LLM-generated** (hallucination risk on legal facts).

Lenses can cite knowledge entries — citation becomes a tappable chip.

---

## 10. Dialogue loop ("Ask Sonnu")

Top right of every screen: chat affordance.

```
User: "What if I retire at 60 instead of 65?"

→ Decision Engine FSM:
  IDLE → ONTOLOGY_MATCH (detect "retirement age change" pattern)
       → CONTEXT_GATHER (load Bruce's full state)
       → COMPOSER_PROMPT (build prompt with state + ontology rules)
       → CLAUDE_CALL (deepseek-chat or claude-sonnet)
       → PARSE (extract structured response)
       → VALIDATE (check numbers against engine — reject if mismatched)
       → SIMULATE (apply state change, recompute)
       → RATIONALISE
       → CHART_GENERATE (dynamic spec)
       → RESPOND

→ User sees:
  - Bruce's projection if retiring at 60
  - Side-by-side with current (65) plan
  - £ delta on income, savings depletion, IHT
  - Chart of net worth over both scenarios
  - "Want to explore further?" follow-up suggestions
```

Existing skeleton: `src/de/orchestrator.js` (DeepSeek's earlier work).
What's missing: ontology population, validator wiring to engine, chart-spec generation.

---

## 11. FCA guardrails as code

Every output passes through a guardrail layer before display.

```js
// src/guardrails/fca-boundary.js
export function applyFCAGuardrail(output) {
  // 1. Reject any phrase that crosses into "advice"
  const banned = [
    /you should (?!consider)/i,        // "you should consider" OK, "you should do X" not
    /this is the right (decision|choice)/i,
    /i recommend/i,                    // 'considered' or 'noted' is OK
    /best option for you/i,
  ];
  for (const re of banned) {
    if (re.test(output.text)) {
      throw new Error(`FCA boundary violation: pattern ${re}`);
    }
  }
  
  // 2. Ensure FCA boundary line present
  if (!output.text.includes('Information only')) {
    output.text += '\n\nInformation only — speak to a qualified adviser before acting.';
  }
  
  // 3. Ensure every £ value is traceable to engine
  const valuesInText = output.text.match(/£[\d,]+/g) || [];
  for (const v of valuesInText) {
    if (!output.engine_outputs.includes(v)) {
      throw new Error(`Untraceable value: ${v} not in engine outputs`);
    }
  }
  
  return output;
}
```

Tests verify guardrail rejects sample "advice" phrases and accepts compliant ones.

The `sonuswealth-compliance` skill audits the codebase periodically.

---

## 12. Cost model

**LLM calls per user session (estimate):**
- 11 lenses × ~3 rationalisations each = 33 LLM calls per "main view" load
- Dialogue loop = 1-5 calls per user question
- Chart spec generation = 0-2 calls per drill-down

**At DeepSeek-chat pricing (~$0.0005/call):**
- Cold session: ~$0.02
- Active session with 5 dialogue turns: ~$0.05

**With caching (30-day TTL on deterministic outputs):**
- Returning user: ~$0.001-0.005

**100 users × 4 sessions/month × $0.05 = $20/month.** Affordable.

**Caveat:** if rationalisation hits Claude Opus instead of DeepSeek for high-stakes outputs (e.g. estate planning), cost ×30. Need tiering.

---

## 13. MVP slice (the actually-shippable thing)

**Build budget: ~30 hours over 3-4 focused sessions.**

### MVP-1 (10 hours)
- Persona state schema formalised (extend existing JSON)
- **1 lens fully built: Tax Accountant**
  - observe(): 5-7 observation patterns
  - recommend(): 6 strategies wired
  - red_flags(): 3 flag types
  - what_if_prompts(): 4 prompts
- **1 chart type: before-after bars** (rendered via generic ChartRenderer)
- **1 strategy simulator: Phased TFC** (the founder's key example)
- **Rationalise layer with DeepSeek + caching**
- **FCA guardrail enforcement**
- HTML mock screen showing Bruce's Tax Accountant view

**Success criteria:**
- Tax Accountant lens produces 5+ observations on Bruce
- Top recommendation: "Phased TFC over 10 yrs saves £4,200/yr" — with engine-verified £ value, citation, FCA line
- Drill-down shows before/after bar chart
- No hallucination — every number traces to engine

### MVP-2 (8 hours)
- Add **Pension Specialist lens** + **Trust Lawyer lens** + **IFA lens**
- Show side-by-side panels (4 lenses)
- Show **disagreement detection** between Tax Accountant and Pension Specialist on SIPP IHT pre-2027
- Add **2 more chart types**: timeline (7-year PET clock), sankey (estate flow)

**Success criteria:**
- 4 lenses run on Bruce in <3 seconds
- One genuine disagreement surfaced with explanation
- Estate flow Sankey renders dynamically from data

### MVP-3 (8 hours)
- Add **dialogue loop** ("Ask Sonnu") for 5 canned what-ifs
- Add **knowledge content layer** with 20 entries (the ones cited by lens output)
- Mobile responsive layout

**Success criteria:**
- User can ask "what if I retire at 60?" and get a coherent answer
- Every cited rule has a tappable knowledge entry
- Mobile (480px) renders cleanly

### MVP-4 (4 hours)
- Add 3 more lenses (Investment, Protection, Cross-Border)
- Final polish, snap regression, demo recording

---

## 14. Risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| LLM hallucinates a tax rule | HIGH | Knowledge layer curated by experts, citations enforced, validator rejects untraceable numbers |
| FCA boundary breach in output | HIGH | Guardrail layer code-enforces, compliance skill audits, banned phrase list |
| Cost runaway | MEDIUM | Caching, tiered model usage (DeepSeek default, Claude only for high-stakes), spend cap per user |
| Lens disagreement confuses user | MEDIUM | Always provide a "decision aid" — what flips the answer |
| Performance — 11 lenses × 3 calls = 33 LLM calls | MEDIUM | Lens-level caching, parallel calls, progressive rendering |
| Strategy simulator bugs invalidate output | HIGH | Each simulator has unit tests with HMRC-published ground truth |
| Persona data incomplete = lens output thin | LOW | Lens declares "data needed" — UI prompts user to fill gaps |
| Practitioner panel can't validate 11 lenses fast | MEDIUM | Ship MVP-1 with single lens reviewed; staged rollout |

---

## 15. Open questions (need founder input before MVP-1 starts)

1. **Which 4 lenses for v0?** I propose: Tax Accountant, Pension Specialist, Trust Lawyer, IFA. Alternatives: drop Trust Lawyer, add Mortgage / Insurance / Investment depending on demo target.

2. **Which 1 lens fully built first?** I propose Tax Accountant — broadest applicability, easiest to verify (HMRC has a calculator we can match against).

3. **Demo persona priority?** Bruce (HNW retired) covers tax/IHT/pension. Catherine (couple business owner) covers Ltd director + spousal. Hugo (foundation) covers FTB/NI. All three or pick one to perfect first?

4. **DeepSeek or Claude for rationalisation?** DeepSeek cheap but arithmetic-weak (we already saw this). Claude expensive but accurate. Recommendation: DeepSeek for first pass, Claude for high-stakes outputs (estate planning specifically). Need founder approval on cost ceiling.

5. **Knowledge content authoring?** Each entry ~300 words + citations. ~200 entries × 30 min = 100 hours. Author yourself? Hire? LLM-draft + expert-review?

6. **Practitioner panel mechanism?** Referenced in vault notes but not yet operational. Each lens needs domain expert sign-off before flipping from EXPERIMENTAL → LIVE.

7. **Determinism vs LLM creativity?** Lenses must produce same recommendation for same state. But rationalise prose can vary. Where do we draw the line?

8. **Couples — one persona or two?** Mathematically two linked states. UI-wise probably one merged dashboard with "view from spouse's side" toggle.

---

## 16. What this replaces

This document replaces the previous `DEMO-V0-DEFINITION.md` which proposed 5 static Optimiser tiles. That approach was feature-list thinking. This is mechanism-thinking.

`DEMO-V0-DEFINITION.md` retained for reference but marked SUPERSEDED.

---

## 17. Sign-off

**Founder:** ___ approve / ___ adjust / ___ start over

**Order of build proceeds only after explicit sign-off + answers to the 8 open questions above.**

---

## 18. DECISIONS LOCKED — 2026-05-21 (founder response)

### Q1 — Lens activation: "they all need to come in when required — I don't know when"

**Decision:** Build all 11 lens shells from day 1. Each lens declares its own `is_relevant(persona) → score 0..1` predicate. A **router** runs the predicates against persona state and surfaces only relevant lenses for THIS user. Bruce gets 6/11 lenses (Tax, Pension, Trust, IFA, Investment, Later-Life). Hugo gets 4/11 (Tax, IFA, Mortgage, Protection). No hardcoded "v0 lens set."

**Implementation:**
```js
// Each lens implements
is_relevant(persona): { score: 0..1, reason: string }

// Router invokes
function routeLenses(persona) {
  return LENS_REGISTRY
    .map(lens => ({ lens, relevance: lens.is_relevant(persona) }))
    .filter(r => r.relevance.score > 0.3)
    .sort((a, b) => b.relevance.score - a.relevance.score);
}
```

**v0 doesn't pre-pick lenses.** It builds all 11 shells (~50 lines each, just the relevance predicate + skeleton methods) + Tax Accountant fully implemented (~500 lines). Other 10 lenses ship as shells; each is fleshed out as practitioner panel signs them off.

### Q2 — Tax Accountant first

Confirmed. MVP-1 builds Tax Accountant lens end-to-end. ~500 lines, citation-enforced, 6-8 observations + 6-8 strategies.

### Q3 — Mr T fixtures for validation

**Decision:** Use the 13 Mr T fixtures (already in `3-Engine/mrT-*.json`) as the canonical test bed for every lens. Each fixture has an `expected_output_envelope` block with pre-computed correct answers.

**Test contract:** every new lens must pass regression against ALL 13 Mr T fixtures before flipping EXPERIMENTAL → LIVE. Specifically:
- `expected_output_envelope.fq_score_range` matches engine output ± 2 points
- `expected_output_envelope.iht_projection` matches ± £1k
- Lens recommendations are deterministic across re-runs (same input → same output)
- No untraceable numbers in rationalised prose

Bruce, Catherine, Hugo become **demo personas only** (curated for narrative). Mr T fixtures are the **validation set**.

New test file: `tests/lens-mrT-regression.mjs` — runs every lens against every fixture. Replaces `test-persona-snapshots.mjs` as the gate for engine + lens correctness.

### Q4 — DeepSeek with arithmetic double-check

**Decision:** Engine is single source of arithmetic truth. LLM is text-only.

**Three-layer defence:**
1. **LLM cannot generate numbers.** Rationalisation prompt explicitly provides engine outputs. LLM rephrases — never recomputes.
2. **Post-rationalisation validator strips all £ values from LLM output and checks each against engine outputs.** Any £ value not in engine outputs = automatic rejection + retry with stricter prompt.
3. **Rule-validator (offline, deterministic) runs in parallel** and flags any computation that violates UK rule invariants (e.g. PA > £12,570, ISA > £20k, etc.).

```js
// src/guardrails/arithmetic-traceability.js
export function enforceArithmetic(llmText, engineOutputs) {
  const pounds = llmText.match(/£[\d,]+(\.\d+)?/g) || [];
  const known = new Set(formatAllOutputs(engineOutputs));
  for (const p of pounds) {
    if (!known.has(p)) {
      throw new ValidationError(`Untraceable value: ${p} not in engine outputs`);
    }
  }
  return llmText;
}
```

If DeepSeek's prose contains a number not in `engineOutputs`, the LLM hallucinated and we retry. This makes DeepSeek's arithmetic weakness irrelevant — it can't break what it can't compute.

**Backup model:** If DeepSeek output is rejected 3 times in a row for the same recommendation, fail over to Claude Sonnet 4.6 (more arithmetic-reliable, more expensive). Telemetry tracks failover rate.

### Q5 — Expert-authored knowledge content

**Decision:** Domain expert authors all knowledge content. No LLM generation of legal/tax facts. ~200 entries × 30 min = 100 hours of expert time.

**Phasing:** content authored alongside its consuming lens. Tax Accountant lens ships with ~30 tax-related knowledge entries (PA, NIC, ISA, dividend allowance, etc.). Pension Specialist ships with ~25 pension entries. Etc.

**Founder action:** identify/commission domain expert (or self-author if comfortable). Each entry follows a template:
```markdown
# Term
## Plain English
3 sentences max. No jargon without immediate definition.
## How it works
Bullet list of mechanics.
## Common mistakes
Bullet list of pitfalls.
## When this changes
Effective dates, anticipated future changes (e.g. SIPP IHT Apr 2027).
## Sources
- HMRC Manual ref
- Finance Act section
- Statutory instrument
```

Author quality more important than speed. 5 entries/week × 40 weeks = 200 entries. Or expert sprint.

### Q6 — Practitioner panel

**Decision:** Each lens stays EXPERIMENTAL until practitioner panel signs off. Sign-off requires:
- 30 representative cases reviewed
- 95%+ agreement between lens output and panel's independent verdict
- Documented edge cases where lens deviates and why
- Founder approval to flip flag

Until flipped, lens output displays an "EXPERIMENTAL — under expert review" banner. Honest.

Founder responsible for recruiting panel (already in vault notes — `PRACTITIONER-RECRUITMENT.md`). Budget TBD.

### Q7 — Determinism + challenge mechanism

**Decision:** Same input → same recommendation always. Rules are rules. BUT user can challenge any recommendation.

**Determinism enforcement:**
- LLM temperature = 0.0 for rationalisation
- Cached output for (state_hash, lens, asOfDate) — return cached result on re-call
- Rule outputs are pure functions of state — no random elements

**Challenge mechanism (UI):**
```
[Recommendation card]
"Sacrifice £20k into pension → save £10k tax"
[Why?] [Sources] [⚠ Challenge this]

[On tap "Challenge this":]
   - "What's wrong?"
     ○ The £ figure is wrong
     ○ The rule doesn't apply to me
     ○ There's a better strategy
     ○ I disagree with the reasoning
     ○ Other
   - Explain (free text)
   - [Submit]
   
[Submission goes to review queue:]
   - Practitioner panel reviews within 7 days
   - If valid: rule updated (versioned), all affected users see new output
   - If invalid: explanation sent to user
   - All challenges logged with disposition
```

**Database table:** `finio_rule_challenges` — challenger_id, recommendation_id, objection_type, free_text, status, panel_response, rule_version_before, rule_version_after.

Implementation: add to Supabase migration 011 (already drafted) + simple admin dashboard for panel.

### Q8 — Couples model: my decision

**Decision: 2 linked persona states + 1 merged dashboard.**

**Data shape:**
- Each spouse is a full PersonaState
- A `couple_link` block at top: marriage_date, jurisdiction_of_marriage, financial_arrangement (joint/separate), nomination_links (each spouse's SIPP/will beneficiaries)
- Engine functions accept `(personaA, personaB?)` — partner is optional second argument

**UI:**
- Main dashboard shows merged household view (combined NW, combined risk, combined IHT)
- Toggle: "View as [Spouse A] / [Spouse B] / Both"
- Each spouse has their own Optimiser screen (different tiles based on their state)
- Couple-specific tiles (e.g. Marriage Allowance) marked as 👥
- Lenses run twice (once per spouse) for individual-only recommendations
- Lenses run jointly (with both states) for couple-specific recommendations (spousal nil-rate, pension splitting, joint property)

**Transitions handled:**
- Divorce → unlink, optimiser re-routes (now shows divorced-* archetype patterns)
- Death → unlink, surviving spouse gets transferable NRB recomputed
- New marriage → relink

This is more work than single-persona-with-spouse-fields but mathematically clean. Worth it.

---

## 19. WHAT NOW

With Q1-Q8 locked, MVP-1 (~12 hours, was 10):

**Phase A (2 hrs):** Build lens-routing infrastructure
- `src/lenses/index.js` — registry
- `src/lenses/_base.js` — base class with shared methods
- 11 lens shells (each ~50 lines: relevance predicate + skeleton)
- Router function

**Phase B (5 hrs):** Build Tax Accountant lens fully
- ~6 observations
- ~8 strategies wired
- Citations to HMRC manual sections
- Rationalisation prompt + arithmetic guardrail
- ~30 knowledge entries (founder authors in parallel)

**Phase C (3 hrs):** Build validation
- `tests/lens-mrT-regression.mjs` — runs Tax Accountant against all 13 Mr T fixtures
- Deterministic re-run check (same input twice = same output)
- Arithmetic traceability validator
- Challenge mechanism scaffold (DB table + API endpoint)

**Phase D (2 hrs):** Build HTML mock screen
- Single page: persona selector + Tax Accountant view
- Observations panel
- Recommendations panel (top 5)
- Red flags strip
- "Challenge this" affordance on each recommendation
- "Ask Sonnu" placeholder

**Success criteria:**
- Tax Accountant lens runs on all 13 Mr T fixtures with deterministic output
- ≥6 observations on each fixture
- ≥3 recommendations with citations on each fixture
- Zero untraceable £ values in any output
- "Challenge this" submits to DB queue
- Re-run with same input = exact same output (byte-for-byte after caching)

After MVP-1, you (and ideally practitioner panel) review Tax Accountant output. If convincing, MVP-2 adds 3 more lenses. If not, we iterate Tax Accountant.

**Total path to demo-ready: ~30-40 hours across 4 sessions.**

---

*v2 — decisions locked 2026-05-21. Founder approved direction. Next session begins MVP-1 Phase A.*
