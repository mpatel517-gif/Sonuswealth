/**
 * update-rules-uk.mjs
 *
 * Auto-verifies all UK financial thresholds against live gov.uk sources
 * using Claude with web search, then rewrites app-prototype/rules-uk.js.
 *
 * Usage:
 *   node scripts/update-rules-uk.mjs
 *
 * Requires:
 *   ANTHROPIC_API_KEY env var (set via: setx ANTHROPIC_API_KEY "sk-...")
 *
 * Run after:
 *   - UK Autumn Budget (Oct/Nov each year)
 *   - UK Spring Statement (Mar each year)
 *   - Any Finance Bill Royal Assent
 *   - Any HMRC announcement on allowances
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../app-prototype/rules-uk.js');
const TODAY = new Date().toISOString().split('T')[0];

// Load .env.local if present (Vite project convention)
function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*["']?(.+?)["']?\s*$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnvLocal();

// Accept key from any of the names used in this project
function resolveApiKey() {
  const candidates = ['ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_KEY', 'ANTHROPIC_KEY'];
  for (const name of candidates) {
    const val = (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
    if (val.startsWith('sk-ant-')) return val;
  }
  return null;
}

const rawKey = resolveApiKey();

if (!rawKey) {
  console.error('\n❌ No valid Anthropic API key found.');
  console.error('   Checked env vars: ANTHROPIC_API_KEY, VITE_ANTHROPIC_KEY');
  console.error('   Checked file: .env.local');
  console.error('\n   Fix: add to .env.local →  VITE_ANTHROPIC_KEY=sk-ant-api03-...');
  console.error('   Or:  setx ANTHROPIC_API_KEY "sk-ant-api03-..." then reopen terminal\n');
  process.exit(1);
}

const client = new Anthropic({ apiKey: rawKey });

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM = `You are a UK financial compliance researcher. Your job is to verify current UK financial thresholds and legislation statuses by searching authoritative sources: HMRC (gov.uk), legislation.gov.uk, and official Budget documents. Return only verified facts with citations. If a figure has changed since the last tax year, say so explicitly. Never guess — if you cannot find a confirmed value, flag it as UNVERIFIED.`;

const USER_PROMPT = `Today is ${TODAY}. Search the web and verify the CURRENT values for each UK financial rule below. For each one:
1. Search gov.uk / HMRC / legislation.gov.uk for the authoritative figure
2. Confirm which tax year it applies to (we are in tax year 2026/27, running Apr 2026 – Apr 2027)
3. Note if it changed from last year and when
4. For legislation items, confirm whether the bill received Royal Assent or is still proposed

Return a single JSON object with this exact structure (fill in real values — do not use placeholders):

{
  "verified_date": "${TODAY}",
  "tax_year": "2026/27",
  "isa_annual_allowance": <number>,
  "isa_status": "ENACTED",
  "isa_source": "<url>",
  "isa_notes": "<any changes from prior year>",
  "pension_annual_allowance": <number>,
  "pension_aa_status": "ENACTED",
  "pension_aa_source": "<url>",
  "mpaa": <number>,
  "mpaa_status": "ENACTED",
  "mpaa_source": "<url>",
  "nmpa_current": <number>,
  "nmpa_future": <number>,
  "nmpa_future_date": "<YYYY-MM-DD>",
  "nmpa_status": "ENACTED",
  "nmpa_source": "<url>",
  "sipp_iht_status": "<ENACTED|PROPOSED|DEFERRED>",
  "sipp_iht_proposed_date": "<YYYY-MM-DD or null>",
  "sipp_iht_bill": "<Finance Bill name>",
  "sipp_iht_notes": "<current status as of today — has it passed? when was Royal Assent?>",
  "sipp_iht_source": "<url>",
  "cgt_annual_exempt": <number>,
  "cgt_exempt_status": "ENACTED",
  "cgt_exempt_source": "<url>",
  "cgt_basic_rate": <number>,
  "cgt_higher_rate": <number>,
  "cgt_rates_status": "ENACTED",
  "cgt_rates_source": "<url>",
  "iht_nrb": <number>,
  "iht_rnrb": <number>,
  "iht_rate": <number>,
  "iht_freeze_until": "<YYYY-MM-DD>",
  "iht_status": "ENACTED",
  "iht_source": "<url>",
  "iht_annual_gift": <number>,
  "iht_gift_source": "<url>",
  "state_pension_weekly": <number>,
  "state_pension_annual": <number>,
  "state_pension_tax_year": "<which tax year this applies to>",
  "state_pension_status": "ENACTED",
  "state_pension_source": "<url>",
  "income_tax_personal_allowance": <number>,
  "income_tax_basic_rate_limit": <number>,
  "income_tax_higher_rate_threshold": <number>,
  "income_tax_additional_rate_threshold": <number>,
  "income_tax_freeze_until": "<YYYY-MM-DD>",
  "income_tax_status": "ENACTED",
  "income_tax_source": "<url>"
}

IMPORTANT: Return only the JSON object, no prose before or after it.`;

// ── Call Claude with web search ───────────────────────────────────────────────

async function fetchVerifiedRules() {
  console.log(`\n🔍 Querying Claude with live web search (${TODAY})...\n`);

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: SYSTEM,
    messages: [{ role: 'user', content: USER_PROMPT }]
  });

  // Extract the final text block (after all tool calls complete)
  const textBlocks = response.content.filter(b => b.type === 'text');
  if (!textBlocks.length) throw new Error('No text response from Claude');

  const raw = textBlocks[textBlocks.length - 1].text.trim();

  // Robustly extract JSON: strip code fences, then find first { and last }
  let jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse JSON response:\n', raw);
    throw e;
  }

  return data;
}

// ── Generate rules-uk.js from verified data ──────────────────────────────────

function generateRulesFile(d) {
  return `/**
 * rules-uk.js — Sonuswealth UK Financial Rules & Thresholds
 *
 * AUTO-GENERATED by scripts/update-rules-uk.mjs
 * DO NOT edit manually — run: node scripts/update-rules-uk.mjs
 *
 * Last verified: ${d.verified_date}
 * Tax year:      ${d.tax_year}
 * Verified by:   Claude (claude-opus-4-7) with live web search
 *
 * STATUS values:
 *   ENACTED   = law, in force
 *   PROPOSED  = in Finance Bill, not yet Royal Assent
 *   DEFERRED  = delayed or withdrawn
 *
 * GOVERNANCE:
 *   Never hardcode a threshold in HTML/JSX. Read from RULES.*
 *   Run this script after every UK Budget or Finance Bill event.
 *   ANTHROPIC_API_KEY must be set in env.
 */

