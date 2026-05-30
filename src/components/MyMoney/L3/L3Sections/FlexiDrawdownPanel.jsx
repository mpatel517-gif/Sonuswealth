// ─────────────────────────────────────────────────────────────────────────────
// FlexiDrawdownPanel — L3 panel: "will my pension pot last?"
//
// 2026-05-30: now powered by the full CMA engine (probabilityOfSuccess) —
// lognormal market returns built from the CMA bundle, inflation modelled as a
// rising cost each year, and the State Pension layered in. Shows results in
// today's money OR future pounds via a plain-English toggle.
//
// Per CLAUDE.md §0.3: plain English only. No "POS", "SWR", "p10/p90" in the
// labels the user reads — those live in the drill detail, not the row titles.
// ─────────────────────────────────────────────────────────────────────────────

import { useState }              from 'react'
import { L3Panel }               from '../L3Panel.jsx'
import { DrillableNumber }       from '../DrillableNumber.jsx'
import { useDrillStackContext }  from '../DrillStack.jsx'
import { fmt }                   from '../../../../engine/fq-calculator.js'
import { buildDrawdownSnapshot } from './FlexiDrawdownPanel.data.js'
import {
  posPayload,
  potPayload,
  annualDrawPayload,
  typicalPotPayload,
  unluckyPotPayload,
  luckyPotPayload,
} from './FlexiDrawdownPayloads.js'

