# A5 — Domain Audit · DataCapture · Pass 1
**Auditor:** A5 (Domain)
**Date:** 2026-05-18
**Component:** `src/screens/DataCapture.jsx`
**Checks:** financial terminology, no-advice framing, FCA boundary, plain English, macOS principle (no internal codes at top layer)

---

## 1. Financial terminology — channel body copy

### Upload tile
> "PDF statements, contract notes, valuation reports, will or LPA scans. Native parser → AI parse → OCR fallback → manual edit."

**ISSUE DOM-01 (FUNCTIONAL):** `LPA` is an acronym for Lasting Power of Attorney — unglossed in badge and body copy. Most users aged 30–55 (target) may not know this acronym. Should be "LPA (Lasting Power of Attorney)".

**ISSUE DOM-02 (FUNCTIONAL):** "Native parser → AI parse → OCR fallback → manual edit." is a technical pipeline description, not user-facing benefit language. Users do not need to know the vendor pipeline fallback chain. This is developer-internal logic surfaced as product copy. Violates macOS principle: internal mechanics at top layer. Should be simplified to e.g. "We extract key values from your document automatically."

### Scan tile
> "Phase 1 — single image upload. Phase 2 will add viewfinder + perspective correction + multi-page per 2-Product-document-scan-v1_0.md."

**ISSUE DOM-03 (FUNCTIONAL):** `2-Product-document-scan-v1_0.md` — internal spec filename is visible to users. Hard violation of macOS principle: internal document references must never appear in user-facing copy. Remove the spec filename entirely.

### Connect tile (Phase 2)
> "Pull balances + holdings via Open Banking and broker APIs. TrueLayer · Yapily · Salt Edge · India AA · Phase 2 (D-DC-CONNECT-1)."

**ISSUE DOM-04 (FUNCTIONAL):** `D-DC-CONNECT-1` internal code visible to user. macOS principle violation.

**ISSUE DOM-05 (POLISH):** "TrueLayer · Yapily · Salt Edge · India AA" — listing vendor names in a Phase 2 placeholder is premature. Users clicking this tile see "Phase 2" stub. Vendor branding in a non-functional tile could mislead users into thinking these integrations exist today. Should be abstracted: e.g. "Open Banking and broker connections."

### Voice tile (Phase 2)
> "Hands-free capture — say the wrapper, amount, and date; we fill the form. Phase 2 (D-DC-VOICE-1)."

**ISSUE DOM-06 (FUNCTIONAL):** `D-DC-VOICE-1` internal code visible. macOS principle violation.

**ISSUE DOM-07 (POLISH):** "say the wrapper" — "wrapper" is financial/internal jargon at the top layer. Users unfamiliar with the term will not understand what to say. Body copy should say "say the account type, amount, and date."

---

## 2. FP-5 contract card

### Rule labels
| Label | Assessment |
|-------|------------|
| Confidence | Plain English. Acceptable — the description explains it. ✓ |
| Provenance | Semi-technical but context makes it clear ("where it came from"). Borderline. POLISH |
| De-duplication | Technical term. No explanation of what "prior values" means in practice. POLISH |
| Partial acceptance | Plain English. ✓ |
| Manual fallback | Plain English. ✓ |

**ISSUE DOM-08 (POLISH):** "Provenance" — domain jargon. Consider "Origin" or "Source" for lay users. Rule description is clear but the label stands alone in bold.

**ISSUE DOM-09 (POLISH):** "De-duplication" — technical. Consider "No double-counting" which conveys the same protection in user terms.

### FP5_HONESTY footnote
> "Dedup, provenance, and step-up auth wiring — Phase 2 (D-DC-PROV-1)."

**ISSUE DOM-10 (FUNCTIONAL):** Three violations in one line:
1. `D-DC-PROV-1` — internal code visible to user.
2. "step-up auth wiring" — developer jargon ("auth wiring").
3. "Dedup" — abbreviation of "De-duplication"; acceptable in tech contexts but not lay copy.

Recommended replacement: "Full duplicate-check, origin tracking, and two-step verification are coming in the next release."

---

## 3. FP-5 verification modal — wrapper chips

**ISSUE DOM-11 (FUNCTIONAL):** Wrapper chips display raw codes: `SIPP`, `ISA`, `GIA`, `CASH`, `PROPERTY`, `BOND_ON`, `EIS`, `VCT`.
- `BOND_ON` — not a standard UK financial term; appears to be an internal code for a bonded-on/loan arrangement. Completely opaque to users.
- `EIS` / `VCT` — Enterprise Investment Scheme / Venture Capital Trust. Known to sophisticated investors but not lay users. Should be glossed.
- `GIA` — General Investment Account. Not a term most users know by acronym.

