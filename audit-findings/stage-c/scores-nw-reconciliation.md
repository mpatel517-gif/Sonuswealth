# Stage C — Scores + NW Reconciliation
**Date:** 2026-05-18

---

## Wealth Score

| Surface | Function called | Label used | Format | Consistent? |
|---------|----------------|-----------|--------|-------------|
| `HomeScreen.jsx` — AnchorRow | `calcFQ(entity)` via `useMemo` | "Wealth Score" (uppercase eyebrow) | `{score}/100` + band name below | YES |
| `MyMoney.jsx` — TripleAnchor area | `calcFQ(entity)` (L2485, comment: "calcFQ is canonical per Home v1.4 §Q1.2") | Delegated to `TripleAnchor` component — renders **"Health score"** (TripleAnchor.jsx L67) | ArcGauge `0–100`, no `/100` suffix | **NO — label wrong** |
| `Account.jsx` — score preview | `calcFQ(_previewEntity)` (L47) | `{BRAND.scoreShort}` = "Wealth Score" via `brand.js` | bare number `{score}` (L99) | YES |
| `RiskOverlay.jsx` — sub-anchor in header | `calcFQ(entity)` (L27) | `· Wealth` + number (abbreviated, no "Score") | bare number via `<Num format="score">` | **PARTIAL — label is "Wealth" not "Wealth Score"** |
| `Risk.jsx` — secondary tile (SecondaryTile) | `calcFQ(entity)` (L1686) | `label="Wealth Score"` (L1618) | bare `{fq.total}` + `band.name` sub | YES |
| `Dashboard.jsx` — nav header button | `calcFQ(entity)` (L212) | No label — bare number only; comment says "FQ score" (L404) | `{fq.total}` + `{band.name}` below, no `/100` | **PARTIAL — no label at all; comment says "FQ score"** |

---

## Risk Score

| Surface | Function called | Label used | Format | Consistent? |
|---------|----------------|-----------|--------|-------------|
| `HomeScreen.jsx` — AnchorRow | `calcRisk(entity)` via `useMemo` (L1380) | **"Risk"** (eyebrow, L370) — not "Risk Score" | `{riskScore}/100` + gradient gauge + band name | **PARTIAL — label is "Risk" not "Risk Score"** |
| `Risk.jsx` — primary ring (RiskRing) | `calcRisk(entity)` (L1422 in RiskBody, L1685 in default export) | "Risk Score" (L1596, L173) | `{risk.total}/100` (L162), ring arc | YES |
| `RiskOverlay.jsx` — primary header | `calcRisk(entity)` (L25) | "Risk Score · point-in-time" (eyebrow) | `<Num format="score">/100` | YES |
| `MyMoney.jsx` — TripleAnchor | `calcRisk(entity)` (L2486) | Delegated to `TripleAnchor` — renders **"Safety score"** (TripleAnchor.jsx L74) | ArcGauge `0–100` | **NO — label wrong** |
| `Dashboard.jsx` — any sidebar/nav | Not called — no `calcRisk` import | N/A — Risk Score not displayed | N/A | N/A (not a Risk Score surface) |

---

## Net Worth

| Surface | Function called | Format | Consistent? |
|---------|----------------|--------|-------------|
| `HomeScreen.jsx` — NW tile | `netWorth(entity)` via `useMemo` (L1377) | `fmt(nw)` = currency (£) with label "Net Worth" eyebrow | YES |
| `MyMoney.jsx` — TripleAnchor | `netWorth(entity)` (L2484) | Delegated to `TripleAnchor` — label **"You own"**, `fmt(netWorthVal)` currency | **PARTIAL — label is "You own" not "Net Worth"** |
| `RiskOverlay.jsx` — NW secondary | No direct `netWorth()` call in overlay header; NW appears only in `RiskBody` (Risk.jsx SecondaryTile L1627) which calls `netWorth(entity)` | `fmt(nw)` currency, label `"You own"` | **PARTIAL — uses "You own" label via SecondaryTile** |

---

## Inconsistencies found

### CRITICAL

**C-1 — TripleAnchor uses wrong labels for both scores** (`src/components/shared/TripleAnchor.jsx` L67, L74)
- Tile 2 label: `"Health score"` — should be `"Wealth Score"`
- Tile 3 label: `"Safety score"` — should be `"Risk Score"`
- Affects: every surface that renders `<TripleAnchor>` — `MyMoney.jsx` confirmed; any other consumer inherits the same bug.

### MODERATE

**C-2 — HomeScreen AnchorRow labels "Risk" not "Risk Score"** (`HomeScreen.jsx` L370)
- Eyebrow text: `Risk` — other surfaces (Risk.jsx, RiskOverlay) use "Risk Score". Inconsistent with the canonical label.

**C-3 — RiskOverlay Wealth Score sub-anchor shows "· Wealth {n}" not "Wealth Score"** (`RiskOverlay.jsx` L92)
- Abbreviated form acceptable in a compact header but diverges from "Wealth Score" used everywhere else.

**C-4 — Dashboard nav button shows bare FQ number with no "Wealth Score" label** (`Dashboard.jsx` L404–431)
- Comment in code says `FQ score` (legacy name). No user-visible label. Band name shown below but score identity is ambiguous to user.
- `subtitle` in FQBreakdown OverlayShell uses `"Score Breakdown"` (L546) — no "Wealth Score" wording.

### MINOR

**C-5 — Net Worth label diverges across surfaces**
- HomeScreen eyebrow: `"Net Worth"`
- TripleAnchor (MyMoney + RiskOverlay body): `"You own"`
- Risk.jsx SecondaryTile: `"You own"`
- Not a spec violation if "You own" is intentional plain-English — but the inconsistency should be a conscious choice.

**C-6 — `impact.finioScore` field name still in use** (`HomeScreen.jsx` L143, L1099, L1621; `fq-calculator.js` L1169+)
- `brand.js` L46 marks `finioScore` as `@deprecated — use BRAND.score`
- Affects action-impact pill copy ("+N Wealth Score" rendered correctly at display time, but the data field is legacy)
- `DecisionEngine.jsx` L798 uses `"FQ boost"` label for impact chips — should be `"Wealth Score boost"` or similar

---

## Entity consistency

All engine calls use the `entity` prop/arg passed directly from the screen's data source:
- `HomeScreen` — `useMemo(() => calcFQ(entity), [entity])` ✅
- `MyMoney` — `calcFQ(entity)` / `calcRisk(entity)` / `netWorth(entity)` at L2484–2486, same `entity` ✅
- `Risk.jsx` — `calcRisk(entity)` / `calcFQ(entity)` / `netWorth(entity)` all at same level ✅
- `RiskOverlay` — same `entity` prop, called at top of component ✅
- `Account.jsx` — uses `_previewEntity` (a stub built from onboarding props) — intentional, not a bug ✅
- `Dashboard.jsx` — `calcFQ(entity)` from same entity prop ✅

No stale/cloned entity detected.

---

## Verdict

**NEEDS-WORK**

Blocking issue: `TripleAnchor.jsx` uses "Health score" / "Safety score" — wrong labels visible on the MyMoney tab for both Wealth Score and Risk Score. Fix is a two-line change in `src/components/shared/TripleAnchor.jsx` L67 and L74.

Secondary: HomeScreen calls the Risk Score tile "Risk" not "Risk Score"; Dashboard nav has no label. Both should be aligned before launch.
