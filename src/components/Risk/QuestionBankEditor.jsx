// ─────────────────────────────────────────────────────────────────────────────
// QuestionBankEditor — admin-only authoring surface for the risk-perception
// question bank. Event-sourced (D-EVENTSTORE-1): Save fires a single
// `risk_question_bank_updated` event carrying the full new bank + a version.
// The reducer folds it onto entity.riskQuestionBank, so the live questionnaire
// renders the edited set and new answers stamp the new version.
//
// Gated by the caller (Risk.jsx ?admin=1). This is a rules-admin function, NOT
// an end-user one — users must not rewrite their own risk questions.
//
// Safe-edit posture: titles, sub-text and option labels are freely editable;
// the machine `value` of existing options is shown read-only (it's the scoring
// key — changing it would silently break the suggested-level mapping). New
// options get an auto-slugged value. The first three questions
// (attitude · horizon · reaction-to-a-fall) drive the suggested risk level, so
// the editor warns before they're retired.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'

// Default bank mirror — kept here so the editor can seed when the entity has no
// custom bank yet. Must match Risk.jsx PERCEPTION_QUESTIONS ids/values.
const DEFAULT_BANK = [
  { id: 'riskAppetite', title: 'What best describes your investment approach?', sub: 'Your psychological comfort with ups and downs in the value of your money.',
    options: [
      { value: 'cautious',   label: 'Cautious — I prioritise stability over returns' },
      { value: 'balanced',   label: 'Balanced — mix of growth and security' },
      { value: 'growth',     label: 'Growth — I accept volatility for higher long-term returns' },
      { value: 'aggressive', label: 'Aggressive — maximum growth, I can tolerate big swings' },
    ] },
  { id: 'timeHorizon', title: 'How long before you need to draw on this wealth?', sub: 'A longer horizon typically supports a higher risk tolerance.',
    options: [
      { value: 'under5',  label: 'Under 5 years' },
      { value: '5to10',   label: '5–10 years' },
      { value: '10to20',  label: '10–20 years' },
      { value: 'over20',  label: '20+ years' },
    ] },
  { id: 'lossReaction', title: 'If your portfolio fell 20% in a year, what would you do?', sub: 'Honest answer — this tests capacity for loss, not just stated preference.',
    options: [
      { value: 'sell',   label: 'Sell — reduce exposure immediately' },
      { value: 'hold',   label: 'Hold — wait for recovery' },
      { value: 'buy',    label: 'Buy more — take advantage of the dip' },
      { value: 'unsure', label: 'Unsure — would need to review' },
    ] },
]
const CORE_IDS = ['riskAppetite', 'timeHorizon', 'lossReaction']

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'opt'
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
  color: 'var(--c-text)', fontSize: 13, fontFamily: 'inherit',
}
const ghostBtn = {
  background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 100,
  padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--c-text2)',
  cursor: 'pointer', fontFamily: 'inherit',
}

