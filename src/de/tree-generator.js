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

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-opus-4-7';

// ── Claude call ───────────────────────────────────────────────────────────────

async function callClaude(prompt, signal = null) {
  const apiKey = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_ANTHROPIC_API_KEY || import.meta.env?.VITE_ANTHROPIC_KEY)
    : null;

  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set');

  const t0 = Date.now();
  const res = await fetch(API_URL, {
    method: 'POST',
    signal,
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

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const ms = Date.now() - t0;
  const rawText = data.content?.[0]?.text ?? '';
  return { rawText, ms };
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
    const { tree, report } = processClaudeResponse(rawText, entity);

    if (!tree) {
      return {
        tree: null, report, rawText, ms,
        error: 'JSON parse failed — Claude did not return valid tree JSON',
      };
    }

    // 3. FCA rewrite on recommendation
    const { tree: fcaTree } = fcaRewriteTree(tree);

    // 4. Log
    logGeneration({ eventIds, userQuery, prompt, responseMs: ms, validationReport: report, offOntology });

    return { tree: fcaTree, report, rawText, ms, error: null };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { tree: null, report: null, rawText: '', ms: 0, error: 'cancelled' };
    }
    return { tree: null, report: null, rawText: '', ms: 0, error: err.message };
  }
}
