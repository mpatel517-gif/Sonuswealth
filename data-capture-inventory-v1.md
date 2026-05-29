# Data Capture Screen — Element Inventory v1

**Screen:** Sonuswealth Data Capture (build target: React in `src/screens/DataCapture.jsx`)
**Design baseline:** none on disk for this screen — component IS the structural truth (conformance-auditor will flag missing baseline)
**Spec reference:** `2-Product-data-capture-v1_1.md` + `2-Product-document-upload-v1_0.md` + `2-Product-document-scan-v1_0.md` + `2-Product-manual-input-v1_0.md` (cited in component header; not read by inventory-builder — auditors must locate)
**Reconciliation baseline:** engine — `src/engine/fq-calculator.js` (entity model); parser at `src/services/parser.js` + `src/services/parsers/mock.js`; brand SoT — `src/config/brand.js`
**Date:** 17 May 2026

---

## Why this file exists

This is the **fixed target** the whole audit measures against. Every interactive or
data-bearing element on Data Capture is one numbered row. The audit does not "find
mistakes" — it walks this list and records a verdict per row. That is the only thing
that makes "99% confident" a real statement: it means *N of M rows verified PASS*,
not a feeling.

**This file is the worksheet.** Auditor agents fill the `Verdict` columns. Do not add
or remove rows except via the "inventory drift" rule in the runbook (§6). If the build
contains an element not listed here, that is itself a finding (`UNLISTED`).

---

## The six assertions (every row is tested against all six)

| # | Assertion | Fails when… |
|---|-----------|-------------|
| A1 | **Identified** — element exists in the build and matches this row | Element missing from build, or build has an element not in this inventory |
| A2 | **Drillable** — if it is a number, action, or nav element, interacting with it does something | Tapping is dead / no handler / no visible response |
| A3 | **Destination correct** — it resolves to the surface that **owns its subject** | A pension action lands on Cashflow; a tax number lands on Risk; etc. |
| A4 | **Destination coherent** — the landing is a usable continuation: it shows the SOURCE, an ACTION, or a DECISION | Lands on a generic modal, a dead-end, a screen top with no context, or an unrelated view |
| A5 | **Plain English** — label + any explainer readable by a non-expert in one pass; jargon translated; information-not-advice (FCA) | Unexplained jargon; advice-phrased copy; figure with no plain meaning |
| A6 | **Reconciled** — every number traces to an engine function and matches value + format everywhere it appears | Hardcoded number; `fmt()` not used; same metric shows two values/formats |

**Drill destination taxonomy (A3 + A4).** Every drillable element must resolve to one of:
- **SOURCE** — the breakdown / detail / provenance of where a number came from.
- **ACTION** — a place to *do* the thing (a panel, a flow).
- **DECISION** — a place to weigh options and commit (scenario engine, plan).

If a drillable element resolves to *none* of these, A4 = FAIL.

**Verdict values:** `PASS` · `FAIL` · `NA` · `UNVERIFIED` (default) · `BLOCKED` (cannot test).
**Severity (set by orchestrator on any FAIL):** `DEMO-BLOCKING` · `FUNCTIONAL` · `POLISH`.

---

## Confirmed founder decisions (auditors treat these as fixed — do NOT flag against the stale spec)

