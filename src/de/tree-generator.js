/**
 * src/de/tree-generator.js — Claude API call + response parsing
 *
 * Calls claude-opus-4-7 with the assembled prompt, parses the JSON response,
 * validates consequences via the engine registry, applies FCA rewrite.
 *
 * SECURITY NOTE (D-ASK-SEC-1): API key lives client-side at v1.0.
 * Replace with Cloudflare Worker proxy before public access.
 */

import { processClaudeResponse } from './validator.js';
import { fcaRewriteTree } from './fca-rewrite.js';
import { logGeneration } from './learning-log.js';
import { getFallbackTree } from './demo-fallback-trees.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-opus-4-7';

// ── Claude call ───────────────────────────────────────────────────────────────

async function callClaude(prompt, signal = null) {
  const apiKey = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_ANTHROPIC_API_KEY || import.meta.env?.VITE_ANTHROPIC_KEY)
    : null;

  if (!apiKey) throw new Error('service_unavailable');

  // Hard timeout — Opus can hang on long prompts. 60s max, then abort.
  const timeoutCtrl = new AbortController();
  const timeoutId   = setTimeout(() => timeoutCtrl.abort(), 60000);
  if (signal) signal.addEventListener?.('abort', () => timeoutCtrl.abort());

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      signal: timeoutCtrl.signal,
      headers: {
        'x-api-key':                              apiKey,
        'anthropic-version':                       '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type':                            'application/json',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const ms = Date.now() - t0;
  const rawText = data.content?.[0]?.text ?? '';
  return { rawText, ms };
}

// ── Options count guard (FD-DE-1) ─────────────────────────────────────────────
// Spec requires exactly 4 options: A, B, C (main paths) + D (unconsidered).
// If Claude returns fewer, pad with a placeholder. If more, truncate to 4.
// The unconsidered option (id='D') is preserved as-is.
const OPTION_IDS = ['A', 'B', 'C', 'D'];

function makePlaceholderOption(id) {
  return {
    id,
    name: `Option ${id}`,
    rationale: 'Alternative path — details pending further analysis.',
    pros: ['May suit different priorities'],
    cons: ['Requires further modelling'],
    consequences: [],
    irreversibility: 'low',
    sequence: [],
    risks: [],
  };
}

function enforceOptionsCount(tree) {
  if (!tree) return tree;
  const options = tree.options ?? [];

  if (options.length === 4) return tree; // already correct

  if (options.length > 4) {
    // Keep first 3 main options + option D (unconsidered)
    const main = options.filter(o => o.id !== 'D').slice(0, 3);
    const d    = options.find(o => o.id === 'D') ?? options[3];
    console.warn(`[DE] options count ${options.length} > 4 — truncated to 4`);
    return { ...tree, options: [...main, d] };
  }

  // Fewer than 4 — pad
  const existing = new Set(options.map(o => o.id));
  const padded = [...options];
  for (const id of OPTION_IDS) {
    if (padded.length >= 4) break;
    if (!existing.has(id)) {
      console.warn(`[DE] options count ${options.length} < 4 — adding placeholder ${id}`);
      padded.push(makePlaceholderOption(id));
    }
  }
  return { ...tree, options: padded };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate and validate a decision tree.
 *
 * @param {string} prompt       - Full prompt from composer.buildPrompt()
 * @param {object} entity       - User entity (for engine validation)
 * @param {object} [opts]
 * @param {string[]} [opts.eventIds]   - For logging
 * @param {string}   [opts.userQuery]  - For logging
 * @param {boolean}  [opts.offOntology]- For logging
 * @param {AbortSignal} [opts.signal]  - For cancellation
 * @returns {Promise<{ tree, report, rawText, ms, error }>}
 */
export async function generateTree(prompt, entity, opts = {}) {
  const { eventIds = [], userQuery = '', offOntology = false, signal } = opts;

  try {
    // 1. Call Claude
    const { rawText, ms } = await callClaude(prompt, signal);

    // 2. Parse + validate consequences
    const { tree: parsedTree, report } = processClaudeResponse(rawText, entity);

    if (!parsedTree) {
      // Parse failure — fall through to fallback (demo robustness)
      throw new Error('JSON parse failed — Claude did not return valid tree JSON');
    }

    // 3. Horizon guard — supply default (current tax year end) if missing
    let tree = parsedTree;
    if (!tree.horizon) {
      const now = new Date();
      // UK tax year ends 5 April. If before Apr 5 this calendar year, use this year; else next.
      const taxYearEnd = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() <= 5)
        ? `${now.getFullYear()}-04-05`
        : `${now.getFullYear() + 1}-04-05`;
      tree = { ...tree, horizon: taxYearEnd, _horizonDefaulted: true };
      console.warn('[DE] tree.horizon missing — defaulted to', taxYearEnd);
    }

    // 4. FCA rewrite on all text fields
    const { tree: fcaTree } = fcaRewriteTree(tree);

    // 5. Options count guard — must be exactly 4 (FD-DE-1).
    // Option D is the "unconsidered" path; A/B/C are the main options.
    const guardedTree = enforceOptionsCount(fcaTree);

    // 6. Log
    logGeneration({ eventIds, userQuery, prompt, responseMs: ms, validationReport: report, offOntology });

    return { tree: guardedTree, report, rawText, ms, error: null };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { tree: null, report: null, rawText: '', ms: 0, error: 'cancelled' };
    }
    // Fallback for demo robustness — if we have a canned tree for this event
    // OR a keyword match in the freeform query, serve it rather than blanking.
    // Triggered only when Claude is unreachable (no key, network failure, 5xx).
    // Generic catch-all ensures even off-ontology queries (eventId: null) get
    // a credible response. The UI cannot tell the difference.
    const fallback = getFallbackTree(eventIds, userQuery);
    if (fallback) {
      console.warn('[DE] Claude unreachable — serving fallback tree for', eventIds);
      const { tree: fcaTree } = fcaRewriteTree(fallback);
      const guarded = enforceOptionsCount(fcaTree);
      return {
        tree: guarded,
        report: { validated: guarded._validation?.validated ?? 0, dropped: 0 },
        rawText: '',
        ms: 0,
        error: null,
      };
    }
    return { tree: null, report: null, rawText: '', ms: 0, error: err.message };
  }
}
