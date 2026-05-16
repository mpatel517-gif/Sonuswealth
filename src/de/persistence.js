/**
 * src/de/persistence.js — Decision Engine scenario + plan persistence
 *
 * Two persistence modes:
 *   draft   — "Save as scenario"  → localStorage, survives session
 *   plan    — "Commit"            → localStorage with COMMITTED status, surfaced on Home + Timeline
 *
 * No server side at v1.0. Replace localStorage with API call post-demo.
 */

const DRAFT_KEY    = 'sw_de_drafts';
const PLAN_KEY     = 'sw_de_plans';
const MAX_DRAFTS   = 20;
const MAX_PLANS    = 50;

function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}
function writeStore(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch { /* quota */ }
}
function newId() { return `de_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ── Drafts (scenarios) ───────────────────────────────────────────────────────

export function saveDraft(tree, meta = {}) {
  const drafts = readStore(DRAFT_KEY);
  const entry = {
    id:        newId(),
    createdAt: new Date().toISOString(),
    status:    'DRAFT',
    events:    tree.events ?? [],
    decision:  tree.decision ?? '',
    tree,
    meta,
  };
  drafts.unshift(entry);
  if (drafts.length > MAX_DRAFTS) drafts.length = MAX_DRAFTS;
  writeStore(DRAFT_KEY, drafts);
  return entry.id;
}

export function listDrafts() {
  return readStore(DRAFT_KEY);
}

export function getDraft(id) {
  return readStore(DRAFT_KEY).find(d => d.id === id) ?? null;
}

export function deleteDraft(id) {
  const drafts = readStore(DRAFT_KEY).filter(d => d.id !== id);
  writeStore(DRAFT_KEY, drafts);
}

// ── Plans (committed) ────────────────────────────────────────────────────────

export function commitPlanDE(tree, chosenPathId, meta = {}) {
  const plans = readStore(PLAN_KEY);
  const chosenOption = tree.options?.find(o => o.id === chosenPathId);
  const entry = {
    id:          newId(),
    createdAt:   new Date().toISOString(),
    status:      'COMMITTED',
    events:      tree.events ?? [],
    decision:    tree.decision ?? '',
    chosenPathId,
    chosenOption,
    sequence:    chosenOption?.sequence ?? [],
    tree,
    meta,
  };
  plans.unshift(entry);
  if (plans.length > MAX_PLANS) plans.length = MAX_PLANS;
  writeStore(PLAN_KEY, plans);
  return entry.id;
}

export function listPlans() {
  return readStore(PLAN_KEY);
}

export function getPlan(id) {
  return readStore(PLAN_KEY).find(p => p.id === id) ?? null;
}

export function updatePlanStatus(id, status) {
  const plans = readStore(PLAN_KEY).map(p =>
    p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
  );
  writeStore(PLAN_KEY, plans);
}
