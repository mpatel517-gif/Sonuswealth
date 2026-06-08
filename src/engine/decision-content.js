// Plain-English framing + option glosses for the Decision Engine (founder 2026-06-06:
// "not plain English … I don't understand all the options … what are the goals and
// objectives of that decision"). Descriptive only — all £/% figures come live from the
// engine; never hardcode amounts/rates here.
export const DECISION_CONTENT = {
  'DE-01': {
    objective: {
      decision: 'How to take money out of your pension pot.',
      why: 'How fast you draw changes the tax you pay and how long the pot lasts.',
      goal: 'Get the income you need while keeping the tax bill as low as you can.',
    },
    options: {
      lump:   { plain: 'Take the whole pot out at once.',                goodIf: 'You need a large sum now and accept the tax hit.' },
      phased: { plain: 'Draw a bit each year over several years.',       goodIf: 'You want to stay in a lower tax band each year.' },
      defer:  { plain: 'Leave it invested and draw later.',              goodIf: 'You can live on other income for now.' },
    },
  },
  'DE-02': {
    objective: {
      decision: 'Whether to swap a pension pot for a guaranteed income now.',
      why: 'An annuity pays a fixed income for life, but the rate you get rises as you age.',
      goal: 'Decide between certainty today and a higher guaranteed income later.',
    },
    options: {
      buy_now:  { plain: 'Buy a guaranteed lifetime income now.',         goodIf: 'You want certainty and steady income straight away.' },
      defer_5:  { plain: 'Wait a few years, then buy.',                    goodIf: 'You can wait for a better rate and have other income.' },
      drawdown: { plain: 'Keep it invested and draw flexibly instead.',   goodIf: 'You want flexibility and accept the risk of running out.' },
    },
  },
  'DE-03': {
    objective: {
      decision: 'How much to pay into your pension this year.',
      why: 'Pension contributions get tax relief and grow tax-free, but there is an annual cap.',
      goal: 'Use as much of your allowance as is worthwhile without a tax charge.',
    },
    options: {
      no_change: { plain: 'Leave your contributions as they are.',          goodIf: 'You are near your limit or need the cash now.' },
      top_up:    { plain: 'Pay in more, up to this year’s allowance.',      goodIf: 'You have spare income and want the tax relief.' },
      carryback: { plain: 'Also use unused allowance from past years.',     goodIf: 'You have a lump sum and earned enough this year.' },
    },
  },
  'DE-04': {
    objective: {
      decision: 'Where to put your pension contributions.',
      why: 'A workplace scheme can add an employer top-up; a personal SIPP gives you more choice.',
      goal: 'Capture any free employer money while keeping the flexibility you want.',
    },
    options: {
      workplace_only: { plain: 'Use your work pension only.',                       goodIf: 'You want simplicity and the employer top-up.' },
      split:          { plain: 'Take the work top-up, then add a personal pension.', goodIf: 'You want the match plus more investment choice.' },
      sipp_only:      { plain: 'Use a personal pension you control.',               goodIf: 'You are self-employed with no employer scheme.' },
    },
  },
  'DE-05': {
    objective: {
      decision: 'Whether to swap salary for pension contributions.',
      why: 'Giving up salary cuts your National Insurance, so more of your pay reaches your pension.',
      goal: 'Lower your National Insurance and boost your pension at the same time.',
    },
    options: {
      no_sacrifice: { plain: 'Keep your full salary as it is.',                   goodIf: 'You need every bit of take-home pay now.' },
      partial:      { plain: 'Swap a small slice of salary for pension.',        goodIf: 'You want some saving without a big pay cut.' },
      maximum:      { plain: 'Swap as much as your allowance permits.',          goodIf: 'You have surplus income and want maximum efficiency.' },
    },
  },
  'DE-06': {
    objective: {
      decision: 'Which tax-free ISA to use for your savings.',
      why: 'An ISA shelters returns from tax; the right type depends on your timescale and goal.',
      goal: 'Match the ISA to whether you need safety, growth, or a home deposit.',
    },
    options: {
      cash_isa:    { plain: 'A tax-free savings account.',                        goodIf: 'You need the money within a couple of years.' },
      ss_isa:      { plain: 'Invest in the markets, tax-free.',                   goodIf: 'You can invest for five years or more.' },
      lisa:        { plain: 'A first-home ISA with a government bonus.',          goodIf: 'You are under 40 and saving for a first home.' },
      split_blend: { plain: 'Mix investing with a cash buffer.',                  goodIf: 'You want growth but also some money you can reach.' },
    },
  },
  'DE-07': {
    objective: {
      decision: 'Whether to move taxable investments into a tax-free ISA.',
      why: 'Selling and rebuying inside an ISA can trigger a small tax charge now but shelters all future growth.',
      goal: 'Trade a small tax cost today for tax-free growth from here on.',
    },
    options: {
      hold_gia:   { plain: 'Leave the investments where they are.',              goodIf: 'You would rather not trigger any tax now.' },
      bed_isa:    { plain: 'Sell and rebuy them inside your ISA this year.',     goodIf: 'You want future gains sheltered and can use this year’s allowance.' },
      phased_bed: { plain: 'Move them across over a few years.',                 goodIf: 'You want to keep each year’s tax charge small.' },
    },
  },
  'DE-08': {
    objective: {
      decision: 'What to do with spare money against your mortgage.',
      why: 'Paying down the mortgage is a guaranteed saving; investing may earn more but is not certain.',
      goal: 'Balance a sure return from cutting debt against possible higher growth.',
    },
    options: {
      overpay: { plain: 'Pay extra off the mortgage.',                           goodIf: 'You want a guaranteed, risk-free return.' },
      offset:  { plain: 'Hold savings against the mortgage to cut interest.',    goodIf: 'You want the saving but keep access to your cash.' },
      invest:  { plain: 'Invest the spare money instead.',                       goodIf: 'You can invest long-term and accept the risk.' },
      split:   { plain: 'Do some of each.',                                      goodIf: 'You want to cut debt and chase growth together.' },
    },
  },
  'DE-09': {
    objective: {
      decision: 'What to do with a property you own.',
      why: 'Keeping, letting, or selling changes your income, your tax, and what your heirs pay.',
      goal: 'Match the property to what you need most — income, cash, or a smaller estate.',
    },
    options: {
      keep_use:         { plain: 'Keep it and live in it as your main home.',        goodIf: 'It is your home — selling your main home is tax-free.' },
      let:              { plain: 'Rent it out to a tenant.',                         goodIf: 'You want rental income and can handle tax and upkeep.' },
      sell_isa_pension: { plain: 'Sell it and move the money into tax-free wrappers.', goodIf: 'You want cash you can reach and lower future tax.' },
      sell_isa:         { plain: 'Sell it and move the money into tax-free wrappers.', goodIf: 'You want cash you can reach and lower future tax.' },
      sell_btl_replace: { plain: 'Sell it and buy a higher-income rental.',         goodIf: 'You want more rental income and are happy in property.' },
    },
  },
  'DE-10': {
    objective: {
      decision: 'Which type of mortgage deal to take next.',
      why: 'Fixing gives certainty; a tracker follows the Bank of England rate up or down.',
      goal: 'Choose between a predictable payment and the chance of a lower one.',
    },
    options: {
      fix_2yr:   { plain: 'Lock your rate for two years.',                       goodIf: 'You want a lower rate now and may move soon.' },
      fix_5yr:   { plain: 'Lock your rate for five years.',                      goodIf: 'You value certainty and a stable payment.' },
      tracker:   { plain: 'Pay a rate that moves with the base rate.',          goodIf: 'You think rates will fall and accept the risk.' },
      offset_re: { plain: 'Link savings to the mortgage to cut interest.',      goodIf: 'You hold savings and want flexibility.' },
    },
  },
  'DE-11': {
    objective: {
      decision: 'What to do about a buy-to-let caught by the landlord tax rules.',
      why: 'A rule limits how much mortgage interest landlords can offset, which can erode profit.',
      goal: 'Decide whether to keep, restructure, or exit the rental.',
    },
    options: {
      hold_btl:    { plain: 'Keep it and review each year.',                     goodIf: 'It still works and you want the income.' },
      incorporate: { plain: 'Move it into a limited company.',                   goodIf: 'You are a higher-rate taxpayer with several properties.' },
      sell_btl:    { plain: 'Sell up and free the capital.',                     goodIf: 'You want out of the tax drag and the hassle.' },
    },
  },
  'DE-12': {
    objective: {
      decision: 'Whether to release cash tied up in your home.',
      why: 'A lifetime mortgage frees cash but the interest rolls up and reduces what you leave behind.',
      goal: 'Weigh cash you can use now against the legacy you pass on.',
    },
    options: {
      no_release:  { plain: 'Leave the home untouched.',                         goodIf: 'You want to protect the full value for heirs.' },
      drawdown_er: { plain: 'Release cash in stages as you need it.',           goodIf: 'You want flexibility and lower rolled-up interest.' },
      lump_er:     { plain: 'Release a single large sum now.',                  goodIf: 'You need maximum cash up front.' },
    },
  },
  'DE-13': {
    objective: {
      decision: 'Where to keep your emergency cash.',
      why: 'Money in a current account earns little and loses value to inflation over time.',
      goal: 'Keep cash safe and reachable while earning a fair return.',
    },
    options: {
      current_acct: { plain: 'Leave it in your current account.',               goodIf: 'You want instant access above all else.' },
      easy_access:  { plain: 'Move it to an easy-access savings account.',      goodIf: 'You want interest with same-day access.' },
      premium_bond: { plain: 'Put it into premium bonds.',                      goodIf: 'You want tax-free, safe, and don’t mind a prize draw.' },
    },
  },
  'DE-14': {
    objective: {
      decision: 'How to arrange cash you don’t need straight away.',
      why: 'Spreading cash across short fixed bonds earns more than instant access while keeping some liquid.',
      goal: 'Earn a better rate while keeping cash maturing regularly.',
    },
    options: {
      instant_only: { plain: 'Keep it all instantly accessible.',               goodIf: 'You may need any of it at short notice.' },
      ladder_3:     { plain: 'Split across a few short fixed bonds.',           goodIf: 'You want a bit more interest with some access.' },
      ladder_12:    { plain: 'Stagger it so a slice matures each month.',       goodIf: 'You want the best rate with steady access.' },
    },
  },
  'DE-15': {
    objective: {
      decision: 'How to give money to your children tax-efficiently.',
      why: 'Some gifts are tax-free now; others only escape inheritance tax if you live seven years.',
      goal: 'Pass on wealth while reducing future inheritance tax.',
    },
    options: {
      annual_exempt: { plain: 'Give within the yearly tax-free gift limit.',     goodIf: 'You want a simple gift with no waiting period.' },
      pet_gift:      { plain: 'Give a larger gift directly to them.',            goodIf: 'You expect to live well beyond seven years.' },
      trust_gift:    { plain: 'Put the gift into a trust.',                      goodIf: 'You want to keep control over how it is shared.' },
    },
  },
  'DE-16': {
    objective: {
      decision: 'Which type of trust to use.',
      why: 'Trusts differ in how much control you keep and what tax charges apply over time.',
      goal: 'Match the trust to how much flexibility and protection you need.',
    },
    options: {
      bare_trust: { plain: 'A simple trust handed over at age eighteen.',        goodIf: 'You want it cheap and simple, with no control later.' },
      disc_trust: { plain: 'A flexible trust you can adjust over time.',         goodIf: 'You want control over who gets what and when.' },
      iip_trust:  { plain: 'Income now to one person, capital later to others.', goodIf: 'You want a partner to benefit, then children.' },
    },
  },
  'DE-17': {
    objective: {
      decision: 'What kind of will to put in place.',
      why: 'The structure of your will affects who inherits and how protected their share is.',
      goal: 'Make sure the right people inherit and shares are protected.',
    },
    options: {
      simple_will:   { plain: 'A straightforward will leaving gifts on death.',  goodIf: 'Your estate is simple and uncomplicated.' },
      mirror_will:   { plain: 'Matching wills for you and your partner.',        goodIf: 'You both want to leave everything to each other.' },
      li_trust_will: { plain: 'A will that protects capital for your children.', goodIf: 'You have a blended family or children from before.' },
    },
  },
  'DE-18': {
    objective: {
      decision: 'Whether to set up a power of attorney.',
      why: 'A power of attorney lets someone you trust act for you if you lose mental capacity.',
      goal: 'Make sure someone can manage your affairs if you cannot.',
    },
    options: {
      no_lpa:    { plain: 'Set nothing up for now.',                            goodIf: 'You accept the courts deciding if you lose capacity.' },
      fin_lpa:   { plain: 'Cover your money and property only.',                goodIf: 'You want the most urgent gap covered first.' },
      both_lpas: { plain: 'Cover both money and health decisions.',             goodIf: 'You want full protection in place.' },
    },
  },
  'DE-19': {
    objective: {
      decision: 'Which type of life cover to take out.',
      why: 'Policies differ in cost, whether they pay a lump sum or income, and how they help with inheritance tax.',
      goal: 'Protect your family at the cost and shape that fits them.',
    },
    options: {
      term:      { plain: 'Cheap cover for a set number of years.',             goodIf: 'You want to cover a mortgage or earning years.' },
      fib:       { plain: 'Pays your family a monthly income if you die.',      goodIf: 'You want to replace income rather than a lump sum.' },
      wol_trust: { plain: 'Lifelong cover held in trust.',                      goodIf: 'You want to help cover a future inheritance tax bill.' },
    },
  },
  'DE-20': {
    objective: {
      decision: 'Whether to add or increase critical illness cover.',
      why: 'It pays a tax-free lump sum if you are diagnosed with a serious illness.',
      goal: 'Give yourself a financial cushion if illness stops you earning.',
    },
    options: {
      no_ci:     { plain: 'Rely on savings and other cover instead.',          goodIf: 'You have strong savings and income protection.' },
      top_up_ci: { plain: 'Add cover worth a few years of salary.',            goodIf: 'You want a buffer through serious illness.' },
      full_ci:   { plain: 'Add cover that also clears the mortgage.',          goodIf: 'You want comprehensive protection and can fund it.' },
    },
  },
  'DE-21': {
    objective: {
      decision: 'Which type of income protection to choose.',
      why: 'Policies vary in how easily they pay out — some only pay if you can do no job at all.',
      goal: 'Choose cover that actually pays if you cannot do your work.',
    },
    options: {
      any_occ:   { plain: 'Pays only if you can do no job at all.',            goodIf: 'You want the lowest premium and accept harder claims.' },
      own_occ:   { plain: 'Pays if you can’t do your own job.',                goodIf: 'You want cover that protects your specific career.' },
      budget_ip: { plain: 'A lower-cost policy that tops up state benefits.',  goodIf: 'You want some cover on a tighter budget.' },
    },
  },
  'DE-22': {
    objective: {
      decision: 'Whether to use your yearly tax-free gains allowance.',
      why: 'You get a tax-free amount of investment gains each year that you lose if unused.',
      goal: 'Lock in tax-free gains now to cut future tax.',
    },
    options: {
      no_harvest:  { plain: 'Do nothing this year.',                           goodIf: 'You have no gains to take or prefer to wait.' },
      harvest_now: { plain: 'Sell enough to use this year’s allowance.',       goodIf: 'You want to bank tax-free gains and reset your cost.' },
      harvest_isa: { plain: 'Take the gain and rebuy inside an ISA.',          goodIf: 'You want future gains sheltered as well.' },
    },
  },
  'DE-23': {
    objective: {
      decision: 'What to do with an investment that has fallen.',
      why: 'Selling at a loss can reduce tax on gains made elsewhere this year.',
      goal: 'Use a loss to cut your overall tax bill, or wait for recovery.',
    },
    options: {
      hold_loss:    { plain: 'Hold and wait for it to recover.',               goodIf: 'You believe it will bounce back.' },
      realise_loss: { plain: 'Sell to set the loss against your gains.',       goodIf: 'You have gains this year a loss could offset.' },
      rebuy_isa:    { plain: 'Sell for the loss, then rebuy inside an ISA.',   goodIf: 'You want the tax saving and to keep the holding.' },
    },
  },
  'DE-24': {
    objective: {
      decision: 'Whether to move assets to a lower-earning spouse.',
      why: 'Transfers between spouses are tax-free, and the lower earner may pay less tax on the income.',
      goal: 'Lower the household tax bill using both partners’ allowances.',
    },
    options: {
      no_transfer: { plain: 'Keep everything in your own name.',               goodIf: 'You prefer to keep assets separate.' },
      asset_xfer:  { plain: 'Move income-producing assets to your spouse.',    goodIf: 'Your spouse pays a lower tax rate than you.' },
      isa_max:     { plain: 'Both of you fill your tax-free ISA allowances.',  goodIf: 'You want to double your tax-free shelter.' },
    },
  },
  'DE-25': {
    objective: {
      decision: 'How to pay yourself from your own company.',
      why: 'Mixing salary and dividends, or using pension, changes how much tax and National Insurance you pay.',
      goal: 'Take what you need from the company in the most tax-efficient way.',
    },
    options: {
      salary_only:   { plain: 'Pay yourself a normal salary.',                 goodIf: 'You want simplicity over tax efficiency.' },
      optimal_mix:   { plain: 'Mix a small salary with dividends.',            goodIf: 'You want to cut National Insurance and company tax.' },
      pension_route: { plain: 'Have the company pay into your pension.',        goodIf: 'You can leave the money for retirement.' },
    },
  },
  'DE-26': {
    objective: {
      decision: 'Whether to invest in young companies for tax relief.',
      why: 'These schemes give generous tax relief but the companies are high-risk and your money is locked in.',
      goal: 'Capture the tax relief only if you can accept high risk.',
    },
    options: {
      no_eis: { plain: 'Skip it and keep your money accessible.',              goodIf: 'You don’t want startup-level risk.' },
      seis:   { plain: 'Back very early-stage companies for top relief.',      goodIf: 'You can lose the money and want maximum relief.' },
      eis:    { plain: 'Back small growing companies for strong relief.',      goodIf: 'You accept high risk and a multi-year lock-in.' },
    },
  },
  'DE-27': {
    objective: {
      decision: 'Whether to invest in a venture trust for tax relief.',
      why: 'These pooled funds give income tax relief and tax-free dividends, but invest in smaller, riskier firms.',
      goal: 'Decide how much tax relief is worth the added risk.',
    },
    options: {
      no_vct:  { plain: 'Don’t invest, keep your cash flexible.',              goodIf: 'You want no extra risk.' },
      vct_5k:  { plain: 'Make a modest investment for some relief.',           goodIf: 'You want a small dose of relief and risk.' },
      vct_max: { plain: 'Invest the maximum for full relief.',                 goodIf: 'You want maximum relief and accept concentration.' },
    },
  },
  'DE-28': {
    objective: {
      decision: 'Whether to use business-relief investments to cut inheritance tax.',
      why: 'Some business shares can pass free of inheritance tax after two years, but they can be volatile.',
      goal: 'Reduce a future inheritance tax bill if you can hold the shares.',
    },
    options: {
      no_bpr:      { plain: 'Leave your estate as it is.',                     goodIf: 'You don’t want the extra investment risk.' },
      bpr_aim:     { plain: 'Invest in qualifying smaller-company shares.',    goodIf: 'You accept volatility for inheritance-tax relief.' },
      bpr_unlisted:{ plain: 'Use a managed business-relief fund.',            goodIf: 'You want the relief with steadier holdings.' },
    },
  },
  'DE-29': {
    objective: {
      decision: 'How to give to charity tax-efficiently.',
      why: 'Charitable gifts can reclaim tax and, if large enough, cut the inheritance tax rate on your estate.',
      goal: 'Support causes while reducing your tax.',
    },
    options: {
      no_give:  { plain: 'Make no charitable gifts.',                          goodIf: 'Giving is not a priority right now.' },
      gift_aid: { plain: 'Make a one-off donation with Gift Aid.',            goodIf: 'You want the charity and you to reclaim tax.' },
      legacy:   { plain: 'Leave a tenth of your estate to charity.',          goodIf: 'You want a lower inheritance tax rate on the rest.' },
    },
  },
  'DE-30': {
    objective: {
      decision: 'How to fund school or university fees.',
      why: 'Planning ahead in tax-efficient accounts spreads the cost and avoids a cash crunch later.',
      goal: 'Build a fund that meets fees without straining your budget.',
    },
    options: {
      no_plan:        { plain: 'Pay fees from income as they come up.',        goodIf: 'Your income comfortably covers the fees.' },
      jisa:           { plain: 'Save into a tax-free children’s ISA.',         goodIf: 'You have years to let savings grow tax-free.' },
      bare_trust_edu: { plain: 'Use a trust taxed at the child’s rate.',       goodIf: 'You want flexibility and a lower tax rate.' },
    },
  },
  'DE-31': {
    objective: {
      decision: 'Whether you can afford a career break.',
      why: 'Time off means no income for a while, drawing on savings and pausing your pension.',
      goal: 'See whether your finances can bridge a gap in earnings.',
    },
    options: {
      work_through: { plain: 'Keep working with no break.',                    goodIf: 'You can’t spare the income or savings.' },
      short_break:  { plain: 'Take a short, savings-funded break.',           goodIf: 'You have an emergency fund to cover a few months.' },
      full_sabbat:  { plain: 'Take a longer sabbatical.',                      goodIf: 'You have enough saved and accept the gap.' },
    },
  },
  'DE-32': {
    objective: {
      decision: 'What to do with a redundancy lump sum.',
      why: 'Leaving it in cash loses value to inflation; using tax wrappers can grow and shelter it.',
      goal: 'Put the lump sum to work tax-efficiently.',
    },
    options: {
      cash_hold:    { plain: 'Keep it in savings for now.',                    goodIf: 'You need it close to hand while job-hunting.' },
      pension_wrap: { plain: 'Put it into your pension.',                      goodIf: 'You can leave it for retirement and want tax relief.' },
      diversified:  { plain: 'Spread it across pension, ISA and investments.', goodIf: 'You want a balance of tax saving and access.' },
    },
  },
  'DE-33': {
    objective: {
      decision: 'How to use money you have inherited.',
      why: 'Where you put it changes your tax, your growth, and how easily you can reach it.',
      goal: 'Deploy the money to match your goals and tax position.',
    },
    options: {
      bank_hold: { plain: 'Leave it in the bank.',                             goodIf: 'You want it accessible while you decide.' },
      wrap_max:  { plain: 'Fill your ISA and pension first, then invest.',     goodIf: 'You want to maximise tax-free growth.' },
      property:  { plain: 'Buy a rental property.',                            goodIf: 'You want property income and accept it’s illiquid.' },
    },
  },
  'DE-34': {
    objective: {
      decision: 'How to structure a divorce financial settlement.',
      why: 'Different settlements affect ongoing income, pensions, the family home, and future tax.',
      goal: 'Reach a fair split that fits your needs going forward.',
    },
    options: {
      clean_break: { plain: 'Settle once with no ongoing ties.',              goodIf: 'You want a clean financial separation.' },
      maintenance: { plain: 'Agree an ongoing monthly payment.',             goodIf: 'You need or owe a regular income link.' },
      deferred:    { plain: 'Delay selling the family home.',                goodIf: 'You want to keep the home for the children.' },
    },
  },
  'DE-35': {
    objective: {
      decision: 'How to plan the sale of your business.',
      why: 'A relief can cut the tax on the gain if you qualify, and timing the proceeds can help too.',
      goal: 'Keep as much of the sale proceeds as the rules allow.',
    },
    options: {
      no_badr:    { plain: 'Sell with no special tax relief.',                goodIf: 'You don’t qualify or want a quick sale.' },
      badr_claim: { plain: 'Claim the lower tax rate for business owners.',   goodIf: 'You meet the qualifying conditions.' },
      earnout:    { plain: 'Spread the proceeds over a few years.',           goodIf: 'You want to spread the tax and the payments.' },
    },
  },
  'DE-36': {
    objective: {
      decision: 'How to deal with money you owe your own company.',
      why: 'A director’s loan left outstanding can trigger an extra company tax charge.',
      goal: 'Clear or settle the loan in the cheapest way.',
    },
    options: {
      repay_loan: { plain: 'Pay the loan back to the company.',               goodIf: 'You have the cash and want no tax cost.' },
      div_clear:  { plain: 'Clear it by declaring a dividend.',               goodIf: 'You’d rather settle it than find the cash.' },
      write_off:  { plain: 'Have the company write the loan off.',            goodIf: 'Rarely worthwhile — it is taxed as income.' },
    },
  },
  'DE-37': {
    objective: {
      decision: 'Whether to move out of a final-salary pension.',
      why: 'A final-salary pension pays a guaranteed income; transferring swaps that for a flexible pot but gives up the guarantee.',
      goal: 'Decide between a guaranteed income and flexible control.',
    },
    options: {
      keep_db:     { plain: 'Keep the guaranteed pension as it is.',          goodIf: 'You value certain, inflation-linked income.' },
      transfer_dc: { plain: 'Swap it for a flexible pot you control.',        goodIf: 'You want flexibility and accept losing the guarantee.' },
      partial_xfer:{ plain: 'Move only the top-up part, keep the core.',      goodIf: 'You want some flexibility but keep the guarantee.' },
    },
  },
  'DE-38': {
    objective: {
      decision: 'Whether to add a guaranteed income to your drawdown pot.',
      why: 'A guaranteed income gives a secure floor; staying invested keeps growth potential but more risk.',
      goal: 'Balance a secure income floor with room to grow.',
    },
    options: {
      full_drawdown:   { plain: 'Keep it all invested and draw flexibly.',    goodIf: 'You want growth and accept the risk.' },
      partial_annuity: { plain: 'Guarantee part, keep the rest invested.',    goodIf: 'You want a secure base plus some growth.' },
      full_annuity:    { plain: 'Convert it all to guaranteed income.',       goodIf: 'You want certainty for the rest of your life.' },
    },
  },
  'DE-39': {
    objective: {
      decision: 'How to handle tax if you leave the UK.',
      why: 'Leaving can trigger a tax charge on gains and changes how your estate is taxed.',
      goal: 'Plan a departure that limits avoidable tax charges.',
    },
    options: {
      stay_uk:        { plain: 'Stay a UK resident.',                         goodIf: 'You have no firm plans to move abroad.' },
      plan_exit:      { plain: 'Plan your departure carefully over time.',    goodIf: 'You intend to leave and want to do it cleanly.' },
      immediate_exit: { plain: 'Leave the UK this year.',                     goodIf: 'You must move now and accept the tax charge.' },
    },
  },
  'DE-40': {
    objective: {
      decision: 'How to pay for long-term care.',
      why: 'You can pay from your own money, defer payment against your home, or insure the cost in advance.',
      goal: 'Cover care costs while protecting as much of your estate as you can.',
    },
    options: {
      self_fund:        { plain: 'Pay for care from your own money.',         goodIf: 'You have the assets and want to keep control.' },
      deferred_payment: { plain: 'Let the council recover the cost from your home later.', goodIf: 'You want to keep your home rather than sell now.' },
      ltc_insurance:    { plain: 'Buy insurance that guarantees care costs.', goodIf: 'You want certainty and can fund it up front.' },
    },
  },
}

export function contentFor(code) { return DECISION_CONTENT[code] || null }
export function objectiveFor(code) { return DECISION_CONTENT[code]?.objective || null }
export function optionGloss(code, pathId) { return DECISION_CONTENT[code]?.options?.[pathId] || null }