| FD | Decision |
|----|----------|
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Sonuswealth and Finio).** Source of truth: `src/config/brand.js` (`BRAND.name`). Casing: logo / wordmark = `sonuswealth` (lowercase); body text, titles, aria-labels, page `<title>`, score strings = `Sonuswealth` (sentence case); marketing slogans (footer-tier only) may use ALL CAPS. Every `Sonuswealth` or `Finio` or `FQ Score` in user-facing strings = FUNCTIONAL FAIL (A5/A6). Engine-module disclaimers + comments are queued for Wave 4 Morph sweep. |
| FD-CROSS-1 | **Data Capture owns SOURCE / PROVENANCE** — every number elsewhere in the product traces back to a record entered or imported here. When a user asks "where did this £ come from?" the SOURCE drill ends on this surface. Each captured field must therefore be addressable downstream by `field_path` (see envelope §12) and the destination tab that displays it must render the same value / format. |
| FD-LOGO-1 | Brand assets live at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. This screen does not own a logo render — but the back-to-Home affordance must respect the brand surface it returns to. |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms. Placement on screens is **Wave 7 enhancement scope**, not in-audit; audit treats absence of Sonnu as not-a-finding. |
| FD-DC-1 | **FP-5 Data Capture was shipped in session 2026-05-12** (memory `project_finio_session_2026_05_12.md`). The 3 capture modes (upload / scan / manual) must each complete a full ingestion path — file picker → parse → FP-5 modal → accept/reject/edit → commit envelope. Phase-2 channels (`connect`, `voice`) are placeholders by design and must not pretend to function. |
| FD-DC-2 | **Mock parser is DEV-only.** Per `D-DEMO-HIDDEN-1` gate in component, production + non-demo entity hitting the mock provider must render the "Mock parser disabled" empty state. Any real-user mock leak = DEMO-BLOCKING. |
| FD-DC-3 | **Captured fields commit through `onCommit` envelopes** (spec §12). Persistence to Supabase is the receiver's responsibility — this screen only emits envelopes. Any localStorage write of financial state from this screen = DEMO-BLOCKING (per root CLAUDE.md). |

---

## ELEMENT TABLE

> `Owns-subject destination` is the **expected** A3/A4 target — the auditor checks the
> build against this. Where it reads "dedicated panel," a coherent in-context drill
> (overlay or sub-screen) is acceptable; a bare tab-jump is not.

### Region 1 — Shell / chrome

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-CHR-01 | "← Home" back button | ACTION | Home screen | UNVERIFIED | renders only if `onBack` prop wired |
| DC-CHR-02 | Eyebrow "Data capture" | DATA | NA (display) | UNVERIFIED | A5 |
| DC-CHR-03 | H1 "Get your data into Sonuswealth" | DATA | NA (display) | UNVERIFIED | A5 — brand string check |
| DC-CHR-04 | Intro line "Three ways in. Pick whichever fits…" | DATA | NA (display) | UNVERIFIED | claims 3 but CHANNELS array has 5 — A5 conflict; reconcile copy vs phase-2 hidden channels |
| DC-CHR-05 | DEV mock-parser banner ("🧪 DEV — mock parser active…") | DATA | NA (display) | UNVERIFIED | only renders when `IS_DEV && PARSER_PROVIDER === 'mock'`; must NOT render in prod build |

