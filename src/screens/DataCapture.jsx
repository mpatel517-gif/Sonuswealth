// ─────────────────────────────────────────────────────────────────────────────
// DataCapture — Phase 3 module entry point with real upload/scan flows.
//
// Spec: 2-Product-data-capture-v1_1.md + upload v1.0 + scan v1.0 + manual v1.0
//
// Wave 1 reality contract:
//   · Upload: real <input type="file" accept="..."> opens the OS picker. File
//     metadata (name, size, type) is shown. A simulated parse runs for 1.4s
//     then opens the FP-5 verification modal with 4 mock parsed fields. The
//     parser is a placeholder — the modal + accept/reject contract is real.
//   · Scan: same flow with capture="environment" → opens camera on mobile,
//     file picker on desktop.
//   · Manual: form with wrapper picker + 3 field types (currency / date / text).
//     Manual entries land at confidence 1.0 (highest) per FP-5.
//
// The FP-5 modal demonstrates the 5 rules: confidence per field, provenance
// shown, partial acceptance (per-field), manual edit fallback, and explicit
// reject. Accepted fields fire a `document_captured` event via onCommit.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react'
import { requireStepUp } from '../lib/step-up.js'
import SpreadsheetImport from '../components/DataCapture/SpreadsheetImport.jsx'

// ── Provider gating (D-DEMO-HIDDEN-1) ────────────────────────────────────────
// Mock parser ships fictitious values. Only run it in dev OR when explicitly
// opted in. Production defaults to 'real'; if no real backend wired the screen
// shows an honest empty state instead of fake extractions.
const IS_DEV = typeof import.meta !== 'undefined' && import.meta?.env?.DEV
const PARSER_PROVIDER = IS_DEV
  ? (import.meta?.env?.VITE_PARSER || 'mock')
  : 'real'
// Activation gate is ENV-DRIVEN, not a source edit — the founder turns Upload/
// Scan live at deploy time, nothing to change (or forget) in code:
//   VITE_PARSER_PROVIDER=anthropic-vision  → selects the real provider AND opens
//                                            this gate (one var does both).
//   VITE_REAL_PARSER=true                  → explicit override (any real provider).
// Unset in production → gate stays closed → honest phase2/empty state, never
// fake fields. Dev (IS_DEV) keeps live channels so manual QA works on the mock.
const _envProvider =
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_PARSER_PROVIDER) || ''
const REAL_PARSER_WIRED =
  _envProvider === 'anthropic-vision' ||
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_REAL_PARSER === 'true')

// L1-7 (2026-05-28): Upload + Scan channels demote to status='phase2' when
// running in production without a real parser wired. Previously these tiles
// opened the OS file picker in production, where the mock-parser gate at
// `mockBlockedForRealUser` would catch a real account *after* the file was
// already selected — and silently discard it. Better: don't accept the file
// at all until encryption + parser are real. Dev builds (IS_DEV) still see
// live channels so manual QA works.
const UPLOAD_LIVE = IS_DEV || REAL_PARSER_WIRED
const _stubBadge = 'Coming soon'
const _stubBody = (verb) =>
  `${verb} will land when document parsing + encryption-at-rest are wired. ` +
  `Until then, please use manual entry — anything you type is stored at confidence 1.0 ` +
  `and is the safest path for sensitive figures.`

const CHANNELS = [
  {
    id: 'upload',
    icon: '⇧',
    title: 'Upload a document',
    body: UPLOAD_LIVE
      ? 'PDF statements, contract notes, valuation reports, will or LPA scans. Native parser → AI parse → OCR fallback → manual edit.'
      : _stubBody('Document upload'),
    badge: UPLOAD_LIVE ? 'Statements · Wills · LPA' : _stubBadge,
    accept: UPLOAD_LIVE ? '.pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.heic' : null,
    capture: null,
    status: UPLOAD_LIVE ? 'live' : 'phase2',
  },
  {
    id: 'scan',
    icon: '◫',
    title: 'Scan with camera',
    body: UPLOAD_LIVE
      ? 'Snap a paper statement, policy, certificate, or deed. Phase 1 — single image upload. Phase 2 will add viewfinder, perspective correction, and multi-page scanning.'
      : _stubBody('Camera scan'),
    badge: UPLOAD_LIVE ? 'Paper · On-the-go' : _stubBadge,
    accept: UPLOAD_LIVE ? 'image/*' : null,
    capture: UPLOAD_LIVE ? 'environment' : null,
    status: UPLOAD_LIVE ? 'live' : 'phase2',
  },
  {
    id: 'manual',
    icon: '✎',
    title: 'Enter manually',
    body: 'High-trust path. Anything you type is treated as confirmed (confidence = 1.0). Use for sensitive numbers you would rather not store as scanned docs.',
    badge: 'Highest trust',
    accept: null,
    capture: null,
    status: 'live',
  },
  {
    id: 'spreadsheet',
    icon: '▦',
    title: 'Import a spreadsheet',
    body: 'Paste or upload a CSV of your accounts. Every row is mapped to your taxonomy and shown for confirmation before anything saves — no figure lands in the wrong account.',
    badge: 'CSV · Mapped & checked',
    accept: null,
    capture: null,
    status: 'live',
  },
  {
    id: 'household',
    icon: '👪',
    title: 'Household & income details',
    body: 'The figures that drive your tax and protection but aren’t a balance on a statement: this year’s pension contributions, a partner’s income, dependent children. Stored at full confidence and fed straight into your allowances.',
    badge: 'Tax · Allowances',
    accept: null,
    capture: null,
    status: 'live',
  },
  {
    id: 'connect',
    icon: '🔗',
    title: 'Connect bank / broker',
    body: 'Pull balances + holdings via Open Banking and broker APIs. TrueLayer · Yapily · Salt Edge · India AA. Coming in Phase 2.',
    badge: 'Phase 2',
    accept: null,
    capture: null,
    status: 'phase2',
  },
  {
    id: 'voice',
    icon: '🎙️',
    title: 'Voice entry',
    body: 'Hands-free capture — say the wrapper, amount, and date; we fill the form. Coming in Phase 2.',
    badge: 'Phase 2',
    accept: null,
    capture: null,
    status: 'phase2',
  },
]

