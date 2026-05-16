// ─────────────────────────────────────────────────────────────────────────────
// MOCK PARSER — DEV-ONLY driver behind the parseDocument() interface.
//
// WARNING: Returns FICTITIOUS values (AJ Bell, Bruce Wayne, Nationwide etc.)
// that are *not* extracted from the uploaded file. The filename is sniffed,
// then a plausible-looking field set is returned. This exists so the FP-5
// review UX has data to render in dev. NEVER ship this to real users —
// gated by DataCapture.jsx via IS_DEV + isDemo checks (D-DEMO-HIDDEN-1).
//
// Swap-in target: services/parsers/anthropic-vision.js (Claude Vision parsing
// of the PDF/image with structured output) plus /api/parse server endpoint.
// ─────────────────────────────────────────────────────────────────────────────

export const IS_MOCK = true
export const MOCK_PROVIDER_LABEL = 'mock-parser-dev-only'

const SIMULATED_LATENCY_MS = 1400

function fieldsFor(name) {
  const n = String(name || '').toLowerCase()
  if (n.includes('sipp') || n.includes('pension')) {
    return {
      docType: 'sipp-statement',
      fields: [
        { id: 'sipp_value',     label: 'SIPP value',         value: 487320,       unit: 'gbp',  wrapper: 'PENSION', confidence: 0.94, source: 'native PDF text' },
        { id: 'sipp_contrib',   label: 'YTD contribution',   value: 12500,        unit: 'gbp',  wrapper: 'PENSION', confidence: 0.88, source: 'native PDF text' },
        { id: 'sipp_provider',  label: 'Provider',           value: 'AJ Bell',    unit: 'text', wrapper: 'PENSION', confidence: 0.97, source: 'document header' },
        { id: 'sipp_statement', label: 'Statement date',     value: '2026-03-31', unit: 'date', wrapper: null,      confidence: 0.62, source: 'page footer (OCR fallback)' },
      ],
    }
  }
  if (n.includes('isa')) {
    return {
      docType: 'isa-statement',
      fields: [
        { id: 'isa_value',    label: 'ISA value',         value: 78400,    unit: 'gbp',  wrapper: 'ISA', confidence: 0.96, source: 'native PDF text' },
        { id: 'isa_ytd',      label: 'YTD subscription',  value: 20000,    unit: 'gbp',  wrapper: 'ISA', confidence: 0.92, source: 'transaction line' },
        { id: 'isa_provider', label: 'Provider',          value: 'Vanguard', unit: 'text', wrapper: 'ISA', confidence: 0.95, source: 'document header' },
      ],
    }
  }
  if (n.includes('mortgage')) {
    return {
      docType: 'mortgage-statement',
      fields: [
        { id: 'mort_outstanding', label: 'Outstanding balance', value: 240000,       unit: 'gbp',  wrapper: null, confidence: 0.95, source: 'native PDF text' },
        { id: 'mort_rate',        label: 'Interest rate',       value: 0.0479,       unit: 'pct',  wrapper: null, confidence: 0.91, source: 'native PDF text' },
        { id: 'mort_fix_end',     label: 'Fix-end date',        value: '2027-08-31', unit: 'date', wrapper: null, confidence: 0.73, source: 'OCR fallback' },
        { id: 'mort_provider',    label: 'Lender',              value: 'Nationwide', unit: 'text', wrapper: null, confidence: 0.94, source: 'document header' },
      ],
    }
  }
  if (n.includes('btl') || n.includes('rental')) {
    return {
      docType: 'btl-statement',
      fields: [
        { id: 'btl_address',  label: 'Property address',  value: '99 Test Lane, Brighton BN1', unit: 'text', wrapper: 'PROPERTY', confidence: 0.97, source: 'document header' },
        { id: 'btl_value',    label: 'Market value',      value: 275000, unit: 'gbp',  wrapper: 'PROPERTY', confidence: 0.81, source: 'agent estimate' },
        { id: 'btl_rent',     label: 'Monthly rent',      value: 1450,   unit: 'gbp',  wrapper: 'PROPERTY', confidence: 0.94, source: 'tenancy agreement' },
        { id: 'btl_mortgage', label: 'Outstanding loan',  value: 198000, unit: 'gbp',  wrapper: null,       confidence: 0.92, source: 'mortgage statement' },
      ],
    }
  }
  return {
    docType: 'generic-statement',
    fields: [
      { id: 'acct_balance',  label: 'Account balance',      value: 24650,       unit: 'gbp',  wrapper: null, confidence: 0.81, source: 'native PDF text' },
      { id: 'acct_holder',   label: 'Account holder',       value: 'Bruce Wayne', unit: 'text', wrapper: null, confidence: 0.89, source: 'document header' },
      { id: 'acct_provider', label: 'Provider',             value: 'HSBC',      unit: 'text', wrapper: null, confidence: 0.93, source: 'document logo (AI)' },
      { id: 'acct_date',     label: 'Statement date',       value: '2026-04-12', unit: 'date', wrapper: null, confidence: 0.66, source: 'OCR fallback' },
    ],
  }
}

export default async function mockProvider(file, _opts) {
  // Simulate vendor latency so the FP-5 review UX has a real "parsing…" state
  // to render. The real Vision call costs ~800–2500ms end-to-end.
  await new Promise(res => setTimeout(res, SIMULATED_LATENCY_MS))
  const { docType, fields } = fieldsFor(file?.name)
  return {
    docType,
    fields,
    vendor: 'mock',
    isMock: true,
    warnings: [
      'DEMO PARSE — values are invented, not extracted from the file. Real OCR is Phase 2.',
    ],
  }
}
