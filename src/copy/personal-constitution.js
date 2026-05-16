// ─────────────────────────────────────────────────────────────────────────────
// Personal Constitution — §13.2 magic.
//
// Captured once at onboarding (or via Settings). Five values rated low / medium
// / high. Every Priority Action and Decision Engine recommendation cites
// alignment against these values.
//
// Demo default (Bruce): legacy:high, liquidity:medium, risk:medium, family:high,
// experiences:medium. Real flow stores per entity in event store.
// ─────────────────────────────────────────────────────────────────────────────

export const CONSTITUTION_AXES = [
  { key: 'legacy',      label: 'Legacy importance',  hint: 'How much it matters that wealth passes to heirs' },
  { key: 'liquidity',   label: 'Liquidity preference', hint: 'How fast you want to be able to access money' },
  { key: 'risk',        label: 'Risk tolerance',     hint: 'How comfortable you are with potential losses' },
  { key: 'family',      label: 'Family priority',    hint: 'How much family security drives decisions' },
  { key: 'experiences', label: 'Experiences vs wealth', hint: 'Spending on life now vs growing the pot' },
]

export const DEFAULT_CONSTITUTION = {
  legacy:      'high',
  liquidity:   'medium',
  risk:        'medium',
  family:      'high',
  experiences: 'medium',
}

const TONE = { high: 3, medium: 2, low: 1, none: 0 }

// Heuristic: each action carries weights per axis. The alignment score is the
// weighted match between user constitution and the action's axes. Returns
// { score: 0..1, top: 'axis label aligned', conflict: 'axis label' | null }.
//
// Actions can either carry an explicit `alignment` map, or we infer from text:
// "estate" / "IHT" / "trust" → legacy; "ISA" / "cash" → liquidity;
// "drawdown" / "pension" → liquidity (low for pension)+risk;
// "gifting" → family; etc. Inference is shallow but visible.
export function scoreAlignment(action, constitution = DEFAULT_CONSTITUTION) {
  const a = action?.alignment || inferAxesFromAction(action)
  const axes = ['legacy', 'liquidity', 'risk', 'family', 'experiences']
  let aligned = 0, total = 0
  let topAxis = null, topScore = -1
  let worstAxis = null, worstScore = 999
  for (const ax of axes) {
    const userW = TONE[constitution[ax]] ?? 0
    const actionW = a[ax] || 0  // 0..3
    if (actionW === 0) continue
    const matchStrength = Math.min(userW, actionW)
    aligned += matchStrength
    total += Math.max(userW, actionW)
    if (matchStrength > topScore) { topScore = matchStrength; topAxis = ax }
    const conflict = Math.abs(userW - actionW)
    if (actionW > 0 && conflict > worstScore) { worstScore = conflict; worstAxis = ax }
  }
  return {
    score:    total ? aligned / total : 0,
    topAxis:  topAxis,
    topLabel: CONSTITUTION_AXES.find(x => x.key === topAxis)?.label,
  }
}

function inferAxesFromAction(action) {
  const text = `${action?.title || ''} ${action?.detail || ''}`.toLowerCase()
  const a = { legacy: 0, liquidity: 0, risk: 0, family: 0, experiences: 0 }
  if (/iht|estate|trust|legacy|inheritance/.test(text))    a.legacy += 3
  if (/isa|cash|liquidity|emergency/.test(text))            a.liquidity += 3
  if (/drawdown|pension|sipp/.test(text))                   { a.liquidity += 1; a.risk += 1 }
  if (/protect|insurance|life cover|illness/.test(text))   { a.family += 2; a.risk += 1 }
  if (/gift|child|guardian|spouse|family/.test(text))      a.family += 2
  if (/holiday|travel|experience/.test(text))               a.experiences += 2
  if (/btl|let|rental|property/.test(text))                 a.legacy += 1
  return a
}

const TONE_LABEL = { high: 'high', medium: 'medium', low: 'low' }
export function constitutionSummary(c = DEFAULT_CONSTITUTION) {
  return CONSTITUTION_AXES.map(x => `${x.label.toLowerCase()}: ${TONE_LABEL[c[x.key]] || 'unset'}`)
    .join(' · ')
}
