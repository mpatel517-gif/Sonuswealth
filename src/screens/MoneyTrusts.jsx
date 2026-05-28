// ─────────────────────────────────────────────────────────────────────────────
// MoneyTrusts.jsx — Route 4.5 full surface (P12-4, 2026-05-28)
//
// Route: /money/trusts. Reached from MyMoney section-nav "Trusts" chip and
// any deep-link to the dedicated estate page (route-9 §5 v0.2 — NO LONGER
// `/tax#estate`).
//
// Sections (top → bottom):
//   1. Header chrome — back, page title, tax-year chip
//   2. EstateVault hero — visual map of will/LPA/trusts/nominations status
//   3. Will panel — current/draft/notStarted + last review + executors
//   4. LPA panels — health + finance (uses canonical lpaStatus reader for
//        shape-agnostic probing; surfaces staleFlag for >10yr old docs)
//   5. Beneficiary nominations — pension + ISA + life-policy summaries
//   6. Trusts list — discretionary / interest-in-possession / bare
//   7. IHT cross-link — info card to /tax for the projection
//   8. Statutory disclaimer (verbatim §8)
//
// FCA boundary — information / guidance / storage only. NO advice verbs.
// All numeric copy reads from engine selectors or persona fields; no magic.
// ─────────────────────────────────────────────────────────────────────────────
import { EstateVault } from '../components/charts/index.js'
import { lpaStatus } from '../engine/selectors/index.js'
import { ihtDynamic, fmt } from '../engine/fq-calculator.js'
import FinancesHeroCard from '../components/MyMoney/FinancesHeroCard.jsx'
import useTaxYear from '../hooks/useTaxYear.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL = {
  current:     'In place',
  registered:  'Registered',
  inProgress:  'Draft',
  signed:      'Signed',
  notStarted:  'Not started',
  unknown:     'Unknown',
}
const STATUS_COLOUR = {
  current:     'var(--c-mint-text)',
  registered:  'var(--c-mint-text)',
  inProgress:  'var(--c-amber-text)',
  signed:      'var(--c-amber-text)',
  notStarted:  'var(--c-text3)',
  unknown:     'var(--c-text3)',
}
const STATUS_CHIP_BG = {
  current:     'var(--c-tint-mint)',
  registered:  'var(--c-tint-mint)',
  inProgress:  'var(--c-tint-amber)',
  signed:      'var(--c-tint-amber)',
  notStarted:  'var(--c-tint-neutral)',
  unknown:     'var(--c-tint-neutral)',
}

function StatusChip({ status }) {
  const label  = STATUS_LABEL[status]  || STATUS_LABEL.unknown
  const colour = STATUS_COLOUR[status] || STATUS_COLOUR.unknown
  const bg     = STATUS_CHIP_BG[status] || STATUS_CHIP_BG.unknown
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
      padding: '3px 8px', borderRadius: 100,
      background: bg, color: colour,
      textTransform: 'uppercase',
    }}>{label}</span>
  )
}

function _formatDate(d) {
  if (!d) return null
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return null }
}

function Card({ eyebrow, title, status, children, footerNote }) {
  return (
    <div className="sw-card sw-card-elevated" style={{
      padding: '14px 16px', marginBottom: 14,
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          {eyebrow && <div className="sw-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', letterSpacing: -0.2 }}>{title}</div>
        </div>
        {status && <StatusChip status={status} />}
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>
        {children}
      </div>
      {footerNote && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-sep)',
          fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5,
        }}>
          {footerNote}
        </div>
      )}
    </div>
  )
}

// ── Section components ──────────────────────────────────────────────────────

function WillSection({ entity }) {
  const will = entity?.estate?.will || {}
  const status = will.status || 'notStarted'
  const lastReview = _formatDate(will.lastReviewedDate || will.signedDate || will.date)
  const executors = Array.isArray(will.executors) ? will.executors : []
  return (
    <Card eyebrow="Document 1 of 4" title="Will" status={status}>
      {status === 'notStarted' ? (
        <div>
          You have no Will recorded. A Will directs how your estate is
          distributed and names guardians for dependants. Without one, intestacy
          rules decide — which may not match your wishes, particularly for
          unmarried partners and step-families.
        </div>
      ) : (
        <div>
          {lastReview && <div>Last reviewed: <strong style={{ color: 'var(--c-text)' }}>{lastReview}</strong></div>}
          {executors.length > 0 && (
            <div style={{ marginTop: 6 }}>
              Executors: <strong style={{ color: 'var(--c-text)' }}>{executors.map(e => e?.name || e).join(', ')}</strong>
            </div>
          )}
          {will.notes && <div style={{ marginTop: 6, fontStyle: 'italic' }}>{will.notes}</div>}
        </div>
      )}
    </Card>
  )
}

