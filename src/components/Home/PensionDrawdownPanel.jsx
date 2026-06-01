import { useMemo } from 'react'
import {
  ihtSippDelta, guardrail, fmt, planFor,
} from '../../engine/fq-calculator.js'

function safe(fn, fb) { try { return fn() ?? fb } catch { return fb } }

function daysUntil(dateStr) {
  return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / 86_400_000))
}

export default function PensionDrawdownPanel({ entity, onClose, onNav }) {
  const ihtExposure   = useMemo(() => safe(() => ihtSippDelta(entity), 0),       [entity])
  const annualRate    = useMemo(() => safe(() => guardrail(entity) * 0.6, 0),     [entity])
  const monthlyRate   = Math.round(annualRate / 12)
  const days          = daysUntil('2027-04-06')
  const plan          = useMemo(() => safe(() => planFor(entity, 'retirement'), null), [entity])
  const planMonthly   = plan?.target?.monthlyDrawdown || monthlyRate || 0
  const tfcStrategy   = plan?.target?.tfcStrategy || 'phased'
  const sippVal       = useMemo(() => {
    const a = entity?.assets || {}
    const num = v => {
      if (typeof v === 'number') return v
      if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
      return +v?.total || +v?.value || 0
    }
    return num(a.sipp) + num(a.pension) + num(a.pensions)
  }, [entity])

  const STEPS = [
    {
      n: 1,
      title: 'Confirm drawdown start',
      body: `Contact your SIPP provider to begin drawdown. You don't have to draw anything yet — crystallising the pot removes it from your estate before April 2027.`,
      cta: null,
    },
    {
      n: 2,
      title: `Draw ${fmt(planMonthly)}/month (${tfcStrategy === 'phased' ? 'phased TFC' : 'lump sum'})`,
      body: `This rate keeps you within your personal allowance and avoids higher-rate tax on drawdown income. Phased TFC means you take 25% tax-free cash progressively rather than all at once.`,
      cta: null,
    },
    {
      n: 3,
      title: 'Update beneficiary nominations',
      body: 'Your SIPP nominations tell the provider who inherits the pot. Crystallised funds need nominations updated. Do this with your provider and record it.',
      cta: { label: 'Review nominations in Tax & Estate →', route: 'tax' },
    },
    {
      n: 4,
      title: 'See your retirement trajectory',
      body: 'Once drawdown starts, your projected funded ratio and retirement income change. Check Timeline to see how your plan holds up.',
      cta: { label: 'Go to Timeline →', route: 'timeline' },
    },
  ]

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'nw-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        padding: '0 0 120px',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--c-sep)',
        position: 'sticky', top: 0,
        background: 'var(--c-bg)', zIndex: 10,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Start pension drawdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        <div style={{
          background: 'rgba(255,59,48,0.10)',
          border: '1px solid rgba(255,59,48,0.35)',
          borderRadius: 16, padding: '14px 18px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 28 }}>⚖️</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#ff3b30', marginBottom: 2 }}>
              SIPP IHT deadline
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.5 }}>
              {days} days · 6 April 2027
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 3 }}>
              Pensions enter the IHT estate from this date. Finance Act 2026 enacted.
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 16, padding: '14px 18px', marginBottom: 12,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4 }}>Your SIPP / pension value</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.5 }}>{fmt(sippVal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4 }}>IHT exposure if no drawdown</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ff3b30', letterSpacing: -0.5 }}>{ihtExposure > 0 ? fmt(ihtExposure) : 'None'}</div>
          </div>
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--c-sep)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4 }}>Your drawdown plan</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-acc)' }}>
              {fmt(planMonthly)}/month · {tfcStrategy === 'phased' ? 'Phased tax-free cash' : 'Lump-sum TFC'} strategy
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
              Keeps income within personal allowance · avoids higher-rate tax on drawdown
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 8 }}>
          What to do — 4 steps
        </div>

        {STEPS.map(step => (
          <div key={step.n} style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 10,
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <div style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
              background: 'var(--c-acc)', color: 'var(--c-on-accent, #0B1F3A)',
              fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {step.n}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 6, lineHeight: 1.3 }}>
                {step.title}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.55 }}>
                {step.body}
              </div>
              {step.cta && (
                <button
                  onClick={() => { onClose(); onNav?.(step.cta.route) }}
                  style={{
                    marginTop: 10, padding: '8px 16px', borderRadius: 999,
                    background: 'var(--c-acc)', border: 'none',
                    color: 'var(--c-on-accent, #0B1F3A)', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {step.cta.label}
                </button>
              )}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '8px 0 12px' }}>
          Information and guidance only · Figures from your data · Not personal advice · FCA boundary applies
        </div>
      </div>
    </div>
  )
}
