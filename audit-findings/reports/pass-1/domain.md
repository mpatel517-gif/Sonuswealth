# A5 — Domain Audit · Reports · Pass 1
**Date:** 2026-05-18
**Auditor:** A5 (Domain)
**Source:** `src/screens/Reports.jsx` · `src/config/brand.js` · `reports-inventory-v1.md`
**Checks:** FCA framing, "you should" language, UK tax figures, plain English, Phase 2 FCA disclaimer presence

---

## 1. FCA framing — estimates only

**Requirement (FD-RP-3):** Every tax-touching surface must carry `BRAND.disclaimer` = "Not regulated financial advice. Verify decisions with a qualified UK financial adviser."

### Current status
`BRAND` is not imported in Reports.jsx (no import statement; engine imports commented at line 21 only). The disclaimer string does not appear anywhere in the JSX — not verbatim, not by reference, not approximated.

**Affected report types (all tax-touching per FD-RP-3):**
- Estate plan — IHT, SIPP, estate tax (TAX-TOUCHING)
- Tax summary — income tax, CGT, ISA allowances (TAX-TOUCHING)
- Cashflow projection — pension drawdown, sustainable spend (TAX-TOUCHING)
- Custom report — depends on sections; must inherit disclaimer if any tax section included (TAX-TOUCHING conditional)

**Net Worth:** FD-RP-3 marks "borderline — flag for founder ruling." Not counted as required yet.

**Verdict:** **DEMO-BLOCKING.** FCA disclaimer absent on a screen previewing 4 tax-touching report types. Screen is one tap from demo. This is the highest-severity domain defect.

**Fix:** Add `import { BRAND } from '../config/brand.js'` and render `BRAND.disclaimer` in the footer, after RP-FOOT-01 line.

---

## 2. "You should" language check

Scanned all body copy in REPORT_TYPES array and all UI strings in JSX:

| String | "You should" / directive language? |
|--------|----------------------------------|
| Estate plan body (line 27) | No directive. Descriptive: "A snapshot of your IHT exposure…" |
| Tax summary body (lines 33–34) | No directive. "Use it for your SA filing or hand to your accountant" — informational suggestion, not advice. |
| Cashflow projection body (lines 39–40) | No directive. Descriptive. |
| Net Worth body (lines 45–46) | No directive. "Good for personal records and family conversations" — informational framing. |
| Custom report body (line 51) | No directive. |
| Intro copy (lines 102–106) | No directive. "you'll be able to share" — permissive, not prescriptive. |
| Banner copy (lines 96–99) | No directive. |
| Footer (line 196) | No directive. |

**Verdict:** PASS. No "you should," "you must," "we recommend," or similar directive language present. Tax summary's "Use it for your SA filing" is borderline but reads as informational use-case, not regulated advice. No further action.

---

## 3. UK tax figures correctness

**No tax figures are rendered in the stub.** All engine imports commented. Body copy describes *what* a report will contain but cites no figures. For example:

- "Income tax, allowances, dividends, CGT, pension contribution headroom" — category labels, not amounts
- "IHT exposure, gifts, nominations, will and LPA status" — category labels, not amounts

The only UK tax fact cited is the SIPP-IHT effective date:

**"SIPP enters estate from April 2027 (enacted)"** (line 27)
- Source-check against memory `project_sipp_iht_enacted_2026`: Royal Assent 18 March 2026; effective 6 April 2027.
- `BRAND.nextRulesDate = '2027-04-06'` confirms April 2027.
- Fact is **correct** as of audit date (2026-05-18).
- The `(enacted)` qualifier is accurate.

**Verdict (domain):** PASS — fact correct. A6 flags the hardcoding risk separately (FUNCTIONAL).

**Phase 2 risk:** When allowances appear in Tax summary report (RP-TAX-09), figures MUST come from `rules-uk.js` / `tax-2026.json` per memory `feedback_always_check_rules_uk`. The ISA allowance (£20K), CGT allowance (£3K), annual pension allowance etc. must never be hardcoded in a PDF template. Enforce at Phase 2 code review.

---

## 4. Plain English for report terminology

| Term | Plain English? | Issue |
|------|---------------|-------|
| "Estate plan" | Yes | Clear |
| "IHT exposure" | Partial | "IHT" is an acronym. Body says "plain English with the technical detail in an appendix" which addresses this — the report itself will define it. On-screen preview acceptable. |
| "LPA status" | Partial | "LPA" (Lasting Power of Attorney) undefined on screen. Low risk — used in category label only. |
| "funded-ratio" | Fail (POLISH) | Jargon. No inline gloss on screen. Target audience includes non-experts. S-05. |
| "sustainable spend rate" | Acceptable | "Sustainable" + "spend rate" are plain English composites. No gloss needed. |
| "wrapper" | Fail (POLISH) | Financial jargon (ISA/pension/GIA wrapper). No inline gloss. S-05. |
| "SA filing" | Acceptable | "SA" (Self Assessment) context clear from "your accountant" nearby. |
| "pension contribution headroom" | Acceptable | "Headroom" in plain English; pension context clear. |
| "D-RPT-EXPORT-1" | Fail (POLISH) | Internal spec reference visible in footer ("PDF/CSV export coming in Phase 2 (D-RPT-EXPORT-1)"). Jargon at top layer. |

**Summary:** 3 POLISH plain-English issues. "funded-ratio" and "wrapper" share S-05. "D-RPT-EXPORT-1" is a new internal-code leak at top layer.

---

## 5. Phase 2 FCA disclaimer — Estate report specifically

**FD-RP-3 requirement:** `BRAND.disclaimer` must appear on Estate plan, Tax summary, Cashflow projection, and Custom (if tax sections included).

**Current status (stub):** RP-EST-09, RP-TAX-10, RP-CF-10 — all BLOCKED (Phase 2 scope). The on-screen stub has no disclaimer at all (see finding 1 above).

**Fix required before demo:** Add screen-level disclaimer now (not Phase 2 deferral). The screen *previews* 4 tax-touching report types. Even in stub phase, a viewer sees the screen and might act on the preview descriptions. FD-RP-3 does not say "disclaimer only when reports are generated" — it says "Tax-touching reports must carry FCA disclaimer." The screen exists; the disclaimer must exist.

---

## 6. New domain findings

| ID | Finding | Severity |
|----|---------|---------|
| DOM-01 | `BRAND.disclaimer` absent from screen entirely. Reports previews 4 tax-touching report types with no FCA framing. | **DEMO-BLOCKING** |
| DOM-02 | "D-RPT-EXPORT-1" internal spec code exposed in footer — jargon at top layer. Remove or replace with plain-English copy. | POLISH |
| DOM-03 | "LPA" acronym unclarified in Estate tile body. Low risk in preview context; needs inline expansion in Phase 2 report body. | POLISH |
| DOM-04 | Phase 2 Tax summary allowance figures (£20K ISA, £3K CGT) must come from rules-uk.js / tax-2026.json — NEVER hardcoded in PDF template. Must be enforced as pre-ship gate at Phase 2 code review. | FUNCTIONAL (Phase 2 gate) |

---

## Summary

| Check | Result |
|-------|--------|
| FCA framing / disclaimer present | FAIL — DEMO-BLOCKING |
| "You should" / directive language | PASS |
| UK tax figures correct | PASS (no figures in stub; SIPP date correct) |
| Plain English | 3 POLISH issues (funded-ratio, wrapper, D-RPT-EXPORT-1) |
| Phase 2 FCA disclaimer (estate report) | BLOCKED but screen-level fix needed now |