### Region 2 — Channel tiles (CHANNELS array)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-CH-01 | Channel tile — Upload a document | ACTION | ACTION — native file picker (`<input type="file">`) with `accept=".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.heic"` | UNVERIFIED | `openChannel('upload')` |
| DC-CH-01a | Icon "⇧" + 44px tile | DATA | NA | UNVERIFIED | |
| DC-CH-01b | Title "Upload a document" | DATA | NA | UNVERIFIED | A5 |
| DC-CH-01c | Body copy "PDF statements, contract notes, valuation reports, will or LPA scans. Native parser → AI parse → OCR fallback → manual edit." | DATA | NA | UNVERIFIED | A5 — "Native parser → AI parse → OCR fallback" jargon; describes pipeline not yet live (only mock today) |
| DC-CH-01d | Badge "Statements · Wills · LPA" | DATA | NA | UNVERIFIED | A5 — LPA acronym unglossed |
| DC-CH-01e | Chevron "›" | DATA | NA (visual) | UNVERIFIED | |
| DC-CH-02 | Channel tile — Scan with camera | ACTION | ACTION — file picker with `capture="environment"` (camera on mobile, picker on desktop) | UNVERIFIED | `openChannel('scan')` |
| DC-CH-02a | Body copy mentions "Phase 1 — single image upload. Phase 2 will add viewfinder + perspective correction + multi-page" | DATA | NA | UNVERIFIED | A5 — honest disclosure; verify behaviour matches |
| DC-CH-02b | Badge "Paper · On-the-go" | DATA | NA | UNVERIFIED | |
| DC-CH-03 | Channel tile — Enter manually | ACTION | ACTION — `ManualEntryForm` overlay | UNVERIFIED | `openChannel('manual')` → `setManualOpen(true)` |
| DC-CH-03a | Body copy "High-trust path. Anything you type is treated as confirmed (confidence = 1.0)…" | DATA | NA | UNVERIFIED | A5 |
| DC-CH-03b | Badge "Highest trust" | DATA | NA | UNVERIFIED | |
| DC-CH-04 | Channel tile — Connect bank / broker (Phase 2 placeholder) | ACTION | stub state ("Phase 2") | UNVERIFIED | `c.status === 'phase2'` — opacity 0.6, cursor not-allowed, ⏳ icon |
| DC-CH-04a | Body copy "TrueLayer · Yapily · Salt Edge · India AA · Phase 2 (D-DC-CONNECT-1)" | DATA | NA | UNVERIFIED | A5 — vendor name dump; D-DC-CONNECT-1 internal code surfaced to user (FD-MASCOT-1 macOS-principle violation candidate per memory `feedback_finio_macos_principle.md`) |
| DC-CH-04b | Badge "Phase 2" | DATA | NA | UNVERIFIED | |
| DC-CH-05 | Channel tile — Voice entry (Phase 2 placeholder) | ACTION | stub state ("Phase 2") | UNVERIFIED | |
| DC-CH-05a | Body copy "Hands-free capture — say the wrapper, amount, and date; we fill the form. Phase 2 (D-DC-VOICE-1)." | DATA | NA | UNVERIFIED | A5 — D-DC-VOICE-1 internal code surfaced |
| DC-CH-05b | Badge "Phase 2" | DATA | NA | UNVERIFIED | |
| DC-CH-XX | Hidden `<input type="file">` (shared by upload + scan) | INPUT | NA (mechanism) | UNVERIFIED | dynamic `accept` + `capture` per channel; `aria-hidden="true"` |

### Region 3 — FP-5 contract card ("How we treat your data")

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-FP5-00 | Card eyebrow "How we treat your data" | DATA | NA | UNVERIFIED | A5 |
| DC-FP5-01 | Rule 1 — Confidence | DATA | NA | UNVERIFIED | A5 — match copy "Every parsed field gets a confidence score. Low confidence flags for review." |
| DC-FP5-02 | Rule 2 — Provenance | DATA | NA | UNVERIFIED | A5 |
| DC-FP5-03 | Rule 3 — De-duplication | DATA | NA | UNVERIFIED | A5 — but FP5_HONESTY footer says dedup is Phase 2; A6/A5 conflict between claim + footer |
| DC-FP5-04 | Rule 4 — Partial acceptance | DATA | NA | UNVERIFIED | A5 |
| DC-FP5-05 | Rule 5 — Manual fallback | DATA | NA | UNVERIFIED | A5 |
| DC-FP5-06 | Honesty footer "Dedup, provenance, and step-up auth wiring — Phase 2 (D-DC-PROV-1)." | DATA | NA | UNVERIFIED | A5 — internal code D-DC-PROV-1 user-facing; also reveals 3 of the 5 FP-5 rules are not actually enforced yet |

### Region 4 — Parsing in-progress state

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-PARSE-01 | Eyebrow "Parsing…" | DATA | NA (in-flight state) | UNVERIFIED | renders while `parsing === true` |
| DC-PARSE-02 | Filename echo `{file.name}` | DATA | NA | UNVERIFIED | A6 — verify name matches picked file exactly |
| DC-PARSE-03 | File metadata `{type} · {fmtBytes(size)}` | DATA | NA | UNVERIFIED | A6 — `fmtBytes` formats 1.0 KB / 1.0 MB; verify edge case 0-byte / unknown type |
| DC-PARSE-04 | Indeterminate progress bar (CSS keyframe `sw-progress`) | DATA | NA | UNVERIFIED | inline `<style>` injection — verify no SSR issue |

