// ─────────────────────────────────────────────────────────────────────────────
// DrillContextStub — Knowledge-hall layer-3 placeholder per drill panel.
//
// Per the founder's "drill panels are knowledge halls" principle:
// every L3 drill owes the user domain-native context beside the numbers —
// map / sector / claims / scheme-quality / etc.
//
// External API integrations (Land Registry, Companies House, Defaqto,
// MoneyFacts, Ofsted, sector ETF data, etc.) are a separate workstream. This
// component is the visible placeholder that:
//   1. Signals to the user what depth is coming
//   2. Routes "I want to know more about X" to Ask Sonu so the AI layer
//      bridges the gap until the integrations land
//   3. Stays info-only — no broker links, no commercial product surfacing
//
// Spec: knowledge-halls memo (feedback_drill_panels_knowledge_halls.md).
// ─────────────────────────────────────────────────────────────────────────────

export default function DrillContextStub({
  eyebrow,
  title,
  preview = null,        // optional ReactNode for the visual placeholder (e.g. map sketch)
  bullets = [],          // list of things that will live here
  askQuestion,           // routes to Ask Sonu with this query prefilled
  askRoute = '/ask',
}) {
  const askHref = `${askRoute}?q=${encodeURIComponent(askQuestion || title)}`
  return (
    <div className="sw-card" style={{
      marginTop: 12,
      padding: 14,
      background: 'var(--card-bg2)',
      border: '1px dashed var(--c-text3)',
      borderRadius: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
          letterSpacing: 0.6, textTransform: 'uppercase',
        }}>{eyebrow}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'var(--c-acc)',
          letterSpacing: 0.4, textTransform: 'uppercase',
          padding: '2px 7px', borderRadius: 100,
          background: 'color-mix(in srgb, var(--c-acc) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--c-acc) 28%, transparent)',
        }}>Coming next</span>
      </div>
      <div style={{
        fontSize: 14, fontWeight: 700, color: 'var(--c-text)',
        lineHeight: 1.35, marginBottom: preview ? 10 : 8,
      }}>{title}</div>

      {preview && (
        <div style={{ marginBottom: 10 }}>{preview}</div>
      )}

      {bullets.length > 0 && (
        <ul style={{
          margin: '0 0 12px 0', padding: 0, listStyle: 'none',
          display: 'grid', gap: 4,
        }}>
          {bullets.map((b, i) => (
            <li key={i} style={{
              fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.4,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span aria-hidden="true" style={{ color: 'var(--c-text3)' }}>·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {askQuestion && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('sonus:ask', {
            detail: { question: askQuestion || title, route: askRoute, href: askHref },
          }))}
          className="sw-press"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 999,
            background: 'transparent',
            border: '1px solid var(--c-acc)',
            color: 'var(--c-acc)',
            fontSize: 12, fontWeight: 700,
            textDecoration: 'none',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          <span aria-hidden="true">☉</span>
          Ask Sonu about this
        </button>
      )}
    </div>
  )
}

// ── Domain-specific stubs ────────────────────────────────────────────────────
// Small visual placeholders that signal what will fill each drill panel.

export function PropertyMapStub() {
  return (
    <div style={{
      height: 92, borderRadius: 10,
      background: `
        repeating-linear-gradient(0deg,   var(--c-text3) 0, var(--c-text3) 1px, transparent 1px, transparent 22px),
        repeating-linear-gradient(90deg,  var(--c-text3) 0, var(--c-text3) 1px, transparent 1px, transparent 22px),
        linear-gradient(135deg, color-mix(in srgb, var(--c-acc) 8%, var(--c-surface2)), var(--c-surface2))
      `,
      opacity: 0.55,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 14, height: 14, borderRadius: '50%',
        background: 'var(--c-acc)',
        boxShadow: '0 0 14px var(--c-acc), 0 0 0 6px color-mix(in srgb, var(--c-acc) 25%, transparent)',
      }} />
    </div>
  )
}

export function SectorMixStub() {
  // Six abstract sector bars — illustrative shape, no real data.
  const bars = [
    { label: 'Global equity', pct: 42, fg: 'var(--c-acc)' },
    { label: 'Gilts / bonds', pct: 22, fg: '#7AA7FF' },
    { label: 'Real estate',   pct: 14, fg: '#FFB347' },
    { label: 'Cash & MMF',    pct: 12, fg: '#34C759' },
    { label: 'Alternatives',  pct: 6,  fg: '#C58CFF' },
    { label: 'Crypto / PE',   pct: 4,  fg: '#FF598C' },
  ]
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {bars.map((s, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '110px 1fr 40px',
          gap: 10, alignItems: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--c-text2)' }}>{s.label}</div>
          <div style={{
            height: 6, background: 'var(--c-surface2)', borderRadius: 100,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${s.pct}%`, height: '100%',
              background: s.fg,
            }} />
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--c-text3)',
            textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          }}>{s.pct}%</div>
        </div>
      ))}
    </div>
  )
}

export function SchemeQualityStub() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 8,
    }}>
      {[
        { label: 'Annual charge', value: '0.45%', sub: 'Median for SIPP' },
        { label: 'Default fund', value: 'Lifestyle 80/20', sub: 'Glide path active' },
        { label: 'Defaqto rating', value: '★ ★ ★ ★', sub: '5-star = top decile' },
        { label: 'FSCS cover', value: '£85k', sub: 'Per scheme provider' },
      ].map(t => (
        <div key={t.label} style={{
          padding: 10, borderRadius: 10,
          border: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'var(--c-text3)',
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>{t.label}</div>
          <div style={{
            fontSize: 14, fontWeight: 800, color: 'var(--c-text)',
            marginTop: 4,
          }}>{t.value}</div>
          <div style={{
            fontSize: 10, color: 'var(--c-text3)', marginTop: 2,
          }}>{t.sub}</div>
        </div>
      ))}
    </div>
  )
}

export function BusinessActivityStub() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
    }}>
      {[
        { label: 'SIC code', value: '62012', sub: 'Computer programming' },
        { label: 'Filed accounts', value: 'Active · Y-1', sub: 'Companies House' },
        { label: 'Sector trend', value: '+8.2%', sub: '12-mo sector benchmark' },
        { label: 'Avg EV / EBITDA', value: '11.4×', sub: 'Sector multiple' },
      ].map(t => (
        <div key={t.label} style={{
          padding: 10, borderRadius: 10,
          border: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'var(--c-text3)',
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>{t.label}</div>
          <div style={{
            fontSize: 14, fontWeight: 800, color: 'var(--c-text)',
            marginTop: 4,
          }}>{t.value}</div>
          <div style={{
            fontSize: 10, color: 'var(--c-text3)', marginTop: 2,
          }}>{t.sub}</div>
        </div>
      ))}
    </div>
  )
}

export function ClaimsPaidStub() {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {[
        { provider: 'Aviva',        paid: 98.4, defaqto: 4 },
        { provider: 'Legal & Gen.', paid: 97.9, defaqto: 5 },
        { provider: 'Royal London', paid: 99.1, defaqto: 5 },
      ].map(c => (
        <div key={c.provider} style={{
          display: 'grid', gridTemplateColumns: '110px 1fr 70px',
          gap: 10, alignItems: 'center',
          padding: '6px 10px', borderRadius: 8,
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--c-text)' }}>{c.provider}</div>
          <div style={{
            height: 5, background: 'var(--c-surface2)', borderRadius: 100,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${c.paid}%`, height: '100%',
              background: 'var(--c-acc)',
            }} />
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--c-text2)',
            textAlign: 'right',
          }}>{c.paid}% paid</div>
        </div>
      ))}
    </div>
  )
}