const RULES = {

  /* ── ISA ──────────────────────────────────────────── */
  isa: {
    annual_allowance: ${d.isa_annual_allowance},
    status: '${d.isa_status}',
    notes: '${(d.isa_notes || '').replace(/'/g, "\\'")}',
    source: '${d.isa_source}',
    verified: '${d.verified_date}'
  },

  /* ── PENSION ──────────────────────────────────────── */
  pension: {
    annual_allowance: ${d.pension_annual_allowance},
    status: '${d.pension_aa_status}',
    source: '${d.pension_aa_source}',
    verified: '${d.verified_date}',

    mpaa: {
      value: ${d.mpaa},
      status: '${d.mpaa_status}',
      notes: 'Triggered by flexi-access drawdown — IRREVERSIBLE. Cap drops from £${d.pension_annual_allowance.toLocaleString()} to £${d.mpaa.toLocaleString()}/yr permanently.',
      source: '${d.mpaa_source}',
      verified: '${d.verified_date}'
    },

    nmpa: {
      current: ${d.nmpa_current},
      rising_to: ${d.nmpa_future},
      rising_date: '${d.nmpa_future_date}',
      status: '${d.nmpa_status}',
      notes: 'Normal Minimum Pension Age. Protected pension age rules may apply for some schemes.',
      source: '${d.nmpa_source}',
      verified: '${d.verified_date}'
    },

    sipp_iht: {
      status: '${d.sipp_iht_status}',
      effective_date: '${d.sipp_iht_effective_date || '2027-04-06'}',
      bill: '${d.sipp_iht_bill}',
      notes: '${(d.sipp_iht_notes || '').replace(/'/g, "\\'")}',
      source: '${d.sipp_iht_source}',
      verified: '${d.verified_date}'
    }
  },

  /* ── CGT ──────────────────────────────────────────── */
  cgt: {
    annual_exempt_amount: ${d.cgt_annual_exempt},
    status: '${d.cgt_exempt_status}',
    source: '${d.cgt_exempt_source}',
    verified: '${d.verified_date}',

    rates: {
      basic_rate: ${d.cgt_basic_rate},
      higher_rate: ${d.cgt_higher_rate},
      status: '${d.cgt_rates_status}',
      source: '${d.cgt_rates_source}',
      verified: '${d.verified_date}'
    }
  },

  /* ── INHERITANCE TAX ─────────────────────────────── */
  iht: {
    nil_rate_band: ${d.iht_nrb},
    residence_nil_rate_band: ${d.iht_rnrb},
    combined_nrb: ${d.iht_nrb + d.iht_rnrb},
    rate: ${d.iht_rate},
    freeze_until: '${d.iht_freeze_until}',
    status: '${d.iht_status}',
    source: '${d.iht_source}',
    verified: '${d.verified_date}',

    annual_gift_exemption: ${d.iht_annual_gift},
    annual_gift_carryforward_years: 1,
    gift_on_marriage_child: 5000,
    regular_gifts_from_income: 'fully exempt (must be from surplus income)',
    seven_year_taper: true,
    source_gifting: '${d.iht_gift_source}',
    verified_gifting: '${d.verified_date}'
  },

  /* ── STATE PENSION ──────────────────────────────── */
  state_pension: {
    weekly: ${d.state_pension_weekly},
    annual: ${d.state_pension_annual},
    tax_year: '${d.state_pension_tax_year}',
    state_pension_age: 67,
    status: '${d.state_pension_status}',
    source: '${d.state_pension_source}',
    verified: '${d.verified_date}'
  },

  /* ── INCOME TAX ─────────────────────────────────── */
  income_tax: {
    personal_allowance: ${d.income_tax_personal_allowance},
    basic_rate_limit: ${d.income_tax_basic_rate_limit},
    higher_rate_threshold: ${d.income_tax_higher_rate_threshold},
    additional_rate_threshold: ${d.income_tax_additional_rate_threshold},
    basic_rate: 20,
    higher_rate: 40,
    additional_rate: 45,
    freeze_until: '${d.income_tax_freeze_until}',
    status: '${d.income_tax_status}',
    source: '${d.income_tax_source}',
    verified: '${d.verified_date}'
  },

  /* ── META ─────────────────────────────────────────── */
  _meta: {
    file: 'rules-uk.js',
    generated_by: 'scripts/update-rules-uk.mjs',
    verified_date: '${d.verified_date}',
    tax_year: '${d.tax_year}',
    next_review: 'Run update-rules-uk.mjs after next UK Budget or Finance Bill event',
    update_command: 'node scripts/update-rules-uk.mjs'
  }
};

