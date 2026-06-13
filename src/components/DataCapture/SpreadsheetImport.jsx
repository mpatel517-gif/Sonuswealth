// ─────────────────────────────────────────────────────────────────────────────
// SpreadsheetImport — the visible surface of the VTM (validated taxonomy mapping)
// data-integrity gate. Founder requirement (2026-06-13): "When someone loads data
// from a spreadsheet you should be able to place that data against a taxonomy" and
// "I don't want a number to go to a wrong bank account."
//
// Flow: paste/upload CSV → parse rows → validateBatch() classifies every row
// against the canonical asset/liability taxonomy → a review grid where each row
// shows its mapped type, value, target holding, confidence, and any flags. The
// user confirms / re-maps / rejects per row. NOTHING commits until every kept row
// resolves to a real taxonomy node + value + target (committable === true).
//
// Dependency-free: CSV only (no xlsx lib shipped). xlsx export-to-CSV is the
// honest ask of the user for now — flagged in the empty-state copy.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { validateBatch, parseMoney } from '../../engine/import-validation.js'
import { ASSET_TYPES, ASSET_CATEGORIES } from '../../engine/asset-taxonomy.js'
import { LIABILITY_TYPES } from '../../engine/liability-taxonomy.js'

// ── CSV parse (RFC-ish: quoted fields, embedded commas/newlines) ─────────────
function parseCSV(text) {
  const rows = []
  let row = [], cell = '', inQ = false
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else inQ = false }
      else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => String(c).trim() !== ''))
}

const HEADER_HINTS = {
  type: ['type', 'name', 'description', 'item', 'holding', 'account', 'what'],
  value: ['value', 'amount', 'balance', 'worth', 'outstanding', '£', 'gbp'],
  account: ['account', 'provider', 'bank', 'lender', 'institution', 'where'],
}
// Map parsed CSV rows → { label, rawType, value, account } for validateBatch.
function rowsToRecords(grid) {
  if (!grid.length) return []
  const first = grid[0].map(c => String(c).trim().toLowerCase())
  const looksHeader = first.some(c => Object.values(HEADER_HINTS).flat().some(h => c.includes(h)))
    && !first.some(c => Number.isFinite(parseMoney(c)) && c !== '')
  let idxType = 0, idxValue = 1, idxAccount = -1, body = grid
  if (looksHeader) {
    const find = (keys) => first.findIndex(c => keys.some(k => c.includes(k)))
    idxType = Math.max(0, find(HEADER_HINTS.type))
    const v = find(HEADER_HINTS.value); idxValue = v >= 0 ? v : 1
    idxAccount = find(HEADER_HINTS.account)
    if (idxAccount === idxType) idxAccount = -1
    body = grid.slice(1)
  }
  return body.map(cells => ({
    label: String(cells[idxType] ?? '').trim(),
    rawType: String(cells[idxType] ?? '').trim(),
    value: cells[idxValue],
    account: idxAccount >= 0 ? String(cells[idxAccount] ?? '').trim() : '',
  })).filter(r => r.label || r.value)
}

const SAMPLE = `type,value,account
Aviva SIPP,124500,Aviva
Stocks & Shares ISA,38200,Vanguard
Current account,4150,Barclays
Residential mortgage,212000,Halifax
Credit card,3400,Amex`

const FLAG_TONE = { error: 'sw-chip-coral', review: 'sw-chip-amber', warn: 'sw-chip-amber' }

