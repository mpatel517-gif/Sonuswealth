/**
 * src/de/orchestrator.js — Decision Engine top-level state machine
 *
 * FSM states:
 *   IDLE → ONTOLOGY_MATCH → [MULTI_EVENT_COMPOSE?] → CONTEXT_GATHER
 *        → PROMPT_BUILD → CLAUDE_CALL → PARSE → VALIDATE
 *        → [FOLLOW_UP? × 3] → DONE | ERROR
 *
 * Usage (React hook or plain JS):
 *   const { run, state, tree, followUp, report } = useOrchestrator(entity)
 *   await run('Should I buy a second property in Birmingham?')
 *
 * Spec: plan §Architecture — one engine + one ontology.
 */

import { useState, useRef, useCallback } from 'react';
import { matchEvent, mergeEventContexts } from './ontology.js';
import { buildPrompt }                     from './composer.js';
import { buildCompoundPrompt, isCompound as checkCompound, dropEvent as doDropEvent } from './multi-event-composer.js';
import { generateTree }                    from './tree-generator.js';
import { validateTree }                    from './validator.js';
import { analyseGaps, mergeAnswers, buildAdviserCTA, flagPartialConfidence } from './follow-up.js';
import { saveDraft, commitPlanDE }         from './persistence.js';
import { logCommit, logAbandon }           from './learning-log.js';
import { getResearch }                     from './research/real.js';

// ── State constants ───────────────────────────────────────────────────────────

export const DE_STATE = {
  IDLE:                'IDLE',
  ONTOLOGY_MATCH:      'ONTOLOGY_MATCH',
  MULTI_EVENT_COMPOSE: 'MULTI_EVENT_COMPOSE',
  CONTEXT_GATHER:      'CONTEXT_GATHER',
  PROMPT_BUILD:        'PROMPT_BUILD',
  CLAUDE_CALL:         'CLAUDE_CALL',
  VALIDATE:            'VALIDATE',
  FOLLOW_UP:           'FOLLOW_UP',
  DONE:                'DONE',
  ERROR:               'ERROR',
};

// ── Pure orchestrator (no React dependency) ───────────────────────────────────

/**
 * Run the full pipeline for a user query.
 *
 * @param {string}   userQuery   - Free-text life question
 * @param {object}   entity      - User financial entity
 * @param {object}   [opts]
 * @param {string[]} [opts.eventIds]  - Pre-matched event IDs (skip ONTOLOGY_MATCH)
 * @param {object}   [opts.userAnswers] - Pre-collected follow-up answers
 * @param {function} [opts.onStateChange] - Called with (state, detail) on each FSM transition
 * @param {AbortSignal} [opts.signal]    - Abort signal for Claude call
 * @returns {Promise<{ tree, report, eventIds, matches, followUpState }>}
 */
export async function runPipeline(userQuery, entity, opts = {}) {
  const {
    eventIds: preMatchedIds = null,
    userAnswers = {},
    onStateChange = () => {},
    signal,
  } = opts;

  const emit = (state, detail = {}) => onStateChange(state, detail);

  // ── ONTOLOGY_MATCH ──────────────────────────────────────────────────────────
  emit(DE_STATE.ONTOLOGY_MATCH);
  let matches, eventIds, offOntology;

  if (preMatchedIds?.length) {
    eventIds   = preMatchedIds;
    matches    = preMatchedIds.map(id => ({ event: { id }, score: 100, confidence: 'HIGH', offOntology: false }));
    offOntology = false;
  } else {
    matches    = matchEvent(userQuery, 3);
    eventIds   = [matches[0].event.id];
    offOntology = matches[0].offOntology;
  }

  const compound = checkCompound(eventIds);

  // ── MULTI_EVENT_COMPOSE (compound only) ────────────────────────────────────
  if (compound) {
    emit(DE_STATE.MULTI_EVENT_COMPOSE, { eventIds });
    // mergeEventContexts is called inside buildCompoundPrompt
  }

  // ── CONTEXT_GATHER ──────────────────────────────────────────────────────────
  emit(DE_STATE.CONTEXT_GATHER, { eventIds, compound });
  const mergedCtx = mergeEventContexts(eventIds);

  // Fetch research (mock at v1.0, real when VITE_USE_REAL_RESEARCH=true)
  const research = await getResearch(
    eventIds[0],
    mergedCtx.defaultDeadlines,
    userQuery
  );

  // ── PROMPT_BUILD ────────────────────────────────────────────────────────────
  emit(DE_STATE.PROMPT_BUILD);
  const prompt = compound
    ? buildCompoundPrompt(entity, eventIds, userQuery, userAnswers)
    : buildPrompt(entity, eventIds, userQuery, userAnswers);

  // ── CLAUDE_CALL ─────────────────────────────────────────────────────────────
  emit(DE_STATE.CLAUDE_CALL);
  const { tree: rawTree, report, error, ms } = await generateTree(prompt, entity, {
    eventIds, userQuery, offOntology, signal,
  });

  if (error === 'cancelled') {
    return { tree: null, report: null, eventIds, matches, error: 'cancelled', followUpState: null };
  }
  if (error || !rawTree) {
    emit(DE_STATE.ERROR, { error });
    return { tree: null, report, eventIds, matches, error: error ?? 'unknown', followUpState: null };
  }

  // Attach research to tree
  const treeWithResearch = research.length
    ? { ...rawTree, research: [...(rawTree.research ?? []), ...research.filter(r => r.fact.includes('[MOCK]'))] }
    : rawTree;

  // ── VALIDATE (already done inside generateTree via processClaudeResponse) ──
  emit(DE_STATE.VALIDATE, { validated: report.validated, dropped: report.dropped });

  // Attach low-confidence flag if many drops
  const finalTree = offOntology
    ? { ...treeWithResearch, _offOntology: true, _confidence: 'LOW' }
    : treeWithResearch;

  emit(DE_STATE.DONE, { tree: finalTree, report, ms });

  // ── Analyse for follow-up need ──────────────────────────────────────────────
  const followUpState = analyseGaps(finalTree, 0);

  return {
    tree:         finalTree,
    report,
    eventIds,
    matches,
    offOntology,
    compound,
    followUpState,
    error:        null,
  };
}

