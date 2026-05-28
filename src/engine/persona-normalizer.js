/**
 * src/engine/persona-normalizer.js
 *
 * S3 — Persona Schema Normaliser (Phase 3, 2026-05-28)
 *
 * Resolves shape drift between the three known persona families:
 *
 *   · UI-live (persona-a … persona-g)
 *       Top-level: { name, dob, age, income.{employment,dividends,…},
 *                    dependants[], assets.{pensions[],property[],…}, … }
 *
 *   · Engine-test mrT-* (mrT-core, mrT-couple, mrT-divorced, mrT-family, …)
 *       Nested:    { individual.{name,dob,gross_salary,…},
 *                    partner.{…}, children[], assets.pensions[], … }
 *
 *   · Historical (persona-series-A … persona-series-F)
 *       Time-keyed snapshots with `as_of` envelope.
 *
 * Why this exists:
 *   Audit P0-10 (HICBC) source-verified but couldn't be live-tested because
 *   no UI persona had `dependants[type=child, age<18]` — mrT-family had
 *   exactly that shape but as `children[]`, not `dependants[]`. The same
 *   shape drift hit `name` (top vs `individual.name`), `gross_salary` (top
 *   `income.employment` vs `individual.gross_salary`), `dob` (top vs
 *   `individual.dob`), `spouse` (top vs `partner`).
 *
 *   Calling `normalisePersona(entity)` returns a persona-like object whose
 *   top-level fields are guaranteed populated when ANY of the supported
 *   shapes provided them. The original `entity` is NOT mutated — the
 *   returned object shallow-overlays canonical fields on top of `entity`,
 *   so any code that walked the raw shape still works.
 *
 * Companion: `validatePersona(entity)` returns `{ ok, errors, warnings,
 * canonical }` — useful for a dev-mode HUD or schema CI check.
 *
 * Also exports `dependants(entity)` — the unified family reader used by
 * `calcHICBC`, family-protection gap, JISA/junior-pension scoping.
 */

import { maritalStatus } from './persona-helpers.js';

// ── Internal helpers ────────────────────────────────────────────────────────

function _yearsBetween(from, to = new Date()) {
  if (!from) return null;
  const d = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(d.getTime())) return null;
  const diff = to - d;
  if (diff < 0) return 0;
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function _firstString(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

function _firstNumber(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
  }
  return null;
}

// ── §1 — dependants(entity) — unified family reader ─────────────────────────
/**
 * Return the canonical dependants array regardless of which shape the persona
 * uses. Reads (in order of precedence):
 *
 *   1. entity.dependants[]              (UI personas a-g; rich type tags)
 *   2. entity.individual.dependants[]   (some nested shapes)
 *   3. entity.children[]                (mrT-family; treated as type='child')
 *   4. entity.individual.children[]     (defensive)
 *
 * Output shape:
 *   [{
 *     id?: string,
 *     name?: string,
 *     age: number,           // resolved from .age or computed from .dob
 *     type: 'child' | 'partner' | 'parent' | 'other',
 *     financiallyDependent: boolean,  // .financiallyDependent ?? .dependent ?? true
 *     rawSource: '...'       // which field the entry came from (for debug)
 *   }]
 *
 * @param {object} entity
 * @returns {Array}
 */
// ─────────────────────────────────────────────────────────────────────────────
// LPA — Unified reader (CX-6 closure, 2026-05-28)
// ─────────────────────────────────────────────────────────────────────────────
// Resolves three known shape variants:
//   (a) entity.estate.lpa.{propertyFinancial,healthWelfare} + *Registered + *Date
//       (used by tax-estate-engine.willLpaStatus)
//   (b) entity.estate.{lpaHealth,lpaFinance}.status
//       (used by MoneyTrusts.jsx, EstateVault chart)
//   (c) entity.lpa.{health,finance} (legacy short form, occasionally seen)
//
// Returns canonical envelope:
//   {
//     health:  { exists, registered, signedDate, staleFlag, status, source },
//     finance: { exists, registered, signedDate, staleFlag, status, source },
//   }
//
// Status mapping ('registered'|'inProgress'|'notStarted'|'unknown'):
//   - shape (a): exists+registered → 'registered'; exists only → 'inProgress';
//                otherwise 'notStarted'.
//   - shape (b): trust the .status string verbatim, fallback 'notStarted'.
//
// staleFlag: true when signedDate is more than 10 years old (OPG guidance —
// donor signing capacity can be challenged on very old LPAs).