function LpaPanel({ kind, lpaData }) {
  const label = kind === 'health' ? 'LPA — Health & Welfare' : 'LPA — Property & Financial'
  const signedDate = _formatDate(lpaData.signedDate)
  const stale = lpaData.staleFlag === true
  return (
    <Card
      eyebrow={kind === 'health' ? 'Document 2 of 4' : 'Document 3 of 4'}
      title={label}
      status={lpaData.status}
      footerNote={stale ? `Signed ${signedDate || 'over a decade ago'} — consider reviewing whether your attorneys + intentions still reflect your wishes.` : null}
    >
      {lpaData.status === 'notStarted' ? (
        <div>
          {kind === 'health'
            ? 'No Health & Welfare LPA recorded. This document lets a chosen attorney make medical and care decisions if you lose mental capacity. Without it, family may need a Court of Protection deputyship — slower and costlier.'
            : 'No Property & Financial LPA recorded. This document lets a chosen attorney pay bills, manage accounts, and sell assets if you lose mental capacity. Without it, accounts can be frozen pending Court of Protection deputyship.'}
        </div>
      ) : (
        <div>
          {signedDate && <div>Signed: <strong style={{ color: 'var(--c-text)' }}>{signedDate}</strong></div>}
          <div style={{ marginTop: 6 }}>
            {lpaData.registered
              ? 'Registered with the Office of the Public Guardian — usable immediately if needed.'
              : 'Signed but not yet registered. Registration is required before the LPA can be used.'}
          </div>
          {lpaData.source && (
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--c-text3)' }}>
              Source: <code>{lpaData.source}</code>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function NominationsSection({ entity }) {
  const status = entity?.estate?.nominations?.status || 'notStarted'
  const pensionNoms   = entity?.estate?.nominations?.pension   || entity?.assets?.sipp?.nominee
  const isaNoms       = entity?.estate?.nominations?.isa       || null
  const protectionNoms= entity?.estate?.nominations?.protection || null
  return (
    <Card eyebrow="Document 4 of 4" title="Beneficiary nominations" status={status}>
      {status === 'notStarted' ? (
        <div>
          No nominations recorded. Pension death benefits + life policies in trust
          pass OUTSIDE your estate (no IHT) — but only if the provider has a
          current expression-of-wish or nomination form on file. Check with each
          provider.
        </div>
      ) : (
        <div>
          {pensionNoms && (
            <div>Pension: <strong style={{ color: 'var(--c-text)' }}>{typeof pensionNoms === 'string' ? pensionNoms : pensionNoms?.name || 'recorded'}</strong></div>
          )}
          {isaNoms && (
            <div style={{ marginTop: 4 }}>ISA: <strong style={{ color: 'var(--c-text)' }}>{typeof isaNoms === 'string' ? isaNoms : isaNoms?.name || 'recorded'}</strong></div>
          )}
          {protectionNoms && (
            <div style={{ marginTop: 4 }}>Life policy: <strong style={{ color: 'var(--c-text)' }}>{typeof protectionNoms === 'string' ? protectionNoms : protectionNoms?.name || 'in trust'}</strong></div>
          )}
        </div>
      )}
    </Card>
  )
}

function TrustsSection({ entity }) {
  const trusts = Array.isArray(entity?.estate?.trusts) ? entity.estate.trusts : []
  if (trusts.length === 0) {
    return (
      <Card eyebrow="Vehicles" title="Trusts" status="notStarted">
        <div>
          No trusts recorded. Trusts can hold gifts for grandchildren, protect
          assets for a vulnerable beneficiary, or sit outside your estate for
          IHT if structured correctly. Discretionary, bare, and
          interest-in-possession trusts each behave differently.
        </div>
      </Card>
    )
  }
  return (
    <Card eyebrow="Vehicles" title={`Trusts (${trusts.length})`} status="current">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trusts.map((t, i) => (
          <div key={t.id || i} style={{
            padding: '8px 10px',
            background: 'var(--c-tint-neutral)',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
              {t.name || t.type || `Trust ${i + 1}`}
            </div>
            {t.type && (
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
                Type: {t.type}{t.value ? ` · £${(+t.value).toLocaleString('en-GB')}` : ''}
              </div>
            )}
            {t.beneficiaries && (
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
                Beneficiaries: {Array.isArray(t.beneficiaries) ? t.beneficiaries.map(b => b?.name || b).join(', ') : t.beneficiaries}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Default export ──────────────────────────────────────────────────────────

export default function MoneyTrusts({ entity, onBack, onHome, onNav, onCommit }) {
  const ty = useTaxYear()
  // CX-6 (2026-05-28): unified LPA reader covering all 3 known shape variants.
  const lpa = lpaStatus(entity)
  const items = [
    { key: 'will',         status: entity?.estate?.will?.status         || 'notStarted' },
    { key: 'lpaHealth',    status: lpa.health.status  },
    { key: 'lpaFinance',   status: lpa.finance.status },
    { key: 'nominations',  status: entity?.estate?.nominations?.status  || 'notStarted' },
    { key: 'trusts',       status: (entity?.estate?.trusts?.length > 0) ? 'current' : 'notStarted' },
  ]

  return (
    <div style={{ padding: '12px 16px 80px', maxWidth: 720, margin: '0 auto' }}>
      {/* ── 1. Header chrome ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 12px' }}>
        <button type="button" onClick={onBack} aria-label="Back to My Money" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ fontSize: 16 }}>←</span> My Money
        </button>
        <div title={`Tax year: ${ty.taxYear}`} style={{
          fontSize: 10, padding: '3px 8px',
          background: 'var(--c-surface2)', borderRadius: 100,
          color: 'var(--c-text3)', fontWeight: 700,
        }}>
          UK · {ty.taxYear} rules
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 870, color: 'var(--c-text)', marginBottom: 4, letterSpacing: -0.4 }}>
        Trusts &amp; Estate
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 16 }}>
        Wills, lasting powers of attorney, beneficiary nominations, and trusts —
        the four documents that decide where your money goes when you can't.
      </div>

      {/* Tab-aware finances strip (founder image-3, 2026-05-28). Surfaces
          Vehicles / Estate / Reliefs / IHT so the user has the same chrome
          rhythm as Balance Sheet / Income Statement. Pre-2027 includeSipp=
          false (pensions still outside the estate today); the screen below
          shows the post-2027 picture in detail. */}
      {(() => {
        const iht = (() => { try { return ihtDynamic(entity, false) } catch { return null } })()
        if (!iht) return null
        const estate = +iht.gross || 0
        const ihtDue = +iht.iht || 0
        // Reliefs = the share of the gross estate that escapes IHT. That's
        // gross − taxable (NRB + RNRB + BPR + spousal exemption all roll up
        // into this difference). Earlier draft also subtracted ihtDue which
        // double-counted and pinned the figure to zero on Bruce.
        const taxable = +iht.taxable || 0
        const reliefs = Math.max(0, estate - taxable)
        const vehicleCount = (entity?.estate?.trusts?.length || 0)
          + (entity?.estate?.will?.status === 'current' ? 1 : 0)
          + (lpa.health.status === 'registered' ? 1 : 0)
          + (lpa.finance.status === 'registered' ? 1 : 0)
        return (
          <FinancesHeroCard
            entity={entity}
            variant="trusts"
            count={vehicleCount}
            estate={fmt(estate)}
            estateRaw={estate}
            reliefs={fmt(reliefs)}
            reliefsRaw={reliefs}
            iht={fmt(ihtDue)}
            ihtRaw={ihtDue}
            onAddOrEdit={() => (onNav || onBack)?.('money')}
          />
        )
      })()}

      {/* ── 2. EstateVault hero ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <EstateVault
          items={items}
          onTileTap={(key) => {
            onCommit?.({
              type: 'TRUSTS_TILE_TAPPED',
              ts: Date.now(),
              correlation_id: `trusts-tap-${Date.now()}`,
              payload: { key },
            })
            onNav?.('money', { addType: key })
          }}
          ariaLabel="Estate vault overview"
        />
      </div>

      {/* ── 3. Will ──────────────────────────────────────────────────────── */}
      <WillSection entity={entity} />

      {/* ── 4. LPAs (health + finance) ───────────────────────────────────── */}
      <LpaPanel kind="health"  lpaData={lpa.health} />
      <LpaPanel kind="finance" lpaData={lpa.finance} />

      {/* ── 5. Beneficiary nominations ───────────────────────────────────── */}
      <NominationsSection entity={entity} />

      {/* ── 6. Trusts ───────────────────────────────────────────────────── */}
      <TrustsSection entity={entity} />

      {/* ── 7. IHT cross-link to /tax ────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onNav?.('tax')}
        className="sw-press"
        aria-label="Open IHT projection on Tax & Estate page"
        style={{
          width: '100%', marginTop: 8, padding: '14px 16px',
          background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
          borderRadius: 12, cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}
      >
        <div>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>IHT projection</div>
          <div style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 600 }}>
            See IHT today vs from 6 April 2027
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
            On the Tax &amp; Estate page · pension-IHT delta + 7-year gift clock
          </div>
        </div>
        <span aria-hidden="true" style={{ fontSize: 18, color: 'var(--c-acc)' }}>›</span>
      </button>

      {/* ── 8. Statutory disclaimer (verbatim §8) ────────────────────────── */}
      <div style={{
        marginTop: 14, padding: '10px 14px',
        fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5,
        fontStyle: 'italic',
      }}>
        Estate planning involves legal and tax considerations beyond this view.
        Not personal advice. Documents and nominations should be set up with a
        qualified professional.
      </div>
    </div>
  )
}
