/**
 * src/de/validator.js — Engine-pure consequence validation
 *
 * Takes a Claude-generated decision tree, finds every consequence with an
 * engineCall field, calls the real engine function, and replaces the
 * placeholder value with the real result.
 *
 * CONTRACT: No LLM arithmetic ever reaches the user.
 * If an engine call fails or the function doesn't exist, the consequence
 * is dropped rather than faked.
 */

import {
  calcNetWorth,
  ihtDynamic,
  monthlySurplus,
  lsaHeadroom,
  fiRatio,
  debtRatio,
  protectionScore,
  cashflowHealth,
  netWorthAtYears,
  estateReadiness,
  willLpaStatus,
  allowanceTracker,
  giftClockAll,
  ihtWaterfall,
  giftClockProjection,
  taxAndEstateImpact,
  bengenProjection,
  totalCoI,
  drawdownMatrix,
} from '../engine/fq-calculator.js';

import {
  swrRegime,
  probabilityOfSuccess,
  fiveCashflowScenarios,
  maxDrawdownExposure,
  sequenceOfReturnsVulnerability,
  realityEngineFactorisation,
} from '../engine/cashflow-engine.js';

import {
  ihtExposure,
  allowanceTracker as allowanceTrackerTE,
  incomeTaxDetail,
  cgtDetail,
  drawdownMatrix  as drawdownMatrixTE,
  giftClockProjection as giftClockProjectionTE,
  willLpaStatus   as willLpaStatusTE,
  rnrbTaper,
  bprQualifyingValue,
  nominationStatus,
  costOfInaction,
  taxDrag,
  taxThisYear,
} from '../engine/tax-estate-engine.js';

import { calcMilestones } from '../engine/timeline-engine.js';
import { simulate, netWorthImpact, ihtImpact } from '../engine/simulator.js';
import { runShock, riskShockSuite } from '../engine/risk-engine.js';
import { monthlyFlow, allocationPressure } from '../engine/monthly-flow-engine.js';

// ── Engine registry ───────────────────────────────────────────────────────────
// Keyed as ENGINE_REGISTRY[engineId][fnName](entity, ...extraArgs)
// Each wrapper normalises the call — entity is always first, extraArgs spread after.
// Returns null on any error rather than throwing.