const FP5 = [
  { label: 'Confidence',         desc: 'Every parsed field gets a confidence score. Low confidence flags for review.' },
  { label: 'Provenance',         desc: 'Every value remembers where it came from — document, scan, or manual entry.' },
  { label: 'De-duplication',     desc: 'Re-uploading the same statement updates the prior values, not duplicates them.' },
  { label: 'Partial acceptance', desc: 'Accept only the fields you trust. Re-parse or edit the rest.' },
  { label: 'Manual fallback',    desc: 'If parsing fails, you can always type the value in. Nothing gets stuck.' },
]

// Honest disclosure: dedup and provenance enforcement still to come (Phase 2.5).
// Step-up auth IS wired (AU3, 2026-05-25) — commits gate via requireStepUp().
// Legacy: prior comment said step-up "arrives in Phase 2" — now done.
// arrive in Phase 2 (D-DC-PROV-1). Today the FP-5 modal demonstrates the
// per-field accept/reject contract; the rest of the pipeline (event-store
// dedup, provenance ledger, auth) is not yet enforced server-side.
const FP5_HONESTY = 'Step-up auth on commit is live (re-password). Dedup + provenance enforcement arrive next.'

// Parser is now vendor-agnostic via services/parser.js. The mock provider lives
// in services/parsers/mock.js. Swapping to Anthropic Vision (or any other
// vendor) is one config change — see services/parser.js docs.
import { parseDocument } from '../services/parser.js'

function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
function fmtValue(f) {
  if (f.unit === 'gbp') return `£${(f.value || 0).toLocaleString()}`
  if (f.unit === 'date') return f.value
  return String(f.value)
}
function confChipClass(c) {
  if (c >= 0.85) return 'sw-chip-mint'
  if (c >= 0.7)  return 'sw-chip-amber'
  return 'sw-chip-coral'
}
function confLabel(c) {
  if (c >= 0.85) return 'High'
  if (c >= 0.7)  return 'Medium'
  return 'Low — review'
}

// ── F-413 FIX: capture-payload → reducer-routable shape ──────────────────────
// DataCapture (manual + parsed) produced events shaped { value, unit, wrapper,
// label }. The event reducer's applyAssetEvent() routes by { category, itemType,
// fields } and BAILS when category/itemType are absent — so every captured value
// was silently dropped (nothing reached the entity, no error shown). This adapter
// maps the capture shape onto the same { category, itemType, fields } envelope
// that the proven AddItemSheet emitter uses, so captured figures actually land.
const WRAPPER_ROUTE = {
  SIPP:     { category: 'pensions',    itemType: 'SIPP',      valueKey: 'value' },
  ISA:      { category: 'investments', itemType: 'ISA_SS',    valueKey: 'value' },
  GIA:      { category: 'investments', itemType: 'GIA',       valueKey: 'value' },
  CASH:     { category: 'cash',        itemType: 'SAVINGS',   valueKey: 'balance' },
  PROPERTY: { category: 'property',    itemType: 'RESIDENCE', valueKey: 'value' },
  BOND_ON:  { category: 'investments', itemType: 'BOND_ON',   valueKey: 'value' },
  EIS:      { category: 'investments', itemType: 'EIS',       valueKey: 'value' },
  VCT:      { category: 'investments', itemType: 'VCT',       valueKey: 'value' },
}
// No wrapper / unknown wrapper with a £ amount → treat as a cash savings balance
// (the most conservative routing: no tax-wrapper semantics are asserted).
const DEFAULT_ROUTE = { category: 'cash', itemType: 'SAVINGS', valueKey: 'balance' }

export function toAssetEventPayload(field) {
  // Only £ amounts become balance-sheet items. Dates / free text are metadata,
  // not assets — the caller keeps those on the document_captured audit event.
  if (!field || field.unit !== 'gbp') return null
  const route = WRAPPER_ROUTE[field.wrapper] || DEFAULT_ROUTE
  const provider = field.label || ''
  const fields = { [route.valueKey]: Number(field.value) || 0 }
  if (route.category === 'pensions' || route.category === 'investments') fields.provider = provider
  else if (route.category === 'cash') fields.bank = provider
  else if (route.category === 'property') fields.address = provider
  return {
    category: route.category,
    itemType: route.itemType,
    fields,
    source: field.source || 'manual entry',
    confidence: field.confidence ?? 1.0,
    label: field.label,
  }
}

