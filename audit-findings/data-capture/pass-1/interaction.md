# A2/A3/A4 — Interaction Audit · DataCapture · Pass 1
**Auditor:** A2 (real handler) / A3 (correct entity routing) / A4 (usable destination)
**Date:** 2026-05-18
**Component:** `src/screens/DataCapture.jsx`

---

## A2 — Real handlers (does each interactive element have a wired, non-stub handler?)

### Channel tiles

| Channel | Handler | Real? | Notes |
|---------|---------|-------|-------|
| Upload | `onClick={() => openChannel(c)}` → sets `active`, calls `onChannelOpen?.(c.id)`, sets `fileInputRef.current.accept`, calls `.click()` | YES | Real file picker triggered |
| Scan | Same as upload with `capture="environment"` attr | YES | |
| Manual | `openChannel(c)` → `setManualOpen(true)` | YES | Real `ManualEntryForm` rendered |
| Connect (Phase 2) | `openChannel(c)` → `setActive(c.id); return` (early exit) | STUB by design | Shows stub card. Correct per FD-DC-1. NOT a finding |
| Voice (Phase 2) | Same stub path | STUB by design | |

**ISSUE A2-01:** Phase-2 tile buttons are clickable despite `aria-disabled`. `openChannel` receives the channel object and short-circuits at `if (c.status === 'phase2') { setActive(c.id); return }` — so click does trigger state change (shows stub card). No `e.preventDefault()` or actual button `disabled` attribute. A keyboard user pressing Enter/Space on the Phase-2 tile will see the stub card appear, which is tolerable UX but `aria-disabled` semantically promises the button is inoperable. FUNCTIONAL.

### File input

| Element | Handler | Real? |
|---------|---------|-------|
| Hidden `<input type="file">` | `onChange={onFilePicked}` | YES |
| `onFilePicked` | Reads `e.target.files[0]`, sets `file`, `parsing`, calls `parseDocument()` | YES |
| `parseDocument()` | Calls `parser.js` → `mock.js` (in dev) or real provider | YES (mock in dev) |

**ISSUE A2-02:** `parseDocument` is called with `docTypeHint: channelRef.current?.id` which passes `'upload'` or `'scan'` — not a document type hint (e.g. `'sipp-statement'`). The mock parser ignores opts and uses filename sniffing, so dev behavior is correct. But when a real parser is wired, the hint will be the channel ID not the doc type, which is incorrect. FUNCTIONAL (Phase 2 concern but wiring is wrong today).

### FP-5 modal buttons

| Button | Handler | Real? | Notes |
|--------|---------|-------|-------|
| Accept | `onDecide(f.id, 'accepted')` → `setFieldDecision` → `setParsed` | YES | |
| Edit | Sets `editing = f.id`, `editVal = String(f.value)` | YES | |
| Save (edit) | `onEdit(f.id, value)` → `editField` → updates field with `confidence: 1.0, accepted: 'accepted'` | YES | |
| Reject | `onDecide(f.id, 'rejected')` | YES | |
| Commit | `commitCapture()` | YES | But see A2-03 |
| Cancel | `closeParsed()` | YES | |
| Backdrop click | `onClose` = `closeParsed()` | YES | |

**ISSUE A2-03:** `commitCapture` with 0 accepted fields silently calls `closeParsed()` — no toast, no message, no disabled state. The Commit button shows "Commit" not "Commit 0 fields" when all pending; user may tap and see modal vanish thinking they committed. FUNCTIONAL.

**ISSUE A2-04:** Edit field on blur (touch): no `onBlur` handler on the edit `<input>`. On mobile, tapping elsewhere after typing discards the change silently. Only Enter key or explicit Save button saves. FUNCTIONAL.

### Manual entry form

| Element | Handler | Real? |
|---------|---------|-------|
| Label input | `setLabel` | YES |
| Wrapper chips | `setWrapper(w)` | YES |
| Type chips | `setUnit(u)` | YES |
| Value input | `setValue` | YES |
| Add button | `submit()` → validates → `onSubmit(payload)` | YES |
| Cancel | `onCancel` → `setManualOpen(false); setActive(null)` | YES |
| Backdrop click | `onCancel` | YES |

**ISSUE A2-05:** Manual form `submit()` guard is `if (!label.trim() || value === '') return` — `value === ''` only catches empty string. If user types spaces in a text field, `value` = `'   '` which passes validation and produces a whitespace-only label value. FUNCTIONAL.

---

## A3 — Entity routing (does each input type route to the correct data entity?)

