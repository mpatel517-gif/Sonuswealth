/**
 * src/de/learning-log.js — Decision Engine session logging
 *
 * Logs every tree generation for prompt-tuning feedback.
 * Surfaces: which events produce weak trees, which engine calls fail,
 * which paths users pick or abandon.
 *
 * v1.0: localStorage only. Post-demo: flush to analytics endpoint.
 */

const LOG_KEY   = 'sw_de_log';
const MAX_LOGS  = 200;

function readLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]'); } catch { return []; }
}
function writeLog(arr) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(arr)); } catch { /* quota */ }
}

export function logSession(entry) {
  const logs = readLog();
  logs.unshift({ id: `log_${Date.now()}`, ts: new Date().toISOString(), ...entry });
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  writeLog(logs);
}

/** Log a tree generation attempt */
export function logGeneration({ eventIds, userQuery, prompt, responseMs, validationReport, offOntology }) {
  logSession({
    type: 'GENERATION',
    eventIds,
    userQuery,
    promptLen: prompt?.length ?? 0,
    responseMs: responseMs ?? null,
    totalConsequences: validationReport?.totalConsequences ?? 0,
    validated: validationReport?.validated ?? 0,
    dropped: validationReport?.dropped ?? 0,
    offOntology: !!offOntology,
  });
}

/** Log when user commits a path */
export function logCommit({ sessionId, eventIds, chosenPathId, tree }) {
  logSession({
    type: 'COMMIT',
    sessionId,
    eventIds,
    chosenPathId,
    optionCount: tree?.options?.length ?? 0,
  });
}

/** Log when user abandons (closes without committing) */
export function logAbandon({ sessionId, eventIds, reason }) {
  logSession({ type: 'ABANDON', sessionId, eventIds, reason: reason ?? 'unknown' });
}

/** Log a follow-up round */
export function logFollowUp({ sessionId, round, questionsAsked, questionsAnswered }) {
  logSession({ type: 'FOLLOW_UP', sessionId, round, questionsAsked, questionsAnswered });
}

/** Return learning stats for a given event type */
export function statsForEvent(eventId) {
  const logs = readLog().filter(l => l.eventIds?.includes(eventId));
  const gens  = logs.filter(l => l.type === 'GENERATION');
  const commits = logs.filter(l => l.type === 'COMMIT');
  return {
    totalGenerations: gens.length,
    avgDropRate: gens.length
      ? gens.reduce((s, g) => s + (g.dropped / Math.max(g.totalConsequences, 1)), 0) / gens.length
      : 0,
    commitRate: gens.length ? commits.length / gens.length : 0,
    offOntologyRate: gens.length
      ? gens.filter(g => g.offOntology).length / gens.length : 0,
  };
}

export function readAllLogs() { return readLog(); }
export function clearLogs() { writeLog([]); }
