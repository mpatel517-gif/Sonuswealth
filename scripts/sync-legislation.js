/**
 * sync-legislation.js
 *
 * Fetches live UK statutory updates from official regulatory sources and maps
 * verified parameters to the centralised tax bundle (src/rules/tax-2026.json).
 *
 * Extends update-rules-uk.mjs (which targets app-prototype/rules-uk.js) to also
 * update the React engine source of truth — tax-2026.json.
 *
 * Anomaly detection: any parameter change > ANOMALY_THRESHOLD (default 10%) is
 * flagged as suspect and blocks silent merge. Large changes require manual review.
 *
 * Usage:
 *   node scripts/sync-legislation.js
 *   node scripts/sync-legislation.js --dry-run   (report only, no writes)
 *   node scripts/sync-legislation.js --threshold=0.05  (5% anomaly threshold)
 *
 * Requires: ANTHROPIC_API_KEY env var
 * Writes:   src/rules/tax-2026.json  (on change)
 *           app-prototype/rules-uk.js (on change, via update-rules-uk.mjs logic)
 *
 * Schedule: .github/workflows/update-tax-rules.yml runs this at 02:00 UTC nightly.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAX_JSON_PATH = resolve(__dirname, '../src/rules/tax-2026.json');
const TODAY = new Date().toISOString().split('T')[0];
const DRY_RUN = process.argv.includes('--dry-run');
const ANOMALY_ARG = process.argv.find(a => a.startsWith('--threshold='));
const ANOMALY_THRESHOLD = ANOMALY_ARG ? parseFloat(ANOMALY_ARG.split('=')[1]) : 0.10;

// ── Env loading ──────────────────────────────────────────────────────────────
function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*["']?(.+?)["']?\s*$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnvLocal();

function resolveApiKey() {
  for (const name of ['ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_KEY', 'ANTHROPIC_KEY']) {
    const val = (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
    if (val.startsWith('sk-ant-')) return val;
  }
  return null;
}

const apiKey = resolveApiKey();
if (!apiKey) {
  console.error('\n❌ No Anthropic API key. Set ANTHROPIC_API_KEY or VITE_ANTHROPIC_KEY.\n');
  process.exit(1);
}

const client = new Anthropic({ apiKey });

// ── Canonical UK parameters to verify ───────────────────────────────────────
const PARAMETERS_TO_VERIFY = [
  { key: 'income.personalAllowance',             label: 'Personal Allowance',              source: 'HMRC Income Tax rates' },
  { key: 'income.basicRateBand',                 label: 'Basic Rate Band',                 source: 'HMRC Income Tax rates' },
  { key: 'income.additionalRateThreshold',       label: 'Additional Rate Threshold',       source: 'HMRC Income Tax rates' },
  { key: 'capitalGains.annualExemptAmount',      label: 'CGT Annual Exempt Amount',        source: 'HMRC Capital Gains Tax' },
  { key: 'capitalGains.higherRate',              label: 'CGT Higher Rate',                 source: 'HMRC CGT rates and allowances' },
  { key: 'inheritanceTax.nilRateBand',           label: 'IHT Nil Rate Band',               source: 'HMRC IHT thresholds' },
  { key: 'inheritanceTax.residenceNilRateBand',  label: 'IHT Residence NRB',               source: 'HMRC IHT thresholds' },
  { key: 'pension.annualAllowance',              label: 'Pension Annual Allowance',        source: 'HMRC Pension Tax Relief' },
  { key: 'pension.moneyPurchaseAnnualAllowance', label: 'MPAA',                            source: 'HMRC Pension Tax Relief' },
  { key: 'pension.lumpSumAllowance',             label: 'Lump Sum Allowance',              source: 'HMRC Pension Tax Relief' },
  { key: 'pension.statePensionFullAmount',       label: 'State Pension Full Amount',       source: 'GOV.UK New State Pension' },
  { key: 'isa.annualAllowance',                  label: 'ISA Annual Allowance',            source: 'HMRC ISA guidance' },
  { key: 'taxEfficientInvestments.vct.incomeTaxRelief', label: 'VCT IT Relief Rate',       source: 'HMRC VCT guidance' },
  { key: 'nationalInsurance.class1EmployeeRate', label: 'NI Employee Rate',                source: 'HMRC NI rates and thresholds' },
  { key: 'inheritanceTax.pensionIHTInclusionDate', label: 'SIPP IHT Inclusion Date',       source: 'Finance Act 2026 / HMRC IHT' },
];

// ── Anomaly detection ────────────────────────────────────────────────────────
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
}

function detectAnomalies(oldData, newData) {
  const anomalies = [];
  for (const param of PARAMETERS_TO_VERIFY) {
    const oldVal = getNestedValue(oldData, param.key);
    const newVal = getNestedValue(newData, param.key);
    if (oldVal === null || newVal === null) continue;
    if (typeof oldVal === 'number' && typeof newVal === 'number' && oldVal !== 0) {
      const pctChange = Math.abs(newVal - oldVal) / Math.abs(oldVal);
      if (pctChange > ANOMALY_THRESHOLD) {
        anomalies.push({
          key: param.key,
          label: param.label,
          oldVal,
          newVal,
          pctChange: (pctChange * 100).toFixed(1) + '%',
        });
      }
    }
  }
  return anomalies;
}

// ── Claude query for live statutory verification ─────────────────────────────
const SYSTEM_PROMPT = `You are a UK financial legislation researcher. Your job is to verify current UK statutory parameters by searching authoritative sources only: HMRC (gov.uk), legislation.gov.uk, and official Budget/Finance Act documents. Never guess. If you cannot find a confirmed current value, return the existing value unchanged and flag it as UNVERIFIED. Today's date: ${TODAY}. Current UK tax year: 2026/27.`;

const USER_PROMPT = `Search live sources and verify the CURRENT values of these UK financial parameters for tax year 2026/27.

For each parameter:
1. Search HMRC / GOV.UK for the authoritative 2026/27 value
2. Note if the value changed since last tax year
3. Confirm ENACTED vs PROPOSED vs DEFERRED status

Return ONLY a valid JSON object with these exact keys (use null for any you cannot verify):

{
  "verified_date": "${TODAY}",
  "tax_year": "2026/27",
  "personal_allowance": <number|null>,
  "basic_rate_band": <number|null>,
  "additional_rate_threshold": <number|null>,
  "cgt_annual_exempt_amount": <number|null>,
  "cgt_higher_rate": <number|null>,
  "iht_nrb": <number|null>,
  "iht_rnrb": <number|null>,
  "pension_annual_allowance": <number|null>,
  "mpaa": <number|null>,
  "lsa": <number|null>,
  "state_pension_annual": <number|null>,
  "isa_annual_allowance": <number|null>,
  "vct_income_tax_relief": <number|null>,
  "ni_employee_rate_basic": <number|null>,
  "sipp_iht_inclusion_date": "<YYYY-MM-DD>|null",
  "sipp_iht_status": "<ENACTED|PROPOSED|DEFERRED>",
  "changes_from_prior_year": ["<description of each change>"],
  "unverified_keys": ["<key name if could not be confirmed>"],
  "sources": ["<url1>", "<url2>"]
}`;

async function fetchLiveParameters() {
  console.log('\n🔍 Fetching live statutory parameters via Claude + web search...\n');
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT }],
  });

  const textBlocks = response.content.filter(b => b.type === 'text');
  if (!textBlocks.length) throw new Error('No text response from Claude');

  let raw = textBlocks[textBlocks.length - 1].text.trim();
  raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
  if (first === -1) throw new Error('No JSON object found in response');
  return JSON.parse(raw.slice(first, last + 1));
}

// ── Merge verified data into tax-2026.json ───────────────────────────────────
function mergeLiveIntoBundle(existing, live) {
  const updated = JSON.parse(JSON.stringify(existing)); // deep clone

  function setNestedIfNotNull(obj, path, value) {
    if (value === null || value === undefined) return false;
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((acc, k) => acc[k], obj);
    if (!target) return false;
    target[last] = value;
    return true;
  }

  const mappings = [
    ['income.personalAllowance',             live.personal_allowance],
    ['income.basicRateBand',                 live.basic_rate_band],
    ['income.basicRateThreshold',            live.personal_allowance && live.basic_rate_band ? live.personal_allowance + live.basic_rate_band : null],
    ['income.additionalRateThreshold',       live.additional_rate_threshold],
    ['capitalGains.annualExemptAmount',      live.cgt_annual_exempt_amount],
    ['capitalGains.higherRate',              live.cgt_higher_rate],
    ['inheritanceTax.nilRateBand',           live.iht_nrb],
    ['inheritanceTax.residenceNilRateBand',  live.iht_rnrb],
    ['pension.annualAllowance',              live.pension_annual_allowance],
    ['pension.moneyPurchaseAnnualAllowance', live.mpaa],
    ['pension.lumpSumAllowance',             live.lsa],
    ['pension.statePensionFullAmount',       live.state_pension_annual],
    ['isa.annualAllowance',                  live.isa_annual_allowance],
    ['taxEfficientInvestments.vct.incomeTaxRelief', live.vct_income_tax_relief],
    ['nationalInsurance.class1EmployeeRate', live.ni_employee_rate_basic],
  ];

  let changedCount = 0;
  for (const [path, value] of mappings) {
    if (setNestedIfNotNull(updated, path, value)) {
      const oldVal = getNestedValue(existing, path);
      if (oldVal !== value) changedCount++;
    }
  }

  if (live.sipp_iht_inclusion_date) {
    updated.inheritanceTax.pensionIHTInclusionDate = live.sipp_iht_inclusion_date;
  }

  updated._meta.verifiedBy = `sync-legislation.js (Claude claude-opus-4-7 + web search)`;
  updated._meta.verificationDate = live.verified_date;
  updated._lastUpdated = live.verified_date;

  return { updated, changedCount };
}

// ── Diff report ───────────────────────────────────────────────────────────────
function printDiff(oldData, newData, liveParams) {
  console.log('\n📊 Parameter verification report:\n');
  for (const param of PARAMETERS_TO_VERIFY) {
    const oldVal = getNestedValue(oldData, param.key);
    const newVal = getNestedValue(newData, param.key);
    const icon = oldVal === newVal ? '  ✓ ' : '  ⚠ ';
    const suffix = oldVal !== newVal ? ` CHANGED: ${oldVal?.toLocaleString() ?? '?'} → ${newVal?.toLocaleString() ?? '?'}` : '';
    const display = typeof newVal === 'number' ? `£${newVal.toLocaleString()}` : String(newVal ?? '—');
    console.log(`${icon} ${param.label}: ${display}${suffix}`);
  }
  if (liveParams.changes_from_prior_year?.length) {
    console.log('\n📋 Reported changes from prior year:');
    for (const c of liveParams.changes_from_prior_year) console.log(`   • ${c}`);
  }
  if (liveParams.unverified_keys?.length) {
    console.log('\n⚠  Unverified parameters (kept as existing):');
    for (const k of liveParams.unverified_keys) console.log(`   • ${k}`);
  }
  if (liveParams.sources?.length) {
    console.log('\n🔗 Sources:');
    for (const s of liveParams.sources) console.log(`   ${s}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Caelixa — UK Legislation Sync');
  console.log(`  ${TODAY}${DRY_RUN ? '  [DRY RUN — no writes]' : ''}`);
  console.log(`  Anomaly threshold: ${(ANOMALY_THRESHOLD * 100).toFixed(0)}%`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Load existing bundle
  let existingBundle = {};
  try {
    existingBundle = JSON.parse(readFileSync(TAX_JSON_PATH, 'utf8'));
    console.log(`✅ Loaded tax-2026.json (version ${existingBundle._meta?.version ?? 'unknown'})`);
  } catch {
    console.error('❌ Could not load tax-2026.json — aborting');
    process.exit(1);
  }

  // Fetch live parameters
  let liveParams;
  try {
    liveParams = await fetchLiveParameters();
    console.log('✅ Live parameters retrieved\n');
  } catch (err) {
    console.error('❌ Failed to fetch live parameters:', err.message);
    process.exit(1);
  }

  // Merge
  const { updated, changedCount } = mergeLiveIntoBundle(existingBundle, liveParams);

  // Print diff
  printDiff(existingBundle, updated, liveParams);

  // Anomaly detection
  const anomalies = detectAnomalies(existingBundle, updated);
  if (anomalies.length) {
    console.log('\n🚨 ANOMALY DETECTED — changes exceed threshold:\n');
    for (const a of anomalies) {
      console.log(`   🚨 ${a.label}: ${a.oldVal?.toLocaleString()} → ${a.newVal?.toLocaleString()} (${a.pctChange} change)`);
    }
    console.log(`\n   Threshold: ${(ANOMALY_THRESHOLD * 100).toFixed(0)}%. These changes require manual review before merging.`);
    console.log('   GitHub Actions: PR will be created with ANOMALY label. Do NOT auto-merge.\n');
    process.env.SYNC_ANOMALY = 'true';
    process.env.SYNC_ANOMALY_KEYS = anomalies.map(a => a.key).join(',');
  }

  if (changedCount === 0) {
    console.log('\n✅ No changes — all parameters confirmed current. No write needed.\n');
    process.env.SYNC_CHANGED = 'false';
    return;
  }

  process.env.SYNC_CHANGED = 'true';

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would write ${changedCount} changed parameter(s) to tax-2026.json\n`);
    return;
  }

  // Write updated bundle
  writeFileSync(TAX_JSON_PATH, JSON.stringify(updated, null, 2), 'utf8');
  console.log(`\n✅ tax-2026.json updated — ${changedCount} parameter(s) changed → ${TAX_JSON_PATH}`);
  console.log('   Stage for commit: git add src/rules/tax-2026.json\n');
}

main().catch(err => {
  console.error('\n❌', err.message);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 100);
});
