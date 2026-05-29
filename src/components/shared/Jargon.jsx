// ─────────────────────────────────────────────────────────────────────────────
// Jargon — plain-English-first acronym renderer (L3-6, 2026-05-28)
//
// Founder pushback (twice): "some items are not in plain english". UK tax
// acronyms (ANI, AEA, PSA, RNRB, NRB, LSDBA, LSA, MPAA, BPR, APR, PET, CLT,
// CETV, GIA, BTL, PPR, s24) leak through user-facing copy. This component
// renders the plain-English label as primary, with the acronym + a short
// definition surfaced on hover/tap.
//
// Usage:
//   <Jargon term="ANI" />
//     → "Taxable income (ANI)" with tooltip
//
//   <Jargon term="ANI">your taxable income</Jargon>
//     → "your taxable income" with the acronym definition surfaced on hover
//
//   <Jargon term="BPR" variant="acronym-first" />
//     → "BPR (Business Property Relief)" — useful inside drill panels where
//       the acronym is the section title and the plain-English is sub-text.
//
//   <Jargon term="UNKNOWN" />
//     → renders the raw term unchanged (fail-soft)
//
// The dictionary is exported so other surfaces (Ask Sonu, Reports) can
// reuse the canonical definitions without duplication.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

// ── Canonical jargon dictionary ─────────────────────────────────────────────
// Keep alphabetised. `plain` is the short user-facing label. `expl` is the
// one-line definition surfaced in tooltips and Ask Sonu responses.
export const JARGON = Object.freeze({
  AEA: {
    plain: 'Annual capital-gains allowance',
    expl: 'The tax-free amount you can make on selling investments each year (£3,000 from 2024/25).',
  },
  ANI: {
    plain: 'Taxable income',
    expl: 'Income after pension contributions, gift aid, and certain reliefs. Used for the £100k Personal Allowance taper and the £60k child-benefit charge.',
  },
  APR: {
    plain: 'Agricultural relief',
    expl: 'Inheritance-tax relief on qualifying farmland and farm buildings.',
  },
  BPR: {
    plain: 'Business relief',
    expl: 'Inheritance-tax relief (up to 100%) on qualifying business assets held for 2+ years. Capped at £1m from April 2026 for AIM and unlisted shares.',
  },
  BTL: {
    plain: 'Buy-to-let property',
    expl: 'Residential property held to let to tenants.',
  },
  CETV: {
    plain: 'Defined-benefit transfer value',
    expl: 'The cash equivalent value a Defined Benefit pension scheme will pay if you transfer out. FCA-regulated advice required above £30,000.',
  },
  CGT: {
    plain: 'Capital-gains tax',
    expl: 'Tax on profits from selling investments, property (non-main-home), or other assets.',
  },
  CLT: {
    plain: 'Chargeable lifetime transfer',
    expl: 'A gift into a discretionary trust — immediately chargeable at 20% inheritance tax above the nil-rate band.',
  },
  GIA: {
    plain: 'General investment account',
    expl: 'A standard, unwrapped investment account. Gains attract CGT; dividends attract dividend tax.',
  },
  HICBC: {
    plain: 'Child-benefit charge',
    expl: 'Claws back child benefit at incomes above £60,000. Fully claws back at £80,000.',
  },
  IHT: {
    plain: 'Inheritance tax',
    expl: '40% tax on the value of your estate above the nil-rate bands when you die.',
  },
  ISA: {
    plain: 'Tax-free ISA',
    expl: 'Individual Savings Account — gains and income inside an ISA are tax-free. Annual contribution cap £20,000.',
  },
  LSA: {
    plain: 'Tax-free lump-sum allowance',
    expl: 'The total tax-free pension cash you can take across your lifetime — £268,275 (Pensions Schemes Act 2023).',
  },
  LSDBA: {
    plain: 'Death-benefit lump-sum allowance',
    expl: 'The total tax-free pension cash payable on death — £1,073,100 (Pensions Schemes Act 2023).',
  },
  MPAA: {
    plain: 'Reduced pension allowance after drawdown',
    expl: 'Money Purchase Annual Allowance — cuts your annual pension contribution limit to £10,000 once you start taking flexible income from a pension.',
  },
  NRB: {
    plain: 'Inheritance-tax allowance',
    expl: 'Nil-Rate Band — the first £325,000 of your estate that passes free of inheritance tax. Frozen until 2030.',
  },
  PA: {
    plain: 'Personal allowance',
    expl: 'The first £12,570 of income that is tax-free. Tapered to £0 between £100,000 and £125,140 of ANI.',
  },
  PET: {
    plain: 'Potentially exempt gift',
    expl: 'A gift to an individual that drops out of your estate if you survive 7 years (with taper from year 3).',
  },
  PPR: {
    plain: 'Main-home relief',
    expl: 'Principal Private Residence relief — your main home is exempt from capital-gains tax on sale.',
  },
  PSA: {
    plain: 'Tax-free savings allowance',
    expl: 'Personal Savings Allowance — £1,000 of bank interest tax-free for basic-rate, £500 for higher-rate, £0 for additional-rate taxpayers.',
  },
  RNRB: {
    plain: 'Family-home inheritance allowance',
    expl: 'Residence Nil-Rate Band — extra £175,000 of inheritance-tax allowance when leaving your main home to direct descendants. Tapers above £2m estates.',
  },
  SIPP: {
    plain: 'Self-invested personal pension',
    expl: 'A pension you control — choose your own investments, drawdown timing, and beneficiaries.',
  },
  s24: {
    plain: 'Landlord interest rule',
    expl: 'Section 24 — mortgage interest on rental properties is no longer fully deductible. Instead a 20% tax credit applies, costing higher-rate landlords.',
  },
})

// ── Component ───────────────────────────────────────────────────────────────
export default function Jargon({ term, children, variant = 'plain-first', style = {} }) {
  const [open, setOpen] = useState(false)
  const entry = JARGON[term]

  // Unknown term — fail soft, render the raw term unchanged.
  if (!entry) return <span style={style}>{children ?? term}</span>

  const handleHover = () => setOpen(true)
  const handleLeave = () => setOpen(false)
  const handleClick = (e) => {
    e.preventDefault()
    setOpen((v) => !v)
  }

  let primary
  let secondary
  if (variant === 'acronym-first') {
    primary = term
    secondary = entry.plain
  } else {
    // plain-first (default)
    primary = children ?? entry.plain
    secondary = term
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline', gap: 2, ...style }}
      onMouseEnter={handleHover}
      onMouseLeave={handleLeave}
    >
      <span>{primary}</span>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Definition of ${term}`}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 'none',
          padding: '0 2px',
          fontSize: 'inherit',
          color: 'var(--c-text3)',
          cursor: 'help',
          fontWeight: 600,
          opacity: 0.7,
        }}
      >
        ({secondary})
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 200,
            marginTop: 4,
            maxWidth: 280,
            padding: '8px 10px',
            background: 'var(--c-surface)',
            color: 'var(--c-text)',
            border: '1px solid var(--c-border)',
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.5,
            fontWeight: 500,
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
            whiteSpace: 'normal',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 2 }}>
            {term} — {entry.plain}
          </strong>
          {entry.expl}
        </span>
      )}
    </span>
  )
}

// Helper for plain-text contexts (Ask Sonu, exports) — returns the plain-
// English label or the term unchanged.
export function jargonPlain(term) {
  return JARGON[term]?.plain ?? term
}

// Helper to get a definition (for Ask Sonu responses, Reports footnotes).
export function jargonExplain(term) {
  return JARGON[term]?.expl ?? null
}
