// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: cron-budget-watch (L4-3 — 2026-05-28)
// Schedule: weekly Monday 04:00 UTC (registered via migration 019)
// Purpose: probe HMRC / gov.uk rate pages for change so we hear about a
//          Budget announcement same-day rather than via user complaints.
//
// Approach: HTTP HEAD on each URL. Compare ETag + Last-Modified vs the most
// recent stored values. Insert a row per page per run; mark `changed:true`
// when either header differs from the prior row. Slack alert on any change.
//
// What it doesn't do:
//   - Diff the page content (too brittle — restructures bump even when rates
//     don't change). Header signal is "a human published an update", at which
//     point the founder reads the page and decides.
//   - Create a GitHub issue (deferred to L4-3b, needs GH App auth).
//
// Env:
//   SUPABASE_URL                — auto-set
//   SUPABASE_SERVICE_ROLE_KEY   — auto-set
//   CRON_SLACK_WEBHOOK (optional) — shared with cron-health-check
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { PAGES } from '../_shared/budget-watch-pages.js';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SLACK_WEBHOOK             = Deno.env.get('CRON_SLACK_WEBHOOK') || '';

async function probePage(url: string): Promise<{ etag: string | null; lastModified: string | null; contentLength: number | null; status: number; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'sonuswealth-budget-watch/1.0 (+contact: founder@sonuswealth.example)' },
    });
    return {
      etag:         res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      contentLength: parseInt(res.headers.get('content-length') || '0', 10) || null,
      status:       res.status,
      error:        null,
    };
  } catch (e) {
    return { etag: null, lastModified: null, contentLength: null, status: 0, error: (e as Error).message };
  }
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const changes: Array<{ key: string; url: string; reason: string }> = [];
  const results: Array<any> = [];

  for (const page of PAGES) {
    // Find the most recent prior row for this page
    const { data: priorRows } = await supabase
      .from('finio_budget_watch')
      .select('etag, last_modified')
      .eq('page_key', page.key)
      .order('checked_at', { ascending: false })
      .limit(1);
    const prior = priorRows?.[0] || null;

    const probe = await probePage(page.url);

    let changed = false;
    let reason = '';
    if (probe.error || probe.status >= 400) {
      reason = `HTTP ${probe.status}${probe.error ? `: ${probe.error}` : ''}`;
    } else if (prior) {
      const etagChanged = (probe.etag || '') !== (prior.etag || '');
      const lmChanged   = (probe.lastModified || '') !== (prior.last_modified || '');
      if (etagChanged || lmChanged) {
        changed = true;
        reason = [
          etagChanged ? `ETag ${prior.etag} → ${probe.etag}` : null,
          lmChanged   ? `Last-Modified ${prior.last_modified} → ${probe.lastModified}` : null,
        ].filter(Boolean).join('; ');
      }
    } else {
      // First probe — record but don't alert
      reason = 'first probe (no prior baseline)';
    }

    await supabase.from('finio_budget_watch').insert({
      page_key:           page.key,
      url:                page.url,
      etag:               probe.etag,
      last_modified:      probe.lastModified,
      content_length:     probe.contentLength,
      http_status:        probe.status,
      changed,
      prior_etag:         prior?.etag ?? null,
      prior_last_modified: prior?.last_modified ?? null,
      notes:              reason || null,
    });

    if (changed) changes.push({ key: page.key, url: page.url, reason });
    results.push({ key: page.key, status: probe.status, changed, reason });
  }

  // Slack alert on any change
  if (changes.length > 0 && SLACK_WEBHOOK) {
    const lines = [
      `*Sonuswealth budget watch* — ${changes.length} gov.uk page(s) changed:`,
      ...changes.map(c => `📄 ${c.key} — ${c.reason}\n   ${c.url}`),
    ];
    try {
      await fetch(SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lines.join('\n') }),
      });
    } catch (e) {
      console.error('[cron-budget-watch] Slack post failed:', (e as Error).message);
    }
  } else if (changes.length > 0) {
    console.warn('[cron-budget-watch] CHANGES detected without Slack webhook:', changes);
  }

  return new Response(
    JSON.stringify({ ok: true, probed: PAGES.length, changes: changes.length, results }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
});
