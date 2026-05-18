# A6 — Reconciliation Audit · DataCapture · Pass 1
**Auditor:** A6 (Reconciliation)
**Date:** 2026-05-18
**Component:** `src/screens/DataCapture.jsx`
**Engine SoT:** `src/engine/fq-calculator.js`
**Parser:** `src/services/parser.js` + `src/services/parsers/mock.js`

---

## Scope
Every numeric/entity row: does it trace to the engine? Does uploaded data feed the correct engine entities? Do counts reconcile?

---

## 1. Field-count reconciliation

**Inventory claim:** mock returns 4 fields per document.
**Code check (`mock.js`):**
- SIPP/pension files → 4 fields ✓
- ISA files → 3 fields ✓
- Mortgage files → 4 fields ✓
- BTL/rental files → 4 fields ✓
- Generic (fallback) → 4 fields ✓

**ISSUE REC-01:** ISA mock returns **3 fields**, not 4. Inventory states "mock returns 4 fields." Discrepancy. The UI chip shows `{parsed.fields.length} found` so it self-reports correctly (3), but the inventory claim is wrong for ISA docs. FUNCTIONAL (inventory error, not code error — but auditor must flag it).

---

## 2. Wrapper-to-entity mapping

### Upload/scan path
Mock parser returns fields with `wrapper` values:
- `'PENSION'` (sipp docs)
- `'ISA'`
- `'PROPERTY'`
- `null` (mortgage, generic)

### Manual path
`WRAPPERS` constant = `['SIPP', 'ISA', 'GIA', 'CASH', 'PROPERTY', 'BOND_ON', 'EIS', 'VCT', null]`

**ISSUE REC-02:** Mock parser uses `'PENSION'` as wrapper; manual form offers `'SIPP'` not `'PENSION'`. These are different `field_path` prefixes downstream. A SIPP entered manually gets `field_path = 'SIPP.manual-{ts}'`; a SIPP uploaded from a statement gets `field_path = 'PENSION.sipp_value'`. Downstream engine receives two different paths for the same entity type. Engine entity model must be checked for whether `PENSION` and `SIPP` are distinct or aliased.

**Checked `fq-calculator.js` (first 150 lines):** Engine initialises `TAX` from `tax-2026.json` and defines `Dimensions`, `DOMAIN_WEIGHTS`. Wrapper/entity mapping not visible in header — deeper engine read needed for full reconciliation. However the wrapper mismatch is a code-level divergence worth flagging regardless.

**SEVERITY: FUNCTIONAL** — `field_path` inconsistency means downstream provenance drill ("where did this £ come from?") will show different paths for the same wrapper type depending on capture channel.

---

## 3. Confidence threshold reconciliation

**Component (`DataCapture.jsx` line 115-123):**
- `confChipClass`: ≥0.85 = mint, ≥0.7 = amber, <0.7 = coral ("Low — review")
- `confLabel`: ≥0.85 = "High", ≥0.7 = "Medium", <0.7 = "Low — review"

**Inventory claim:** thresholds 0.85 (High) / 0.7 (Medium). ✓ Matches.

**Mock fields confidence check:**
| Field | Confidence | Expected chip |
|-------|-----------|---------------|
| SIPP value | 0.94 | High (mint) ✓ |
| YTD contribution | 0.88 | High (mint) ✓ |
| Provider | 0.97 | High (mint) ✓ |
| Statement date | 0.62 | Low — review (coral) ✓ |
| ISA value | 0.96 | High ✓ |
| Mortgage fix-end date | 0.73 | Medium (amber) ✓ |
| Generic statement date | 0.66 | Low (coral) ✓ |

All confidence thresholds reconcile correctly. ✓

---

## 4. Field value format reconciliation

### fmtValue helper (line 110-114):
```js
if (f.unit === 'gbp') return `£${(f.value || 0).toLocaleString()}`
if (f.unit === 'date') return f.value
return String(f.value)
```

**ISSUE REC-03:** `toLocaleString()` without locale argument uses the browser/OS locale. In a UK product, `487320` should always render `£487,320` but `toLocaleString()` on a non-UK locale (e.g. German) would render `£487.320`. Should be `toLocaleString('en-GB')`. FUNCTIONAL.

**ISSUE REC-04:** `f.unit === 'pct'` case not handled by `fmtValue`. Mortgage rate field in mock has `unit: 'pct'` and `value: 0.0479`. `fmtValue` falls through to `String(f.value)` = `'0.0479'`. Should render as `'4.79%'`. Displayed incorrectly. FUNCTIONAL.

---

## 5. Envelope count reconciliation

**Upload/scan commit path:**
- 1 envelope per accepted field (`ASSET_VALUE_UPDATED`)
- 1 summary envelope (`document_captured`)
- Total = `acceptedFields.length + 1` envelopes

**Manual path:**
- 1 `ASSET_VALUE_UPDATED` envelope (single field — manual form only captures 1 at a time)
- 1 `document_captured` summary envelope
- Total = 2 envelopes per manual submission

**Reconciliation:** Counts are correct per the spec §12 model. ✓

---

## 6. Engine entity path reconciliation

**field_path construction (line 256-257):**
```js
field_path: parsedField?.path
  || (parsedField?.wrapper ? `${parsedField.wrapper}.${parsedField.id}` : parsedField?.id),
```

**ISSUE REC-05:** When `parsedField.path` is undefined (all mock fields — mock.js does not set `.path`) and `parsedField.wrapper` is null (e.g. mortgage, generic), the path degrades to just `parsedField.id` (e.g. `'mort_outstanding'`). This is a flat key with no namespace — no wrapper prefix. Two different assets with the same `id` would collide in the event store. FUNCTIONAL.

---

## 7. rules_bundle_ref reconciliation

**Envelope hardcodes** `'UK-2026.1'`. `BRAND.rulesBundle` = `'UK-2026.1'` (from `brand.js`). Currently matches. But no import/reference — decoupled. If brand version bumps to `'UK-2026.2'`, envelopes stay at `'UK-2026.1'`. FUNCTIONAL.

---

## 8. Session / user_id reconciliation

- `user_id` = `entity?.id || 'unknown'` — `'unknown'` must not reach production (per inventory note DC-EVT-02). No guard or warning logged.
- `session_id` = `window.sessionStorage.getItem('sessionId') || 'no-session'` — `'no-session'` indicates session not bootstrapped. No guard or warning.

**ISSUE REC-06:** Both fallback values (`'unknown'`, `'no-session'`) are silent. No `console.warn` in dev, no Sentry event, no UI warning. Downstream reconciliation against user records will silently fail for these envelopes. FUNCTIONAL.

---

## Reconciliation Summary

| ID | Severity | Finding |
|----|----------|---------|
| REC-01 | FUNCTIONAL | ISA mock returns 3 fields, not 4 (inventory claim incorrect) |
| REC-02 | FUNCTIONAL | Mock wrapper `PENSION` vs manual wrapper `SIPP` — field_path mismatch per channel |
| REC-03 | FUNCTIONAL | `toLocaleString()` without `'en-GB'` locale — non-UK browser renders wrong format |
| REC-04 | FUNCTIONAL | `fmtValue` has no `pct` unit handler — percentage fields display as raw decimals |
| REC-05 | FUNCTIONAL | Null-wrapper fields get flat `field_path` (no namespace) — potential key collision |
| REC-06 | FUNCTIONAL | Silent fallbacks (`'unknown'`, `'no-session'`) — no dev warning, no observability |

No DEMO-BLOCKING reconciliation issues found.
