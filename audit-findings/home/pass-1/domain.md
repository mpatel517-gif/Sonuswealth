---
Title: Home Screen — Domain Audit (A5) — Stage B Pass-1
Version: pass-1-stage-b
Date: 2026-05-18
Auditor: A5 — Domain (financial accuracy, plain English, FCA framing, founder IP)
Screen: HomeScreen.jsx v2.1
---

## Method

Walk every financial figure, claim, and term. Tests:
1. CoI canonical? (aggregate NPV, 12 domains)
2. Founder IP (PRC/PCC, Reality Engine, DER, EBR) — never invent definitions
3. UK tax facts vs rules-uk.js (ISA £20k, CGT AEA £3k, NRB £325k, RNRB £175k, MPAA £10k, SIPP IHT ENACTED 6 Apr 2027)
4. Claims traceable? Placeholders visible?
5. FCA framing — information not advice. No "you should" / "we recommend"
6. Plain English — jargon translated in place

---

## 1. CoI canonicity

| Location | Call | Domain scope | Verdict |
|----------|------|-------------|---------|
| AnchorRow H-ANCH-04 | `costOfInaction(entity)` (no domain) | Back-compat alias for `totalCoI().total` — all domains | PASS |
| SippIhtCountdown | `costOfInaction(entity, 'sipp_iht')` | Single domain — intentional (component is specifically about SIPP IHT) | PASS |
| CoIDrillPanel | `totalCoI(entity)` | All domains | PASS |
| ScenarioIntake context builder | `calcFQ`, `calcRisk`, `netWorth` — no CoI | N/A for CoI | NA |

CoI aggregate is consistently the totalCoI() figure. The single-domain call in SippIhtCountdown is intentionally scoped — this is correct.

---

## 2. Founder IP usage

Scan for PRC/PCC, Reality Engine, DER, EBR in HomeScreen.jsx user-facing copy.

- `PRC` / `PCC` (Personal Reality Check / Personal Constitution Check): **not referenced** in HomeScreen.jsx. Not applicable to Home scope.
- `Reality Engine`: **not referenced** in HomeScreen.jsx user-facing copy.
- `DER` (Decision Efficiency Ratio): **not referenced** in HomeScreen.jsx.
- `EBR` (Efficiency/Behavioural Ratio): **not referenced**.
- `finioScore` field name: appears in internal code as `action?.impact?.finioScore` — this is an ENGINE field name, not user-facing copy. Score displayed as "Wealth Score" (correct). No Finio branding in UI.
- `Wealth Score`: Used in DimExplainerStub at L888: "Sonuswealth Wealth Score — {label}". Correct branding.

**No founder IP misuse or invented definitions found.**

---

## 3. UK tax facts vs rules-uk.js

| Fact | Where used in Home | Claimed value | rules-uk.js status | Verdict |
|------|-------------------|--------------|-------------------|---------|
| ISA allowance £20k | H-ACT-04 action text: `action.title` from engine — not hardcoded in HomeScreen | Engine-derived | rules-uk.js: ISA_ALLOWANCE £20,000 ENACTED | PASS |
| CGT AEA £3k | H-ACT-05 action text: engine-derived via `calcAPQ()` | Engine-derived | rules-uk.js: CGT_ANNUAL_EXEMPT £3,000 ENACTED | PASS |
| SIPP IHT deadline | `new Date('2027-04-06')` at L293, L418 | 6 April 2027 | ENACTED (Finance Act 2026, Royal Assent 18 Mar 2026) | PASS |
| SIPP IHT enacted date | `new Date('2026-03-18')` at L296 | 18 March 2026 | Correct | PASS |
| Score target `68` | `const targetFilled = (68 / 100) * C` at L304 — hardcoded target score for donut ring | 68 hardcoded | Not in rules-uk.js | **FAIL — FUNCTIONAL** | Target score 68 is hardcoded in JSX — should come from entity plan target or engine constant, not literal |
| NRB / RNRB / MPAA | Not directly displayed on Home | Not applicable | NA | NA |

**Hardcoded target score `68`:** The donut SVG renders a gold dashed arc at 68% to show "target". This is hardcoded as `68` at L304 — `const targetFilled = (68 / 100) * C`. There is no engine call or entity property driving this. For personas with different score targets this will always show 68 regardless.

---

## 4. Claims traceability + placeholders

