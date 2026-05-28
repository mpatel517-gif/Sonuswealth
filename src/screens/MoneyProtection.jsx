// ─────────────────────────────────────────────────────────────────────────────
// MoneyProtection.jsx — full-page Protection & Insurance view
//
// Route: /money/protection (Dashboard tab id 'money/protection').
// Reached from MyMoney section-nav chip "Protection & Insurance".
//
// Architecture: ProtectionDrillDown already renders the full per-policy panel
// (Domain J/K/L) — cover summary, in-trust flag, life-cover gap, IHT exposure,
// claims context. It's wrapped in OverlayShell. For a "full page" experience
// inside the Dashboard tab area, OverlayShell behaves as a full-screen panel
// which is exactly what we want.
//
// We pass onBack so the chip in MyMoney can return to the Balance Sheet view.
// FCA boundary preserved by ProtectionDrillDown — information / guidance only.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import ProtectionDrillDown from '../components/MyMoney/ProtectionDrillDown.jsx'
import FinancesHeroCard from '../components/MyMoney/FinancesHeroCard.jsx'
import MoneyXDrawer from '../components/shared/MoneyXDrawer.jsx'
import { fmt } from '../engine/fq-calculator.js'
import { getMonthlyEssentials } from '../engine/_helpers.js'

// ── Cover / gap math — mirrors ProtectionDrillDown so the strip ties out ────
// to the drill-down panel below it. Lifted intentionally rather than imported
// because the drill computes these inline. If the drill is ever extracted
// into a hook, replace this block with the import.
function buildProtectionStats(entity) {
  const p = entity?.assets?.protection || {}
  const life = p.lifeInsurance || {}
  const ci = p.criticalIllness || {}
  const ip = p.incomeProtection || {}
  const pmi = p.pmi || {}
  const relevantLife = p.relevantLifePlan || {}

  const policies = [life, ci, ip, pmi, relevantLife].filter(x => x.exists).length
  const totalCover = (life.exists ? +life.amount || 0 : 0)
    + (relevantLife.exists ? +relevantLife.amount || 0 : 0)
  const premiumMonthly = [life, ci, ip, pmi, relevantLife]
    .reduce((s, x) => s + (x.exists ? +x.premium || 0 : 0), 0)

  // Cover need — same rule-of-thumb as the drill (10× income < age 50 else
  // mortgage + 3× annual essentials). FCA-bounded informational figure only.
  const indAge = +(entity?.individual?.age ?? entity?.age ?? 0) || 0
  const annualIncome = Math.max(
    +(entity?.income?.employment || 0),
    +(entity?.income?.salary || 0),
    +(entity?.gross_salary || 0),
  )
    + (+entity?.income?.dividends || 0)
    + (+entity?.income?.rentalIncome || 0)
    + (+entity?.income?.selfEmploymentNet || 0)
    + (+entity?.income?.directorSalary || 0)
  const monthlyEss = getMonthlyEssentials(entity).monthly || 0
  const liabsMortgage = +(entity?.liabilities?.mortgage?.outstanding || 0)
  const otherLoansArr = entity?.liabilities?.other_loans || entity?.liabilities?.otherLoans || []
  const otherLoansSum = Array.isArray(otherLoansArr)
    ? otherLoansArr.reduce((s, l) => s + +(l.outstanding || l.balance || 0), 0)
    : 0
  const remainingLiabilities = liabsMortgage + otherLoansSum
  const needCover = indAge > 0 && indAge < 50
    ? 10 * annualIncome
    : remainingLiabilities + 3 * (monthlyEss * 12)
  const coverGap = Math.max(0, needCover - totalCover)

  return { policies, totalCover, premiumMonthly, coverGap }
}

export default function MoneyProtection({ entity, personaId, onBack, onHome, onNav }) {
  const stats = useMemo(() => buildProtectionStats(entity), [entity])
  return (
    <>
      {/* Tab-aware finances strip (founder image-3, 2026-05-28). Surfaces
          Policies / Cover / Premiums / Gap so the user has the same chrome
          rhythm as Balance Sheet / Income Statement. CTA returns to MyMoney
          where AddItemSheet's Protection panel lives. */}
      <div style={{ padding: '12px 16px 0' }}>
        <MoneyXDrawer entity={entity} activeRoute="money/protection" onNav={onNav} />
        <FinancesHeroCard
          entity={entity}
          variant="protection"
          count={stats.policies}
          cover={stats.totalCover}
          premiums={`${fmt(stats.premiumMonthly)}/mo`}
          gap={stats.coverGap}
          gapRaw={stats.coverGap}
          onAddOrEdit={() => (onNav || onBack)?.('money')}
        />
      </div>
      <ProtectionDrillDown
        entity={entity}
        personaId={personaId}
        onBack={onBack}
        onHome={onHome}
      />
    </>
  )
}
