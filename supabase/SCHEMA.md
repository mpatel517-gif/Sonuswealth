# Sonuswealth — Database Schema & Linkage Map

**Summary:** canonical map of every table, its domain group, and its foreign-key links.
**Updated:** 2026-06-03 (migration 021 — domain-grouped naming)
**Source of truth:** generated from the live Postgres FK catalogue. Re-derive after any schema change.

---

## Naming convention (the logic)

No app-name prefix — it carries no information when there's only one app in the database. Tables are grouped by **domain**, and links are made legible by **standardised FK columns**.

| Prefix | Domain | What lives here |
|---|---|---|
| `core_` | The user's real financial graph | entities, the event store, household links, bank connections |
| `market_` | External reference data the engine reads | tax-rule bundles, macro variables + history, capital-market assumptions |
| `persona_` | Test fixtures + their computed output | the persona library, per-year snapshots |
| `ops_` | System / telemetry / scheduler | audit log, rule-bundle activations, scheduler state |
| `wealth_` | Point-in-time position + guidance | net-worth history, stored guidance routes |

**FK rule:** every foreign key is `<singular_parent>_id` referencing `<parent>.id` (e.g. `persona_id → persona_fixtures.id`). Grep a column name to find everything that links to a parent.

---

## Tables by domain

### core_
| Table | Key columns | Links out |
|---|---|---|
| `core_entities` | id, user_id | — (root of the graph) |
| `core_entity_links` | id, entity_a_id, entity_b_id, relationship, authority | `entity_a_id`, `entity_b_id` → `core_entities` |
| `core_events` | id, entity_id (append-only event store) | `entity_id` → `core_entities` |
| `core_user_connections` | id, entity_id (Open Banking, TrueLayer) | `entity_id` → `core_entities` |

### market_
| Table | Key columns | Links out |
|---|---|---|
| `market_rules_bundles` | id, bundle_id, jurisdiction, status, superseded_by_id | `superseded_by_id` → `market_rules_bundles` (self) |
| `market_macro_variables` | id, jurisdiction, variable_key, value (current values) | — |
| `market_macro_history` | id, jurisdiction, tax_year, variable_key, value | — |
| `market_cma_bundle` | id, source_key, metric_key, value, is_current | — |

### persona_
| Table | Key columns | Links out |
|---|---|---|
| `persona_fixtures` | id, persona_id, family, archetype, profile (jsonb) | — |
| `persona_snapshots` | id, persona_id, tax_year, balance_sheet/pl/cashflow/risk | `persona_id` → `persona_fixtures` |

### ops_
| Table | Key columns | Links out |
|---|---|---|
| `ops_test_audit_log` | id, run_id, persona_id, status, before/after_snapshot_id | `persona_id` → `persona_fixtures`; `before_snapshot_id`, `after_snapshot_id` → `persona_snapshots` |
| `ops_bundle_activations` | id, bundle_id, activation_event_id (X22 breadcrumb) | `activation_event_id` → `core_events` |
| `ops_scheduled_activations` | id, bundle_id, rule_key, status, activation_event_id | `activation_event_id` → `core_events` |

### wealth_
| Table | Key columns | Links out |
|---|---|---|
| `wealth_net_worth_history` | id, user_id, person_id, as_of, net_worth, pots | `user_id` → `auth.users` |
| `wealth_guidance_snapshots` | id, user_id, person_id, kind, as_of, result | `user_id` → `auth.users` |

---

## Linkage graph (FK edges)

```
core_entities ◄── core_events.entity_id
              ◄── core_user_connections.entity_id
              ◄── core_entity_links.entity_a_id
              ◄── core_entity_links.entity_b_id

core_events   ◄── ops_bundle_activations.activation_event_id
              ◄── ops_scheduled_activations.activation_event_id

persona_fixtures ◄── persona_snapshots.persona_id
                 ◄── ops_test_audit_log.persona_id

persona_snapshots ◄── ops_test_audit_log.before_snapshot_id
                  ◄── ops_test_audit_log.after_snapshot_id

market_rules_bundles ◄── market_rules_bundles.superseded_by_id  (self-ref)

auth.users ◄── wealth_net_worth_history.user_id
           ◄── wealth_guidance_snapshots.user_id
```

---

## RLS posture (per table)

- **Entity-scoped** (`current_setting('app.current_entity_id')`): `core_entities`, `core_events`, `core_user_connections`, `core_entity_links`
- **Anon-read reference data** (`true`): `market_rules_bundles`, `market_macro_variables`, `market_macro_history`, `market_cma_bundle`, `persona_fixtures`, `persona_snapshots`, `ops_test_audit_log`
- **Owner via `auth.uid()`**: `wealth_net_worth_history`, `wealth_guidance_snapshots`
- **Service-role only** (RLS on, no permissive policy): `ops_bundle_activations`, `ops_scheduled_activations`

---

## Application code → table mapping

- Frontend reads via `TABLES.*` constants in `src/lib/supabase.js` (the indirection — keys unchanged, values point to the new names).
- Direct string refs live in `src/lib/data-source.js`, `src/lib/net-worth-history.js`.
- Edge functions (`supabase/functions/*`) reference table strings directly — **redeploy them after applying migration 021**.

> Historical migrations `001`–`020` retain the old `finio_` names (they're an append-only record). Migration `021` performs the rename forward.
