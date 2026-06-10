// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — GLOSSARY / EXPLAINERS
//
// The DEFINITIONAL layer. Ask Sonu's "plays" are action patterns and assume the
// user already knows the term; its classifier returns `off_ontology` for a bare
// "what is an annuity?" unless the LLM proxy is up. This map gives every common
// UK money term a deterministic, plain-English answer — no LLM, no API key — and
// deep-links from "understand it" → "decide on it" (a play / decision query).
//
// Coverage gap #1 in SCENARIO-COVERAGE-MAP.md (founder's exact annuity complaint,
// 2026-06-10). Fixes the whole CLASS of "what is X?" questions, not just annuities.
//
// FCA: information / guidance / storage only — definitions, never "you should".
// No hardcoded £/% (they go stale + the accuracy-auditor blocks them); where a
// figure matters, the definition points to the live in-app number.
// ─────────────────────────────────────────────────────────────────────────────

const FCA_LINE = 'Information to help you understand the term — not personal advice. Confirm decisions with a qualified, FCA-authorised adviser before acting.'

// Each entry: term · aliases (lowercase) · short (one line) · how (2-3 lines) ·
// variants? (bullets) · watch? (one caution) · links[] (follow-up queries that
// the existing play/decision engine answers — moves the user from learn → decide).
const E = (o) => ({ fca: FCA_LINE, variants: [], watch: null, links: [], ...o })

