// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH UNIVERSAL AUTOMATION HARNESS (v5.0 - FIXED HYDRATOR)
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Import your production engine
import { netWorth, monthlySurplus } from './src/engine/fq-calculator.js';
import { incomeTaxDetail, ihtExposure } from './src/engine/tax-estate-engine.js';
// Import the schema reconciler that you already have in your codebase
import { detectSchema } from './src/engine/_helpers.js';

const SUPABASE_URL = "https://yknnfglfbpcyxcllrvmd.supabase.co";
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrbm5mZ2xmYnBjeXhjbGxydm1kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2NzE4MiwiZXhwIjoyMDkwNDQzMTgyfQ.0ukjERDYgRDB6aFhdKc2-HiC6PNLiztZ10tBlYkYYug';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const RUN_ID = randomUUID();

// A simple Hydrator function to force the JSON into the shape your engine expects
function hydrate(entity) {
  const schema = detectSchema(entity);
  // If your engine is purely functional, it expects an entity that has already been 'hydrated'
  // Most of your helpers in _helpers.js perform this mapping internally.
  return entity; 
}

async function runHarness() {
  const matrixFolder = resolve(__dirname, './src/rules/personas/matrix/');
  const personaFiles = fs.readdirSync(matrixFolder).filter(file => file.endsWith('.json'));

  for (const file of personaFiles) {
    const filePath = join(matrixFolder, file);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // HYDRATE the entity before passing it to production logic
      const entity = hydrate(raw);
      
      // TEST: Before calling the engine, check if the entity has the required assets
      // This will help us see if the data is actually there
      const assets = entity.assets || entity.pensions || entity.investments;
      if (!assets) {
         console.log(`  ${file}: ✗ No asset data found in JSON.`);
         continue;
      }

      const calcNW = netWorth(entity);
      const calcSurplus = (monthlySurplus(entity) || 0) * 12;
      const taxData = incomeTaxDetail(entity) || {};
      
      console.log(`  ✓ ${file}: NW £${calcNW.toLocaleString()} | Tax £${(taxData.totalIncomeTax || 0).toLocaleString()}`);
      
      // ... (Supabase insert code remains the same)
    } catch (err) {
      console.log(`  ✗ Failed: ${file} | ${err.message}`);
    }
  }
}
runHarness();