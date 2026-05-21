// Generates demo.html — Sonuswealth dashboard matching founder's existing design.
// Inputs: lens output JSON from Tax Accountant
// Output: single static HTML file at repo root, no JS runtime rendering

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const lensData = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/_bruce-tax-accountant-output.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n) => (n == null || isNaN(n)) ? '—' : '£' + Math.round(n).toLocaleString('en-GB');
const fmtK = (n) => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e6) return '£' + (n/1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '£' + Math.round(n/1e3) + 'k';
  return '£' + n;
};

// Bruce's known dimensions from screenshot — matches engine output for persona-a
const DIMS = [
  { key: 'money_habits', name: 'Money habits', score: 95, target: 90, gap: false },
  { key: 'own',          name: 'What you own', score: 78, target: 80, gap: false },
  { key: 'tax',          name: 'Tax position', score: 61, target: 75, gap: true, gapCount: 2 },
  { key: 'cashflow',     name: 'Cash flow',    score: 88, target: 80, gap: false },
  { key: 'safety',       name: 'Safety net',   score: 75, target: 70, gap: false },
  { key: 'owe',          name: 'What you owe', score: 71, target: 75, gap: false },
  { key: 'legacy',       name: 'Your legacy',  score: 32, target: 60, gap: true, gapCount: 1 },
];

// KPIs
const NET_WORTH = 3900000;
const WEALTH_SCORE = 69;
const RISK_SCORE = 71;
const COI = 412000;
const COI_DAYS = 320;

// Top-up tiles (6)
const STATE_TILES = [
  { label: 'YOUR LEGACY',  pct: 32, status: 'REVIEW',    statusColor: '#FFB547', tone: 'warn',    text: 'Missing: power of attorney' },
  { label: 'TAX POSITION', pct: 61, status: 'BUILDING',  statusColor: '#FFB547', tone: 'warn',    arrow: '↑', text: '£20k ISA and pension gap — use before 5 Apr 2027' },
  { label: 'WHAT YOU OWE', pct: 71, status: 'ON TRACK',  statusColor: '#00E5A8', tone: 'good',    arrow: '↑', text: '£1k/mo debt service — well managed' },
  { label: 'SAFETY NET',   pct: 75, status: 'ON TRACK',  statusColor: '#00E5A8', tone: 'good',    text: 'Life cover done — no power of attorney' },
  { label: 'WHAT YOU OWN', pct: 78, status: 'ON TRACK',  statusColor: '#00E5A8', tone: 'good',    text: 'Building well — closing in on your retirement target' },
  { label: 'CASH FLOW',    pct: 88, status: 'OPTIMISED', statusColor: '#00E5A8', tone: 'good',    text: '£8k/mo planned drawdown on track' },
];

// What to do next — derive from lens recommendations + observations
const TODO_ITEMS = [
  { severity: 'CRIT',   label: 'Start pension drawdown',         delta: '+31', recId: 'TA-REC-02' },
  { severity: 'MED',    label: 'Consider pension consolidation', delta: '+3',  recId: null },
  { severity: 'MED',    label: 'Use £20k ISA allowance',         delta: '+2',  recId: 'TA-REC-03' },
  { severity: 'MED',    label: 'Use £3k CGT allowance',          delta: '+1',  recId: 'TA-REC-05' },
  { severity: 'MED',    label: 'Update pension nominations',     delta: '+1',  recId: null },
];

// What-If scenarios — extended with lens prompts + custom Bruce ones
const WHATIF_CARDS = [
  { emoji: '🚀', headline: 'How much do I need to relocate?', detail: 'Kenya · Portugal · UAE — cost, tax, residency', action: 'ASK SONU', tone: 'sonu' },
  { emoji: '🏠', headline: 'What if I moved to a bigger house?', detail: 'Stamp duty, mortgage impact, equity', action: 'ASK SONU', tone: 'sonu' },
  { emoji: '🛌', headline: 'What if I retired 5 years earlier?', detail: 'Pension drawdown — cashflow, Score, IHT', action: 'INSTANT', tone: 'instant' },
  { emoji: '👨‍👩', headline: 'What if I went part-time or took a break?', detail: 'Runway, monthly shortfall, when to return', action: 'INSTANT', tone: 'instant' },
  { emoji: '🎓', headline: 'What if I helped my children get started?', detail: 'Gifting, trust, mortgage — IHT impact', action: 'ASK SONU', tone: 'sonu' },
];

