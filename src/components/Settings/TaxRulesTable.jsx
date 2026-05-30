// ─────────────────────────────────────────────────────────────────────────────
// TaxRulesTable — show the END USER the actual tax thresholds & rates the engine
// applies. Reads the LIVE source of truth (TAX, built from UK-2026.1.1.json via
// _bundle.js), never a stale fixture and never values paraphrased from memory.
//
// HONESTY NOTE (CLAUDE.md §7 regulatory): the bundle does NOT carry a per-rule
// ENACTED/PROPOSED status enum, so we do NOT fabricate one. We show the values
// in force, the rules version, and flag the one genuinely future-dated change
// the engine already models (pensions entering the estate from the deadline
// date). Everything else is "currently applied".
// ─────────────────────────────────────────────────────────────────────────────

import { TAX } from '../../engine/fq-calculator.js'

const pct = (r) => `${(r * 100).toFixed(r * 100 % 1 === 0 ? 0 : 2)}%`
// EXACT figures — this is a rules reference, so £12,570 must read £12,570, not
// the k-rounded "£13k" that fmt() would give. Precision is the whole point here.
const money = (n) => (Number.isFinite(n) ? `£${Math.round(n).toLocaleString('en-GB')}` : '—')

function Row({ label, value, note, last }) {
  return (
    <div style={{ padding: '10px 16px', borderBottom: last ? 'none' : '1px solid var(--c-sep)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 'var(--fs-body, 15px)', color: 'var(--c-text2)' }}>{label}</span>
        <span style={{ fontSize: 'var(--fs-body, 15px)', color: 'var(--c-text)', fontWeight: 600,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
      </div>
      {note && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{note}</div>}
    </div>
  )
}

function Group({ title, children }) {
  return (
    <>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
        color: 'var(--c-text3)', padding: '16px 16px 6px' }}>{title}</div>
      <div style={{ background: 'var(--c-surface)', borderTop: '1px solid var(--c-sep)', borderBottom: '1px solid var(--c-sep)' }}>
        {children}
      </div>
    </>
  )
}

export function TaxRulesTable() {
  const sippDate = TAX.deadline instanceof Date
    ? TAX.deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '6 April 2027'

  return (
    <div>
      <div style={{ padding: '12px 16px', fontSize: 'var(--fs-small, 13px)', color: 'var(--c-text2)', lineHeight: 1.5 }}>
        The actual UK figures every calculation uses, version <strong>{TAX.ver}</strong> (tax
        year {TAX.taxYear}). These are the rules in force now — not predictions.
      </div>

      <Group title="Income tax (England, Wales & NI)">
        <Row label="Personal allowance"        value={money(TAX.pa)}  note="Tax-free band; tapers away above £100,000" />
        <Row label="Basic rate"                value={`${pct(TAX.br)} to ${money(TAX.brt)}`} />
        <Row label="Higher rate"               value={`${pct(TAX.hr)} from ${money(TAX.brt)}`} />
        <Row label="Additional rate"           value={`${pct(TAX.ar)} from ${money(TAX.art)}`} last />
      </Group>

      <Group title="Dividends">
        <Row label="Basic-rate dividend"       value={pct(TAX.dividendBR)} />
        <Row label="Higher-rate dividend"      value={pct(TAX.dividendHR)} />
        <Row label="Additional-rate dividend"  value={pct(TAX.dividendAR)} last />
      </Group>

      <Group title="Savings & investing allowances">
        <Row label="ISA allowance"             value={`${money(TAX.isaAllowance)}/yr`} />
        <Row label="Pension annual allowance"  value={`${money(TAX.pensionAA)}/yr`} note="Reduced for very high earners" />
        <Row label="Money-purchase allowance"  value={`${money(TAX.mpaa)}/yr`} note="Applies once you flexibly access a pension" last />
      </Group>

      <Group title="Capital gains tax">
        <Row label="Tax-free allowance"        value={`${money(TAX.cgaAllowance)}/yr`} />
        <Row label="Basic-rate CGT"            value={pct(TAX.cgtBasic)} />
        <Row label="Higher-rate CGT"           value={pct(TAX.cgtHigher)} last />
      </Group>

      <Group title="Inheritance & estate">
        <Row label="Nil-rate band"             value={money(TAX.nrb)}  note="Tax-free before 40% IHT" />
        <Row label="Residence nil-rate band"   value={money(TAX.rnrb)} note="Extra band when leaving a home to descendants" />
        <Row label="IHT rate"                  value={pct(TAX.ihtRate)} />
        <Row label="Annual gift exemption"     value={`${money(TAX.annualGiftExemption)}/yr`} />
        <Row label="Pensions enter your estate" value={`from ${sippDate}`}
          note="Future-dated change already modelled — unspent pensions become subject to IHT" last />
      </Group>

      <Group title="State pension">
        <Row label="Full new state pension"    value={`${money(TAX.statePensionFull)}/yr`} />
        <Row label="State pension age"         value={`${TAX.spa}`} note="Rising over time" last />
      </Group>

      <div style={{ padding: '16px', fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.6 }}>
        Sourced from rules version {TAX.ver}. Sonuswealth provides information and
        guidance, not regulated financial advice. Figures update automatically when
        the rules change. Scotland sets its own income-tax bands — Scottish figures
        are applied where your profile indicates Scottish residency.
      </div>
    </div>
  )
}
