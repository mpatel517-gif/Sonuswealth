// ─────────────────────────────────────────────────────────────────────────────
// ProtectionDecisions — researched decision modeller for protection policies.
// (Life cover, critical illness, income protection, PMI.)
//
// UK rules researched 2026-06-01 and cross-checked against app-prototype/rules-uk.js
// + TAX bundle in fq-calculator.js. Status codes are from rules-uk.js _meta.
//
//   · Write in trust (IHTA 1984 + FA 1986 trust rules)
//     - Discretionary trust: payout NOT in estate → no IHT on sum assured.
//     - Without trust: payout falls into estate → up to 40% IHT on taxable portion.
//     - Premiums: annual gift exemption £3,000/yr (ENACTED, rules-uk.js iht section).
//       If premiums > £3,000/yr they are a PET → out of estate after 7 years.
//     - For relevant life plans: premiums are corp-tax deductible + trust is automatic.
//     - Source: Legal & General Discretionary Trust Guide 2026; IHTA 1984;
//       gov.uk/guidance/trusts-and-inheritance-tax (verified 2026-05-15).
//
//   · Top up to the gap
//     - Need estimate: annualIncome × 10 (under-50) or liabilities + 3y essentials (50+).
//       This is a rule-of-thumb from ProtectionDrillDown's existing formula — kept
//       consistent. coverGap passed from drill context via _coverGap.
//     - If coverGap = 0 and totalCover = 0, likely no income set — show empty state.
//     - Life payout: not income tax (ITTOIA 2005 s.553; lump sum from life assurance).
//     - CIC payout: not income tax (lump sum from personal policy). ITTOIA 2005.
//
//   · Review / deferred-period trade
//     - IP policies: longer deferred period → lower premium (trade-off to weigh).
//     - Review triggers: life events (marriage, child, mortgage, job change) or
//       policy age > 2–3 years.
//     - PMI: check medical history exclusions annually; group cover via employer
//       ends when you leave.
//     - IP benefit: tax-free if YOU pay the premium (ITEPA 2003).
//       Taxable as employment income if your EMPLOYER pays it.
//
// COMPLIANCE: information/guidance/storage only. FCA boundary live.
// No insurer named. No product recommended. Frame is "your figures + named rules".
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { TAX } from '../../engine/fq-calculator.js'
import { BRAND } from '../../config/brand.js'

function gbp(v) {
  const n = Math.round(+v || 0)
  return `${n < 0 ? '−' : ''}£${Math.abs(n).toLocaleString('en-GB')}`
}

function Row({ label, value, tone, strong }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'bad' ? 'var(--c-coral,#FF6F7D)' : tone === 'warn' ? '#FF9500' : 'var(--c-text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--c-sep)' }}>
      <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 850 : 700, color: fg, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Note({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.45 }}>{children}</div>
}

// ── Derive policy type from asset shape (passed from the drill setSelected) ──
function policyKind(asset) {
  const t = String(asset?.type || asset?.itemType || '').toLowerCase()
  if (t.includes('life') || t.includes('term') || t.includes('relevant')) return 'life'
  if (t.includes('critical') || t.includes('ci') || t.includes('cic')) return 'ci'
  if (t.includes('income') || t.includes('ip') || t.includes('protection')) return 'ip'
  if (t.includes('pmi') || t.includes('medical') || t.includes('health')) return 'pmi'
  // Fallback: if the asset has a monthlyBenefit field it's IP; otherwise life-type
  if (asset?.monthlyBenefit != null) return 'ip'
  if (asset?.amount != null) return 'life'
  return 'other'
}