export default function QuestionBankEditor({ entity, onClose, onCommit }) {
  const seed = (Array.isArray(entity?.riskQuestionBank) && entity.riskQuestionBank.length)
    ? entity.riskQuestionBank
    : DEFAULT_BANK
  const [bank, setBank] = useState(() => JSON.parse(JSON.stringify(seed)))

  // Esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const patchQ = (qi, patch) => setBank(b => b.map((q, i) => i === qi ? { ...q, ...patch } : q))
  const patchOpt = (qi, oi, patch) => setBank(b => b.map((q, i) => {
    if (i !== qi) return q
    return { ...q, options: q.options.map((o, j) => j === oi ? { ...o, ...patch } : o) }
  }))
  const addOpt = (qi) => setBank(b => b.map((q, i) => i === qi
    ? { ...q, options: [...q.options, { value: `opt_${q.options.length + 1}`, label: '', _new: true }] } : q))
  const removeOpt = (qi, oi) => setBank(b => b.map((q, i) => i === qi
    ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q))
  const removeQ = (qi) => setBank(b => b.filter((_, i) => i !== qi))
  const addQ = () => setBank(b => [...b, { id: `q_${b.length + 1}_${slug(String(b.length))}`, title: '', sub: '', options: [{ value: 'opt_1', label: '', _new: true }, { value: 'opt_2', label: '', _new: true }] }])

  // Normalise (slug new option values from labels) + validate before save.
  function buildClean() {
    return bank
      .map(q => ({
        id: q.id || `q_${slug(q.title)}`,
        title: (q.title || '').trim(),
        sub: (q.sub || '').trim(),
        options: q.options
          .map(o => ({ value: o._new ? slug(o.label) : o.value, label: (o.label || '').trim() }))
          .filter(o => o.label),
      }))
      .filter(q => q.title && q.options.length >= 2)
  }
  const clean = buildClean()
  const valid = clean.length >= 1
  const droppedCore = CORE_IDS.filter(id => !clean.some(q => q.id === id))

  function save() {
    if (!valid) return
    onCommit?.({
      type: 'risk_question_bank_updated',
      ts: Date.now(),
      payload: { questions: clean, version: `edited-${Date.now()}` },
    })
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 420, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, background: 'var(--c-surface)',
        borderRadius: '20px 20px 0 0', padding: '18px 18px 28px',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div className="sw-eyebrow">Admin · Risk question bank</div>
          <button onClick={onClose} aria-label="Close editor" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text3)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginBottom: 14 }}>
          Edits are saved as a versioned event — existing answers keep the version they were given under.
          The first three questions drive the suggested risk level.
        </div>

        {bank.map((q, qi) => {
          const isCore = CORE_IDS.includes(q.id)
          return (
            <div key={q.id || qi} style={{
              border: '1px solid var(--c-sep)', borderRadius: 12, padding: 12, marginBottom: 12,
              background: 'var(--c-surface)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: isCore ? 'var(--c-acc)' : 'var(--c-text3)' }}>
                  Q{qi + 1}{isCore ? ' · scoring' : ''}
                </span>
                <button onClick={() => removeQ(qi)} style={{ ...ghostBtn, padding: '4px 10px', color: 'var(--c-danger)' }}>Retire</button>
              </div>
              <input style={{ ...inputStyle, fontWeight: 700, marginBottom: 6 }} placeholder="Question title"
                value={q.title} onChange={e => patchQ(qi, { title: e.target.value })} />
              <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Sub-text / explainer"
                value={q.sub} onChange={e => patchQ(qi, { sub: e.target.value })} />
              {q.options.map((o, oi) => (
                <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="Option label"
                    value={o.label} onChange={e => patchOpt(qi, oi, { label: e.target.value })} />
                  {!o._new && (
                    <span title="Scoring key (locked)" style={{
                      fontSize: 9, color: 'var(--c-text3)', background: 'var(--c-surface2)',
                      border: '1px solid var(--c-sep)', borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap',
                    }}>{o.value}</span>
                  )}
                  <button onClick={() => removeOpt(qi, oi)} aria-label="Remove option"
                    style={{ ...ghostBtn, padding: '4px 9px' }}>−</button>
                </div>
              ))}
              <button onClick={() => addOpt(qi)} style={{ ...ghostBtn, marginTop: 2 }}>+ Add option</button>
            </div>
          )
        })}

        <button onClick={addQ} style={{ ...ghostBtn, width: '100%', marginBottom: 12 }}>+ Add question</button>

        {droppedCore.length > 0 && (
          <div style={{
            fontSize: 11, color: 'var(--c-warning)', lineHeight: 1.5, marginBottom: 12,
            background: 'rgba(255,179,71,0.08)', border: '1px solid rgba(255,179,71,0.28)',
            borderRadius: 8, padding: '8px 10px',
          }}>
            Heads up: you've removed a scoring question ({droppedCore.join(', ')}). The suggested risk
            level will show less until it's restored.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...ghostBtn, flex: 1, padding: '11px 0', textAlign: 'center' }}>Cancel</button>
          <button onClick={save} disabled={!valid} style={{
            flex: 2, padding: '11px 0', borderRadius: 100, border: 'none',
            background: 'var(--c-acc)', color: 'var(--c-bg)', fontSize: 13, fontWeight: 800,
            cursor: valid ? 'pointer' : 'not-allowed', opacity: valid ? 1 : 0.5, fontFamily: 'inherit',
          }}>
            Save question bank ({clean.length})
          </button>
        </div>
      </div>
    </div>
  )
}