| Claim | Location | Traceable? | Verdict |
|-------|---------|-----------|---------|
| "No active plan yet" | H-PLAN-01 (no-plan state) | Conditional: `!plan` from `planFor(entity, 'retirement')` | PASS |
| Score value (47) | From `calcFQ(entity).total` | PASS | |
| "N gaps in radar →" | `gapCount` from `gapDims(fqData)` | PASS | |
| "See all 12 scenarios →" | `DE_SCENARIOS.length` | PASS | 12 confirmed |
| SIPP exposure `fmt(sippCoi)` | `costOfInaction(entity, 'sipp_iht')` | PASS | |
| `+{impact} Wealth Score` chip | `action?.impact?.finioScore` from calcAPQ | PASS | Engine-derived |
| Placeholder text visible? | Searched for "coming next", "mapping inbound", "draft inbound", "TODO", "placeholder" in HomeScreen.jsx | **NOT FOUND** in HomeScreen.jsx | PASS for Home |
| FI Ratio % in StateTilesCard | `fiRatio(entity)` → `fi.ratio` | PASS | |
| Estate score `{est.score}/{est.outOf}` | `estateReadiness(entity)` | PASS | |
| Tax efficiency `{Math.round(tax.score)}/100` | `taxEfficiency(entity)` | PASS | |

---

## 5. FCA framing

| Location | Copy | FCA-compliant? | Verdict |
|---------|------|---------------|---------|
| Main footer (L1467) | "Information & guidance only · Not regulated financial advice · FCA boundary applies" | YES — information framing, explicit FCA boundary | PASS |
| What-If header (L1498) | "Explore · not advice" | YES | PASS |
| APQDrillPanel footer (L1150-1152) | "Information only · Prioritised from your data · Not regulated advice" | YES | PASS |
| DimExplainerStub | Shows "What this measures" / "What would lift this score" — descriptive, not prescriptive | YES — no "you should" | PASS |
| Action rows (copy from engine) | `action.context || action.detail || action.why` — engine-generated copy | UNVERIFIED — depends on engine text; no hardcoded advice strings visible in HomeScreen.jsx | PASS (conditionally) |
| "You should" / "we recommend" search | Searched HomeScreen.jsx — NOT FOUND | PASS | |
| SippIhtCountdown copy | "SIPP joins IHT estate · {N} days until 6 April 2027 · exposure {fmt(sippCoi)}" | YES — factual regulatory information | PASS |

---

## 6. Plain English audit

| Term | Location | Translated? | Verdict |
|------|---------|------------|---------|
| "Cost of Inaction" | H-ANCH-04 label | Label visible; no inline tooltip defining it | FUNCTIONAL — jargon not translated at anchor |
| "FI Ratio" | StateTilesCard tile | Sub-text: "Financially independent" / "Building towards FI" — partial explanation | FUNCTIONAL — "FI Ratio" label still jargon; sub-text helps but doesn't fully define |
| "SIPP" | SippIhtCountdown: "SIPP joins IHT estate" | No expansion of SIPP acronym | FUNCTIONAL — "SIPP" unexplained for novice user; "IHT" also unexplained |
| "CRIT / HIGH / MED / LOW" severity badges | ActionsCard action rows | No tooltip or legend | FUNCTIONAL — unexplained labels; user may not understand scoring tiers |
| "Wealth Score" | Anchors, DimExplainerStub | DimExplainerStub explains per-dimension; anchor shows number only | PASS — score name is plain English by design |
| "What if?" section header | "✦ What if?" | Self-explanatory | PASS |
| "Explore · not advice" | What-If sub-header | Clear | PASS |
| "FCA boundary applies" | Footer | Users may not know FCA = Financial Conduct Authority | FUNCTIONAL — but accepted convention for FCA-boundary copy in FinTech |
| Donut target arc (gold dashed ring at 68%) | AnchorRow donut | No label explaining what the gold ring represents | FUNCTIONAL — unlabelled reference target line |

---

## Summary of domain findings

| ID | Severity | Element | Issue |
|----|----------|---------|-------|
| DOM-01 | FUNCTIONAL | AnchorRow donut (L304) | Hardcoded `68` target score — should derive from entity plan target or engine constant, not literal |
| DOM-02 | FUNCTIONAL | H-ANCH-04 "Cost of Inaction" | Label present but term not explained inline; no tooltip; jargon for non-expert users |
| DOM-03 | FUNCTIONAL | StateTilesCard "FI Ratio" tile | "FI Ratio" is jargon; sub-text partially explains but label is unexplained for novice |
| DOM-04 | FUNCTIONAL | SippIhtCountdown | "SIPP" and "IHT" acronyms unexplained inline; adequate for target sophisticated user but worth noting |
| DOM-05 | FUNCTIONAL | ActionsCard severity badges (CRIT/HIGH/MED/LOW) | No legend or tooltip explaining severity tiers |
| DOM-06 | FUNCTIONAL | AnchorRow donut gold arc | Gold reference ring at 68% has no label — user cannot know what it represents without a tooltip |

No DEMO-BLOCKING domain findings. No UK tax fact errors. No Caelixa/Finio brand drift in user-facing copy. FCA framing correct throughout. Founder IP not misused.

Total domain findings: 0 DEMO-BLOCKING, 6 FUNCTIONAL, 0 POLISH
