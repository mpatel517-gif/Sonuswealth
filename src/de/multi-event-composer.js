/**
 * src/de/multi-event-composer.js — Multi-event compound prompt builder
 *
 * When events.length > 1, this module fires BETWEEN ONTOLOGY_MATCH and CONTEXT_GATHER.
 * It merges N event contexts into ONE compound prompt, not N sequential Claude calls.
 *
 * The interactions between events are often the most important answer.
 * e.g. "part_time + child_born + upsize" → income drop + childcare + mortgage
 *       must be stress-tested simultaneously, not separately.
 *
 * Spec: plan §2.5 Multi-Event Compound Mode
 */

import { EVENTS, mergeEventContexts } from './ontology.js';
import { buildPrompt } from './composer.js';

/**
 * Compound tree JSON shape additions (beyond single-event shape):
 * {
 *   events: ['part_time', 'child_born', 'upsize'],   // always present
 *   compoundStatement: "...",                          // merged impact summary
 *   conflicts: [{ between: ['part_time', 'upsize'], severity: 'high', note: '...' }],
 *   // conflicts[].between = NEW field, single-event mode never populates
 *   ...rest of standard tree shape
 * }
 */

/**
 * Detect if compound mode should activate.
 * Returns true when eventIds.length > 1.
 */
export function isCompound(eventIds) {
  return Array.isArray(eventIds) && eventIds.length > 1;
}

/**
 * Build the compound prompt context block.
 * Merges requiredContext + defaultDeadlines + chartHints from all events.
 * Returns the full prompt string to send to Claude.
 *
 * @param {object} entity     — user financial entity
 * @param {string[]} eventIds — array of 2+ ontology event IDs
 * @param {string} userQuery  — user's original free-text question
 * @param {object} [userAnswers] — any collected follow-up answers
 * @returns {string} prompt
 */
export function buildCompoundPrompt(entity, eventIds, userQuery, userAnswers = {}) {
  // Use the standard composer — it already handles compound mode
  // (mergeEventContexts is called inside buildPrompt for eventIds.length > 1)
  const prompt = buildPrompt(entity, eventIds, userQuery, userAnswers);

  // Append compound-specific instructions
  const eventLabels = eventIds
    .map(id => EVENTS[id]?.label ?? id)
    .join(', ');

  const compoundInstruction = `
## COMPOUND MODE — ${eventIds.length} simultaneous events: ${eventLabels}

CRITICAL: This is NOT ${eventIds.length} separate analyses. Produce ONE tree that models
all ${eventIds.length} events happening simultaneously. The interactions between events
are often the most important output.

Additional requirements for compound mode:
1. Add "compoundStatement" field: 2-3 sentence summary of the combined financial impact
   (income change + expense change + asset/liability change = net monthly impact)
2. conflicts[].between = array of 2 event IDs that conflict with each other
   (e.g. ["part_time","upsize"] — do NOT use this field in single-event mode)
3. Every option must reflect the COMBINED financial state, not any single event in isolation
4. The "unconsidered" option should address an interaction the user didn't anticipate
5. Option D should specifically address "what if I defer one of these events?"

Example compoundStatement:
"You're considering three simultaneous changes: income drops ~£28K/yr (part-time),
childcare adds ~£18K/yr (new child), and mortgage payment rises ~£800/mo (upsizing).
Net cashflow impact: approximately -£4,700/mo before any savings adjustments."
`;

  return prompt + compoundInstruction;
}

/**
 * Merge multiple events' metadata for display.
 * Returns the merged context object used by composer + validator.
 */
export function getCompoundContext(eventIds) {
  return mergeEventContexts(eventIds);
}

/**
 * Validate that a returned tree is in compound format.
 * Returns { valid, issues }
 */
export function validateCompoundTree(tree, eventIds) {
  const issues = [];

  if (!Array.isArray(tree?.events) || tree.events.length < 2) {
    issues.push('tree.events must have 2+ entries in compound mode');
  }

  if (!tree?.compoundStatement) {
    issues.push('missing compoundStatement field');
  }

  const crossConflicts = (tree?.conflicts ?? []).filter(c => Array.isArray(c.between));
  if (crossConflicts.length === 0 && eventIds.length > 1) {
    issues.push('no cross-event conflicts found — compound mode should surface at least one interaction');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Strip one event from a compound tree and re-prompt.
 * Used by "what if I drop the house?" deselect interaction on the UI.
 * Returns { updatedEventIds, needsRerun: true } — orchestrator handles the rerun.
 */
export function dropEvent(eventIds, dropId) {
  const updated = eventIds.filter(id => id !== dropId);
  return {
    updatedEventIds: updated,
    needsRerun: true,
    wasCompound: eventIds.length > 1,
    isNowCompound: updated.length > 1,
  };
}
