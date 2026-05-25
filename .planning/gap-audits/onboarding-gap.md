# Onboarding — Spec-vs-Code Gap Audit

**Spec:** `2-Product-onboarding-v1_1.md` (881 lines)
**Code:** `src/screens/Onboarding.jsx` (553) + `Welcome.jsx` (233) + `Account.jsx` (194) + `PersonaSelect.jsx` (271)
**Audit date:** 2026-05-23

---

## HEADLINE

Onboarding is **the thinnest core flow** relative to spec ambition. Spec v1.1 defines a sophisticated multi-mode onboarding: (a) public-hook funnel (April 2027 IHT calculator hook), (b) IFA practice signup + per-client document-first onboarding (with Voyant migration scope), (c) universal flow with 7 base questions + Q5b conditional + jurisdiction routing + RH trees + partner/relationship history + Q-A1..Q-A7 archetype-driving questions. Current code has a single linear questionnaire with stages: stageFor (age), RevealScreen (answers), pickers (currency/multi/single). It's a one-mode prototype. **The spec describes a v1.1 product; the code is closer to a v0.3 prototype.** Estimated effort to ship spec-compliant Onboarding: **3–4 weeks.**

---

## §HOOK — Public hook funnel handoff

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Hook #1 — April 2027 IHT calculator | §HOOK.1 | not present | ❌ MISSING |
| Hook handoff into onboarding (transfer state) | §HOOK.2 | not present | ❌ MISSING |
| Hook event schema (correlation_id chain) | §HOOK.3 | not present | ❌ MISSING |

**Public marketing hooks not wired to onboarding.** This is the founder's strategic acquisition flow. Without it, onboarding is purely organic.

---

## §IFA — IFA path (document-first)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| IFA practice signup flow | §IFA.2 | not present in Onboarding.jsx — would route via IFAPractice.jsx | ❌ MISSING from Onboarding |
| Per-client document-first onboarding | §IFA.3 | not present | ❌ MISSING |
| Voyant migration import (v1.0 scope) | §IFA.4 | not present | ❌ MISSING |
| What IFA path does NOT include (v1.0) | §IFA.5 | n/a | n/a |
| IFA path event schemas | §IFA.6 | not present | ❌ MISSING |

**No IFA-specific onboarding path.** Founder spec'd this in detail (Voyant migration is a serious enterprise-go-to-market feature). Currently end-user-only.

---

## §2 — Full screen sequence (v1.1 revised)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Multi-screen sequence (~16 screens per spec) | §2 | linear questionnaire, ~7 stages | 🟡 PARTIAL — base structure exists, screen-count short |
| Section delimiters / progress | §2 | basic step counter | 🟡 PARTIAL |
| Reveal screen (archetype + score summary at end) | spec §12 | `RevealScreen` :152 + `ScoreTile` :227 + `SummaryRow` :253 | ✅ PRESENT |

---

## §3 — Entry-mode picker

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Entry-mode picker (public hook / IFA / direct / demo) | §3 | not present | ❌ MISSING |

---

## §4 — Jurisdiction routing

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Jurisdiction selector (UK / India / cross-border) | §4 | not present | ❌ MISSING |
| JQ4 removed at v1.1 | §4 | n/a | n/a |

---

## §5 — Language selection

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Language picker (English / Hindi / Gujarati per Caelixa context) | §5 | not present | ❌ MISSING |

---

## §6 — Universal flow (7 base + Q5b conditional)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| 7 base questions universal flow | §6 | linear flow exists; question count needs alignment with spec | 🟡 PARTIAL |
| Q5b conditional branching | §6 | not visible in grep | ❌ MISSING |
| Currency slider | §6 | `CurrencySlider` :267 | ✅ PRESENT |
| Multi-picker / Single-picker | §6 | `MultiPicker` :294 + `SinglePicker` :336 | ✅ PRESENT |

---

## §7–§9 — RH trees, partner, relationship history

