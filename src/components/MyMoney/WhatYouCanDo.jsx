// ─────────────────────────────────────────────────────────────────────────────
// WhatYouCanDo — the action layer for an asset holding leaf.
//
// Founder 2026-06-01: "every screen has detail but none have information about
// what they can do about it." DebtLeaf got a "What you can do" block; the 25+
// asset holdings did not — so debts read as analysed and assets as inert detail
// (the "smoke and mirrors" complaint). This closes that asymmetry once, for
// every holding, by deriving FCA-safe options from the holding's own wrapper
// and facts.
//
// COMPLIANCE (sonuswealth-compliance): information & guidance only, never a
// regulated recommendation. No "you should buy/sell/transfer". No personal
// threshold figures are invented here — where a quantified answer is needed
// (e.g. "how much ISA room is left"), the what-if CTA routes the question to
// Ask Sonu rather than printing a possibly-wrong number. Qualitative rule
// references are phrased without quoting £ thresholds, so this file never
// hardcodes a UK figure (memory: always-check-rules-uk).
// ─────────────────────────────────────────────────────────────────────────────
import { BRAND } from '../../config/brand.js'

function gbp(v) {
  const n = Math.round(+v || 0)
  if (!n) return null
  return `£${Math.abs(n).toLocaleString('en-GB')}`
}

