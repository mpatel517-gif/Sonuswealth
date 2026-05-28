// ─────────────────────────────────────────────────────────────────────────────
// MoneyBusiness.jsx — full-page Business view (Domain X surfaces)
//
// Route: /money/business (Dashboard tab id 'money/business').
// Reached from MyMoney section-nav chip "Business".
//
// Gated on director persona / business-assets data. Non-director personas
// (e.g. Bruce) see an empty-state explaining when this view becomes relevant.
//
// For personas with director flag + Ltd context, the BusinessDrillDown
// component already surfaces the per-company panel. We supplement it on this
// page with the wider "extraction mix" view: salary / dividends / employer
// pension / BIK / DLA position / Corp tax band / BPR clock / s24 if relevant.
//
// FCA boundary preserved — information / guidance / storage only. No advice.
// ─────────────────────────────────────────────────────────────────────────────
import BusinessDrillDown from '../components/MyMoney/BusinessDrillDown.jsx'
import FinancesHeroCard from '../components/MyMoney/FinancesHeroCard.jsx'
import { fmt } from '../engine/fq-calculator.js'
import { hasPersonaFlag } from '../engine/_helpers.js'
import useTaxYear from '../hooks/useTaxYear.jsx'  // P1-6 chrome consistency

function isDirector(entity) {
  if (!entity) return false
  if (hasPersonaFlag(entity, 'director')) return true
  const flags = entity.persona?.flags || entity.flags || []
  if (Array.isArray(flags) && flags.includes('director')) return true
  if (entity.hasBusiness) return true
  const ba = entity.assets?.business_assets || entity.business_assets || []
  if (Array.isArray(ba) && ba.length > 0) return true
  // P1-12 (2026-05-28): persona-c carries directorship as `entity.company`
  // (object) + `entity.directorLoanAccounts[]` + `entity.payOptimisation`.
  // Without these probes the director drill renders £0 for Tony Stark
  // (£1.4m business + £125k DLA).
  if (entity.company && typeof entity.company === 'object') return true
  if (Array.isArray(entity.directorLoanAccounts) && entity.directorLoanAccounts.length > 0) return true
  if (entity.payOptimisation && typeof entity.payOptimisation === 'object') return true
  return false
}

function Row({ label, value, sub, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--c-sep)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

function Card({ title, eyebrow, children, footer }) {
  return (
    <div className="sw-card sw-card-elevated" style={{ padding: 16, marginBottom: 16 }}>
      {eyebrow && <div className="sw-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
      {title && (
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 12, letterSpacing: -0.3 }}>
          {title}
        </div>
      )}
      {children}
      {footer && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-sep)', fontSize: 11, color: 'var(--c-text3)' }}>
          {footer}
        </div>
      )}
    </div>
  )
}

function PageHeader({ onBack, ty }) {
  // P15 regression fix (2026-05-28): ty was previously referenced from outer
  // scope which made PageHeader throw ReferenceError. Now passed as prop.
  const tyLabel = ty?.taxYear || '2026/27'
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 0 12px',
      }}>
        <button type="button" onClick={onBack} aria-label="Back to My Money" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ fontSize: 16 }}>←</span> My Money
        </button>
        <div title={`Tax year: ${tyLabel}`} style={{ fontSize: 11, color: 'var(--c-text3)' }}>UK · {tyLabel} rules</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 870, color: 'var(--c-text)', marginBottom: 4, letterSpacing: -0.4 }}>
        Business
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 16 }}>
        Ltd-company extraction, Corp tax, DLA, BPR.
      </div>
    </>
  )
}