/* ── Convenience helpers for UI ─────────────────────── */

const RULES_DAYS_TO_SIPP_DEADLINE = (() => {
  const target = new Date(RULES.pension.sipp_iht.effective_date);
  const today = new Date();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
})();

const RULES_SIPP_STATUS_LABEL = {
  ENACTED:  '6 Apr 2027 · deadline',
  PROPOSED: '6 Apr 2027 · proposed',
  DEFERRED: '6 Apr 2027 · deferred'
}[RULES.pension.sipp_iht.status] || '6 Apr 2027 · check status';

const RULES_SIPP_COPY_SUFFIX = RULES.pension.sipp_iht.status === 'ENACTED'
  ? ''
  : ' (subject to legislation)';
`;
}

// ── Diff summary ─────────────────────────────────────────────────────────────

function diffSummary(oldContent, newRules) {
  const extract = (src, key) => {
    const m = src.match(new RegExp(`${key}:\\s*([\\d.]+)`));
    return m ? parseFloat(m[1]) : null;
  };

  const checks = [
    ['ISA allowance', 'annual_allowance', newRules.isa_annual_allowance],
    ['Pension AA', 'annual_allowance', newRules.pension_annual_allowance],
    ['MPAA', 'value', newRules.mpaa],
    ['CGT exempt', 'annual_exempt_amount', newRules.cgt_annual_exempt],
    ['NRB', 'nil_rate_band', newRules.iht_nrb],
    ['RNRB', 'residence_nil_rate_band', newRules.iht_rnrb],
    ['State pension (annual)', 'annual', newRules.state_pension_annual],
  ];

  console.log('\n📊 Change summary:\n');
  let changed = 0;
  for (const [label, key, newVal] of checks) {
    const oldVal = extract(oldContent, key);
    if (oldVal !== null && oldVal !== newVal) {
      console.log(`  ⚠  ${label}: ${oldVal.toLocaleString()} → ${newVal.toLocaleString()} CHANGED`);
      changed++;
    } else {
      console.log(`  ✓  ${label}: £${(newVal || 0).toLocaleString()} (unchanged)`);
    }
  }

  // SIPP status
  const oldSippStatus = oldContent.match(/sipp_iht_status.*?'([A-Z]+)'/)?.[1]
    || oldContent.match(/status: '(ENACTED|PROPOSED|DEFERRED)'/)?.[1];
  const newSippStatus = newRules.sipp_iht_status;
  if (oldSippStatus && oldSippStatus !== newSippStatus) {
    console.log(`\n  🚨 SIPP IHT STATUS CHANGED: ${oldSippStatus} → ${newSippStatus}`);
    changed++;
  } else {
    console.log(`  ✓  SIPP IHT status: ${newSippStatus}`);
  }

  if (changed === 0) {
    console.log('\n  All values confirmed unchanged. ✓');
  } else {
    console.log(`\n  ${changed} value(s) updated. Review the diff before using in demos.`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Sonuswealth — UK Rules Auto-Updater');
  console.log(`  ${TODAY}`);
  console.log('═══════════════════════════════════════════════════');

  let oldContent = '';
  try { oldContent = readFileSync(RULES_PATH, 'utf8'); } catch {}

  const verifiedData = await fetchVerifiedRules();

  console.log('\n✅ Verified data received from Claude:\n');
  console.log(`   ISA allowance:      £${verifiedData.isa_annual_allowance?.toLocaleString()}`);
  console.log(`   Pension AA:         £${verifiedData.pension_annual_allowance?.toLocaleString()}`);
  console.log(`   MPAA:               £${verifiedData.mpaa?.toLocaleString()}`);
  console.log(`   CGT exempt:         £${verifiedData.cgt_annual_exempt?.toLocaleString()}`);
  console.log(`   State pension/yr:   £${verifiedData.state_pension_annual?.toLocaleString()}`);
  console.log(`   NRB:                £${verifiedData.iht_nrb?.toLocaleString()}`);
  console.log(`   SIPP IHT status:    ${verifiedData.sipp_iht_status}`);
  console.log(`   SIPP notes:         ${verifiedData.sipp_iht_notes?.slice(0, 80)}...`);

  diffSummary(oldContent, verifiedData);

  const newContent = generateRulesFile(verifiedData);
  writeFileSync(RULES_PATH, newContent, 'utf8');

  console.log(`\n✅ rules-uk.js updated → ${RULES_PATH}`);
  console.log('   Commit this file: git add app-prototype/rules-uk.js && git commit -m "rules-uk: verified ' + TODAY + '"\n');
}

main().catch(e => {
  const msg = e.message || '';
  if (msg.includes('credit balance is too low') || msg.includes('insufficient')) {
    console.error('\n❌ Insufficient API credits.');
    console.error('   Add credits: https://console.anthropic.com → Plans & Billing\n');
  } else if (msg.includes('invalid x-api-key') || msg.includes('authentication_error')) {
    console.error('\n❌ Invalid API key.');
    console.error('   Check VITE_ANTHROPIC_KEY in .env.local\n');
  } else {
    console.error('\n❌ Error:', msg);
  }
  process.exitCode = 1;
  // Delay exit to allow Node to flush I/O cleanly on Windows
  setTimeout(() => process.exit(1), 100);
});
