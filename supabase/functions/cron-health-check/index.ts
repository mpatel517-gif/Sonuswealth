// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: cron-health-check (L4-2 — 2026-05-28)
// Schedule: hourly at :07 (registered via migration 016)
//
// Watches the crons in the MONITORS registry by querying the latest write to
// each cron's destination table. Stale rows → Slack alert. Result of every
// check is logged to finio_cron_status (append-only) so the founder can
// audit "when did context-pull last succeed?" without trawling Edge logs.
//
// Decision logic lives in src/lib/cron-health.js so it's unit-testable under
// Node. This file is the I/O wrapper: query, decide, write, alert.
//
// Env:
//   SUPABASE_URL                      — auto-set
//   SUPABASE_SERVICE_ROLE_KEY         — auto-set
//   CRON_SLACK_WEBHOOK   (optional)   — POST stale alerts here as plain JSON
//                                        { text: "…" }. If unset, alerts go to
//                                        console.error only.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { MONITORS, decideStatus, summarise } from '../_shared/cron-health.js';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SLACK_WEBHOOK             = Deno.env.get('CRON_SLACK_WEBHOOK') || '';

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const decisions: Array<any> = [];

  for (const m of MONITORS) {
    let lastSeenIso: string | null = null;
    let queryError: string | null = null;
    try {
      const { data, error } = await supabase
        .from(m.table)
        .select(m.timestampColumn)
        .order(m.timestampColumn, { ascending: false })
        .limit(1);
      if (error) throw error;
      lastSeenIso = data?.[0]?.[m.timestampColumn] ?? null;
    } catch (e) {
      queryError = (e as Error).message || 'query failed';
    }

    const decision = decideStatus({
      now,
      lastSeenIso,
      thresholdSeconds: m.thresholdSeconds,
    });

    decisions.push({
      cronName: m.cronName,
      thresholdSeconds: m.thresholdSeconds,
      ...decision,
      queryError,
    });

    // Insert one row per check, per cron. Append-only so the founder can
    // graph "stale events over time" later.
    await supabase
      .from('finio_cron_status')
      .insert({
        cron_name:         m.cronName,
        status:            queryError ? 'unknown' : decision.status,
        last_seen:         decision.lastSeen ? decision.lastSeen.toISOString() : null,
        age_seconds:       decision.ageSeconds,
        threshold_seconds: m.thresholdSeconds,
        checked_at:        now.toISOString(),
        notes:             queryError || null,
      });
  }

  const summary = summarise(decisions);

  // Alert path: only fire on stale (not unknown — unknown happens on first
  // deploy before the first daily run, so it'd spam Slack with false alarms).
  if (summary.anyStale && SLACK_WEBHOOK) {
    try {
      await fetch(SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*Sonuswealth cron alert* — ${summary.staleCount} stale cron(s):\n${summary.alertLines.join('\n')}`,
        }),
      });
    } catch (e) {
      console.error('[cron-health-check] Slack post failed:', (e as Error).message);
    }
  } else if (summary.anyStale) {
    console.error('[cron-health-check] STALE without Slack webhook:', summary.alertLines.join(' · '));
  }

  return new Response(
    JSON.stringify({
      ok:        true,
      checkedAt: now.toISOString(),
      summary,
      decisions,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
});
