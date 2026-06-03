# Cashflow Question-Tiles — Implementation Plan

> **For agentic workers:** This is a UI move-and-wrap restructure of a single inline file. Verification is MCP snap-gates + DOM tie-outs per CLAUDE.md §9.5 (NOT red-green TDD). The existing node suites (`decumulation-solver`, `withdrawal-methods`, `l3-2-*`) are the regression net and must stay green. Steps use `- [ ]` checkboxes. Each task is independently build-green + snap-verifiable so a half-done state is never shipped.

**Goal:** Restructure the Cashflow tab from a ~20-card inline scroll into a headline-answer band + a grid of seven question-tiles, each opening a full-screen drawer-page that wraps existing components, mobile-first.

**Architecture:** All work lives in `src/screens/Cashflow.jsx` (single inline house-pattern file). New surface = `QuestionTile` grid + headline band. Each tile sets `drillView('<key>')`; existing `*DrillPanel` early-return pattern (used by §A surplus/income/health) renders a full-screen page that wraps the component blocks **moved intact** (never retyped) from §A/§B/§C. The three founder content-fixes (runway, assumptions, path-vs-amount) land in the `drawdown` page.

**Tech Stack:** Vite + React + plain JS. Engine selectors already produce everything needed: `solve.methodology`, `solve.rankedPaths[].depletedAtAge`, `inferLifeStage`/`inferBranch`, `PREFERENCE_SET` override.

**Spec:** `0-Active/route-specs/2026-06-03-cashflow-question-tiles-design.md`

---

## File map

- **Modify only:** `src/screens/Cashflow.jsx`
  - drillView state: ~L1020 (`const [drillView, setDrillView] = useState(null)`)
  - drillView early-return branches: ~L1140 (`if (drillView === 'surplus') ...`)
  - §A render zone: ~L1282–1353 (surplus/income tiles, health)
  - §B SectionDelimiter + RevealStagger: ~L1356–1449
  - §C `EngineInternalsReveal` call: ~L1460; definition ~L1492
  - `DrawNetworkDiagram`: ~L3066; `ScenarioForwardSummary`: ~L3134
- No new files (house pattern). No engine changes.

---

## Task 1: QuestionTile primitive + drillView keys + page shells

**Files:** Modify `src/screens/Cashflow.jsx`

- [ ] **Step 1: Add the `QuestionTile` component** (place near `SectionDelimiter`, ~L1912)

```jsx
// One question-tile on the Cashflow surface. Headline answers the question;
// tapping opens its full-screen drawer-page (setDrillView). Compact so seven
// tiles + the headline band read in one mobile column.
function QuestionTile({ q, headline, sub, tone = 'neutral', onClick }) {
  const ring = tone === 'mint' ? 'var(--c-mint-text)' : tone === 'coral' ? 'var(--c-coral-text)' : tone === 'acc' ? 'var(--c-acc)' : 'var(--c-border)'
  return (
    <button onClick={onClick} className="sw-card sw-lift sw-pressable" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
      gap: 4, padding: '14px 14px', borderRadius: 16, cursor: 'pointer', width: '100%',
      border: '1px solid var(--c-border)', background: 'var(--c-surface)', height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text3)' }}>{q}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: ring === 'var(--c-border)' ? 'var(--c-text)' : ring, fontVariantNumeric: 'tabular-nums' }}>{headline}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.4 }}>{sub}</div>}
      <div style={{ marginTop: 'auto', paddingTop: 8, fontSize: 11, color: 'var(--c-acc)', fontWeight: 700 }}>View ›</div>
    </button>
  )
}
```

- [ ] **Step 2: Add empty page shells** for the seven keys next to the existing branches (~L1140). Each is a temporary stub so the scaffold builds before content is moved in.

```jsx
if (['now','lastability','drawdown','methods','resilience','whatif','costs'].includes(drillView)) {
  return <CashflowTilePage view={drillView} entity={entity} onClose={() => setDrillView(null)} />
}
```

- [ ] **Step 3: Add the `CashflowTilePage` host** (near `SurplusDrillPanel`, ~L196) — copies the fixed-panel + DrillStackProvider shell, body filled per-view in later tasks.

