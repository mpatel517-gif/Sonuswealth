// Generates a static demo.html from Bruce's Tax Accountant lens output.
// No client-side JS — everything pre-rendered into the markup.
// Run: node scripts/generate-demo-html.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/_bruce-tax-accountant-output.json'), 'utf8'));

const LENSES = [
  { id: 'tax-accountant', name: 'Tax Accountant', emoji: '🧾', status: 'live' },
  { id: 'pension-specialist', name: 'Pension Specialist', emoji: '🏦', status: 'shell' },
  { id: 'trust-lawyer', name: 'Trust Lawyer', emoji: '⚖️', status: 'shell' },
  { id: 'ifa-holistic', name: 'IFA', emoji: '📊', status: 'shell' },
  { id: 'mortgage-adviser', name: 'Mortgage', emoji: '🏠', status: 'shell' },
  { id: 'insurance-adviser', name: 'Protection', emoji: '🛡️', status: 'shell' },
  { id: 'investment-adviser', name: 'Investment', emoji: '📈', status: 'shell' },
  { id: 'cross-border', name: 'Cross-Border', emoji: '🌍', status: 'shell' },
  { id: 'family-law', name: 'Family Law', emoji: '👨‍👩‍👧', status: 'shell' },
  { id: 'later-life', name: 'Later-Life', emoji: '🏥', status: 'shell' },
  { id: 'philanthropy', name: 'Philanthropy', emoji: '💝', status: 'shell' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n) => (n == null || isNaN(n)) ? '—' : '£' + Math.round(n).toLocaleString('en-GB');

const annualGain = data.recommendations.reduce((s, r) => s + (r.impact?.gbp_per_year || 0), 0);
const lifetimeGain = data.recommendations.reduce((s, r) => s + (r.impact?.gbp_lifetime || 0), 0);

const lensRail = LENSES.map(l => {
  const isLive = l.status === 'live';
  return `<button class="lens-tab ${isLive ? 'active' : 'placeholder'}" ${isLive ? '' : 'disabled'}>` +
    `<span>${l.emoji}</span><span>${esc(l.name)}</span>` +
    (isLive ? '' : '<span class="lens-tab-badge">Soon</span>') +
    `</button>`;
}).join('');

const obsHtml = data.observations.map(o => `
  <div class="obs" data-severity="${o.severity}">
    <div class="obs-severity">${o.severity === 3 ? 'HIGH' : o.severity === 2 ? 'MED' : 'LOW'}</div>
    <div>
      <div class="obs-text">${esc(o.text)}</div>
      <div class="obs-cite">${esc(o.citation)}</div>
    </div>
  </div>
`).join('');

const recHtml = data.recommendations.map((r, i) => {
  const annual = r.impact?.gbp_per_year;
  const lifetime = r.impact?.gbp_lifetime;
  const impactVal = annual ? fmt(annual) : (lifetime ? fmt(lifetime) : '—');
  const impactPeriod = annual ? '/year' : (lifetime ? 'lifetime' : '');
  const certainty = r.impact?.certainty != null ? `${Math.round(r.impact.certainty * 100)}% certainty` : '';
  const steps = (r.action_steps || []).map(s => `<div class="rec-step">${esc(s)}</div>`).join('');
  const flip = r.flip_conditions ? `<div class="rec-meta-chunk"><strong>When this flips:</strong> ${esc(r.flip_conditions)}</div>` : '';
  const mistakes = r.common_mistakes?.length ? `<div class="rec-meta-chunk"><strong>Common mistakes:</strong> ${r.common_mistakes.map(esc).join(' · ')}</div>` : '';
  const assumptions = r.assumptions && Object.keys(r.assumptions).length ? `<div class="rec-meta-chunk"><strong>Assumes:</strong> ${Object.values(r.assumptions).map(esc).join(' · ')}</div>` : '';

  return `
    <details class="rec" id="rec-${i}">
      <summary class="rec-top">
        <div class="rec-headline">${esc(r.headline)}</div>
        <div class="rec-impact">
          <div class="rec-impact-val">${impactVal}</div>
          <div class="rec-impact-period">${impactPeriod}</div>
          ${certainty ? `<div class="rec-impact-cert">${certainty}</div>` : ''}
        </div>
      </summary>
      <div class="rec-body">
        <div class="rec-drill">${esc(r.drill_down)}</div>
        <div class="rec-section-label">Action steps</div>
        <div class="rec-actions">${steps}</div>
        <div class="rec-section-label">Context</div>
        <div class="rec-meta">${assumptions}${flip}${mistakes}</div>
        <div class="rec-fca">${esc(r.fca_boundary)}</div>
        <div class="rec-footer">
          <div class="rec-cite">${esc(r.citation)}</div>
          <button class="challenge-btn" onclick="document.getElementById('modal').classList.add('open')">⚠ Challenge this</button>
        </div>
      </div>
    </details>
  `;
}).join('');

const whatifHtml = data.what_if_prompts.map(p =>
  `<button class="whatif-chip" onclick="document.getElementById('modal').classList.add('open')">${esc(p)}</button>`
).join('');

const heroHeadline = `Your tax accountant found ${fmt(annualGain)}/yr and ${fmt(lifetimeGain)} lifetime in tax savings across ${data.recommendations.length} actionable strategies.`;

const html = `<!DOCTYPE html>
<html lang="en-GB"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Caelixa — Tax Accountant view (Bruce Wayne)</title>
<style>
:root{--bg:#0a0e1a;--surface:#131726;--surface-2:#1a1f33;--border:rgba(255,255,255,0.08);--text:#e8eaf0;--text-dim:#9aa0b4;--text-faint:#6a7088;--accent:#00E5A8;--accent-dim:#00b388;--warn:#FFB547;--danger:#FF6B6B;--info:#4D8EFF;--radius:12px;--radius-sm:8px}
*{box-sizing:border-box}
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.5}
.container{max-width:1200px;margin:0 auto;padding:24px 32px 80px}
.masthead{display:flex;align-items:center;justify-content:space-between;padding-bottom:20px;border-bottom:1px solid var(--border);margin-bottom:28px}
.brand{display:flex;align-items:center;gap:12px;font-weight:600;letter-spacing:-0.01em;font-size:18px}
.brand-logo{width:32px;height:32px;background:linear-gradient(135deg,var(--accent),var(--accent-dim));border-radius:8px;display:grid;place-items:center;font-weight:800;color:#001a14;font-size:16px}
.brand-tag{font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.08em}
.persona-bar{display:flex;align-items:center;gap:14px;background:var(--surface);padding:10px 16px;border-radius:var(--radius);border:1px solid var(--border)}
.persona-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#3a3f55,#1a1f33);display:grid;place-items:center;font-weight:600;color:var(--text);font-size:14px}
.persona-meta{line-height:1.3}
.persona-name{font-weight:600}
.persona-detail{font-size:12px;color:var(--text-dim)}
.hero{background:linear-gradient(135deg,var(--surface),var(--surface-2));padding:32px 28px;border-radius:var(--radius);border:1px solid var(--border);margin-bottom:32px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
.hero-lens{display:flex;align-items:center;gap:14px;margin-bottom:12px}
.hero-lens-avatar{font-size:28px;width:48px;height:48px;background:rgba(255,255,255,0.06);border-radius:12px;display:grid;place-items:center}
.hero-lens-name{font-weight:600;font-size:18px}
.hero-lens-status{font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(0,229,168,0.12);color:var(--accent);letter-spacing:0.04em;text-transform:uppercase}
.hero-headline{font-size:30px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;margin:0}
.hero-savings{display:flex;gap:32px;margin-top:18px;flex-wrap:wrap}
.hero-savings-item{line-height:1.2}
.hero-savings-val{font-size:24px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.hero-savings-label{font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-top:4px}
.hero-cta{display:flex;flex-direction:column;gap:10px}
.btn{padding:12px 20px;border-radius:var(--radius-sm);border:none;background:var(--accent);color:#001a14;font-weight:600;cursor:pointer;font-size:13px;transition:transform 0.06s}
.btn:hover{transform:translateY(-1px)}
.btn-ghost{background:transparent;color:var(--text);border:1px solid var(--border)}
.lens-rail{display:flex;gap:8px;overflow-x:auto;padding:0 0 12px;margin-bottom:28px;border-bottom:1px solid var(--border)}
.lens-tab{padding:10px 14px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:13px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px;transition:all 0.12s}
.lens-tab.active{background:rgba(0,229,168,0.12);color:var(--accent);border-color:rgba(0,229,168,0.3)}
.lens-tab.placeholder{opacity:0.45;cursor:not-allowed}
.lens-tab-badge{font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.08);color:var(--text-faint);letter-spacing:0.04em;text-transform:uppercase}
.section{margin-bottom:36px}
.section-title{font-size:14px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;display:flex;align-items:baseline;gap:8px}
.section-count{color:var(--text-faint);font-weight:400}
.obs-list{display:flex;flex-direction:column;gap:10px}
.obs{background:var(--surface);padding:14px 18px;border-radius:var(--radius);border:1px solid var(--border);border-left:3px solid var(--text-faint);display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start}
.obs[data-severity="3"]{border-left-color:var(--danger)}
.obs[data-severity="2"]{border-left-color:var(--warn)}
.obs[data-severity="1"]{border-left-color:var(--info)}
.obs-severity{font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.06em;min-width:56px;text-align:center}
.obs[data-severity="3"] .obs-severity{background:rgba(255,107,107,0.16);color:var(--danger)}
.obs[data-severity="2"] .obs-severity{background:rgba(255,181,71,0.16);color:var(--warn)}
.obs[data-severity="1"] .obs-severity{background:rgba(77,142,255,0.16);color:var(--info)}
.obs-text{font-size:14px;line-height:1.55}
.obs-cite{font-size:11px;color:var(--text-faint);margin-top:8px;font-family:ui-monospace,'SF Mono',monospace}
.rec-grid{display:flex;flex-direction:column;gap:12px}
.rec{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:0;cursor:pointer;transition:border-color 0.12s}
.rec:hover{border-color:rgba(0,229,168,0.4)}
.rec[open]{border-color:rgba(0,229,168,0.4)}
.rec-top{padding:18px 22px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;cursor:pointer;list-style:none}
.rec-top::-webkit-details-marker{display:none}
.rec-headline{font-size:16px;font-weight:600;line-height:1.4}
.rec-impact{text-align:right;white-space:nowrap}
.rec-impact-val{font-size:20px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.rec-impact-period{font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em}
.rec-impact-cert{display:inline-block;margin-top:4px;font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-dim)}
.rec-body{padding:0 22px 18px}
.rec-section-label{font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 6px}
.rec-drill{font-size:13px;color:var(--text-dim);line-height:1.65;padding-top:6px;border-top:1px solid var(--border)}
.rec-actions{display:flex;flex-direction:column;gap:6px}
.rec-step{background:var(--surface-2);padding:8px 12px;border-radius:var(--radius-sm);font-size:12px;color:var(--text-dim);border:1px solid var(--border)}
.rec-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--text-faint)}
.rec-meta-chunk{background:var(--surface-2);padding:6px 10px;border-radius:var(--radius-sm)}
.rec-meta-chunk strong{color:var(--text-dim)}
.rec-fca{margin-top:14px;padding:10px 14px;background:rgba(77,142,255,0.06);border-left:2px solid var(--info);border-radius:var(--radius-sm);font-size:12px;color:var(--text-dim);font-style:italic}
.rec-footer{margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:12px;border-top:1px solid var(--border)}
.rec-cite{font-size:11px;color:var(--text-faint);font-family:ui-monospace,'SF Mono',monospace}
.challenge-btn{padding:8px 14px;font-size:12px;border-radius:6px;background:transparent;border:1px solid var(--border);color:var(--text-dim);cursor:pointer}
.challenge-btn:hover{border-color:var(--warn);color:var(--warn)}
.whatif-row{display:flex;flex-wrap:wrap;gap:8px}
.whatif-chip{padding:9px 14px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:13px;color:var(--text);cursor:pointer;transition:all 0.12s}
.whatif-chip:hover{border-color:var(--accent);color:var(--accent)}
.footer{margin-top:64px;padding-top:24px;border-top:1px solid var(--border);text-align:center;font-size:12px;color:var(--text-faint);line-height:1.7}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:20px;z-index:100}
.modal-bg.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px 32px;max-width:480px;width:100%}
.modal-title{font-size:18px;font-weight:600;margin-bottom:12px}
.modal-body{font-size:14px;color:var(--text-dim);line-height:1.6;margin-bottom:20px}
.modal-actions{display:flex;gap:10px;justify-content:flex-end}
@media (max-width:720px){.container{padding:18px 18px 60px}.masthead{flex-direction:column;align-items:stretch;gap:14px}.hero{grid-template-columns:1fr;padding:22px 18px}.hero-headline{font-size:22px}.hero-savings{gap:16px}.hero-savings-val{font-size:18px}.rec-top{grid-template-columns:1fr}.rec-impact{text-align:left}}
</style>
</head><body>
<div class="container">

  <header class="masthead">
    <div class="brand">
      <div class="brand-logo">C</div>
      <div>
        <div>Caelixa</div>
        <div class="brand-tag">Synthesised professional brain</div>
      </div>
    </div>
    <div class="persona-bar">
      <div class="persona-avatar">BW</div>
      <div class="persona-meta">
        <div class="persona-name">Bruce Wayne</div>
        <div class="persona-detail">62 · Decumulation · UK-rUK · Net worth £3,725,605</div>
      </div>
    </div>
  </header>

  <nav class="lens-rail">${lensRail}</nav>

  <div class="hero">
    <div>
      <div class="hero-lens">
        <div class="hero-lens-avatar">🧾</div>
        <div>
          <div class="hero-lens-name">Tax Accountant view</div>
          <div class="hero-lens-status">Live</div>
        </div>
      </div>
      <h1 class="hero-headline">${esc(heroHeadline)}</h1>
      <div class="hero-savings">
        <div class="hero-savings-item">
          <div class="hero-savings-val">${fmt(annualGain)}/yr</div>
          <div class="hero-savings-label">Annual saving</div>
        </div>
        <div class="hero-savings-item">
          <div class="hero-savings-val">${fmt(lifetimeGain)}</div>
          <div class="hero-savings-label">Lifetime saving</div>
        </div>
        <div class="hero-savings-item">
          <div class="hero-savings-val">${data.recommendations.length}</div>
          <div class="hero-savings-label">Strategies</div>
        </div>
      </div>
    </div>
    <div class="hero-cta">
      <a href="#rec-section" class="btn">View recommendations</a>
      <a href="#obs-section" class="btn btn-ghost">See observations</a>
    </div>
  </div>

  <section class="section" id="obs-section">
    <h2 class="section-title">
      What your tax accountant noticed
      <span class="section-count">(${data.observations.length})</span>
    </h2>
    <div class="obs-list">${obsHtml}</div>
  </section>

  <section class="section" id="rec-section">
    <h2 class="section-title">
      Strategies ranked by tax impact
      <span class="section-count">(${data.recommendations.length} — tap to expand)</span>
    </h2>
    <div class="rec-grid">${recHtml}</div>
  </section>

  <section class="section">
    <h2 class="section-title">
      Ask anything
      <span class="section-count">(tap to explore — Sonnu chat coming v0.1)</span>
    </h2>
    <div class="whatif-row">${whatifHtml}</div>
  </section>

  <div class="footer">
    Powered by Caelixa's lens-based AI engine. Designed to run 11 professional perspectives — Tax Accountant (live), Pension Specialist, Trust Lawyer, IFA, Mortgage Adviser, Insurance Adviser, Investment Adviser, Cross-Border Specialist, Family Law, Later-Life, Philanthropy. Where they disagree, the app surfaces the disagreement and lets you decide.
    <br><br>
    <strong>Information only.</strong> Caelixa does not provide regulated advice. Speak to a qualified professional before acting on any output.
    <br><br>
    Tax year 2025/26 · Rules version UK-2026.1.1 · Engine version Sonuswealth-1.0 · Generated: ${new Date().toISOString().slice(0,16).replace('T',' ')}
  </div>

</div>

<div class="modal-bg" id="modal" onclick="if(event.target.id==='modal')this.classList.remove('open')">
  <div class="modal">
    <div class="modal-title">Challenge this recommendation</div>
    <div class="modal-body">
      Coming in v0.1: practitioner panel review. Your challenge would be logged, reviewed within 7 days, and — if valid — the rule updated and versioned. All challenges audit-trailed.
      <br><br>
      <strong>For today's demo:</strong> this affordance proves the mechanism exists. Submission queue ships next sprint.
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="document.getElementById('modal').classList.remove('open')">Close</button>
    </div>
  </div>
</div>

</body></html>`;

fs.writeFileSync(path.join(ROOT, 'demo.html'), html);
console.log('Generated demo.html (' + html.length.toLocaleString() + ' bytes)');
console.log('Open file:///' + path.join(ROOT, 'demo.html').replace(/\\/g, '/'));
