// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: cron-rules-activation
// Schedule: daily 00:01 UTC
// Purpose: activate any rules bundles with status='scheduled' and
//          effective_from = today. Log to rules_activation_log.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (_req) => {
  const start = Date.now();
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  // Find rules scheduled for today
  const { data: bundles, error: fetchErr } = await client
    .from('market_rules_bundles')
    .select('id, bundle_id, jurisdiction, effective_from')
    .eq('status', 'scheduled')
    .lte('effective_from', today);

  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const activated: any[] = [];
  for (const b of bundles || []) {
    // Mark old active bundle as superseded
    const { error: supErr } = await client
      .from('market_rules_bundles')
      .update({ status: 'superseded', superseded_by_id: b.id })
      .eq('jurisdiction', b.jurisdiction)
      .eq('status', 'active');

    // Activate the new one
    const { error: actErr } = await client
      .from('market_rules_bundles')
      .update({ status: 'active', activated_at: new Date().toISOString() })
      .eq('id', b.id);

    activated.push({ bundle_id: b.bundle_id, jurisdiction: b.jurisdiction,
                     supersede_error: supErr?.message, activate_error: actErr?.message });
  }

  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - start,
      activated_count: activated.length,
      activated,
    }, null, 2),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