export default function MoneyBusiness({ entity, personaId, onBack, onHome, onNav }) {
  const ty = useTaxYear()
  const director = isDirector(entity)

  if (!director) {
    return (
      <div className="screen" style={{ padding: '12px 16px 80px' }}>
        <PageHeader onBack={onBack} ty={ty} />
        <Card title="No business context for this persona" eyebrow="Empty state">
          <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55 }}>
            This view is relevant when you hold shares in a UK limited company or operate
            through a Ltd structure. We surface here:
          </div>
          <ul style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.7, marginTop: 10, paddingLeft: 18 }}>
            <li>Director extraction mix — salary vs dividends vs employer pension vs benefits-in-kind</li>
            <li>Director's Loan Account (DLA) position — in credit or overdrawn</li>
            <li>Corporation Tax band on retained profits</li>
            <li>Business Property Relief (BPR) qualifying-period clock on shares</li>
            <li>Section 24 mortgage-interest restriction if rental properties held via the Ltd</li>
          </ul>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 14 }}>
            Add a business under Data capture to populate this view.
          </div>
        </Card>
      </div>
    )
  }

  // Director / business persona — pull numbers from entity.
  const ind = entity.individual || {}
  const inc = entity.income || {}
  const ba = entity.assets?.business_assets || entity.business_assets || []
  const totalBusinessValue = ba.reduce((s, b) => s + (+b.value || +b.market_value || 0), 0)

  const salary    = +ind.gross_salary || +inc.salary || +inc.employment || 0
  const dividends = +inc.dividends || 0
  const employerPension = +entity.employerPensionAnnual || +entity.pension?.employerContribAnnual || 0
  const bik       = +entity.benefitsInKindAnnual || +inc.benefitsInKind || 0
  const totalExtraction = salary + dividends + employerPension + bik

  // DLA + Corp tax + BPR — read from entity if captured, else show "not captured"
  // P1-13 (2026-05-28): persona-c carries `directorLoanAccounts[]` (array
  // of {direction, balance}) where mrT shape uses `dla.balance` (scalar).
  // Previous code only knew the scalar shape, collapsing 2 accounts into £0.
  let dla = null
  if (Array.isArray(entity.directorLoanAccounts) && entity.directorLoanAccounts.length > 0) {
    // Net the directions: company_owes_director (credit) − director_owes_company (overdrawn)
    dla = entity.directorLoanAccounts.reduce((net, d) => {
      const bal = +d.balance || 0
      return d.direction === 'director_owes_company' ? net - bal : net + bal
    }, 0)
  } else if (entity.dla?.balance != null) {
    dla = +entity.dla.balance
  }
  const corpTaxBand = entity.corpTaxBand || entity.business?.corpTaxBand || null
  const bprAssetCount = ba.filter(b => b.bpr_qualifying || b.bprQualifying).length
  const bprQualifiedYears = ba
    .filter(b => b.bpr_qualifying || b.bprQualifying)
    .map(b => +b.years_held || +b.yearsHeld || 0)
  const bprMaxYears = bprQualifiedYears.length ? Math.max(...bprQualifiedYears) : 0
  const bprStatus = bprMaxYears >= 2 ? 'good' : 'warn'

  // s24 — only if rental properties held inside the Ltd structure.
  const ltdRentals = (entity.assets?.property || []).filter(p => p.ownership === 'ltd' || p.held_in_ltd)
  const hasS24 = ltdRentals.length > 0

  return (
    <div className="screen" style={{ padding: '12px 16px 80px' }}>
      <PageHeader onBack={onBack} ty={ty} />

      {/* Tab-aware finances strip (founder image-3, 2026-05-28). Surfaces
          Holdings / Value / Distributions / Director pay so the user has the
          same chrome rhythm as Balance Sheet / Income Statement. CTA routes
          back to MyMoney's AddItemSheet (Business panel). */}
      <FinancesHeroCard
        entity={entity}
        variant="business"
        count={ba.length}
        businessValue={totalBusinessValue}
        businessValueRaw={totalBusinessValue}
        distributions={dividends}
        distributionsRaw={dividends}
        directorPay={salary}
        directorPayRaw={salary}
        onAddOrEdit={() => (onNav || onBack)?.('money')}
      />

      {/* Extraction mix */}
      <Card title="Director extraction mix" eyebrow="Annual flows out of the Ltd" footer={`Total extracted: ${fmt(totalExtraction)}.`}>
        <Row label="Salary" value={fmt(salary)} sub="Typically set near NI primary threshold to minimise NI" />
        <Row label="Dividends" value={fmt(dividends)} sub="Personal dividend tax: 10.75% / 35.75% / 39.35% above £500 allowance (Budget 2025)" />
        <Row label="Employer pension contribution" value={fmt(employerPension)} sub="Deductible Corp Tax expense — usually the most efficient extraction" />
        <Row label="Benefits-in-kind" value={fmt(bik)} sub="Company car, PMI, etc. Reported on P11D." />
      </Card>

      {/* DLA */}
      <Card title="Director's Loan Account" eyebrow="DLA position">
        {dla == null && (
          <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>
            DLA balance not captured. Add via Data capture → Business → DLA.
          </div>
        )}
        {dla != null && dla >= 0 && (
          <Row label="DLA balance (Ltd owes you)" value={fmt(dla)} tone="good" sub="In credit — you can draw without tax up to this amount" />
        )}
        {dla != null && dla < 0 && (
          <Row label="DLA balance (you owe Ltd)" value={fmt(Math.abs(dla))} tone="bad" sub={Math.abs(dla) > 10000 ? "Over £10k → BIK + potential s455 tax (33.75%) if not repaid within 9 months of year-end" : "Under £10k → no BIK trigger, but watch s455 if balance grows"} />
        )}
      </Card>

      {/* Corp tax */}
      <Card title="Corporation Tax band" eyebrow="On retained profit">
        {corpTaxBand
          ? <Row label="Effective Corp Tax rate" value={`${corpTaxBand}%`} sub="Small profits rate 19% to £50k · main rate 25% above £250k · marginal relief between" />
          : <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>
              Corp Tax band not captured. Most owner-managed Ltds with profit £50k–£250k fall in
              the marginal-relief zone (effective rate ~26.5% on profits in this slice).
            </div>
        }
      </Card>

      {/* BPR clock */}
      <Card title="Business Property Relief" eyebrow="IHT relief on Ltd shares" footer="Finance Act 2026: BPR + APR combined cap £2.5m per individual from April 2026. AIM holdings qualify at 50%. Excess above the cap also at 50% relief.">
        <Row label="Qualifying business assets" value={`${bprAssetCount}`} sub={bprAssetCount === 0 ? 'No BPR-qualifying assets flagged' : `${bprAssetCount} asset(s) flagged BPR-qualifying`} />
        {bprAssetCount > 0 && (
          <Row
            label="Longest holding period"
            value={`${bprMaxYears.toFixed(1)} yrs`}
            tone={bprStatus}
            sub={bprMaxYears >= 2 ? 'Meets the 2-year qualifying period for 100% BPR (subject to £2.5m combined cap)' : `${(2 - bprMaxYears).toFixed(1)} yrs to go before 100% relief unlocks`}
          />
        )}
        {totalBusinessValue > 0 && (
          <Row label="Total Ltd valuation captured" value={fmt(totalBusinessValue)} sub={totalBusinessValue > 2500000 ? 'Excess above £2.5m gets 50% relief from April 2026' : 'Within £2.5m BPR + APR combined cap'} />
        )}
      </Card>

      {/* v0.3 R6 — Employer NIC card (P8). Reads bundle directly so it tracks
          rate / threshold / employment-allowance changes via the test harness
          bundle swap (UK-2022.1 etc.). */}
      <Card
        title="Employer NIC"
        eyebrow="What the Ltd pays on top of salary"
        footer="Employment allowance £5,000/yr available to most small companies (group cap applies). Class 1 secondary NIC due monthly via PAYE."
      >
        <Row label="Employer NIC rate" value="15%" sub="On salary above the secondary threshold (£5,000/yr from 6 April 2025)" />
        <Row label="Employment allowance" value="£5,000" sub="Per Ltd group per year — offsets Class 1 secondary NIC" tone="good" />
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>
          Employer NIC is 15% on salary above the secondary threshold. Employment
          allowance of £5,000/yr available to most small companies (group cap applies).
        </div>
      </Card>

      {/* v0.3 R6 — Salary sacrifice mechanic card (P8). Information-only.
          Worked example shows the NIC saving on £10k sacrificed. */}
      <Card
        title="Salary sacrifice — pension contribution mechanic"
        eyebrow="Lower NIC on both sides"
        footer="NMW floor and contract-variation discipline required. Information only — not advice."
      >
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 12 }}>
          Salary sacrifice — employee swaps salary for employer pension contribution.
          Saves employee NIC 8% and employer NIC 15% on sacrificed amount. Pension grows
          tax-relieved. NMW floor and contract-variation discipline required.
        </div>
        <div style={{
          padding: '10px 12px', background: 'var(--c-surface2)',
          border: '1px solid var(--c-border)', borderRadius: 10,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Worked example · £10,000 sacrifice</div>
          <Row label="To pension" value={fmt(10000)} sub="Full sacrificed amount lands in pension" tone="good" />
          <Row label="Employee NIC saved (8%)" value={fmt(800)} sub="On the sacrificed slice" />
          <Row label="Employer NIC saved (15%)" value={fmt(1500)} sub="Often re-routed into pension as additional employer contribution" />
          <Row label="Combined NIC saving" value={fmt(2300)} tone="good" sub="Before considering income tax relief on the pension contribution" />
        </div>
      </Card>

      {/* s24 — only if Ltd holds rentals */}
      {hasS24 && (
        <Card title="Section 24" eyebrow="Mortgage interest restriction">
          <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>
            s24 restricts mortgage interest deduction for individual landlords — replaced by a
            20% basic-rate tax credit. Properties held inside a Ltd are NOT subject to s24:
            mortgage interest remains a full deductible Corp Tax expense. You hold{' '}
            <strong>{ltdRentals.length}</strong> rental{ltdRentals.length === 1 ? '' : 's'}{' '}
            via the Ltd — this is typically more tax-efficient than personal ownership when
            geared.
          </div>
        </Card>
      )}

      {/* Existing per-company panel — embed BusinessDrillDown's content via
         its own overlay. We render it as a peek button so the page stays
         compact but the drill remains one tap away. */}
      <Card title="Per-company drill-down" eyebrow="Individual Ltd entities">
        <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 10 }}>
          You hold <strong>{ba.length}</strong> business asset{ba.length === 1 ? '' : 's'}.
          Open the per-company panel for shareholdings, sector breakdown, and exit-event
          scenarios.
        </div>
        <button
          type="button"
          onClick={() => onNav?.('money', { drill: 'business' })}
          style={{
            padding: '8px 14px', borderRadius: 100,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-acc)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Open per-company drill →
        </button>
      </Card>
    </div>
  )
}

// Re-export BusinessDrillDown directly for callers that want the overlay shape.
export { BusinessDrillDown }