At minimum: `BOND_ON` = DEMO-BLOCKING if it appears in a demo (it will, since mock generic fallback uses `null` wrapper, but mortgage/BTL mock use it). Actually `BOND_ON` appears in `WRAPPERS` list in manual form only, not in mock parser output — mock uses `null` for non-wrapper fields. Manual form exposes it to all users as a selectable option.

**REVISED SEVERITY:** `BOND_ON` in manual form WRAPPERS = DEMO-BLOCKING if a founder-demo user picks it and has no idea what it means. It is a meaningless internal code to lay users.

---

## 4. FCA boundary check

**Screened text for advice framing:**

| Location | Copy | Assessment |
|----------|------|------------|
| Subtitle | "Three ways in. Pick whichever fits the document." | Information. ✓ |
| Upload body | "Native parser → AI parse → OCR fallback" | Technical — no advice. ✓ |
| Manual body | "High-trust path. Anything you type is treated as confirmed." | Information. ✓ |
| FP-5 rule 3 | "Re-uploading the same statement updates the prior values, not duplicates them." | Information. ✓ |
| FP-5 rule 4 | "Accept only the fields you trust." | User direction, not investment advice. ✓ |
| FP-5 honesty | "…step-up auth wiring…" | No advice. ✓ |
| Parse warning | "DEMO PARSE — invented values (mock parser). Real OCR is Phase 2." | Honest disclaimer. ✓ |
| Manual form subtitle | "Manual entries are stored at full confidence (1.0)." | Information. ✓ |

**FCA boundary assessment:** No advice framing detected. Screen correctly positions itself as data ingestion, not guidance. FCA boundary respected. ✓

**Note:** No regulatory disclaimer (`BRAND.disclaimer`) is shown on this screen. Data Capture is a data-entry screen (not tax-touching), so disclaimer is likely not required here — but worth confirming with founder if any FP-5 field (e.g. tax wrapper allocation) might trigger a guidance boundary.

---

## 5. Plain English check — manual form

| Label | Assessment |
|-------|------------|
| "What is it?" | Clear. ✓ |
| "Wrapper" | Jargon at top layer. User is asked to choose a wrapper without explanation. FUNCTIONAL |
| "Type" | Ambiguous (type of what?). Should be "Value type" or "Format". POLISH |
| "Value" | Clear. ✓ |
| Wrapper options: SIPP/ISA/GIA/CASH/PROPERTY | SIPP/ISA clear to most; GIA less so; CASH/PROPERTY clear. |
| BOND_ON | Opaque. DEMO-BLOCKING (see DOM-11 above) |
| EIS / VCT | Technical acronyms. FUNCTIONAL |

**ISSUE DOM-12 (FUNCTIONAL):** "Wrapper" label in manual form has no help text, tooltip, or "(what's this?)" affordance. Users unfamiliar with tax wrapper concepts will not know what to select. This is the highest-trust capture path — errors here propagate at confidence=1.0.

---

## Domain Summary

| ID | Severity | Finding |
|----|----------|---------|
| DOM-01 | FUNCTIONAL | LPA unglossed in upload tile |
| DOM-02 | FUNCTIONAL | Technical pipeline copy in upload body ("Native parser → AI parse…") |
| DOM-03 | FUNCTIONAL | Internal spec filename `2-Product-document-scan-v1_0.md` in scan tile body |
| DOM-04 | FUNCTIONAL | `D-DC-CONNECT-1` internal code in connect tile |
| DOM-05 | POLISH | Vendor names in Phase-2 non-functional tile |
| DOM-06 | FUNCTIONAL | `D-DC-VOICE-1` internal code in voice tile |
| DOM-07 | POLISH | "say the wrapper" jargon in voice tile body |
| DOM-08 | POLISH | "Provenance" jargon label in FP-5 rules |
| DOM-09 | POLISH | "De-duplication" technical label in FP-5 rules |
| DOM-10 | FUNCTIONAL | `D-DC-PROV-1` + "step-up auth wiring" jargon in FP5_HONESTY footnote |
| DOM-11 | DEMO-BLOCKING | `BOND_ON` wrapper code in manual form — opaque internal code to users |
| DOM-12 | FUNCTIONAL | "Wrapper" label in manual form has no help text |

**1 DEMO-BLOCKING finding (DOM-11).**
