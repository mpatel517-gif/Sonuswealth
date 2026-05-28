// ─────────────────────────────────────────────────────────────────────────────
// Sonuswealth MyMoney runtime audit — paste into DevTools while on MyMoney tab.
// Generated 2026-05-25 by sonuswealth-tester.
// Targets findings from the static audit; checks live DOM + computed pixels.
// ─────────────────────────────────────────────────────────────────────────────
(function sonus_mymoney_audit() {
  const R = { pass: [], fail: [], warn: [], info: [] };
  const chk = (label, ok, detail) =>
    (ok ? R.pass : R.fail).push(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  const wrn = (label, detail) => R.warn.push(`⚠️ ${label}${detail ? ' — ' + detail : ''}`);
  const inf = (label, detail) => R.info.push(`ℹ️ ${label}${detail ? ' — ' + detail : ''}`);

  // ── 1. Garbage text guards ────────────────────────────────────────────────
  const body = document.body.innerText;
  chk('No literal "undefined" in UI', !body.includes('undefined'));
  chk('No literal "NaN" in UI', !body.includes('NaN'));
  chk('No literal "[object Object]"', !body.includes('[object Object]'));
  chk('No literal "null" between word boundaries', !/\bnull\b/.test(body));
  chk('No leaked enum DRAWDOWN_SCHEDULE_SET', !body.includes('DRAWDOWN_SCHEDULE_SET'),
    'PP-9: engine event name visible to user');
  chk('No leaked driver-engine "Driver tree pending"', !body.includes('Driver tree pending'),
    'Drill landed on terminal fallback');

  // ── 2. Empty buttons ──────────────────────────────────────────────────────
  const btns = [...document.querySelectorAll('button')];
  const emptyBtns = btns.filter(b =>
    !b.textContent.trim() && !b.getAttribute('aria-label') && !b.querySelector('svg, img'));
  chk('No empty buttons', emptyBtns.length === 0, `${emptyBtns.length} found`);

  // ── 3. Pluralisation in drill subtitles ──────────────────────────────────
  const badPlural = /\b1 (loans|holdings|schemes|properties)\b/.exec(body);
  chk('No "1 X[s]" plural mistakes in subtitles', !badPlural,
    badPlural ? `match: "${badPlural[0]}"` : '');
  const coAbbrev = /\b\d+ co\b/.exec(body);
  chk('No "X co" abbreviation', !coAbbrev,
    coAbbrev ? `match: "${coAbbrev[0]}" — should be "company/companies"` : '');

  // ── 4. "What moved this month" bar visibility ────────────────────────────
  const movedSection = [...document.querySelectorAll('div')].find(d =>
    d.firstChild && /What moved your net worth/i.test(d.firstChild.textContent || ''));
  if (movedSection) {
    const innerBars = movedSection.querySelectorAll('div[style*="width"]');
    const widths = [...innerBars].map(el => parseFloat(el.style.width || '0'));
    const subPixel = widths.filter(w => w > 0 && w < 0.5).length;
    chk('Waterfall bars all >0.5% width', subPixel === 0,
      `${subPixel} of ${widths.length} bars render sub-pixel; widths: [${widths.slice(0, 10).map(w => w.toFixed(2)).join(', ')}]`);
  } else {
    wrn('Waterfall "What moved" section not found', 'check selector or section gated by trajectory data');
  }

  // ── 5. TripleAnchor tap-target check ─────────────────────────────────────
  const anchorTiles = [...document.querySelectorAll('[role="button"], button')]
    .filter(el => /You own|Wealth Score|Risk Score/.test(el.innerText || ''))
    .slice(0, 3);
  chk('TripleAnchor: 3 tappable tiles present', anchorTiles.length === 3,
    `${anchorTiles.length} found`);
  anchorTiles.forEach((t, i) => {
    const r = t.getBoundingClientRect();
    chk(`Anchor tile ${i + 1} is ≥44px tall (touch target)`,
      r.height >= 44, `${r.height.toFixed(0)}px`);
  });

  // ── 6. SurplusTile hero number tappability ──────────────────────────────
  const surplusHero = [...document.querySelectorAll('.sw-hero-md')]
    .find(el => /[+−-]£/.test(el.textContent || ''));
  if (surplusHero) {
    const isInsideButton = surplusHero.closest('button, [role="button"]');
    chk('SurplusTile £ hero is inside a tappable wrapper',
      !!isInsideButton, 'bare span — Drillable wrapper missing');
  } else {
    wrn('SurplusTile hero not found', 'persona may have no income data');
  }

  // ── 7. MetricTile drillability (Monthly income / Essentials / Debt / Committed) ──
  const metricLabels = ['Monthly income', 'Essentials', 'Debt payments', 'Committed'];
  metricLabels.forEach(lbl => {
    const tile = [...document.querySelectorAll('div')].find(d =>
      d.children.length === 2 && d.firstChild?.textContent?.trim() === lbl.toUpperCase());
    if (tile) {
      const tappable = tile.closest('button, [role="button"]');
      chk(`MetricTile "${lbl}" is tappable`, !!tappable, 'bare div');
    }
  });

  // ── 8. Wrapper composition chips ──────────────────────────────────────────
  const wrapperChips = [...document.querySelectorAll('.sw-chip')].filter(c =>
    /Pension|ISA|GIA|Cash|Property|Onshore bond|Offshore bond/.test(c.textContent || ''));
  const tappableChips = wrapperChips.filter(c =>
    c.closest('button, [role="button"]') || c.onclick || c.style.cursor === 'pointer');
  chk('Wrapper composition chips are tappable',
    tappableChips.length === wrapperChips.length,
    `${tappableChips.length}/${wrapperChips.length} tappable`);

  // ── 9. CategoryTile hero £ values are not interactive (expected per audit) ──
  const tileHeros = [...document.querySelectorAll('div')]
    .filter(d => /^[−-]?£[\d.,kKmM]+$/.test((d.textContent || '').trim())
      && parseFloat(getComputedStyle(d).fontSize || '0') >= 20);
  inf(`Found ${tileHeros.length} large £-only elements — verify which should be drillable`);

  // ── 10. Hidden Ask-Sonu anchors (the routing bug) ────────────────────────
  const askAnchors = [...document.querySelectorAll('a[href^="/ask"]')];
  chk('No raw anchor tags pointing at /ask',
    askAnchors.length === 0,
    `${askAnchors.length} found — these do full-page navigation, dropping app state`);
  askAnchors.forEach((a, i) => inf(`  ask-anchor[${i}]`, a.href));

  // ── 11. Overlay-shell stacking check (PensionDrill + DrillCat) ───────────
  const overlays = [...document.querySelectorAll('[role="dialog"], .sheet-panel')];
  const visibleOverlays = overlays.filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
  });
  chk('Only 0 or 1 drill overlay visible at a time',
    visibleOverlays.length <= 1,
    `${visibleOverlays.length} overlays visible simultaneously — drill state collision`);

  // ── 12. Sparkline SVG path d-attr sanity ─────────────────────────────────
  const svgPaths = [...document.querySelectorAll('svg path[d]')];
  const flatLines = svgPaths.filter(p => {
    const d = p.getAttribute('d') || '';
    const ys = [...d.matchAll(/[ML]\s*[\d.\-]+\s*,\s*([\d.\-]+)/g)].map(m => +m[1]);
    if (ys.length < 3) return false;
    return Math.max(...ys) - Math.min(...ys) < 0.5;
  });
  chk('No flat-line sparklines (all-zero series)',
    flatLines.length === 0,
    `${flatLines.length} flat paths found`);

  // ── 13. Plan staleness banner accessibility ──────────────────────────────
  const banners = [...document.querySelectorAll('[role="alert"], [class*="banner"]')];
  inf(`Found ${banners.length} alert/banner elements`);

  // ── 14. Financial number sanity ──────────────────────────────────────────
  const heroNumbers = [...document.querySelectorAll('.sw-hero-md, [class*="hero"]')]
    .map(el => {
      const raw = (el.textContent || '').match(/[\d.]+[kKmM]?/g) || [];
      return raw.map(s => {
        const n = parseFloat(s);
        if (/m$/i.test(s)) return n * 1_000_000;
        if (/k$/i.test(s)) return n * 1_000;
        return n;
      });
    }).flat().filter(n => !isNaN(n));
  const ridiculous = heroNumbers.filter(n => n > 100_000_000 || n < -1_000_000);
  chk('No financial numbers > £100m or < −£1m', ridiculous.length === 0,
    ridiculous.length ? `outliers: ${ridiculous.slice(0, 3).join(', ')}` : '');

  // ── 15. Broken images ─────────────────────────────────────────────────────
  const imgs = [...document.querySelectorAll('img')];
  const broken = imgs.filter(i => i.complete && i.naturalWidth === 0);
  chk('No broken images', broken.length === 0, `${broken.length} broken`);

  // ── 16. Theme contrast — verify --c-text on --c-bg ──────────────────────
  const bg = getComputedStyle(document.body).backgroundColor;
  const fg = getComputedStyle(document.querySelector('h1, h2, .sw-hero-md') || document.body).color;
  inf(`Theme colors`, `bg=${bg}, fg=${fg}`);

  // ── 17. SVG gradient ID uniqueness (CategoryTile uses useId) ────────────
  const gradients = [...document.querySelectorAll('linearGradient[id], radialGradient[id]')];
  const ids = gradients.map(g => g.id);
  const dupeIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  chk('All SVG gradient IDs are unique', dupeIds.length === 0,
    `dupes: [${[...new Set(dupeIds)].join(', ')}]`);

  // ── 18. Console error/warning capture ────────────────────────────────────
  if (!window.__sonus_console_hook) {
    window.__sonus_console_hook = true;
    const origErr = console.error.bind(console);
    const origWarn = console.warn.bind(console);
    window.__sonus_errors = [];
    console.error = (...a) => { window.__sonus_errors.push(['err', ...a]); origErr(...a); };
    console.warn = (...a) => { window.__sonus_errors.push(['warn', ...a]); origWarn(...a); };
    inf('Console hook installed — re-run after triggering drills to see captured errors');
  } else {
    const errs = window.__sonus_errors || [];
    inf(`Console errors/warnings captured: ${errs.length}`);
    errs.slice(0, 5).forEach((e, i) => inf(`  err[${i}]`, JSON.stringify(e).slice(0, 200)));
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  console.group(`%c🔍 Sonuswealth MyMoney Audit — ${R.pass.length}✅ ${R.fail.length}❌ ${R.warn.length}⚠️`,
    'font-weight: bold; font-size: 14px');
  if (R.fail.length) {
    console.group('%cFAILURES', 'color:#FF6F7D;font-weight:bold');
    R.fail.forEach(f => console.error(f));
    console.groupEnd();
  }
  if (R.warn.length) {
    console.group('%cWARNINGS', 'color:#FFB347;font-weight:bold');
    R.warn.forEach(w => console.warn(w));
    console.groupEnd();
  }
  if (R.info.length) {
    console.group('%cINFO', 'color:#7AA7FF');
    R.info.forEach(i => console.info(i));
    console.groupEnd();
  }
  console.group('%cPASSES', 'color:#2DF2C3');
  R.pass.forEach(p => console.log(p));
  console.groupEnd();
  console.groupEnd();

  console.log('\n🔁 Next steps:');
  console.log('  1. Open PensionDrillDown via the pension tile, paste this script again');
  console.log('  2. Inside the drill, click "Ask Sonu about this" — note URL change');
  console.log('  3. Verify the overlay-stacking check still passes (only 1 overlay)');
  console.log('  4. Switch persona (mrT-core / persona-a / persona-b ...) and re-run');
  return R;
})();
