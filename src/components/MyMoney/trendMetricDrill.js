// ─────────────────────────────────────────────────────────────────────────────
// trendMetricDrill — provenance payload builder for the Balance-Sheet
// Net-Worth-Trend metric tiles (R13: every number drills to source).
//
// Founder 2026-06-01: the trend metric tiles (Plan funded, 1-year growth, Last
// month, Debt ratio, Time covered, Income buffer) + the 12-month sparkline
// "are not drillable — every item presented should explain and go to the nth
// degree to the source document with a way to add/modify information."
//
// Each metric here returns an L4NumberPanel payload that:
//   1. EXPLAINS — plain-English formula with the actual numbers (Section 2)
//   2. SOURCES  — names the user facts / rules that feed it + confidence (S3)
//   3. DRILLS   — recursive `breakdown` rows, each bottoming at a user fact
//                 or routing (via `actionsSpec`) to the category drill where
//                 that holding is genuinely add/modify-able (Section 4/5)
//   4. WHAT-IF  — the existing scenario question, surfaced as Section 6
//
// EVERYTHING is derived from the live primitives the tile already computes —
// no hardcoded numbers (R14). `fmt` is injected so currency formatting stays
// the engine's single canonical formatter.
//
// Honesty rule (founder's allergy to fake affordances): a breakdown leaf is
// marked `editable` ONLY when its dotted path provably exists in the effective
// entity (resolved + verified by the caller and passed in as `editable*`).
// Composite figures (net worth, total assets) are NOT inline-editable — you
// don't "edit net worth", you edit a holding — so they route to the category
// drill instead, where per-holding add/modify already lives.
// ─────────────────────────────────────────────────────────────────────────────

// Build the per-asset-category breakdown rows (read-only composition of a
// total). Each row drills one level to a tiny explain panel naming the source.
function assetRows(ctx) {
  const { fmt, catMap } = ctx
  const order = ['pensions', 'investments', 'property', 'business', 'cash', 'alternatives']
  return order
    .map((id) => {
      const c = catMap[id]
      const v = c ? +c.subtotal || 0 : 0
      if (!v) return null
      return {
        key: id,
        label: c.label || id,
        value: fmt(v),
        drill: {
          metric: c.label || id,
          value: fmt(v),
          formula: `Sum of the holdings you hold in ${(c.label || id).toLowerCase()}.`,
          source: 'Your captured holdings in this category. Open the category tile to add or correct an individual holding.',
          confidence: 'high',
        },
      }
    })
    .filter(Boolean)
}

// Net-worth breakdown: Assets − Liabilities, each side drillable.
function netWorthBreakdown(ctx) {
  const { fmt, totalAssets, totalLiabilities } = ctx
  return [
    {
      key: 'assets',
      label: 'Total assets',
      value: fmt(totalAssets),
      drill: {
        metric: 'Total assets',
        value: fmt(totalAssets),
        formula: 'The sum of every asset category you hold.',
        source: 'Your captured holdings across all asset categories.',
        confidence: 'high',
        breakdown: assetRows(ctx),
      },
    },
    {
      key: 'liabilities',
      label: 'Total liabilities',
      value: `−${fmt(totalLiabilities)}`,
      drill: {
        metric: 'Total liabilities',
        value: fmt(totalLiabilities),
        formula: 'The sum of every debt you owe — mortgage, loans, cards.',
        source: 'Your captured liabilities. Open the Liabilities drill to add or correct a debt.',
        confidence: 'high',
      },
    },
  ]
}

const ROUTE = {
  networth: { label: 'Open net-worth breakdown', target: 'networth' },
  liabilities: { label: 'Open liabilities', target: 'liabilities' },
  income: { label: 'See income & commitments', target: 'income' },
}

