// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: cron-context-pull (v2 — 2026-05-23)
// Schedule: daily 09:30 UTC (registered via pg_cron in migration 012)
// Purpose: fetch live UK macro context (ONS CPIH, BoE Bank Rate) and upsert
//          into finio_macro_variables. Also snapshots history when value
//          differs materially from last entry for current tax year.
//
// v2 fixes (vs v1):
//   - ONS: was using retired beta.ons.gov.uk; now uses canonical www.ons.gov.uk
//   - BoE: was using IUDSOIA (SONIA overnight rate); now IUDBEDR (Bank Rate)
//
// Series:
//   CPIH 12-month rate            → ONS series L55O, dataset MM23
//   Bank of England Base Rate     → BoE series IUDBEDR
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MacroUpdate {
  key: string;
  value: number;            // stored as decimal fraction (e.g. 0.03 = 3%)
  unit: string;
  label: string;
  source: string;
  source_url: string;
  effective_date: string;   // ISO YYYY-MM-DD
}

// ─── ONS CPIH (12-month inflation rate) ──────────────────────────────────────
async function fetchCPIH(): Promise<MacroUpdate | null> {
  const url = 'https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/l55o/mm23/data';
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`ONS HTTP ${res.status}`);
    const data = await res.json();
    const months = data.months || [];
    if (!months.length) throw new Error('ONS returned no months');
    const latest = months[months.length - 1];
    const pct = parseFloat(latest.value);
    if (!Number.isFinite(pct)) throw new Error(`ONS unparseable value: ${latest.value}`);

    return {
      key: 'cpi_inflation',
      value: pct / 100,                     // 3.0 → 0.030
      unit: 'percent',
      label: 'UK CPIH 12-month inflation rate',
      source: 'ONS',
      source_url: url,
      effective_date: parseOnsDate(latest.date) || new Date().toISOString().slice(0, 10),
    };
  } catch (e) {
    console.error('CPIH fetch failed:', (e as Error).message);
    return null;
  }
}

function parseOnsDate(d: string | undefined): string | null {
  // "2026 APR" → "2026-04-01"  (treat as start of month)
  if (!d) return null;
  const m = d.match(/^(\d{4})\s+([A-Z]{3})$/);
  if (!m) return null;
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };
  const mm = months[m[2]];
  return mm ? `${m[1]}-${mm}-01` : null;
}

// ─── BoE Bank Rate (IUDBEDR) ────────────────────────────────────────────────
async function fetchBoEBaseRate(): Promise<MacroUpdate | null> {
  // 24-month window is plenty to find the latest value
  const today = new Date();
  const twoYearsAgo = new Date(today.getTime() - 730 * 24 * 60 * 60 * 1000);
  const datefrom = formatBoEDate(twoYearsAgo);
  const dateto = 'now';
  const url = `https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&Datefrom=${datefrom}&Dateto=${dateto}&SeriesCodes=IUDBEDR&UsingCodes=Y&CSVF=TN&VPD=Y&VFD=N`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BoE HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('csv')) throw new Error(`BoE not CSV: ${ct}`);

    const csv = await res.text();
    const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('BoE CSV too short');

    // Drop header. Find last data row.
    const dataRows = lines.slice(1);
    const last = dataRows[dataRows.length - 1].split(',');
    const dateStr = last[0]?.trim();
    const rate = parseFloat(last[1]);
    if (!Number.isFinite(rate)) throw new Error(`BoE unparseable: ${last[1]}`);

    return {
      key: 'boe_base_rate',
      value: rate / 100,                    // 3.75 → 0.0375
      unit: 'percent',
      label: 'Bank of England Base Rate',
      source: 'Bank of England',
      source_url: 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate',
      effective_date: parseBoEDate(dateStr) || new Date().toISOString().slice(0, 10),
    };
  } catch (e) {
    console.error('BoE fetch failed:', (e as Error).message);
    return null;
  }
}

function formatBoEDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  return `${day}/${mon}/${yr}`;
}

function parseBoEDate(d: string | undefined): string | null {
  // "21 May 2026" → "2026-05-21"
  if (!d) return null;
  const m = d.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const mm = months[m[2]];
  if (!mm) return null;
  return `${m[3]}-${mm}-${String(m[1]).padStart(2, '0')}`;
}

// ─── Upsert ─────────────────────────────────────────────────────────────────
async function upsertMacro(client: ReturnType<typeof createClient>, update: MacroUpdate) {
  const { error } = await client
    .from('finio_macro_variables')
    .upsert({
      jurisdiction: 'UK',
      variable_key: update.key,
      label: update.label,
      value: update.value,
      unit: update.unit,
      source: update.source,
      source_url: update.source_url,
      effective_date: update.effective_date,
      pulled_at: new Date().toISOString(),
    }, { onConflict: 'jurisdiction,variable_key' });

  if (error) throw new Error(`Upsert ${update.key} failed: ${error.message}`);
}

// Also snapshot into macro_history for the current UK tax year
async function snapshotHistory(client: ReturnType<typeof createClient>, update: MacroUpdate) {
  const taxYear = currentUKTaxYear(update.effective_date);
  const { error } = await client
    .from('finio_macro_history')
    .upsert({
      jurisdiction: 'UK',
      tax_year: taxYear,
      variable_key: update.key,
      value: update.value,
      effective_date: update.effective_date,
      source: update.source,
      source_url: update.source_url,
    }, { onConflict: 'jurisdiction,tax_year,variable_key' });

  if (error) console.error(`History upsert ${update.key} ${taxYear}: ${error.message}`);
}

function currentUKTaxYear(isoDate: string): string {
  // UK tax year: 6 April YYYY → 5 April YYYY+1
  const d = new Date(isoDate);
  const yr = d.getFullYear();
  const isPreApr6 = d.getMonth() < 3 || (d.getMonth() === 3 && d.getDate() < 6);
  const start = isPreApr6 ? yr - 1 : yr;
  return `${start}/${String(start + 1).slice(-2)}`;
}

// ─── Handler ────────────────────────────────────────────────────────────────
serve(async (_req) => {
  const startTime = Date.now();
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: Array<{ key: string; status: string; value?: number; effective_date?: string; error?: string }> = [];

  // CPIH
  const cpih = await fetchCPIH();
  if (cpih) {
    try {
      await upsertMacro(client, cpih);
      await snapshotHistory(client, cpih);
      results.push({ key: cpih.key, status: 'updated', value: cpih.value, effective_date: cpih.effective_date });
    } catch (e) {
      results.push({ key: cpih.key, status: 'error', error: (e as Error).message });
    }
  } else {
    results.push({ key: 'cpi_inflation', status: 'fetch_failed' });
  }

  // BoE
  const boe = await fetchBoEBaseRate();
  if (boe) {
    try {
      await upsertMacro(client, boe);
      await snapshotHistory(client, boe);
      results.push({ key: boe.key, status: 'updated', value: boe.value, effective_date: boe.effective_date });
    } catch (e) {
      results.push({ key: boe.key, status: 'error', error: (e as Error).message });
    }
  } else {
    results.push({ key: 'boe_base_rate', status: 'fetch_failed' });
  }

  const duration = Date.now() - startTime;
  return new Response(
    JSON.stringify({
      success: results.every(r => r.status === 'updated'),
      duration_ms: duration,
      results,
      timestamp: new Date().toISOString(),
    }, null, 2),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