export const EXPLAINERS = {
  annuity: E({
    term: 'Annuity',
    aliases: ['annuity', 'annuities', 'lifetime annuity', 'guaranteed income'],
    short: 'An annuity is a guaranteed income — usually for life — that you buy with a pension pot.',
    how: 'You hand some or all of a pension pot to an insurer; in return they pay you a set income, typically until you die. It is normally irreversible once bought, and the income is taxed as earnings through PAYE — the same as a salary. It is the secure, no-decisions opposite of drawdown.',
    variants: [
      'Level vs escalating — a flat income, or one that rises (with inflation or a fixed %) to protect your buying power later.',
      'Single vs joint life — stops on your death, or continues to a spouse/partner.',
      'Guarantee period — keeps paying for a set number of years even if you die early.',
      'Enhanced / impaired — a higher income if a health or lifestyle condition shortens life expectancy.',
    ],
    watch: 'An NHS or other defined-benefit pension is effectively an annuity already — a guaranteed income for life — so you may have more secure income than you think before buying another.',
    links: [
      { label: 'Should I buy a guaranteed income now, or wait?', q: 'Should I buy an annuity now or stay in drawdown?' },
      { label: 'Most tax-efficient way to take my pensions', q: 'What is the most tax-efficient way to withdraw my pensions?' },
    ],
  }),
  drawdown: E({
    term: 'Drawdown (flexi-access drawdown)',
    aliases: ['drawdown', 'flexi-access', 'flexi access', 'income drawdown', 'flexible drawdown'],
    short: 'Drawdown keeps your pension invested and lets you take income from it flexibly, whenever you choose.',
    how: 'Instead of swapping the pot for a guaranteed income, you leave it invested and draw what you need. You keep control and any growth, and what is left can pass to your family — but the income is not guaranteed and the pot can run down if markets fall or you draw too much. Income taken (beyond the tax-free cash) is taxed as earnings.',
    watch: 'Drawing flexible taxable income from a pension can trigger the MPAA, which sharply limits what you can still pay into pensions afterwards.',
    links: [
      { label: 'How much can I safely draw each year?', q: 'How much can I sustainably draw from my pension each year?' },
      { label: 'Drawdown vs annuity', q: 'Should I buy an annuity now or stay in drawdown?' },
    ],
  }),
  ufpls: E({
    term: 'UFPLS (uncrystallised funds pension lump sum)',
    aliases: ['ufpls', 'uncrystallised'],
    short: 'A way of taking pension money in lump sums where each withdrawal is 25% tax-free and 75% taxed as income.',
    how: 'Rather than taking all your tax-free cash up front, each UFPLS lump sum is part tax-free, part taxable. It lets you spread withdrawals — and the tax — across years to help stay in a lower tax band.',
    links: [{ label: 'Phasing my tax-free cash', q: 'Should I take my tax-free cash in stages?' }],
  }),
  defined_benefit: E({
    term: 'Defined-benefit (final-salary / NHS) pension',
    aliases: ['defined benefit', 'defined-benefit', 'db pension', 'final salary', 'final-salary', 'nhs pension', 'career average', 'career-average'],
    short: 'A pension that pays a guaranteed income for life based on your salary and years of service — not on a pot of money.',
    how: 'The scheme (e.g. the NHS) promises a set income, usually rising with inflation, however markets perform — the risk sits with the scheme, not you. The NHS scheme is career-average. It behaves like an annuity you already own: a secure income floor.',
    watch: 'Transferring a defined-benefit pension out to a pot is rarely in your interest and usually requires regulated advice — you would be giving up a guarantee.',
    links: [{ label: 'How does my NHS pension fit my retirement income?', q: 'How do my NHS pension and SIPPs work together for retirement income?' }],
  }),
  defined_contribution: E({
    term: 'Defined-contribution (money-purchase) pension',
    aliases: ['defined contribution', 'defined-contribution', 'dc pension', 'money purchase', 'money-purchase'],
    short: 'A pension that is a pot of invested money — what you get depends on contributions and investment growth.',
    how: 'You and/or your employer pay in, it is invested, and at retirement the pot is yours to use (drawdown, annuity, or lump sums). A SIPP is a type of DC pension. From April 2027, unused DC pots can fall into your estate for inheritance tax.',
    links: [{ label: 'How should I take my DC pots?', q: 'What is the most tax-efficient way to withdraw my pensions?' }],
  }),
  sipp: E({
    term: 'SIPP (self-invested personal pension)',
    aliases: ['sipp', 'sipps', 'self-invested', 'self invested personal pension'],
    short: 'A do-it-yourself personal pension with a wide investment choice — a type of defined-contribution pot.',
    how: 'A SIPP gives you control over how the pot is invested. It gets pension tax relief on contributions, and at retirement you can use drawdown, buy an annuity, or take lump sums. Several old SIPPs can often be consolidated to cut charges and simplify drawdown.',
    watch: 'Before combining or transferring any pot, check for valuable features that could be lost — guaranteed annuity rates, protected tax-free cash, or safeguarded benefits.',
    links: [{ label: 'Should I combine my old pensions?', q: 'I have several old pensions — should I combine them?' }],
  }),
  isa: E({
    term: 'ISA (Individual Savings Account)',
    aliases: ['isa', 'isas', 'stocks and shares isa', 'cash isa'],
    short: 'A wrapper that shelters savings or investments from UK tax, up to an annual limit.',
    how: 'Money inside an ISA grows free of income tax and capital gains tax, and withdrawals are tax-free. There is a yearly allowance (shown live in the app) that resets each 5 April — unused allowance is lost, it does not carry forward. Cash ISAs hold savings; stocks-and-shares ISAs hold investments.',
    links: [{ label: 'Which ISA is right for me?', q: 'Which type of ISA should I use?' }],
  }),
  lisa: E({
    term: 'Lifetime ISA (LISA)',
    aliases: ['lisa', 'lifetime isa'],
    short: 'An ISA for under-40s saving for a first home or retirement, with a 25% government bonus on what you pay in.',
    how: 'You can pay in up to a yearly limit (within your overall ISA allowance) and the government adds 25%. It can be used for a first home up to a price cap, or from age 60. Take it out for anything else and a withdrawal charge claws back the bonus and a bit more.',
    watch: 'The early-withdrawal charge can leave you with less than you put in — only use a LISA for its intended purposes.',
    links: [{ label: 'Saving for a first home', q: 'How should I save for a first home deposit?' }],
  }),
  annual_allowance: E({
    term: 'Pension annual allowance',
    aliases: ['annual allowance', 'pension allowance', 'aa limit'],
    short: 'The most you can pay into pensions each year while still getting tax relief.',
    how: 'Contributions above the allowance lose tax relief. Crucially, unused allowance from the previous three tax years can be carried forward — the main reason to check what you have not used. High earners can have a reduced (tapered) allowance.',
    watch: 'Carry-forward is one of the few allowances that does NOT reset and vanish each year — but you must have been a pension member in those earlier years to use it.',
    links: [{ label: 'What pension allowance have I not used?', q: 'How much unused pension allowance do I have?' }],
  }),
  carry_forward: E({
    term: 'Carry-forward (pension)',
    aliases: ['carry forward', 'carry-forward', 'carryforward'],
    short: 'Using unused pension annual allowance from the previous three tax years on top of this year’s.',
    how: 'If you did not use your full pension allowance in the last three years, you can add the unused amount to this year’s — letting you pay in more with tax relief, often after a bonus or business profit. You must have been a pension scheme member in each year you carry from.',
    links: [{ label: 'What allowance have I not used?', q: 'How much unused pension allowance do I have?' }],
  }),
  mpaa: E({
    term: 'MPAA (money-purchase annual allowance)',
    aliases: ['mpaa', 'money purchase annual allowance', 'money-purchase annual allowance'],
    short: 'A much lower pension contribution limit that kicks in once you flexibly access a DC pension.',
    how: 'Taking flexible taxable income from a defined-contribution pension permanently triggers the MPAA, cutting how much you can pay back into pensions and removing carry-forward for those contributions. Taking only your tax-free cash usually does not trigger it.',
    watch: 'If you are still working and contributing, triggering the MPAA by accident can be costly — check before taking flexible income.',
    links: [{ label: 'Avoiding the MPAA trap', q: 'How do I avoid triggering the MPAA?' }],
  }),
  tax_free_cash: E({
    term: 'Tax-free cash (pension commencement lump sum)',
    aliases: ['tax-free cash', 'tax free cash', 'pcls', 'tax-free lump sum', '25% tax free', 'tax free lump sum'],
    short: 'The portion of a pension you can usually take tax-free — broadly a quarter of the pot, up to a lifetime limit.',
    how: 'When you start taking a defined-contribution pension you can normally take up to 25% tax-free (subject to an overall lump-sum limit shown live in the app). You can take it in one go or in stages; the rest is taxed as income when drawn.',
    links: [{ label: 'Should I phase my tax-free cash?', q: 'Should I take my tax-free cash in stages?' }],
  }),
  pet: E({
    term: 'PET (potentially exempt transfer) & the 7-year rule',
    aliases: ['pet', 'potentially exempt', 'seven year rule', '7 year rule', '7-year rule', 'seven-year rule', 'gift inheritance tax', 'gift iht'],
    short: 'A gift to another person that becomes fully free of inheritance tax if you live seven years after making it.',
    how: 'Most gifts to people (not trusts) are PETs. If you survive seven years, the gift is outside your estate entirely. Die within seven years and it counts back into your estate, though taper relief can reduce the tax on gifts made three to seven years before death. Separate annual exemptions let you give smaller amounts with no seven-year clock at all.',
    watch: 'Taper relief reduces the tax on the gift, not the value of the gift — a common misunderstanding.',
    links: [
      { label: 'Giving money to family tax-efficiently', q: 'How can I gift money to my children to reduce inheritance tax?' },
      { label: 'Reduce my IHT before April 2027', q: 'How can I reduce my inheritance tax?' },
    ],
  }),
  nil_rate_band: E({
    term: 'Nil-rate band & residence nil-rate band',
    aliases: ['nil rate band', 'nil-rate band', 'nrb', 'rnrb', 'residence nil rate band', 'inheritance tax allowance', 'iht allowance'],
    short: 'The slices of your estate that pass free of inheritance tax before the 40% rate applies.',
    how: 'Everyone has a nil-rate band; an extra residence nil-rate band can apply when a home passes to direct descendants, though it tapers away for large estates. Unused allowances can usually transfer to a surviving spouse or civil partner, so a couple can pass on substantially more. Current amounts are shown live in the app.',
    links: [{ label: 'My inheritance tax position', q: 'What is my inheritance tax exposure?' }],
  }),
  bpr: E({
    term: 'BPR (Business Relief) & APR (Agricultural Relief)',
    aliases: ['bpr', 'business relief', 'business property relief', 'apr', 'agricultural relief'],
    short: 'Reliefs that can reduce or remove inheritance tax on qualifying business or farm assets.',
    how: 'Qualifying trading businesses, some unlisted/AIM shares, and farmland can attract relief from inheritance tax if held long enough (generally two years). The rules changed from April 2026 — a combined allowance applies and AIM shares get a reduced rate — so the amount of relief is no longer always full.',
    watch: 'These assets are higher-risk and the relief rules are detailed — qualification is not automatic.',
    links: [{ label: 'Business-relief investing to cut IHT', q: 'How does business relief reduce inheritance tax?' }],
  }),
  state_pension: E({
    term: 'State Pension & voluntary NI',
    aliases: ['state pension', 'voluntary ni', 'voluntary national insurance', 'ni record', 'qualifying years'],
    short: 'The government pension based on your National Insurance record, payable from State Pension age.',
    how: 'You build entitlement through qualifying NI years; a full record gives the full new State Pension. Gaps can sometimes be filled with voluntary contributions, which is often very good value. You can also defer taking it for a higher income later.',
    links: [{ label: 'Should I fill gaps in my NI record?', q: 'Should I pay voluntary National Insurance to boost my State Pension?' }],
  }),
}

