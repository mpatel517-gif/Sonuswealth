// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: cron-cma-refresh (L4-5 — 2026-05-28)
// Schedule: weekly Monday 06:00 UTC (registered via migration 017)
// Purpose: refresh Class-2 market context — yield curves, equity indices,
//          PLSA retirement living standards — into market_cma_bundle.
//
// Series (Phase 1 — what we can fetch reliably from free public sources):
//   1. UK 10-year gilt yield     → BoE series IUDMNZC
//   2. FTSE 100 close            → Yahoo Finance JSON
//   3. PLSA RLS Moderate (single) → static-quarterly figure (manual review on update)
//
// Phase 2 (later): MSCI World, US 10-year, GBP/USD spot, gold spot.
//
// Pattern matches cron-context-pull (migration 012 / function v2):
//   - Fetch each upstream
//   - Upsert one row per metric_key per reference_date
//   - Mark prior is_current = false where a newer reference_date lands
//   - Log via cron-health-check on staleness (registered automatically once
//     this cron writes to market_cma_bundle for the first time — add the
//     MONITORS entry in tests/harness/cron-health.js)
//
// Env:
//   SUPABASE_URL                — auto-set
//   SUPABASE_SERVICE_ROLE_KEY   — auto-set
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CmaUpdate {
  source_key: string;
  metric_key: string;
  value:      number | string | Record<string, unknown>;
  unit:       string;
  reference_date: string;  // ISO YYYY-MM-DD
  source_url: string;
  confidence: 'high' | 'medium' | 'low';
  licence:    string;
}

// ─── BoE 10-year gilt yield (IUDMNZC) ──────────────────────────────────────
async function fetchGiltYield(): Promise<CmaUpdate | null> {
  // BoE Statistical Interactive Database — daily series, CSV download via the
  // ?CSVF=TN flag. Same domain as the Bank-Rate fetch already used in
  // cron-context-pull, so DNS + TLS are pre-warmed.
  const url = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp'
    + '?Travel=NIxAZxSUx&FromSeries=1&ToSeries=50&DAT=RNG&FD=1&FM=Jan&FY=2024'
    + '&TD=31&TM=Dec&TY=2099&FNY=&CSVF=TN&html.x=80&html.y=15&SeriesCodes=IUDMNZC&UsingCodes=Y&Filter=N&title=Quote&VPD=Y';
  try {
    const res = await fetch(url, { headers: { 'Accept': 'text/csv' } });
    if (!res.ok) throw new Error(`BoE HTTP ${res.status}`);
    const csv = await res.text();
    const lines = csv.trim().split('\n').filter(l => l.includes(','));
    const last = lines[lines.length - 1];
    if (!last) throw new Error('BoE CSV empty');
    const [dateStr, valStr] = last.split(',').map(s => s.trim());
    const ref = parseBoEDate(dateStr);
    const pct = parseFloat(valStr);
    if (!ref || !Number.isFinite(pct)) throw new Error(`BoE unparseable: "${last}"`);

    return {
      source_key: 'BOE_10Y_GILT',
      metric_key: 'gilt_yield_10y',
      value:      pct / 100,
      unit:       'pct',
      reference_date: ref,
      source_url: 'https://www.bankofengland.co.uk/statistics/interactive-database',
      confidence: 'high',
      licence:    'OGL',
    };
  } catch (e) {
    console.error('[cron-cma-refresh] gilt yield failed:', (e as Error).message);
    return null;
  }
}

// ─── FTSE 100 close (Yahoo Finance JSON) ──────────────────────────────────
async function fetchFtse100(): Promise<CmaUpdate | null> {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EFTSE?interval=1d&range=5d';
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'sonuswealth-cma-refresh/1.0',
      },
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const ts: number[] = result?.timestamp || [];
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];
    let lastClose: number | null = null;
    let lastTs: number | null = null;
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null) { lastClose = closes[i]; lastTs = ts[i]; break; }
    }
    if (lastClose == null || lastTs == null) throw new Error('Yahoo returned no close prices');

    const ref = new Date(lastTs * 1000).toISOString().slice(0, 10);
    return {
      source_key: 'YAHOO_FTSE_100',
      metric_key: 'ftse_100_close',
      value:      lastClose,
      unit:       'index',
      reference_date: ref,
      source_url: 'https://finance.yahoo.com/quote/%5EFTSE',
      confidence: 'medium', // Yahoo is convenience; ICE Data is the canonical source
      licence:    'commercial_free',
    };
  } catch (e) {
    console.error('[cron-cma-refresh] FTSE 100 failed:', (e as Error).message);
    return null;
  }
}

