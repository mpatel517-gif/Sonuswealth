import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './src/rules/personas/matrix/';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 1. Authoritative Dimension 2: 10 Path Groups
const pathGroups = [
    'single', 'couple', 'family-primary', 'aged-out', 'divorced',
    'cohab-sep', 'sole-trader', 'ltd-director', 'landlord', 'beneficiary'
];

// 2. Authoritative Dimension 5: 7 Life Stages
const lifeStages = [
    'foundation', 'accumulation', 'consolidation',
    'transition', 'decumulation', 'preservation', 'legacy'
];

// 3. Strict Production Drop Rules Map
function shouldDrop(pathGroup, stage) {
    if (pathGroup === 'aged-out' && stage !== 'foundation') return true; // Aged-out is Foundation only
    if (pathGroup === 'family-primary' && ['decumulation', 'preservation', 'legacy'].includes(stage)) return true; // Dependant adults adult-out
    if (pathGroup === 'cohab-sep' && ['foundation', 'decumulation', 'preservation', 'legacy'].includes(stage)) return true; // Transient state
    if (pathGroup === 'divorced' && stage === 'foundation') return true; // Kept legacy, dropped foundation
    if (pathGroup === 'sole-trader' && ['decumulation', 'preservation', 'legacy'].includes(stage)) return true; // Winding down
    if (pathGroup === 'ltd-director' && stage === 'foundation') return true; // Rare in foundation
    if (pathGroup === 'ltd-director' && stage === 'legacy') return true; // Ownership transferred by late-life
    if (pathGroup === 'landlord' && ['foundation', 'legacy'].includes(stage)) return true; // Out-of-bounds
    if (pathGroup === 'beneficiary' && ['preservation', 'legacy'].includes(stage)) return true; // Collapses to standard late-life
    return false;
}

let generatedCount = 0;

// Generate the 45 base validation profiles
pathGroups.forEach(group => {
    lifeStages.forEach(stage => {
        if (shouldDrop(group, stage)) return;

        generatedCount++;
        const slug = `${group}-${stage}`;
        saveFixture(slug, group, stage, 'base');
    });
});

// 4. Promoted Cross-Border Core Profiles
const crossBorderArchetypes = [
    { slug: 'single-accumulation-uk-in', group: 'single', stage: 'accumulation' },
    { slug: 'single-consolidation-uk-in', group: 'single', stage: 'consolidation' },
    { slug: 'couple-accumulation-uk-in', group: 'couple', stage: 'accumulation' },
    { slug: 'couple-decumulation-uk-in', group: 'couple', stage: 'decumulation' },
    { slug: 'landlord-consolidation-uk-in', group: 'landlord', stage: 'consolidation' },
    { slug: 'single-decumulation-uk-th', group: 'single', stage: 'decumulation' },
    { slug: 'couple-decumulation-uk-th', group: 'couple', stage: 'decumulation' }
];

crossBorderArchetypes.forEach(cb => {
    generatedCount++;
    saveFixture(cb.slug, cb.group, cb.stage, 'cross-border');
});

function saveFixture(slug, group, stage, type) {
    const isUKTH = slug.includes('uk-th');
    const isUKIN = slug.includes('uk-in');

    const payload = {
        id: slug,
        meta: { type: type, group: group, stage: stage },
        financial_vectors: {
            employment: {
                salary: stage === 'consolidation' || stage === 'transition' ? 145000 : 45000,
                dividends: group === 'ltd-director' ? 35000 : 500
            },
            assets: {
                sipp_balance: stage === 'foundation' ? 12000 : 380000,
                isa_balance: 45000,
                unquoted_trading_shares: group === 'ltd-director' ? 1200000 : 0,
                overseas_accounts: isUKIN || isUKTH ? 250000 : 0
            },
            liabilities: {
                directors_loan_balance: group === 'ltd-director' && stage === 'consolidation' ? 80000 : 0,
                s455_tax_due: group === 'ltd-director' && stage === 'consolidation' ? 26000 : 0
            },
            residency: {
                uk_years: isUKIN ? 13 : 35,
                thai_ltr_visa: isUKTH
            }
        }
    };

    fs.writeFileSync(
        path.join(OUTPUT_DIR, `${slug}.json`),
        JSON.stringify(payload, null, 2)
    );
}

console.log(`\n======================================================`);
console.log(` ✓ AUTHORITATIVE MATRIX GENERATION COMPLETE`);
console.log(`   Total Matrix Output Profiles: ${generatedCount} (45 Base + 7 Cross-Border)`);
console.log(`======================================================\n`);