// Build an alias → key lookup once.
const ALIAS_TO_KEY = (() => {
  const m = []
  for (const [key, ex] of Object.entries(EXPLAINERS)) {
    for (const a of ex.aliases) m.push([a.toLowerCase(), key])
  }
  // longest alias first so "annual allowance" beats "allowance", "nhs pension" beats "pension"
  m.sort((a, b) => b[0].length - a[0].length)
  return m
})()

// Definitional intent — STRONG forms only: "what is/are X", "what's X",
// "explain X", "define X", "what does X mean", "meaning of X", "tell me about X",
// "difference between X and Y". Deliberately NOT "how does X work" — that's
// usually asking about a technique (e.g. "how does bed-and-ISA work") which the
// play engine answers better than a bare term definition.
const DEFINITIONAL = /\b(what(?:'?s| is| are)|what does\b.{0,40}\bmean|what do you mean by|explain|meaning of|define|tell me about|difference between)\b/i

// Decision / technique / action intent — if present, the user wants a PLAY
// (what to DO), not a definition. Don't hijack these to the glossary, even when
// they contain a known term. ("difference between" is exempt — it's comparative,
// handled below.)
const ACTION_INTENT = /\b(should i|shall i|best way|better to|worth it|how (?:do|can|should) i|how to|reduce|save tax|or (?:wait|stay|drawdown|invest)|vs\b|versus)\b/i

/**
 * Detect a definitional query and return the matching explainer(s).
 * @returns {{ explainer, second?, comparison? } | null}
 */
export function detectExplainer(query) {
  const q = (query || '').trim()
  if (!q) return null
  const lower = q.toLowerCase()

  const isDefinitional = DEFINITIONAL.test(q)
  // a very short bare-term query ("annuity?", "what's a SIPP") also counts
  const isShort = q.split(/\s+/).length <= 4

  if (!isDefinitional && !isShort) return null

  // Decision/technique intent wins over a bare term match — let the play engine
  // answer "should I buy an annuity" / "bed-and-ISA — how does it work" rather
  // than returning a generic definition. ("difference between" stays glossary.)
  if (ACTION_INTENT.test(q) && !/difference between/i.test(q)) return null

  // Find which known term(s) the query references (longest alias wins).
  const hits = []
  for (const [alias, key] of ALIAS_TO_KEY) {
    if (lower.includes(alias)) {
      if (!hits.find(h => h.key === key)) hits.push({ key, alias })
    }
  }
  if (!hits.length) return null

  // For a short bare-term query with no definitional phrase, require the term to
  // be most of the query (avoid hijacking "should I buy an annuity now?").
  if (!isDefinitional && isShort) {
    const longest = hits[0].alias
    if (longest.length < lower.replace(/[^a-z ]/g, '').trim().length * 0.5) return null
  }

  const explainer = EXPLAINERS[hits[0].key]
  // "difference between X and Y" → return both for a comparison.
  if (/difference between/i.test(q) && hits[1]) {
    return { explainer, second: EXPLAINERS[hits[1].key], comparison: true }
  }
  return { explainer }
}