The `onCommit` callback receives envelopes. Routing analysis:

| Channel | Event type emitted | field_path | Destination entity |
|---------|-------------------|------------|-------------------|
| Upload (mock) | `ASSET_VALUE_UPDATED` per accepted field + `document_captured` summary | `f.path \|\| f.wrapper.f.id` | Depends on `f.wrapper` — SIPP/ISA/GIA etc. Correct wrapper-to-entity mapping |
| Scan | Same as upload | Same | Same |
| Manual | `ASSET_VALUE_UPDATED` + `document_captured` | `manual-{ts}` (unstable) | Wrapper selected by user; correct in intent |

**ISSUE A3-01:** `field_path` for mock fields: mock.js returns fields with no `path` property. Fallback computes `${parsedField.wrapper}.${parsedField.id}` (e.g. `PENSION.sipp_value`). Note mock uses wrapper `'PENSION'` but WRAPPERS list in ManualEntryForm uses `'SIPP'`. Inconsistency: mock produces `PENSION.*` paths, manual produces `SIPP.*` paths — two different wrappers for the same pension wrapper type. Downstream consumers would see two entity paths for the same concept. FUNCTIONAL.

**ISSUE A3-02:** `rules_bundle_ref` hardcoded `'UK-2026.1'` in every envelope instead of `BRAND.rulesBundle`. If the bundle version increments, all envelopes from this screen will carry a stale reference. FUNCTIONAL.

**ISSUE A3-03:** `entity_type` defaults to `'individual'` (line 255). No validation that `entity.type` is a known type. If entity passed without `.type`, all envelopes tag as `'individual'` which may be wrong for corporate/trust entities. FUNCTIONAL (low priority for Wave 1 but noted).

---

## A4 — Destination usability (is the flow end-to-end usable, not dead-end?)

### Upload flow
1. Click tile → file picker opens (real OS dialog) ✓
2. Pick file → `onFilePicked` fires → 1.4s simulated parse (mock) ✓
3. FP-5 modal opens with 4 mock fields ✓
4. Accept/edit/reject fields ✓
5. Commit → `onCommit` fired per accepted field ✓
6. Modal closes, back to main screen ✓

**Dead-end check:** If `onCommit` is not provided (prop omitted), all envelope emissions are silently swallowed via `onCommit?.()`. No error, no user feedback. Caller must wire `onCommit` — current Dashboard.jsx integration must be checked. FUNCTIONAL.

### Scan flow
Identical to upload except `capture="environment"` on file input. On desktop this opens the file picker (same as upload). On mobile it opens camera. Flow is identical after file selection. ✓

### Manual flow
1. Click tile → `ManualEntryForm` overlay opens ✓
2. Fill label, wrapper, type, value ✓
3. Add → emits 2 envelopes → modal closes ✓

**Dead-end check A4-01:** Manual form has no confirmation after submit — modal closes immediately. No "Added" toast, no summary. User gets no proof the entry was recorded. FUNCTIONAL.

### Phase-2 flows
Connect/Voice correctly show stub card with "Phase 2" disclosure. Dismiss button wired. NOT a dead-end — they are honest non-functional placeholders. ✓

### Production + no-backend path
`needsHonestEmptyState` = true in production when `REAL_PARSER_WIRED = false`. File picked → parsing state shown → honest-empty modal opens with guidance to use manual entry. ✓ Correct guardrail.

---

## Interaction summary

| Severity | ID | Finding |
|----------|----|---------|
| FUNCTIONAL | A2-01 | Phase-2 tiles clickable despite aria-disabled; keyboard activates stub |
| FUNCTIONAL | A2-02 | `docTypeHint` passes channel ID not document type |
| FUNCTIONAL | A2-03 | Commit 0 fields: silent dismiss, no user feedback |
| FUNCTIONAL | A2-04 | Edit field: blur discards change silently on mobile |
| FUNCTIONAL | A2-05 | Manual label/value: whitespace passes validation |
| FUNCTIONAL | A3-01 | Mock wrapper `'PENSION'` vs manual wrapper `'SIPP'` — field_path inconsistency |
| FUNCTIONAL | A3-02 | `rules_bundle_ref` hardcoded, not from BRAND |
| FUNCTIONAL | A3-03 | entity_type defaults to 'individual' without validation |
| FUNCTIONAL | A4-01 | Manual submit: no confirmation feedback |
| FUNCTIONAL | A4-02 | `onCommit` missing = silent data loss (no prop guard) |

No DEMO-BLOCKING interaction issues found.