// ─── SVG RADAR (7-dim hexagon variant) ───────────────────────────────────────
function buildRadarSVG() {
  const cx = 250, cy = 250, rMax = 170;
  const dims = DIMS;
  const angles = dims.map((_, i) => (-Math.PI / 2) + (i * 2 * Math.PI / dims.length));

  // Helper: point at given dim index and value (0..100)
  const ptAt = (i, v) => {
    const r = (v / 100) * rMax;
    return [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
  };

  // Concentric guide rings
  const rings = [25, 50, 75, 100].map(pct => {
    const points = dims.map((_, i) => {
      const r = (pct / 100) * rMax;
      return `${(cx + r * Math.cos(angles[i])).toFixed(1)},${(cy + r * Math.sin(angles[i])).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${points}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
  }).join('');

  // Axis lines
  const axes = dims.map((_, i) => {
    const [x, y] = ptAt(i, 100);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
  }).join('');

  // Target polygon (dashed)
  const targetPts = dims.map((d, i) => {
    const [x, y] = ptAt(i, d.target);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const targetPoly = `<polygon points="${targetPts}" fill="none" stroke="#FFB547" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.75"/>`;

  // Actual polygon (filled teal)
  const actualPts = dims.map((d, i) => {
    const [x, y] = ptAt(i, d.score);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const actualPoly = `<polygon points="${actualPts}" fill="rgba(0,229,168,0.18)" stroke="#00E5A8" stroke-width="2"/>`;

  // Vertex circles + label boxes
  const vertices = dims.map((d, i) => {
    const [x, y] = ptAt(i, d.score);
    const dot = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#00E5A8"/>`;
    // Label position — push outward from center
    const [lx, ly] = ptAt(i, 100 + (d.gap ? 32 : 25));
    const labelColor = d.gap ? '#FF6B6B' : '#e8eaf0';
    const borderColor = d.gap ? '#FF6B6B' : 'rgba(255,255,255,0.12)';
    const w = 78, h = 36;
    const labelHtml = `
      <g transform="translate(${(lx - w/2).toFixed(1)} ${(ly - h/2).toFixed(1)})">
        <rect width="${w}" height="${h}" rx="8" fill="#131726" stroke="${borderColor}" stroke-width="1"/>
        <text x="${w/2}" y="15" text-anchor="middle" fill="${labelColor}" font-size="9" font-weight="600" letter-spacing="0.04em">${esc(d.name.toUpperCase())}</text>
        <text x="${w/2}" y="29" text-anchor="middle" fill="${labelColor}" font-size="13" font-weight="700">${d.score}</text>
      </g>
    `;
    const gapBadge = d.gap ? `<circle cx="${(lx + w/2 - 6).toFixed(1)}" cy="${(ly - h/2 + 6).toFixed(1)}" r="8" fill="#FF6B6B"/><text x="${(lx + w/2 - 6).toFixed(1)}" y="${(ly - h/2 + 9).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">${d.gapCount}</text>` : '';
    return dot + labelHtml + gapBadge;
  }).join('');

  // Center stats
  const centerHtml = `
    <text x="${cx}" y="${cy - 14}" text-anchor="middle" fill="#9aa0b4" font-size="10" font-weight="500" letter-spacing="0.08em">NET WORTH</text>
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#e8eaf0" font-size="22" font-weight="700">£3.90M</text>
    <text x="${cx}" y="${cy + 28}" text-anchor="middle" fill="#9aa0b4" font-size="10" font-weight="500" letter-spacing="0.08em">WEALTH SCORE</text>
    <text x="${cx}" y="${cy + 48}" text-anchor="middle" fill="#00E5A8" font-size="20" font-weight="700">69 OPTIMISED</text>
    <text x="${cx}" y="${cy + 66}" text-anchor="middle" fill="#6a7088" font-size="9" font-weight="500" letter-spacing="0.10em">TARGET: LIFE STAGE</text>
  `;

  return `<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;max-height:480px">
    ${rings}
    ${axes}
    ${targetPoly}
    ${actualPoly}
    ${vertices}
    ${centerHtml}
  </svg>`;
}

function buildSparkline(direction = 'up', color = '#00E5A8') {
  // Cheap inline sparkline — 5 points
  const w = 60, h = 20;
  const points = direction === 'up'
    ? [[0,15],[15,12],[30,10],[45,6],[60,3]]
    : direction === 'down'
    ? [[0,5],[15,7],[30,11],[45,14],[60,17]]
    : [[0,10],[15,9],[30,11],[45,8],[60,7]];
  const path = points.map((p,i) => (i===0?'M':'L') + p[0] + ' ' + p[1]).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${path}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
}

function buildCircularDial(value, max = 100, color = '#00E5A8', size = 56) {
  const r = (size - 8) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / max);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="4"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cx})"/>
    <text x="${cx}" y="${cx + 2}" text-anchor="middle" dominant-baseline="middle"
          fill="#e8eaf0" font-size="14" font-weight="700">${value}</text>
  </svg>`;
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
const annualGain = lensData.recommendations.reduce((s, r) => s + (r.impact?.gbp_per_year || 0), 0);
const lifetimeGain = lensData.recommendations.reduce((s, r) => s + (r.impact?.gbp_lifetime || 0), 0);

// Sub-tile HTML
const subTilesHtml = STATE_TILES.map(t => {
  const sparkColor = t.tone === 'good' ? '#00E5A8' : (t.tone === 'warn' ? '#FFB547' : '#FF6B6B');
  const sparkDir = t.tone === 'good' ? 'up' : (t.tone === 'warn' ? 'flat' : 'down');
  return `
    <div class="state-tile">
      <div class="state-tile-top">
        <div class="state-tile-label">${esc(t.label)}</div>
        ${buildSparkline(sparkDir, sparkColor)}
      </div>
      <div class="state-tile-pct">${t.pct}% ${t.arrow ? `<span class="arrow">${t.arrow}</span>` : ''}</div>
      <div class="state-tile-status" style="color:${t.statusColor}">${esc(t.status)}</div>
      <div class="state-tile-text">${esc(t.text)}</div>
    </div>
  `;
}).join('');

// Top KPI cards
const kpiHtml = `
  <div class="kpi-card">
    <div class="kpi-header">
      <span class="kpi-label">NET WORTH ·</span>
      ${buildSparkline('up', '#00E5A8')}
    </div>
    <div class="kpi-value">£3.90M</div>
    <div class="kpi-allocation">
      <div class="kpi-bar-row">
        <div class="kpi-bar" style="width:21%;background:#00E5A8"></div>
        <div class="kpi-bar" style="width:10%;background:#FFB547"></div>
        <div class="kpi-bar" style="width:55%;background:#4D8EFF"></div>
        <div class="kpi-bar" style="width:4%;background:#9aa0b4"></div>
        <div class="kpi-bar" style="width:9%;background:#a78bfa"></div>
      </div>
      <div class="kpi-legend">
        <span><span class="dot" style="background:#00E5A8"></span>Pensions 21%</span>
        <span><span class="dot" style="background:#FFB547"></span>ISA 10%</span>
        <span><span class="dot" style="background:#4D8EFF"></span>Home 55%</span>
        <span><span class="dot" style="background:#9aa0b4"></span>Cash 4%</span>
      </div>
      <div class="kpi-legend"><span><span class="dot" style="background:#a78bfa"></span>Investments 9%</span></div>
    </div>
  </div>

  <div class="kpi-card">
    <div class="kpi-header">
      <span class="kpi-label">WEALTH SCORE</span>
      ${buildSparkline('up')}
    </div>
    <div class="kpi-dial-row">
      ${buildCircularDial(69, 100, '#00E5A8', 80)}
      <div>
        <div class="kpi-dial-val"><span class="big">69</span><span class="small">/100</span></div>
        <div class="kpi-dial-band" style="color:#00E5A8">OPTIMISED</div>
      </div>
    </div>
    <div class="kpi-tag tag-warn">⚠ 1 gap in radar →</div>
  </div>

  <div class="kpi-card">
    <div class="kpi-header">
      <span class="kpi-label">RISK SCORE</span>
      ${buildSparkline('up')}
    </div>
    <div class="kpi-dial-row">
      ${buildCircularDial(71, 100, '#a78bfa', 80)}
      <div>
        <div class="kpi-dial-val"><span class="big">71</span><span class="small">/100</span></div>
        <div class="kpi-dial-band" style="color:#a78bfa">PROTECTED</div>
      </div>
    </div>
    <div class="kpi-bar-row"><div class="kpi-bar" style="width:71%;background:linear-gradient(90deg,#a78bfa,#00E5A8)"></div></div>
  </div>

  <div class="kpi-card">
    <div class="kpi-header">
      <span class="kpi-label">COST OF INACTION</span>
      ${buildSparkline('down', '#FF6B6B')}
    </div>
    <div class="kpi-value coi">£412k</div>
    <div class="kpi-coi-sub">
      <div class="coi-days">320 days to act</div>
      <div class="coi-dates"><span>Mar 2026</span><span>6 Apr 2027</span></div>
    </div>
  </div>
`;

// What to do next
const todoHtml = TODO_ITEMS.map(t => {
  const sev = t.severity;
  const sevColor = sev === 'CRIT' ? '#FF6B6B' : (sev === 'HIGH' ? '#FFB547' : '#4D8EFF');
  return `
    <a class="todo-item" href="#rec-${t.recId || 'all'}">
      <span class="todo-sev" style="background:${sevColor}22;color:${sevColor}">${sev}</span>
      <span class="todo-label">${esc(t.label)}</span>
      <span class="todo-delta">${esc(t.delta)} ›</span>
    </a>
  `;
}).join('');

// What-If cards
const whatifHtml = WHATIF_CARDS.map(w => {
  const tagColor = w.tone === 'instant' ? '#00E5A8' : '#FFB547';
  return `
    <button class="whatif-card" onclick="document.getElementById('modal-whatif').classList.add('open')">
      <span class="whatif-emoji">${w.emoji}</span>
      <span class="whatif-body">
        <span class="whatif-headline">${esc(w.headline)}</span>
        <span class="whatif-detail">${esc(w.detail)}</span>
      </span>
      <span class="whatif-action" style="background:${tagColor}22;color:${tagColor}">${esc(w.action)}</span>
    </button>
  `;
}).join('');

// Lens drill-down for "Tax & Estate" expandable section
const lensObsHtml = lensData.observations.map(o => `
  <div class="lens-obs" data-severity="${o.severity}">
    <span class="lens-obs-sev">${o.severity === 3 ? 'HIGH' : o.severity === 2 ? 'MED' : 'LOW'}</span>
    <div>
      <div class="lens-obs-text">${esc(o.text)}</div>
      <div class="lens-obs-cite">${esc(o.citation)}</div>
    </div>
  </div>
`).join('');

const lensRecHtml = lensData.recommendations.map((r, i) => {
  const annual = r.impact?.gbp_per_year;
  const lifetime = r.impact?.gbp_lifetime;
  const impactVal = annual ? fmt(annual) : (lifetime ? fmt(lifetime) : '—');
  const impactPeriod = annual ? '/yr' : (lifetime ? 'lifetime' : '');
  const steps = (r.action_steps || []).map(s => `<li>${esc(s)}</li>`).join('');
  return `
    <details class="lens-rec" id="rec-${r.id}">
      <summary>
        <div class="lens-rec-headline">${esc(r.headline)}</div>
        <div class="lens-rec-impact"><span class="big">${impactVal}</span> <span class="period">${impactPeriod}</span></div>
      </summary>
      <div class="lens-rec-body">
        <p>${esc(r.drill_down)}</p>
        <div class="lens-rec-label">Action steps</div>
        <ol>${steps}</ol>
        <div class="lens-rec-fca">${esc(r.fca_boundary)}</div>
        <div class="lens-rec-foot">
          <span class="lens-rec-cite">${esc(r.citation)}</span>
          <button class="challenge-btn" onclick="document.getElementById('modal-challenge').classList.add('open')">⚠ Challenge</button>
        </div>
      </div>
    </details>
  `;
}).join('');

// ─── BUILD HTML ──────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sonuswealth · Bruce Wayne</title>
<style>
:root{
  --bg:#0a0e1a; --surface:#131726; --surface-2:#1a1f33; --surface-3:#222842;
  --border:rgba(255,255,255,0.08); --border-2:rgba(255,255,255,0.14);
  --text:#e8eaf0; --text-dim:#9aa0b4; --text-faint:#6a7088;
  --accent:#00E5A8; --accent-dim:#00b388;
  --purple:#a78bfa; --gold:#E6C547; --warn:#FFB547; --danger:#FF6B6B; --info:#4D8EFF;
}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px}

/* APP SHELL */
.app{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.sidebar{background:var(--surface);border-right:1px solid var(--border);padding:24px 0;position:sticky;top:0;height:100vh}
.brand{padding:0 24px 24px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)}
.brand-logo{width:36px;height:36px;background:linear-gradient(135deg,#4338ca,#a78bfa);border-radius:10px;display:grid;place-items:center;font-weight:800;color:#fff;font-size:18px;letter-spacing:-0.04em}
.brand-name{font-size:16px;font-weight:600;letter-spacing:-0.01em}
.brand-tag{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.10em;margin-top:2px}
.nav{padding:14px 14px;display:flex;flex-direction:column;gap:2px}
.nav-item{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:8px;color:var(--text-dim);text-decoration:none;font-size:13px;font-weight:500;cursor:pointer;border:none;background:transparent;text-align:left;width:100%}
.nav-item:hover{background:var(--surface-2);color:var(--text)}
.nav-item.active{background:var(--surface-2);color:var(--text)}
.nav-item.active::before{content:'';width:3px;height:18px;background:var(--accent);border-radius:2px;position:absolute;margin-left:-14px}
.nav-icon{font-size:14px;opacity:0.85}

/* MAIN AREA */
.main{padding:24px 32px 100px;overflow-x:hidden}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--border)}
.tagline{display:flex;align-items:center;gap:14px}
.tagline-logo{width:44px;height:44px;background:linear-gradient(135deg,#4338ca,#a78bfa);border-radius:12px;display:grid;place-items:center;font-weight:800;color:#fff;font-size:20px;letter-spacing:-0.04em;flex-shrink:0}
.tagline-text h1{margin:0;font-size:20px;font-weight:600;letter-spacing:-0.01em}
.tagline-text p{margin:2px 0 0;font-size:13px;color:var(--text-dim)}
.topbar-right{display:flex;align-items:center;gap:10px}
.user-chip{display:flex;align-items:center;gap:10px;padding:7px 12px;background:var(--surface);border:1px solid var(--border);border-radius:999px}
.user-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4338ca,#a78bfa);display:grid;place-items:center;font-weight:600;font-size:11px;color:#fff}
.user-score{display:flex;flex-direction:column;line-height:1.1}
.user-score-val{font-weight:700;font-size:14px;color:var(--accent)}
.user-score-band{font-size:9px;color:var(--text-dim);letter-spacing:0.08em}
.icon-btn{width:36px;height:36px;border:1px solid var(--border);border-radius:50%;background:var(--surface);color:var(--text-dim);cursor:pointer;display:grid;place-items:center;font-size:14px}
.icon-btn:hover{border-color:var(--border-2);color:var(--text)}

/* GREETING + TIME TABS */
.greet-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:18px;flex-wrap:wrap}
.greet{display:flex;align-items:center;gap:14px}
.greet-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#92400e,#FFB547);display:grid;place-items:center;font-weight:700;color:#fff;font-size:16px}
.greet-text-1{font-size:13px;color:var(--text-dim)}
.greet-text-2{font-size:22px;font-weight:600;letter-spacing:-0.01em}
.time-tabs{display:flex;gap:4px;background:var(--surface);padding:4px;border-radius:999px;border:1px solid var(--border)}
.time-tab{padding:9px 18px;border-radius:999px;background:transparent;border:none;color:var(--text-dim);font-size:12px;font-weight:600;letter-spacing:0.04em;cursor:pointer}
.time-tab.active{background:var(--gold);color:#1a1f33}

/* KPI ROW */
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.kpi-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;min-height:150px;display:flex;flex-direction:column}
.kpi-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.kpi-label{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.10em;font-weight:600}
.kpi-value{font-size:30px;font-weight:700;letter-spacing:-0.02em;margin:4px 0 12px}
.kpi-value.coi{color:var(--danger)}
.kpi-allocation{margin-top:auto}
.kpi-bar-row{display:flex;height:6px;border-radius:3px;overflow:hidden;background:var(--surface-2);margin-bottom:8px}
.kpi-bar{height:100%}
.kpi-legend{display:flex;gap:12px;font-size:10px;color:var(--text-dim);flex-wrap:wrap;margin-bottom:4px}
.kpi-legend .dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;vertical-align:middle}
.kpi-dial-row{display:flex;align-items:center;gap:14px;margin-bottom:8px}
.kpi-dial-val{font-size:22px;font-weight:700}
.kpi-dial-val .big{}
.kpi-dial-val .small{color:var(--text-faint);font-size:14px;font-weight:500}
.kpi-dial-band{font-size:11px;font-weight:700;letter-spacing:0.10em;margin-top:2px}
.kpi-tag{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:500;align-self:flex-start;margin-top:auto}
.tag-warn{background:rgba(255,181,71,0.12);color:var(--warn)}
.kpi-coi-sub{margin-top:auto}
.coi-days{font-size:11px;color:var(--text-dim);margin-bottom:6px}
.coi-dates{display:flex;justify-content:space-between;font-size:10px;color:var(--text-faint)}
.coi-dates span:last-child{color:var(--danger)}

/* STATE TILES ROW */
.tiles-row{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:8px;overflow-x:auto;padding-bottom:6px}
.state-tile{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;min-width:0}
.state-tile-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.state-tile-label{font-size:9px;font-weight:700;color:var(--text-faint);letter-spacing:0.10em}
.state-tile-pct{font-size:20px;font-weight:700;letter-spacing:-0.01em;margin-bottom:2px}
.state-tile-pct .arrow{font-size:14px;color:var(--accent);font-weight:600;margin-left:2px}
.state-tile-status{font-size:9px;font-weight:700;letter-spacing:0.10em;margin-bottom:6px}
.state-tile-text{font-size:11px;color:var(--text-dim);line-height:1.5}
.tiles-dots{display:flex;justify-content:center;gap:6px;margin:14px 0 28px}
.tiles-dots span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.12)}
.tiles-dots span.active{background:var(--text-dim)}

/* MAIN GRID — RADAR + RIGHT PANEL */
.main-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;margin-bottom:28px}
.radar-panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px 24px 20px;position:relative}
.radar-panel-head{display:flex;justify-content:space-between;align-items:start;margin-bottom:14px}
.radar-title{font-size:10px;font-weight:700;color:var(--text-faint);letter-spacing:0.10em;margin-bottom:4px}
.radar-sub{font-size:13px;color:var(--text-dim)}
.radar-svg-wrap{display:grid;place-items:center;padding:0 30px}
.radar-footer{display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:18px;flex-wrap:wrap}
.radar-hint{font-size:11px;color:var(--text-dim);line-height:1.5}
.radar-hint strong{color:var(--text)}
.radar-legend{display:flex;gap:12px;font-size:11px;color:var(--text-dim)}
.radar-legend-item{display:flex;align-items:center;gap:5px}
.legend-swatch{width:14px;height:6px;border-radius:2px}

.right-panel{display:flex;flex-direction:column;gap:18px}
.action-block{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 22px}
.action-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.action-title{font-size:10px;font-weight:700;color:var(--text-faint);letter-spacing:0.10em}
.action-link{font-size:11px;color:var(--text-dim);text-decoration:none}
.action-link:hover{color:var(--accent)}

.todo-list{display:flex;flex-direction:column;gap:6px}
.todo-item{display:grid;grid-template-columns:60px 1fr auto;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border);text-decoration:none;color:var(--text);transition:border-color 0.12s}
.todo-item:hover{border-color:var(--border-2)}
.todo-sev{font-size:9px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.06em;text-align:center}
.todo-label{font-size:13px;font-weight:500}
.todo-delta{font-size:12px;color:var(--text-dim);font-weight:600}

.whatif-list{display:flex;flex-direction:column;gap:8px}
.whatif-card{display:grid;grid-template-columns:32px 1fr auto;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border);cursor:pointer;text-align:left;font-family:inherit;color:var(--text);transition:border-color 0.12s}
.whatif-card:hover{border-color:var(--accent)}
.whatif-emoji{font-size:20px}
.whatif-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.whatif-headline{font-size:13px;font-weight:500;color:var(--text)}
.whatif-detail{font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.whatif-action{font-size:9px;font-weight:700;padding:4px 9px;border-radius:6px;letter-spacing:0.08em}
.whatif-disclaimer{font-size:10px;color:var(--text-faint);margin-top:8px;text-align:right;font-style:italic}

/* LENS DEEP-DIVE PANEL */
.lens-section{margin-top:28px}
.lens-section-head{display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)}
.lens-section-avatar{width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.06);display:grid;place-items:center;font-size:24px}
.lens-section-title{font-size:18px;font-weight:600;letter-spacing:-0.01em}
.lens-section-sub{font-size:12px;color:var(--text-dim);margin-top:2px}
.lens-status-pill{margin-left:auto;padding:4px 10px;border-radius:10px;background:rgba(0,229,168,0.12);color:var(--accent);font-size:10px;font-weight:700;letter-spacing:0.08em}

.lens-savings{display:flex;gap:28px;margin-bottom:24px;padding:16px 20px;background:linear-gradient(135deg,rgba(0,229,168,0.06),rgba(167,139,250,0.06));border:1px solid var(--border);border-radius:12px}
.lens-savings-item{line-height:1.2}
.lens-savings-val{font-size:22px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.lens-savings-lbl{font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;margin-top:3px}

.lens-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.lens-col-title{font-size:10px;font-weight:700;color:var(--text-faint);letter-spacing:0.10em;margin-bottom:10px}
.lens-obs-list,.lens-rec-list{display:flex;flex-direction:column;gap:8px}
.lens-obs{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:grid;grid-template-columns:auto 1fr;gap:12px;border-left:3px solid var(--text-faint)}
.lens-obs[data-severity="3"]{border-left-color:var(--danger)}
.lens-obs[data-severity="2"]{border-left-color:var(--warn)}
.lens-obs[data-severity="1"]{border-left-color:var(--info)}
.lens-obs-sev{font-size:9px;font-weight:700;padding:3px 7px;border-radius:4px;letter-spacing:0.06em;background:rgba(255,255,255,0.06);color:var(--text-dim);align-self:start;min-width:38px;text-align:center}
.lens-obs[data-severity="3"] .lens-obs-sev{background:rgba(255,107,107,0.16);color:var(--danger)}
.lens-obs[data-severity="2"] .lens-obs-sev{background:rgba(255,181,71,0.16);color:var(--warn)}
.lens-obs[data-severity="1"] .lens-obs-sev{background:rgba(77,142,255,0.16);color:var(--info)}
.lens-obs-text{font-size:12.5px;line-height:1.55}
.lens-obs-cite{font-size:10px;color:var(--text-faint);margin-top:6px;font-family:ui-monospace,'SF Mono',monospace}

.lens-rec{background:var(--surface);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color 0.12s}
.lens-rec:hover,.lens-rec[open]{border-color:rgba(0,229,168,0.4)}
.lens-rec summary{padding:14px 16px;display:flex;justify-content:space-between;align-items:start;gap:12px;list-style:none;cursor:pointer}
.lens-rec summary::-webkit-details-marker{display:none}
.lens-rec-headline{font-size:13.5px;font-weight:600;line-height:1.4}
.lens-rec-impact{text-align:right;white-space:nowrap}
.lens-rec-impact .big{font-size:16px;font-weight:700;color:var(--accent)}
.lens-rec-impact .period{font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-top:2px}
.lens-rec-body{padding:0 16px 16px;font-size:12.5px;color:var(--text-dim);line-height:1.6;border-top:1px solid var(--border);padding-top:12px;margin-top:0}
.lens-rec-body p{margin:0 0 12px}
.lens-rec-label{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.08em;margin:14px 0 6px}
.lens-rec-body ol{margin:0;padding-left:20px}
.lens-rec-body ol li{margin-bottom:5px;font-size:12px}
.lens-rec-fca{padding:8px 12px;background:rgba(77,142,255,0.06);border-left:2px solid var(--info);border-radius:6px;font-size:11px;font-style:italic;margin-top:14px}
.lens-rec-foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);gap:8px}
.lens-rec-cite{font-size:10px;color:var(--text-faint);font-family:ui-monospace,'SF Mono',monospace}
.challenge-btn{padding:6px 12px;font-size:11px;border-radius:6px;background:transparent;border:1px solid var(--border);color:var(--text-dim);cursor:pointer}
.challenge-btn:hover{border-color:var(--warn);color:var(--warn)}

/* ASK SONU BAR */
.ask-bar{position:fixed;bottom:0;left:240px;right:0;background:linear-gradient(180deg,transparent,var(--bg) 30%);padding:18px 32px;display:flex;align-items:center;gap:12px;z-index:50}
.ask-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:14px 22px;display:flex;align-items:center;gap:12px;cursor:pointer}
.ask-input:hover{border-color:var(--border-2)}
.ask-icon{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4338ca,#a78bfa);display:grid;place-items:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
.ask-prompt{color:var(--text);font-size:14px;font-weight:500}
.ask-sub{color:var(--text-faint);font-size:12px;display:block}
.ask-send{width:44px;height:44px;border-radius:50%;background:var(--surface);border:1px solid var(--border);color:var(--text);cursor:pointer;font-size:16px;flex-shrink:0}
.ask-send:hover{border-color:var(--accent);color:var(--accent)}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:24px;z-index:200}
.modal-bg.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px 32px;max-width:520px;width:100%}
.modal-title{font-size:18px;font-weight:600;margin-bottom:14px;letter-spacing:-0.01em}
.modal-body{font-size:13.5px;color:var(--text-dim);line-height:1.6;margin-bottom:20px}
.modal-actions{display:flex;gap:10px;justify-content:flex-end}
.btn{padding:10px 18px;border-radius:8px;border:none;background:var(--accent);color:#001a14;font-weight:600;cursor:pointer;font-size:13px}
.btn-ghost{background:transparent;color:var(--text);border:1px solid var(--border)}

/* RESPONSIVE */
@media(max-width:1100px){
  .kpi-row{grid-template-columns:repeat(2,1fr)}
  .tiles-row{grid-template-columns:repeat(3,1fr)}
  .main-grid{grid-template-columns:1fr}
  .lens-grid{grid-template-columns:1fr}
}
@media(max-width:760px){
  .app{grid-template-columns:1fr}
  .sidebar{display:none}
  .main{padding:18px 16px 100px}
  .topbar{flex-direction:column;align-items:flex-start;gap:14px}
  .kpi-row{grid-template-columns:1fr}
  .tiles-row{grid-template-columns:repeat(2,1fr)}
  .ask-bar{left:0;padding:16px}
}
</style>
</head>
<body>
<div class="app">

  <aside class="sidebar">
    <div class="brand">
      <div class="brand-logo">S</div>
      <div>
        <div class="brand-name">Sonuswealth</div>
        <div class="brand-tag">Premium management</div>
      </div>
    </div>
    <nav class="nav">
      <button class="nav-item active"><span class="nav-icon">⌂</span>Overview</button>
      <button class="nav-item"><span class="nav-icon">💷</span>My Money</button>
      <button class="nav-item"><span class="nav-icon">📈</span>Cashflow</button>
      <button class="nav-item"><span class="nav-icon">⚖</span>Tax &amp; Estate</button>
      <button class="nav-item"><span class="nav-icon">🛡</span>Risk</button>
      <button class="nav-item"><span class="nav-icon">⏱</span>Timeline</button>
    </nav>
  </aside>

  <main class="main">

    <header class="topbar">
      <div class="tagline">
        <div class="tagline-logo">S</div>
        <div class="tagline-text">
          <h1>Sonuswealth</h1>
          <p>Your wealth, in one place.</p>
        </div>
      </div>
      <div class="topbar-right">
        <div class="user-chip">
          <div class="user-avatar">BW</div>
          <div class="user-score">
            <div class="user-score-val">69</div>
            <div class="user-score-band">OPTIMISED</div>
          </div>
        </div>
        <button class="icon-btn" title="Filter">◐</button>
        <button class="icon-btn" title="Notifications">⋯</button>
        <button class="icon-btn" title="Settings">⚙</button>
      </div>
    </header>

    <div class="greet-row">
      <div class="greet">
        <div class="greet-avatar">BR</div>
        <div>
          <div class="greet-text-1">Good evening,</div>
          <div class="greet-text-2">Bruce · Thu 21 May</div>
        </div>
      </div>
      <div class="time-tabs">
        <button class="time-tab active">TODAY</button>
        <button class="time-tab">FUTURE</button>
        <button class="time-tab">PLAN</button>
        <button class="time-tab">WHAT IF</button>
      </div>
    </div>

    <div class="kpi-row">${kpiHtml}</div>

    <div class="tiles-row">${subTilesHtml}</div>
    <div class="tiles-dots"><span class="active"></span><span></span><span></span><span></span><span></span><span></span></div>

    <div class="main-grid">

      <div class="radar-panel">
        <div class="radar-panel-head">
          <div>
            <div class="radar-title">YOUR WEALTH SHAPE</div>
            <div class="radar-sub">7 dimensions · today vs target</div>
          </div>
          <button class="icon-btn">›</button>
        </div>
        <div class="radar-svg-wrap">${buildRadarSVG()}</div>
        <div class="radar-footer">
          <div class="radar-hint"><strong>TODAY</strong> 2 dimensions below target. Tap a coral mark or weak node to see what's missing.</div>
          <div class="radar-legend">
            <div class="radar-legend-item"><div class="legend-swatch" style="background:repeating-linear-gradient(90deg,#FFB547 0,#FFB547 4px,transparent 4px,transparent 8px)"></div>Target</div>
            <div class="radar-legend-item"><div class="legend-swatch" style="background:#00E5A8"></div>Where you are</div>
            <div class="radar-legend-item"><div class="legend-swatch" style="background:#FF6B6B;border-radius:50%;width:8px;height:8px"></div>2 gaps</div>
          </div>
        </div>
      </div>

      <div class="right-panel">

        <div class="action-block">
          <div class="action-head">
            <div class="action-title">WHAT TO DO NEXT</div>
            <a href="#lens-section" class="action-link">See all ${TODO_ITEMS.length} →</a>
          </div>
          <div class="todo-list">${todoHtml}</div>
        </div>

        <div class="action-block">
          <div class="action-head">
            <div class="action-title">⚡ WHAT IF?</div>
            <span class="action-link">Explore · not advice</span>
          </div>
          <div class="whatif-list">${whatifHtml}</div>
        </div>

      </div>

    </div>

    <!-- LENS DEEP-DIVE — Tax Accountant -->
    <section class="lens-section" id="lens-section">
      <div class="lens-section-head">
        <div class="lens-section-avatar">🧾</div>
        <div>
          <div class="lens-section-title">Tax Accountant view</div>
          <div class="lens-section-sub">A UK Chartered Tax Adviser reviewing your annual position · 1 of 11 professional lenses available</div>
        </div>
        <div class="lens-status-pill">LIVE</div>
      </div>

      <div class="lens-savings">
        <div class="lens-savings-item">
          <div class="lens-savings-val">${fmt(annualGain)}/yr</div>
          <div class="lens-savings-lbl">Annual saving available</div>
        </div>
        <div class="lens-savings-item">
          <div class="lens-savings-val">${fmt(lifetimeGain)}</div>
          <div class="lens-savings-lbl">Lifetime saving available</div>
        </div>
        <div class="lens-savings-item">
          <div class="lens-savings-val">${lensData.recommendations.length}</div>
          <div class="lens-savings-lbl">Strategies</div>
        </div>
      </div>

      <div class="lens-grid">
        <div>
          <div class="lens-col-title">WHAT YOUR TAX ACCOUNTANT NOTICED (${lensData.observations.length})</div>
          <div class="lens-obs-list">${lensObsHtml}</div>
        </div>
        <div>
          <div class="lens-col-title">STRATEGIES RANKED BY IMPACT (${lensData.recommendations.length} — tap to expand)</div>
          <div class="lens-rec-list">${lensRecHtml}</div>
        </div>
      </div>
    </section>

    <div style="margin-top:60px;padding-top:24px;border-top:1px solid var(--border);font-size:11px;color:var(--text-faint);line-height:1.7;text-align:center">
      Sonuswealth lens-based AI · designed to run 11 professional perspectives. Tax Accountant LIVE today. Pension Specialist · Trust Lawyer · IFA · Mortgage · Protection · Investment · Cross-Border · Family Law · Later-Life · Philanthropy ship in subsequent releases. Where lenses disagree, the app surfaces the disagreement and lets the user decide.<br><br>
      Not regulated financial advice. Verify decisions with a qualified UK financial adviser.<br>
      Rules: UK-2026.1 · Last verified: April 2026 · Engine version Sonuswealth-1.0 · Generated: ${new Date().toISOString().slice(0,16).replace('T',' ')}
    </div>

  </main>

  <div class="ask-bar">
    <div class="ask-input" onclick="document.getElementById('modal-whatif').classList.add('open')">
      <div class="ask-icon">S</div>
      <div>
        <div class="ask-prompt">Ask Sonu</div>
        <div class="ask-sub">Ask about your Wealth Score, run a what-if, or challenge any recommendation…</div>
      </div>
    </div>
    <button class="ask-send" title="Send">→</button>
  </div>

</div>

<!-- WHAT-IF / ASK SONU MODAL -->
<div class="modal-bg" id="modal-whatif" onclick="if(event.target.id==='modal-whatif')this.classList.remove('open')">
  <div class="modal">
    <div class="modal-title">Ask Sonu (coming v0.1)</div>
    <div class="modal-body">
      The full dialogue loop wires through the Sonuswealth Decision Engine — your question runs through the same 11-lens system that produced this dashboard.
      <br><br>
      <strong>Today's preview</strong> shows the architecture: every recommendation has a citation, an FCA boundary, a flip-condition, and a challenge button. Multi-lens synthesis, dynamic charts, and live Sonu dialogue ship next sprint.
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="document.getElementById('modal-whatif').classList.remove('open')">Close</button>
    </div>
  </div>
</div>

<!-- CHALLENGE MODAL -->
<div class="modal-bg" id="modal-challenge" onclick="if(event.target.id==='modal-challenge')this.classList.remove('open')">
  <div class="modal">
    <div class="modal-title">Challenge this recommendation</div>
    <div class="modal-body">
      Coming in v0.1: practitioner panel review. Your challenge would be logged, reviewed within 7 days, and — if valid — the rule updated and versioned. Rule updates carry forward to every user automatically. All challenges audit-trailed.
      <br><br>
      <strong>For today's demo:</strong> this affordance proves the mechanism exists. Submission queue ships next sprint.
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="document.getElementById('modal-challenge').classList.remove('open')">Close</button>
    </div>
  </div>
</div>

</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'demo.html'), html);
console.log('Generated demo.html (' + html.length.toLocaleString() + ' bytes)');
console.log('Open: file:///' + path.join(ROOT, 'demo.html').replace(/\\/g, '/'));