export default function SpreadsheetImport({ entity, onCommit, onClose }) {
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState(null) // resolved working set | null before validate

  // Taxonomy options, grouped for the <select>. Assets by category, then debts.
  const options = useMemo(() => {
    const assets = ASSET_CATEGORIES.map(cat => ({
      group: cat[0].toUpperCase() + cat.slice(1),
      items: ASSET_TYPES.filter(t => t.category === cat).map(t => ({ id: t.id, label: t.label, kind: 'asset', category: cat })),
    })).filter(g => g.items.length)
    const debts = [{
      group: 'Debts & liabilities',
      items: LIABILITY_TYPES.map(t => ({ id: t.id, label: t.label, kind: 'liability', category: 'liabilities' })),
    }]
    return [...assets, ...debts]
  }, [])
  const optById = useMemo(() => {
    const m = {}
    options.forEach(g => g.items.forEach(it => { m[it.id] = it }))
    return m
  }, [options])

  function runValidate(text) {
    const records = rowsToRecords(parseCSV(text))
    if (!records.length) { setRows([]); return }
    const { results } = validateBatch(records, entity)
    setRows(results.map((r, i) => ({
      key: i,
      raw: records[i],
      nodeId: r.mapped?.nodeId || '',
      kind: r.mapped?.kind || 'asset',
      category: r.mapped?.category || optById[r.mapped?.nodeId]?.category || null,
      value: Number.isFinite(r.value) ? r.value : (parseMoney(records[i].value) || ''),
      confidence: r.confidence,
      targetMode: r.target?.mode || 'new',
      targetCandidates: r.target?.candidates || [],
      // ambiguous → force an explicit pick (empty); else default to a new holding.
      targetId: r.target?.mode === 'ambiguous' ? '' : 'new',
      flags: r.flags || [],
      confirmed: false, // explicit ack for review-level flags (no blind Save)
      decision: 'accept',
    })))
  }

  function patch(key, next) {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r
      const merged = { ...r, ...next }
      // Re-pick category/kind when the taxonomy node changes.
      if (next.nodeId !== undefined) {
        const opt = optById[next.nodeId]
        merged.kind = opt?.kind || r.kind
        merged.category = opt?.category || r.category
        // A user-chosen node clears the "no match" / "low confidence" blockers.
        merged.flags = r.flags.filter(f => f.code !== 'NO_TAXONOMY_MATCH' && f.code !== 'LOW_CONFIDENCE' && f.code !== 'KIND_AMBIGUOUS')
      }
      return merged
    }))
  }

  const hasReviewFlag = (r) => r.flags.some(f => f.level === 'review')
  function isResolved(r) {
    if (r.decision === 'reject') return true
    const hasNode = !!r.nodeId
    const hasValue = Number.isFinite(Number(r.value)) && Number(r.value) !== 0
    const targetOk = r.targetMode !== 'ambiguous' || (r.targetId && r.targetId !== '')
    // A review-level flag (ambiguous kind, low confidence, sign mismatch) must be
    // explicitly confirmed — never slip through on a blind Save.
    const reviewOk = !hasReviewFlag(r) || r.confirmed
    return hasNode && hasValue && targetOk && reviewOk
  }

  const ready = rows ? rows.filter(r => r.decision === 'accept' && isResolved(r)) : []
  const unresolved = rows ? rows.filter(r => r.decision === 'accept' && !isResolved(r)) : []
  const committable = ready.length > 0 && unresolved.length === 0

  function buildPayload(r) {
    const value = Number(r.value) || 0
    const label = r.raw.account || r.raw.label || ''
    const base = { source: 'spreadsheet', confidence: r.confidence ?? 0.9, label }
    // Update-in-place when a single existing holding was matched/chosen.
    if (r.targetId && r.targetId !== 'new') base.id = r.targetId
    if (r.kind === 'liability') {
      return { ...base, category: 'liabilities', itemType: r.nodeId, fields: { outstanding: value, lender: label } }
    }
    const cat = r.category
    const fields = {}
    if (cat === 'cash') { fields.balance = value; fields.bank = label }
    else if (cat === 'property') { fields.value = value; fields.address = label }
    else if (cat === 'business') { fields.estimatedValue = value; fields.companyName = label }
    else if (cat === 'protection') { fields.coverAmount = value; fields.provider = label }
    else { fields.value = value; fields.provider = label } // pensions / investments / alternatives
    return { ...base, category: cat, itemType: r.nodeId, fields }
  }

  function commit() {
    if (!committable) return
    onCommit(ready.map(buildPayload))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--c-text3)' }
  return (
    <div className="screen" style={{ padding: '16px 16px 140px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={onClose} className="sw-press" style={{
          padding: '4px 10px', borderRadius: 8, background: 'var(--c-surface2)',
          border: '1px solid var(--c-border)', color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer',
        }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div className="sw-eyebrow">Import a spreadsheet</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', marginTop: 2 }}>
            Map your rows to the right place
          </div>
        </div>
      </div>

      {rows == null && (
        <>
          <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
            Paste rows from a spreadsheet (or upload a .csv). Each row should have a{' '}
            <strong>type/name</strong>, a <strong>value</strong>, and optionally the{' '}
            <strong>account or provider</strong>. We place every row against your taxonomy
            and let you confirm before anything is saved — so a figure never lands in the wrong account.
          </div>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={'type, value, account\nAviva SIPP, 124500, Aviva\nCredit card, 3400, Amex'}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 150, padding: 12, borderRadius: 10,
              border: '1px solid var(--c-border)', background: 'var(--c-surface2)',
              color: 'var(--c-text)', fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              resize: 'vertical', lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button onClick={() => runValidate(raw)} disabled={!raw.trim()} className="sw-press" style={{
              padding: '10px 18px', borderRadius: 10, border: 'none', cursor: raw.trim() ? 'pointer' : 'not-allowed',
              background: raw.trim() ? 'var(--c-text)' : 'var(--c-surface3)', color: raw.trim() ? 'var(--c-surface)' : 'var(--c-text3)',
              fontSize: 14, fontWeight: 700,
            }}>Check &amp; map {raw.trim() ? `${parseCSV(raw).length} rows` : ''}</button>
            <label className="sw-press" style={{
              padding: '10px 18px', borderRadius: 10, border: '1px solid var(--c-border)',
              background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              Upload .csv
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(t => { setRaw(t); runValidate(t) }) }} />
            </label>
            <button onClick={() => { setRaw(SAMPLE); runValidate(SAMPLE) }} className="sw-press" style={{
              padding: '10px 18px', borderRadius: 10, border: '1px dashed var(--c-border)',
              background: 'transparent', color: 'var(--c-text2)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Try a sample</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 12, lineHeight: 1.5 }}>
            Excel / Numbers: use File → Export → CSV first. Bank-feed import (no spreadsheet) is Phase 2.
          </div>
        </>
      )}

      {rows != null && rows.length === 0 && (
        <div className="sw-tile" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>No rows found</div>
          <div style={{ fontSize: 13, color: 'var(--c-text2)', marginTop: 6 }}>
            Couldn't read any rows from that. Check it has a type and a value per line.
          </div>
          <button onClick={() => setRows(null)} className="sw-press" style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--c-border)',
            background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer',
          }}>← Try again</button>
        </div>
      )}

      {rows != null && rows.length > 0 && (
        <>
          {/* Summary strip */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <span className="sw-chip sw-chip-mint" style={{ fontSize: 12 }}>{ready.length} ready</span>
            {unresolved.length > 0 && <span className="sw-chip sw-chip-amber" style={{ fontSize: 12 }}>{unresolved.length} need a choice</span>}
            {rows.some(r => r.decision === 'reject') && <span className="sw-chip" style={{ fontSize: 12 }}>{rows.filter(r => r.decision === 'reject').length} skipped</span>}
            <button onClick={() => setRows(null)} style={{
              marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--c-text3)',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
            }}>Start over</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(r => {
              const skipped = r.decision === 'reject'
              const resolved = isResolved(r)
              return (
                <div key={r.key} className="sw-tile" style={{
                  opacity: skipped ? 0.5 : 1,
                  border: !skipped && !resolved ? '1px solid var(--c-acc2, #E0A23C)' : '1px solid var(--c-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      “{r.raw.label || '(no label)'}”
                    </div>
                    <button onClick={() => patch(r.key, { decision: skipped ? 'accept' : 'reject' })} style={{
                      background: 'none', border: 'none', color: 'var(--c-text3)', fontSize: 12, cursor: 'pointer',
                      textDecoration: 'underline', flexShrink: 0,
                    }}>{skipped ? 'Include' : 'Skip'}</button>
                  </div>

                  {!skipped && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                      <div>
                        <div style={lbl}>Map to</div>
                        <select value={r.nodeId} onChange={e => patch(r.key, { nodeId: e.target.value })} style={{
                          width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8,
                          border: `1px solid ${r.nodeId ? 'var(--c-border)' : 'var(--c-acc2, #E0A23C)'}`,
                          background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 14,
                        }}>
                          <option value="">— pick a type —</option>
                          {options.map(g => (
                            <optgroup key={g.group} label={g.group}>
                              {g.items.map(it => <option key={it.id} value={it.id}>{it.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={lbl}>Value (£)</div>
                          <input type="number" value={r.value} onChange={e => patch(r.key, { value: e.target.value })} style={{
                            width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8,
                            border: '1px solid var(--c-border)', background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 14,
                          }} />
                        </div>
                        {r.targetCandidates.length > 0 && (
                          <div style={{ flex: 1 }}>
                            <div style={lbl}>Which holding</div>
                            <select value={r.targetId} onChange={e => patch(r.key, { targetId: e.target.value })} style={{
                              width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8,
                              border: `1px solid ${r.targetId ? 'var(--c-border)' : 'var(--c-acc2, #E0A23C)'}`,
                              background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 14,
                            }}>
                              <option value="">— choose —</option>
                              <option value="new">+ Create new holding</option>
                              {r.targetCandidates.map((c, i) => (
                                <option key={i} value={c.id || c.name || i}>{c.name || c.provider || c.label || c.bank || `Existing ${i + 1}`}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={`sw-chip ${r.confidence >= 0.85 ? 'sw-chip-mint' : r.confidence >= 0.7 ? 'sw-chip-amber' : ''}`} style={{ fontSize: 11 }}>
                          {Math.round((r.confidence || 0) * 100)}% match
                        </span>
                        {r.flags.map((f, i) => (
                          <span key={i} className={`sw-chip ${FLAG_TONE[f.level] || ''}`} style={{ fontSize: 11 }}>{f.msg}</span>
                        ))}
                        {hasReviewFlag(r) && !r.confirmed && (
                          <button onClick={() => patch(r.key, { confirmed: true })} className="sw-press" style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
                            border: '1px solid var(--c-acc2, #E0A23C)', background: 'transparent',
                            color: 'var(--c-text)', cursor: 'pointer',
                          }}>Looks right ✓</button>
                        )}
                        {hasReviewFlag(r) && r.confirmed && (
                          <span className="sw-chip sw-chip-mint" style={{ fontSize: 11 }}>Confirmed ✓</span>
                        )}
                        {!resolved && !r.flags.length && (
                          <span className="sw-chip sw-chip-amber" style={{ fontSize: 11 }}>Pick a type to continue</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Commit bar */}
          <div style={{ marginTop: 18 }}>
            <button onClick={commit} disabled={!committable} className="sw-press" style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              cursor: committable ? 'pointer' : 'not-allowed',
              background: committable ? 'var(--c-mint-strong, #1F9D6B)' : 'var(--c-surface3)',
              color: committable ? '#fff' : 'var(--c-text3)', fontSize: 15, fontWeight: 800,
            }}>
              {committable ? `Save ${ready.length} item${ready.length === 1 ? '' : 's'}` : `Resolve ${unresolved.length} row${unresolved.length === 1 ? '' : 's'} to continue`}
            </button>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
              Nothing is saved until you press Save. Each value is mapped to a taxonomy type and a specific
              holding — this is information capture, not advice.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
