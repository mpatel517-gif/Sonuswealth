# Reports — Spec-vs-Code Gap Audit

**Spec:** `2-Product-reports-v1_1.md` (695 lines)
**Code:** `src/screens/Reports.jsx` (208 lines — explicitly Phase 2 stub)
**Audit date:** 2026-05-23

---

## HEADLINE

Reports is **honestly stubbed** — header comment declares Phase 2, buttons disabled + labelled "Coming next — Phase 2", §9 CTA-honesty rule respected. All 5 report types catalogued with descriptions, but no generation engine. Spec defines 5 templates (Estate / Tax / Cashflow / NW / Custom), generation flow, AI narrative rules, artefact data model, IFA white-label, PDF+CSV export (D-RPT-EXPORT-1). **Estimated effort to ship Phase 2: 2 weeks.**

---

## §3 — Report types (v1.0 catalogue)

| Report | Code | Verdict |
|---|---|---|
| Estate Plan | listed in REPORT_TYPES :27 | 🟡 STUB (description only) |
| Tax Summary | listed | 🟡 STUB |
| Cashflow Projection | listed | 🟡 STUB |
| Net Worth Snapshot | listed | 🟡 STUB |
| Custom Report | listed | 🟡 STUB |

**5 of 5 templates catalogued as Phase-2 stubs with full descriptions. Zero generation logic.**

---

## §4 — Report template catalogue

| Template | Spec § | Code | Verdict |
|---|---|---|---|
| RPT-ESTATE-1 | §4.1 | description only | 🟡 STUB |
| RPT-TAX-1 | §4.2 | description only | 🟡 STUB |
| RPT-CASHFLOW-1 | §4.3 | description only | 🟡 STUB |
| RPT-NW-1 | §4.4 | description only | 🟡 STUB |
| RPT-CUSTOM-1 | §4.5 | description only | 🟡 STUB |

---

## §5 — Report generation flow

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Generation flow | §5 | not built | ❌ MISSING |
| Generation timing (on-demand + weekly/monthly schedule) | §5.1 | not built | ❌ MISSING |
| `onGenerate?.(reportId, mode)` contract | code comment §8 | not wired | 🟡 PARTIAL — contract documented, not built |
| Period selector (Tax year / Calendar year / Custom) | comment | not built | ❌ MISSING |

---

## §6 — AI narrative rules (D-REPORTS-NARRATIVE-1)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Governing principle (narrative is commentary, never source of truth) | §6.1 | declared in code header | 🟡 PARTIAL — declared, enforcement not present |
| Narrative sections per template | §6.2 | not built | ❌ MISSING |
| FCA boundary in narrative | §6.3 | not built | ❌ MISSING |
| v1.0 narrative approach (O-RF-3) | §6.4 | not built | ❌ MISSING |

---

## §7 — Report artefact data model

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Artefact data model schema | §7 | not built | ❌ MISSING |
| Artefact stored in Document Vault per §4.3 Vault spec | §7 + Vault | not wired | ❌ MISSING |

---

## §8 — IFA delivery + white-label

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| IFA access flow | §8.1 | not built | ❌ MISSING |
| White-label (practice logo, footer, contact) | §8 | not built | ❌ MISSING |

---

## Engine reads required (per code comment)

`netWorth · ihtDynamic · costOfInaction · incomeTax · cashflowHealth · trajectoryData · calcFQ · calcRisk` — **all exist** in fq-calculator.js. Generation wiring just needs to call them.

---

## Materiality threshold

Spec: £500 or 0.5% NW. Code comment confirms. **Implementation pending.**

---

## Top 5 gaps to close

1. **Build generation engine** — wire `onGenerate(reportId, mode)` → engine functions → PDF + CSV export. **Effort: 1 week.**
2. **AI narrative integration** with FCA-rewrite layer + commentary-not-source-of-truth enforcement. **Effort: 3 days.**
3. **Artefact data model + Vault integration** — write generated reports to Vault per D-RF-4. **Effort: 3 days.**
4. **IFA white-label** — practice logo, footer, contact details on output. **Effort: 2 days.**
5. **Scheduling** — weekly / monthly auto-generation with delivery to email + Vault. **Effort: 3 days.**

---

## Founder open items

§0.2 lists open items; v1.0 has 1 narrative open (O-RF-3) — closed at v1.0 per spec.

---

## Nice-to-haves observed

1. **Report diff view** — compare this-quarter Estate Plan to last-quarter
2. **One-page executive summary** for any report
3. **Audio summary** (60-sec narration of the report headline)
4. **HMRC-friendly format** — Tax Summary in a format the user's accountant accepts directly
5. **Voyant-style export** — for IFAs migrating from competing tools
6. **Annotated PDF** — IFA can mark up before sending to client
7. **Multi-language export** — Hindi / Gujarati for Caelixa cross-border personas

---

## Foundational soundness verdict

Reports is **a Phase 2 placeholder honestly labelled**. Engine reads available, contract documented, templates catalogued. **2 weeks to ship Phase 2.**

---

*Audit complete: 2026-05-23.*
