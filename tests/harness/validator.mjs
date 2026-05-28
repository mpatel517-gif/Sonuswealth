// ─────────────────────────────────────────────────────────────────────────────
// Snapshot validator — asks DeepSeek to verify engine output is plausible
// for a given persona × tax year.
// ─────────────────────────────────────────────────────────────────────────────

import { callDeepSeekJSON } from './deepseek-client.mjs';

const SYSTEM_PROMPT = `You are a senior UK Chartered Financial Planner with 20+ years
of experience reviewing financial planning software output. Your job is to verify
whether engine outputs are plausible given the persona profile and the UK tax rules
that applied in the specified tax year.

You must return ONLY a JSON object with this exact schema:
{
  "results": [
    {
      "category": "tax" | "cashflow" | "balance_sheet" | "protection" | "estate" | "risk",
      "status": "PASS" | "WARN" | "FAIL",
      "comment": "short factual explanation (under 30 words)"
    }
  ],
  "overall": "PASS" | "WARN" | "FAIL",
  "score": 0-100,
  "headline": "one-sentence summary"
}

Rules:
- PASS = engine output is plausible for this persona in this year
- WARN = plausible but worth a human review (edge case, ambiguous)
- FAIL = engine output is implausible — wrong band, missing taper, breaches allowance, etc.
- Do not be lenient. If you can't justify PASS with UK 2025/26 rules, return WARN or FAIL.
- Always include category 'overall' in results plus one per topic listed above.`;

function fmt(n) {
  if (n == null || Number.isNaN(n)) return 'n/a';
  if (typeof n !== 'number') return String(n);
  return '£' + Math.round(n).toLocaleString('en-GB');
}

function personaSummary(p) {
  const name = p.name || p.displayName || 'unnamed';
  const age = p.age ?? (p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : 'unknown');
  const arch = p.archetype || p.lifeStageName || p.type || 'individual';
  const status = p.household_status || p.status || (p.isCouple ? 'couple' : 'single');
  // Phase C: the static `isHigherRateTaxpayer` flag is unreliable for
  // decumulation personas (Bruce had it as false despite £96k drawdown). Note
  // the flag but let DeepSeek decide tax-band from the actual snapshot
  // pl.gross_income — the prompt below carries that figure.
  const hrFlag = p.isHigherRateTaxpayer ? 'flagged higher-rate' : 'flagged basic-rate';
  const target = p.targetIncome ? `target income £${p.targetIncome.toLocaleString()}` : '';
  return `${name}, age ${age}, ${arch} (${status}, ${hrFlag} — actual band derives from gross income in P&L below)${target ? '; ' + target : ''}`;
}

