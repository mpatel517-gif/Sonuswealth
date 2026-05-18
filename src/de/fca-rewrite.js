/**
 * src/de/fca-rewrite.js — FCA compliance text rewriter (shared)
 *
 * Strips prohibited advisory language from any text block.
 * Used by Ask.jsx and the Decision Engine recommendation field.
 * Spec: D-ASK-8, foundation v1.11 §FCA.
 */

// Patterns: [regex, replacement]. Applied in order.
export const PROHIBITED_PATTERNS = [
  { re: /\byou should\b/gi,              to: 'one option is to' },
  { re: /\byou must\b/gi,               to: 'you may want to' },
  { re: /\byou need to\b/gi,            to: 'you might consider' },
  { re: /\bdo this now\b/gi,            to: 'this is worth considering now' },
  { re: /\bI recommend\b/gi,            to: 'one option to consider is' },
  { re: /\bwe recommend\b/gi,           to: 'one option to consider is' },
  { re: /\byou should definitely\b/gi,  to: 'one clear option is' },
  { re: /\bthe best (option|path|move)\b/gi, to: 'a strong option' },
  { re: /\byou ought to\b/gi,           to: 'you might consider' },
  { re: /\bmake sure you\b/gi,          to: 'it may be worth ensuring' },
];

export const FCA_BOUNDARY =
  'Not regulated financial advice — verify with a qualified FCA-authorised adviser before acting.';

/**
 * Rewrite text to remove prohibited advisory language.
 * Returns { text: string, rewrote: boolean, changes: string[] }
 */
export function fcaRewrite(text) {
  if (!text || typeof text !== 'string') return { text: text ?? '', rewrote: false, changes: [] };
  let out = text;
  const changes = [];
  for (const { re, to } of PROHIBITED_PATTERNS) {
    const before = out;
    out = out.replace(re, to);
    if (out !== before) changes.push(`${re.source} → ${to}`);
  }
  return { text: out, rewrote: changes.length > 0, changes };
}

/**
 * Check if text violates FCA boundary. Returns true if clean.
 */
export function fcaBoundaryCheck(text) {
  if (!text) return true;
  return PROHIBITED_PATTERNS.every(({ re }) => !re.test(text));
}

/**
 * Rewrite a full decision tree's text fields.
 * Covers: recommendation.rationale, tree.statement, and per-option
 * name / summary / rationale fields.
 * Returns { tree, rewrote }.
 */
export function fcaRewriteTree(tree) {
  if (!tree) return { tree, rewrote: false };

  let anyRewrote = false;
  const allChanges = [];

  // Helper: rewrite one string, track changes
  function rw(text) {
    if (!text || typeof text !== 'string') return text;
    const { text: out, rewrote, changes } = fcaRewrite(text);
    if (rewrote) { anyRewrote = true; allChanges.push(...changes); }
    return out;
  }

  // 1. tree.statement
  const statement = rw(tree.statement);

  // 2. per-option fields: name, summary, rationale
  const options = (tree.options ?? []).map(opt => ({
    ...opt,
    name:      rw(opt.name),
    summary:   rw(opt.summary),
    rationale: rw(opt.rationale),
  }));

  // 3. recommendation.rationale
  let recommendation = tree.recommendation;
  if (recommendation?.rationale) {
    const { text: recText, rewrote: recRewrote, changes: recChanges } = fcaRewrite(recommendation.rationale);
    if (recRewrote) { anyRewrote = true; allChanges.push(...recChanges); }
    recommendation = {
      ...recommendation,
      rationale:    recText,
      fcaCompliant: fcaBoundaryCheck(recText),
      _fcaChanges:  recChanges.length ? recChanges : undefined,
    };
  }

  return {
    tree: {
      ...tree,
      statement,
      options,
      recommendation,
      _fcaRewriteApplied: anyRewrote,
    },
    rewrote: anyRewrote,
  };
}
