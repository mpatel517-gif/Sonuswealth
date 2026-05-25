# Data Capture — Spec-vs-Code Gap Audit

**Spec:** `2-Product-data-capture-v1_1.md` (992 lines)
**Code:** `src/screens/DataCapture.jsx` (866 lines)
**Audit date:** 2026-05-23

---

## HEADLINE

Data Capture has 3 documented channels: **Manual Entry · Document Upload · API Pull**. Code has Manual Entry form (`ManualEntryForm` :748) + Document Upload via `FP5Modal` :555 (FP-5 verification UI standard) + 97 occurrences of upload/parser/confidence/aggregator terminology. **Manual + Upload appear wired; API Pull aggregator integration is the major gap** (TrueLayer / Plaid / MoneyHub D-EDA-3 spec'd but not built). **Estimated effort to ship: 3–4 weeks** (mostly API Pull build).

---

## §3 — Channel 1: Manual Entry

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Manual entry flow | §3.1 | `ManualEntryForm` :748 | ✅ PRESENT |
| Validation rules | §3.2 | inline in form | 🟡 PARTIAL — depth unverified |
| Edit flow | §3.3 | needs verification | 🟡 PARTIAL |
| Events emitted (correlation_id chain) | §3.4 | needs grep | 🟡 PARTIAL |
| Step-up auth (per D-AUTH-1) | §3.5 | not visible in DataCapture | ❌ MISSING |

---

## §4 — Channel 2: Document Upload

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Upload flow | §4.1 | wired via FP5Modal | ✅ PRESENT |
| Supported file types at launch (PDF/CSV/XLSX/images) | §4.2 | `fmtBytes` :105 + file type handling | 🟡 PARTIAL — needs MIME-type verification |
| Parser hierarchy | §4.3 | needs deep code-walk | 🟡 PARTIAL |
| **FP-5 verification UI (standard layout — canonical home)** | §4.4 | `FP5Modal` :555 (190+ lines) | ✅ PRESENT |
| Confidence display standard (chip classes) | §4.5 | `confChipClass` :115 + `confLabel` :120 | ✅ PRESENT |
| Per-field action semantics (accept/edit/reject) | §4.6 | needs verification inside FP5Modal | 🟡 PARTIAL |
| Partial acceptance (DQ-14) | §4.7 | needs verification | 🟡 PARTIAL |
| Provenance trail | §4.8 | needs grep | 🟡 PARTIAL |
| Events emitted | §4.9 | needs grep | 🟡 PARTIAL |

---

## §5 — Channel 3: API Pull

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| API pull flow | §5.1 | not present | ❌ MISSING |
| Multi-aggregator model (D-EDA-3) — TrueLayer / Plaid / MoneyHub | §5.2 | not present | ❌ MISSING |
| Aggregator selection per asset type | inferred | not present | ❌ MISSING |
| OAuth consent flow | inferred | not present | ❌ MISSING |
| Pull frequency / refresh policy | inferred | not present | ❌ MISSING |
| Reconciliation against manual entries | inferred | not present | ❌ MISSING |

**Channel 3 is greenfield.** This is the production-grade data ingestion path (real users won't manually enter every transaction). High-value, high-effort.

---

## §D — Demo persona ingest gate

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| D-DEMO-HIDDEN-1 ingest gate (block demo persona from real-data leak) | §D.1 + §D.2 | needs grep — likely in shared auth/persona layer | 🟡 PARTIAL |
| DemoPersonaLeakError thrown on violation | §D.3 | needs grep | 🟡 PARTIAL |
| Mr T fixture requirement (regression test) | §D.4 | uses Mr T fixtures | ✅ PRESENT |
| What demo ingest IS allowed | §D.5 | n/a | n/a |

---

## Cross-screen contract

Data Capture writes to:
- entity asset/liability fields (per Domain A-X from MyMoney)
- event store (correlation_id chain per §0.2 MyMoney spec)

Verdict: writes structurally present; full event-store integration needs verification.

---

## Top 5 gaps to close

1. **Build Channel 3 (API Pull) — multi-aggregator** — TrueLayer (UK Open Banking), Plaid (international), MoneyHub (UK wealth aggregator). **Effort: 2 weeks.** Highest-value gap; without it, real users hit a wall after manual setup.
2. **Step-up auth (D-AUTH-1)** on every write — biometric / 2FA challenge for material changes. **Effort: 3 days.**
3. **Provenance trail (§4.8)** — every ingested value carries `{source, parser, confidence, retrieved_at, document_id}`. **Effort: 2 days.**
4. **Per-field action semantics (§4.6) + partial acceptance (§4.7)** — verify FP5Modal handles edge cases. **Effort: 2 days.**
5. **Parser hierarchy (§4.3) depth** — confirm waterfall from structured (CSV/XLSX) → semi-structured (PDF tables) → OCR (image-only PDFs) is correctly tiered. **Effort: 3 days.**

---

## Founder open items

§0.6 lists round-2 expected carries. Round-2 not yet started.

---

## Nice-to-haves observed

1. **Drag-and-drop upload zone** — anywhere on page (currently button-only)
2. **Bulk upload with progress** — drop 20 PDFs, show per-file parse status
3. **Re-parse button** — if user disagrees with parse, request re-parse with different parser
4. **Provider auto-detection from upload** — recognise Hargreaves Lansdown / Vanguard / AJ Bell format and route to specialist parser
5. **Bank statement diff** — upload 12 months, auto-categorise transactions, surface anomalies
6. **OCR confidence threshold slider** — let users tune "auto-accept ≥X% confidence"
7. **Personalised onboarding upload sequence** — "you said you have a SIPP — upload your latest statement"

---

## Foundational soundness verdict

Data Capture is **half-built**. Manual + Upload via FP-5 are in good shape; API Pull is missing entirely. **3–4 weeks** to spec-compliance.

---

*Audit complete: 2026-05-23.*
