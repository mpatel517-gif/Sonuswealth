// Smoke test for Tax Accountant lens against persona-a (Bruce Wayne)
// and a curated demo state with high-income + GIA + ISA.

import { lens as taxAccountant } from '../src/lenses/tax-accountant.js';
import { runLens, routeLenses } from '../src/lenses/index.js';
import fs from 'fs';

const personaA = JSON.parse(fs.readFileSync(new URL('../src/rules/personas/persona-a.json', import.meta.url), 'utf8'));

// Curate Bruce a bit for demo realism — add some fields lens expects
personaA.contributions_this_year = personaA.contributions_this_year || { isa: 8000, pension: 0 };
personaA.assets.portfolio = personaA.assets.portfolio || {};
personaA.assets.portfolio.unrealised_gain = personaA.assets.portfolio.unrealised_gain ?? 12000;
personaA.assets.portfolio.unrealised_loss = personaA.assets.portfolio.unrealised_loss ?? 2500;
personaA.assets.portfolio.value = personaA.assets.portfolio.value ?? 200000;
personaA.pension = personaA.pension || {};
personaA.pension.carry_forward_available = personaA.pension.carry_forward_available ?? 80000;

console.log('═══════════════════════════════════════════════════════════════');
console.log('  TAX ACCOUNTANT LENS — SMOKE TEST');
console.log('  Persona: persona-a (Bruce Wayne, age 62, decumulation)');
console.log('═══════════════════════════════════════════════════════════════');

const relevance = taxAccountant.is_relevant(personaA);
console.log('\nRELEVANCE: ' + (relevance.score * 100).toFixed(0) + '% — ' + relevance.reason);

const result = runLens(taxAccountant, personaA, new Date());

console.log('\nOBSERVATIONS (' + result.observations.length + '):');
for (const o of result.observations) {
  console.log('  [' + (o.severity === 3 ? 'HIGH' : o.severity === 2 ? 'MED ' : 'LOW ') + '] ' + o.id);
  console.log('    ' + o.text);
  console.log('    Source: ' + o.citation);
}

console.log('\nRECOMMENDATIONS (' + result.recommendations.length + '):');
for (const r of result.recommendations) {
  const headline = r.headline;
  console.log('\n  ★ ' + r.id + ' — ' + headline);
  const impact = r.impact?.gbp_per_year
    ? '£' + r.impact.gbp_per_year.toLocaleString() + '/yr'
    : (r.impact?.gbp_lifetime
        ? '£' + r.impact.gbp_lifetime.toLocaleString() + ' lifetime'
        : '—');
  console.log('    Impact: ' + impact + ' (certainty ' + ((r.impact?.certainty ?? 0) * 100).toFixed(0) + '%)');
  console.log('    Source: ' + r.citation);
  console.log('    Action: ' + (r.action_steps?.[0] ?? '—'));
}

console.log('\nRED FLAGS (' + result.red_flags.length + '):');
for (const f of result.red_flags) {
  console.log('  ⚠ ' + f.action + ' (urgency ' + f.urgency + ')');
}

console.log('\nWHAT-IF PROMPTS (' + result.what_if_prompts.length + '):');
for (const p of result.what_if_prompts) {
  console.log('  ? ' + p);
}

// Router check — which lenses are relevant?
const lensRouting = routeLenses(personaA);
console.log('\nLENS ROUTING — Bruce is relevant for ' + lensRouting.length + ' / 11 lenses:');
for (const r of lensRouting) {
  console.log('  ' + r.lens.display_avatar + ' ' + r.lens.name + ' — ' + (r.relevance.score * 100).toFixed(0) + '% (' + r.relevance.reason + ')');
}

// Determinism check — re-run with same input, expect identical output
const result2 = runLens(taxAccountant, personaA, new Date());
const matches = JSON.stringify(result.recommendations.map(r => r.id)) === JSON.stringify(result2.recommendations.map(r => r.id));
console.log('\nDETERMINISM CHECK: ' + (matches ? '✓ same input → same output' : '✗ NON-DETERMINISTIC'));

// Export JSON for the demo HTML
fs.writeFileSync(new URL('../tests/_bruce-tax-accountant-output.json', import.meta.url), JSON.stringify(result, null, 2));
console.log('\nExported result to tests/_bruce-tax-accountant-output.json (for demo.html)');
console.log('═══════════════════════════════════════════════════════════════');