export default function ProtectionDecisions({
  asset = {},
  annualIncome = 0,
  dependents = 0,
  totalCover = 0,
  coverGap = 0,
  onAddToPlan,
}) {
  // ── Resolved values ──────────────────────────────────────────────────────────
  const kind = policyKind(asset)
  const sumAssured = +(asset.amount ?? asset.value ?? asset.cover_amount ?? 0)
  const isInTrust  = asset.inTrust === true
  const deferredWeeks = +(asset.deferred_period_weeks ?? 0)
  const premium = +(asset.premium ?? 0)          // monthly

  // IHT thresholds from TAX bundle (populated from tax-2026.json via _bundle.js).
  // Fallback to rules-uk.js confirmed values (NRB £325k, rate 40%) if bundle
  // not yet loaded (e.g. unit test / SSR cold start).
  const nrb  = TAX?.nrb  ?? 325_000   // ENACTED — rules-uk.js iht.nil_rate_band
  const rnrb = TAX?.rnrb ?? 175_000   // ENACTED — rules-uk.js iht.residence_nil_rate_band
  const ihtRate = TAX?.ihtRate ?? 0.40  // 40% above nil-rate bands

  // Annual gift exemption — read from the live TAX bundle (IHTA 1984 s19 = £3,000)
  const annualGiftExempt = TAX?.annualGiftExemption ?? 3_000

  // IHT impact of the sum assured:
  // "If your estate is taxable" — payout at 40% IHT if NOT in trust.
  const ihtOnPayout    = Math.round(sumAssured * ihtRate)
  // Annual premium vs annual gift exemption threshold
  const annualPremium  = premium * 12
  const premiumInExempt = annualPremium <= annualGiftExempt

  // Cover gap display
  const hasGap = coverGap > 0
  const hasIncome = annualIncome > 0

  // Which decisions are relevant for this policy type
  // Every policy gets "write in trust" context (framed appropriately per kind).
  // "Top up" is relevant for life + CI; "Review" relevant for all.
  const decisions =
    kind === 'life' || kind === 'ci' || kind === 'relevant-life'
      ? ['trust', 'topup', 'review']
      : kind === 'ip'
        ? ['trust', 'deferred', 'review']
        : ['trust', 'review']          // pmi / other / keyperson / general

  const LABEL = {
    trust:    'Write in trust',
    topup:    'Top up to the gap',
    deferred: 'Deferred period',
    review:   'Review this policy',
  }

  const [pick, setPick] = useState(decisions[0])
  const active = decisions.includes(pick) ? pick : decisions[0]
  const [saved, setSaved] = useState(null)

  const fireAsk = (q) => window.dispatchEvent(new CustomEvent('sonus:ask', {
    detail: {
      question: q,
      context: {
        metric: 'protectionDecision',
        decision: active,
        name: asset.name,
        policyKind: kind,
        scope: 'mymoney',
      },
    },
  }))

  const addPlan = (label, summary) => {
    // Protection decisions do NOT move asset-category totals — the value is the
    // estate / IHT insight, not a balance sheet change. deltas: [].
    onAddToPlan?.({ kind: 'protection-decision', decision: active, label, summary, asset: asset.name, deltas: [] })
    setSaved(active)
  }

  // ── Per-decision model ────────────────────────────────────────────────────────
  let body = null, askQ = '', planLabel = '', planSummary = ''

  // ── 1. Write in trust ────────────────────────────────────────────────────────
  if (active === 'trust') {
    const policyLabel = asset.name || 'this policy'
    const relevantLifeNote = kind === 'relevant-life' || String(asset.type || '').includes('relevant')

    if (relevantLifeNote) {
      // Relevant life plans are ALWAYS held in a discretionary trust by their
      // structure — premiums are corp-tax deductible and the payout is already
      // outside the estate.
      askQ = `How does a relevant life plan sit outside my estate for IHT, and what happens to the cover if I leave the company?`
      planLabel = 'Review relevant life trust'
      planSummary = 'Relevant life — payout already outside estate in a discretionary trust'
      body = (<>
        <Row label="Trust status" value="Discretionary trust · in place" tone="good" />
        <Row label="Payout in your estate?" value="No — outside (IHTA 1984)" tone="good" />
        <Row label="Premiums deductible (corp tax)" value="Yes — company pays" tone="good" />
        <Row label={`IHT saved if estate is taxable`} value={sumAssured > 0 ? `~${gbp(ihtOnPayout)} (on ${gbp(sumAssured)})` : '—'} tone="good" strong />
        <Note>
          A relevant life plan is set up in a discretionary trust by design — the company pays the premium (corp-tax deductible),
          and the payout goes to beneficiaries outside your estate. No IHT on the sum assured if structured correctly.
          The cover ends when employment with this company ends — relevant if you ever sell or leave.
          Rules: IHTA 1984; HMRC employment income manual EIM15000. Status: ENACTED.
        </Note>
      </>)
    } else if (isInTrust) {
      askQ = `${policyLabel} is already in trust — what does that mean for IHT, and do I need to review the trustees or beneficiaries?`
      planLabel = 'Review trust beneficiaries'
      planSummary = `${policyLabel} in trust — payout outside estate; review trustees + beneficiaries`
      body = (<>
        <Row label="Trust status" value="In trust · outside estate" tone="good" />
        <Row label={`IHT saved (if estate is taxable)`} value={sumAssured > 0 ? `~${gbp(ihtOnPayout)}` : 'n/a — no sum assured'} tone="good" strong />
        <Row label="Annual premium vs gift exemption" value={annualPremium > 0 ? (premiumInExempt ? `${gbp(annualPremium)}/yr — within £${annualGiftExempt.toLocaleString()} exemption` : `${gbp(annualPremium)}/yr — exceeds exemption (7-yr PET)`) : '—'} tone={premiumInExempt ? 'good' : 'warn'} />
        <Row label="Probate" value="Payout bypasses probate — faster" tone="good" />
        <Note>
          This policy is already held in a discretionary trust, so the sum assured sits outside your estate for IHT —
          saving up to 40% of the payout for a taxable estate. The annual gift exemption (£{annualGiftExempt.toLocaleString()}/yr, ENACTED)
          usually covers the premiums with no IHT entry charge. Premiums above that are a potentially-exempt transfer (PET) —
          fully outside the estate after 7 years, tapering from year 3.
          {'\n\n'}Worth reviewing: are the trustees and beneficiaries still correct after any life events (marriage, divorce, new children)?
          Rules: IHTA 1984 s.11; FA 1986; gov.uk/guidance/trusts-and-inheritance-tax. Status: ENACTED.
        </Note>
      </>)
    } else {
      // NOT in trust — this is the high-value action
      askQ = `If I wrote ${policyLabel} into a discretionary trust, how much IHT would the payout avoid, and what does the process involve?`
      planLabel = 'Write policy in trust'
      planSummary = sumAssured > 0
        ? `Place ${gbp(sumAssured)} sum assured in trust → removes ~${gbp(ihtOnPayout)} IHT exposure`
        : `Place ${policyLabel} in trust → payout outside estate`
      body = (<>
        <Row label="Sum assured" value={sumAssured > 0 ? gbp(sumAssured) : '—'} />
        <Row label="Currently" value="In your estate · up to 40% IHT on payout" tone="warn" />
        <Row label={`IHT saved if placed in trust (if estate is taxable)`} value={sumAssured > 0 ? `~${gbp(ihtOnPayout)}` : 'set sum assured to size this'} tone="good" strong />
        <Row label="Annual premium vs gift exemption" value={annualPremium > 0 ? (premiumInExempt ? `${gbp(annualPremium)}/yr — within £${annualGiftExempt.toLocaleString()} exemption, no IHT entry charge` : `${gbp(annualPremium)}/yr — above exemption (7-yr PET on excess)`) : '—'} tone={annualPremium === 0 ? 'neutral' : premiumInExempt ? 'good' : 'warn'} />
        <Row label="Probate wait" value="Trust bypasses probate — beneficiaries paid faster" tone="good" />
        <Row label="NRB + RNRB bands" value={`£${nrb.toLocaleString()} NRB + £${rnrb.toLocaleString()} RNRB (ENACTED)`} />
        <Note>
          Without a trust, a life insurance payout falls into your estate and faces up to 40% IHT on any portion above your nil-rate bands
          (NRB £{nrb.toLocaleString()} + RNRB £{rnrb.toLocaleString()} where applicable).
          Writing the policy into a discretionary trust removes the sum assured from your estate for IHT — the most valuable single action
          for a taxable estate with dependants.{'\n\n'}
          The annual gift exemption (£{annualGiftExempt.toLocaleString()}/yr, ENACTED) typically covers the premiums at no IHT cost.
          Premiums above that threshold are a potentially-exempt transfer (PET) — outside the estate after 7 years (tapers from year 3).
          The policy itself (no surrender value) usually has negligible open-market value on entry, so the entry charge is nil.{'\n\n'}
          Rules: IHTA 1984; FA 1986; ITTOIA 2005 s.553 (life payout not income tax).
          Source: gov.uk/guidance/trusts-and-inheritance-tax; Legal &amp; General Discretionary Trust Guide 2026. Status: ENACTED.
          Verify with a qualified FCA-authorised adviser — trust structure depends on personal circumstances, beneficiaries, and scheme rules.
        </Note>
      </>)
    }
  }

  // ── 2. Top up to the gap (life / CI only) ────────────────────────────────────
  if (active === 'topup') {
    const coverLabel = kind === 'ci' ? 'Critical illness cover' : 'Life cover'
    const gapExists = hasGap && coverGap > 0
    const noData = !hasIncome && totalCover === 0

    askQ = `What is the gap between my ${coverLabel.toLowerCase()} and what my dependants and debts need, and what does a ${gbp(coverGap)} shortfall mean in practice?`
    planLabel = `Close the ${coverLabel.toLowerCase()} gap`
    planSummary = gapExists
      ? `Gap of ${gbp(coverGap)} between cover (${gbp(totalCover)}) and estimated need`
      : totalCover > 0 ? `Cover at or above estimated need` : 'Set income to size the gap'

    body = (<>
      {noData ? (
        <>
          <Row label="Annual income on file" value="Not set — add income to size the gap" tone="warn" />
          <Row label="Total life cover" value="Not set" tone="warn" />
          <Note>
            The gap calculation needs your annual income and existing cover.
            Add income in your financial profile and the gap will size automatically.
            Rule of thumb: life cover of 10× income (under 50) or outstanding mortgage + 3 years of essential spending (50+).
          </Note>
        </>
      ) : (
        <>
          <Row label="Annual income" value={gbp(annualIncome)} />
          <Row label={`Total ${coverLabel.toLowerCase()} in place`} value={totalCover > 0 ? gbp(totalCover) : 'None'} tone={totalCover === 0 ? 'bad' : 'neutral'} />
          <Row label="Estimated need (rule of thumb)" value={gbp(totalCover + coverGap)} />
          <Row label={hasGap ? 'Cover gap' : 'Cover vs estimated need'} value={hasGap ? gbp(coverGap) : 'At or above need'} tone={hasGap ? 'bad' : 'good'} strong />
          {dependents > 0 && <Row label="Dependants" value={`${dependents} on file`} />}
          <Note>
            {kind === 'ci'
              ? `Critical illness cover pays a lump sum on diagnosis of a specified condition — not a monthly benefit. It is not income tax (ITTOIA 2005). A gap of ${gbp(coverGap)} represents the shortfall between what's in place and the estimated need based on income and liabilities.`
              : `Life insurance pays a lump sum — not income tax (ITTOIA 2005 s.553). A gap of ${gbp(coverGap)} represents the shortfall between existing cover and an estimated need (10× income or liabilities + 3y essentials). The right level depends on dependants, debts, and how long income needs replacing — not a recommendation.`
            }
            {'\n\n'}
            This is a model of your figures using a rule-of-thumb formula — not an advice calculation. A qualified adviser can size
            cover accurately based on your full financial picture, mortgage terms, and beneficiary needs.
          </Note>
        </>
      )}
    </>)
  }

  // ── 3. Deferred period (IP only) ─────────────────────────────────────────────
  if (active === 'deferred') {
    const currentDeferred = deferredWeeks > 0 ? deferredWeeks : null
    // Indicative premium direction: longer deferred = lower cost (shown directionally only)
    const longerNote = currentDeferred != null && currentDeferred < 26
    const benefit = +(asset.monthlyBenefit ?? asset.amount ?? 0) / 12

    askQ = `What is the trade-off between a longer deferred period on my income protection and the premium saving — and how long can I realistically wait before the policy kicks in?`
    planLabel = 'Review IP deferred period'
    planSummary = currentDeferred != null
      ? `Current deferred period: ${currentDeferred} weeks — model a longer wait to cut the premium`
      : 'Set deferred period to model the trade-off'

    body = (<>
      <Row label="Monthly benefit" value={benefit > 0 ? `${gbp(benefit)}/mo` : '—'} />
      <Row label="Current deferred period" value={currentDeferred != null ? `${currentDeferred} weeks` : 'Not on file'} tone={currentDeferred == null ? 'warn' : 'neutral'} />
      <Row label="Benefit tax treatment" value="Tax-free (if you pay the premium)" tone="good" />
      <Row label="If employer pays" value="Taxable as employment income (ITEPA 2003)" tone="warn" />
      {longerNote && (
        <Row label="Premium direction" value="Longer deferred period → lower premium (indicative)" tone="good" />
      )}
      <Note>
        The deferred period is the time you wait before the policy pays out — typically 4, 8, 13, 26, or 52 weeks.
        A longer wait means lower premiums (you self-insure the gap); a shorter wait means higher cost but faster cover.
        The trade-off: how long could you cover expenses from savings or sick pay before needing the policy?{'\n\n'}
        Income protection benefit is tax-free if YOU pay the premium personally (ITEPA 2003).
        If your employer pays, the benefit is taxable as employment income.{'\n\n'}
        Policy wording matters: &ldquo;own occupation&rdquo; definitions pay if you can&apos;t do your specific job;
        &ldquo;any occupation&rdquo; definitions are much harder to trigger.
        Review the definition on your policy document before assuming what the cover does.
        Rules: ITEPA 2003; HMRC EIM06010. Status: ENACTED.
      </Note>
    </>)
  }

  // ── 4. Review ────────────────────────────────────────────────────────────────
  if (active === 'review') {
    const policyAge = asset.start_date
      ? Math.floor((Date.now() - new Date(String(asset.start_date)).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null
    const isStale = policyAge != null && policyAge > 2
    const pmiFocus = kind === 'pmi'

    askQ = pmiFocus
      ? `When should I review my PMI policy, and what exclusions should I check after any medical history changes?`
      : `What life events or policy ages should trigger a review of my protection cover, and what should I check?`
    planLabel = 'Schedule a protection review'
    planSummary = isStale
      ? `Policy is ${policyAge}+ years old — worth reviewing cover levels and trust status`
      : 'Flag for review after next life event'

    body = (<>
      {policyAge != null && (
        <Row
          label="Policy age"
          value={`${policyAge} year${policyAge !== 1 ? 's' : ''}`}
          tone={isStale ? 'warn' : 'good'}
        />
      )}
      {pmiFocus ? (<>
        <Row label="Cover type" value="Private medical — no sum assured" />
        <Row label="Group cover (employer)" value="Ends when you leave — check portability" tone="warn" />
        <Row label="Medical history exclusions" value="Review annually — new conditions may add exclusions" tone="warn" />
        <Note>
          PMI covers private diagnosis and treatment but typically excludes pre-existing conditions (check your moratorium or full
          medical underwriting basis). Group PMI via an employer is a P11D benefit-in-kind — taxable. Personal PMI premiums are not
          tax-deductible. Review the policy annually: exclusions added after a claim or medical history change can significantly reduce what the policy covers.
          Rules: ITEPA 2003 s.320 (private medical treatment exemption for employer-provided); HMRC EIM21820. Status: ENACTED.
        </Note>
      </>) : (<>
        <Row label="Review triggers" value="Life events · policy age · income change" />
        <Row label="Key life events" value="Marriage · child · mortgage · job change · divorce" tone="warn" />
        <Row label="Trust beneficiaries" value="Review after any relationship change" tone="warn" />
        {kind === 'ip' && (
          <Row label="Income change" value="Higher income may mean benefit is under-sized" tone="warn" />
        )}
        <Note>
          Protection policies are often set and forgotten. Review-worthy moments: getting married or divorced,
          having children, changing job (especially if employer provided previous cover), taking on a new mortgage,
          or when the policy is more than 2–3 years old.{'\n\n'}
          For policies in trust: check trustees and beneficiaries are still correct — a divorced ex-spouse remaining
          as a trustee or beneficiary is a common oversight.{'\n\n'}
          For life cover: confirm the sum assured still reflects outstanding mortgage + dependants&apos; needs.
          A policy taken out before a pay rise or second child may be significantly under-sized.
        </Note>
      </>)}
    </>)
  }

  return (
    <div>
      {/* Eyebrow */}
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
        Model a decision
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
        Model the tax and estate impact of this policy before you act. Nothing here changes your records.
      </div>

      {/* Chip selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {decisions.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => { setPick(d); setSaved(null) }}
            className="sw-press"
            style={{
              padding: '6px 12px', borderRadius: 100, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              border: `1px solid ${active === d ? 'color-mix(in srgb, var(--c-acc) 45%, transparent)' : 'var(--c-border)'}`,
              background: active === d ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)' : 'var(--c-surface2)',
              color: active === d ? 'var(--c-acc)' : 'var(--c-text2)',
            }}
          >
            {LABEL[d]}
          </button>
        ))}
      </div>

      {/* Body card */}
      <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '4px 14px 14px' }}>
        {body}

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fireAsk(askQ)}
            className="sw-press"
            style={{
              background: 'color-mix(in srgb, var(--c-acc) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--c-acc) 35%, transparent)',
              color: 'var(--c-acc)', borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⚡ Explore this with Sonu
          </button>
          <button
            type="button"
            onClick={() => addPlan(planLabel, planSummary)}
            className="sw-press"
            style={{
              background: saved === active ? 'color-mix(in srgb, var(--c-acc) 18%, transparent)' : 'var(--c-surface2)',
              border: '1px solid var(--c-border)',
              color: saved === active ? 'var(--c-acc)' : 'var(--c-text2)',
              borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {saved === active ? '✓ Added to your Plan' : '+ Add to plan'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 14 }}>
        {BRAND.disclaimer}
      </p>
    </div>
  )
}
