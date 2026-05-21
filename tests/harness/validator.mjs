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
  const age = p.age ?? p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : 'unknown';
  const arch = p.archetype || p.family || 'unknown';
  const status = p.household_status || p.status || '';
  return `${arch}${status ? ' / ' + status : ''}, age ${age}`;
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

Engine output:
- Net worth: ${fmt(engineOutput.net_worth)}
- Caelixa Wealth Score: ${engineOutput.fq_score ?? 'n/a'}/100
- Caelixa Risk Score: ${engineOutput.risk_score ?? 'n/a'}/100
- Income tax: ${fmt(pl.income_tax)}
- NI contributions: ${fmt(pl.ni)}
- Pension contributions: ${fmt(pl.pension_contributions)}
- ISA balance: ${fmt(bs.isa)}
- IHT exposure: ${fmt(est.iht_exposure || engineOutput.iht_exposure)}
- Annual cashflow surplus: ${fmt(cf.annual_surplus || cf.surplus)}
- Cost of Inaction (10yr): ${fmt(engineOutput.cost_of_inaction)}

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
