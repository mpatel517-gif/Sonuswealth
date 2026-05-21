// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: cron-context-pull
// Schedule: daily 09:30 UTC (registered via pg_cron in migration 012)
// Purpose: fetch UK macro context (ONS CPI, BoE base rate) and upsert into
//          finio_macro_variables. Also snapshots into finio_macro_history
//          if the value differs materially from last entry.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MacroUpdate {
  key: string;
  value: number;
  unit: string;
  label: string;
  source: string;
  source_url: string;
}

// ─── Fetch UK CPI from ONS API ───────────────────────────────────────────────
async function fetchCPI(): Promise<MacroUpdate | null> {
  try {
    // ONS CPIH (Consumer Prices including Housing) — series L55O is 12-month rate
    const url = 'https://api.beta.ons.gov.uk/v1/datasets/cpih01/timeseries/l55o/data';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ONS HTTP ${res.status}`);
    const data = await res.json();
    // Latest monthly value (months[0] is oldest, find last)
    const months = data.months || [];
    const latest = months[months.length - 1];
    if (!latest?.value) throw new Error('No CPI value');
    return {
      key: 'cpi_inflation',
      value: parseFloat(latest.value) / 100,        // 3.2% → 0.032
      unit: 'percent',
      label: 'UK CPI Inflation (12-month)',
      source: 'ONS',
      source_url: url,
    };
  } catch (e) {
    console.error('CPI fetch failed:', e.message);
    return null;
  }
}

// ─── Fetch BoE base rate ─────────────────────────────────────────────────────
async function fetchBoEBaseRate(): Promise<MacroUpdate | null> {
  try {
    // BoE statistical API — IUDSOIA = Bank Rate
    const today = new Date();
    const month = today.toLocaleString('en-US', { month: 'short' });
    const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?Travel=NIxIRxSUx&FromSeries=1&ToSeries=50&DAT=ALL&FNY=Y&CSVF=TT&html.x=66&html.y=26&SeriesCodes=IUDSOIA&UsingCodes=Y&Filter=N&title=IUDSOIA&VPD=Y`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BoE HTTP ${res.status}`);
    const csv = await res.text();
    // Parse last line of CSV for latest rate
    const lines = csv.trim().split('\n');
    const lastDataLine = lines[lines.length - 1];
    const [date, rate] = lastDataLine.split(',');
    if (!rate) throw new Error('No BoE rate found');
    return {
      key: 'boe_base_rate',
      value: parseFloat(rate) / 100,
      unit: 'percent',
      label: 'Bank of England Base Rate',
      source: 'Bank of England',
      source_url: 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate',
    };
  } catch (e) {
    console.error('BoE fetch failed:', e.message);
    return null;
  }
}

// ─── Upsert into Supabase ────────────────────────────────────────────────────
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
      effective_date: new Date().toISOString().slice(0, 10),
      pulled_at: new Date().toISOString(),
    }, { onConflict: 'jurisdiction,variable_key' });

  if (error) throw new Error(`Upsert ${update.key} failed: ${error.message}`);
}

// ─── Main handler ────────────────────────────────────────────────────────────
serve(async (_req) => {
  const startTime = Date.now();
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const results: Array<{ key: string; status: string; value?: number; error?: string }> = [];

  // CPI
  const cpi = await fetchCPI();
  if (cpi) {
    try {
      await upsertMacro(client, cpi);
      results.push({ key: cpi.key, status: 'updated', value: cpi.value });
    } catch (e: any) {
      results.push({ key: cpi.key, status: 'error', error: e.message });
    }
  } else {
    results.push({ key: 'cpi_inflation', status: 'fetch_failed' });
  }

  // BoE
  const boe = await fetchBoEBaseRate();
  if (boe) {
    try {
      await upsertMacro(client, boe);
      results.push({ key: boe.key, status: 'updated', value: boe.value });
    } catch (e: any) {
      results.push({ key: boe.key, status: 'error', error: e.message });
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
