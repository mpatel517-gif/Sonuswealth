// Visual-QA detector — paste into preview_eval after any UI change, on each route,
// at 375 / 768 / 1280 viewports. Empty `issues` array = pass. Founder 2026-06-06.
(() => {
  const issues = [];
  const vw = window.innerWidth;
  // 1. Elements overflowing their own box (horizontal)
  document.querySelectorAll('*').forEach(el => {
    if (el.scrollWidth - el.clientWidth > 2 && el.clientWidth > 40) {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (t) issues.push({ kind: 'overflow', text: t, scroll: el.scrollWidth, client: el.clientWidth });
    }
  });
  // 2. SVG <text> rendered outside its nearest svg/card container (clipped labels)
  document.querySelectorAll('svg text').forEach(t => {
    const box = t.getBoundingClientRect();
    const card = t.closest('.sw-card, svg');
    if (!card) return;
    const cb = card.getBoundingClientRect();
    if (box.right > cb.right + 1 || box.left < cb.left - 1) {
      issues.push({ kind: 'svg-text-clip', text: (t.textContent || '').slice(0, 30), right: Math.round(box.right), edge: Math.round(cb.right) });
    }
  });
  // 3. Cards wider than the viewport (page-level horizontal scroll)
  document.querySelectorAll('.sw-card, .sw-tile, [class*=card]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 2) issues.push({ kind: 'past-viewport', text: (el.innerText || '').slice(0, 30), right: Math.round(r.right), vw });
  });
  return JSON.stringify({ count: issues.length, issues: issues.slice(0, 25) }, null, 1);
})()