// ─── PLSA Retirement Living Standards (manual quarterly figure) ───────────
// The PLSA only publishes RLS quarterly via a PDF, with no machine-readable
// endpoint. We store the most recent figure here. Update this constant when
// the PLSA publishes a new bulletin — log a TODO in finio_cron_status if the
// reference_date is more than 100 days old.
const PLSA_CURRENT = {
  // Source: PLSA Retirement Living Standards 2025 update
  // https://www.retirementlivingstandards.org.uk/
  reference_date: '2025-04-01',
  source_url: 'https://www.retirementlivingstandards.org.uk/',
  values: [
    { metric: 'rls_minimum_single',   value: 14400, unit: 'GBP_year' },
    { metric: 'rls_moderate_single',  value: 31300, unit: 'GBP_year' },
    { metric: 'rls_comfortable_single', value: 43100, unit: 'GBP_year' },
    { metric: 'rls_minimum_couple',   value: 22400, unit: 'GBP_year' },
    { metric: 'rls_moderate_couple',  value: 43100, unit: 'GBP_year' },
    { metric: 'rls_comfortable_couple', value: 59000, unit: 'GBP_year' },
  ],
};

function plsaUpdates(): CmaUpdate[] {
  return PLSA_CURRENT.values.map(v => ({
    source_key:     'PLSA_RLS',
    metric_key:     v.metric,
    value:          v.value,
    unit:           v.unit,
    reference_date: PLSA_CURRENT.reference_date,
    source_url:     PLSA_CURRENT.source_url,
    confidence:     'high',
    licence:        'commercial_restricted',
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function parseBoEDate(s: string): string | null {
  // BoE CSV uses "dd Mon yy" — e.g. "27 May 25"
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s+(\w{3})\s+(\d{2,4})$/);
  if (!m) return null;
  const [, dd, monStr, yyRaw] = m;
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const mon = months[monStr];
  if (mon == null) return null;
  const yy = +yyRaw < 100 ? 2000 + +yyRaw : +yyRaw;
  const d = new Date(Date.UTC(yy, mon, +dd));
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ─── Main handler ──────────────────────────────────────────────────────────
serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const updates: CmaUpdate[] = [];
  const errors: string[] = [];

  // Phase-1 sources — sequential to keep upstream load light.
  const gilt = await fetchGiltYield();
  if (gilt) updates.push(gilt); else errors.push('gilt_yield_10y');

  const ftse = await fetchFtse100();
  if (ftse) updates.push(ftse); else errors.push('ftse_100_close');

  // PLSA figures land every run — they're a static reference. The freshness
  // check (PLSA_CURRENT.reference_date age) lives in the response body so the
  // founder can spot it in the cron-health-check log.
  updates.push(...plsaUpdates());

  // Upsert each update — mark prior is_current=false for the same metric_key.
  let writtenCount = 0;
  for (const u of updates) {
    try {
      // 1. Demote previous row for this metric_key (if older reference_date)
      await supabase
        .from('market_cma_bundle')
        .update({ is_current: false })
        .eq('metric_key', u.metric_key)
        .lt('reference_date', u.reference_date);

      // 2. Upsert the new row. UNIQUE (jurisdiction, metric_key, reference_date)
      //    handles the re-run-same-day case.
      const { error } = await supabase
        .from('market_cma_bundle')
        .upsert({
          source_key:     u.source_key,
          metric_key:     u.metric_key,
          value:          u.value,
          unit:           u.unit,
          reference_date: u.reference_date,
          source_url:     u.source_url,
          confidence:     u.confidence,
          licence:        u.licence,
          is_current:     true,
          fetched_at:     new Date().toISOString(),
        }, { onConflict: 'jurisdiction,metric_key,reference_date' });
      if (error) throw error;
      writtenCount++;
    } catch (e) {
      errors.push(`${u.metric_key}: ${(e as Error).message}`);
    }
  }

  // PLSA staleness probe — surface in the response so cron-health-check
  // notices when the manual figure is overdue (>100 days).
  const plsaAgeDays = Math.floor(
    (Date.now() - new Date(PLSA_CURRENT.reference_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const plsaStale = plsaAgeDays > 100;

  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      writtenCount,
      attempted: updates.length,
      errors,
      plsa: { referenceDate: PLSA_CURRENT.reference_date, ageDays: plsaAgeDays, stale: plsaStale },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
});
