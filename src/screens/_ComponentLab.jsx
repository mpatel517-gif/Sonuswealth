// ─────────────────────────────────────────────────────────────────────────────
// _ComponentLab — visual harness for every shared primitive
// Not wired into navigation. Mount once for visual regression / snap script.
// Each section gets a sensible default so a screenshot shows real chrome.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  X28TopBar,
  DiffBadge, DeltaChip, CausalityStripe, DiffPulse, HotspotIndicator,
  ExplainerChip,
  PlanStalenessBanner,
  CoIOdometer,
  RevealCard,
  Num,
  ProvenanceChip,
  CrossMap5x5,
  BeneficiarySankey,
} from '../components/shared'

export default function ComponentLab() {
  const [pulseTrigger, setPulseTrigger] = useState(0)
  const [fqBand, setFqBand] = useState('established')
  const [riskBand, setRiskBand] = useState('managed')

  return (
    <div style={{
      maxWidth: 720,
      margin: '0 auto',
      paddingBottom: 60,
      background: 'var(--c-bg)',
      minHeight: '100vh',
    }}>
      <Header title="X28TopBar" />
      <X28TopBar
        rulesVersion="UK-2026.1"
        dataDate="April 2026"
        onWindowChange={(w)   => console.log('window →', w)}
        onViewModeChange={(m) => console.log('mode →',   m)}
        onNowTap={() => console.log('snap to now')}
      />

      <Header title="Diff layer (X29)" />
      <Card>
        <Row label="DiffBadge currency +">
          <DiffBadge value={2400} since={Date.now() - 2 * 86400e3} format="currency" />
        </Row>
        <Row label="DiffBadge currency −">
          <DiffBadge value={-820} since={Date.now() - 9 * 86400e3} format="currency" />
        </Row>
        <Row label="DiffBadge percent (decayed)">
          <DiffBadge value={1.2} since={Date.now() - 13 * 86400e3} format="percent" />
        </Row>
        <Row label="DeltaChip score">
          <DeltaChip delta={+4} format="score" />
          {' '}
          <DeltaChip delta={-2} format="score" />
        </Row>
        <Row label="DiffPulse">
          <DiffPulse trigger={pulseTrigger}>
            <span style={{
              fontSize: 'var(--fs-title)', fontWeight: 800,
              color: 'var(--c-text)',
            }}>
              £127,400
            </span>
          </DiffPulse>
          <button
            onClick={() => setPulseTrigger(t => t + 1)}
            style={btn}
          >Pulse</button>
        </Row>
        <Row label="HotspotIndicator">
          {/* engine.diffSet is a stub returning [] — render is null. We mock by
              showing the dot directly so it's visible in the lab. */}
          <span aria-label="hotspot stub" style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: 'var(--c-acc)', boxShadow: '0 0 6px rgba(45,242,195,0.55)',
          }} />
          <span style={{ marginLeft: 8, fontSize: 'var(--fs-small)', color: 'var(--c-text3)' }}>
            (live indicator returns null while diffSet stub returns [])
          </span>
          <HotspotIndicator dimKey="netWorth" />
        </Row>
      </Card>
      <CausalityStripeWrap />

      <Header title="ExplainerChip ⓘ Registry" />
      <Card>
        {[
          'HOME-1','HOME-2','HOME-3','HOME-SJ-1',
          'MM-1','MM-2','CF-1','CF-2',
          'TE-1','TE-2','RISK-1','RISK-2','TL-1','ASK-1',
        ].map(id => (
          <span key={id} style={{ marginRight: 10, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ExplainerChip id={id} size={18} />
            <code style={{ fontSize: 11, color: 'var(--c-text3)' }}>{id}</code>
          </span>
        ))}
      </Card>

      <Header title="PlanStalenessBanner" />
      <PlanStalenessBanner
        plans={[
          { type: 'retirement', monthsSinceReview: 31, isStale: true,  isCritical: true  },
          { type: 'estate',     monthsSinceReview: 14, isStale: true,  isCritical: false },
          { type: 'protection', monthsSinceReview: 12, deadlineDays: 21, isStale: true, isCritical: true },
          { type: 'cashflow',   monthsSinceReview: 7,  isStale: false, isCritical: false },
          { type: 'investment', monthsSinceReview: 27, isStale: true,  isCritical: true  },
          { type: 'tax',        monthsSinceReview: 26, isStale: true,  isCritical: true  },
        ]}
        onReview={(p) => console.log('review →', p)}
      />

      <Header title="CoIOdometer" />
      <CoIOdometer
        totalCoI={18420}
        dailyRate={42}
        confidence="medium"
        provenance={['UK-2026.1', 'CMA-2026.1', 'Your data']}
        byAction={[
          { label: 'ISA allowance unused',  amount: 6800 },
          { label: 'SIPP carry-forward',    amount: 5400 },
          { label: 'IHT gift not initiated', amount: 4220 },
          { label: 'Cash drag in current account', amount: 2000 },
        ]}
      />

      <Header title="CrossMap5x5" />
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select value={fqBand} onChange={e => setFqBand(e.target.value)} style={sel}>
            {['foundation','building','established','growing','exceptional'].map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select value={riskBand} onChange={e => setRiskBand(e.target.value)} style={sel}>
            {['vulnerable','cautious','managed','protected','resilient'].map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <CrossMap5x5
          fqBand={fqBand}
          riskBand={riskBand}
          onCellTap={(id) => console.log('cell →', id)}
        />
      </div>

      <Header title="BeneficiarySankey" />
      <div style={{ padding: '0 16px' }}>
        <BeneficiarySankey
          estate={{
            gross: 1_200_000,
            deductions: [
              { label: 'NRB',    amount: 325_000 },
              { label: 'RNRB',   amount: 175_000 },
              { label: 'Charity', amount: 50_000 },
            ],
            iht: 260_000,
            net: 390_000,
          }}
          beneficiaries={[
            { name: 'Spouse',   share: 0.5 },
            { name: 'Child A',  share: 0.25 },
            { name: 'Child B',  share: 0.15 },
            { name: 'Trust',    share: 0.1, isContingent: true },
          ]}
          apsEdge={{ amount: 200_000, label: 'APS allowance' }}
        />
      </div>

      <Header title="RevealCard" />
      <div style={{ padding: '0 16px' }}>
        <RevealCard
          cardId="lab-1"
          title="Default closed"
          headerAccessory={<DeltaChip delta={+3} format="score" />}
        >
          <div style={{ color: 'var(--c-text2)' }}>Body content rendered when open.</div>
        </RevealCard>
        <RevealCard
          cardId="lab-2"
          title="Default open"
          defaultOpen
        >
          <div style={{ color: 'var(--c-text2)' }}>This one starts open.</div>
        </RevealCard>
        <RevealCard
          cardId="lab-3"
          title="Pinned by concern"
          pinByConcern="iht"
          entity={{ concerns: ['iht'] }}
        >
          <div style={{ color: 'var(--c-text2)' }}>
            Force-open via pinByConcern — chevron disabled.
          </div>
        </RevealCard>
      </div>

      <Header title="Num primitive" />
      <Card>
        <Row label="currency"><Num value={127400} format="currency" /></Row>
        <Row label="currency · low conf">
          <Num value={42_300} format="currency" confidence="low" />
        </Row>
        <Row label="currency + diff">
          <Num
            value={127400} format="currency"
            diff={{ value: 2400, since: Date.now() - 86400e3, format: 'currency' }}
          />
        </Row>
        <Row label="percent · medium">
          <Num value={4.2} format="percent" confidence="medium" />
        </Row>
        <Row label="score"><Num value={73} format="score" /></Row>
        <Row label="hide-balances"><Num value={127400} format="currency" hideBalances /></Row>
      </Card>

      <Header title="ProvenanceChip" />
      <Card>
        <Row label="small">
          <ProvenanceChip sources={['Your data', 'UK-2026.1']} />
        </Row>
        <Row label="large + 3 sources">
          <ProvenanceChip
            size="large"
            sources={['Your data', 'UK-2026.1', 'CMA-2026.1']}
          />
        </Row>
      </Card>
    </div>
  )
}

// ── tiny lab helpers ────────────────────────────────────────────────────────

function Header({ title }) {
  return (
    <h2 style={{
      fontSize: 'var(--fs-label)',
      fontWeight: 700,
      color: 'var(--c-text3)',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      margin: '24px 16px 10px',
    }}>{title}</h2>
  )
}

function Card({ children }) {
  return (
    <div style={{
      margin: '0 16px 12px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-sep)',
      borderRadius: 14,
      padding: 14,
    }}>
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 0',
      borderBottom: '1px dashed var(--c-sep)',
    }}>
      <span style={{
        fontSize: 'var(--fs-label)',
        color: 'var(--c-text3)',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        minWidth: 140,
      }}>{label}</span>
      <span>{children}</span>
    </div>
  )
}

function CausalityStripeWrap() {
  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-sep)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        <div style={{ padding: 14 }}>
          <div style={{
            fontSize: 'var(--fs-title)', fontWeight: 800, color: 'var(--c-text)',
          }}>
            CausalityStripe demo
          </div>
          <div style={{ fontSize: 'var(--fs-small)', color: 'var(--c-text3)' }}>
            Stripe rendered at the bottom of any card.
          </div>
        </div>
        <CausalityStripe
          sources={['UK-2026.1', 'CMA-2026.1', 'Your data']}
          onTap={() => console.log('open causality')}
        />
      </div>
    </div>
  )
}

const btn = {
  marginLeft: 10,
  padding: '4px 10px',
  borderRadius: 100,
  background: 'var(--c-acc-bg)',
  border: '1px solid var(--c-acc)',
  color: 'var(--c-acc)',
  fontSize: 'var(--fs-label)',
  fontWeight: 700,
  cursor: 'pointer',
}
const sel = {
  padding: '4px 8px',
  background: 'var(--c-surface2)',
  border: '1px solid var(--c-border)',
  borderRadius: 8,
  color: 'var(--c-text)',
  fontSize: 'var(--fs-small)',
}