```jsx
const TILE_TITLES = { now: 'Am I OK right now?', lastability: 'Will my money last?', drawdown: 'How do I draw it down?', methods: 'How fast can I spend?', resilience: 'What could break it?', whatif: 'What would change it most?', costs: "What's it costing?" }
function CashflowTilePage({ view, entity, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--c-bg)', overflowY: 'auto' }}>
      <DrillStackProvider>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 16px 96px' }}>
          <button onClick={onClose} className="sw-pressable" style={{ background: 'none', border: 'none', color: 'var(--c-acc)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>← Back</button>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', margin: '8px 0 16px' }}>{TILE_TITLES[view]}</h2>
          {/* body injected per-view in Tasks 2–8 */}
        </div>
      </DrillStackProvider>
    </div>
  )
}
```

- [ ] **Step 4: Replace the §B SectionDelimiter+RevealStagger block (~L1356–1449) with the tile grid.** Keep §A and §C in place for now (they get folded into pages in Tasks 3/7). Insert:

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
  <QuestionTile q="Will my money last?" headline="…" onClick={() => setDrillView('lastability')} />
  <QuestionTile q="How do I draw it down?" headline="…" onClick={() => setDrillView('drawdown')} />
  <QuestionTile q="How fast can I spend?" headline="…" onClick={() => setDrillView('methods')} />
  <QuestionTile q="What could break it?" headline="…" onClick={() => setDrillView('resilience')} />
  <QuestionTile q="What would change it most?" headline="…" onClick={() => setDrillView('whatif')} />
  <QuestionTile q="What's it costing?" headline="…" onClick={() => setDrillView('costs')} />
</div>
```
(Real headline values wired in Task 9. `…` placeholders are acceptable ONLY within this scaffold task; Task 9 replaces every one.)

- [ ] **Step 5: Build + snap.** `npm run build` (expect "built in"); Preview `?demo=a&tab=flow` — six tiles render, each opens its (empty) page, Back closes. Commit `feat(cashflow): question-tile scaffold + page host`.

---

## Task 2: `drawdown` page — move the plan + the 3 founder fixes

**Files:** Modify `src/screens/Cashflow.jsx`. This is the centerpiece.

- [ ] **Step 1:** In `CashflowTilePage`, for `view === 'drawdown'` render `<ScenarioMatrixWithRecompute entity={entity} decSolve={decSolve} />`. Pass `decSolve` down (compute it in `CashflowTilePage` via the existing memo, or lift `decSolve` to a prop). Use: `const decSolve = useMemo(() => { try { const s = buildGoalSpec(entity); return s.branch === 'decumulation' ? solveDecumulation({ entity, goalSpec: s }) : null } catch { return null } }, [entity])`.

- [ ] **Step 2: Runway in the back-solve hero.** In `ScenarioForwardSummary`, the hero tie-out line already shows `funds to age {route.depletedAtAge}`. Promote it to a headline stat beside the income number:

```jsx
<div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 2, flexWrap: 'wrap' }}>
  <div><span style={{ fontSize: 30, fontWeight: 800, color: 'var(--c-acc)' }}>{fmt(target)}</span><span style={{ fontSize: 12, color: 'var(--c-text3)' }}> /yr</span></div>
  <div><span style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)' }}>to age {route.depletedAtAge || `${horizon}+`}</span><span style={{ fontSize: 11, color: 'var(--c-text3)' }}> before funds run low</span></div>