function _readOne(estate, keyA, keyARegistered, keyADate, shortObj) {
  // Shape (a) — long form with separate registered/date fields
  const longExists = !!(estate?.lpa?.[keyA]);
  const longRegistered = !!(estate?.lpa?.[keyARegistered]);
  const longDate = estate?.lpa?.[keyADate] || null;
  // Shape (b) — short object with .status
  const shortStatus = shortObj?.status || null;
  const shortDate = shortObj?.signedDate || shortObj?.date || null;
  const shortExists = !!shortObj && (
    shortStatus === 'registered' ||
    shortStatus === 'inProgress' ||
    shortStatus === 'signed' ||
    !!shortDate
  );
  // Shape (c) — bare booleans on root estate
  const bareExists = estate?.[keyA] === true || !!estate?.[keyA + 'Status'];

  const exists = longExists || shortExists || bareExists;
  const registered =
    longRegistered ||
    shortStatus === 'registered';
  const signedDate = longDate || shortDate || null;
  const staleFlag = signedDate
    ? _yearsBetween(signedDate) > 10
    : (exists ? true : null);  // if exists but no date, mark stale; if absent, null

  let status = 'notStarted';
  if (registered)                                 status = 'registered';
  else if (shortStatus === 'inProgress' ||
           shortStatus === 'signed')              status = 'inProgress';
  else if (exists)                                status = 'inProgress';

  let source = null;
  if (longExists)       source = 'estate.lpa.' + keyA;
  else if (shortExists) source = shortObj === estate?.lpaHealth   ? 'estate.lpaHealth'
                              : shortObj === estate?.lpaFinance  ? 'estate.lpaFinance'
                              : 'estate.lpa.short';
  else if (bareExists)  source = 'estate.' + keyA;

  return { exists, registered, signedDate, staleFlag, status, source };
}

/**
 * Unified LPA reader. Probes 3 known shape variants and returns canonical envelope.
 *
 * @param {object} entity
 * @returns {{ health: object, finance: object }}
 */
export function lpaStatus(entity) {
  const estate = entity?.estate || {};
  const health  = _readOne(estate, 'healthWelfare',
                                    'healthWelfareRegistered',
                                    'healthWelfareDate',
                                    estate.lpaHealth || entity?.lpa?.health);
  const finance = _readOne(estate, 'propertyFinancial',
                                    'propertyFinancialRegistered',
                                    'propertyFinancialDate',
                                    estate.lpaFinance || entity?.lpa?.finance);
  return { health, finance };
}

export function dependants(entity) {
  if (!entity || typeof entity !== 'object') return [];

  const out = [];

  // Probe 1: entity.dependants[] — the canonical UI shape
  if (Array.isArray(entity.dependants)) {
    for (const d of entity.dependants) {
      out.push(_normaliseDependantRecord(d, 'entity.dependants'));
    }
  }
  // Probe 2: entity.individual.dependants[]
  else if (Array.isArray(entity?.individual?.dependants)) {
    for (const d of entity.individual.dependants) {
      out.push(_normaliseDependantRecord(d, 'entity.individual.dependants'));
    }
  }

  // Probe 3: entity.children[] — mrT-family shape, all type='child'
  if (Array.isArray(entity.children)) {
    for (const c of entity.children) {
      out.push(_normaliseDependantRecord({ ...c, type: 'child' }, 'entity.children'));
    }
  }
  // Probe 4: entity.individual.children[]
  else if (Array.isArray(entity?.individual?.children)) {
    for (const c of entity.individual.children) {
      out.push(_normaliseDependantRecord({ ...c, type: 'child' }, 'entity.individual.children'));
    }
  }

  return out;
}

function _normaliseDependantRecord(d, source) {
  const age = _firstNumber(d?.age, _yearsBetween(d?.dob));
  return {
    id: d?.id || null,
    name: d?.name || null,
    age: age != null ? age : 0,
    type: d?.type || 'other',
    financiallyDependent:
      d?.financiallyDependent != null ? !!d.financiallyDependent
      : d?.dependent          != null ? !!d.dependent
      : true,
    rawSource: source,
  };
}

