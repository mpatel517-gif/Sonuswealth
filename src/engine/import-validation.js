// ─────────────────────────────────────────────────────────────────────────────
// VALIDATED TAXONOMY MAPPING (VTM)  —  data-integrity gate for ALL imports
//
// Founder requirement (2026-06-13): "I don't want a number to go to a wrong bank
// account." No inbound value — manual, parsed document, spreadsheet, or bank
// feed — may be committed until it is:
//   1. a valid number,
//   2. bound to a KNOWN node in the canonical asset/liability taxonomy
//      (never a free-text guess that silently becomes the wrong thing), and
//   3. resolved against a SPECIFIC target holding (or explicitly marked "new"),
//      so a value is never blind-merged into the wrong existing account.
//
// Every capture channel calls mapAndValidate() (one row) or validateBatch()
// (a spreadsheet). The result carries flags at four levels:
//   error  → blocks commit (not numeric / no taxonomy match)
//   review → must be confirmed by the user before commit (low confidence,
//            ambiguous target, sign mismatch)
//   warn   → surfaced but non-blocking
//   ok     → safe to auto-accept
//
// This module is pure (no I/O, no events). The UI maps the flags to the FP-5
// accept / edit / reject controls; the commit path refuses any row whose
// `ok` is false or that still has an unresolved `review` flag.
// ─────────────────────────────────────────────────────────────────────────────

import { classifyAsset } from './asset-taxonomy.js'
import { classifyLiability } from './liability-taxonomy.js'

const DEFAULT_CONFIDENCE_FLOOR = 0.75

// Parse a money-ish cell ("£12,500", "12500", "1.2k") into a finite number or NaN.
export function parseMoney(raw) {
  if (typeof raw === 'number') return raw
  let s = String(raw ?? '').trim().toLowerCase().replace(/[£$€,\s]/g, '')
  if (!s) return NaN
  let mult = 1
  if (/k$/.test(s)) { mult = 1e3; s = s.slice(0, -1) }
  else if (/m$/.test(s)) { mult = 1e6; s = s.slice(0, -1) }
  const n = Number(s)
  return Number.isFinite(n) ? n * mult : NaN
}

// Confidence for a classifier hit: exact id/token match is high, substring is medium.
function scoreConfidence(node, rawType) {
  if (!node) return 0
  const r = String(rawType || '').toLowerCase().trim()
  const tokens = Array.isArray(node.match) ? node.match.map((t) => String(t).toLowerCase()) : []
  if (r && (r === String(node.id).toLowerCase() || tokens.includes(r))) return 0.95
  if (tokens.some((t) => r.includes(t) || t.includes(r))) return 0.78
  return 0.6
}

// Resolve which existing holding a row targets, so we never blind-merge.
// Returns { mode: 'new' | 'matched' | 'ambiguous', candidates: [...], chosen }.
function resolveTarget(node, row, entity) {
  if (!node) return { mode: 'new', candidates: [] }
  // Gather existing holdings the engine already knows, of the same node/category.
  const a = entity?.assets || {}
  const holdings = []
  const pushArr = (arr, src) => { if (Array.isArray(arr)) arr.forEach((h) => holdings.push({ ...h, _src: src })) }
  pushArr(a.property, 'property'); pushArr(a.investments, 'investments'); pushArr(a.pensions, 'pensions')
  pushArr(a.cash, 'cash'); pushArr(a.protection, 'protection'); pushArr(a.other, 'other')
  // Match on an explicit account/provider label if the row carried one.
  const wanted = String(row.account || row.provider || '').toLowerCase().trim()
  const sameType = holdings.filter((h) => {
    const ht = String(h.type || h.subType || h.wrapper || '').toLowerCase()
    return ht && (ht.includes(String(node.id).toLowerCase()) || String(node.id).toLowerCase().includes(ht))
  })
  if (wanted) {
    const exact = holdings.filter((h) => String(h.name || h.provider || h.label || '').toLowerCase().includes(wanted))
    if (exact.length === 1) return { mode: 'matched', candidates: exact, chosen: exact[0] }
    if (exact.length > 1) return { mode: 'ambiguous', candidates: exact }
  }
  if (sameType.length === 1) return { mode: 'matched', candidates: sameType, chosen: sameType[0] }
  if (sameType.length > 1) return { mode: 'ambiguous', candidates: sameType }
  return { mode: 'new', candidates: [] }
}