// Plain-English toggle: today's money vs future pounds.
function MoneyViewToggle({ view, setView }) {
  const opt = (key, label, hint) => (
    <button
      type="button"
      onClick={() => setView(key)}
      data-money-view={key}
      title={hint}
      style={{
        flex: 1,
        padding: '6px 8px',
        fontSize: 'var(--fs-xsmall, 10px)',
        fontWeight: 600,
        cursor: 'pointer',
        border: `1px solid ${view === key ? 'var(--c-acc, #5ddbc2)' : 'var(--c-border, rgba(255,255,255,0.15))'}`,
        background: view === key ? 'rgba(93,219,194,0.15)' : 'transparent',
        color: view === key ? 'var(--c-acc, #5ddbc2)' : 'var(--c-text2)',
        borderRadius: 6,
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      {opt('real', 'In today’s money', 'Future pounds adjusted back to what they would buy today')}
      {opt('nominal', 'Future pounds', 'The actual £ figures in future years, before adjusting for rising prices')}
    </div>
  )
}

function SustainabilitySection({ snap, view, setView, pushNumber }) {
  const band = view === 'real' ? snap.real : snap.nominal

  // pot / draw / chance are view-independent (today's money / a probability).
  const fixedRows = [
    {
      key: 'pot',
      label: 'Your retirement savings',
      value: fmt(snap.pot),
      payload: potPayload(snap),
      readOnly: true,
    },
    {
      key: 'draw',
      label: snap.drawSource === 'default'
        ? 'Income you draw each year (a starting 4%)'
        : 'Income you draw each year',
      value: fmt(snap.annualDraw),
      payload: annualDrawPayload(snap),
      readOnly: false,
    },
    {
      key: 'pos',
      label: `Chance it lasts to age ${snap.terminalAge}`,
      value: `${snap.pos}%`,
      payload: posPayload(snap),
      readOnly: true,
    },
  ]

  // The three outcome rows flip with the toggle.
  const bandRows = [
    {
      key: 'p50',
      label: `Typical outcome — left at age ${snap.terminalAge}`,
      value: fmt(band.p50),
      payload: typicalPotPayload(snap, view),
    },
    {
      key: 'p10',
      label: 'If markets are unkind (worst 1 in 10)',
      value: fmt(band.p10),
      payload: unluckyPotPayload(snap, view),
    },
    {
      key: 'p90',
      label: 'If markets are kind (best 1 in 10)',
      value: fmt(band.p90),
      payload: luckyPotPayload(snap, view),
    },
  ]

  const renderRow = (row) => (
    <div
      key={row.key}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '5px 0',
        borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
      }}
    >
      <span style={{ fontSize: 'var(--fs-small, 12px)', color: 'var(--c-text2)', flex: 1, paddingRight: 8 }}>
        {row.label}
      </span>
      <DrillableNumber
        metric={`Flexi-drawdown · ${row.label}`}
        value={row.value}
        formula={row.payload.formula}
        source={row.payload.source}
        confidence={row.payload.confidence}
        breakdown={row.payload.breakdown}
        editable={row.payload.editable}
        onDrill={pushNumber}
      >
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: 'var(--fs-small, 12px)',
            color: row.key === 'pos'
              ? (snap.pos >= 75 ? 'var(--c-good, var(--c-acc))' : snap.pos >= 50 ? 'var(--c-warn, #F5A623)' : 'var(--c-bad, #E05252)')
              : 'var(--c-text)',
          }}
        >
          {row.value}
        </span>
      </DrillableNumber>
    </div>
  )

  return (
    <div data-section-label="Sustainability" style={{ padding: '4px 6px' }}>
      <div style={{ fontSize: 8, opacity: 0.6, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Will your money last?
      </div>
      {fixedRows.map(renderRow)}

      <div style={{ fontSize: 8, opacity: 0.6, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '12px 0 6px' }}>
        What could be left at age {snap.terminalAge}
      </div>
      <MoneyViewToggle view={view} setView={setView} />
      {bandRows.map(renderRow)}

      <div style={{ marginTop: 8, fontSize: 'var(--fs-xsmall, 10px)', color: 'var(--c-text3)' }}>
        Based on {snap.runs.toLocaleString()} simulated futures using market and inflation
        assumptions ({Math.round(snap.inflation * 100)}% a year). The State Pension is
        included from age {snap.statePensionFrom}.
        {snap.drawSource === 'default' && ' No income amount set yet — using 4% of your savings as a starting point. Tap “Income you draw each year” to set your own.'}
      </div>
    </div>
  )
}

export function FlexiDrawdownPanel({ entity, ripple }) {
  const snap = buildDrawdownSnapshot(entity)
  const { pushNumber } = useDrillStackContext()
  const [view, setView] = useState('real')
  const heroPay = posPayload(snap)

  const hero = {
    metric: (
      <DrillableNumber
        metric="Flexi-drawdown · Chance it lasts"
        value={`${snap.pos}%`}
        formula={heroPay.formula}
        source={heroPay.source}
        confidence={heroPay.confidence}
        breakdown={heroPay.breakdown}
        onDrill={pushNumber}
      >
        {`${snap.pos}%`}
      </DrillableNumber>
    ),
    label: 'Chance your money lasts',
    sublabel: snap.pot === 0
      ? 'No retirement savings recorded'
      : `${fmt(snap.pot)} saved · drawing ${fmt(snap.annualDraw)}/yr to age ${snap.terminalAge} · tap to drill`,
  }

  const taxTreatment = {
    incomeTax: {
      headline: 'Withdrawals taxed at your normal rate; first 25% tax-free',
      detail: 'You can take up to 25% of the pot as a tax-free lump sum. The rest counts as income for the year and is taxed at your normal rate — so a big one-off withdrawal can tip you into a higher tax band.',
    },
    capitalGains: {
      headline: 'None while the money stays in the pension',
      detail: 'Growth inside a pension is free of capital gains tax. Tax only comes into play once money is withdrawn.',
    },
    inheritance: {
      headline: 'Outside your estate until April 2027, then inside it',
      detail: 'From April 2027 (Finance Act 2026), any unused pension counts towards inheritance tax. Until then it passes to the people you have nominated free of inheritance tax — worth checking your nomination is up to date.',
    },
  }

  const middle = [
    {
      key: 'sustainability',
      render: () => <SustainabilitySection snap={snap} view={view} setView={setView} pushNumber={pushNumber} />,
    },
  ]

  const confidence = {
    level: snap.pot === 0 ? 'low' : 'high',
    totalFields: 3,
    verifiedFields: snap.pot > 0 ? (snap.drawSource === 'default' ? 2 : 3) : 0,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="flexi-drawdown"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
