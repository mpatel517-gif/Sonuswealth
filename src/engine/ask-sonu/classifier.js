// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — CLASSIFIER
//
// Maps free-text user query → weighted concerns + resources at stake +
// active constraints. Two-pass:
//   1. Deterministic keyword/regex pass — fast, predictable, always tried.
//   2. (Future) LLM fallback for novel queries.
//
// For the IFA demo we ship pass 1 only — deterministic on known queries,
// graceful generic-match on unknown. Adding LLM pass later does not break
// any existing behaviour because it is fallback-only.
// ─────────────────────────────────────────────────────────────────────────────

import { CONCERNS, RESOURCES } from './ontology.js'

// Each entry: { match: regex, concerns: { id: weight }, resources_at_stake: [], constraints: [] }
const RULES = [
  // ── Retirement & drawdown ────────────────────────────────────────────────
  {
    match: /retir|drawdown|stop work|step back|stop working/i,
    concerns: { [CONCERNS.RETIREMENT]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.8, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /withdraw|take out|\bdraw[\s-]?down\b|\bdraw \d|\bdraw £?\d|live off|live on|extract.{0,15}(?:income|cash|money)|access.{0,15}(?:pension|sipp|isa)/i,
    concerns: { [CONCERNS.RETIREMENT]: 0.8, [CONCERNS.TAX]: 0.7, [CONCERNS.INCOME_SECURITY]: 0.7 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /tax-free cash|tfc|25%|pension lump sum|crystallise|crystallize/i,
    concerns: { [CONCERNS.TAX]: 0.9, [CONCERNS.RETIREMENT]: 0.8 },
    resources: [RESOURCES.PENSION],
  },

  // ── IHT & estate ─────────────────────────────────────────────────────────
  {
    match: /iht|inherit|estate tax|death tax|pass(?:ing)? on|legacy|kids inherit|grandchildren/i,
    concerns: { [CONCERNS.IHT_LEGACY]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.PROPERTY, RESOURCES.GIA],
  },
  {
    match: /gift|gifting|give\b.{0,30}(?:children|kids|grandchildren|charity|family|son|daughter|niece|nephew)|pass(?:ing)? (?:on |wealth|money|down)/i,
    concerns: { [CONCERNS.IHT_LEGACY]: 0.95, [CONCERNS.FAMILY_CHANGE]: 0.3 },
    resources: [RESOURCES.CASH, RESOURCES.GIA, RESOURCES.ISA],
  },
  // Pre-2027 PRESERVATION signal — requires intent words alongside the date
  {
    match: /(?:before|prior to|ahead of|by) (?:april )?2027|protect.{0,20}(?:sipp|pension|estate)|preserve.{0,20}(?:sipp|pension|estate)|sipp.*iht|finance act 2026|pension.*estate.*before/i,
    concerns: { [CONCERNS.IHT_LEGACY]: 1.0, [CONCERNS.REGULATORY]: 1.0 },
    resources: [RESOURCES.PENSION],
  },

  // ── Relocation ───────────────────────────────────────────────────────────
  {
    match: /relocat|emigrat|move (?:abroad|overseas)|moving (?:abroad|overseas)|leaving uk|leave (?:the )?uk|portugal|dubai|uae|spain|kenya|australia|\bnhr\b|ifici|\bfig\b/i,
    concerns: {
      [CONCERNS.RELOCATION]: 1.0,
      [CONCERNS.TAX]: 0.5,
      [CONCERNS.LIFESTYLE]: 0.8,
      [CONCERNS.HEALTHCARE]: 0.6,
      [CONCERNS.CURRENCY]: 0.5,
    },
    resources: [RESOURCES.PROPERTY, RESOURCES.PENSION, RESOURCES.ISA],
  },

  // ── Family change ────────────────────────────────────────────────────────
  {
    match: /divor|separat|split (?:from|with)|break.*up|breakup/i,
    concerns: { [CONCERNS.FAMILY_CHANGE]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.7, [CONCERNS.IHT_LEGACY]: 0.4 },
    resources: [RESOURCES.PENSION, RESOURCES.PROPERTY, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /marry|getting married|cohabit|living together|not married|unmarried|partner.{0,30}(?:not married|unmarried)|engaged/i,
    concerns: { [CONCERNS.FAMILY_CHANGE]: 1.0, [CONCERNS.IHT_LEGACY]: 0.6, [CONCERNS.PROTECTION]: 0.5 },
    resources: [],
  },
  {
    match: /baby|child|expecting|new(?:born)? kid|having a kid/i,
    concerns: { [CONCERNS.FAMILY_CHANGE]: 0.9, [CONCERNS.EDUCATION]: 0.6, [CONCERNS.PROTECTION]: 0.7 },
    resources: [],
  },

  // ── Business ─────────────────────────────────────────────────────────────
  {
    match: /sell (?:my |the )?business|exit (?:my )?business|business sale|company sale|bade?r|investors? relief/i,
    concerns: { [CONCERNS.BUSINESS_EXIT]: 1.0, [CONCERNS.TAX]: 0.9, [CONCERNS.RETIREMENT]: 0.5 },
    resources: [RESOURCES.BUSINESS],
  },

  // ── Protection ───────────────────────────────────────────────────────────
  {
    match: /life cover|life insurance|critical illness|income protection|protect (?:my )?family/i,
    concerns: { [CONCERNS.PROTECTION]: 1.0, [CONCERNS.FAMILY_CHANGE]: 0.5 },
    resources: [],
  },

  // ── Cash / deposits / savings (sub-intent routed) ─────────────────────────
  {
    match: /bed.?and.?sipp|bed.?&.?sipp|sipp.{0,10}my cash|move cash.{0,15}sipp/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_BEDSIPP]: 1.0, [CONCERNS.TAX]: 0.5 },
    resources: [RESOURCES.CASH, RESOURCES.PENSION],
  },
  {
    match: /isa.{0,10}(?:is )?full|full.{0,10}isa|used.{0,10}(?:my )?isa.{0,10}(?:allowance|this year)|isa.{0,10}allowance.{0,10}(?:used|full)|maxed.{0,10}isa/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_BEYOND_ISA]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.GIA, RESOURCES.PENSION, RESOURCES.ISA],
  },
  {
    match: /psa|personal savings allowance|interest.{0,10}tax(?:ed|able)?|tax.{0,10}on.{0,10}(?:savings|interest)/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_PSA]: 1.0, [CONCERNS.TAX]: 0.8 },
    resources: [RESOURCES.CASH, RESOURCES.ISA],
  },
  {
    match: /gilt|treasury (?:bond|stock)|government bond/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_GILTS]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.GIA],
  },
  {
    match: /money market|mmf|cash isa|where (?:should|to) (?:i )?(?:hold|keep|put).{0,15}cash|best.{0,10}(?:home|place).{0,10}(?:for )?cash/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_SHELTER]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /rates?.{0,15}(?:drop|fall|fell|fallen|cut|lower)|savings? rate.{0,15}(?:drop|fall|down|lower)|cash.{0,15}(?:yield|return).{0,10}(?:drop|fall|low)/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_RATEDROP]: 1.0, [CONCERNS.TAX]: 0.3 },
    resources: [RESOURCES.CASH, RESOURCES.GIA],
  },
  {
    match: /how much cash|cash.{0,10}(?:should|do) i (?:keep|hold)|emergency fund|rainy day|keep.{0,10}liquid|how.{0,10}liquid/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.6, [CONCERNS.CASH_BUFFER]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.5 },
    resources: [RESOURCES.CASH],
  },
  {
    match: /fixed deposit|fd.{0,5}matur|term deposit|cash account|savings account|cash.{0,15}(?:matur|reinvest|deploy|sitting)|maturing.{0,15}(?:deposit|cash|account)|deposits? matur|what.{0,10}do with.{0,15}(?:cash|deposit)|deploy.{0,15}cash/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.6, [CONCERNS.CASH_DEPLOY]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.ISA, RESOURCES.GIA],
  },

  // ── Tax (generic) ────────────────────────────────────────────────────────
  {
    match: /reduce (?:my )?tax|tax bill|tax planning|save tax|tax-efficient|isa|pension contribution|carry forward|annual allowance/i,
    concerns: { [CONCERNS.TAX]: 1.0 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA],
  },
  {
    match: /salary sacrifice|sal.?sac|sacrifice.{0,10}(?:into|to).{0,10}pension/i,
    concerns: { [CONCERNS.TAX_SALSAC]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.PENSION, RESOURCES.EARNED_INCOME],
  },
  {
    match: /carry.?forward|carry forward.{0,10}allowance|unused.{0,10}annual allowance|previous years.{0,10}allowance/i,
    concerns: { [CONCERNS.TAX_CARRYFWD]: 1.0, [CONCERNS.TAX]: 0.6, [CONCERNS.RETIREMENT]: 0.3 },
    resources: [RESOURCES.PENSION],
  },
  {
    match: /marriage allowance|married.{0,10}(?:tax )?allowance|transfer.{0,10}(?:personal )?allowance.{0,10}spouse/i,
    concerns: { [CONCERNS.TAX_MARRIAGE]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.EARNED_INCOME],
  },
  {
    // HICBC — specific-first (before generic child/family rules) so the
    // child-benefit-charge question lands on the HICBC play, not a protection play.
    match: /hicbc|child benefit charge|high.?income child benefit|child benefit.{0,20}(?:taper|claw|over £?60|lose)|£?60k?.{0,15}child benefit/i,
    concerns: { [CONCERNS.TAX_HICBC]: 1.0, [CONCERNS.FAMILY_CHANGE]: 0.4, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.EARNED_INCOME],
  },
  {
    match: /bed.?and.?isa|bed.?&.?isa|bed and isa/i,
    concerns: { [CONCERNS.TAX_BEDISA]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.GIA, RESOURCES.ISA],
  },
  {
    match: /crystallise (?:capital )?gains|realise.{0,10}gains|use.{0,10}(?:my )?(?:cgt|capital gains).{0,10}(?:exempt|allowance)|annual exempt amount|\baea\b/i,
    concerns: { [CONCERNS.TAX_CGT_REALISE]: 1.0, [CONCERNS.TAX]: 0.7 },
    resources: [RESOURCES.GIA],
  },
  {
    match: /\beis\b|\bvct\b|\bseis\b|enterprise investment|venture capital trust|seed enterprise/i,
    concerns: { [CONCERNS.TAX_EIS_VCT]: 1.0, [CONCERNS.TAX]: 0.7 },
    resources: [RESOURCES.GIA],
  },
  {
    match: /dividend.{0,10}(?:or|vs).{0,10}salary|salary.{0,10}(?:or|vs).{0,10}dividend|how.{0,10}(?:should|do).{0,10}i.{0,10}pay myself|extract.{0,10}(?:from )?(?:my )?(?:company|ltd)/i,
    concerns: { [CONCERNS.TAX_DIV_SALARY]: 1.0, [CONCERNS.TAX]: 0.7, [CONCERNS.BUSINESS_EXIT]: 0.2 },
    resources: [RESOURCES.BUSINESS, RESOURCES.EARNED_INCOME],
  },
  {
    match: /taper|tapered|losing (?:my )?personal allowance|60% marginal|100k.{0,10}(?:trap|taper)|(?:earn|income|salary).{0,20}(?:£?100k|£?110k|£?100,000|£?110,000)/i,
    concerns: { [CONCERNS.TAX_TAPER]: 1.0, [CONCERNS.TAX]: 0.7, [CONCERNS.INCOME_SECURITY]: 0.3 },
    resources: [RESOURCES.PENSION, RESOURCES.EARNED_INCOME],
  },

  // ── Protection (sub-intent routed) ────────────────────────────────────────
  {
    match: /key.?person|key.?man|business.{0,10}(?:protection|insurance)|shareholder protection|partnership protection/i,
    concerns: { [CONCERNS.PROT_KEYPERSON]: 1.0, [CONCERNS.PROTECTION]: 0.6, [CONCERNS.BUSINESS_EXIT]: 0.3 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /write.{0,10}(?:in|into).{0,10}trust|policy.{0,10}in trust|life (?:cover|policy|insurance).{0,12}trust|put.{0,10}(?:my )?(?:life )?(?:policy|cover).{0,10}(?:in )?trust/i,
    concerns: { [CONCERNS.PROT_TRUST]: 1.0, [CONCERNS.PROTECTION]: 0.6, [CONCERNS.IHT_LEGACY]: 0.4 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /critical illness.{0,20}income protection|income protection.{0,20}critical illness|\bci\b.{0,8}(?:or|vs).{0,8}\bip\b|ci vs ip|critical illness (?:or|vs)|(?:or|vs) (?:income )?protection/i,
    concerns: { [CONCERNS.PROT_CI_IP]: 1.2, [CONCERNS.PROTECTION]: 0.5 },
    resources: [RESOURCES.EARNED_INCOME],
  },
  {
    match: /self.?employed.{0,12}(?:income protection|ip|cover|sick)|income protection.{0,10}self.?employed|cover.{0,10}(?:if|when) i.?m self/i,
    concerns: { [CONCERNS.PROT_SE_IP]: 1.0, [CONCERNS.PROTECTION]: 0.7 },
    resources: [RESOURCES.EARNED_INCOME],
  },
  {
    match: /whole.?of.?life|whole life|wol\b|term.{0,10}(?:or|vs).{0,10}whole|whole.{0,10}(?:or|vs).{0,10}term|level term|decreasing term/i,
    concerns: { [CONCERNS.PROT_WOL_TERM]: 1.0, [CONCERNS.PROTECTION]: 0.6, [CONCERNS.IHT_LEGACY]: 0.3 },
    resources: [RESOURCES.PROPERTY],
  },

  // ── IHT / estate + inheritance (sub-intent routed) ────────────────────────
  {
    match: /deed of variation|redirect.{0,12}inherit|vary (?:the |my )?will|change.{0,10}(?:the )?will after/i,
    concerns: { [CONCERNS.INH_DEED]: 1.0, [CONCERNS.IHT_LEGACY]: 0.5, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.INHERITANCE],
  },
  {
    match: /refuse.{0,10}inherit|skip.{0,10}(?:a )?generation|generation.?skip|gift.{0,12}(?:my )?inherit|pass.{0,10}(?:my )?inherit (?:on|down)|inherit.{0,12}on to (?:my )?(?:children|kids|grandchildren)/i,
    concerns: { [CONCERNS.INH_GENSKIP]: 1.0, [CONCERNS.IHT_LEGACY]: 0.6, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.INHERITANCE],
  },
  {
    match: /i inherited|inherited £|inherited (?:a |some )|deploy.{0,10}(?:my )?inherit|what.{0,12}do with.{0,10}(?:my )?inherit|invest.{0,10}(?:my )?inherit|inheritance.{0,10}after iht/i,
    concerns: { [CONCERNS.INH_DEPLOY]: 1.0, [CONCERNS.LIQUIDITY]: 0.4, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.INHERITANCE, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /spouse died|partner died|wife died|husband died|widow|transferable nil|transferable nrb|unused nil.?rate|spouse.{0,10}(?:nil.?rate|nrb)/i,
    concerns: { [CONCERNS.IHT_TRANSFER]: 1.0, [CONCERNS.IHT_LEGACY]: 0.7 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /charit/i,
    concerns: { [CONCERNS.IHT_CHARITY]: 1.0, [CONCERNS.IHT_LEGACY]: 0.6, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.PROPERTY, RESOURCES.GIA],
  },
  {
    match: /is my home.{0,10}taxed|home.{0,10}(?:taxed|on death)|house.{0,10}(?:taxed|on death)|what about my home/i,
    concerns: { [CONCERNS.IHT_HOME]: 1.0, [CONCERNS.IHT_LEGACY]: 0.7 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /leave everything|leave.{0,10}(?:it |all )?to (?:my )?(?:kids|children)|everything to (?:my )?(?:kids|children)|kids inherit.{0,10}tax.?free|tax.?free.{0,10}to (?:my )?(?:kids|children)/i,
    concerns: { [CONCERNS.IHT_LEAVE_KIDS]: 1.0, [CONCERNS.IHT_LEGACY]: 0.7 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /set up.{0,10}(?:a )?trust|should i.{0,10}(?:set up|use).{0,10}trust|put.{0,25}(?:in|into).{0,8}(?:a )?trust|inheritance.{0,15}(?:in|into).{0,8}trust|trust.{0,10}(?:for my|to (?:protect|shelter))/i,
    concerns: { [CONCERNS.IHT_TRUST]: 1.0, [CONCERNS.IHT_LEGACY]: 0.6, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.PROPERTY, RESOURCES.TRUST],
  },
  {
    match: /7.?year rule|seven.?year (?:rule|gift)|gift.{0,10}(?:7|seven).?year|how long.{0,10}(?:before )?(?:a )?gift/i,
    concerns: { [CONCERNS.IHT_7YR]: 1.0, [CONCERNS.IHT_LEGACY]: 0.6 },
    resources: [RESOURCES.INHERITANCE],
  },
  {
    match: /reduce.{0,10}(?:my )?iht|reduce.{0,10}(?:my )?inherit|cut.{0,10}(?:my )?iht|lower.{0,10}(?:my )?iht|iht bill|reduce.{0,10}(?:my )?(?:death|estate) (?:tax|duty)/i,
    concerns: { [CONCERNS.IHT_REDUCE]: 1.0, [CONCERNS.IHT_LEGACY]: 0.7, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.PROPERTY, RESOURCES.PENSION, RESOURCES.GIA],
  },

  // ── Healthcare / care ────────────────────────────────────────────────────
  {
    match: /care home|nursing home|care fees|long-term care|dementia|care cost/i,
    concerns: { [CONCERNS.HEALTHCARE]: 1.0, [CONCERNS.IHT_LEGACY]: 0.5, [CONCERNS.LIQUIDITY]: 0.6 },
    resources: [RESOURCES.PROPERTY, RESOURCES.PENSION, RESOURCES.CASH],
  },

  // ── Property (sub-intent routed; specific BTL/SDLT cases before generic) ───
  {
    match: /furnished holiday let|\bfhl\b|holiday let/i,
    concerns: { [CONCERNS.PROP_FHL]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /incorporat|btl.{0,15}(?:ltd|limited|company)|move.{0,15}(?:btl|properties|portfolio).{0,15}(?:ltd|company)|property.{0,10}company/i,
    concerns: { [CONCERNS.PROP_BTL_INC]: 1.0, [CONCERNS.TAX]: 0.7 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /first.?time buyer|\bftb\b|first home.{0,10}sdlt/i,
    concerns: { [CONCERNS.PROP_FTB]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },
  {
    match: /cgt.{0,15}(?:btl|property|rental|sell)|how.{0,10}(?:does )?cgt.{0,10}work|capital gains.{0,15}(?:btl|property|rental)/i,
    concerns: { [CONCERNS.PROP_BTL_CGT]: 1.0, [CONCERNS.TAX]: 0.7 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /sell.{0,15}(?:my )?btl|sell.{0,15}(?:my )?(?:rental|investment propert)|btl.{0,10}(?:hassle|too much)|get out of.{0,10}(?:btl|property)|dispose.{0,10}(?:btl|propert)/i,
    concerns: { [CONCERNS.PROP_BTL_SELL]: 1.0, [CONCERNS.TAX]: 0.5 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /(?:still )?profitable.{0,15}(?:after )?s24|s24|section 24|btl.{0,15}(?:still )?(?:profit|worth|viable)|mortgage interest.{0,10}relief/i,
    concerns: { [CONCERNS.PROP_BTL_S24]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.PROPERTY],
  },
  {
    match: /buy (?:a )?(?:buy.?to.?let|btl|rental propert|investment propert)|should i buy.{0,10}btl/i,
    concerns: { [CONCERNS.PROP_BTL_BUY]: 1.0, [CONCERNS.TAX]: 0.5, [CONCERNS.LIFESTYLE]: 0.4 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },
  {
    match: /second home|holiday home|another (?:house|home|propert)/i,
    concerns: { [CONCERNS.PROP_SECOND]: 1.0, [CONCERNS.TAX]: 0.5, [CONCERNS.LIFESTYLE]: 0.5 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },
  {
    match: /downsiz|sell.{0,10}(?:my )?(?:home|house).{0,15}smaller|smaller (?:home|house|place)|trade down/i,
    concerns: { [CONCERNS.PROP_DOWNSIZE]: 1.0, [CONCERNS.IHT_LEGACY]: 0.5, [CONCERNS.LIFESTYLE]: 0.6 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },
  {
    match: /bigger (?:house|home|propert)|upsiz|upgrade.{0,10}(?:house|home)|move.{0,10}(?:to )?a bigger|trade up/i,
    concerns: { [CONCERNS.PROP_UPSIZE]: 1.0, [CONCERNS.TAX]: 0.4, [CONCERNS.LIFESTYLE]: 0.6 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },

  // ── Mortgage / debt (sub-intent routed so each query lands on the right play) ─
  {
    // Equity release FIRST — most specific (else "release equity" hits 'borrow')
    match: /equity release|lifetime mortgage|release equity|release.{0,10}cash.{0,10}home/i,
    concerns: { [CONCERNS.DEBT]: 0.6, [CONCERNS.DEBT_EQUITY]: 1.0, [CONCERNS.IHT_LEGACY]: 0.3 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },
  {
    match: /offset mortgage|offset.{0,15}(?:savings|cash|account)|\boffset\b/i,
    concerns: { [CONCERNS.DEBT]: 0.6, [CONCERNS.DEBT_OFFSET]: 1.0, [CONCERNS.LIQUIDITY]: 0.4 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },
  {
    match: /overpay|pay off.{0,20}(?:mortgage|loan|debt)|clear.{0,15}(?:mortgage|debt)|mortgage.{0,10}or invest|invest.{0,10}(?:or|vs).{0,15}mortgage/i,
    concerns: { [CONCERNS.DEBT]: 0.6, [CONCERNS.DEBT_OVERPAY]: 1.0, [CONCERNS.LIQUIDITY]: 0.3 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH, RESOURCES.GIA],
  },
  {
    match: /remortgage|re-mortgage|fixed rate|fixed or tracker|tracker|interest.only|repayment|how much can i borrow|borrow.{0,15}(?:with|on|income)|rate.{0,10}(?:ending|ends|expir)/i,
    concerns: { [CONCERNS.DEBT]: 0.6, [CONCERNS.DEBT_RATE]: 1.0 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },

  // ── Business exit (sub-intent routed; specific terms before generic sale) ──
  {
    match: /investors?.?relief\b|investor's relief/i,
    concerns: { [CONCERNS.BUS_IR]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /\beot\b|employee ownership|sell to (?:my )?(?:employees|staff|team)/i,
    concerns: { [CONCERNS.BUS_EOT]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.5 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /wind(?:ing)? (?:down|up)|members.{0,5}voluntary liquidation|\bmvl\b|close (?:my |the )?company|strike off|dissolv/i,
    concerns: { [CONCERNS.BUS_MVL]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /earn.?out|deferred consideration|loan note/i,
    concerns: { [CONCERNS.BUS_EARNOUT]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /\bbadr\b|business asset disposal|entrepreneurs.?relief/i,
    concerns: { [CONCERNS.BUS_BADR]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /(?:extract|take).{0,15}(?:dividend|cash).{0,15}(?:or|vs).{0,15}(?:share|sell|capital)|dividend.{0,10}(?:or|vs).{0,10}(?:share|sell|capital)|dividends? or (?:sell |selling )?shares/i,
    concerns: { [CONCERNS.BUS_DIVCAP]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.4, [CONCERNS.TAX]: 0.7 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /exit.{0,15}(?:gradual|gradually|stage|phase|all at once|one go)|gradually or all|sell.{0,15}(?:gradual|stage|phase)/i,
    concerns: { [CONCERNS.BUS_EXIT_SEQ]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.6, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /sell (?:my |the )?business|exit (?:my )?business|business sale|company sale|sell.{0,10}(?:my )?(?:company|shares).{0,10}(?:structure|best)|best structure/i,
    concerns: { [CONCERNS.BUS_SALE]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.7, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },

  // ── Investment / portfolio (educational framing — never a recommendation) ──
  {
    match: /esg|ethical (?:fund|invest)|sustainab|responsible invest|impact invest/i,
    concerns: { [CONCERNS.INV_ESG]: 1.0, [CONCERNS.TAX]: 0.2 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /emerging market|developing market|\bem\b.{0,12}(?:alloc|risk|expos|worth)/i,
    concerns: { [CONCERNS.INV_EM]: 1.0 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /\bter\b|fund (?:fee|cost|charge)|paying too much|fees? (?:on|too)|ongoing charge|ocf/i,
    concerns: { [CONCERNS.INV_FEES]: 1.0, [CONCERNS.TAX]: 0.2 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /passive|index fund|active fund|actively managed|active manage|move to passive/i,
    concerns: { [CONCERNS.INV_PASSIVE]: 1.0 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /concentrat|single stock|one stock|too much in one|all in one|overweight.{0,10}(?:stock|share)/i,
    concerns: { [CONCERNS.INV_CONCENTRATION]: 1.0, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.GIA, RESOURCES.ISA],
  },
  {
    match: /rebalanc|out of balance|drifted|portfolio.{0,10}drift/i,
    concerns: { [CONCERNS.INV_REBALANCE]: 1.0 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /allocat|asset mix|asset.?allocation|how (?:should|do) i (?:invest|split).{0,20}(?:portfolio|£|money)|portfolio.{0,10}(?:mix|split)|invest (?:my )?£?\d/i,
    concerns: { [CONCERNS.INV_ALLOCATION]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.3 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },

  // ── Time freedom / FIRE (sub-intent routed) ──────────────────────────────
  {
    match: /sabbatical|career break|take.{0,10}(?:a )?(?:year|break) (?:off|out)|gap year/i,
    concerns: { [CONCERNS.LIFE_SABBATICAL]: 1.0, [CONCERNS.TIME_FREEDOM]: 0.6, [CONCERNS.INCOME_SECURITY]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /\bfire\b|financial independence|retire early.{0,10}(?:movement|fire)|4%\s*rule|four percent rule/i,
    concerns: { [CONCERNS.LIFE_FIRE]: 1.0, [CONCERNS.TIME_FREEDOM]: 0.6, [CONCERNS.RETIREMENT]: 0.5 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /part.?time|four.?day week|go part|reduce.{0,10}(?:my )?hours|drop.{0,10}(?:a )?day/i,
    concerns: { [CONCERNS.LIFE_PARTTIME]: 1.0, [CONCERNS.TIME_FREEDOM]: 0.6, [CONCERNS.INCOME_SECURITY]: 0.6 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.GIA, RESOURCES.CASH],
  },
  {
    match: /retire.{0,15}(?:early|earlier|\d+ years? earlier|5 years? earlier)|\d+ years? earlier|early retirement|retire.{0,10}sooner|stop working.{0,10}(?:early|earlier|sooner)|bridge.{0,15}(?:to|until).{0,10}(?:pension|state pension|57|55)/i,
    concerns: { [CONCERNS.LIFE_EARLY_RET]: 1.0, [CONCERNS.RETIREMENT]: 0.7, [CONCERNS.INCOME_SECURITY]: 0.6 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.GIA, RESOURCES.CASH],
  },
]

// Query-implied facts: when the user states a life situation directly, we
// can derive a fact override that the matcher should treat as fresher than
// the static persona profile. E.g. "I'm getting divorced" implies
// marital_status='divorcing' even if profile says 'married'.
const IMPLIED_FACTS = [
  { match: /divor|separat|split (?:from|with)|break(?:ing)? up/i,            fact: 'marital_status',     value: 'divorcing' },
  { match: /getting married|engaged to|wedding/i,                            fact: 'marital_status',     value: 'getting_married' },
  { match: /cohabit|living together|not married|unmarried|partner.{0,30}(?:not married|unmarried)/i, fact: 'marital_status', value: 'cohabiting' },
  { match: /relocat|emigrat|move abroad|move overseas|leaving the uk/i,       fact: 'relocation_planned', value: true },
  { match: /just (?:arrived|moved) to (?:the )?uk|new to (?:the )?uk/i,       fact: 'recent_arrival_uk',  value: true },
  { match: /with (?:my )?kids|with (?:my )?children|kids? coming|kids? mov/i, fact: 'kids_moving',        value: true },
  { match: /relying on nhs|on chemo|ongoing treatment|chronic/i,             fact: 'healthcare_reliance',value: true },
]

export function deriveImpliedFacts(query) {
  const q = query || ''
  const out = {}
  for (const rule of IMPLIED_FACTS) {
    if (rule.match.test(q)) out[rule.fact] = rule.value
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT — what is the user trying to DO?
// Drives the self-critique guard in the synthesizer. Mutually exclusive plays
// (preserve_pension vs draw_pension) must not collide on the same intent.
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_RULES = [
  { id: 'draw',        match: /\bdraw[\s-]?down\b|\bdraw \d|\bdraw £?\d|withdraw|take.{0,15}(?:out|from|cash|income)|live (?:on|off)|income from|spend (?:my )?(?:pension|sipp|isa)|need.{0,15}(?:income|cash)|how.{0,15}(?:do|can|to).{0,20}(?:get|extract|access).{0,15}(?:income|cash|money)|\bfrom april|extract.{0,15}(?:income|cash|money)/i },
  { id: 'preserve',    match: /preserve|protect|shield|shelter|keep.{0,15}(?:out of|away from)|reduce.{0,15}(?:iht|tax|estate)|legacy|pass.{0,15}(?:on|down|to)|leave.{0,15}(?:to|behind|for)|before (?:april )?2027/i },
  { id: 'restructure', match: /restructur|rebalanc|switch|move.{0,15}(?:into|to|across)|sell.{0,15}(?:and|then)|change my (?:mix|allocation|portfolio)|simpler|consolidat/i },
  { id: 'plan',        match: /plan|prepare|think about|considering|might|maybe|should i|what if|exploring/i },
]

export function deriveIntent(query) {
  const q = query || ''
  for (const rule of INTENT_RULES) {
    if (rule.match.test(q)) return rule.id
  }
  return 'plan'  // default — exploratory
}

// Per-play "intent type" — which intents this play is appropriate for.
// Used by synthesizer self-critique. If query intent = 'draw' but lead's
// intent_type = 'preserve', the lead is wrong and must be demoted.
export const PLAY_INTENT = {
  // Drawdown plays
  phase_tfc:                     ['draw'],
  split_sipp_spouse:             ['draw'],
  isa_topup_during_drawdown:     ['draw'],
  defer_state_pension:           ['draw', 'plan'],
  mpaa_avoidance:                ['draw', 'plan'],
  // Preservation plays — must NOT fire for 'draw' intent
  preserve_pension_pre_2027:     ['preserve'],
  // IHT plays
  surplus_income_gifting:        ['preserve', 'plan'],
  aim_bpr:                       ['preserve', 'restructure'],
  charity_10pct_iht:             ['preserve', 'plan'],
  lasting_poa:                   ['plan'],
  // Relocation
  srt_day_count_discipline:      ['plan', 'restructure'],
  fig_window_utilise:            ['restructure', 'draw'],
  destination_cost_reality_check:['plan'],
  healthcare_continuity_plan:    ['plan'],
  schooling_continuity_plan:     ['plan'],
  iht_tail_post_departure:       ['plan', 'preserve'],
  // Family
  cohab_ip_gap:                  ['preserve', 'plan'],
  will_revocation_on_marriage:   ['plan'],
  pension_sharing_divorce:       ['plan', 'restructure'],
  // Tax
  taper_pension_relief:          ['restructure', 'plan'],
  bed_and_isa:                   ['restructure', 'preserve'],
  // Healthcare / protection
  care_fee_buffer:               ['plan', 'preserve'],
  income_protection_gap:         ['plan'],
  // W6 — mortgage / cash / investment plays (valid across the action intents so
  // "switch to passive", "move into an offset" etc. aren't filtered out)
  overpay_vs_invest:             ['plan', 'restructure'],
  remortgage_review:             ['plan', 'restructure'],
  offset_mortgage:               ['plan', 'restructure'],
  equity_release_caution:        ['plan', 'restructure'],
  mmf_vs_cash_isa:               ['plan', 'restructure'],
  isa_full_next_steps:           ['plan', 'restructure'],
  bed_and_sipp:                  ['plan', 'restructure', 'preserve'],
  cash_yield_drop:               ['plan', 'restructure'],
  portfolio_allocation_factors:  ['plan', 'restructure'],
  fund_fee_review:               ['plan', 'restructure'],
  passive_vs_active:             ['plan', 'restructure'],
  concentration_risk:            ['plan', 'restructure', 'preserve'],
  rebalancing_discipline:        ['plan', 'restructure'],
  emerging_markets_role:         ['plan', 'restructure'],
  esg_investing:                 ['plan', 'restructure'],
  sabbatical_funding:            ['plan', 'draw'],
  fire_planning:                 ['plan', 'draw'],
  part_time_transition:          ['plan', 'draw'],
  early_retirement_bridge:       ['plan', 'draw'],
  // business + property W6 plays
  sale_structure_asset_vs_share: ['plan', 'restructure'],
  badr_eligibility:              ['plan', 'restructure'],
  exit_sequencing:               ['plan', 'restructure'],
  earnout_structure:             ['plan', 'restructure'],
  eot_relief:                    ['plan', 'restructure'],
  mvl_capital_treatment:         ['plan', 'restructure'],
  dividend_vs_capital_extraction:['plan', 'restructure', 'draw'],
  investors_relief_eligibility:  ['plan', 'restructure'],
  downsize_home:                 ['plan', 'restructure', 'draw'],
  upsize_home:                   ['plan', 'restructure'],
  btl_buy_considerations:        ['plan', 'restructure'],
  btl_after_s24:                 ['plan', 'restructure'],
  btl_incorporation:             ['plan', 'restructure'],
  fhl_post_abolition:            ['plan', 'restructure'],
  ftb_sdlt_relief:               ['plan'],
  second_home_sdlt:              ['plan', 'restructure'],
  btl_disposal:                  ['plan', 'restructure', 'draw'],
  btl_cgt_mechanics:             ['plan', 'restructure'],
  salary_sacrifice_pension:      ['plan', 'restructure'],
  carry_forward_aa:              ['plan', 'restructure'],
  marriage_allowance:            ['plan', 'restructure'],
  hicbc_child_benefit:           ['plan', 'restructure'],
  cgt_realisation:               ['plan', 'restructure'],
  eis_vct_relief:                ['plan', 'restructure'],
  dividend_vs_salary_owner:      ['plan', 'restructure'],
  iht_reduce_overview:           ['plan', 'preserve'],
  seven_year_gift_rule:          ['plan', 'preserve'],
  trust_basics:                  ['plan', 'preserve'],
  leave_estate_to_children:      ['plan', 'preserve'],
  home_iht_rnrb:                 ['plan', 'preserve'],
  transferable_nrb_widowed:      ['plan', 'preserve'],
  deploy_inheritance:            ['plan', 'restructure'],
  inheritance_wrapper_sequencing:['plan', 'restructure'],
  gift_inheritance_on:           ['plan', 'preserve'],
  deed_of_variation:             ['plan', 'preserve'],
  ci_vs_ip:                      ['plan', 'preserve'],
  write_policy_in_trust:         ['plan', 'preserve'],
  self_employed_ip:              ['plan', 'preserve'],
  key_person_cover:              ['plan', 'preserve'],
  whole_of_life_vs_term:         ['plan', 'preserve'],
}

/**
 * Classify a free-text query into structured concerns + resources.
 *
 * @param {string} query   User's natural-language question
 * @returns {{
 *   concerns: Record<string, number>,
 *   resources_at_stake: string[],
 *   raw_matches: string[],
 *   off_ontology: boolean,
 *   implied_facts: Record<string, any>,
 * }}
 */
export function classify(query) {
  const q = (query || '').trim()
  if (!q) return { concerns: {}, resources_at_stake: [], raw_matches: [], off_ontology: true }

  const concerns = {}
  const resources = new Set()
  const matches = []

  for (const rule of RULES) {
    if (rule.match.test(q)) {
      matches.push(rule.match.source)
      for (const [concern, weight] of Object.entries(rule.concerns)) {
        concerns[concern] = Math.max(concerns[concern] || 0, weight)
      }
      for (const r of rule.resources) resources.add(r)
    }
  }

  // If nothing matched, mark off-ontology — synthesizer can offer generic + advise
  const offOntology = Object.keys(concerns).length === 0

  // Normalise concerns to [0, 1]
  // (already are — we use max not sum — but explicit)

  return {
    concerns,
    resources_at_stake: Array.from(resources),
    raw_matches: matches,
    off_ontology: offOntology,
    implied_facts: deriveImpliedFacts(q),
    intent: deriveIntent(q),
  }
}

/**
 * Helper — top N concerns by weight.
 */
export function topConcerns(classification, n = 3) {
  return Object.entries(classification.concerns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, w]) => ({ id, weight: w }))
}
