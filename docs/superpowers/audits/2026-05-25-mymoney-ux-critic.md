# MyMoney UX Critic — duplication & hierarchy audit (2026-05-25)

**Auditor lens:** Senior UX / product designer · macOS principle · info-guidance-storage positioning
**Evidence:** `docs/superpowers/audits/2026-05-25-mymoney-live-evidence.md` (live Chrome DOM capture, persona Mr T / Bruce Wayne, ?demo=mrt)
**Spec:** `G:\My Drive\All Work\6.Finio\1-Clusters\2-Product\2-Product-mymoney-v2_7.md` (v2.7 canonical)
**Locked:** D-ANCHOR-1 OVERRIDE (hot.md §Operational): header chip = NW + Wealth + Risk; body TripleAnchor passes `hideNetWorth={true}`.

---

## TL;DR — why the founder is right and Wave 0.6 ALL_PASS was wrong

Wave 0.6 measured the wrong thing. It verified that *each individual fix shipped*. It did not verify that *the screen-as-a-whole stopped repeating itself*. The screen now has at least **eleven** distinct duplications on a single scroll — six the evidence pack already named, five more this audit found. Worse: Act 2 (WHAT YOU OWN) has been turned into a four-storey stack (wrapper bar → balance sheet wedge → 5 metric tiles → 7 category tiles) where every storey re-slices the same £4.08m. That's not "depth on tap" — that's the same depth, four times, all flat on the surface. The macOS principle is being violated by accretion: every wave added something, no wave removed.

The duplication problem is not a bug list. It is a **structural failure of Act 2**. Until that's collapsed, every future fix will add another duplicate.

---

## Section 1 — Duplication list (confirm + expand)

### 1A. Confirmed from evidence pack (items 1–6)

All six confirmed. Restated with severity and surface anchor:

| # | Severity | Surface | Duplication | Spec citation |
|---|---|---|---|---|
| 1 | **BLOCK** | Header chip vs Act 1 body | Wealth 69 + Risk 71 shown twice in <600px scroll | hot.md "Triple-anchor mandatory" + D-ANCHOR-1 OVERRIDE — the override hid NW but **failed to hide Wealth/Risk**. The override is incomplete. |
| 2 | **HIGH** | Act 1 | "+£7k net worth change" shown 3×: big tile, prose sentence, LAST MONTH metric tile | v2.7 §3 Screen Contract — no spec requirement for triple-redundancy |
| 3 | **HIGH** | Act 2 | Pension £850k shown 3×: wrapper bar, WHAT YOU CAN ACCESS column, PENSIONS category tile | v2.7 §2.1 Wrapper-first UI contract — wrapper is the **resolver**, not three parallel presentations |
| 4 | **BLOCK** | Act 2 | HOW YOUR MONEY IS HELD and WHAT YOU CAN ACCESS partition the **same £4.08m** into two adjacent stacked bars | v2.7 §3.7 X29 visual diff — diff is meant to show **change**, not re-slice the same total |
| 5 | **HIGH** | Act 2 | `12-month NW +10.9%` vs `1-YEAR GROWTH +£154k (+4.1%)` — same window, conflicting percentages, displayed inches apart | v2.7 §3 — single canonical metric per window |
| 6 | **HIGH** | Act 4 | Spending shown 3× adjacent: chart bars (£10k/£1k/£8k), 3 cashflow tiles (£10k/£1k), title "£3K/MO" (which is income, mislabeled) | v2.7 §M (cashflow domain) — one canonical surface per metric on owning tab; full cashflow lives on Cashflow tab anyway |

### 1B. New duplications NOT in evidence pack

