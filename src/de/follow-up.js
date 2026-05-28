/**
 * src/de/follow-up.js — Adaptive follow-up question generator
 *
 * When the tree has low-confidence gaps:
 *   1. Identify missing or low-confidence fields
 *   2. Generate targeted questions (max 3 per round, 8 total across 3 rounds)
 *   3. Merge new answers into userAnswers and signal RE_RUN to orchestrator
 *
 * After 3 rounds: commit to tree as-is with PARTIAL_CONFIDENCE flag + adviser CTA.
 */

export const MAX_ROUNDS    = 3;
export const MAX_QUESTIONS = 8;

/**
 * Analyse a tree for gaps that follow-up questions could fill.
 * Returns { needsFollowUp, questions, round, exhausted }
 *
 * @param {object} tree         — validated tree (may have low-confidence consequences)
 * @param {number} currentRound — how many follow-up rounds have already happened (0-based)
 * @returns {{ needsFollowUp: boolean, questions: string[], round: number, exhausted: boolean }}
 */
export function analyseGaps(tree, currentRound = 0) {
  if (!tree || currentRound >= MAX_ROUNDS) {
    return { needsFollowUp: false, questions: [], round: currentRound, exhausted: currentRound >= MAX_ROUNDS };
  }

  const questions = [];

  // 1. yourAnswers fields that are null
  const unanswered = Object.entries(tree.yourAnswers ?? {})
    .filter(([, v]) => v == null)
    .map(([k]) => k);

  for (const key of unanswered) {
    if (questions.length >= 3) break;
    questions.push(labelForAnswerKey(key));
  }

  // 2. Low-confidence consequences (< 0.7)
  const lowConf = (tree.options ?? []).flatMap(opt =>
    (opt.consequences ?? []).filter(c => (c.confidence ?? 1) < 0.7 && !c.engineValidated)
  );

  for (const c of lowConf) {
    if (questions.length >= 3) break;
    const q = questionForLowConfidence(c);
    if (q && !questions.includes(q)) questions.push(q);
  }

  // 3. Options that have subDecisions not yet answered
  const pendingSubs = (tree.options ?? []).flatMap(opt =>
    (opt.subDecisions ?? []).filter(sd => !(tree.yourAnswers?.[sd.id]))
  );

  for (const sd of pendingSubs) {
    if (questions.length >= 3) break;
    if (!questions.includes(sd.q)) questions.push(sd.q);
  }

  // 4. Budget questions for off-ontology or any tree missing key financial anchors
  if (questions.length < 2 && !tree.yourAnswers?.budget) {
    questions.push('What budget or amount are you working with for this decision?');
  }
  if (questions.length < 2 && !tree.yourAnswers?.timeline) {
    questions.push('What\'s your intended timeline — are you looking to act in the next 3, 6, or 12 months?');
  }

  const needsFollowUp = questions.length > 0;
  return { needsFollowUp, questions: questions.slice(0, 3), round: currentRound + 1, exhausted: false };
}

/** Human-readable labels for yourAnswers keys */
function labelForAnswerKey(key) {
  const MAP = {
    budget:          'What budget or amount are you working with?',
    timeline:        'What\'s your intended timeline for this decision?',
    targetRetirementAge: 'What age are you targeting for retirement?',
    targetAnnualIncome:  'What annual income do you want in retirement (today\'s money)?',
    drawdownPreference:  'Do you prefer guaranteed income (annuity) or flexible drawdown?',
    ltdCompany:          'Are you considering a limited company or personal name for this?',
    mortgage:            'Do you have a specific mortgage type or lender in mind?',
    giftingTolerance:    'How comfortable are you making large gifts — would you consider up to £100K+?',
    trustAppetite:       'Are you open to setting up a trust, or do you prefer simpler structures?',
    willUpdated:         'Is your will up to date and does it reflect your current wishes?',
    country:             'Which country are you buying in?',
  };
  return MAP[key] ?? `Can you tell me more about "${key.replace(/_/g, ' ')}"?`;
}

/** Generate a question for a low-confidence consequence */
function questionForLowConfidence(consequence) {
  const { metric = '', engine = '' } = consequence;
  const m = metric.toLowerCase();
  if (m.includes('cashflow') || m.includes('surplus'))
    return 'What are your approximate monthly outgoings (essential spending, not investments)?';
  if (m.includes('iht') || m.includes('estate'))
    return 'Do you have an up-to-date estimate of your total estate value including pensions?';
  if (m.includes('probability') || m.includes('retirement'))
    return 'What annual income would you need in retirement to maintain your current lifestyle?';
  if (m.includes('cgt') || m.includes('gains'))
    return 'What is the approximate original cost (purchase price) of the asset you\'re considering selling?';
  if (engine === 'risk')
    return 'How would you describe your tolerance for investment risk: conservative, balanced, or growth-focused?';
  return null;
}

/**
 * Merge follow-up answers into the tree's yourAnswers field.
 * answers is an array matching the questions array order.
 */
export function mergeAnswers(tree, questions, answers) {
  const merged = { ...(tree.yourAnswers ?? {}) };
  questions.forEach((q, i) => {
    if (answers[i] != null) {
      // Use question as key (slugified)
      const key = q.slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, '_');
      merged[key] = answers[i];
    }
  });
  return { ...tree, yourAnswers: merged };
}

/**
 * Build the adviser CTA object to surface when rounds are exhausted.
 * This appears in the tree when we've hit MAX_ROUNDS.
 */
export function buildAdviserCTA(tree, offOntology = false) {
  return {
    show: true,
    message: offOntology
      ? 'This scenario is complex enough that an IFA review would add value — the engine has modelled the available paths, but a qualified adviser can account for nuances specific to your situation.'
      : `After ${MAX_ROUNDS} rounds of refinement, some gaps remain. An FCA-authorised adviser can fill in the remaining uncertainty.`,
    confidence: 'PARTIAL',
    fcaDisclaimer: 'Information and guidance only. Not personal advice — verify with a qualified FCA-authorised adviser before acting.',
  };
}

/**
 * Flag the tree with PARTIAL_CONFIDENCE after rounds are exhausted.
 */
export function flagPartialConfidence(tree) {
  return {
    ...tree,
    _partialConfidence: true,
    _confidenceNote: `Tree produced after ${MAX_ROUNDS} follow-up rounds. Some consequences have lower confidence.`,
  };
}
