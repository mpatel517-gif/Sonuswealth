// events-fold-helpers.js — pure fold helpers extracted from events.jsx so they
// can be unit-tested under Node without a JSX loader (mirrors the
// events-validator.js precedent). events.jsx imports these; the test imports
// these. No React, no side effects beyond the entity object passed in.
//
// Covers:
//   · _slug / _parsePath / _getByPath / _setByPath — path utilities
//   · _targetArrayFor / resolveExistingId — update-by-identity matcher
//     (fixes the capture-flow "edit inserts a duplicate" bug for id-less
//      fixture items)
//   · applyFieldCorrection — surgical single-field edit + provenance +
//     audit trail (ASSET_FIELD_CORRECTED)

// Deterministic slug for stamping ids onto id-less fixture items (no Date.now —
// must be stable across event re-folds or the matcher would drift).
export function _slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item'
}

// Parse a dot/bracket path into segments: 'a.b[0].c' → ['a','b',0,'c'].
export function _parsePath(path) {
  const out = []
  for (const part of String(path).split('.')) {
    const m = part.match(/^([^[]+)((\[\d+\])*)$/)
    if (!m) { out.push(part); continue }
    out.push(m[1])
    const brackets = m[2].match(/\[(\d+)\]/g) || []
    for (const b of brackets) out.push(+b.slice(1, -1))
  }
  return out
}

// Read a value at a path. Returns undefined if any segment is missing.
export function _getByPath(root, path) {
  let cur = root
  for (const seg of _parsePath(path)) {
    if (cur == null) return undefined
    cur = cur[seg]
  }
  return cur
}

// Set a value at a path. Returns { ok, parent } — parent is the object that
// directly contains the final field (used to attach per-record provenance).
// Does NOT create missing intermediate objects (a correction targets an
// existing field; if the path is broken we no-op rather than fabricate shape).
export function _setByPath(root, path, value) {
  const segs = _parsePath(path)
  if (segs.length === 0) return { ok: false, parent: null }
  let cur = root
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur == null || cur[segs[i]] == null) return { ok: false, parent: null }
    cur = cur[segs[i]]
  }
  if (cur == null) return { ok: false, parent: null }
  cur[segs[segs.length - 1]] = value
  return { ok: true, parent: cur }
}

// Return the array slot a (category, itemType) pair routes to, mirroring the
// switch in applyAssetEvent. Singletons return null (they update-by-replacement
// and can't duplicate).
export function _targetArrayFor(e, category, itemType) {
  const a = e.assets || {}
  switch (category) {
    case 'pensions':
      if (itemType === 'STATE') return null
      if (itemType === 'DB') return Array.isArray(a.pensions) ? a.pensions : null
      if (itemType === 'FAD' || itemType === 'ANNUITY') return Array.isArray(a.decumulation) ? a.decumulation : null
      return Array.isArray(a.sipp?.pensions) ? a.sipp.pensions : null
    case 'investments':  return Array.isArray(a.investments) ? a.investments : null
    case 'property':     return itemType === 'RESIDENCE' ? null : (Array.isArray(a.property) ? a.property : null)
    case 'cash':         return Array.isArray(a.bank) ? a.bank : null
    case 'alternatives': return Array.isArray(a.alternatives) ? a.alternatives : null
    case 'liabilities':  return itemType === 'MORTGAGE' ? null : (Array.isArray(e.liabilities?.otherLoans) ? e.liabilities.otherLoans : null)
    case 'business':
      if (itemType === 'PSC_EQUITY') return Array.isArray(e.companies) ? e.companies : null
      if (['EMI', 'RSU', 'SAYE', 'CSOP', 'SIP'].includes(itemType)) return Array.isArray(e.share_schemes) ? e.share_schemes : null
      if (itemType === 'BPR_AIM') return Array.isArray(e.business_assets) ? e.business_assets : null
      return null
    case 'protection':
      if (itemType === 'HOME_INS' || itemType === 'MOTOR') return Array.isArray(e.general_insurance) ? e.general_insurance : null
      if (itemType === 'PII') return Array.isArray(e.business_insurance) ? e.business_insurance : null
      return null
    default: return null
  }
}

// Resolve an EDIT to an existing array item by stable identity (name, address,
// scheme_name, account_name, label, lender, description) when no explicit id
// was supplied. Fixture items key by name with no id; without this an edit
// would generate a fresh id and INSERT A DUPLICATE rather than update.
//
// On match with no id, stamp the item with a deterministic slug id so the
// downstream `findIndex(p => p.id === newId)` matches. Returns the resolved id,
// or null if no existing item matched.
export function resolveExistingId(e, category, itemType, matchKey) {
  if (!matchKey) return null
  const arr = _targetArrayFor(e, category, itemType)
  if (!Array.isArray(arr)) return null
  const item = arr.find(x =>
    [x.id, x.name, x.scheme_name, x.account_name, x.address, x.label, x.lender, x.description]
      .filter(Boolean)
      .includes(matchKey)
  )
  if (!item) return null
  if (!item.id) item.id = `${(itemType || 'item').toLowerCase()}-${_slug(matchKey)}`
  return item.id
}

// Apply a single-field correction with provenance + append to audit trail.
// Returns true if the field was set, false on a broken path (no-op).
export function applyFieldCorrection(e, payload) {
  if (!payload || !payload.path) return false
  const { path, value, source = 'manual', confidence, document, label } = payload

  const previousValue = _getByPath(e, path)
  const { ok, parent } = _setByPath(e, path, value)
  if (!ok) return false  // broken path — don't fabricate shape

  // Confidence defaults by source if not explicitly supplied.
  const conf = confidence != null
    ? confidence
    : (source === 'statement' ? 0.95 : source === 'estimate' ? 0.6 : 1.0)

  // Per-record provenance so the leaf can show "you corrected this".
  if (parent && typeof parent === 'object') {
    parent.provenance = {
      ...(parent.provenance || {}),
      source,
      confidence: conf,
      corrected_at: new Date().toISOString(),
      ...(document ? { document } : {}),
    }
  }

  // Append to the entity-level audit trail.
  if (!Array.isArray(e._corrections)) e._corrections = []
  e._corrections.push({
    path,
    label: label || path,
    previousValue,
    value,
    source,
    confidence: conf,
    corrected_at: new Date().toISOString(),
    ...(document ? { document: { name: document.name, size: document.size, mime: document.mime } } : {}),
  })
  return true
}