| # | Severity | Surface | Duplication | Note |
|---|---|---|---|---|
| 7 | **HIGH** | Header subnav vs page anchor | `NOW \| Today \| Future \| Plan \| What if` subnav + Act 1 anchor `+£7,000 net worth change vs last month` — both say "you are looking at the current snapshot". The subnav `NOW` pill is doing the same job as the Act 1 "this month" framing. | Pre-launch CTA honesty: `Future`, `Plan`, `What if` tabs — do they all land somewhere real, or are some "coming soon"? Flag for tester. |
| 8 | **HIGH** | Act 2 | **Category tile £ + wrapper bar segment £** is a third axis of the same data. PENSIONS tile £850k = wrapper bar Pension segment £850k. SAVINGS & INVESTMENTS £800k ≈ ISA £420k + GIA £380k (= the two wrapper segments next to it). Every category tile is reading the wrapper bar back to the user with a different label. | This is the structural duplication. See §3. |
| 9 | **MED** | Act 2 | `+0.2%` repeats on PENSIONS tile AND on SAVINGS & INVESTMENTS tile AND `LAST MONTH +0.2%` metric tile — all three rendering the same monthly delta on the same screen | Either category-level deltas or aggregate delta, not both. |
| 10 | **MED** | Act 2 | TIME COVERED `150.3 yr` + CASH tile `6.9 yr of essentials covered` + Act 4 `Liquid cash covers 22.0 months` — **three different "how long does my money last" framings** on one scroll, with three different answers (150 yr, 6.9 yr, 1.83 yr). Not strictly duplicates — three different denominators — but the user reads them as conflicting answers to the same question. | Worse than duplication: this is contradiction dressed as multi-lens. Pick one canonical runway metric, drill the others. |
| 11 | **MED** | Act 2 | CASH category tile (£180k) + Act 2 wrapper bar Cash segment (£180k) + Act 2 WHAT YOU CAN ACCESS Liquid £980k (cash is inside this) + 5-metric-tile row implies cash via TIME COVERED denominator. Cash is structurally over-surfaced relative to its 4% share of NW. | Pension is shown 3× and is 21% of NW. Cash is shown ~4× and is 4% of NW. Surface area not proportional to materiality. |
| 12 | **LOW** | Cross-screen | Header chip `WEALTH 69` shows label `Optimised` here, `ON TRACK` on Home. Same number, different state copy. **State-copy mismatch across screens** — explicit category C item from evidence pack but worth re-flagging because it makes the duplication feel arbitrary. | Belongs in a single state-copy lookup, not screen-local. |

### 1C. Redundancy / chrome

| # | Severity | Surface | Issue |
|---|---|---|---|
| 13 | **MED** | Header | `Tax year ▼ UK tax 2026/27` — label says Tax year, value repeats "tax". Strip to `2026/27`. |
| 14 | **MED** | Header | `← Home` back-arrow on a top-level destination — there is no "back". Remove. |
| 15 | **LOW** | All tiles | Every category tile has both `View detail →` and `+ Add`. Two affordances at L2 where one (tap-anywhere → drill) would suffice. macOS principle: depth **on tap**, not on multi-button menu. |

---

## Section 2 — Information hierarchy in the 6-act order

The 6 acts per v2.7 §3 (and the Wave 0.6 "6-act MyMoney restructure killing PivotToggle" per hot.md):

1. ANCHOR
2. WHAT YOU OWN (assets)
3. WHAT YOU OWE (liabilities)
4. MONTHLY CASH FLOW
5. TAX
6. DECISIONS

**Verdict on Act 2: yes, it is overloaded. Catastrophically so.**

Act 2 currently contains:
- HOW YOUR MONEY IS HELD (wrapper bar: 5 segments × £)
- BALANCE SHEET wedge with NET WORTH headline
- WHAT YOU CAN ACCESS (3-bucket access bar: Liquid/Pension/Illiquid × £)
- 5 metric tiles (1-YEAR GROWTH, LAST MONTH, DEBT RATIO, TIME COVERED, INCOME BUFFER)
- 7 category tiles (PENSIONS, SAVINGS & INVESTMENTS, PROTECTION, CASH, ALTERNATIVES, OBLIGATIONS, + the implicit Property which is in the wrapper bar but no tile)

That is **5 distinct horizontal organisations of the same asset base** stacked vertically. The user is looking at one balance sheet through five different lenses without ever choosing the lens.

This is the macOS-principle violation. A novice doesn't need five lenses. A novice needs **one** surface lens with depth on tap. Power users get the other four lenses via drill.