const ENGINE_REGISTRY = {

  fq: {
    calcNetWorth:        (entity)               => calcNetWorth(entity),
    ihtDynamic:          (entity)               => ihtDynamic(entity, true),
    monthlySurplus:      (entity)               => monthlySurplus(entity),
    lsaHeadroom:         (entity)               => lsaHeadroom(entity),
    fiRatio:             (entity)               => fiRatio(entity),
    debtRatio:           (entity)               => debtRatio(entity),
    protectionScore:     (entity)               => protectionScore(entity),
    cashflowHealth:      (entity)               => cashflowHealth(entity),
    netWorthAtYears:     (entity, years = 10)   => netWorthAtYears(entity, years),
    bengenProjection:    (entity, years = 30)   => bengenProjection(entity, years),
    estateReadiness:     (entity)               => estateReadiness(entity),
    willLpaStatus:       (entity)               => willLpaStatus(entity),
    allowanceTracker:    (entity)               => allowanceTracker(entity),
    giftClockAll:        (entity)               => giftClockAll(entity),
    ihtWaterfall:        (entity)               => ihtWaterfall(entity),
    giftClockProjection: (entity)               => giftClockProjection(entity),
    taxAndEstateImpact:  (entity, action = {})  => taxAndEstateImpact(entity, action),
    totalCoI:            (entity)               => totalCoI(entity),
    drawdownMatrix:      (entity)               => drawdownMatrix(entity),
  },

  cashflow: {
    swrRegime:                     (entity, regime = 'conservative') => swrRegime(entity, regime),
    probabilityOfSuccess:          (entity)       => probabilityOfSuccess(entity),
    fiveCashflowScenarios:         (entity)       => fiveCashflowScenarios(entity),
    maxDrawdownExposure:           (entity)       => maxDrawdownExposure(entity),
    sequenceOfReturnsVulnerability:(entity)       => sequenceOfReturnsVulnerability(entity),
    realityEngineFactorisation:    (entity)       => realityEngineFactorisation(entity),
  },

  tax: {
    ihtExposure:          (entity)               => ihtExposure(entity, 'UK-2026.1'),
    allowanceTracker:     (entity)               => allowanceTrackerTE(entity),
    incomeTaxDetail:      (entity, delta = 0)    => incomeTaxDetail(entity, delta),
    cgtDetail:            (entity)               => cgtDetail(entity),
    drawdownMatrix:       (entity)               => drawdownMatrixTE(entity),
    giftClockProjection:  (entity)               => giftClockProjectionTE(entity),
    willLpaStatus:        (entity)               => willLpaStatusTE(entity),
    rnrbTaper:            (entity)               => rnrbTaper(entity),
    bprQualifyingValue:   (entity)               => bprQualifyingValue(entity),
    nominationStatus:     (entity)               => nominationStatus(entity),
    costOfInaction:       (entity)               => costOfInaction(entity),
    taxDrag:              (entity)               => taxDrag(entity),
    taxThisYear:          (entity)               => taxThisYear(entity),
  },

  timeline: {
    calcMilestones: (entity) => calcMilestones(entity),
  },

  simulator: {
    simulate:       (entity, overrides = {}) => simulate(entity, overrides),
    netWorthImpact: (entity, overrides = {}) => netWorthImpact(entity, overrides),
    ihtImpact:      (entity, overrides = {}) => ihtImpact(entity, overrides),
  },

  risk: {
    runShock:       (entity, shockId = 'market_crash_30pct') => runShock(entity, shockId),
    riskShockSuite: (entity)                                  => riskShockSuite(entity),
  },

  flow: {
    monthlyFlow:        (entity) => monthlyFlow(entity),
    allocationPressure: (entity) => allocationPressure(entity),
  },
};

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtPct(n) {
  if (n == null || isNaN(n)) return 'unknown';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtValue(raw, metric = '') {
  if (raw == null) return null;

  // Numeric scalar
  if (typeof raw === 'number') {
    const m = metric.toLowerCase();
    if (m.includes('pct') || m.includes('ratio') || m.includes('%') || m.includes('probability') || m.includes('success')) {
      return `${(raw * 100).toFixed(1)}%`;
    }
    if (Math.abs(raw) >= 1_000_000) return `£${(raw / 1_000_000).toFixed(2)}M`;
    if (Math.abs(raw) >= 1_000)    return `£${(raw / 1_000).toFixed(0)}K`;
    return `£${Math.round(raw).toLocaleString()}`;
  }

  // Array — bengenProjection / fiveCashflowScenarios / etc.
  if (Array.isArray(raw)) {
    if (raw[0]?.balance != null) return fmtValue(raw[raw.length - 1]?.balance, metric); // bengen projection
    if (raw[0]?.label) return `${raw.length} scenarios computed`;
    return `${raw.length} items`;
  }

  // Object — extract the most relevant scalar
  if (typeof raw === 'object') {
    // probabilityOfSuccess returns { p50, p25, p75, ... }
    if ('p50' in raw) return `${(raw.p50 * 100).toFixed(0)}% (p50)`;
    // calcNetWorth returns { net, confidence, ... }
    if ('net' in raw && typeof raw.net === 'number') return fmtValue(raw.net, metric);
    // netWorthAtYears with { value, confidence, ... }
    if ('value' in raw && typeof raw.value === 'number') return fmtValue(raw.value, metric);
    // ihtExposure returns { grossEstate, netIHT, ... }
    if ('netIHT' in raw) return `£${(raw.netIHT / 1_000).toFixed(0)}K net IHT`;
    if ('exposure' in raw && typeof raw.exposure === 'number') return fmtValue(raw.exposure, metric);
    // ihtWaterfall returns { baseline, stages, ... }
    if ('baseline' in raw && typeof raw.baseline === 'number') return fmtValue(raw.baseline, metric);
    // fiRatio returns { ratio, multiple, ... }
    if ('ratio' in raw && typeof raw.ratio === 'number') return fmtPct(raw.ratio);
    // monthlySurplus returns { surplus, income, essential }
    if ('surplus' in raw && typeof raw.surplus === 'number') return fmtValue(raw.surplus, metric);
    // protectionScore / cashflowHealth / estateReadiness return { total, band }
    if ('total' in raw && typeof raw.total === 'number') return fmtValue(raw.total, metric);
    // drawdownMatrix returns { rows, recommended }
    if ('rows' in raw && Array.isArray(raw.rows)) return `${raw.rows.length} drawdown scenarios`;
    // allowanceTracker returns { utilization, ... }
    if ('utilization' in raw) return `${raw.utilization}% utilised`;
    // willLpaStatus returns { flags, ... }
    if ('flags' in raw && Array.isArray(raw.flags)) return raw.flags.length ? raw.flags.join(', ') : 'no flags';
    // allowanceTracker returns { isa, pension, cgt, ... }
    if ('isa' in raw || 'pension' in raw) return JSON.stringify(raw).slice(0, 80);
    // giftClockAll returns array via fq, handled above
    // fallback: stringify trimmed
    return JSON.stringify(raw).slice(0, 100);
  }

  // String passthrough
  return String(raw);
}

// ── Core validation ───────────────────────────────────────────────────────────

/**
 * Validate a single consequence object.
 * Returns { consequence, engineValue, formatted, validated, dropReason? }
 */
function validateConsequence(consequence, entity) {
  const { engine, engineCall, metric } = consequence;

  if (!engine || !engineCall?.fn) {
    return {
      consequence,
      validated: false,
      dropReason: 'missing engine or engineCall.fn',
    };
  }

  const registry = ENGINE_REGISTRY[engine];
  if (!registry) {
    return {
      consequence,
      validated: false,
      dropReason: `unknown engine: "${engine}"`,
    };
  }

  const fn = registry[engineCall.fn];
  if (typeof fn !== 'function') {
    return {
      consequence,
      validated: false,
      dropReason: `unknown function: "${engine}.${engineCall.fn}"`,
    };
  }

  try {
    const extraArgs = Array.isArray(engineCall.extraArgs) ? engineCall.extraArgs : [];
    const raw = fn(entity, ...extraArgs);
    const formatted = fmtValue(raw, metric ?? '');

    if (formatted == null) {
      return {
        consequence,
        validated: false,
        dropReason: 'engine returned null — dropping rather than faking',
      };
    }

    return {
      consequence: {
        ...consequence,
        value: formatted,
        engineValidated: true,
        engineRaw: typeof raw === 'object' ? '[object]' : raw,
      },
      engineValue: raw,
      formatted,
      validated: true,
    };
  } catch (err) {
    return {
      consequence,
      validated: false,
      dropReason: `engine call threw: ${err?.message ?? String(err)}`,
    };
  }
}

/**
 * Validate all consequences in a full decision tree.
 *
 * @param {object} tree   - Claude's raw JSON tree
 * @param {object} entity - User financial entity
 * @returns {{ tree: object, report: object }}
 *   tree   = validated tree with real engine values replacing placeholders
 *   report = validation summary (counts, drops, engine calls made)
 */
export function validateTree(tree, entity) {
  if (!tree || typeof tree !== 'object') {
    return {
      tree: null,
      report: { error: 'tree is null or not an object', validated: false },
    };
  }

  const report = {
    totalConsequences: 0,
    validated: 0,
    dropped: 0,
    drops: [],
    engineCallsMade: [],
  };

  const validatedOptions = (tree.options ?? []).map(option => {
    const validatedConsequences = [];

    for (const consequence of (option.consequences ?? [])) {
      report.totalConsequences++;
      const result = validateConsequence(consequence, entity);

      if (result.validated) {
        validatedConsequences.push(result.consequence);
        report.validated++;
        report.engineCallsMade.push(`${consequence.engine}.${consequence.engineCall?.fn}`);
      } else {
        report.dropped++;
        report.drops.push({
          optionId: option.id,
          metric: consequence.metric,
          reason: result.dropReason,
        });
        // Drop: do not include in output
      }
    }

    // Only include options that have at least one validated consequence
    // (options with zero validated consequences are kept but flagged)
    return {
      ...option,
      consequences: validatedConsequences,
      engineValidated: validatedConsequences.length > 0,
    };
  });

  const validatedTree = {
    ...tree,
    options: validatedOptions,
    _validation: {
      validatedAt: new Date().toISOString(),
      totalConsequences: report.totalConsequences,
      validated: report.validated,
      dropped: report.dropped,
      enginePure: report.dropped === 0,
    },
  };

  return { tree: validatedTree, report };
}

/**
 * Parse Claude's raw text response into a tree object.
 * Strips markdown fences if present. Returns null on parse failure.
 */
export function parseClaudeResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // Strip markdown code fences
  let text = rawText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(text);
  } catch {
    // Try extracting first { ... } block
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

/**
 * Full pipeline: parse raw Claude text → validate → return.
 * Combines parseClaudeResponse + validateTree.
 */
export function processClaudeResponse(rawText, entity) {
  const tree = parseClaudeResponse(rawText);
  if (!tree) {
    return {
      tree: null,
      report: { error: 'JSON parse failed', validated: false, rawTextLength: rawText?.length },
    };
  }
  return validateTree(tree, entity);
}

/** Utility: list all registered engine functions (for prompt generation). */
export function listRegisteredFunctions() {
  return Object.entries(ENGINE_REGISTRY).flatMap(([engine, fns]) =>
    Object.keys(fns).map(fn => `${engine}.${fn}`)
  );
}