| Feature | Spec | Code | Verdict |
|---|---|---|---|
| RH (Relationship History) trees | §7 | not visible | ❌ MISSING |
| Partner data collection flow | §8 | not visible (only 1 grep hit) | ❌ MISSING |
| Relationship history (past partners, dependants, prior marriages) | §9 | not visible | ❌ MISSING |

---

## §10 — Archetype-driving questions (Q-A1..Q-A7)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Q-A1..Q-A5 carried from v1.0 | §10 | classifier-driving questions exist in the linear flow (5 picker-style) | 🟡 PARTIAL — questions may map to Q-A* but binding unverified |
| Q-A6 NEW v1.1 | §10 | not visible | 🟡 PARTIAL |
| Q-A7 NEW v1.1 | §10 | not visible | 🟡 PARTIAL |

---

## §11 — Classifier pseudo-logic

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Archetype classifier | §11 | `stageFor(age)` :22 returns life-stage chip; full archetype classifier not present | 🟡 PARTIAL — life-stage only, not 5-archetype mapping |

---

## §12 — Archetype confirmation + welcome

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Archetype confirmation screen | §12 | `RevealScreen` :152 | ✅ PRESENT (basic) |
| Score tile + summary rows | §12 | wired | ✅ PRESENT |
| Edit-archetype flow | §12 | needs verification | 🟡 PARTIAL |

---

## §D — D-DEMO-HIDDEN-1 enforcement

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Demo-mode hidden enforcement | §D | needs grep | 🟡 PARTIAL |

---

## §Q1A — Screen purpose checklist (X25)

| Feature | Code | Verdict |
|---|---|---|
| X25 purpose binding on every screen | not visible in onboarding | ❌ MISSING |

---

## §Q1B — Single-source contracts

| Feature | Code | Verdict |
|---|---|---|
| Onboarding writes to event store with correlation_id chain | needs grep | 🟡 PARTIAL |

---

## §Q4 — Timestamping + correlation_id

| Feature | Code | Verdict |
|---|---|---|
| Every onboarding event has correlation_id | needs grep | 🟡 PARTIAL |

---

## Cross-screen contract

Onboarding writes to:
- entity (persona) — initial creation
- archetype classification → drives persona variant on every other tab

Verdict: writes exist but archetype-driven persona-variant downstream effects unverified.

---

## Top 5 gaps to close

1. **Build IFA path** — practice signup + per-client document-first onboarding + Voyant migration import. **Effort: 2 weeks.** This is a strategic enterprise feature.
2. **Build entry-mode picker** — public-hook / IFA / direct / demo branching. **Effort: 3 days.**
3. **Add jurisdiction routing + language selection** — UK / India / cross-border with Hindi/Gujarati. **Effort: 4 days.**
4. **Build RH trees + partner + relationship history flows** (§7-§9). **Effort: 1 week.**
5. **Expand archetype classifier** from life-stage-only to 5-archetype matrix (Q-A1..Q-A7). **Effort: 4 days.**

---

## Founder open items

§0.5 lists round-2 gaps closed + round-3 expected gaps. Round-3 work not yet started.

---

## Nice-to-haves observed

1. **Skip-to-import flow** — power users with existing financial data export (Voyant, FE Analytics, Selectapension) can skip 90% of questions
2. **Demo-mode toggle** — let prospects play with Bruce Wayne data without committing real info
3. **Onboarding pause + resume** — currently linear; let users save partway and resume
4. **Onboarding shareable link** — IFA can send a personalised link to a client with practice context pre-filled
5. **Couple onboarding** — both partners onboard in parallel sessions with sync
6. **Migration audit** — show Voyant-imported field mappings + flagged anomalies before commit

---

## Foundational soundness verdict

Onboarding is the **biggest spec-to-code gap** of any tab audited. Spec is v1.1 ambitious; code is a thin linear questionnaire. This is acceptable for a demo/prototype but blocks any kind of regulated launch. **Estimated 3–4 weeks** to bring Onboarding to spec compliance.

---

*Audit complete: 2026-05-23.*