export function buildPrompt(persona, taxYear, macroVars, engineOutput) {
  const bs = engineOutput.balance_sheet || {};
  const pl = engineOutput.pl || {};
  const cf = engineOutput.cashflow || {};
  const est = engineOutput.estate || {};

  return `Persona: ${personaSummary(persona)}
Tax year under review: ${taxYear}

UK macro context for ${taxYear}:
- CPI: ${(macroVars.cpi_inflation * 100).toFixed(1)}%
- BoE base rate: ${(macroVars.boe_base_rate * 100).toFixed(2)}%
- House price growth: ${(macroVars.house_price_growth * 100).toFixed(1)}%
- Wage growth: ${(macroVars.wage_growth * 100).toFixed(1)}%
- Personal allowance: ${fmt(macroVars.personal_allowance || 12570)}
- ISA limit: ${fmt(macroVars.isa_limit || 20000)}
- Pension AA: ${fmt(macroVars.pension_aa || 60000)}

Household context:
- Status: ${engineOutput.is_couple ? 'COUPLE (married/civil partnership)' : 'SINGLE'}
- Spousal nil-rate transfer available: ${engineOutput.spousal_nrb_available ? 'YES — combined NRB £' + (engineOutput.effective_nrb || 650000).toLocaleString() + ' + RNRB £' + (engineOutput.effective_rnrb || 350000).toLocaleString() : 'NO — single NRB £325,000 + RNRB £175,000'}

IHT rules reminder (the engine applies these; do not flag as wrong if engine RNRB = £0 on a large estate):
- RNRB tapers £1 for every £2 of gross estate above £2,000,000 (s8D IHTA 1984)
- For singles: RNRB hits £0 at gross estate £2.35M
- For couples (with transferred RNRB): RNRB hits £0 at gross estate £2.7M
- A gross estate of £8M+ has RNRB tapered fully to £0 — that's correct, not a bug
- SIPPs are OUTSIDE the IHT estate until 6 April 2027. For tax years ending before that date the engine excludes SIPP from gross estate — that is correct.
- State pension active: ${pl.state_pension > 0 ? 'YES, £' + pl.state_pension.toLocaleString() + '/yr' : 'NO (pre-state-pension-age)'}
- IHT GROSS ESTATE vs NET WORTH: gross estate is sum of CHARGEABLE assets at death — it does NOT deduct outstanding mortgages, secured loans, or personal debts for the purpose of the NRB/RNRB comparison. So gross estate > net worth is NORMAL on any persona with debt. Example: assets £1.4M, mortgage £0.5M, NW £0.9M but gross estate £1.4M because liabilities reduce NW, not gross estate. Funeral expenses and a small class of allowable debts are deductible at the FINAL liability stage, after gross-estate determination. Do NOT flag (gross estate > NW by amount of mortgage/loan outstanding) as an inconsistency.

Engine output:
- Net worth: ${fmt(engineOutput.net_worth)}
- Caelixa Wealth Score: ${engineOutput.fq_score ?? 'n/a'}/100 (band: ${engineOutput.fq_band ?? 'n/a'})
- Caelixa Risk Score: ${engineOutput.risk_score ?? 'n/a'}/100 (band: ${engineOutput.risk_band ?? 'n/a'})
- Gross taxable income: ${fmt(pl.gross_income)} (drawdown ${fmt(pl.effective_drawdown)} + employment ${fmt(pl.employment_income)} + state pension ${fmt(pl.state_pension)})
- Income tax (engine): ${fmt(pl.income_tax)}
- NI contributions: ${fmt(pl.ni)}
- Net income after tax+NI: ${fmt(pl.net_income)}
- Effective tax rate: ${pl.effective_tax_rate ?? 'n/a'}%
- Pension contributions: ${fmt(pl.pension_contributions)}
- Monthly expenditure: ${fmt(pl.monthly_expenditure)}
- ISA balance: ${fmt(bs.isa)}
- SIPP balance: ${fmt(bs.sipp)}
- Cash: ${fmt(bs.cash)}
- Property: ${fmt(bs.property)}
- Mortgage: ${fmt(bs.mortgage)}
- IHT exposure: ${fmt(est.iht_exposure || engineOutput.iht_exposure)}
- IHT breakdown: ${engineOutput.iht_breakdown ? `gross ${fmt(engineOutput.iht_breakdown.gross)}, NRB ${fmt(engineOutput.iht_breakdown.nrb)}, RNRB ${fmt(engineOutput.iht_breakdown.rnrb)}, taxable ${fmt(engineOutput.iht_breakdown.taxable)}` : 'n/a'}
- Annual cashflow surplus: ${fmt(cf.annual_surplus || cf.surplus)}
- Funded ratio: ${cf.funded_ratio ?? 'n/a'}
- Cost of Inaction (IHT, current): ${fmt(engineOutput.cost_of_inaction)}
- SIPP IHT inclusion: ${parseInt(taxYear.split('/')[0]) >= 2027 ? 'YES (post-April 2027 effective date)' : 'NO (pre-April 2027 — SIPPs outside estate)'}

NOTE on IHT for couples: When status=COUPLE, the engine correctly returns IHT=£0 even if gross estate > single NRB+RNRB, because spousal nil-rate transfer doubles the threshold to £1M (£650k NRB + £350k RNRB) provided assets pass to a UK-domiciled spouse. Do NOT flag IHT=£0 as wrong for a couple with estate < £1M.

Validate each category. Respond with the JSON schema only.`;
}

export async function validateSnapshot(persona, taxYear, macroVars, engineOutput, opts = {}) {
  const prompt = buildPrompt(persona, taxYear, macroVars, engineOutput);
  const start = Date.now();
  try {
    const r = await callDeepSeekJSON(prompt, {
      system: SYSTEM_PROMPT,
      temperature: 0.05,
      max_tokens: 800,
      ...opts,
    });
    return {
      success: !!r.json,
      verdict: r.json,
      raw: r.text,
      tokens: r.tokens_used,
      duration_ms: r.duration_ms,
      parse_error: r.parse_error || null,
    };
  } catch (e) {
    return {
      success: false,
      verdict: null,
      error: e.message,
      duration_ms: Date.now() - start,
    };
  }
}
