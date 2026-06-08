# Visual-QA checklist — run BEFORE declaring any UI surface "done"

**Why this exists (founder, 2026-06-06):** "How can we avoid going back and forth on these small issues — you are not checking against a predefined checklist." Build-passing + a glance at a screenshot is NOT enough. The recurring misses are *formatting*: clipped value labels ("+£8" for +£83k), duplicated captions, overflow at narrow widths. This checklist + the automated detector below catch them mechanically.

This sits **above** taking a screenshot and **below** CLAUDE.md §9.5 (which covers snaps + numeric tie-outs). Run BOTH the detector (§G) and the human checks (§A–F) on every changed surface, at 375 / 768 / 1280 × light + dark, on Bruce (`?demo=a`) AND Mr T (`?demo=mrt-core`). If any line fails, it is not done.

## A. Text & labels
- [ ] No text clipped or cut off — including SVG/chart labels and **value labels** (a "+£8" where the number is +£83k is a FAIL).
- [ ] **Labels placed UNIFORMLY** — within one chart/list, value labels share one position + style (e.g. all in a right column, or all outside the bars) — never some inside-the-bar and some outside. The §G detector checks clipping, NOT placement consistency; this needs a critical eye on the rendered result.
- [ ] No label/heading duplicated (the same caption shown twice in one card).
- [ ] No two labels for the same thing that disagree (e.g. card subtitle "Cash freed up" but chart caption "Net-worth change").
- [ ] Consistent casing for the same concept (don't mix Title Case and UPPERCASE for one label).
- [ ] Plain English — every abbreviation glossed (PPR/§24/BPR/MPAA/CGT/IHT/DB→DC). No raw jargon on the surface.
- [ ] No trailing artefacts ("years..", double spaces, stray punctuation).

## B. Charts (every chart, every time)
- [ ] Both axes labelled with their unit; the caption appears **once**.
- [ ] Every bar/point value label is **fully visible** (long bars: label moves inside the bar, not off the edge).
- [ ] Negatives handled — colour + direction + a labelled zero/"today" baseline.
- [ ] Range/uncertainty shown as labelled scenarios where the future is uncertain (not one confident line).
- [ ] Net rate (after charges/inflation) stated where it's a money projection.
- [ ] Two charts of the same quantity tie out to the same number.
- [ ] Legible in light AND dark (theme tokens only; no hard-coded colours that vanish in one theme).
- [ ] **Type scale MATCHES the surrounding section.** A chart should not look bigger/heavier than the cards beside it. TRAP: an `<svg width="100%">` with a small `viewBox` scales its text UP to the container width (11px viewBox units → ~20px on desktop), dwarfing sibling 13px cards. Prefer HTML/CSS rows with real `px` fonts (matching the section's tokens) over a width-scaled SVG. Spot-check: the chart's label font-size should equal the adjacent card title's.

## C. Layout & overflow
- [ ] Nothing overflows its container — no horizontal scrollbar, no content under the card edge — at 375, 768, 1280.
- [ ] No overlapping text or controls.
- [ ] Padding/alignment consistent with sibling cards.
- [ ] Tap targets ≥ 44px.

## D. Numbers
- [ ] Every £/% comes from an engine selector or `TAX` — none hardcoded in display copy.
- [ ] Numeric tie-outs pass (CLAUDE.md §9.5 Gate 2).
- [ ] Same metric = same value AND same format everywhere it appears.

## E. State & theme
- [ ] Screenshotted at 3 viewports × 2 themes.
- [ ] Empty/sparse-data state is correct and honest (test the persona who lacks the data).
- [ ] FCA framing present on money surfaces (information/guidance, never advice).

## F. Self-criticism gate
- [ ] Re-read this list against the rendered pixels. Listed every failing line. "All pass" only when every box is genuinely ticked.

## G. Automated detector — run this, expect an empty `issues` array

Paste into `preview_eval` (server `caelixa-dev`, 5173) on each route after a change. It flags horizontal overflow and SVG/text clipped past its nearest card/svg container — the exact class that keeps slipping. Saved standalone at `0-Active/visual-qa-detector.js`.

```js
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
  // 3. Anything wider than the viewport (page-level horizontal scroll)
  document.querySelectorAll('.sw-card, .sw-tile, [class*=card]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 2) issues.push({ kind: 'past-viewport', text: (el.innerText||'').slice(0,30), right: Math.round(r.right), vw });
  });
  return JSON.stringify({ count: issues.length, issues: issues.slice(0, 25) }, null, 1);
})()
```

A non-empty `issues` array = not done. Fix, reload (HMR doesn't recompute mounted `useMemo` — reload before re-checking), re-run until empty, at every viewport.
