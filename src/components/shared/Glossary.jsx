/* ═══════════════════════════════════════════════════════════════════════════
   GLOSSARY — global tooltip layer for UK financial acronyms.
   Owned by FIX-20 (R12 acronym discipline).
   ─────────────────────────────────────────────────────────────────────────
   Use:
     import { Term } from '@/components/shared/Glossary.jsx'
     <Term code="EIS">EIS</Term>
     <Term>BPR</Term>            // looks up the literal child text

   Renders inline. Dotted underline + small ⓘ marker. Title attribute
   gives native browser tooltip on hover/long-press. Falls back to
   plain span when the code is not in the glossary so wrapping doesn't
   break unknown terms.

   When you add a term, keep the definition <= 200 chars: tooltip text
   gets clipped on small viewports. Lead with the expansion, then a one-
   line "why this matters" hook. Don't write advice — these are static
   reference definitions, not personalised guidance.
   ═══════════════════════════════════════════════════════════════════════ */

const GLOSSARY = {
  EIS:    'Enterprise Investment Scheme — UK tax-advantaged investment in early-stage companies; 30% income tax relief, IHT-exempt after 2 yrs (BPR).',
  VCT:    'Venture Capital Trust — UK tax-advantaged listed fund; 30% income tax relief, tax-free dividends, 5-yr min hold.',
  SEIS:   'Seed EIS — like EIS for very early-stage; 50% income tax relief, IHT-exempt after 2 yrs.',
  BPR:    'Business Property Relief — UK IHT relief; qualifying business assets exempt after 2 yrs held.',
  ANI:    'Adjusted Net Income — HMRC term used for Personal Allowance taper (£100k–£125,140) and Child Benefit charge.',
  GIA:    'General Investment Account — taxable brokerage wrapper; gains > AEA at 18%/24% CGT, dividends taxed as income.',
  SIPP:   'Self-Invested Personal Pension — UK pension wrapper; tax relief on contributions, tax-free growth, 25% tax-free lump sum.',
  MPAA:   'Money Purchase Annual Allowance — reduced pension contribution cap (£10k) once you flexibly access a pension.',
  NRB:    'Nil-Rate Band — £325k IHT-free threshold per person.',
  RNRB:   'Residence Nil-Rate Band — additional £175k IHT-free when passing main home to direct descendants.',
  ISA:    'Individual Savings Account — UK tax-free wrapper; £20k/yr allowance; gains and dividends tax-free.',
  BTL:    'Buy-to-Let — investment property generating rental income; subject to income tax + CGT on sale.',
  PCLS:   'Pension Commencement Lump Sum — the 25% tax-free element when accessing a pension (max £268,275).',
  UFPLS:  'Uncrystallised Funds Pension Lump Sum — pension withdrawal method; each withdrawal is 25% tax-free, 75% taxable.',
  TFC:    'Tax-Free Cash — the 25% of a pension you can take without income tax (= PCLS).',
  PoS:    'Probability of Success — likelihood your plan survives across simulated future paths.',
  APR:    'Agricultural Property Relief — UK IHT relief for qualifying farmland.',
  PET:    'Potentially Exempt Transfer — a lifetime gift that becomes IHT-exempt if you survive 7 years.',
  CLT:    'Chargeable Lifetime Transfer — typically gifts to trusts; immediate IHT charge above NRB.',
  IHT:    'Inheritance Tax — UK tax on estate value above NRB at death; 40% rate.',
  IHT400: 'IHT400 — the HMRC form for estates that owe IHT.',
}

export function Term({ children, code }) {
  const lookup = code || (typeof children === 'string' ? children.trim() : null)
  const def = lookup ? GLOSSARY[lookup] : null
  if (!def) return <span>{children}</span>
  return (
    <span className="glossary-term" title={def} tabIndex={0}>
      {children}
      <span className="glossary-marker" aria-hidden="true">ⓘ</span>
    </span>
  )
}

export default GLOSSARY
