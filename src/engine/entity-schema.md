# Sonuswealth Entity Schema

**Version:** 1.0.0
**Authority:** `src/engine/taxonomy.js` (canonical enums) + `src/engine/persona-normalizer.js` (resolution + validation)
**Date:** 2026-05-28 (L2-2)

This document is the contract between Onboarding / DataCapture (the producers of entity records) and the engine selectors (the consumers). Anything reading an entity inside `src/engine/` or `src/components/` MUST tolerate the shape described here. Anything writing an entity (from a user form, an upload, or a migration) MUST produce a shape that `validateEntity(entity)` accepts without errors.

The schema is intentionally generous about *paths* (legacy fixtures use varied shapes — `entity.name` vs `entity.individual.name` vs `entity.profile.name`) but strict about *types* (every typed value must use a key from `src/engine/taxonomy.js`).

---

## Required fields

The engine refuses to render an entity that fails any of these:

| Field             | Resolves from                                                                | Why                          |
|-------------------|------------------------------------------------------------------------------|------------------------------|
| `name`            | `entity.name` \| `entity.individual.name` \| `entity.profile.name`           | UI identity, FCA traceability |
| `age` **or** `dob`| `entity.age` \| `entity.individual.age` \| `entity.dob` \| `entity.individual.dob` | Tax-band / life-stage / pension-access gates |

Calling `assertEntity(entity)` throws on either gap.

---

## Strongly-typed fields (must use taxonomy keys)

Every field below is validated against `src/engine/taxonomy.js`. Unknown values surface as warnings today; future versions will harden to errors.

| Path                                | Taxonomy enum         |
|-------------------------------------|-----------------------|
| `assets.sipp.pensions[].type`       | `pensionVehicleTypes` |
| `assets.pensions[].type`            | `pensionVehicleTypes` |
| `assets.{*}[].wrapper`              | `wrapperTypes`        |
| `assets.properties[].type`          | `assetTypes`          |
| `assets.businesses[].type`          | `assetTypes`          |
| `assets.alternatives[].type`        | `assetTypes`          |
| `assets.{*}[].ownership`            | `ownershipTypes`      |
| `assets.trusts[].type`              | `trustTypes`          |
| `assets.protection.{key}`           | `protectionTypes` (sub-key names match keys) |
| `maritalStatus` (any path)          | `maritalStatuses`     |
| `employmentType` / `work_status`    | `employmentTypes`     |
| `residencyStatus`                   | `residencyStatuses`   |

For income, liabilities, and spend the engine currently uses inline objects (named keys, not typed arrays). The taxonomy enums for those (`incomeTypes`, `liabilityTypes`, `spendCategories`) are advisory until the engine migrates to typed-array shapes — at which point the validator will start checking them.

---

## Soft-typed fields

These don't have to match an enum but the engine will warn if they're missing or malformed:

| Path                               | Why warned                                                                                  |
|------------------------------------|----------------------------------------------------------------------------------------------|
| `income.*`                         | Selectors gracefully default to 0 when absent, but tax exposure cannot be computed without it |
| `isCouple` / `partner`             | Couples missing a spouse name → spousal NRB still computes but cannot be displayed clearly  |
| `dependants[]`                     | HICBC, RNRB, child-related allowances cannot fire                                            |

---

## Versioning

- `TAXONOMY_VERSION` (in `taxonomy.js`) bumps on key removal or rename. Adding new keys does NOT bump.
- Entities can carry an optional `taxonomy_version` string. If older than engine's, a warning is raised; if newer, the engine refuses to render (forward-incompatible).

Migrations:
- A key rename (e.g. `single-trader` → `self-employed`) requires a fixture migration script.
- A key removal requires a deprecation notice (one release with warning) before deletion.

---

## Schema validation API

```js
import { validateEntity, assertEntity } from './engine/persona-normalizer.js'

const r = validateEntity(entity)
// r = { ok, errors, warnings, canonical, requiredFields }

if (!r.ok) {
  console.error('Entity invalid:', r.errors)
}

// Hard variant — throws on first hard error.
try {
  assertEntity(entity)
} catch (e) {
  // e.code === 'entity_invalid'
  // e.errors[] === r.errors
}
```

---

## How Onboarding should produce a compliant entity

Minimum payload after Onboarding completes:

```jsonc
{
  "id": "user-7f3a...",
  "name": "Sarah Patel",
  "age": 38,
  "maritalStatus": "married",          // from maritalStatuses
  "residencyStatus": "uk-domiciled",   // from residencyStatuses
  "individual": {
    "employment_type": "employed-paye" // from employmentTypes
  },
  "income": {
    "employment": 62000,
    "dividends": 0,
    "savingsInterest": 240
  },
  "assets": {
    "cash": { "total": 24000 },
    "isa": { "value": 18000 },
    "sipp": {
      "total": 92000,
      "pensions": [
        { "type": "occupational-DC", "value": 92000, "wrapper": "SIPP" }
      ]
    },
    "residence": { "value": 480000, "ownershipShare": 1, "ownership": "joint-tenants" }
  },
  "liabilities": {
    "mortgage": { "outstanding": 312000, "rateType": "fixed", "remainingYears": 22 }
  },
  "taxonomy_version": "1.0.0"
}
```

`assertEntity(payload)` returns clean on the above. Add jurisdiction, dependants, protection, trusts as the user provides them — the engine handles absence gracefully.
