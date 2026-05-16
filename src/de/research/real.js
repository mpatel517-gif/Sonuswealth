/**
 * src/de/research/real.js — Real Exa + Firecrawl research orchestrator
 *
 * DISABLED at v1.0. Activate by setting VITE_USE_REAL_RESEARCH=true.
 * Interface matches mock.js exactly so caller code never changes.
 *
 * Post-demo wiring:
 *   1. Set VITE_USE_REAL_RESEARCH=true in .env
 *   2. Add Cloudflare Worker proxy for Exa API key (2 days, per plan §Mock research)
 *   3. getResearch() below becomes live — no other changes
 */

export const REAL_RESEARCH_VERSION = '1.0.0-stub';

/**
 * Real research call — currently returns empty (env flag guards it).
 * When enabled, calls Exa for live property yields, BTL rates, market data.
 */
export async function getRealResearch(eventId, query) {
  // Guard: only run if explicitly enabled
  if (import.meta.env?.VITE_USE_REAL_RESEARCH !== 'true') {
    return [];
  }

  // Stub: real implementation goes here post-demo
  // Will call: Exa MCP (web_search_exa) → extract facts → label with [LIVE]
  // Will call: Firecrawl MCP (firecrawl_scrape) → gov.uk, HMRC, BoE pages
  console.warn('[DE research] Real research called but not yet implemented');
  return [];
}

/**
 * Unified entry point — delegates to mock or real based on env flag.
 * Import this (not mock.js or real.js directly) from orchestrator.
 */
export async function getResearch(eventId, ruleKeys = [], userQuery = '') {
  const useReal = typeof import.meta !== 'undefined'
    && import.meta.env?.VITE_USE_REAL_RESEARCH === 'true';

  if (useReal) {
    return getRealResearch(eventId, userQuery);
  }

  // Fall through to mock
  const { getMockResearch } = await import('./mock.js');
  return getMockResearch(eventId, ruleKeys);
}