/**
 * Map + validate ONE inbound row.
 * row: { label, value, rawType?, account?/provider?, kind? ('asset'|'liability'|'auto'), date? }
 */
export function mapAndValidate(row = {}, entity = {}, opts = {}) {
  const floor = opts.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR
  const flags = []
  const rawType = String(row.rawType || row.label || '').trim()
  const value = parseMoney(row.value)

  // 1 — value validity
  if (!Number.isFinite(value)) {
    flags.push({ level: 'error', code: 'VALUE_NOT_NUMERIC', msg: `"${row.value}" isn't a number` })
  }

  // 2 — classify against the canonical taxonomy
  let node = null
  let kind = row.kind || 'auto'
  // STRICT liability classification — never accept the "Other loan" catch-all
  // for an import (that's how an ISA silently became a debt). No real match →
  // null → NO_TAXONOMY_MATCH → the user picks from the taxonomy.
  if (kind === 'liability') node = classifyLiability(rawType, { strict: true })
  else if (kind === 'asset') node = classifyAsset(rawType)
  else {
    const asAsset = classifyAsset(rawType)
    const asLiab = classifyLiability(rawType, { strict: true })
    if (asAsset && !asLiab) { node = asAsset; kind = 'asset' }
    else if (asLiab && !asAsset) { node = asLiab; kind = 'liability' }
    else if (asAsset && asLiab) {
      // Both matched — prefer the stronger, flag the collision for confirmation.
      node = scoreConfidence(asAsset, rawType) >= scoreConfidence(asLiab, rawType) ? asAsset : asLiab
      kind = node === asAsset ? 'asset' : 'liability'
      flags.push({ level: 'review', code: 'KIND_AMBIGUOUS', msg: `"${rawType}" could be an asset or a debt — confirm` })
    }
  }

  let confidence = 0
  if (!node) {
    flags.push({ level: 'error', code: 'NO_TAXONOMY_MATCH', msg: `Couldn't place "${rawType}" — choose a type` })
  } else {
    confidence = scoreConfidence(node, rawType)
    if (confidence < floor) {
      flags.push({ level: 'review', code: 'LOW_CONFIDENCE', msg: `Best guess: ${node.label} — confirm or change` })
    }
    // Sign sanity: a liability entered as a positive "asset" or vice-versa.
    if (Number.isFinite(value) && value < 0 && kind === 'asset') {
      flags.push({ level: 'review', code: 'SIGN_MISMATCH', msg: 'Negative value on an asset — is this a debt?' })
    }
  }

  // 3 — resolve target holding (never blind-merge into the wrong account)
  const target = resolveTarget(node, row, entity)
  if (target.mode === 'ambiguous') {
    flags.push({ level: 'review', code: 'TARGET_AMBIGUOUS', msg: `You have ${target.candidates.length} ${node?.label || 'matching'} holdings — pick which one` })
  }

  const hasError = flags.some((f) => f.level === 'error')
  const needsReview = flags.some((f) => f.level === 'review')
  return {
    raw: row,
    mapped: node ? { nodeId: node.id, label: node.label, category: node.category || node.class || null, kind } : null,
    value: Number.isFinite(value) ? value : null,
    confidence: +confidence.toFixed(2),
    target,
    flags,
    ok: !hasError && !!node,            // structurally valid (could still need review)
    autoAcceptable: !hasError && !needsReview && !!node && confidence >= floor,
  }
}

/**
 * Validate a whole spreadsheet's worth of rows. Returns per-row results plus a
 * batch summary the mapping-review UI uses to gate the "Commit all" button.
 */
export function validateBatch(rows = [], entity = {}, opts = {}) {
  const results = rows.map((r) => mapAndValidate(r, entity, opts))
  // Duplicate detection within the batch (same node + target + value).
  const seen = new Map()
  for (const res of results) {
    if (!res.mapped) continue
    const key = `${res.mapped.nodeId}|${res.target?.chosen?.name || res.target?.mode}|${res.value}`
    if (seen.has(key)) res.flags.push({ level: 'warn', code: 'DUPLICATE_IN_BATCH', msg: 'Looks like a duplicate of another row' })
    else seen.set(key, true)
  }
  return {
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.autoAcceptable).length,
      needsReview: results.filter((r) => r.ok && r.flags.some((f) => f.level === 'review')).length,
      blocked: results.filter((r) => !r.ok).length,
    },
    // The commit gate: every row must be ok AND have no unresolved review flag.
    committable: results.every((r) => r.ok && !r.flags.some((f) => f.level === 'review')),
  }
}