### Region 5 — Stub / "channel opened" state

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-STUB-01 | Phase-2 stub card eyebrow `{channel.title} — Phase 2` | DATA | NA | UNVERIFIED | rendered for `connect` / `voice` after openChannel |
| DC-STUB-02 | Phase-2 stub body (repeats channel `c.body`) | DATA | NA | UNVERIFIED | A5 |
| DC-STUB-03 | Phase-2 stub "Dismiss" button | ACTION | clears `active` state | UNVERIFIED | dead-end if user expected real action — flag A4 risk |
| DC-STUB-04 | File-picker stub card "File picker opened" | DATA | NA | UNVERIFIED | shown when `active && !parsing && !parsed && !manualOpen` and not phase2 — i.e., picker opened but no file chosen |
| DC-STUB-05 | File-picker stub body "Pick a document to continue, or close this dialog and try a different channel." | DATA | NA | UNVERIFIED | A5 |
| DC-STUB-06 | File-picker stub "Dismiss" button | ACTION | clears `active` state | UNVERIFIED | A4 — dead-end if user closed OS picker without choosing |

### Region 6 — Mock-parser-blocked empty state (production guardrail)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-BLOCK-01 | Eyebrow "Mock parser disabled" (coral) | DATA | NA | UNVERIFIED | renders if `mockBlockedForRealUser` — i.e., prod build + non-demo entity + mock provider |
| DC-BLOCK-02 | Body "Document parsing is in Phase 2." | DATA | NA | UNVERIFIED | A5 |
| DC-BLOCK-03 | Body "The dev mock parser is not available for real accounts. Please use manual entry until real OCR ships." | DATA | NA | UNVERIFIED | A5 — but UI does not offer a manual-entry CTA from this state; copy says "use manual" but only "← Back" button shown — A4 dead-end |
| DC-BLOCK-04 | "← Back" button | ACTION | Home (via onBack) | UNVERIFIED | A4 — should also offer "Enter manually" inline; missing per copy promise |

