// Executable-commit content for the Decision Engine. When a user commits a
// decision (DE-01..DE-40), this supplies the plain-English action checklist for
// the chosen option + when to revisit. Descriptive/guidance only — the app
// informs and stores, it does NOT transact. No "we will…", no "you should", no
// "best", no hardcoded £/% (those come live from the engine). Path ids mirror
// pathDefs in decision-engine.js + decision-content.js exactly.
export const COMMIT_CONTENT = {
  'DE-01': {
    reviewHint: 'Revisit each tax year, and again if your income or spending changes.',
    options: {
      lump:   { checklist: ['Ask your pension provider how to take the whole pot.', 'Work out the tax due in the year you take it.', 'Decide where the after-tax money will sit until you need it.', 'Keep a record for your tax return.'] },
      phased: { checklist: ['Tell your provider how much to draw this year.', 'Aim to keep each year’s income within a lower tax band.', 'Set a reminder to review the amount before each tax year ends.'] },
      defer:  { checklist: ['Confirm you can live on your other income for now.', 'Leave the pot invested and note when you plan to start drawing.', 'Set a reminder to review in a year.'] },
    },
  },
  'DE-02': {
    reviewHint: 'Revisit at your chosen review age, or sooner if your health or income needs change.',
    options: {
      buy_now:  { checklist: ['Ask several providers for an annuity quote.', 'Check whether a spouse’s pension or inflation-linking is included.', 'Compare the quotes before you buy.', 'Keep the policy paperwork safe.'] },
      defer_5:  { checklist: ['Note the date you plan to revisit buying an annuity.', 'Confirm your other income covers you until then.', 'Keep the pot invested in the meantime.', 'Set a reminder for the review.'] },
      drawdown: { checklist: ['Set up a flexi-access drawdown plan with your provider.', 'Decide how much to draw and how often.', 'Set a reminder to review the pot’s value each year.'] },
    },
  },
  'DE-03': {
    reviewHint: 'Revisit before the end of the tax year, and again if your income changes.',
    options: {
      no_change: { checklist: ['Note your current contribution level.', 'Set a reminder to review before the tax year ends.'] },
      top_up:    { checklist: ['Check how much of your annual allowance is left.', 'Increase your regular contribution or make a one-off payment.', 'Keep a record for your tax return if you are a higher-rate taxpayer.'] },
      carryback: { checklist: ['Confirm you have unused allowance from the last three years.', 'Check your earnings this year cover the total contribution.', 'Make the contribution and keep evidence of the carry-forward.'] },
    },
  },
  'DE-04': {
    reviewHint: 'Revisit if you change employer, become self-employed, or your contribution level changes.',
    options: {
      workplace_only: { checklist: ['Confirm you are capturing the full employer top-up.', 'Note your current contribution rate.', 'Set a reminder to review at your next pay change.'] },
      split:          { checklist: ['First contribute enough to capture the full employer top-up.', 'Open a personal pension (SIPP) for the rest.', 'Set up the extra contribution and keep both plans’ paperwork.'] },
      sipp_only:      { checklist: ['Open a personal pension (SIPP).', 'Set up a regular contribution within your allowance.', 'Keep records of contributions for your tax return.'] },
    },
  },
  'DE-05': {
    reviewHint: 'Revisit at your next salary review, or before the tax year ends.',
    options: {
      no_sacrifice: { checklist: ['Note that you are keeping your full salary.', 'Set a reminder to review at your next pay change.'] },
      partial:      { checklist: ['Ask your employer if salary sacrifice is available.', 'Agree the slice of salary to swap for pension.', 'Check the change does not take pay below the minimum wage.', 'Confirm the new amount on your next payslip.'] },
      maximum:      { checklist: ['Ask your employer to set sacrifice up to your annual allowance.', 'Check your remaining pay still covers your outgoings.', 'Confirm the change is applied on your next payslip.'] },
    },
  },
  'DE-06': {
    reviewHint: 'Revisit before the tax year ends, and if your timescale or goal changes.',
    options: {
      cash_isa:    { checklist: ['Open a cash ISA.', 'Move money in before the tax year ends to use this year’s allowance.', 'Note the goal this money is for.'] },
      ss_isa:      { checklist: ['Open a stocks & shares ISA.', 'Confirm you can leave the money invested for at least five years.', 'Set up the contribution within your allowance.'] },
      lisa:        { checklist: ['Check you are under 40 and saving for a first home.', 'Open a Lifetime ISA.', 'Pay in to claim the government bonus.', 'Remember the money is locked until a first home or age 60.'] },
      split_blend: { checklist: ['Open a stocks & shares ISA and a cash ISA.', 'Split your allowance between growth and an accessible buffer.', 'Set up contributions to each before the tax year ends.'] },
    },
  },
  'DE-07': {
    reviewHint: 'Revisit before the tax year ends to use each year’s allowances.',
    options: {
      hold_gia:   { checklist: ['Note you are leaving the investments where they are.', 'Set a reminder to review before the tax year ends.'] },
      bed_isa:    { checklist: ['Check how much ISA allowance you have left this year.', 'Sell the investments and rebuy the same inside your ISA.', 'Work out any tax on the gain when you sell.', 'Keep records of the sale and rebuy.'] },
      phased_bed: { checklist: ['Plan how much to move across each tax year.', 'Move the first slice this year, using your allowances.', 'Set a reminder to move the next slice next year.'] },
    },
  },
  'DE-08': {
    reviewHint: 'Revisit when your mortgage deal ends, or if your spare income changes.',
    options: {
      overpay: { checklist: ['Check your lender’s limit on penalty-free overpayments.', 'Set up the extra payment against the mortgage.', 'Keep a note of the reduced balance.'] },
      offset:  { checklist: ['Check whether you have an offset mortgage or can switch to one.', 'Move savings into the linked offset account.', 'Keep the savings accessible for emergencies.'] },
      invest:  { checklist: ['Confirm you can invest the money for the long term.', 'Choose a tax wrapper such as an ISA or pension first.', 'Set up the regular investment.'] },
      split:   { checklist: ['Decide how to divide spare money between overpaying and investing.', 'Set up the mortgage overpayment.', 'Set up the investment for the other portion.'] },
    },
  },
  'DE-09': {
    reviewHint: 'Revisit if your income needs, the property, or the tax rules change.',
    options: {
      keep_use:         { checklist: ['Note that you are keeping the property as your main home.', 'Keep the deeds and insurance details on file.'] },
      let:              { checklist: ['Check the rules and licences for letting in your area.', 'Find a tenant or a letting agent.', 'Register the rental income with HMRC and budget for the tax.', 'Keep records of rent and costs.'] },
      sell_isa_pension: { checklist: ['Get the property valued and put it on the market.', 'Work out any capital gains tax on the sale.', 'Move the proceeds into your ISA and pension within their allowances.'] },
      sell_isa:         { checklist: ['Get the property valued and put it on the market.', 'Work out any capital gains tax on the sale.', 'Move the proceeds into your ISA within the allowance.'] },
      sell_btl_replace: { checklist: ['Sell the current property and work out the capital gains tax.', 'Research higher-yielding rental areas before rebuying.', 'Buy the replacement rental and keep all the paperwork.'] },
    },
  },
  'DE-10': {
    reviewHint: 'Revisit a few months before your current deal ends.',
    options: {
      fix_2yr:   { checklist: ['Compare two-year fixed deals from several lenders.', 'Check any product and exit fees.', 'Apply for the deal before your current one ends.'] },
      fix_5yr:   { checklist: ['Compare five-year fixed deals from several lenders.', 'Confirm you are happy to be tied in for five years.', 'Apply for the deal before your current one ends.'] },
      tracker:   { checklist: ['Compare tracker deals and check the margin over the base rate.', 'Make sure your budget can absorb a rate rise.', 'Apply before your current deal ends.'] },
      offset_re: { checklist: ['Check whether your savings are large enough to make offsetting worthwhile.', 'Compare offset mortgage deals.', 'Apply and link your savings account.'] },
    },
  },
  'DE-11': {
    reviewHint: 'Revisit each tax year, and if your tax band or the landlord rules change.',
    options: {
      hold_btl:    { checklist: ['Note the rental income and costs for your tax return.', 'Set a reminder to review the figures each tax year.'] },
      incorporate: { checklist: ['Speak to an accountant about moving the property into a company.', 'Work out the stamp duty and capital gains tax on the transfer.', 'Set up the company and transfer the property if it stacks up.'] },
      sell_btl:    { checklist: ['Get the property valued and put it on the market.', 'Work out the capital gains tax on the sale.', 'Plan where the freed-up capital will go.'] },
    },
  },
  'DE-12': {
    reviewHint: 'Revisit if your cash needs change or before releasing any further amount.',
    options: {
      no_release:  { checklist: ['Note that you are leaving the home untouched.', 'Set a reminder to review if your cash needs change.'] },
      drawdown_er: { checklist: ['Speak to an FCA-authorised equity-release adviser — this is a regulated decision.', 'Discuss it with the people who would inherit.', 'Set up a drawdown lifetime mortgage and release cash only as needed.'] },
      lump_er:     { checklist: ['Speak to an FCA-authorised equity-release adviser — this is a regulated decision.', 'Discuss it with the people who would inherit.', 'Understand how the rolled-up interest reduces what you leave behind.', 'Arrange the lump-sum release.'] },
    },
  },
  'DE-13': {
    reviewHint: 'Revisit once a year, or whenever savings rates move noticeably.',
    options: {
      current_acct: { checklist: ['Note how much you are keeping in your current account.', 'Set a reminder to review the rate in a few months.'] },
      easy_access:  { checklist: ['Compare easy-access savings rates.', 'Open an account that is covered by the savings protection scheme.', 'Move your emergency cash across.'] },
      premium_bond: { checklist: ['Open a premium bonds account.', 'Move the cash in, keeping it within the holding limit.', 'Remember returns come as prizes, not interest.'] },
    },
  },
  'DE-14': {
    reviewHint: 'Revisit as each fixed bond matures, or when rates move.',
    options: {
      instant_only: { checklist: ['Note that you are keeping all the cash instantly accessible.', 'Set a reminder to review the rate in a few months.'] },
      ladder_3:     { checklist: ['Split the cash across a few short fixed-rate bonds.', 'Note when each one matures.', 'Set a reminder to reinvest as each matures.'] },
      ladder_12:    { checklist: ['Stagger the cash so a slice matures each month.', 'Open the fixed-rate bonds with the maturity dates spread out.', 'Set reminders to reinvest each maturing slice.'] },
    },
  },
  'DE-15': {
    reviewHint: 'Revisit each tax year, and note the seven-year clock on larger gifts.',
    options: {
      annual_exempt: { checklist: ['Check how much of this year’s gift allowance is unused.', 'Make the gift within the allowance.', 'Keep a dated record of the gift.'] },
      pet_gift:      { checklist: ['Confirm you can afford to give the money away for good.', 'Make the gift directly to the person.', 'Keep a dated record — the seven-year clock starts now.'] },
      trust_gift:    { checklist: ['Speak to a solicitor about setting up the trust.', 'Decide who the beneficiaries are and put the gift into the trust.', 'Keep the trust deed and gift records safe.'] },
    },
  },
  'DE-16': {
    reviewHint: 'Revisit when family circumstances change or at the trust’s periodic review.',
    options: {
      bare_trust: { checklist: ['Speak to a solicitor about a bare trust.', 'Name the beneficiary, who receives it at eighteen.', 'Sign the trust deed and keep it safe.'] },
      disc_trust: { checklist: ['Speak to a solicitor about a discretionary trust.', 'Decide the potential beneficiaries and your wishes.', 'Sign the trust deed and note the periodic tax-review dates.'] },
      iip_trust:  { checklist: ['Speak to a solicitor about an interest-in-possession trust.', 'Name who receives income now and who receives capital later.', 'Sign the trust deed and keep it safe.'] },
    },
  },
  'DE-17': {
    reviewHint: 'Revisit after any major life event — marriage, children, or a death in the family.',
    options: {
      simple_will:   { checklist: ['Speak to a solicitor or will writer.', 'Decide who inherits and who will act as executor.', 'Sign the will correctly and store it safely.'] },
      mirror_will:   { checklist: ['Speak to a solicitor about matching wills for you both.', 'Agree how everything passes between you and then to others.', 'Both sign your wills and store them safely.'] },
      li_trust_will: { checklist: ['Speak to a solicitor about a will with a protective trust.', 'Decide who has the income and who receives the capital later.', 'Sign the will and keep it with the trust details.'] },
    },
  },
  'DE-18': {
    reviewHint: 'Revisit if your chosen attorney’s circumstances change; review every few years.',
    options: {
      no_lpa:    { checklist: ['Note that no power of attorney is in place.', 'Set a reminder to reconsider this.'] },
      fin_lpa:   { checklist: ['Choose someone you trust to handle money and property.', 'Complete a financial power of attorney form.', 'Register it with the Office of the Public Guardian.'] },
      both_lpas: { checklist: ['Choose someone you trust for money and for health decisions.', 'Complete both the financial and the health power of attorney forms.', 'Register both with the Office of the Public Guardian.'] },
    },
  },
  'DE-19': {
    reviewHint: 'Revisit when your mortgage, income, or family situation changes.',
    options: {
      term:      { checklist: ['Decide the amount of cover and how many years you need it.', 'Compare level-term quotes from several insurers.', 'Apply and answer the health questions honestly.'] },
      fib:       { checklist: ['Decide the monthly income your family would need.', 'Compare family-income-benefit quotes.', 'Apply and answer the health questions honestly.'] },
      wol_trust: { checklist: ['Speak to an adviser about whole-of-life cover for inheritance tax.', 'Apply for the policy.', 'Write the policy in trust so the payout sits outside your estate.'] },
    },
  },
  'DE-20': {
    reviewHint: 'Revisit when your income, mortgage, or health cover needs change.',
    options: {
      no_ci:     { checklist: ['Note that you are relying on savings and other cover.', 'Set a reminder to review your protection.'] },
      top_up_ci: { checklist: ['Decide on cover worth a few years of salary.', 'Compare critical-illness quotes from several insurers.', 'Apply and answer the health questions honestly.'] },
      full_ci:   { checklist: ['Decide on cover that also clears the mortgage.', 'Compare comprehensive critical-illness quotes.', 'Check the premium fits your budget, then apply honestly.'] },
    },
  },
  'DE-21': {
    reviewHint: 'Revisit if your job, income, or other sick-pay cover changes.',
    options: {
      any_occ:   { checklist: ['Understand this only pays if you cannot do any job at all.', 'Compare any-occupation income-protection quotes.', 'Apply and answer the health questions honestly.'] },
      own_occ:   { checklist: ['Confirm the policy pays if you cannot do your own job.', 'Compare own-occupation quotes from several insurers.', 'Apply and answer the health questions honestly.'] },
      budget_ip: { checklist: ['Decide on a lower-cost policy that tops up state benefits.', 'Check the waiting period and how long it pays out.', 'Apply and answer the health questions honestly.'] },
    },
  },
  'DE-22': {
    reviewHint: 'Revisit before the tax year ends — the allowance is lost if unused.',
    options: {
      no_harvest:  { checklist: ['Note you are taking no gains this year.', 'Set a reminder to review before the tax year ends.'] },
      harvest_now: { checklist: ['Work out which investments have a gain to take.', 'Sell enough to use this year’s tax-free gains allowance.', 'Wait the required period or use a spouse or ISA before rebuying.', 'Keep records of the sale.'] },
      harvest_isa: { checklist: ['Sell enough to use this year’s tax-free gains allowance.', 'Rebuy the holding inside your ISA.', 'Keep records of the sale and rebuy.'] },
    },
  },
  'DE-23': {
    reviewHint: 'Revisit before the tax year ends if you have gains a loss could offset.',
    options: {
      hold_loss:    { checklist: ['Note that you are holding and waiting for recovery.', 'Set a reminder to review the position.'] },
      realise_loss: { checklist: ['Confirm you have gains this year the loss can offset.', 'Sell the holding to crystallise the loss.', 'Report the loss to HMRC and keep the records.'] },
      rebuy_isa:    { checklist: ['Sell the holding to crystallise the loss.', 'Rebuy it inside your ISA.', 'Report the loss to HMRC and keep the records.'] },
    },
  },
  'DE-24': {
    reviewHint: 'Revisit before the tax year ends, and if either partner’s tax rate changes.',
    options: {
      no_transfer: { checklist: ['Note you are keeping assets in your own name.', 'Set a reminder to review before the tax year ends.'] },
      asset_xfer:  { checklist: ['Confirm your spouse pays a lower tax rate.', 'Transfer income-producing assets into their name.', 'Keep a record of the transfer.'] },
      isa_max:     { checklist: ['Open or top up an ISA for each of you.', 'Fill both ISA allowances before the tax year ends.', 'Keep records of both contributions.'] },
    },
  },
  'DE-25': {
    reviewHint: 'Revisit each tax year and before your company’s year-end.',
    options: {
      salary_only:   { checklist: ['Set the salary level with your payroll.', 'Note the National Insurance and tax this attracts.', 'Set a reminder to review before year-end.'] },
      optimal_mix:   { checklist: ['Ask your accountant for the salary-and-dividend split that suits you.', 'Set the salary through payroll and minute the dividends.', 'Keep dividend vouchers and board minutes.'] },
      pension_route: { checklist: ['Confirm you can leave the money for retirement.', 'Arrange for the company to pay into your pension.', 'Keep records for the company’s corporation tax relief.'] },
    },
  },
  'DE-26': {
    reviewHint: 'Revisit before the tax year ends and after the minimum holding period.',
    options: {
      no_eis: { checklist: ['Note that you are keeping the money accessible.', 'Set a reminder to review before the tax year ends.'] },
      seis:   { checklist: ['Confirm you can afford to lose the money — these are high-risk.', 'Choose an approved SEIS investment or fund.', 'Keep the relief certificate for your tax return.'] },
      eis:    { checklist: ['Confirm you accept high risk and a multi-year lock-in.', 'Choose an approved EIS investment or fund.', 'Keep the relief certificate for your tax return.'] },
    },
  },
  'DE-27': {
    reviewHint: 'Revisit before the tax year ends and after the minimum holding period.',
    options: {
      no_vct:  { checklist: ['Note that you are keeping the cash flexible.', 'Set a reminder to review before the tax year ends.'] },
      vct_5k:  { checklist: ['Confirm you can hold the investment for the minimum period.', 'Choose a venture capital trust and make a modest investment.', 'Keep the relief certificate for your tax return.'] },
      vct_max: { checklist: ['Confirm you accept the risk and concentration.', 'Choose a venture capital trust and invest up to the limit.', 'Keep the relief certificate for your tax return.'] },
    },
  },
  'DE-28': {
    reviewHint: 'Revisit after the two-year qualifying period and if your estate changes.',
    options: {
      no_bpr:       { checklist: ['Note that you are leaving the estate as it is.', 'Set a reminder to review your inheritance-tax position.'] },
      bpr_aim:      { checklist: ['Confirm you accept the volatility of smaller-company shares.', 'Invest in a qualifying business-relief portfolio.', 'Keep records and note the two-year qualifying date.'] },
      bpr_unlisted: { checklist: ['Choose a managed business-relief fund.', 'Make the investment.', 'Keep records and note the two-year qualifying date.'] },
    },
  },
  'DE-29': {
    reviewHint: 'Revisit each tax year, and when reviewing your will.',
    options: {
      no_give:  { checklist: ['Note that you are making no charitable gifts.', 'Set a reminder to revisit.'] },
      gift_aid: { checklist: ['Choose the charity and make the donation.', 'Tick the Gift Aid box so the charity can reclaim tax.', 'Keep the receipt for your tax return if you are a higher-rate taxpayer.'] },
      legacy:   { checklist: ['Speak to a solicitor about a charitable legacy in your will.', 'Set the legacy at the level that lowers the inheritance-tax rate.', 'Update and sign your will.'] },
    },
  },
  'DE-30': {
    reviewHint: 'Revisit each year as fees and the child’s age change.',
    options: {
      no_plan:        { checklist: ['Note that you are paying fees from income as they arise.', 'Set a reminder to review if the fees grow.'] },
      jisa:           { checklist: ['Open a Junior ISA for the child.', 'Set up a regular contribution within the allowance.', 'Remember the child can access it at eighteen.'] },
      bare_trust_edu: { checklist: ['Speak to a solicitor about a bare trust for education costs.', 'Set it up and pay contributions in.', 'Keep records — income is taxed at the child’s rate.'] },
    },
  },
  'DE-31': {
    reviewHint: 'Revisit before the break starts and as your savings buffer changes.',
    options: {
      work_through: { checklist: ['Note that you are continuing to work.', 'Set a reminder to revisit if your plans change.'] },
      short_break:  { checklist: ['Check your emergency fund covers the months off.', 'Plan how bills are paid during the break.', 'Note the effect on your National Insurance record.'] },
      full_sabbat:  { checklist: ['Confirm your savings and investments can bridge the longer gap.', 'Plan how bills and pension contributions are handled.', 'Note the gap in your National Insurance record and a return-to-work plan.'] },
    },
  },
  'DE-32': {
    reviewHint: 'Revisit once you have a clear plan for your next income, or before the tax year ends.',
    options: {
      cash_hold:    { checklist: ['Move the lump sum into an accessible savings account.', 'Note how long you expect to need it close to hand.', 'Set a reminder to review once you are settled.'] },
      pension_wrap: { checklist: ['Check how much pension annual allowance you have.', 'Pay the lump sum into your pension.', 'Keep records for your tax return.'] },
      diversified:  { checklist: ['Decide how to split the money across pension, ISA and investments.', 'Fill the tax wrappers first, within their allowances.', 'Keep an accessible cash buffer for the near term.'] },
    },
  },
  'DE-33': {
    reviewHint: 'Revisit before the tax year ends and once you have a settled plan.',
    options: {
      bank_hold: { checklist: ['Keep the money in an accessible account while you decide.', 'Set a reminder to review within a few months.'] },
      wrap_max:  { checklist: ['Fill your ISA, then your pension, within their allowances.', 'Invest any remainder in a general investment account.', 'Keep records of where the money went.'] },
      property:  { checklist: ['Research rental areas and the costs of being a landlord.', 'Confirm you accept that the money is tied up.', 'Buy the rental and keep all the paperwork.'] },
    },
  },
  'DE-34': {
    reviewHint: 'Revisit as the settlement progresses; reflect it in your will and pensions afterwards.',
    options: {
      clean_break: { checklist: ['Speak to a family solicitor about a clean-break settlement.', 'Agree a pension-sharing order if pensions are involved.', 'Get the agreement made into a court order.'] },
      maintenance: { checklist: ['Speak to a family solicitor about ongoing maintenance.', 'Agree the monthly amount and how long it lasts.', 'Get the agreement made into a court order.'] },
      deferred:    { checklist: ['Speak to a family solicitor about delaying the sale of the home.', 'Agree the trigger for selling, such as the youngest child turning eighteen.', 'Get the arrangement made into a court order.'] },
    },
  },
  'DE-35': {
    reviewHint: 'Revisit before you complete the sale and check the qualifying conditions early.',
    options: {
      no_badr:    { checklist: ['Note you are selling without special relief.', 'Work out the capital gains tax due.', 'Plan where the proceeds will go.'] },
      badr_claim: { checklist: ['Ask your accountant to confirm you meet the relief conditions.', 'Make sure the qualifying period is met before completing.', 'Claim the relief and keep the supporting records.'] },
      earnout:    { checklist: ['Agree a staged earnout with the buyer.', 'Ask your accountant how the tax falls across the years.', 'Keep records of each payment as it arrives.'] },
    },
  },
  'DE-36': {
    reviewHint: 'Revisit before the company’s year-end to avoid the loan-related tax charge.',
    options: {
      repay_loan: { checklist: ['Confirm the company has the cash to be repaid.', 'Repay the loan before the company’s year-end.', 'Record the repayment in the company accounts.'] },
      div_clear:  { checklist: ['Check the company has enough profit to declare a dividend.', 'Declare the dividend and use it to clear the loan.', 'Minute the dividend and keep the records.'] },
      write_off:  { checklist: ['Speak to your accountant — a write-off is taxed as income.', 'Confirm the company formally writes off the loan.', 'Record it for your tax return and the company accounts.'] },
    },
  },
  'DE-37': {
    reviewHint: 'Revisit only if your circumstances change materially — this is a one-off, hard-to-reverse decision.',
    options: {
      keep_db:      { checklist: ['Note that you are keeping the guaranteed pension.', 'File your scheme statements safely.'] },
      transfer_dc:  { checklist: ['Speak to an FCA-authorised adviser — transferring a final-salary pension legally requires regulated advice.', 'Ask the scheme for a transfer value (CETV) and its expiry date.', 'Understand the guaranteed income you would give up before deciding.'] },
      partial_xfer: { checklist: ['Check the scheme allows a partial transfer of the top-up part.', 'Speak to an FCA-authorised adviser about moving only the top-up element.', 'Keep the core guaranteed benefit and file the paperwork.'] },
    },
  },
  'DE-38': {
    reviewHint: 'Revisit each year, and again if your income needs or health change.',
    options: {
      full_drawdown:   { checklist: ['Note that you are keeping the pot invested and drawing flexibly.', 'Set a reminder to review the pot’s value each year.'] },
      partial_annuity: { checklist: ['Decide how much income you want guaranteed.', 'Get annuity quotes for that portion from several providers.', 'Buy the annuity for part and keep the rest invested.'] },
      full_annuity:    { checklist: ['Get annuity quotes from several providers.', 'Check whether a spouse’s pension or inflation-linking is included.', 'Convert the pot to a guaranteed income for life.'] },
    },
  },
  'DE-39': {
    reviewHint: 'Revisit well before you leave — the residency and tax rules turn on timing.',
    options: {
      stay_uk:        { checklist: ['Note that you are remaining a UK resident.', 'Set a reminder to revisit if your plans change.'] },
      plan_exit:      { checklist: ['Speak to a tax adviser experienced in leaving the UK.', 'Check how the residency test and your day-count affect your timing.', 'Plan the departure to limit avoidable tax charges.'] },
      immediate_exit: { checklist: ['Speak to a tax adviser before you leave — a tax charge on gains can apply.', 'Work out the tax due in your year of departure.', 'Keep records of your residency and the dates you leave.'] },
    },
  },
  'DE-40': {
    reviewHint: 'Revisit when care needs change or before any care arrangement is agreed.',
    options: {
      self_fund:        { checklist: ['Work out how long your assets and income can fund care.', 'Plan which assets you would draw on first.', 'Keep records of care costs paid.'] },
      deferred_payment: { checklist: ['Ask the council about a deferred-payment agreement.', 'Understand that the cost, plus interest, is recovered from your home later.', 'Keep the agreement paperwork safe.'] },
      ltc_insurance:    { checklist: ['Speak to an adviser about long-term-care insurance — buy before care is needed.', 'Compare what each policy guarantees to cover.', 'Take out the policy and keep the documents.'] },
    },
  },
}

export function commitContentFor(code) { return COMMIT_CONTENT[code] || null }
export function checklistFor(code, pathId) {
  const c = COMMIT_CONTENT[code]
  return (c?.options?.[pathId]?.checklist) || c?.options?.default?.checklist || []
}
export function reviewHintFor(code) { return COMMIT_CONTENT[code]?.reviewHint || null }
