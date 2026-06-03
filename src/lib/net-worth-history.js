// src/lib/net-worth-history.js
// ─────────────────────────────────────────────────────────────────────────────
// Persistence for the point-in-time net-worth history + stored guidance routes.
// Thin wrapper over the Supabase client (RLS scopes rows to the signed-in user).
// The PURE snapshot builder is src/engine/financial-snapshot.js — this file only
// does I/O. Tables: migration 020_net_worth_history.sql.
//
// Why: a route is a function of the wealth snapshot; storing net worth by date
// means any guidance is reproducible against what was known THEN (Consumer Duty).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase.js'
import { financialSnapshot, snapshotHash } from '../engine/financial-snapshot.js'

const NWH = 'wealth_net_worth_history'
const GUID = 'wealth_guidance_snapshots'

// Record the current position as a dated snapshot. Idempotent per (person, as_of)
// — re-recording the same data-date upserts. Skips the write if the hash matches
// the latest stored snapshot for that date (no churn).
export async function recordSnapshot(entity, opts = {}) {
  const snap = financialSnapshot(entity, { asOf: opts.asOf || entity?.dataLastUpdated })
  if (!snap.asOf) return { skipped: true, reason: 'no as-of date on the data' }
  const userId = opts.userId || (await supabase.auth.getUser()).data?.user?.id
  if (!userId) return { skipped: true, reason: 'not signed in' }

  const row = {
    user_id: userId,
    person_id: snap.personId || 'self',
    as_of: snap.asOf,
    net_worth: snap.netWorth,
    pots: snap.pots,
    rules_version: snap.rulesVersion,
    snapshot_hash: snapshotHash(snap),
    payload: snap,
    captured_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from(NWH)
    .upsert(row, { onConflict: 'user_id,person_id,as_of' }).select().single()
  return { data, error }
}

// The position AS KNOWN ON OR BEFORE `date` — the most recent snapshot whose
// as_of <= date. This is what guidance must be reproduced against.
export async function getSnapshotAsOf(personId, date, opts = {}) {
  const userId = opts.userId || (await supabase.auth.getUser()).data?.user?.id
  const { data, error } = await supabase.from(NWH)
    .select('payload, as_of, net_worth')
    .eq('user_id', userId).eq('person_id', personId)
    .lte('as_of', date).order('as_of', { ascending: false }).limit(1)
  if (error) return { error }
  return { snapshot: data?.[0]?.payload || null, asOf: data?.[0]?.as_of || null }
}

// The net-worth-by-year series for a chart.
export async function netWorthSeries(personId, opts = {}) {
  const userId = opts.userId || (await supabase.auth.getUser()).data?.user?.id
  const { data, error } = await supabase.from(NWH)
    .select('as_of, net_worth, pots')
    .eq('user_id', userId).eq('person_id', personId)
    .order('as_of', { ascending: true })
  return { series: data || [], error }
}

// Store a guidance route, stamped with the data-date + snapshot hash it used.
// `stamped` is the output of solveDecumulation/solveAccumulation (already carries
// asOf, snapshot, snapshotHash, provenance via stampGuidance).
export async function recordGuidance(stamped, kind, opts = {}) {
  const userId = opts.userId || (await supabase.auth.getUser()).data?.user?.id
  if (!userId) return { skipped: true, reason: 'not signed in' }
  const row = {
    user_id: userId,
    person_id: stamped?.snapshot?.personId || opts.personId || 'self',
    kind,                                       // 'decumulation' | 'accumulation'
    as_of: stamped?.asOf || null,
    snapshot_hash: stamped?.snapshotHash || null,
    primary_goal: stamped?.binding?.primaryGoal || null,
    result: stamped,
    generated_at: stamped?.generatedAt || new Date().toISOString(),
  }
  const { data, error } = await supabase.from(GUID).insert(row).select().single()
  return { data, error }
}

export async function getGuidanceHistory(personId, opts = {}) {
  const userId = opts.userId || (await supabase.auth.getUser()).data?.user?.id
  const { data, error } = await supabase.from(GUID)
    .select('kind, as_of, primary_goal, snapshot_hash, generated_at, result')
    .eq('user_id', userId).eq('person_id', personId)
    .order('generated_at', { ascending: false })
  return { history: data || [], error }
}