### Hierarchy verdict

| Act | Verdict |
|---|---|
| 1 ANCHOR | Wrong shape. NW removed from body (per D-ANCHOR-1 OVERRIDE) but Wealth/Risk still duplicated against header chip. Either kill the body anchor entirely or kill the header chip on the MyMoney screen. |
| 2 OWN | **Overloaded.** Collapse to one lens (recommendation: wrapper bar **or** category tiles, not both). Move 3 of 5 metric tiles to drill. Move WHAT YOU CAN ACCESS to drill of the wrapper bar (it's literally a re-grouping of the wrapper bar). |
| 3 OWE | OK. Single row of liabilities. |
| 4 CASH FLOW | **Wrong tab.** Three cashflow tiles on MyMoney duplicate Cashflow tab's first act. v2.7 §1 explicitly scopes MyMoney to assets/wrappers — cashflow is a different domain. Surface a single "spending exceeds income this month — view in Cashflow →" line. Move the 3 tiles. |
| 5 TAX | Out of view; can't critique without scroll capture. Likely OK — v2.7 §1 says MyMoney surfaces tax-relevant signals as action triggers, not as a tax surface. |
| 6 DECISIONS | Out of view. |

---

## Section 3 — Kill list (ranked, with one-line fix)

### BLOCK (ship-stoppers — founder asked 4×)

| # | Severity | Surface | What's wrong | Fix (one line) | Citation |
|---|---|---|---|---|---|
| K1 | BLOCK | Header chip + Act 1 anchor | Wealth/Risk shown twice on first viewport | **Kill the body Wealth/Risk anchor on MyMoney.** Keep only the +£7k delta line as Act 1. Header chip is the canonical anchor on non-Home screens. | D-ANCHOR-1 OVERRIDE is incomplete — extend `hideNetWorth={true}` to `hideAnchor={true}` on MyMoney specifically, OR change header chip to hide Wealth/Risk on Home and show it on MyMoney (one or the other, not both). |
| K2 | BLOCK | Act 2 dual partition | HOW YOUR MONEY IS HELD + WHAT YOU CAN ACCESS = same £4.08m sliced twice | **Kill WHAT YOU CAN ACCESS at L1.** Make it a tap-state of the wrapper bar: tap the wrapper bar → 3-bucket access view replaces it. macOS-principle compliant. | v2.7 §2.1 (wrapper is the resolver, one surface) |
| K3 | BLOCK | Act 2 category tiles vs wrapper bar | 7 category tiles re-state every wrapper segment as a separate card | **Pick one: wrapper bar (composition view) OR category tiles (action view).** Recommend: keep category tiles (they carry the CoI and action chips), kill the wrapper bar at L1, move wrapper bar to a 1-line summary chip "5 wrappers · £4.08m · tap to see composition" that expands. | v2.7 §2.1 + spec's drill model L1→L2→L3 |
| K4 | BLOCK | Act 4 on MyMoney | 3 cashflow tiles + spending chart on MyMoney duplicate Cashflow tab | **Replace Act 4 with a one-line referral:** "Spending exceeds income by £7k this month — see Cashflow tab →". | v2.7 §1 scope statement |

### HIGH

| # | Severity | Surface | What's wrong | Fix |
|---|---|---|---|---|
| K5 | HIGH | Act 1 prose + tile + metric | "+£7k" rendered 3× | Keep the **prose sentence** ("Net worth grew £7k this month, despite a £8k deficit"); kill the big tile; move LAST MONTH metric to drill. |
| K6 | HIGH | 5 metric tiles | 5 tiles is too many at L1; 2 directly contradict TIME COVERED (150 yr) and INCOME BUFFER (52×) are wrong by inspection | **Surface 2 metric tiles max at L1** (recommend: 1-YEAR GROWTH + DEBT RATIO). Move TIME COVERED + INCOME BUFFER to drill **after fixing the calc bugs** (evidence pack §D items 15–17). |
| K7 | HIGH | Conflicting growth | 12-month +10.9% vs 1-YEAR +4.1% adjacent | Pick one denominator; show the other in drill. Likely one is gross-of-flows and one is net — label which. |
| K8 | HIGH | Subnav | NOW pill + Today tab = same concept | Remove `NOW`. Tabs already convey time-axis. |
| K9 | HIGH | "Optimised" label | Sounds regulated; no rubric | Relabel to band copy that's already on Home (`ON TRACK` / `PROTECTED`) and use the **same** copy across screens. Single source. |

### MED

| # | Severity | Surface | What's wrong | Fix |
|---|---|---|---|---|
| K10 | MED | Three runway framings | TIME COVERED 150yr + CASH 6.9yr + Liquid 22mo | Pick one canonical runway statement at L1. Push the other two framings to drill, with explicit "this is the same question answered three ways" disclosure so power users can compare. |
| K11 | MED | Per-tile +0.2% | Three tiles all show +0.2% delta | Show delta on one tile (aggregate). Drill shows per-category. |
| K12 | MED | "wrapping into an ISA would shield it" on CASH tile | Recommendation language, not informational | Reword to information frame: "Cash held outside an ISA generates £1240/yr in interest tax. ISA-wrapped cash is shielded from this." — describes the rule, doesn't tell user what to do. |
| K13 | MED | "COST OF WAITING: £12.0k of tax relief gone forever" | Urgency-as-advice | Soften to information frame: "Unused pension allowance does not carry forward beyond 3 years. £12.0k of this year's allowance carries forward to 2029/30, then expires." |
| K14 | MED | Tax year label | "Tax year ▼ UK tax 2026/27" — word "tax" twice | "Tax year ▼ 2026/27". |
| K15 | MED | `← Home` arrow | No back state | Remove. |

### LOW

| # | Severity | Surface | What's wrong | Fix |
|---|---|---|---|---|
| K16 | LOW | Per-tile actions | Both `View detail →` and `+ Add` per tile | Whole tile is tap-target for drill; `+ Add` becomes secondary action inside drill, not at L1. |
| K17 | LOW | SAVINGS & INVESTMENTS 53% + 48% = 101% | Rounding visible | Round to whole % then proportion, or show "53% / 47%". |
| K18 | LOW | PENSIONS "Pension 100%" composition | Tautological when only one item | Drop composition badge when N=1. |

---

## Section 4 — Push back on locked decisions

**D-ANCHOR-1 OVERRIDE is producing the duplication problem.** The override hid NW from the body anchor because NW was already in the header chip — correct instinct, incomplete execution. **Wealth and Risk are also in the header chip.** The override should have hidden all three. As shipped, NW alone is hidden and Wealth+Risk are still doubled.

**Recommendation:** Promote the override from "hide NetWorth" to "hide entire body anchor on non-Home screens". The body anchor was designed for Home, where the header chip didn't exist yet. With the header chip now global, the body anchor is structurally redundant on every screen except Home.

This is consistent with "Triple-anchor mandatory" (hot.md): the triple is mandatory **once per screen**, not twice. The header chip satisfies the mandate.

---

## Section 5 — What this audit cannot answer

- Act 5 (Tax) and Act 6 (Decisions) below scroll — need a full-page capture, not viewport.
- Whether `Future`, `Plan`, `What if` subnav tabs land on real screens (pre-launch CTA honesty). Defer to tester.
- Whether the calc bugs in evidence pack §D (150 yr, 52×, etc.) are display bugs or engine bugs. Defer to sonus-financial-analyst + tester.
- Cross-screen state-copy single source — needs an audit of every label-emitter, not just MyMoney.

---

## Section 6 — Recommended order

If the founder picks one thing to fix first, pick **K3** (collapse wrapper bar OR category tiles — not both). It dissolves duplications 3, 8, 9 and 11 in one move and forces Act 2 down from 4 storeys to 2. Everything else is downstream.

If picking three: K3 → K2 → K4. After those three, the screen scrolls cleanly to Act 5 within one viewport-and-a-half instead of three.

**Last updated:** 2026-05-25