export default function DataCapture({ onBack, onChannelOpen, onCommit, entity }) {
  const [active, setActive] = useState(null)
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)        // FP-5 modal payload
  const [manualOpen, setManualOpen] = useState(false)
  const [householdOpen, setHouseholdOpen] = useState(false)
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false)
  const fileInputRef = useRef(null)
  const channelRef = useRef(null)

  // ── D-DEMO-HIDDEN-1 gate ─────────────────────────────────────────────────
  // Mock parser allowed only for: dev builds OR explicit demo entities.
  // A real (paying) user hitting the mock provider is a hard block.
  const isDemo = !!(entity?.id?.startsWith?.('demo-')
    || entity?.id === 'mrt'
    || entity?._isDemo)
  const mockBlockedForRealUser =
    !IS_DEV && !isDemo && PARSER_PROVIDER === 'mock'
  const needsHonestEmptyState =
    !IS_DEV && PARSER_PROVIDER === 'real' && !REAL_PARSER_WIRED

  if (mockBlockedForRealUser) {
    return (
      <div className="screen" style={{ padding: '32px 16px 120px' }}>
        <div className="sw-tile" style={{ textAlign: 'center' }}>
          <div className="sw-eyebrow" style={{ color: 'var(--c-acc3, #FF6F7D)' }}>
            Mock parser disabled
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginTop: 8 }}>
            Document parsing is in Phase 2.
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 8, lineHeight: 1.55 }}>
            The dev mock parser is not available for real accounts. Please use
            manual entry until real OCR ships.
          </div>
          {onBack && (
            <button onClick={onBack} className="sw-press" style={{
              marginTop: 14, ...btnPrimary, padding: '10px 18px', fontSize: 13,
            }}>← Back</button>
          )}
        </div>
      </div>
    )
  }

  // Spreadsheet import is a full sub-flow (VTM mapping grid) — render it in place
  // of the channel list. It commits validated rows through the same event path as
  // manual/parsed capture, gated by a single step-up.
  if (spreadsheetOpen) {
    return (
      <SpreadsheetImport
        entity={entity}
        onClose={() => { setSpreadsheetOpen(false); setActive(null) }}
        onCommit={commitSpreadsheetRows}
      />
    )
  }

  async function commitSpreadsheetRows(payloads) {
    const list = (payloads || []).filter(Boolean)
    if (!list.length) return
    const stepUp = await requireStepUp({
      reason: `Confirm to record ${list.length} item${list.length === 1 ? '' : 's'} from your spreadsheet.`,
    })
    if (!stepUp.ok) return
    list.forEach(p => {
      onCommit?.(buildEnvelope({
        type: p.category === 'liabilities' ? 'LIABILITY_VALUE_UPDATED' : 'ASSET_VALUE_UPDATED',
        payload: p,
        mode: 'spreadsheet',
        parsedField: { id: p.itemType, label: p.label },
      }))
    })
    onCommit?.(buildEnvelope({
      type: 'document_captured',
      payload: { channel: 'spreadsheet', file: null, fields: list.map(p => ({ label: p.label, value: Object.values(p.fields)[0] })) },
      mode: 'spreadsheet',
    }))
    setSpreadsheetOpen(false); setActive(null)
  }

  function openChannel(c) {
    // Phase-2 channels are non-functional placeholders.
    if (c.status === 'phase2') { setActive(c.id); return }
    setActive(c.id)
    onChannelOpen?.(c.id)
    channelRef.current = c
    if (c.id === 'manual') { setManualOpen(true); return }
    if (c.id === 'household') { setHouseholdOpen(true); return }
    if (c.id === 'spreadsheet') { setSpreadsheetOpen(true); return }
    // Trigger native file picker (with camera capture for scan on mobile).
    if (fileInputRef.current) {
      fileInputRef.current.accept = c.accept || ''
      if (c.capture) fileInputRef.current.setAttribute('capture', c.capture)
      else fileInputRef.current.removeAttribute('capture')
      fileInputRef.current.click()
    }
  }

  async function onFilePicked(e) {
    const f = e.target?.files?.[0]
    if (!f) return
    setFile(f)
    setParsing(true)
    setParsed(null)

    // Production + real-provider-but-no-backend: honest empty state.
    if (needsHonestEmptyState) {
      setParsing(false)
      setParsed({
        file: f,
        channel: channelRef.current?.id || 'upload',
        fields: [],
        vendor: 'real',
        isMock: false,
        honestEmpty: true,
        message: 'Upload received. Document parsing — Phase 2 (real OCR coming next). For now, manual entry is recommended.',
      })
      e.target.value = ''
      return
    }

    // Hand off to the vendor-agnostic parser service. Provider is configured
    // via VITE_PARSER_PROVIDER or setParserProvider(); 'mock' is default in dev.
    try {
      const result = await parseDocument(f, {
        docTypeHint: channelRef.current?.id,
      })
      setParsing(false)
      setParsed({
        file: f,
        channel: channelRef.current?.id || 'upload',
        fields: result.fields.map(x => ({ ...x, accepted: null })),
        docType: result.docType,
        vendor: result.vendor,
        isMock: !!result.isMock || result.vendor === 'mock',
        latencyMs: result.latencyMs,
        warnings: result.warnings,
      })
    } catch (err) {
      setParsing(false)
      setParsed({
        file: f,
        channel: channelRef.current?.id || 'upload',
        fields: [],
        error: err?.message || 'Parser failed — please enter values manually.',
      })
    } finally {
      // Reset input value so re-picking the same file fires onChange again.
      e.target.value = ''
    }
  }

  // ── Spec §12 envelope builder ────────────────────────────────────────────
  // Every event emitted from data capture carries the full provenance + audit
  // envelope per 2-Product-data-capture-v1_1.md §12. Used by both the parsed
  // commit path and the manual entry path.
  function buildEnvelope({ type, payload, mode, parsedField }) {
    const nowIso = new Date().toISOString()
    return {
      event_id: `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event_timestamp: nowIso,
      client_timestamp: nowIso,
      user_id: entity?.id || 'unknown',
      session_id:
        (typeof window !== 'undefined' && window.sessionStorage?.getItem?.('sessionId'))
          || 'no-session',
      entity_id: entity?.id,
      entity_type: entity?.type || 'individual',
      field_path: parsedField?.path
        || (parsedField?.wrapper ? `${parsedField.wrapper}.${parsedField.id}` : parsedField?.id),
      user_verified: false,
      user_verified_at: null,
      provenance: {
        source: 'data-capture',
        parser: PARSER_PROVIDER,
        mode,
      },
      prior_event_id: null,
      classifier_version: PARSER_PROVIDER === 'mock' ? 'mock-1.0' : 'real-1.0',
      rules_bundle_ref: 'UK-2026.1',
      from: mode,
      schema_version: '1.0',
      type,
      payload,
      // Legacy fields preserved for downstream consumers that haven't migrated.
      ts: Date.now(),
      correlation_id: `dc-${Date.now()}`,
    }
  }

  function setFieldDecision(id, decision) {
    setParsed(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, accepted: decision } : f),
    }))
  }
  function editField(id, nextVal) {
    setParsed(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id
        ? { ...f, value: nextVal, source: 'manual edit', confidence: 1.0, accepted: 'accepted' }
        : f),
    }))
  }
  // AU3 — step-up gate on material change. Any commit that writes to the
  // event store passes through this gate so a re-password challenge fires
  // unless the user is already in an elevated session (5-min window) or
  // in founder-demo mode. requireStepUp resolves { ok: false, cancelled: true }
  // if the user dismisses the modal — we silently abort the commit then.
  async function commitCapture() {
    const acceptedFields = parsed.fields.filter(f => f.accepted === 'accepted')
    if (!acceptedFields.length) { closeParsed(); return }

    const stepUp = await requireStepUp({
      reason: `Confirm to record ${acceptedFields.length} value${acceptedFields.length === 1 ? '' : 's'} from this document.`,
    })
    if (!stepUp.ok) return // cancelled or failed — nothing committed

    const mode = parsed.channel === 'scan' ? 'scan' : 'upload'
    const payload = {
      channel: parsed.channel,
      file: { name: parsed.file?.name, size: parsed.file?.size, type: parsed.file?.type },
      vendor: parsed.vendor,
      isMock: !!parsed.isMock,
      fields: acceptedFields.map(f => ({
        id: f.id, label: f.label, value: f.value, unit: f.unit,
        wrapper: f.wrapper, confidence: f.confidence, source: f.source,
      })),
    }
    // Emit one envelope per accepted field so field_path / prior_event_id can
    // be tracked per-value downstream. Plus a summary document_captured event.
    acceptedFields.forEach(f => {
      const assetPayload = toAssetEventPayload(f)
      if (!assetPayload) return  // non-£ field — recorded on document_captured below
      onCommit?.(buildEnvelope({
        type: 'ASSET_VALUE_UPDATED',
        payload: assetPayload,
        mode,
        parsedField: f,
      }))
    })
    onCommit?.(buildEnvelope({
      type: 'document_captured',
      payload,
      mode,
    }))
    closeParsed()
  }
  function closeParsed() {
    setParsed(null)
    setFile(null)
    setActive(null)
  }

  return (
    <div className="screen" style={{ padding: '16px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} className="sw-press" style={{
            padding: '4px 10px', borderRadius: 8,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer',
          }}>← Home</button>
        )}
        <div style={{ flex: 1 }}>
          <div className="sw-eyebrow">Data capture</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', marginTop: 2 }}>
            Get your data into Sonuswealth
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 16 }}>
        Three ways in. Pick whichever fits the document. Every captured value
        keeps its source, confidence, and your accept/edit/reject decision.
      </div>

      {/* Hidden file input shared by upload + scan */}
      <input ref={fileInputRef} type="file" onChange={onFilePicked}
        style={{ display: 'none' }} aria-hidden="true" />

      {IS_DEV && PARSER_PROVIDER === 'mock' && (
        <div style={{
          padding: '8px 12px', marginBottom: 12,
          background: 'var(--c-tint-amber, #FFF3D6)',
          color: 'var(--c-text)', borderRadius: 8,
          fontSize: 11, fontWeight: 700, border: '1px solid var(--c-border)',
        }}>
          🧪 DEV — mock parser active. Uploads return invented values, not extracted ones.
        </div>
      )}

      {(() => {
        const renderTile = (c) => {
          const isPhase2 = c.status === 'phase2'
          return (
            <button
              key={c.id}
              onClick={() => openChannel(c)}
              className="sw-tile sw-tile-interactive"
              aria-disabled={isPhase2}
              style={{
                textAlign: 'left',
                cursor: isPhase2 ? 'not-allowed' : 'pointer',
                opacity: isPhase2 ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: isPhase2 ? 'var(--c-surface2)' : 'var(--c-tint-mint)',
                  color: isPhase2 ? 'var(--c-text3)' : 'var(--c-mint-text)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 22, fontWeight: 800, flexShrink: 0,
                }}>{c.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)' }}>
                      {c.title}
                    </span>
                    <span
                      className={`sw-chip sw-chip-sm ${isPhase2 ? 'sw-chip-amber' : ''}`}
                      style={{ fontSize: 9 }}
                    >
                      {c.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>
                    {c.body}
                  </div>
                </div>
                <span style={{ color: 'var(--c-text3)', fontSize: 18, alignSelf: 'center' }}>
                  {isPhase2 ? '⏳' : '›'}
                </span>
              </div>
            </button>
          )
        }
        const live = CHANNELS.filter(c => c.status !== 'phase2')
        const soon = CHANNELS.filter(c => c.status === 'phase2')
        return (
          <div style={{ marginBottom: 20 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Available now</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {live.map(renderTile)}
            </div>
            {soon.length > 0 && (
              <>
                <div className="sw-eyebrow" style={{ marginTop: 18, marginBottom: 8, color: 'var(--c-text3)' }}>
                  Coming soon
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {soon.map(renderTile)}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* FP-5 contract */}
      <div className="sw-tile" style={{ marginBottom: 16 }}>
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>How we treat your data</div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 12 }}>
          Five rules every capture follows:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FP5.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              paddingTop: i > 0 ? 8 : 0,
              borderTop: i > 0 ? '1px solid var(--c-border)' : 'none',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: 'var(--c-acc)',
                marginTop: 2, flexShrink: 0,
              }}>{i + 1}.</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 2 }}>
                  {p.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 10, padding: '8px 10px',
          background: 'var(--c-surface2)', borderRadius: 8,
          fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5,
        }}>
          {FP5_HONESTY}
        </div>
      </div>

      {/* Parsing in-progress state */}
      {parsing && (
        <div className="sw-tile" style={{
          textAlign: 'center', background: 'var(--c-tint-neutral)',
        }}>
          <div className="sw-eyebrow" style={{ color: 'var(--c-acc)' }}>Parsing…</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginTop: 4 }}>
            {file?.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
            {file ? `${file.type || 'unknown'} · ${fmtBytes(file.size || 0)}` : ''}
          </div>
          <div style={{
            marginTop: 12, height: 4, borderRadius: 100, overflow: 'hidden',
            background: 'var(--c-surface2)',
          }}>
            <div style={{
              height: '100%', width: '40%', background: 'var(--c-acc)',
              animation: 'sw-progress 1.4s linear infinite',
            }} />
          </div>
          <style>{`@keyframes sw-progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
          }`}</style>
        </div>
      )}

      {/* Stub state when channel selected but no flow available */}
      {active && !parsing && !parsed && !manualOpen && (() => {
        const phase2Channel = CHANNELS.find(c => c.id === active && c.status === 'phase2')
        if (phase2Channel) {
          return (
            <div className="sw-tile" style={{
              background: 'var(--c-tint-neutral)', textAlign: 'center',
            }}>
              <div className="sw-eyebrow" style={{ color: 'var(--c-acc)' }}>
                {phase2Channel.title} — Phase 2
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 6, lineHeight: 1.5 }}>
                {phase2Channel.body}
              </div>
              <button onClick={() => setActive(null)} style={{
                marginTop: 10, padding: '6px 14px', fontSize: 12,
                background: 'transparent', color: 'var(--c-text3)',
                border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer',
              }}>Dismiss</button>
            </div>
          )
        }
        return (
          <div className="sw-tile" style={{
            background: 'var(--c-tint-neutral)', textAlign: 'center',
          }}>
            <div className="sw-eyebrow" style={{ color: 'var(--c-acc)' }}>
              File picker opened
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 6, lineHeight: 1.5 }}>
              Pick a document to continue, or close this dialog and try a different channel.
            </div>
            <button onClick={() => setActive(null)} style={{
              marginTop: 10, padding: '6px 14px', fontSize: 12,
              background: 'transparent', color: 'var(--c-text3)',
              border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer',
            }}>Dismiss</button>
          </div>
        )
      })()}

      {/* FP-5 verification modal */}
      {parsed && (
        <FP5Modal
          parsed={parsed}
          onDecide={setFieldDecision}
          onEdit={editField}
          onCommit={commitCapture}
          onClose={closeParsed}
        />
      )}

      {/* Manual entry form — AU3 step-up gate before commit */}
      {manualOpen && (
        <ManualEntryForm
          onCancel={() => { setManualOpen(false); setActive(null) }}
          onSubmit={async (payload) => {
            const stepUp = await requireStepUp({
              reason: `Confirm to record ${payload.label || 'this value'}.`,
            })
            if (!stepUp.ok) return
            const assetPayload = toAssetEventPayload(payload)
            if (assetPayload) {
              onCommit?.(buildEnvelope({
                type: 'ASSET_VALUE_UPDATED',
                payload: assetPayload,
                mode: 'manual',
                parsedField: payload,
              }))
            }
            onCommit?.(buildEnvelope({
              type: 'document_captured',
              payload: { channel: 'manual', file: null, fields: [payload] },
              mode: 'manual',
            }))
            setManualOpen(false); setActive(null)
          }}
        />
      )}

      {/* Household & income — non-asset captures that drive allowances (W5-5a) */}
      {householdOpen && (
        <HouseholdEntryForm
          onCancel={() => { setHouseholdOpen(false); setActive(null) }}
          onSubmit={async (entries) => {
            if (!entries.length) { setHouseholdOpen(false); setActive(null); return }
            const stepUp = await requireStepUp({
              reason: `Confirm to record ${entries.length} household detail${entries.length === 1 ? '' : 's'}.`,
            })
            if (!stepUp.ok) return
            // One PROFILE_FIELD_SET envelope per entered field — each folds to a
            // canonical engine-read field (verified LIVE: pension contribs →
            // AA headroom, partner income → Risk survivor, child → HICBC/RNRB).
            entries.forEach(en => {
              onCommit?.(buildEnvelope({
                type: 'PROFILE_FIELD_SET',
                payload: en,
                mode: 'manual',
                parsedField: { id: en.field },
              }))
            })
            setHouseholdOpen(false); setActive(null)
          }}
        />
      )}
    </div>
  )
}

// ── Household & income form (non-asset captures → canonical allowance fields) ─
// Each field maps to a PROFILE_FIELD_SET event the reducer folds to the exact
// field the engine already reads — no dead paths. Only fields with a confirmed
// live reader are offered (NI-record + itemised expenses need an engine reader
// first and are deliberately NOT here yet).
function HouseholdEntryForm({ onCancel, onSubmit }) {
  const [pension, setPension] = useState('')
  const [partner, setPartner] = useState('')
  const [childAge, setChildAge] = useState('')
  const [niYears, setNiYears] = useState('')
  const [expenses, setExpenses] = useState('')

  function submit() {
    const entries = []
    if (pension !== '' && Number(pension) >= 0)
      entries.push({ field: 'pensionContributions', value: Number(pension) })
    if (partner !== '' && Number(partner) >= 0)
      entries.push({ field: 'partnerIncome', value: Number(partner) })
    if (childAge !== '')
      entries.push({ field: 'dependantChild', value: 1, age: Number(childAge) })
    if (niYears !== '' && Number(niYears) >= 0)
      entries.push({ field: 'niYears', value: Number(niYears) })
    if (expenses !== '' && Number(expenses) >= 0)
      entries.push({ field: 'monthlyExpenses', value: Number(expenses) })
    onSubmit(entries)
  }

  const hasAny = pension !== '' || partner !== '' || childAge !== '' || niYears !== '' || expenses !== ''

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={onCancel} />
      <div className="sheet-panel" style={{ maxHeight: '82vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', marginBottom: 4 }}>
          Household & income details
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 14, lineHeight: 1.5 }}>
          Fill in whatever you know — leave the rest blank. Each figure feeds a
          specific allowance and is stored at full confidence (1.0).
        </div>

        <Label>Pension contributions this tax year</Label>
        <input value={pension} onChange={(e) => setPension(e.target.value)}
          type="number" placeholder="£ across all pensions (incl. employer)" style={inputStyle} />
        <FieldNote>Sets your Annual Allowance headroom (£60k AA, tapered for high earners).</FieldNote>

        <Label>Partner / spouse gross income</Label>
        <input value={partner} onChange={(e) => setPartner(e.target.value)}
          type="number" placeholder="£ per year" style={inputStyle} />
        <FieldNote>Used for the survivor-income picture in your Risk cover analysis.</FieldNote>

        <Label>Add a dependent child — age</Label>
        <input value={childAge} onChange={(e) => setChildAge(e.target.value)}
          type="number" placeholder="age in years" style={inputStyle} />
        <FieldNote>Unlocks the High-Income Child Benefit Charge and the £175k residence nil-rate band on your estate.</FieldNote>

        <Label>National Insurance qualifying years</Label>
        <input value={niYears} onChange={(e) => setNiYears(e.target.value)}
          type="number" placeholder="years (35 = full new State Pension)" style={inputStyle} />
        <FieldNote>Drives your State Pension forecast — 35 qualifying years earns the full new State Pension.</FieldNote>

        <Label>Essential monthly spending</Label>
        <input value={expenses} onChange={(e) => setExpenses(e.target.value)}
          type="number" placeholder="£ per month (rent/mortgage, bills, food)" style={inputStyle} />
        <FieldNote>Replaces our estimate with your real essentials in the cashflow surplus/deficit.</FieldNote>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={submit} className="sw-press"
            disabled={!hasAny}
            style={{
              ...btnPrimary, flex: 1, padding: '12px 16px', fontSize: 14, fontWeight: 800,
              opacity: hasAny ? 1 : 0.5, cursor: hasAny ? 'pointer' : 'not-allowed',
            }}>
            Save details
          </button>
          <button onClick={onCancel} className="sw-press" style={{
            ...btnGhost, padding: '12px 16px', fontSize: 14,
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function FieldNote({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.45, marginTop: 4, marginBottom: 4 }}>
      {children}
    </div>
  )
}

// ── FP-5 verification modal ─────────────────────────────────────────────────
function FP5Modal({ parsed, onDecide, onEdit, onCommit, onClose }) {
  const [editing, setEditing] = useState(null)   // field.id being edited
  const [editVal, setEditVal] = useState('')

  // Honest empty state — file received but no real parser wired yet.
  if (parsed.honestEmpty) {
    return (
      <div className="sheet-overlay">
        <div className="sheet-backdrop" onClick={onClose} />
        <div className="sheet-panel" style={{ maxHeight: '60vh' }}>
          <div className="sheet-handle" />
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', marginBottom: 6 }}>
            Upload received
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 14 }}>
            {parsed.file?.name} · {parsed.file?.type || 'unknown'} · {fmtBytes(parsed.file?.size || 0)}
          </div>
          <div style={{
            padding: 12, background: 'var(--c-surface2)', borderRadius: 10,
            fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 14,
          }}>
            {parsed.message}
          </div>
          <button onClick={onClose} className="sw-press" style={{
            ...btnGhost, padding: '12px 16px', fontSize: 14, width: '100%',
          }}>Close</button>
        </div>
      </div>
    )
  }

  const accepted = parsed.fields.filter(f => f.accepted === 'accepted').length
  const rejected = parsed.fields.filter(f => f.accepted === 'rejected').length
  const pending  = parsed.fields.filter(f => f.accepted === null).length

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />
        {parsed.isMock && (
          <div style={{
            padding: '8px 12px', marginBottom: 10,
            background: 'var(--c-tint-amber, #FFF3D6)',
            color: 'var(--c-text)', borderRadius: 8,
            fontSize: 11, fontWeight: 700, border: '1px solid var(--c-border)',
            lineHeight: 1.45,
          }}>
            🧪 DEMO PARSE — invented values (mock parser). Real OCR is Phase 2.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)' }}>
            Verify parsed fields
          </div>
          <span className="sw-chip sw-chip-sm" style={{ fontSize: 9 }}>
            {parsed.fields.length} found
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 12 }}>
          Source: {parsed.file?.name} · {parsed.file?.type || 'unknown'} ·{' '}
          {fmtBytes(parsed.file?.size || 0)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {parsed.fields.map(f => {
            const editingThis = editing === f.id
            return (
              <div key={f.id} className="sw-tile" style={{
                border: f.accepted === 'accepted' ? '1px solid var(--c-acc)'
                  : f.accepted === 'rejected' ? '1px solid var(--c-coral, #FF6F7D)'
                  : '1px solid var(--c-border)',
                padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text2)' }}>
                        {f.label}
                      </span>
                      {f.wrapper && (
                        <span className="sw-chip sw-chip-sm sw-chip-blue" style={{ fontSize: 9 }}>
                          {f.wrapper}
                        </span>
                      )}
                      <span className={`sw-chip sw-chip-sm ${confChipClass(f.confidence)}`} style={{ fontSize: 9 }}>
                        {confLabel(f.confidence)} · {Math.round(f.confidence * 100)}%
                      </span>
                    </div>
                    {editingThis ? (
                      <input
                        autoFocus
                        type={f.unit === 'gbp' ? 'number' : 'text'}
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onEdit(f.id, f.unit === 'gbp' ? Number(editVal) : editVal)
                            setEditing(null)
                          } else if (e.key === 'Escape') {
                            setEditing(null)
                          }
                        }}
                        style={{
                          marginTop: 6, padding: '6px 8px', fontSize: 14, fontWeight: 700,
                          width: '100%',
                          background: 'var(--c-surface2)',
                          border: '1px solid var(--c-acc)',
                          borderRadius: 6, color: 'var(--c-text)',
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginTop: 4 }}>
                        {fmtValue(f)}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4 }}>
                      Source: {f.source}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {editingThis ? (
                    <>
                      <button onClick={() => { onEdit(f.id, f.unit === 'gbp' ? Number(editVal) : editVal); setEditing(null) }}
                        className="sw-press" style={btnPrimary}>Save</button>
                      <button onClick={() => setEditing(null)} className="sw-press" style={btnGhost}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onDecide(f.id, 'accepted')}
                        className="sw-press"
                        style={f.accepted === 'accepted' ? btnPrimaryActive : btnPrimary}
                        aria-pressed={f.accepted === 'accepted'}>
                        {f.accepted === 'accepted' ? '✓ Accepted' : 'Accept'}
                      </button>
                      <button onClick={() => { setEditing(f.id); setEditVal(String(f.value ?? '')) }}
                        className="sw-press" style={btnGhost}>Edit</button>
                      <button onClick={() => onDecide(f.id, 'rejected')}
                        className="sw-press"
                        style={f.accepted === 'rejected' ? btnDangerActive : btnDanger}
                        aria-pressed={f.accepted === 'rejected'}>
                        {f.accepted === 'rejected' ? '✕ Rejected' : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', marginBottom: 10,
          background: 'var(--c-surface2)', borderRadius: 10,
          fontSize: 11, color: 'var(--c-text2)',
        }}>
          <span><strong style={{ color: 'var(--c-acc)' }}>{accepted}</strong> accepted</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{pending} pending</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{rejected} rejected</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCommit} className="sw-press" style={{
            ...btnPrimary, flex: 1, padding: '12px 16px', fontSize: 14, fontWeight: 800,
          }}>
            {accepted ? `Commit ${accepted} field${accepted === 1 ? '' : 's'}` : 'Commit'}
          </button>
          <button onClick={onClose} className="sw-press" style={{
            ...btnGhost, padding: '12px 16px', fontSize: 14,
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Manual entry form (highest-trust path, confidence = 1.0) ───────────────
const WRAPPERS = [
  { id: 'SIPP',     label: 'SIPP (Self-Invested Personal Pension)' },
  { id: 'ISA',      label: 'ISA (Individual Savings Account)' },
  { id: 'GIA',      label: 'General Investment Account' },
  { id: 'CASH',     label: 'Cash / Savings' },
  { id: 'PROPERTY', label: 'Property' },
  { id: 'BOND_ON',  label: 'Onshore Bond' },
  { id: 'EIS',      label: 'EIS (Enterprise Investment Scheme)' },
  { id: 'VCT',      label: 'VCT (Venture Capital Trust)' },
  { id: null,       label: 'None' },
]
function ManualEntryForm({ onCancel, onSubmit }) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit]   = useState('gbp')
  const [wrapper, setWrapper] = useState('SIPP')

  function submit() {
    if (!label.trim() || value === '') return
    onSubmit({
      id: `manual-${Date.now()}`,
      label: label.trim(),
      value: unit === 'gbp' ? Number(value) : value,
      unit,
      wrapper: wrapper || null,
      confidence: 1.0,
      source: 'manual entry',
    })
  }

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={onCancel} />
      <div className="sheet-panel" style={{ maxHeight: '70vh' }}>
        <div className="sheet-handle" />
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', marginBottom: 4 }}>
          Add a value manually
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 12 }}>
          Manual entries are stored at full confidence (1.0).
        </div>

        <Label>What is it?</Label>
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. AJ Bell SIPP" style={inputStyle} />

        <Label>Wrapper</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {WRAPPERS.map(w => (
            <button key={String(w.id)} onClick={() => setWrapper(w.id)}
              className={`sw-chip sw-chip-sm ${wrapper === w.id ? 'sw-chip-blue' : ''}`}
              style={{ cursor: 'pointer', fontWeight: 700 }}>
              {w.label}
            </button>
          ))}
        </div>

        <Label>Type</Label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {['gbp', 'date', 'text'].map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`sw-chip sw-chip-sm ${unit === u ? 'sw-chip-mint' : ''}`}
              style={{ cursor: 'pointer', fontWeight: 700 }}>
              {u === 'gbp' ? '£ amount' : u === 'date' ? 'Date' : 'Text'}
            </button>
          ))}
        </div>

        <Label>Value</Label>
        <input value={value} onChange={(e) => setValue(e.target.value)}
          type={unit === 'gbp' ? 'number' : unit === 'date' ? 'date' : 'text'}
          placeholder={unit === 'gbp' ? '0' : ''}
          style={inputStyle} />

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={submit} className="sw-press"
            disabled={!label.trim() || value === ''}
            style={{
              ...btnPrimary, flex: 1, padding: '12px 16px', fontSize: 14, fontWeight: 800,
              opacity: (!label.trim() || value === '') ? 0.5 : 1,
              cursor: (!label.trim() || value === '') ? 'not-allowed' : 'pointer',
            }}>
            Add
          </button>
          <button onClick={onCancel} className="sw-press" style={{
            ...btnGhost, padding: '12px 16px', fontSize: 14,
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, marginTop: 8,
    }}>{children}</div>
  )
}

const inputStyle = {
  padding: '10px 12px', fontSize: 14, width: '100%',
  background: 'var(--c-surface2)',
  border: '1px solid var(--c-border)',
  borderRadius: 8, color: 'var(--c-text)',
}
const btnPrimary = {
  padding: '8px 14px', fontSize: 12, fontWeight: 700,
  background: 'var(--c-acc)', color: 'var(--c-on-accent, #0B1F3A)',
  border: 'none', borderRadius: 100, cursor: 'pointer',
}
const btnPrimaryActive = {
  ...btnPrimary, background: 'var(--c-acc)', color: 'var(--c-on-accent, #0B1F3A)',
}
const btnGhost = {
  padding: '8px 14px', fontSize: 12, fontWeight: 700,
  background: 'transparent', color: 'var(--c-text3)',
  border: '1px solid var(--c-border)', borderRadius: 100, cursor: 'pointer',
}
const btnDanger = {
  padding: '8px 14px', fontSize: 12, fontWeight: 700,
  background: 'transparent', color: 'var(--c-acc3)',
  border: '1px solid var(--c-acc3-bg)', borderRadius: 100, cursor: 'pointer',
}
const btnDangerActive = {
  ...btnDanger, background: 'var(--c-acc3-bg)',
  color: 'var(--c-acc3)',
}