### Region 7 — FP-5 verification modal (overlay)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-FP5M-00 | Sheet backdrop (click closes) | OVERLAY | closes modal (`onClose`) | UNVERIFIED | |
| DC-FP5M-01 | Sheet handle | DATA | NA (visual affordance) | UNVERIFIED | |
| DC-FP5M-02 | Mock-parse warning banner "🧪 DEMO PARSE — invented values (mock parser). Real OCR is Phase 2." | DATA | NA | UNVERIFIED | renders only if `parsed.isMock`; A5 — honest disclosure |
| DC-FP5M-03 | Modal title "Verify parsed fields" | DATA | NA | UNVERIFIED | A5 |
| DC-FP5M-04 | Field-count chip `{N} found` | DATA | NA | UNVERIFIED | A6 — must equal `parsed.fields.length` |
| DC-FP5M-05 | Source line `{filename} · {type} · {size}` | DATA | NA (display) | UNVERIFIED | A6 — verify against picked file |
| DC-FP5M-06 | Field card (repeats per parsed field) | DATA | NA (sub-element list below) | UNVERIFIED | mock returns 4 fields per `parsers/mock.js` (unverified — auditor to confirm) |
| DC-FP5M-06a | Field label `{f.label}` | DATA | NA | UNVERIFIED | A5 — plain English requirement on parsed labels |
| DC-FP5M-06b | Wrapper chip (blue) `{f.wrapper}` | DATA | NA | UNVERIFIED | A5 — chip shows raw wrapper code (SIPP/ISA/GIA/CASH/PROPERTY/BOND_ON/EIS/VCT); BOND_ON unglossed |
| DC-FP5M-06c | Confidence chip `{label} · {pct}%` | DATA | NA | UNVERIFIED | A6 — `confChipClass`/`confLabel` thresholds 0.85 (High) / 0.7 (Medium) / <0.7 (Low — review) |
| DC-FP5M-06d | Field value `{fmtValue(f)}` | DATA | NA (display) | UNVERIFIED | A6 — `fmtValue` formats gbp as £toLocaleString, date as raw, text as String |
| DC-FP5M-06e | Source line "Source: {f.source}" | DATA | NA | UNVERIFIED | A5 — provenance string format |
| DC-FP5M-06f | "Accept" / "✓ Accepted" button | ACTION | toggles field decision to 'accepted' | UNVERIFIED | A2 |
| DC-FP5M-06g | "Edit" button | ACTION | opens inline edit input | UNVERIFIED | A2 |
| DC-FP5M-06h | "Reject" / "✕ Rejected" button | ACTION | toggles field decision to 'rejected' | UNVERIFIED | A2 |
| DC-FP5M-06i | Inline edit input (type=number for gbp, else text) | INPUT | onEdit commits new value + confidence=1.0 + source='manual edit' | UNVERIFIED | A2 — Enter saves, Esc cancels |
| DC-FP5M-06j | Edit "Save" button | ACTION | commits edit | UNVERIFIED | |
| DC-FP5M-06k | Edit "Cancel" button | ACTION | cancels edit (no commit) | UNVERIFIED | |
| DC-FP5M-07 | Counters strip "{accepted} accepted · {pending} pending · {rejected} rejected" | DATA | NA | UNVERIFIED | A6 — must reconcile to per-field state in real time |
| DC-FP5M-08 | "Commit {N} field(s)" / "Commit" primary button | ACTION | fires `onCommit` envelopes (one ASSET_VALUE_UPDATED per accepted field + one document_captured summary) → closes modal | UNVERIFIED | A2 — `commitCapture()`; if N=0, just closes (silent no-op — flag A4 risk) |
| DC-FP5M-09 | "Cancel" secondary button | ACTION | closes modal without committing | UNVERIFIED | |
| DC-FP5M-10 | Honest-empty-state body `{parsed.message}` | DATA | NA | UNVERIFIED | A5 — renders if `parsed.honestEmpty` (production + real provider but `REAL_PARSER_WIRED === false`) |
| DC-FP5M-11 | Honest-empty-state "Close" button | ACTION | closes modal | UNVERIFIED | A4 — dead-end; no fallback to manual entry offered (same pattern as DC-BLOCK-04) |

