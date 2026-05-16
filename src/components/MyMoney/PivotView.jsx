// ─────────────────────────────────────────────────────────────────────────────
// PivotView — non-balance-sheet pivots of the MyMoney entity.
//
// Founder direction 2026-05-12: "tree across all domains · Not only Income
// statement, BS, Insurance, Bonds everything. It was specced."
//
// MyMoney's primary view is Balance Sheet (TileGrid). This component renders
// the three alternative pivots that re-index the SAME entity data through
// different lenses:
//   · income    — Domain O income streams (employment/SE/rental/div/interest/pension)
//   · insurance — Domain J + K + L (life/health/income + general + business)
//   · bonds     — gilts + corporate bonds + investment bonds (Domain D + F)
//
// All three pivots are read-only summaries — drill into the Balance Sheet for
// edit/add actions.
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
}

function Tile({ label, value, sub, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'
  return (
    <div className="sw-card" style={{
      padding: 12, background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)', borderRadius: 14,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{sub}</div>}
    </div>
  )
}

function Chip({ children, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text2)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 100,
      background: `color-mix(in srgb, ${fg} 14%, transparent)`, color: fg,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
      border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
    }}>{children}</span>
  )
}

function Group({ title, sub, children }) {
  return (
    <div className="sw-card sw-cinema" style={{
      padding: 14, marginBottom: 12,
      background: 'var(--card-bg2)', border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg, 20px)', boxShadow: 'var(--sh)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>{sub}</div>
      )}
      {children}
    </div>
  )
}

function Hero({ eyebrow, hero, sub }) {
  return (
    <div className="sw-card sw-cinema" style={{
      padding: 18, marginBottom: 12,
      background: `linear-gradient(180deg, color-mix(in srgb, var(--c-acc) 12%, var(--card-bg2)), color-mix(in srgb, var(--c-acc) 3%, var(--card-bg2)))`,
      border: '1px solid color-mix(in srgb, var(--c-acc) 28%, transparent)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2), 0 0 24px color-mix(in srgb, var(--c-acc) 16%, transparent)',
    }}>
      <div className="sw-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>
      <div style={{
        fontSize: 'clamp(32px, 5vw, 44px)',
        fontWeight: 880, color: 'var(--c-text)',
        letterSpacing: -0.5, lineHeight: 1, marginTop: 4,
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 0 18px var(--c-radar-glow)',
      }}>{hero}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 8 }}>{sub}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INCOME PIVOT — Domain O
// ─────────────────────────────────────────────────────────────────────────────