// ── §2 — normalisePersona(entity) — canonical view ──────────────────────────
/**
 * Return a shallow-overlay view of `entity` where the most-drifted top-level
 * fields are guaranteed to be set when ANY supported shape provided them.
 *
 * The original entity is NOT mutated. Returns a new object whose own
 * properties are the canonical resolved values, with the source `entity`'s
 * properties accessible via `Object.assign` or destructuring fallback.
 *
 * Canonical fields produced:
 *   · name          (string|null)
 *   · dob           (string|null, ISO date)
 *   · age           (number|null, resolved from .age or computed from dob)
 *   · maritalStatus (string, from maritalStatus(entity).status)
 *   · isCouple      (boolean, from maritalStatus(entity).isCouple)
 *   · dependants    (array, from dependants(entity))
 *   · spouseName    (string|null, from spouse?.name or partner.name)
 *   · spouseDob     (string|null)
 *   · spouseAge     (number|null)
 *   · jurisdiction  (string, default 'UK')
 *
 * @param {object} entity
 * @returns {object} canonical-overlay view (original entity properties preserved)
 */
export function normalisePersona(entity) {
  if (!entity || typeof entity !== 'object') {
    return {
      name: null, dob: null, age: null,
      maritalStatus: 'unknown', isCouple: false,
      dependants: [],
      spouseName: null, spouseDob: null, spouseAge: null,
      jurisdiction: 'UK',
    };
  }

  const name = _firstString(
    entity.name,
    entity?.individual?.name,
    entity?.profile?.name,
  );
  const dob = _firstString(
    entity.dob,
    entity?.individual?.dob,
    entity?.profile?.dob,
  );
  const age = _firstNumber(
    entity.age,
    entity?.individual?.age,
    _yearsBetween(dob),
  );

  const ms = maritalStatus(entity);

  const spouse = entity.spouse || entity.partner || entity?.individual?.partner || null;
  const spouseName = spouse?.name || null;
  const spouseDob  = spouse?.dob || null;
  const spouseAge  = _firstNumber(spouse?.age, _yearsBetween(spouseDob));

  const jurisdiction = _firstString(
    entity?.profile?.country,
    entity?.jurisdiction?.primary,
    entity?.jurisdiction,
  ) || 'UK';

  // Shallow-overlay so existing field reads still work.
  return {
    ...entity,
    name,
    dob,
    age,
    maritalStatus: ms.status,
    isCouple: ms.isCouple,
    dependants: dependants(entity),
    spouseName,
    spouseDob,
    spouseAge,
    jurisdiction,
  };
}

// ── §3 — validatePersona(entity) — schema diagnostics ──────────────────────
/**
 * Diagnostic walker: returns `{ ok, errors, warnings, canonical }` listing
 * fields that are missing, ambiguous, or inconsistent. Used by:
 *   · dev-mode HUD chip (planned, Phase 9)
 *   · CI schema check on persona fixtures
 *   · Founder-facing PersonaGap surface diagnostics
 *
 * Errors  — block render (no name / no dob / no income shape)
 * Warnings — degrade fidelity but render OK (no dependants / no spouse for couple)
 *
 * @param {object} entity
 * @returns {{ ok:boolean, errors:string[], warnings:string[], canonical:object }}
 */
export function validatePersona(entity) {
  const canonical = normalisePersona(entity);
  const errors = [];
  const warnings = [];

  if (!entity || typeof entity !== 'object') {
    errors.push('entity is null or not an object');
    return { ok: false, errors, warnings, canonical };
  }

  if (!canonical.name) errors.push('no resolvable name (checked: entity.name, entity.individual.name, entity.profile.name)');
  if (!canonical.dob && canonical.age == null) errors.push('no resolvable dob/age (checked: entity.dob, entity.individual.dob, entity.age, entity.individual.age)');

  if (canonical.maritalStatus === 'unknown') warnings.push('no resolvable marital status — defaults to single in spousal-NRB / inter-spouse paths');

  if (canonical.isCouple && !canonical.spouseName) {
    warnings.push('persona declared as couple but no spouse/partner name found');
  }

  // Income shape check — needed for tax engine
  const hasIncome = entity?.income || entity?.individual?.gross_salary || entity?.individual?.adjusted_net_income;
  if (!hasIncome) warnings.push('no resolvable income shape (checked: entity.income, entity.individual.gross_salary, entity.individual.adjusted_net_income)');

  // Dependants check — informational
  if (canonical.dependants.length === 0 && (entity.dependants || entity.children || entity?.individual?.dependants)) {
    warnings.push('dependants array present but empty after normalisation — check shape');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    canonical,
  };
}