### Region 8 — Manual entry form (overlay)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-MAN-00 | Sheet backdrop (click cancels) | OVERLAY | `onCancel` | UNVERIFIED | |
| DC-MAN-01 | Sheet handle | DATA | NA | UNVERIFIED | |
| DC-MAN-02 | Title "Add a value manually" | DATA | NA | UNVERIFIED | A5 |
| DC-MAN-03 | Subtitle "Manual entries are stored at full confidence (1.0)." | DATA | NA | UNVERIFIED | A5 — "1.0" jargon for non-expert |
| DC-MAN-04 | Label "What is it?" | DATA | NA | UNVERIFIED | A5 |
| DC-MAN-05 | Label-text input (placeholder "e.g. AJ Bell SIPP") | INPUT | local state `label` | UNVERIFIED | A2 — required (submit disabled when empty) |
| DC-MAN-06 | Label "Wrapper" | DATA | NA | UNVERIFIED | A5 |
| DC-MAN-07a | Wrapper chip — SIPP | ACTION | sets `wrapper='SIPP'` | UNVERIFIED | default selection |
| DC-MAN-07b | Wrapper chip — ISA | ACTION | sets `wrapper='ISA'` | UNVERIFIED | |
| DC-MAN-07c | Wrapper chip — GIA | ACTION | sets `wrapper='GIA'` | UNVERIFIED | A5 — GIA acronym unglossed |
| DC-MAN-07d | Wrapper chip — CASH | ACTION | sets `wrapper='CASH'` | UNVERIFIED | |
| DC-MAN-07e | Wrapper chip — PROPERTY | ACTION | sets `wrapper='PROPERTY'` | UNVERIFIED | |
| DC-MAN-07f | Wrapper chip — BOND_ON | ACTION | sets `wrapper='BOND_ON'` | UNVERIFIED | A5 — BOND_ON is raw code, not human label (offshore bond?); FD-MASCOT-1 macOS-principle violation |
| DC-MAN-07g | Wrapper chip — EIS | ACTION | sets `wrapper='EIS'` | UNVERIFIED | A5 — EIS acronym unglossed |
| DC-MAN-07h | Wrapper chip — VCT | ACTION | sets `wrapper='VCT'` | UNVERIFIED | A5 — VCT acronym unglossed |
| DC-MAN-07i | Wrapper chip — None | ACTION | sets `wrapper=null` | UNVERIFIED | |
| DC-MAN-08 | Label "Type" | DATA | NA | UNVERIFIED | A5 |
| DC-MAN-09a | Type chip — "£ amount" (unit=gbp) | ACTION | sets `unit='gbp'` | UNVERIFIED | default |
| DC-MAN-09b | Type chip — "Date" (unit=date) | ACTION | sets `unit='date'` | UNVERIFIED | |
| DC-MAN-09c | Type chip — "Text" (unit=text) | ACTION | sets `unit='text'` | UNVERIFIED | |
| DC-MAN-10 | Label "Value" | DATA | NA | UNVERIFIED | A5 |
| DC-MAN-11 | Value input (dynamic type: number / date / text) | INPUT | local state `value` | UNVERIFIED | A2 — required |
| DC-MAN-12 | "Add" primary button | ACTION | fires `onSubmit({id, label, value, unit, wrapper, confidence:1.0, source:'manual entry'})` → parent emits envelope → closes form | UNVERIFIED | disabled when label or value empty |
| DC-MAN-13 | "Cancel" button | ACTION | closes form | UNVERIFIED | |

### Region 9 — Commit / event envelope (mechanism, not visible UI)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-EVT-01 | `buildEnvelope` — `event_id`, `event_timestamp`, `client_timestamp` | DATA | downstream event store | UNVERIFIED | A6 — verify ISO timestamps; `event_id` format `dc-{ts}-{rand}` |
| DC-EVT-02 | `buildEnvelope` — `user_id` from `entity.id`, fallback `'unknown'` | DATA | downstream | UNVERIFIED | A6 — verify entity wiring; 'unknown' should not reach production |
| DC-EVT-03 | `buildEnvelope` — `session_id` from `window.sessionStorage.sessionId`, fallback `'no-session'` | DATA | downstream | UNVERIFIED | A6 — verify session bootstrapped; 'no-session' = signal of missing init |
| DC-EVT-04 | `buildEnvelope` — `entity_id`, `entity_type` (default 'individual') | DATA | downstream | UNVERIFIED | |
| DC-EVT-05 | `buildEnvelope` — `field_path` (from `parsedField.path` or `wrapper.id`) | DATA | RECONCILE: downstream tab uses this to render value | UNVERIFIED | A6 — this is the trace key for FD-CROSS-1 (Data Capture owns source) |
| DC-EVT-06 | `buildEnvelope` — `provenance.source = 'data-capture'`, `provenance.parser = PARSER_PROVIDER`, `provenance.mode` | DATA | downstream | UNVERIFIED | A6 — provenance enforced client-side, but FP5_HONESTY says server-side wiring is Phase 2 |
| DC-EVT-07 | `buildEnvelope` — `classifier_version` ('mock-1.0' or 'real-1.0') | DATA | downstream | UNVERIFIED | |
| DC-EVT-08 | `buildEnvelope` — `rules_bundle_ref = 'UK-2026.1'` | DATA | downstream | UNVERIFIED | A6 — hardcoded; should reference `rules-uk.js` SoT per memory `feedback_always_check_rules_uk.md` |
| DC-EVT-09 | `commitCapture` — emits one `ASSET_VALUE_UPDATED` envelope per accepted field | ACTION | RECONCILE: My Money asset list / Cashflow / Timeline (per wrapper) | UNVERIFIED | A6 — verify downstream consumer |
| DC-EVT-10 | `commitCapture` — emits one `document_captured` summary envelope | ACTION | RECONCILE: document vault / provenance ledger | UNVERIFIED | |
| DC-EVT-11 | `ManualEntryForm` submit — emits `ASSET_VALUE_UPDATED` + `document_captured` envelopes via parent | ACTION | RECONCILE: same destinations as DC-EVT-09/10 | UNVERIFIED | A6 |

