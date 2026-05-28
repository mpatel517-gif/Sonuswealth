// ─────────────────────────────────────────────────────────────────────────────
// tieout-scraped.mjs — Playwright DOM scrape for UI tie-out diff.
//
// For each UI-renderable persona × route, visits the page, waits for paint,
// and reads every `[data-tieout]` element's `data-tieout-raw` (preferred)
// or text content. Emits ./tests/reports/tieout-scraped.json shaped as:
//   { "<persona-id>": { "<tieout-key>": number, ... }, ... }
//
// Dev server must be running on http://localhost:5173 (default vite).
//
// Usage: npm run dev  (separate terminal)
//        node scripts/tieout-scraped.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const BASE = process.env.SCRAPE_BASE || 'http://localhost:5173';
const OUT  = resolve('./tests/reports/tieout-scraped.json');

// UI-renderable personas only — mrT-* except mrt-core render an
// "engine fixture only" gate (App.jsx:67 isUiRenderable). The other
// 12 mrT-* personas are engine-test shape and are excluded here.
const PERSONAS = [
  'a', 'b', 'c', 'd', 'e', 'g',
  'mrt-core',
  // Anna Finch life-arc — actual snapshot IDs per personaF.snapshots[]
  'f-22', 'f-32', 'f-45', 'f-58', 'f-72', 'f-89',
];

// Route → expected tieout prefixes on that page
const ROUTES = [
  { tab: 'home',     prefixes: ['home.'] },
  { tab: 'money',    prefixes: ['money.', 'money.cat.'] },
  { tab: 'risk',     prefixes: ['risk.'] },
  { tab: 'timeline', prefixes: ['timeline.'] },
  { tab: 'tax',      prefixes: ['tax.'] },
];

mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const scraped = {};
let total = 0;
let missing = 0;

for (const persona of PERSONAS) {
  scraped[persona] = {};
  for (const { tab, prefixes } of ROUTES) {
    const url = `${BASE}/?demo=${persona}&tab=${tab}`;
    process.stdout.write(`→ ${persona.padEnd(12)}  ${tab.padEnd(8)}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      // settle FadeInOnMount + reveal animations (snap.mjs uses 1800ms)
      await page.waitForTimeout(1800);
      const found = await page.evaluate(() => {
        const out = {};
        for (const el of document.querySelectorAll('[data-tieout]')) {
          const key = el.getAttribute('data-tieout');
          const raw = el.getAttribute('data-tieout-raw');
          if (raw != null && raw !== '') {
            const n = Number(raw);
            out[key] = Number.isFinite(n) ? Math.round(n) : null;
          } else {
            // Parse the visible text: strip £, commas, k/m suffix, − sign
            const txt = (el.textContent || '').trim();
            // Match like "£698,390" or "−£552/mo" or "£1.3m"
            const m = txt.match(/(−|-)?\s*£?\s*([\d.,]+)\s*([km]?)/i);
            if (!m) { out[key] = null; continue; }
            const sign = (m[1] === '−' || m[1] === '-') ? -1 : 1;
            let num = parseFloat(m[2].replace(/,/g, ''));
            if (m[3]?.toLowerCase() === 'k') num *= 1_000;
            if (m[3]?.toLowerCase() === 'm') num *= 1_000_000;
            out[key] = Number.isFinite(num) ? Math.round(sign * num) : null;
          }
        }
        return out;
      });
      const onThisPage = Object.entries(found).filter(([k]) =>
        prefixes.some(p => k.startsWith(p))
      );
      for (const [key, val] of onThisPage) {
        scraped[persona][key] = val;
        total++;
        if (val == null) missing++;
      }
      process.stdout.write(`  found ${onThisPage.length} tieouts\n`);
    } catch (err) {
      process.stdout.write(`  ERR ${err.message.slice(0, 60)}\n`);
    }
  }
}

await browser.close();

writeFileSync(OUT, JSON.stringify(scraped, null, 2));
console.log(`\n✓ Wrote ${total} tieout values (${missing} null) → ${OUT}`);
