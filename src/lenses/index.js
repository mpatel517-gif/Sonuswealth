// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA LENS REGISTRY
//
// 11 professional lenses. Each implements the Lens interface from
// ARCHITECTURE-V0.md §3. v0 ships Tax Accountant fully built; other 10
// will follow as practitioner panel signs them off.
// ─────────────────────────────────────────────────────────────────────────────

import { lens as taxAccountant }     from './tax-accountant.js';
import { lens as pensionSpecialist } from './pension-specialist.js';
import { lens as trustLawyer }       from './trust-lawyer.js';

// Shells — not yet implemented (return empty arrays). Placeholder for v0.1+.
const placeholderLens = (id, name, avatar, expertise) => ({
  id, name, display_avatar: avatar, expertise_domain: expertise,
  status: 'EXPERIMENTAL — shell only',
  is_relevant: () => ({ score: 0, reason: 'Not yet implemented' }),
  observe: () => [],
  recommend: () => [],
  red_flags: () => [],
  what_if_prompts: () => [],
});
const ifaHolistic           = placeholderLens('ifa-holistic', 'IFA (Holistic)', '📊', ['holistic', 'asset_allocation', 'risk', 'cashflow', 'suitability']);
const mortgageAdviser       = placeholderLens('mortgage-adviser', 'Mortgage Adviser', '🏠', ['mortgages', 'btl', 'remortgage', 'affordability']);
const insuranceAdviser      = placeholderLens('insurance-adviser', 'Insurance / Protection', '🛡️', ['life', 'income_protection', 'critical_illness', 'whole_of_life']);
const investmentAdviser     = placeholderLens('investment-adviser', 'Investment Adviser', '📈', ['portfolio', 'costs', 'rebalancing', 'esg']);
const crossBorderSpecialist = placeholderLens('cross-border', 'Cross-Border Specialist', '🌍', ['srt', 'fig', 'dta', 'deemed_dom', 'nri']);
const familyLawSpecialist   = placeholderLens('family-law', 'Family Law Specialist', '👨‍👩‍👧', ['divorce', 'cohab', 'prenup', 'child_maintenance']);
const laterLifeAdviser      = placeholderLens('later-life', 'Later-Life Adviser', '🏥', ['care_costs', 'la_means_test', 'equity_release', 'capacity']);
const philanthropyAdviser   = placeholderLens('philanthropy', 'Philanthropy Adviser', '💝', ['gift_aid', 'charity_10pct', 'daf', 'cio']);

export const LENS_REGISTRY = [
  taxAccountant,
  pensionSpecialist,
  trustLawyer,
  ifaHolistic,
  mortgageAdviser,
  insuranceAdviser,
  investmentAdviser,
  crossBorderSpecialist,
  familyLawSpecialist,
  laterLifeAdviser,
  philanthropyAdviser,
];

export function findLens(id) {
  return LENS_REGISTRY.find(l => l.id === id);
}

// Router: surface relevant lenses for a given persona, sorted by relevance
export function routeLenses(persona, asOfDate = new Date(), minScore = 0.3) {
  return LENS_REGISTRY
    .map(lens => {
      const r = lens.is_relevant(persona, asOfDate);
      return { lens, relevance: r };
    })
    .filter(r => r.relevance.score >= minScore)
    .sort((a, b) => b.relevance.score - a.relevance.score);
}

// Run a single lens against a persona and return all outputs
export function runLens(lens, persona, asOfDate = new Date(), objectives = {}) {
  return {
    lens_id: lens.id,
    lens_name: lens.name,
    avatar: lens.display_avatar,
    status: lens.status || 'LIVE',
    relevance: lens.is_relevant(persona, asOfDate),
    observations: lens.observe(persona, asOfDate),
    recommendations: lens.recommend(persona, asOfDate, objectives),
    red_flags: lens.red_flags(persona, asOfDate),
    what_if_prompts: lens.what_if_prompts(persona),
  };
}

// Run all relevant lenses
export function runAllLenses(persona, asOfDate = new Date(), objectives = {}) {
  const relevant = routeLenses(persona, asOfDate);
  return relevant.map(({ lens }) => runLens(lens, persona, asOfDate, objectives));
}