### Region 10 — Cross-screen reconciliation hooks (FD-CROSS-1)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DC-X-01 | Captured asset (wrapper ∈ SIPP/ISA/GIA/CASH/PROPERTY/BOND_ON/EIS/VCT) | DATA | RECONCILE: My Money asset list | UNVERIFIED | A6 — same value + format on MM-ASSET-NN |
| DC-X-02 | Captured income (label suggests income) | DATA | RECONCILE: My Money income · Cashflow inflow | UNVERIFIED | A6 — no explicit income type in form; ambiguity flag |
| DC-X-03 | Captured bill / liability | DATA | RECONCILE: Timeline bill calendar (per memory `feedback_read_prior_first.md` — bill calendar lives on Timeline) | UNVERIFIED | A6 — no bill type in form; manual entry has no liability path |
| DC-X-04 | Captured document filename | DATA | RECONCILE: Document vault | UNVERIFIED | A6 — `document_captured` envelope carries `file.{name,size,type}` only — actual file bytes never persisted client-side |
| DC-X-05 | "Where did this £ come from?" drill | NA (downstream test) | This screen IS the terminus (FD-CROSS-1) | UNVERIFIED | A4 — verify other tabs' SOURCE drills reach a record captured here, not a dead end |

---

## SEED FINDINGS (pre-identified — agents start with these, then extend)

