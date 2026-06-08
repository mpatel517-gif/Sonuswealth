// ─────────────────────────────────────────────────────────────────────────────
// InheritanceStory — §13.9 magic
//
// Replaces the IHT waterfall as the *primary* lead of the Estate sub-tab.
// Estate planning is emotionally hard; narrative beats charts at first contact.
// Waterfall still available on drill — this is the "what happens, in order"
// human story.
//
// Reads existing engine ihtWaterfall output and renders 5-7 plain-English
// lines. Each line drillable into the technical detail (Wave 2).
// ─────────────────────────────────────────────────────────────────────────────

import { ihtWaterfall, te_ihtExposure, fmt } from '../../engine/fq-calculator.js'

function safe(fn, fallback) { try { return fn() } catch { return fallback } }

export default function InheritanceStory({ entity, onDrillMetric }) {
  // F-MATH-01/02: read the IHT-relevant gross estate directly from the engine
  // so InheritanceStory headline and IHTDualNumber agree on a single number.
  // Previously used netWorth() which diverged from te_ihtExposure() and produced
  // contradictory copy ("£727k estate · no IHT due").
  const exposure  = safe(() => te_ihtExposure(entity), null)
  const waterfall = safe(() => ihtWaterfall(entity, {}), null)

  const gross         = exposure?.gross_estate || 0
  const deductions    = exposure?.deductions || { debts: 0, funeral: 0 }
  const ihtDue        = exposure?.iht_due ?? waterfall?.iht_due ?? 0
  // beneficiary_value is the truth-of-record for "family receives" (Batch 1).
  const beneficiary   = exposure?.beneficiary_value ?? 0
  const rnrbUsed      = waterfall?.rnrb_used || exposure?.rnrb?.used || 0
  const nrbUsed       = waterfall?.nrb_used  || exposure?.nrb?.used  || 0
  const spouseExempt  = waterfall?.spouse_exempt || 0
  const charity       = waterfall?.charity_gifts || 0
  const taxable       = waterfall?.taxable_estate ?? exposure?.taxable_estate ?? 0
  const beneficiaries = entity?.beneficiaries || entity?.estate?.beneficiaries || []
  const totalDeductions = (deductions.debts || 0) + (deductions.funeral || 0)

  const lines = []

  // Line 1 — gross IHT-relevant estate (engine-derived, not netWorth)
  lines.push({
    icon: '◈',
    text: `If you died today, the estate counted for Inheritance Tax (IHT) is worth ${fmt(gross)}.`,
  })

  // Line 1b — deductions (F-CAT-05): make the mortgage/funeral/debts visible
  if (totalDeductions > 0) {
    const parts = []
    if ((deductions.debts || 0) > 0)   parts.push(`${fmt(deductions.debts)} debts (mortgage, loans)`)
    if ((deductions.funeral || 0) > 0) parts.push(`${fmt(deductions.funeral)} funeral`)
    lines.push({
      icon: '−',
      text: `Less deductions: ${parts.join(' + ')}.`,
    })
  }

  // Line 2 — spouse exemption if applicable
  if (spouseExempt > 0) {
    lines.push({
      icon: '◇',
      text: `${fmt(spouseExempt)} passes to your spouse — no inheritance tax due (spouse exemption).`,
    })
  }

  // Line 3 — allowances
  if (nrbUsed > 0 || rnrbUsed > 0) {
    const allowances = (nrbUsed > 0 ? `${fmt(nrbUsed)} tax-free band` : '') +
      (nrbUsed > 0 && rnrbUsed > 0 ? ' + ' : '') +
      (rnrbUsed > 0 ? `${fmt(rnrbUsed)} residence allowance` : '')
    lines.push({
      icon: '◆',
      text: `Your allowances cover ${allowances}. That portion passes tax-free.`,
    })
  }

  // Line 4 — charity rate
  if (charity > 0) {
    lines.push({
      icon: '✦',
      text: `${fmt(charity)} to charity — qualifies the remainder for the 36% reduced rate.`,
    })
  }

  // Line 5 — taxable + IHT due
  if (taxable > 0) {
    lines.push({
      icon: '⚖',
      text: `${fmt(taxable)} remains taxable. Inheritance tax due: ${fmt(ihtDue)}.`,
      severity: 'warn',
    })
  } else {
    lines.push({
      icon: '✓',
      text: `Your £325k tax-free band covers everything. No inheritance tax due today.`,
      severity: 'ok',
    })
  }

  // Line 5b — beneficiary headline (F-MATH-03 agreement with IHTDualNumber)
  if (beneficiary > 0) {
    lines.push({
      icon: '◑',
      text: `Family receives approximately ${fmt(beneficiary)} after IHT and deductions.`,
      severity: 'ok',
    })
  }

  // Line 6 — probate timing
  lines.push({
    icon: '◷',
    text: `Probate typically takes 6–9 months for estates around this size. Beneficiaries can't access most assets until probate completes.`,
  })

  // Line 7 — beneficiaries flow
  if (beneficiaries.length > 0) {
    lines.push({
      icon: '◐',
      text: `Distributed across ${beneficiaries.length} beneficiar${beneficiaries.length === 1 ? 'y' : 'ies'} — tap to see the breakdown per person.`,
      cta: 'beneficiaries',
    })
  }

  return (
    <div
      className="sw-tile sw-tile-hero sw-fade-in"
      style={{
        marginBottom: 14,
        background:
          'linear-gradient(155deg, rgba(255,255,255,.04), transparent 40%), var(--card-bg)',
      }}
    >
      <div className="sw-eyebrow" style={{ marginBottom: 4 }}>If you died today</div>
      <div style={{
        fontSize: 14, fontWeight: 700, color: 'var(--c-text)',
        lineHeight: 1.4, marginBottom: 14,
      }}>
        Here's what happens to your estate — in plain English.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lines.map((l, i) => (
          <button
            key={i}
            onClick={() => l.cta && onDrillMetric?.(l.cta)}
            className="sw-press"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 0', background: 'transparent', border: 'none',
              borderTop: i > 0 ? '1px solid var(--c-border)' : 'none',
              cursor: l.cta ? 'pointer' : 'default',
              textAlign: 'left',
              color: l.severity === 'warn' ? 'var(--c-coral)' :
                     l.severity === 'ok'   ? 'var(--c-acc)' :
                                             'var(--c-text2)',
              width: '100%',
            }}
          >
            <span style={{
              fontSize: 14, flexShrink: 0, lineHeight: 1.4,
              color: l.severity === 'warn' ? 'var(--c-coral)' :
                     l.severity === 'ok'   ? 'var(--c-acc)' :
                                             'var(--c-acc)',
            }}>{l.icon}</span>
            <span style={{
              flex: 1, fontSize: 13, lineHeight: 1.55,
              color: l.severity ? 'inherit' : 'var(--c-text2)',
            }}>
              {l.text}
            </span>
            {l.cta && (
              <span style={{ color: 'var(--c-text3)', fontSize: 13, flexShrink: 0 }}>›</span>
            )}
          </button>
        ))}
      </div>

      <div style={{
        marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--c-border)',
        fontSize: 11, color: 'var(--c-text3)', fontStyle: 'italic',
      }}>
        Tap a highlighted line for the breakdown behind it. The cards below show
        the full Inheritance Tax (IHT) waterfall and the 7-year gift clock.
      </div>
    </div>
  )
}