function IncomeView({ entity }) {
  const income = entity.income || {}

  // Map entity.income to per-stream rows. Each row: source, annual, monthly,
  // taxability, dependency.
  const rows = []
  function add(label, annual, taxNote, tone = 'neutral') {
    if (!annual || annual <= 0) return
    rows.push({ label, annual: +annual, monthly: Math.round(+annual / 12), taxNote, tone })
  }
  add('Salary or director\'s pay',     income.employment || income.directorSalary, 'Taxed via PAYE plus National Insurance', 'neutral')
  add('Dividends from your company',   income.directorDividends || income.dividends, 'First £500 tax-free, then 10.75% / 35.75% / 41.35%', 'warn')
  add('Self-employed income',          income.selfEmploymentNet,                    'Income tax + Class 4 NI · digital records required above £50k', 'neutral')
  add('Rental income (after expenses)',income.rentalIncomeNet,                      'Taxed as income · only 20% rebate on mortgage interest', 'warn')
  add('State pension',                 income.statePension?.annual,                 'Taxed as income · paid gross', 'neutral')
  add('Final-salary pension',          income.dbPension,                            'Fixed monthly income · taxed via PAYE', 'neutral')
  add('Income from drawdown',          income.dcDrawdown,                           'Taxed as income · triggers reduced pay-in cap', 'warn')
  add('Bank or savings interest',      income.interest,                             `First £${income.psaLimit || 500}/yr tax-free`, 'neutral')
  add('Overseas income',               income.overseasIncome,                       'Treaty applies · arising or remittance basis', 'warn')
  add('Trust income',                  income.trustIncome,                          'Trustee deducts tax · 45% or 39.35% credit', 'neutral')

  const totalAnnual = rows.reduce((s, r) => s + r.annual, 0)
  const totalMonthly = Math.round(totalAnnual / 12)
  const ani = +income.ani || 0
  const marginal = +income.marginal_rate || 0

  return (
    <div>
      <Hero eyebrow="Money coming in"
        hero={`${fmt(totalMonthly)}/mo`}
        sub={`${fmt(totalAnnual)} a year · taxable income ${fmt(ani)} · marginal rate ${Math.round(marginal*100)}%`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Tile label="Total each year" value={fmt(totalAnnual)} tone="good" />
        <Tile label="Taxable income (HMRC)" value={fmt(ani)} sub="After pension and Gift Aid" />
        <Tile label="Marginal rate" value={`${Math.round(marginal*100)}%`} sub="What every extra £1 is taxed at" tone={marginal >= 0.45 ? 'bad' : marginal >= 0.40 ? 'warn' : 'neutral'} />
        <Tile label="Income sources" value={rows.length} sub="More sources = lower single-source risk" />
      </div>

      <Group title="Where your income comes from" sub="The order HMRC taxes things matters: salary first, then interest, then dividends. Each layer fills its rate band before the next.">
        {rows.length > 0 ? (
          <div style={{ background: 'var(--c-surface2)', borderRadius: 10, overflow: 'hidden' }}>
            {rows.map((r, i) => {
              const share = totalAnnual > 0 ? (r.annual / totalAnnual) * 100 : 0
              return (
                <div key={r.label} style={{
                  padding: '12px 14px',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--c-sep)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{r.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(r.monthly)}/mo
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 6 }}>
                    {r.taxNote} · {fmt(r.annual)} pa · {share.toFixed(0)}% of total
                  </div>
                  <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <div style={{ width: `${share}%`, height: '100%', background: 'var(--c-acc)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--c-text3)', fontStyle: 'italic' }}>
            No income captured yet.
          </div>
        )}
      </Group>

      {/* Income deep-dive — tax band breakdown. Shows what proportion of
          income hits each band so the user can SEE the marginal-rate cliff. */}
      {totalAnnual > 0 && (() => {
        const pa = Math.max(0, 12570 - Math.max(0, ani - 100000) / 2) // taper above £100k
        const basicTop = 50270
        const higherTop = 125140
        // Band amounts based on ANI (taxable income), not totalAnnual
        const inPA = Math.min(ani, pa)
        const inBasic = Math.max(0, Math.min(ani, basicTop) - pa)
        const inHigher = Math.max(0, Math.min(ani, higherTop) - basicTop)
        const inAdditional = Math.max(0, ani - higherTop)
        const sum = inPA + inBasic + inHigher + inAdditional || 1
        const bands = [
          { label: 'Tax-free', rate: '0%', amount: inPA, tone: 'good', sub: 'Personal allowance' },
          { label: 'Basic rate', rate: '20%', amount: inBasic, tone: 'neutral', sub: `up to £${basicTop.toLocaleString()}` },
          { label: 'Higher rate', rate: '40%', amount: inHigher, tone: 'warn', sub: `${pa < 12570 ? 'taper bites · ' : ''}up to £${higherTop.toLocaleString()}` },
          { label: 'Additional rate', rate: '45%', amount: inAdditional, tone: 'bad', sub: `above £${higherTop.toLocaleString()}` },
        ]
        return (
          <Group title="Where each pound of your income lands"
            sub="Tax stacks from the bottom up — your last £1 sits in your top band. That last £1 is what HMRC takes the most from.">
            <div style={{ background: 'var(--c-surface2)', borderRadius: 10, overflow: 'hidden' }}>
              {bands.map((b, i) => {
                const share = (b.amount / sum) * 100
                const tax = b.label === 'Tax-free' ? 0
                  : b.label === 'Basic rate' ? b.amount * 0.20
                  : b.label === 'Higher rate' ? b.amount * 0.40
                  : b.amount * 0.45
                const fg = b.tone === 'good' ? 'var(--c-acc)' : b.tone === 'warn' ? '#FF9500' : b.tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'
                return (
                  <div key={b.label} style={{
                    padding: '12px 14px',
                    borderBottom: i < bands.length - 1 ? '1px solid var(--c-sep)' : 'none',
                    opacity: b.amount > 0 ? 1 : 0.45,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
                          padding: '2px 8px', borderRadius: 100,
                          background: `color-mix(in srgb, ${fg} 14%, transparent)`,
                          color: fg, border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
                        }}>{b.rate}</span>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{b.label}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(b.amount)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 6 }}>
                      {b.sub}{tax > 0 ? ` · ${fmt(tax)} tax due` : ''}
                    </div>
                    <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                      <div style={{ width: `${share}%`, height: '100%', background: fg }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Group>
        )
      })()}

      <Group title="How much of your tax-free allowances you've used this year" sub="Every one of these resets on 6 April. Anything unused is lost.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          <Tile label="ISA shelter" value={`${Math.round((income.allowance_use?.isa || 0) * 100)}%`} tone={(income.allowance_use?.isa || 0) >= 0.5 ? 'good' : 'warn'} sub="of £20,000 cap" />
          <Tile label="Pension pay-in cap" value={`${Math.round((income.allowance_use?.pension_aa || 0) * 100)}%`} sub="of £60,000 cap" />
          <Tile label="Tax-free capital gains" value={`${Math.round((income.allowance_use?.cgt_aea || 0) * 100)}%`} sub="of £3,000 cap" />
          <Tile label="Tax-free dividends" value={`${Math.round((income.allowance_use?.dividend_allowance || 0) * 100)}%`} tone={(income.allowance_use?.dividend_allowance || 0) >= 1 ? 'bad' : 'neutral'} sub="of £500 cap" />
        </div>
      </Group>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INSURANCE PIVOT — Domain J + K + L
// ─────────────────────────────────────────────────────────────────────────────

function InsuranceView({ entity }) {
  const p = entity.assets?.protection || {}
  const generalInsurance = entity.general_insurance || entity.assets?.general_insurance || []
  const businessInsurance = entity.business_insurance || entity.assets?.business_insurance || []

  // Build a flat list grouped by purpose
  const groups = {
    'Life & death': [
      p.lifeInsurance?.exists && { label: 'Term life assurance', cover: p.lifeInsurance.amount, premium: p.lifeInsurance.premium, provider: p.lifeInsurance.provider, trust: p.lifeInsurance.inTrust, taxNote: p.lifeInsurance.inTrust ? 'In trust · outside estate' : 'In estate · IHT exposure' },
      p.relevantLifePlan?.exists && { label: 'Relevant life plan', cover: p.relevantLifePlan.amount, premium: p.relevantLifePlan.premium, provider: p.relevantLifePlan.provider, trust: true, taxNote: 'Corp tax deductible · outside estate' },
    ],
    'Health & illness': [
      p.criticalIllness?.exists && { label: 'Critical illness', cover: p.criticalIllness.amount, premium: p.criticalIllness.premium, provider: p.criticalIllness.provider, taxNote: 'Lump sum on diagnosis · tax-free' },
      p.pmi?.exists && { label: 'Private medical', cover: 0, premium: p.pmi.premium, provider: p.pmi.provider, taxNote: 'BIK if employer-paid' },
    ],
    'Income replacement': [
      p.incomeProtection?.exists && { label: 'Income protection', cover: (+p.incomeProtection.monthlyBenefit || 0) * 12, premium: p.incomeProtection.premium, provider: p.incomeProtection.provider, taxNote: `${Math.round((p.incomeProtection.cover_pct_of_salary || 0) * 100)}% of salary · ${p.incomeProtection.deferred_period_weeks || 0}w defer` },
    ],
    'Business protection': [
      p.keyPerson?.exists && { label: 'Keyperson cover', cover: p.keyPerson.amount, premium: p.keyPerson.premium, provider: p.keyPerson.provider, taxNote: 'Business asset' },
      p.shareholderProtection?.exists && { label: 'Shareholder protection', cover: p.shareholderProtection.amount, taxNote: 'Cross-option agreement' },
    ],
    'Home, car, travel and other general insurance': generalInsurance.map(g => ({
      label: (g.type || '').replace(/-/g, ' '), cover: g.cover_amount, premium: Math.round((+g.premium_annual || 0) / 12), provider: g.provider, taxNote: '—',
    })),
    'Cover required by your business': businessInsurance.map(b => ({
      label: (b.type || '').replace(/-/g, ' '), cover: b.cover_amount, premium: Math.round((+b.premium_annual || 0) / 12), provider: b.provider, taxNote: 'Allowable expense',
    })),
  }

  // Total annual premiums + total cover
  const allPolicies = Object.values(groups).flat().filter(Boolean)
  const totalMonthlyPremium = allPolicies.reduce((s, r) => s + (+r.premium || 0), 0)
  const totalAnnualPremium = totalMonthlyPremium * 12
  const totalLifeCover = (p.lifeInsurance?.exists ? +p.lifeInsurance.amount || 0 : 0) + (p.relevantLifePlan?.exists ? +p.relevantLifePlan.amount || 0 : 0)

  return (
    <div>
      <Hero eyebrow="What you're insured for"
        hero={fmt(totalLifeCover)}
        sub={`Life cover · ${fmt(totalAnnualPremium)} annual premium · ${allPolicies.length} policies`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Tile label="Total life cover" value={fmt(totalLifeCover)} tone="good" />
        <Tile label="Total premium" value={`${fmt(totalMonthlyPremium)}/mo`} sub={`${fmt(totalAnnualPremium)} pa`} />
        <Tile label="Active policies" value={allPolicies.length} />
        <Tile label="Pillars covered" value={`${[p.lifeInsurance?.exists, p.criticalIllness?.exists, p.incomeProtection?.exists, p.pmi?.exists].filter(Boolean).length}/4`} sub="Life · CI · IP · PMI" />
      </div>

      {/* Protection gap — per-pillar shortfall. Uses standard adviser
          benchmarks: life 10× gross income, CI 5× essentials, IP 60% of
          gross, PMI presence-only. Plain English so the user can act. */}
      {(() => {
        const grossIncome = +(entity?.income?.gross_annual)
          || +(entity?.income?.employment)
          || +(entity?.income?.directorSalary)
          || 0
        const essentials = +(entity?.expenses?.essential_annual)
          || (+(entity?.expenses?.essential_monthly) * 12)
          || (grossIncome * 0.55)
        const lifeNeed = grossIncome > 0 ? grossIncome * 10 : 0
        const lifeCover = totalLifeCover
        const lifeGap = Math.max(0, lifeNeed - lifeCover)
        const ciNeed = essentials * 5
        const ciCover = p.criticalIllness?.exists ? +p.criticalIllness.amount || 0 : 0
        const ciGap = Math.max(0, ciNeed - ciCover)
        const ipNeed = (grossIncome / 12) * 0.60
        const ipCover = p.incomeProtection?.exists
          ? +p.incomeProtection.monthlyBenefit || (+p.incomeProtection.cover_pct_of_salary || 0) * (grossIncome / 12)
          : 0
        const ipGap = Math.max(0, ipNeed - ipCover)
        const pillars = [
          {
            label: 'If you die',
            cover: lifeCover, need: lifeNeed, gap: lifeGap,
            line: lifeGap > 0
              ? `Family would be short ${fmt(lifeGap)} of the rough 10× income benchmark`
              : lifeNeed > 0 ? 'Cover meets the 10× income benchmark' : 'No income captured — needs review',
          },
          {
            label: 'If you get seriously ill',
            cover: ciCover, need: ciNeed, gap: ciGap,
            line: ciGap > 0
              ? `Lump-sum cover is ${fmt(ciGap)} short of 5× essential expenses`
              : ciNeed > 0 ? 'Cover meets the 5× essentials benchmark' : '—',
          },
          {
            label: 'If you can\'t work',
            cover: ipCover * 12, need: ipNeed * 12, gap: ipGap * 12,
            line: ipGap > 0
              ? `Monthly cover is ${fmt(ipGap)} short of replacing 60% of gross`
              : ipNeed > 0 ? 'Cover meets the 60%-replacement benchmark' : '—',
            isMonthly: true,
          },
          {
            label: 'If you fall ill non-urgently',
            cover: p.pmi?.exists ? 1 : 0, need: 1, gap: p.pmi?.exists ? 0 : 1,
            line: p.pmi?.exists ? 'Private medical cover in place' : 'No private medical cover — NHS waiting lists apply',
            presenceOnly: true,
          },
        ]
        return (
          <Group title="Protection gaps — where the cover doesn't quite stretch"
            sub="Benchmarks: life 10× gross income · critical illness 5× essential outgoings · income protection 60% of gross. These are guides, not gospel.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {pillars.map(pi => {
                const tone = pi.presenceOnly
                  ? (pi.gap > 0 ? 'bad' : 'good')
                  : (pi.need <= 0 ? 'neutral' : pi.gap === 0 ? 'good' : pi.gap > pi.need * 0.5 ? 'bad' : 'warn')
                const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text2)'
                return (
                  <div key={pi.label} style={{
                    padding: 12, borderRadius: 12,
                    background: 'var(--c-surface2)',
                    border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: fg, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>
                      {pi.label}
                    </div>
                    {!pi.presenceOnly && pi.need > 0 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(pi.cover)}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                            / {fmt(pi.need)} need{pi.isMonthly ? '/yr' : ''}
                          </span>
                        </div>
                        <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{
                            width: `${Math.min(100, (pi.cover / Math.max(pi.need, 1)) * 100)}%`,
                            height: '100%', background: fg,
                          }} />
                        </div>
                      </>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.4 }}>
                      {pi.line}
                    </div>
                  </div>
                )
              })}
            </div>
          </Group>
        )
      })()}

      {Object.entries(groups).map(([groupTitle, items]) => {
        const list = items.filter(Boolean)
        if (list.length === 0) return null
        return (
          <Group key={groupTitle} title={groupTitle}>
            <div style={{ background: 'var(--c-surface2)', borderRadius: 10, overflow: 'hidden' }}>
              {list.map((it, i) => (
                <div key={i} style={{
                  padding: '11px 14px',
                  borderBottom: i < list.length - 1 ? '1px solid var(--c-sep)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{it.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                      {it.provider || 'Provider n/a'} · {it.taxNote}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {it.trust === true && <Chip tone="good">In trust</Chip>}
                      {it.trust === false && <Chip tone="warn">Not in trust</Chip>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {(+it.cover || 0) > 0 && (
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(it.cover)}
                      </div>
                    )}
                    {(+it.premium || 0) > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                        £{Math.round(+it.premium)}/mo
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Group>
        )
      })}

      {allPolicies.length === 0 && (
        <Group title="No policies captured" sub="Capture cover via the Protection tile on the Balance Sheet view.">
          <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>—</div>
        </Group>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BONDS PIVOT — gilts + corporate bonds + investment bonds
// ─────────────────────────────────────────────────────────────────────────────

function BondsView({ entity }) {
  const investments = entity.assets?.investments || []

  function classifyBond(it) {
    const t = (it.type || '').toLowerCase()
    if (t === 'bond_on' || t === 'onshore-bond') return 'Investment bond — onshore'
    if (t === 'bond_off' || t === 'offshore-bond') return 'Investment bond — offshore'
    if (t === 'gilt' || t === 'uk-gilt') return 'UK gilt'
    if (t === 'corporate-bond-ig') return 'Corporate bond — IG'
    if (t === 'corporate-bond-hy') return 'Corporate bond — HY'
    if (t === 'etf-bond' || t === 'bond-etf') return 'Bond ETF'
    return null
  }

  const bondItems = investments
    .map(it => ({ ...it, _bondCat: classifyBond(it) }))
    .filter(it => it._bondCat != null)

  const byCat = bondItems.reduce((acc, it) => {
    acc[it._bondCat] = acc[it._bondCat] || []
    acc[it._bondCat].push(it)
    return acc
  }, {})

  const total = bondItems.reduce((s, it) => s + (+it.value || +it.balance || 0), 0)
  const investmentBondsTotal = bondItems
    .filter(it => it._bondCat.startsWith('Investment bond'))
    .reduce((s, it) => s + (+it.value || +it.balance || 0), 0)

  // Income next 12 months — coupon × principal for each bond. Falls back to
  // 0 when coupon_rate / yield is not captured (typical for ETF wrappers).
  const annualIncome = bondItems.reduce((s, it) => {
    const rate = +it.coupon_rate || +it.yield || 0
    const val = +it.value || +it.balance || 0
    return s + (rate * val)
  }, 0)

  // Maturity ladder — buckets by years-to-maturity.
  const today = new Date()
  const ladderBuckets = [
    { label: '< 1 yr', max: 1, items: [], tone: 'warn' },
    { label: '1–3 yr', max: 3, items: [], tone: 'neutral' },
    { label: '3–7 yr', max: 7, items: [], tone: 'neutral' },
    { label: '7–15 yr', max: 15, items: [], tone: 'good' },
    { label: '> 15 yr', max: Infinity, items: [], tone: 'good' },
  ]
  for (const it of bondItems) {
    if (!it.maturity_date) continue
    const m = new Date(it.maturity_date)
    if (isNaN(m.getTime())) continue
    const years = (m - today) / (1000 * 60 * 60 * 24 * 365.25)
    const bucket = ladderBuckets.find(b => years < b.max)
    bucket?.items.push({ ...it, _years: years })
  }
  const datedTotal = ladderBuckets.reduce((s, b) => s + b.items.reduce((ss, it) => ss + (+it.value || +it.balance || 0), 0), 0)

  return (
    <div>
      <Hero eyebrow="Bonds — gilts, corporate, and investment bonds"
        hero={fmt(total)}
        sub={`${bondItems.length} holdings · ${fmt(investmentBondsTotal)} in investment bonds (taxed when withdrawn) · split between gilts, corporates and bonds below`} />

      {/* Bonds depth — income + maturity ladder. */}
      {bondItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
          <Tile label="Income next 12 months" value={fmt(annualIncome)} sub={annualIncome > 0 ? 'Based on captured coupons / yields' : 'No coupon data captured'} tone={annualIncome > 0 ? 'good' : 'neutral'} />
          <Tile label="Holdings" value={bondItems.length} sub={`Across ${Object.keys(byCat).length} bond types`} />
          <Tile label="Investment bonds" value={fmt(investmentBondsTotal)} sub="Taxed only when you take money out" />
          <Tile label="Avg yield" value={total > 0 && annualIncome > 0 ? `${((annualIncome / total) * 100).toFixed(2)}%` : '—'} sub="Income ÷ market value" tone={total > 0 && (annualIncome / total) > 0.04 ? 'good' : 'neutral'} />
        </div>
      )}

      {/* Maturity ladder — only when at least one bond has a maturity_date. */}
      {datedTotal > 0 && (
        <Group title="When the bonds come due"
          sub="Concentrated short-dated holdings get reinvested at the prevailing yield — duration risk shifts onto you. A laddered profile smooths that out.">
          <div style={{ background: 'var(--c-surface2)', borderRadius: 10, padding: 12 }}>
            {ladderBuckets.map((b, i) => {
              const subtotal = b.items.reduce((s, it) => s + (+it.value || +it.balance || 0), 0)
              const share = datedTotal > 0 ? (subtotal / datedTotal) * 100 : 0
              const fg = b.tone === 'good' ? 'var(--c-acc)' : b.tone === 'warn' ? '#FF9500' : 'var(--c-text)'
              return (
                <div key={b.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0',
                  borderBottom: i < ladderBuckets.length - 1 ? '1px solid color-mix(in srgb, var(--c-sep) 50%, transparent)' : 'none',
                  opacity: subtotal > 0 ? 1 : 0.4,
                }}>
                  <div style={{ width: 70, fontSize: 11, fontWeight: 700, color: 'var(--c-text2)' }}>{b.label}</div>
                  <div style={{ flex: 1, height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ width: `${share}%`, height: '100%', background: fg, transition: 'width .4s ease' }} />
                  </div>
                  <div style={{ width: 110, textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(subtotal)}</span>
                    <span style={{ fontSize: 10, color: 'var(--c-text3)', marginLeft: 6 }}>{share.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Group>
      )}

      {bondItems.length === 0 ? (
        <Group title="No bond holdings captured yet"
          sub="Covers government bonds (gilts), company bonds, and investment bonds. Add them via the Savings & Investments tile.">
          <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>—</div>
        </Group>
      ) : (
        Object.entries(byCat).map(([cat, items]) => {
          const isInvBond = cat.startsWith('Investment bond')
          const isGilt = cat === 'UK gilt'
          const subtotal = items.reduce((s, it) => s + (+it.value || +it.balance || 0), 0)
          return (
            <Group key={cat} title={cat} sub={
              isGilt ? 'Coupon = income tax (above PSA). CGT-exempt on disposal.'
              : isInvBond ? '5% cumulative withdrawal allowance per policy year. Excess = chargeable event gain (top-slicing available).'
              : 'Interest = income tax (above PSA). Disposal = CGT (not CGT-exempt unlike gilts).'
            }>
              <div style={{ marginBottom: 8 }}>
                <Chip tone={isGilt ? 'good' : isInvBond ? 'neutral' : 'warn'}>
                  {isGilt ? 'CGT-exempt' : isInvBond ? 'Chargeable event regime' : 'CGT on disposal'}
                </Chip>
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>
                  {fmt(subtotal)} total
                </span>
              </div>
              <div style={{ background: 'var(--c-surface2)', borderRadius: 10, overflow: 'hidden' }}>
                {items.map((it, i) => (
                  <div key={it.id || i} style={{
                    padding: '11px 14px',
                    borderBottom: i < items.length - 1 ? '1px solid var(--c-sep)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{it.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                        {it.provider}
                        {isInvBond && it.withdrawal_5pct_used_pct != null && ` · ${Math.round(it.withdrawal_5pct_used_pct * 100)}% of 5% used`}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(it.value || it.balance)}
                    </div>
                  </div>
                ))}
              </div>
            </Group>
          )
        })
      )}

      <Group title="Not captured yet" sub="Other fixed-income instruments in the canonical taxonomy:">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['UK gilt — short', 'UK gilt — long', 'Index-linked gilt', 'Corporate bond — IG', 'Corporate bond — HY', 'Bond ETF', 'With-profits bond', 'Endowment / MIP', 'Loan notes / debentures', 'QCB', 'NS&I Index-linked'].map(t => (
            <span key={t} style={{
              padding: '6px 12px', borderRadius: 100,
              background: 'var(--c-surface2)', border: '1px dashed var(--c-border)',
              color: 'var(--c-text3)', fontSize: 11, fontWeight: 600,
            }}>+ {t}</span>
          ))}
        </div>
      </Group>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle bar + dispatcher
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CASHFLOW PIVOT — monthly income vs spending, surplus/deficit visualisation
// ─────────────────────────────────────────────────────────────────────────────

function CashflowView({ entity }) {
  const income = entity?.income || {}
  const expenses = entity?.expenses || {}

  // Income streams
  const incomeRows = [
    { label: 'Salary / director pay',    monthly: Math.round((+income.employment || +income.directorSalary || 0) / 12), type: 'income' },
    { label: 'Dividends',                monthly: Math.round((+income.directorDividends || +income.dividends || 0) / 12), type: 'income' },
    { label: 'Rental (net)',             monthly: Math.round((+income.rentalIncomeNet || 0) / 12), type: 'income' },
    { label: 'State pension',            monthly: Math.round((+income.statePension?.annual || 0) / 12), type: 'income' },
    { label: 'Bank interest',            monthly: Math.round((+income.interest || 0) / 12), type: 'income' },
    { label: 'Other income',             monthly: Math.round((+income.selfEmploymentNet || +income.overseasIncome || 0) / 12), type: 'income' },
  ].filter(r => r.monthly > 0)

  const totalMonthlyIncome = incomeRows.reduce((s, r) => s + r.monthly, 0)

  // Spending streams
  const spendRows = [
    { label: 'Essential spending',       monthly: +expenses.essential_monthly || Math.round((totalMonthlyIncome * 0.55)), type: 'spend' },
    { label: 'Mortgage / rent',          monthly: +expenses.housing_monthly || 0, type: 'spend' },
    { label: 'Debt repayments',          monthly: (() => {
      // H-09: exclude mortgage payment if Mortgage/rent row already shows it from expenses
      const mortAlreadyShown = (+expenses.housing_monthly || 0) > 0
      const mort = mortAlreadyShown ? 0 : (entity?.liabilities?.mortgage?.monthlyPayment || 0)
      const loans = (entity?.liabilities?.otherLoans || []).reduce((s, l) => s + (+l.monthlyPayment || 0), 0)
      return mort + loans
    })(), type: 'spend' },
    { label: 'Family commitments',       monthly: Math.round((entity?.family_obligations || []).reduce((s, o) => s + (+o.annual_cost || 0), 0) / 12), type: 'spend' },
    { label: 'Pension contributions',    monthly: Math.round((+income.pensionContribution || 0) / 12), type: 'spend' },
  ].filter(r => r.monthly > 0)

  const totalMonthlySpend = spendRows.reduce((s, r) => s + r.monthly, 0)
  const surplus = totalMonthlyIncome - totalMonthlySpend
  const pos = surplus >= 0

  const COLORS = ['var(--c-acc)', '#7AA7FF', '#2DF2C3', '#FFB347', '#C58CFF', '#FF598C']
  const SPEND_COLORS = ['rgba(255,255,255,0.2)', '#FF9F0A', 'var(--c-coral, #FF6F7D)', '#FFB347', '#7AA7FF']

  const barMax = Math.max(totalMonthlyIncome, totalMonthlySpend, 1)

  return (
    <div>
      <Hero
        eyebrow="Cash flow"
        hero={`${pos ? '+' : '−'}${fmt(Math.abs(surplus))}/mo`}
        sub={pos
          ? `Income exceeds outgoings by ${fmt(surplus)}/mo — that's ${fmt(surplus * 12)}/yr to save or invest`
          : `Spending exceeds income by ${fmt(Math.abs(surplus))}/mo — review the breakdown below`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Tile label="Monthly income" value={fmt(totalMonthlyIncome)} tone="good" sub={`£${Math.round(totalMonthlyIncome * 12 / 1000)}k/yr`} />
        <Tile label="Monthly outgoings" value={fmt(totalMonthlySpend)} tone={pos ? 'neutral' : 'bad'} sub={`£${Math.round(totalMonthlySpend * 12 / 1000)}k/yr`} />
      </div>

      {/* Income breakdown */}
      <Group title="Where your income comes from" sub="Monthly equivalent of all income sources">
        {incomeRows.map((r, i) => {
          const barW = (r.monthly / barMax) * 100
          return (
            <div key={r.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--c-text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                  {r.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(r.monthly)}/mo
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                <div style={{ width: `${barW}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 100 }} />
              </div>
            </div>
          )
        })}
        {incomeRows.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--c-text3)', fontStyle: 'italic' }}>
            No income sources captured yet. Add income on the Balance Sheet to see your cash flow.
          </div>
        )}
      </Group>

      {/* Spending breakdown */}
      <Group title="Where the money goes" sub="Monthly outgoings by category">
        {spendRows.map((r, i) => {
          const barW = (r.monthly / barMax) * 100
          return (
            <div key={r.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--c-text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: SPEND_COLORS[i % SPEND_COLORS.length], display: 'inline-block' }} />
                  {r.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(r.monthly)}/mo
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                <div style={{ width: `${barW}%`, height: '100%', background: SPEND_COLORS[i % SPEND_COLORS.length], borderRadius: 100 }} />
              </div>
            </div>
          )
        })}
        {spendRows.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--c-text3)', fontStyle: 'italic' }}>
            No spending data captured yet. Add expenses to see where the money goes.
          </div>
        )}
      </Group>

      {/* Insight */}
      <Group title="What this means for you" sub="">
        <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.6 }}>
          {pos
            ? `Your ${fmt(surplus)}/mo surplus is ${fmt(surplus * 12)}/yr you can redirect to wealth-building. Priority order: (1) top up your ISA — £20k/yr tax-free growth, (2) pension contributions — 40–47% tax relief at your rate, (3) overpay debt if mortgage rate > expected investment returns.`
            : `You're spending ${fmt(Math.abs(surplus))}/mo more than you earn. This won't show up immediately, but it compounds: after 12 months that's ${fmt(Math.abs(surplus) * 12)} of drawn-down savings or new debt. Review the spending categories above and identify the biggest item to cut.`}
        </div>
      </Group>
    </div>
  )
}

export function PivotToggle({ pivot, onPivot }) {
  const opts = [
    { id: 'balance-sheet', label: 'Balance sheet' },
    { id: 'income',        label: 'Income' },
    { id: 'cashflow',      label: 'Cash flow' },
    { id: 'insurance',     label: 'Insurance' },
    { id: 'bonds',         label: 'Bonds' },
  ]
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      background: 'var(--c-surface2)',
      border: '1px solid var(--c-border)',
      borderRadius: 100,
      marginBottom: 12,
      width: 'fit-content',
      maxWidth: '100%',
      overflowX: 'auto',
      flexWrap: 'nowrap',
    }}>
      {opts.map(o => {
        const active = pivot === o.id
        return (
          <button key={o.id} onClick={() => onPivot(o.id)}
            className={active ? 'sw-pill-active' : 'sw-press'}
            style={{
              padding: '7px 16px', borderRadius: 100,
              border: active
                ? '1px solid color-mix(in srgb, var(--c-acc) 45%, transparent)'
                : '1px solid transparent',
              background: active
                ? 'linear-gradient(180deg, color-mix(in srgb, var(--c-acc) 24%, transparent), color-mix(in srgb, var(--c-acc) 8%, transparent))'
                : 'transparent',
              color: active ? 'var(--c-acc)' : 'var(--c-text2)',
              fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: active
                ? '0 0 14px color-mix(in srgb, var(--c-acc) 35%, transparent), inset 0 1px 0 color-mix(in srgb, var(--c-acc) 24%, transparent)'
                : 'none',
              transform: active ? 'scale(1.04)' : 'scale(1)',
              transformOrigin: 'center',
              transition: 'transform 0.22s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)), background 0.18s ease-out, color 0.18s ease-out',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function PivotView({ pivot, entity }) {
  if (pivot === 'income')    return <IncomeView entity={entity} />
  if (pivot === 'cashflow')  return <CashflowView entity={entity} />
  if (pivot === 'insurance') return <InsuranceView entity={entity} />
  if (pivot === 'bonds')     return <BondsView entity={entity} />
  return null
}