// Main builder. `key` ∈ plan | yoy | mom | debt | runway | cushion | trend.
export function buildTrendMetricDrill(key, ctx) {
  const {
    fmt,
    netWorth,
    totalAssets,
    totalLiabilities,
    planTarget,
    planPct,
    yoyDelta,
    yoyPct,
    nwYearAgo,
    momDelta,
    momPct,
    nwPrevMonth,
    debtRatio,
    yearsCovered,
    annualEssentials,
    prcPcc,
    editablePlanTarget,
    askQuestion,
  } = ctx

  const signed = (v) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}`

  switch (key) {
    case 'plan': {
      const targetRow = {
        key: 'target',
        label: 'Retirement target',
        value: planTarget != null ? fmt(planTarget) : '—',
        drill: {
          metric: 'Retirement target',
          value: planTarget != null ? fmt(planTarget) : '—',
          formula: 'The net worth you set as your retirement goal.',
          source: 'Your retirement plan.',
          confidence: 'high',
          ...(editablePlanTarget
            ? { editable: { path: editablePlanTarget.path, label: 'Retirement target', currentValue: editablePlanTarget.currentValue, isCurrency: true } }
            : {}),
        },
      }
      return {
        title: 'Plan funded',
        metric: 'Plan funded',
        value: planPct != null ? `${planPct.toFixed(0)}%` : '—',
        formula: planTarget
          ? `Net worth ${fmt(netWorth)} ÷ retirement target ${fmt(planTarget)} = ${planPct.toFixed(0)}% funded.`
          : 'Set a retirement target to see how funded you are.',
        source: 'Your net worth (from your holdings) ÷ the target on your retirement plan.',
        confidence: 'high',
        breakdown: [
          {
            key: 'nw',
            label: 'Net worth',
            value: fmt(netWorth),
            drill: {
              metric: 'Net worth',
              value: fmt(netWorth),
              formula: `Total assets ${fmt(totalAssets)} − total liabilities ${fmt(totalLiabilities)} = ${fmt(netWorth)}.`,
              source: 'Your captured holdings minus your debts.',
              confidence: 'high',
              breakdown: netWorthBreakdown(ctx),
            },
          },
          targetRow,
        ],
        whatIf: { available: true, hint: askQuestion },
        actionsSpec: [ROUTE.networth],
        askQuestion,
      }
    }

    case 'yoy': {
      return {
        title: '1-year growth',
        metric: '1-year growth',
        value: yoyDelta != null ? `${signed(yoyDelta)}${yoyPct != null ? ` (${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}%)` : ''}` : '—',
        formula: `Net worth now ${fmt(netWorth)} − net worth 12 months ago ${fmt(nwYearAgo || 0)} = ${signed(yoyDelta || 0)}.`,
        source: 'Your net-worth history — the monthly snapshots Sonus keeps as your holdings change.',
        confidence: 'medium',
        breakdown: [
          {
            key: 'now',
            label: 'Net worth now',
            value: fmt(netWorth),
            drill: {
              metric: 'Net worth now',
              value: fmt(netWorth),
              formula: `Total assets ${fmt(totalAssets)} − total liabilities ${fmt(totalLiabilities)}.`,
              source: 'Your captured holdings minus your debts.',
              confidence: 'high',
              breakdown: netWorthBreakdown(ctx),
            },
          },
          {
            key: 'yearAgo',
            label: '12 months ago',
            value: fmt(nwYearAgo || 0),
            drill: {
              metric: 'Net worth 12 months ago',
              value: fmt(nwYearAgo || 0),
              formula: 'The net worth snapshot from 12 months back in your history.',
              source: 'Your net-worth history. Snapshots are reconstructed from captured values, so older points are estimates.',
              confidence: 'medium',
            },
          },
        ],
        whatIf: { available: true, hint: askQuestion },
        actionsSpec: [ROUTE.networth],
        askQuestion,
      }
    }

    case 'mom': {
      return {
        title: 'Last month',
        metric: 'Last month',
        value: momDelta != null ? `${signed(momDelta)}${momPct != null ? ` (${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%)` : ''}` : '—',
        formula: `Net worth now ${fmt(netWorth)} − last month ${fmt(nwPrevMonth || 0)} = ${signed(momDelta || 0)}.`,
        source: 'Your net-worth history — this month vs last month.',
        confidence: 'medium',
        breakdown: [
          {
            key: 'now',
            label: 'Net worth now',
            value: fmt(netWorth),
            drill: {
              metric: 'Net worth now',
              value: fmt(netWorth),
              formula: `Total assets ${fmt(totalAssets)} − total liabilities ${fmt(totalLiabilities)}.`,
              source: 'Your captured holdings minus your debts.',
              confidence: 'high',
              breakdown: netWorthBreakdown(ctx),
            },
          },
          {
            key: 'lastMonth',
            label: 'Last month',
            value: fmt(nwPrevMonth || 0),
            drill: {
              metric: 'Net worth last month',
              value: fmt(nwPrevMonth || 0),
              formula: 'Last month’s net-worth snapshot.',
              source: 'Your net-worth history.',
              confidence: 'medium',
            },
          },
        ],
        whatIf: { available: true, hint: askQuestion },
        actionsSpec: [ROUTE.networth],
        askQuestion,
      }
    }

    case 'debt': {
      return {
        title: 'Debt ratio',
        metric: 'Debt ratio',
        value: debtRatio != null ? `${debtRatio.toFixed(0)}%` : '—',
        formula: `Total liabilities ${fmt(totalLiabilities)} ÷ total assets ${fmt(totalAssets)} = ${debtRatio.toFixed(0)}%.`,
        source: 'Your debts ÷ your assets. Below ~30% is generally comfortable; above ~50% is stretched.',
        confidence: 'high',
        breakdown: [
          {
            key: 'liabilities',
            label: 'Total liabilities',
            value: fmt(totalLiabilities),
            drill: {
              metric: 'Total liabilities',
              value: fmt(totalLiabilities),
              formula: 'The sum of every debt you owe.',
              source: 'Your captured liabilities. Open the Liabilities drill to add or correct a debt.',
              confidence: 'high',
            },
          },
          {
            key: 'assets',
            label: 'Total assets',
            value: fmt(totalAssets),
            drill: {
              metric: 'Total assets',
              value: fmt(totalAssets),
              formula: 'The sum of every asset category you hold.',
              source: 'Your captured holdings.',
              confidence: 'high',
              breakdown: assetRows(ctx),
            },
          },
        ],
        whatIf: { available: true, hint: askQuestion },
        actionsSpec: [ROUTE.liabilities],
        askQuestion,
      }
    }

    case 'runway': {
      const yrs = yearsCovered != null ? yearsCovered : null
      return {
        title: 'Time covered',
        metric: 'Time covered',
        value: yrs == null ? '—' : yrs >= 20 ? '20+ yr' : yrs >= 1 ? `${yrs.toFixed(1)} yr` : `${(yrs * 12).toFixed(0)} mo`,
        formula: `Net worth ${fmt(netWorth)} ÷ essential annual spending ${fmt(annualEssentials || 0)} = ${yrs != null ? yrs.toFixed(1) : '—'} years.`,
        source: 'Your net worth ÷ your essential annual spending. How long your wealth would last with no new income.',
        confidence: 'medium',
        breakdown: [
          {
            key: 'nw',
            label: 'Net worth',
            value: fmt(netWorth),
            drill: {
              metric: 'Net worth',
              value: fmt(netWorth),
              formula: `Total assets ${fmt(totalAssets)} − total liabilities ${fmt(totalLiabilities)}.`,
              source: 'Your captured holdings minus your debts.',
              confidence: 'high',
              breakdown: netWorthBreakdown(ctx),
            },
          },
          {
            key: 'essentials',
            label: 'Essential annual spend',
            value: fmt(annualEssentials || 0),
            drill: {
              metric: 'Essential annual spend',
              value: fmt(annualEssentials || 0),
              formula: 'Your essential monthly outgoings × 12.',
              source: 'Estimated from your captured spending. Update your spending in Cashflow to refine this.',
              confidence: 'medium',
            },
          },
        ],
        whatIf: { available: true, hint: askQuestion },
        actionsSpec: [ROUTE.networth],
        askQuestion,
      }
    }

    case 'cushion': {
      if (!prcPcc) return null
      return {
        title: 'Income buffer',
        metric: 'Income buffer',
        value: `${prcPcc.ratio.toFixed(1)}×`,
        formula: `Reliable income ${fmt(prcPcc.prc)} ÷ committed costs ${fmt(prcPcc.pcc)} = ${prcPcc.ratio.toFixed(1)}× cover (${prcPcc.band?.toLowerCase?.() || 'n/a'}).`,
        source: 'Your protected/regular income vs your committed outgoings. Above 1× means income covers commitments.',
        confidence: 'medium',
        breakdown: [
          {
            key: 'prc',
            label: 'Reliable income',
            value: fmt(prcPcc.prc),
            drill: {
              metric: 'Reliable income (PRC)',
              value: fmt(prcPcc.prc),
              formula: 'The income you can count on — salary, pension, protected sources.',
              source: 'Your captured income streams.',
              confidence: 'medium',
            },
          },
          {
            key: 'pcc',
            label: 'Committed costs',
            value: fmt(prcPcc.pcc),
            drill: {
              metric: 'Committed costs (PCC)',
              value: fmt(prcPcc.pcc),
              formula: 'Your unavoidable outgoings — debt service, essential bills, obligations.',
              source: 'Your captured outgoings and debt payments.',
              confidence: 'medium',
            },
          },
        ],
        whatIf: { available: true, hint: askQuestion },
        actionsSpec: [ROUTE.income],
        askQuestion,
      }
    }

    case 'trend': {
      const startV = nwYearAgo || 0
      const pct = startV > 0 ? ((netWorth - startV) / startV) * 100 : null
      return {
        title: 'Net worth trend',
        metric: 'Net worth trend',
        value: pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% over 12 mo` : fmt(netWorth),
        formula: `From ${fmt(startV)} twelve months ago to ${fmt(netWorth)} now — ${signed(netWorth - startV)}.`,
        source: 'Your net-worth history — the monthly snapshots plotted in the sparkline.',
        confidence: 'medium',
        breakdown: [
          {
            key: 'start',
            label: '12 months ago',
            value: fmt(startV),
            drill: {
              metric: 'Net worth 12 months ago',
              value: fmt(startV),
              formula: 'The earliest snapshot in the 12-month window.',
              source: 'Your net-worth history (older points are estimates).',
              confidence: 'medium',
            },
          },
          {
            key: 'end',
            label: 'Net worth now',
            value: fmt(netWorth),
            drill: {
              metric: 'Net worth now',
              value: fmt(netWorth),
              formula: `Total assets ${fmt(totalAssets)} − total liabilities ${fmt(totalLiabilities)}.`,
              source: 'Your captured holdings minus your debts.',
              confidence: 'high',
              breakdown: netWorthBreakdown(ctx),
            },
          },
        ],
        whatIf: { available: true, hint: 'How did my net worth move over this period?' },
        actionsSpec: [ROUTE.networth],
        askQuestion: 'How did my net worth move over this period?',
      }
    }

    default:
      return null
  }
}
