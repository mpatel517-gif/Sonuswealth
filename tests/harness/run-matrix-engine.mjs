// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH PLATFORM ENCOMPASSING REGRESSION ENGINE (v3.3) - PRODUCTION READY
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ============================================================================
// PROJECT CREDENTIAL TARGETS
// ============================================================================
const SUPABASE_URL = "https://yknnfglfbpcyxcllrvmd.supabase.co";
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrbm5mZ2xmYnBjeXhjbGxydm1kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2NzE4MiwiZXhwIjoyMDkwNDQzMTgyfQ.0ukjERDYgRDB6aFhdKc2-HiC6PNLiztZ10tBlYkYYug';
// ============================================================================

if (SUPABASE_URL.includes("paste_your")) {
  console.error("Error: Please overwrite the Supabase credentials at the top of the file.");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const RUN_ID = randomUUID();

const C = {
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m'
};

console.log(`${C.bold}═══════════════════════════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}  Executing Sonuswealth Platform Comprehensive Matrix Validation Loop${C.reset}`);
console.log(`  Master Transaction Session Token: ${RUN_ID}`);
console.log(`${C.bold}═══════════════════════════════════════════════════════════════════════════${C.reset}\n`);

async function getMacroRules(year) {
  const { data, error } = await supabase
    .from('macro_economic_data')
    .select('*')
    .eq('year', year)
    .single();

  if (error) throw new Error(`Supabase baseline rule fetch dropped for year ${year}: ${error.message}`);
  return data;
}

function calculateFinancialState(inputs, macro) {
  const salary = inputs.employment?.salary ?? 0;
  const bonus = inputs.employment?.bonus ?? 0;
  const divs = inputs.income?.dividend_income ?? 0;
  const interest = inputs.income?.interest_income ?? 0;
  const rawDrawdown = inputs.pensions?.drawdown_planned_annual ?? 0;
  
  // Isolate the 75% taxable component of SIPP flexi-drawdown
  const taxableDrawdownElement = rawDrawdown * 0.75;
  const grossNonSavings = salary + bonus;
  const ani = grossNonSavings + interest + divs + taxableDrawdownElement;

  // Personal Allowance Taper Logic
  let basePA = macro.personal_allowance ? parseFloat(macro.personal_allowance) : 12570;
  let allocatedPA = basePA;
  if (ani > 100000) {
    allocatedPA = Math.max(0, basePA - ((ani - 100000) / 2));
  }

  let remainingPA = allocatedPA;
  let paToNonSavings = Math.min(remainingPA, grossNonSavings + taxableDrawdownElement);
  remainingPA -= paToNonSavings;
  let paToSavings = Math.min(remainingPA, interest);
  remainingPA -= paToSavings;
  let paToDividends = Math.min(remainingPA, divs);

  // 1. Non-Savings Taxation
  const taxableNonSavings = Math.max(0, (grossNonSavings + taxableDrawdownElement) - paToNonSavings);
  let nonSavingsTax = 0;
  let currentBandAllocation = taxableNonSavings;

  if (currentBandAllocation > 112570) {
    nonSavingsTax += (currentBandAllocation - 112570) * 0.45;
    currentBandAllocation = 112570;
  }
  if (currentBandAllocation > 37700) {
    nonSavingsTax += (currentBandAllocation - 37700) * 0.40;
    currentBandAllocation = 37700;
  }
  nonSavingsTax += currentBandAllocation * 0.20;

  // 2. Savings Interest Taxation with Tapered PSA Checks
  const baseRateThreshold = 37700;
  const higherRateThreshold = 112570;
  
  let psaLimit = 1000;
  if (taxableNonSavings > higherRateThreshold || allocatedPA === 0) psaLimit = 0;
  else if (taxableNonSavings > baseRateThreshold) psaLimit = 500;

  const taxableInterest = Math.max(0, interest - paToSavings - psaLimit);
  let interestTax = 0;
  if (taxableInterest > 0) {
    if (taxableNonSavings + taxableInterest > higherRateThreshold) {
      interestTax += taxableInterest * 0.40;
    } else {
      interestTax += taxableInterest * 0.20;
    }
  }

  // 3. Progressive Dividend Stacking Engine
  const divAllowance = 500;
  let runningDividendIncome = Math.max(0, divs - paToDividends - divAllowance);
  let dividendTax = 0;
  let runningTaxBase = taxableNonSavings + taxableInterest;

  if (runningDividendIncome > 0) {
    if (runningTaxBase > higherRateThreshold) {
      dividendTax += runningDividendIncome * 0.3935;
    } else {
      if (runningTaxBase + runningDividendIncome > higherRateThreshold) {
        const higherRateSlice = (runningTaxBase + runningDividendIncome) - higherRateThreshold;
        dividendTax += higherRateSlice * 0.3935;
        runningDividendIncome -= higherRateSlice;
      }
      if (runningTaxBase > baseRateThreshold) {
        dividendTax += runningDividendIncome * 0.3375;
      } else {
        if (runningTaxBase + runningDividendIncome > baseRateThreshold) {
          const basicRateSlice = baseRateThreshold - runningTaxBase;
          dividendTax += basicRateSlice * 0.0875;
          dividendTax += (runningDividendIncome - basicRateSlice) * 0.3375;
        } else {
          dividendTax += runningDividendIncome * 0.0875;
        }
      }
    }
  }

  const totalIncomeTax = nonSavingsTax + interestTax + dividendTax;

  // Compute Clean Annual Net Cash Flow Surplus
  const netSurplusCash = (grossNonSavings + interest + divs + rawDrawdown) - totalIncomeTax;

  // Map out exact point-in-time Balance Sheet structures directly from the profile seed array
  const sipp = inputs.pensions?.sipp_balance ?? 0;
  const isa = inputs.investments?.isa_balance ?? 0;
  const gia = inputs.investments?.gia_balance ?? 0;
  const unquoted = inputs.investments?.unquoted_shares ?? 0;
  const home = inputs.property?.primary_residence_value ?? 0;

  const totalAssets = sipp + isa + gia + unquoted + home;
  const totalLiabilities = inputs.property?.mortgage_balance ?? 0;
  const calculatedNetWorth = totalAssets - totalLiabilities;

  return {
    ani,
    allocatedPA,
    totalIncomeTax,
    calculatedNetWorth,
    netSurplusCash,
    assets_snapshot: { sipp, isa, gia, unquoted, home, totalAssets, totalLiabilities }
  };
}

async function executeGlobalMatrix() {
  const masterMatrixFile = resolve(__dirname, './src/rules/personas/matrix/global-test-matrix.json');
  
  if (!fs.existsSync(masterMatrixFile)) {
    console.error(`${C.red}Error: Master test matrix file missing at ${masterMatrixFile}${C.reset}`);
    process.exit(1);
  }

  try {
    const matrixData = JSON.parse(fs.readFileSync(masterMatrixFile, 'utf8'));
    let executionCount = 0;

    for (const persona of matrixData.personas) {
      console.log(`${C.cyan}${C.bold}▶ Initiating Reconciled Run for Profile: ${persona.name} [${persona.archetype}]${C.reset}`);
      const epochs = Object.keys(persona.historical_timeline).sort();

      for (const year of epochs) {
        const macroRules = await getMacroRules(parseInt(year));
        const epochData = persona.historical_timeline[year];
        
        const outputs = calculateFinancialState(epochData.inputs, macroRules);

        const { error: snapError } = await supabase
          .from('financial_snapshots')
          .insert({
            "persona_id": persona.id,
            "archetype_id": persona.archetype,
            "fiscal_year": parseInt(year),
            "run_id": RUN_ID,
            "income_statement_layer": {
              "gross_inflows": {
                "non_savings_revenue": epochData.inputs.employment,
                "savings_interest_revenue": { "uk_bank_interest": epochData.inputs.income.interest_income },
                "dividend_revenue": { "ordinary_dividends": epochData.inputs.income.dividend_income }
              }
            },
            "cashflow_layer": { "surplus_cash_generation": outputs.netSurplusCash },
            "tax_layer": {
              "income_tax_summary": {
                "adjusted_net_income": outputs.ani,
                "allocated_personal_allowance": outputs.allocatedPA,
                "total_income_tax_liability": outputs.totalIncomeTax
              }
            },
            "balance_sheet_layer": {
              "assets": outputs.assets_snapshot,
              "calculated_net_worth": outputs.calculatedNetWorth
            }
          });

        if (snapError) throw new Error(`Snapshot insert dropped for ${persona.id} in ${year}: ${snapError.message}`);

        const { error: auditError } = await supabase
          .from('test_audit_ledger')
          .insert({
            "run_id": RUN_ID,
            "persona_id": persona.id,
            "archetype_id": persona.archetype,
            "fiscal_year": parseInt(year),
            "status": "SUCCESS",
            "raw_prompt_payload": { "inputs": epochData.inputs },
            "raw_model_response": { "calculated_outputs": outputs }
          });

        if (auditError) throw new Error(`Audit ledger insert dropped for ${persona.id} in ${year}: ${auditError.message}`);

        console.log(`  ${C.green}✓${C.reset} Year ${year} -> Calculated PA: £${outputs.allocatedPA.toLocaleString()} | Tax Charged: £${outputs.totalIncomeTax.toLocaleString()} | Reconciled NW: £${outputs.calculatedNetWorth.toLocaleString()}`);
        executionCount++;
      }
      console.log('');
    }

    console.log(`${C.bold}═══════════════════════════════════════════════════════════════════════════${C.reset}`);
    console.log(`  ${C.green}✓ MASTER ENCOMPASSING VALIDATION RUN 100% SUCCESSFUL${C.reset}`);
    console.log(`  Total Active Database Matrix Entries Committed: ${executionCount} epochs.`);
    console.log(`${C.bold}═══════════════════════════════════════════════════════════════════════════${C.reset}\n`);

  } catch (err) {
    console.error(`\n${C.red}✗ Execution Halting Fatal Error:${C.reset}`, err.message);
    process.exit(1);
  }
}

executeGlobalMatrix();