These are *already known* from reading the React component. They are not the list —
they are the proof the method works. Agents must confirm each, assign severity,
and find the rest.

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| S-01 | DC-CHR-04 | Intro copy says "Three ways in" but CHANNELS array has 5 tiles (3 live + 2 phase-2) — user counts 5, copy says 3 | FUNCTIONAL (A5) |
| S-02 | DC-CH-04a / DC-CH-05a / DC-FP5-06 | Internal codes `D-DC-CONNECT-1`, `D-DC-VOICE-1`, `D-DC-PROV-1` surfaced in user-facing copy — violates macOS-principle (memory `feedback_finio_macos_principle.md`: internal codes never at top layer) | FUNCTIONAL (A5) |
| S-03 | DC-CH-01c | "Native parser → AI parse → OCR fallback → manual edit" describes a pipeline that does not exist — today only mock provider is wired (`REAL_PARSER_WIRED = false`); production sees honest-empty-state. Copy promises capability the build lacks | DEMO-BLOCKING (A5) |
| S-04 | DC-FP5-03 ↔ DC-FP5-06 | Card promises "De-duplication" as a current rule but honesty footer says dedup wiring is Phase 2 — same card contradicts itself | FUNCTIONAL (A5) |
| S-05 | DC-FP5-02 ↔ DC-FP5-06 | Card promises "Provenance" enforcement but honesty footer says provenance wiring is Phase 2 — same contradiction | FUNCTIONAL (A5) |
| S-06 | DC-BLOCK-03 ↔ DC-BLOCK-04 | Production-block empty state says "Please use manual entry" but offers only "← Back" — no inline "Enter manually" CTA. Dead-end against own copy promise | FUNCTIONAL (A4) |
| S-07 | DC-FP5M-10 ↔ DC-FP5M-11 | Honest-empty-state modal (real provider, no backend) closes to nothing — no fallback to manual entry offered. Same pattern as S-06 | FUNCTIONAL (A4) |
| S-08 | DC-FP5M-08 | "Commit" with zero accepted fields silently closes modal (`commitCapture` early-returns to `closeParsed`) — no user feedback that no commit occurred. Could be confusing | FUNCTIONAL (A2/A4) |
| S-09 | DC-MAN-07c / DC-MAN-07f / DC-MAN-07g / DC-MAN-07h | Wrapper chips show raw codes — GIA, BOND_ON, EIS, VCT — without plain-English labels. Non-expert user cannot distinguish. BOND_ON is the worst (underscore + code) | FUNCTIONAL (A5) |
| S-10 | DC-MAN-03 | "Manual entries are stored at full confidence (1.0)" — "1.0" is engineering jargon; user does not know what the confidence scale is | POLISH (A5) |
| S-11 | DC-EVT-02 / DC-EVT-03 | Envelope falls back to `'unknown'` user_id and `'no-session'` session_id if entity/session missing — these strings should never reach production event store; flag as missing init | FUNCTIONAL (A6) |
| S-12 | DC-EVT-08 | `rules_bundle_ref = 'UK-2026.1'` hardcoded — should reference `rules-uk.js` version SoT per memory `feedback_always_check_rules_uk.md` | POLISH (A6) |
| S-13 | global | Brand string check — verify no `Sonuswealth` / `Finio` / `FQ Score` strings reach user; component header comment mentions `2-Product-data-capture-v1_1.md` (developer-facing, OK) but H1 string "Get your data into Sonuswealth" passes the brand check on visible copy. Confirm no stragglers | FUNCTIONAL (A5/A6) — likely PASS |
| S-14 | DC-EVT-09 → DC-X-01 | RECONCILE: every captured asset must appear on My Money with same value + format. No verification today that downstream tab subscribes to these envelopes. Critical for FD-CROSS-1 ("Data Capture owns SOURCE"). If downstream consumer is missing, this screen is a write-only dead-end | DEMO-BLOCKING (FD-CROSS-1) |
| S-15 | DC-CH-04 / DC-CH-05 | Phase-2 channels render as full-size tiles with same chevron-style affordance as live channels — visual weight identical, only opacity 0.6 + ⏳ icon differs. Easy to mis-tap as live | POLISH (A4) |
| S-16 | DC-FP5M-02 ("DEMO PARSE" banner) | Banner appears only when `parsed.isMock` — but mock parser is allowed in dev OR for demo entities in prod. Verify demo entity in prod still surfaces the warning (it should, per `parsed.isMock` flag from parser result) | FUNCTIONAL (A5) |
| S-17 | DC-CH-01 / DC-CH-02 accept-type | Upload `accept` includes `.heic` (Apple format) — verify parser/mock handles it; otherwise user gets silent failure | POLISH (A2) |
| S-18 | DC-FP5M-06d | `fmtValue` for date returns `f.value` raw — no locale formatting. If parser returns ISO `2026-04-05` user sees machine date, not "5 Apr 2026" | POLISH (A5) |
| S-19 | DC-MAN-12 / DC-EVT-11 | Manual entry has no "income" or "bill" type — only a wrapper (asset-shaped) + unit (gbp/date/text). User cannot capture an income or a recurring bill manually from this screen. RECONCILE: bill calendar belongs on Timeline (memory `feedback_read_prior_first.md`) but capture must originate here | FUNCTIONAL (A4 / FD-CROSS-1) |
| S-20 | DC-PARSE-04 | Inline `<style>{`@keyframes sw-progress`}</style>` injection — re-injects on every render of parsing state. Minor perf / style-pollution risk | POLISH |

---

## COVERAGE MATH (this replaces "99% confident")

Total inventory rows: **97** (including sub-rows; count at audit time).

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100% (every row has a verdict).
The audit **terminates** per the runbook stopping rule — not at a round number.
"99% confident" is only a legitimate claim when Coverage = 100% and it is restated as:
*"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

---

*— end data-capture-screen-element-inventory-v1.md —*
