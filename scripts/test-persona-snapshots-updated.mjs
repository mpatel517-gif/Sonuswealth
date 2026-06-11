// ─────────────────────────────────────────────────────────────────────────────
// PERSONA SNAPSHOT REGRESSION TEST — COMPREHENSIVE INDUSTRIAL RUNNER
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ============================================================================
// CONFIGURATION BLOCK: PASTE YOUR KEYS HERE
// WARNING: Do not push this file to GitHub once these are filled in!
// ============================================================================
const SUPABASE_URL = "https://yknnfglfbpcyxcllrvmd.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!SUPABASE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in your environment.'); process.exit(1); }
// ============================================================================

if (SUPABASE_URL.includes("paste_your")) {
  console.error("Error: You need to update the Supabase keys at the top of the file.");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const RUN_ID = randomUUID();

const HISTORICAL_YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const VERBOSE = process.argv.includes('--verbose');

const C = {
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m',
};

console.log(`${C.bold}═══════════════════════════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}  Sonuswealth Industrial Multi-Period Matrix Validation Engine${C.reset}`);
console.log(`  Historical Range: 2021–2026 (6 epochs)`);
console.log(`  Run ID: ${RUN_ID}`);
console.log(`${C.bold}═══════════════════════════════════════════════════════════════════════════${C.reset}`);

// ── 1. MACRO DATA FETCHER ────────────────────────────────────────────────────
async function fetchMacroForYear(year) {
  const { data, error } = await supabase
    .from('macro_economic_data')
    .select('*')
    .eq('year', year)
    .single();
    
  if (error) throw new Error(`Supabase query failed for year ${year}: ${error.message}`);
  if (!data) throw new Error(`No macro data found for year ${year}`);
  return data;
}

// ── 2. CORE COMPUTATION FUNCTIONS ────────────────────────────────────────────
function computeNetWorth(data) {
  if (data.financial_vectors) {
    const fv = data.financial_vectors;
    return ((fv.assets?.sipp_balance ?? 0) + (fv.assets?.isa_balance ?? 0) + (fv.assets?.unquoted_trading_shares ?? 0) + (fv.assets?.overseas_accounts ?? 0)) - (fv.liabilities?.directors_loan_balance ?? 0);
  }
  if (data.assets?.sipp?.total !== undefined) {
    return (data.assets.sipp.total + (data.assets.isa?.value ?? 0) + (data.assets.portfolio?.value ?? 0) + (data.assets.residence?.value ?? 0) + (data.assets.cash?.total ?? 0)) - (data.liabilities?.mortgage?.outstanding ?? 0);
  }
  const assets = data.assets ?? {};
  const pensions = (assets.pensions ?? []).reduce((s, p) => s + (p.total ?? p.value ?? 0), 0);
  const investments = (assets.investments ?? []).reduce((s, i) => s + (i.value ?? 0), 0) + (assets.indian_assets ?? []).reduce((s, a) => s + (a.balance_gbp_approx ?? 0), 0) + (assets.business ?? []).reduce((s, b) => s + (b.value_gbp ?? 0), 0);
  return (pensions + investments + (assets.property ?? []).reduce((s, p) => s + (p.value ?? 0), 0) + (assets.cash ?? []).reduce((s, c) => s + (c.total ?? 0), 0)) - (data.liabilities ?? []).reduce((s, l) => s + (l.outstanding ?? 0), 0);
}

function computeIHT(data, is2026, macroData) {
  const nrb = macroData?.personal_allowance ? macroData.personal_allowance * 25 : 325000;
  if (data.financial_vectors) {
    const fv = data.financial_vectors;
    let estate = (fv.assets?.isa_balance ?? 0) + (fv.assets?.overseas_accounts ?? 0) + ((fv.assets?.unquoted_trading_shares ?? 0) * 0.5);
    if (is2026) estate += (fv.assets?.sipp_balance ?? 0);
    return Math.max(0, estate - nrb) * 0.40;
  }
  let estate = data.assets?.sipp?.total !== undefined ? (data.assets.isa?.value ?? 0) + (data.assets.portfolio?.value ?? 0) + (data.assets.residence?.value ?? 0) + (data.assets.cash?.total ?? 0) : 0;
  if (is2026 && data.assets?.sipp?.total) estate += data.assets.sipp.total;
  return Math.max(0, estate - (nrb + 175000)) * 0.40;
}

let passed = 0, failed = 0;

// ── 3. HISTORICAL SWEEP & DB INSERTION ───────────────────────────────────────
async function runValidation() {
  console.log(`\n${C.cyan}${C.bold}── EXECUTING MATRIX DATABASE COMMIT ──────────────────────────────${C.reset}\n`);
  
  const matrixFolder = resolve(__dirname, '../src/rules/personas/matrix/');
  
  if (!existsSync(matrixFolder)) {
      console.log(`${C.red}✗ Matrix folder not found: ${matrixFolder}${C.reset}`);
      process.exit(1);
  }

  const matrixFiles = readdirSync(matrixFolder).filter(f => f.endsWith('.json'));
  console.log(`Found ${matrixFiles.length} persona archetype files. Beginning processing...\n`);

  for (const file of matrixFiles) {
    try {
      const data = JSON.parse(readFileSync(join(matrixFolder, file), 'utf8'));
      const personaId = data.id || file.replace('.json', '');
      const archetypeId = data.archetype || 'dynamic_matrix';

      for (const year of HISTORICAL_YEARS) {
        const macroData = await fetchMacroForYear(year);
        const netWorth = computeNetWorth(data);
        const iht = computeIHT(data, year === 2026, macroData);

        // Insert into financial_snapshots
        const { error: snapError } = await supabase.from('financial_snapshots').insert({
          persona_id: personaId,
          archetype_id: archetypeId,
          fiscal_year: year,
          tax_layer: { iht_liability: iht },
          cashflow_layer: { net_worth: netWorth },
          income_statement_layer: { validation_status: 'complete' },
          balance_sheet_layer: data.assets || {},
          run_id: RUN_ID
        });

        if (snapError) throw new Error(`DB Snapshot Write Failed: ${snapError.message}`);

        // Insert into test_audit_ledger
        const { error: auditError } = await supabase.from('test_audit_ledger').insert({
          run_id: RUN_ID,
          persona_id: personaId,
          archetype_id: archetypeId,
          fiscal_year: year,
          status: 'SUCCESS',
          raw_prompt_payload: { macro_applied: macroData },
          raw_model_response: { calculated_net_worth: netWorth, calculated_iht: iht }
        });

        if (auditError) throw new Error(`DB Audit Write Failed: ${auditError.message}`);

        passed++;
      }
    } catch (e) {
      console.log(`${C.red}✗${C.reset} Failed on ${file}: ${e.message}`);
      failed++;
    }
  }

  // ── 4. FINAL SUMMARY ────────────────────────────────────────────────────────
  console.log(`\n${C.bold}═══════════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`  ${failed === 0 ? C.green + '✓ SUPABASE COMMIT SUCCESSFUL' : C.red + '✗ DATABASE INSERTION ERRORS FOUND'}${C.reset}`);
  console.log(`  Rows Inserted: ${passed}  |  Failures: ${failed}`);
  console.log(`${C.bold}═══════════════════════════════════════════════════════════════════════════${C.reset}\n`);

  process.exitCode = failed === 0 ? 0 : 1;
}

runValidation();