/**
 * Run a follow-up round.
 * Called by the UI after collecting answers to followUpState.questions.
 *
 * @param {object}   prevTree       - Previously generated tree
 * @param {string[]} questions      - The questions that were asked
 * @param {string[]} answers        - User's answers (parallel array)
 * @param {number}   round          - Current round (1-based)
 * @param {object}   entity
 * @param {string[]} eventIds
 * @param {string}   userQuery
 * @param {function} [onStateChange]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ tree, report, followUpState }>}
 */
export async function runFollowUp(prevTree, questions, answers, round, entity, eventIds, userQuery, onStateChange, signal) {
  const emit = onStateChange ?? (() => {});

  // Merge new answers into the tree
  const updatedTree = mergeAnswers(prevTree, questions, answers);

  // If max rounds hit, flag and return
  if (round >= 3) {
    const exhausted = flagPartialConfidence(updatedTree);
    const adviserCta = buildAdviserCTA(exhausted, exhausted._offOntology);
    return {
      tree: { ...exhausted, _adviserCTA: adviserCta },
      report: null,
      followUpState: { needsFollowUp: false, exhausted: true },
    };
  }

  // Otherwise re-run the pipeline with enriched answers
  emit(DE_STATE.FOLLOW_UP, { round });
  const result = await runPipeline(userQuery, entity, {
    eventIds,
    userAnswers: updatedTree.yourAnswers,
    onStateChange,
    signal,
  });

  // Analyse next round
  if (result.tree) {
    const nextGaps = analyseGaps(result.tree, round);
    return { ...result, followUpState: nextGaps };
  }

  return result;
}

/**
 * Commit a path choice. Saves to plans store and logs.
 */
export function commitPath(tree, pathId, entity) {
  const planId = commitPlanDE(tree, pathId, { entityId: entity?.id });
  logCommit({ eventIds: tree.events, chosenPathId: pathId, tree });
  return planId;
}

/**
 * Save as scenario draft.
 */
export function saveDraftPath(tree, pathId) {
  return saveDraft(tree, { chosenPathId: pathId });
}

/**
 * Abandon session (no commit). Logs abandonment.
 */
export function abandonSession(eventIds, reason = 'user_closed') {
  logAbandon({ eventIds, reason });
}

/**
 * Drop an event from a compound session. Returns updated eventIds.
 * Caller must re-run runPipeline with new eventIds.
 */
export function dropEvent(eventIds, dropId) {
  return doDropEvent(eventIds, dropId);
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * React hook for the orchestrator. Wraps runPipeline with state management.
 *
 * @param {object} entity - User financial entity
 * @returns orchestrator API
 */
export function useOrchestrator(entity) {
  const [fsm, setFsm]             = useState(DE_STATE.IDLE);
  const [tree, setTree]           = useState(null);
  const [report, setReport]       = useState(null);
  const [eventIds, setEventIds]   = useState([]);
  const [followUp, setFollowUp]   = useState(null);
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const abortRef                  = useRef(null);

  const run = useCallback(async (userQuery, opts = {}) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setTree(null);
    setReport(null);
    setFollowUp(null);

    const result = await runPipeline(userQuery, entity, {
      ...opts,
      signal: abortRef.current.signal,
      onStateChange: (state) => setFsm(state),
    });

    setLoading(false);
    if (result.error && result.error !== 'cancelled') {
      setError(result.error);
      setFsm(DE_STATE.ERROR);
    } else if (result.tree) {
      setTree(result.tree);
      setReport(result.report);
      setEventIds(result.eventIds);
      setFollowUp(result.followUpState);
      setFsm(DE_STATE.DONE);
    } else if (result.error !== 'cancelled') {
      // No tree, no error — guard against blank screen. Surface a generic error
      // so the empty-result panel renders and the user has a way forward.
      setError('no_tree_returned');
      setFsm(DE_STATE.ERROR);
    }

    return result;
  }, [entity]);

  const answerFollowUp = useCallback(async (questions, answers, round, userQuery) => {
    if (!tree) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);

    const result = await runFollowUp(
      tree, questions, answers, round, entity, eventIds, userQuery,
      (state) => setFsm(state), abortRef.current.signal
    );

    setLoading(false);
    if (result.tree) {
      setTree(result.tree);
      setReport(result.report);
      setFollowUp(result.followUpState);
    } else {
      // Pipeline failed on follow-up — clear stuck follow-up panel so the
      // empty-result panel can render and the user has a way forward.
      setFollowUp(null);
      if (result.error) setError(result.error);
    }
    return result;
  }, [tree, entity, eventIds]);

  const commit = useCallback((pathId) => {
    if (tree) return commitPath(tree, pathId, entity);
  }, [tree, entity]);

  const saveScenario = useCallback((pathId) => {
    if (tree) return saveDraftPath(tree, pathId);
  }, [tree]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setFsm(DE_STATE.IDLE);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setFsm(DE_STATE.IDLE);
    setTree(null);
    setReport(null);
    setEventIds([]);
    setFollowUp(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    run, answerFollowUp, commit, saveScenario, cancel, reset,
    fsm, tree, report, eventIds, followUp, error, loading,
    isIdle: fsm === DE_STATE.IDLE,
    isDone: fsm === DE_STATE.DONE,
    isLoading: loading,
  };
}