// Derive the options list for a holding. Pure — returns string[] ordered
// most-relevant-first. Empty → no block. Uses the holding's OWN captured facts
// (relief claimed, hold-period, embedded gain, 5% allowance used) wherever they
// exist, so the guidance is about THIS position, not generic — that is what
// makes a holding "analysed", not just described. Those are user facts, so
// quoting them is information, never a hardcoded rule. currentYear lets us turn
// a hold-period into a real clawback deadline.
export function deriveAssetOptions(asset, wrapper, { domain, currentYear } = {}) {
  const a = asset || {}
  const t = `${a.type || ''} ${a.name || ''} ${a.category || ''} ${domain || ''}`.toLowerCase().replace(/[_-]+/g, ' ')
  const isCrypto = /crypto|bitcoin|ethereum|\beth\b|\bbtc\b/.test(t)
  const isWine   = /wine|whisky|collectab|art\b/.test(t)
  const isLet    = /buy to let|btl|rental|let\b/.test(t)
  const out = []

  // Resolve PROPERTY / PENSION even when the row carries no explicit type
  // (the residence row has no `type`; getWrapper → UNKNOWN). Domain backstops it.
  let w = wrapper
  if (w === 'UNKNOWN' && /property|residence|home/.test(t)) w = 'PROPERTY'
  if (w === 'UNKNOWN' && /pension|sipp|ssas/.test(t)) w = 'PENSION'

  // Protection policies aren't a tax wrapper, but the founder's rule (#2) is
  // "every screen says what you can do". A policy's action is trust + adequacy.
  if (domain === 'protection' || /life|critical illness|income protection|insurance|cover|policy|relevant life|key person/.test(t)) {
    out.push('Writing life cover in trust keeps the payout outside your estate and gets it to your family faster, without waiting for probate — worth checking this policy is set up that way.')
    out.push('Cover is only right while it matches the need it protects. Ask Sonu whether this still covers your mortgage, dependants and income gap.')
    return out
  }

  // Relief-claimed schemes — use the holding's own relief £, purchase year and
  // hold-period to state the real clawback deadline.
  const reliefSchemes = { EIS: 3, SEIS: 3, VCT: 5 }
  if (w in reliefSchemes) {
    const relief = gbp(a.income_tax_relief_claimed)
    const hold = +a.minimum_hold_years || reliefSchemes[w]
    const bought = +a.year_purchased
    const clearYear = bought ? bought + hold : null
    const pct = w === 'SEIS' ? '50%' : '30%'
    if (relief) {
      out.push(`You claimed ${relief} of income tax relief here (${w}'s ${pct}). It is kept only if you hold for ${hold} years${clearYear ? ` — selling before ${clearYear} claws it back` : ''}.`)
    } else {
      out.push(`${w} carries ${pct} income tax relief, kept only if held ${hold} years${clearYear ? ` (until ${clearYear} on this holding)` : ''}; selling earlier can claw it back.`)
    }
    out.push(w === 'VCT'
      ? 'VCT dividends are tax-free and gains are free of CGT. The holding is unquoted and illiquid — treat the value as an estimate.'
      : 'Gains are free of CGT after the holding period, and loss relief can apply if the company fails. Information, not advice.')
  } else switch (w) {
    case 'ISA': {
      const added = gbp(a.contribution_current_tax_year)
      out.push('This sits inside an ISA, so its growth, interest and withdrawals are all tax-free — no CGT or income tax to manage on it.')
      out.push(added
        ? `You have added ${added} to ISAs this tax year. Ask Sonu how much of this year's allowance is left before it resets in April.`
        : 'Each tax year brings a fresh ISA allowance for new money. Ask Sonu how much room you have left before it resets in April.')
      break
    }
    case 'GIA': {
      const gain = gbp(a.embedded_gain)
      out.push(gain
        ? `Held in a general account with about ${gain} of embedded gain — the part above the annual CGT exemption is taxable when you sell.`
        : 'Held in a general account, so gains above the annual CGT exemption and dividends above the dividend allowance are taxable.')
      out.push('Realising gains gradually across tax years, or moving holdings into an ISA over time (“Bed & ISA”), is how people usually reduce that drag — general principle, not a recommendation.')
      break
    }
    case 'BOND_ON':
    case 'BOND_OFF': {
      const used = +a.withdrawal_5pct_used_pct
      out.push(Number.isFinite(used)
        ? `Bonds allow a 5%-of-premium tax-deferred withdrawal each year; you have used ${Math.round(used)}% of this year's. Beyond it, a chargeable-gain charge can apply, with top-slicing relief.`
        : 'Investment bonds let you withdraw up to 5% of the original premium each year with the tax deferred; larger withdrawals can trigger a chargeable-gain charge, where top-slicing relief may reduce the tax.')
      out.push('Model a withdrawal before you take it — ask Sonu what a given amount would do.')
      break
    }
    case 'PENSION':
    case 'STATE':
      out.push('Pension contributions attract tax relief at your marginal rate and the pot grows free of CGT — paying in is the most tax-efficient money you have.')
      out.push('From April 2027 unused pensions are expected to count toward inheritance tax, which changes the “spend last” logic. How you eventually draw it is a Cashflow decision.')
      break
    case 'PROPERTY':
      if (isLet) {
        out.push('A let property pays CGT at the residential rate on sale (currently higher than other assets), and mortgage interest only gets a 20% tax credit rather than full relief (Section 24).')
        out.push('Whether to hold, remortgage or sell is a real decision with tax consequences — ask Sonu to model a sale before you commit.')
      } else {
        out.push('Your main home is usually free of CGT through private residence relief, and the residence nil-rate band can pass more of it to direct descendants free of inheritance tax.')
      }
      break
    case 'TRUST':
      out.push('Assets placed in trust generally sit outside your estate for inheritance tax after the relevant period — keep the trust’s records and beneficiaries current.')
      break
    case 'CASH':
      out.push('Interest above your personal savings allowance is taxable, and over time inflation erodes cash in real terms. Ask Sonu how this balance compares to your essentials buffer.')
      break
    default:
      break
  }

  // Type-driven, independent of wrapper.
  if (isCrypto) {
    const cb = +a.cost_base, val = +(a.value ?? a.balance)
    const embedded = (cb && val && val > cb) ? gbp(val - cb) : null
    out.push(embedded
      ? `Crypto disposals are subject to CGT — about ${embedded} of gain is sitting here. Even swapping one coin for another, or spending it, counts as a disposal.`
      : 'Crypto disposals are subject to CGT, with gains pooled per coin. Even swapping one coin for another, or spending it, counts as a disposal.')
  }
  if (isWine) {
    out.push('Some collectables are treated as “wasting assets” and can be CGT-exempt, but they are illiquid and hard to value — treat the figure as an estimate, not a quote.')
  }
  if (/business|equity stake|\bltd\b|company shares|emi|share scheme/.test(t)) {
    out.push('Trading-company shares can qualify for Business Property Relief after two years, passing free of inheritance tax (the relief is capped from April 2026).')
  }

  return out
}

export default function WhatYouCanDo({ asset, wrapper, domain, currentYear }) {
  const year = currentYear || new Date().getFullYear()
  const options = deriveAssetOptions(asset, wrapper, { domain, currentYear: year })
  if (!options.length) return null

  const label = (asset?.name || asset?.type || 'this holding')
  const fireWhatIf = () => window.dispatchEvent(new CustomEvent('sonus:ask', {
    detail: {
      question: `What are my options with ${label}?`,
      context: {
        metric: 'assetWhatIf', domain, wrapper,
        name: asset?.name, type: asset?.type,
        value: asset?.value ?? asset?.balance, scope: 'mymoney',
      },
    },
  }))

  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
      }}>What you can do</div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((o, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--c-acc)', flexShrink: 0 }}>→</span>
            <span>{o}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={fireWhatIf}
        className="sw-press"
        style={{
          marginTop: 12, background: 'color-mix(in srgb, var(--c-acc) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--c-acc) 35%, transparent)',
          color: 'var(--c-acc)', borderRadius: 12, padding: '7px 14px',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >⚡ Explore this with Sonu</button>
      <p style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 14 }}>{BRAND.disclaimer}</p>
    </div>
  )
}