</div>
```

- [ ] **Step 3: Assumptions panel** from `solve.methodology`. Add a collapsible at the bottom of `ScenarioForwardSummary`:

```jsx
{solve.methodology && <AssumptionsPanel methodology={solve.methodology} />}
```
And the component (near `ScenarioForwardSummary`):
```jsx
function AssumptionsPanel({ methodology }) {
  const [open, setOpen] = useState(false)
  const rows = methodology.assumptions || methodology.inputs || []
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--c-border)', paddingTop: 10 }}>
      <button onClick={() => setOpen(o => !o)} className="sw-pressable" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--c-text2)', padding: 0 }}>
        {open ? '▾' : '▸'} Assumptions behind this plan
      </button>
      {open && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.7 }}>
          {(Array.isArray(rows) ? rows : Object.entries(rows).map(([k, v]) => `${k}: ${v}`)).map((r, i) => <li key={i}>{typeof r === 'string' ? r : (r.label || r.text || JSON.stringify(r))}</li>)}
        </ul>
      )}
    </div>
  )
}
```
NOTE: read the real shape of `solve.methodology` first (`node` probe) and adapt the row mapping to its actual fields — do not assume `.assumptions` exists.

- [ ] **Step 4: Path-vs-amount legibility.** Add under the money-map caption in `DrawNetworkDiagram`: `Dragging your income changes WHEN each pot is used; reorder your priorities (or pick another route) to change the ORDER.`

- [ ] **Step 5: Build + snap + tie-out.** Preview `?demo=a&tab=flow` → open "How do I draw it down?". Verify: hero shows runway, drag income re-solves runway live (96k→…→76 at 200k), assumptions panel lists real methodology rows, map caption shows the path-vs-amount line. Node suites green (`node --test` or the project's runner). Commit `feat(cashflow): drawdown page + runway + assumptions + path/amount`.

---

## Task 3: `now` page — move §A

- [ ] **Step 1:** Move the §A render block (~L1282–1353: cashflowFlow Sankey/waterfall, surplus/deficit, liquidity, essentials-v-discretionary, subscription tracker, income-by-band) intact into `CashflowTilePage` `view === 'now'`. Move WHOLE `<Component .../>` blocks; do not retype props.
- [ ] **Step 2:** Remove the now-empty §A inline render from the main surface.
- [ ] **Step 3: Build + snap + tie-out.** "Am I OK right now?" page renders all §A cards; surplus ties to `monthlySurplus`. Commit `refactor(cashflow): §A into 'now' page`.

---

## Task 4: `resilience` page — sequence + PoS + GK

- [ ] **Step 1:** Into `view === 'resilience'`, move: `SequenceStressHero`, the `PoSChartV2` IIFE (~L1400–1423), the `SequenceStressVisV2` conditional, and `GuytonKlingerCorridor` — intact with their existing props (`entity`, `seqVuln`, `pos`, `gkPath`). These props are computed in the parent; thread them into `CashflowTilePage` as props.
- [ ] **Step 2: Build + snap.** "What could break it?" renders the three resilience visuals; no "Calculating…" stuck states. Commit `refactor(cashflow): resilience page`.

---

## Task 5: `methods` page — the 5 withdrawal methods

- [ ] **Step 1:** The 5-method comparison currently lives inside `ScenarioForwardSummary` behind the "Compare withdrawal methods" toggle (~L3266–3312). Extract that block into a standalone `MethodsComparison({ entity, solve })` component and render it BOTH in `view === 'methods'` (expanded, no toggle) and leave a one-line teaser + "Open methods ›" link in the drawdown page that calls `setDrillView('methods')`.
- [ ] **Step 2: Build + snap + tie-out.** "How fast can I spend?" shows all 5 methods; year-1 figures === `compareMethods`. Sparse guard intact (portfolio≤0 → honest fallback). Commit `refactor(cashflow): methods page`.

---

## Task 6: `lastability` page — funded gauge + FI + SWR

- [ ] **Step 1:** Into `view === 'lastability'`, move `FundedRatioGaugeV2`, `FiProgressTile`, and `SwrRegimePicker` (the rate-assumption knob that drives the gauge). Thread `fr`, `fi`, `swr`, `swrRegime`, `setSwrRegime` as props.
- [ ] **Step 2: Build + snap + tie-out.** Funded ratio renders; SWR picker still moves the gauge (A2 behaviour preserved). Commit `refactor(cashflow): lastability page`.

---

## Task 7: `costs` page — §C depth

- [ ] **Step 1:** Render the existing `EngineInternalsReveal` body (CoI odometer, CF CoI variants, max-drawdown, efficient frontier, PRC/PCC + Reality stubs, FI depth, confidence summary) inside `view === 'costs'` — without the "Show methodology" toggle wrapper (the tile IS the disclosure now). Thread its props (`coi, coiVar, prcPcc, reality, mdd, eff, fi, health, fr, pos`).
- [ ] **Step 2:** Remove the inline `EngineInternalsReveal` from the main surface.
- [ ] **Step 3: Build + snap.** "What's it costing?" renders the depth cards; stubs still honestly labelled. Commit `refactor(cashflow): costs page`.

---

## Task 8: `whatif` page — goal-seek ranked levers (NEW work)

**Files:** Modify `src/screens/Cashflow.jsx`. This is the §1.7 Q6 gap — the only page that is not a pure move.

- [ ] **Step 1:** Render the existing `GoalSeekCard` into `view === 'whatif'` as the base.
- [ ] **Step 2: Ranked levers.** Above it, add a list that runs `goalSeek(entity, metric, target, 'lifetime', {})` for the standard levers and ranks them by impact. Read the real `goalSeek` return shape first (`node` probe of `src/engine/...`), then render each lever as: label · the change needed · the resulting metric delta · a "Model this" chip that routes to Ask Sonu (`sonus:ask`) or commits a what-if. Frame: "What would move your picture most — illustration, not advice."
- [ ] **Step 3: Build + snap.** "What would change it most?" shows ranked levers + goal-seek; FCA framing present. Commit `feat(cashflow): what-if / goal-seek page`.

---

## Task 9: Headline answer band + adaptive + real tile headlines

- [ ] **Step 1: Headline band** above the tile grid:

```jsx
<HeadlineAnswer entity={entity} fr={fr} decSolve={decSolve} fi={fi} />
```
Component: decumulator → "On these assumptions, your money lasts to age {decSolve?.rankedPaths?.[0]?.depletedAtAge}" + compact funded gauge; accumulator → "On track to financial independence by ~{fi projection}" + FI ratio. Include the `LifeStageOverrideChip` (already built) here.

- [ ] **Step 2: Real tile headlines.** Replace every `…` placeholder from Task 1 with the live value: lastability → `fr.ratio`× / to age; drawdown → route name · to age; methods → top method £/yr; resilience → seqVuln severity; whatif → top lever; costs → CoI £/yr; now → surplus £/mo · runway. Each reads its existing selector (no new engine).

- [ ] **Step 3: Adaptive tile swap.** When `inferBranch(entity) !== 'decumulation'`: drawdown tile → "Am I on track? (FI)"; methods tile hidden (or "Withdrawal methods — preview"). Headline band swaps per Step 1.

- [ ] **Step 4: Build + snap matrix.** Bruce/Mr T/Willy × {375,768,1280} × {light,dark}. Headline reads in one glance; tiles show real numbers; override chip flips band + tiles 3/4. Commit `feat(cashflow): headline band + adaptive tile headlines`.

---

## Task 10: Verification sweep + cleanup

- [ ] **Step 1:** Full §9.5 snap matrix (3 personas × 3 viewports × 2 themes); write `.snap-verdict` to `0-Active/route-specs/`.
- [ ] **Step 2: DOM tie-outs** via `preview_eval`: headline funds-to-age === drawdown `depletedAtAge`; each tile headline === its selector; surplus === `monthlySurplus`.
- [ ] **Step 3:** Zero console errors all three personas (Fragment-className flood tracked separately). Node suites green.
- [ ] **Step 4: Compliance.** Run `sonuswealth-compliance` + `sonuswealth-ifa-auditor` on the new surface (decisions never "do X"; methods "fits your #1" not "best"; disclaimers present).
- [ ] **Step 5:** Re-read the checklist `~/.claude/plans/cashflow-checklist.md`; mark moved items; confirm no regressions. Commit `chore(cashflow): question-tiles verification + checklist update`.

---

## Self-review

- **Spec coverage:** §3 coverage map → Tasks 2–8 (one page per tile) + Task 9 (headline band, adaptive); §8 fixes → Task 2 (runway/assumptions/path-amount); §9 mechanics → Task 1 (QuestionTile, page host, no split); §6 adaptive → Task 9 Step 3; §10 compliance + §11 verification → Task 10. All covered.
- **Order risk:** Task 1 leaves §A/§C inline + the tile grid live simultaneously (duplicate content) until Tasks 3/7 move them — acceptable transient (build-green, just visually redundant); each later task removes the inline copy as it moves it. No task ships a *broken* state.
- **Props threading:** Tasks 2/4/6/7 require parent-computed selectors (`decSolve, seqVuln, pos, gkPath, fr, fi, swr, coi…`) reaching `CashflowTilePage`. Lock this in Task 1 Step 3 by passing a single `ctx` prop bag from the parent: `<CashflowTilePage view ctx={{ entity, decSolve, fr, fi, seqVuln, pos, gkPath, swr, swrRegime, setSwrRegime, coi, coiVar, prcPcc, reality, mdd, eff, health }} onClose />`. Update Task 1 Step 3 host signature accordingly before starting Task 2.
- **Placeholder scan:** the only `…` placeholders are in Task 1 Step 4, explicitly replaced in Task 9 Step 2. The `solve.methodology` (Task 2) and `goalSeek` (Task 8) shapes are flagged "probe first" rather than assumed.
