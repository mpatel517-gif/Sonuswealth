# Sonuswealth v0 Demo Definition

**Purpose:** Define exactly what "done" means for the first showable version. Everything else is post-demo backlog.

**Authored:** 2026-05-21
**Status:** DRAFT — needs founder sign-off before any further build

---

## The 90-second demo

### Scene 1 — Open the app (10 sec)
Founder loads Sonuswealth on **mobile** (the most demanding form factor). Persona selector shows 3 personas: **Bruce Wayne**, **Catherine**, **Hugo**. Click Bruce.

### Scene 2 — Home screen (15 sec)
Mobile-optimised Home renders in <1.5 sec:
- **Three anchors** at top (always visible): Net Worth £3.7M · Wealth Score 69/100 · Risk 68/100
- **Cost of Inaction strip** below: "You're losing £150k+ to avoidable tax. See Optimiser."
- **4 zone cards** below (Personal, Financial, Property, Estate) — tappable
- **Bottom nav**: Home · MyMoney · Optimiser · Timeline · More

Founder taps the **Optimiser** chip.

### Scene 3 — Optimiser screen (40 sec) — THE WOW MOMENT
Screen renders with header:
> **Optimiser** — for Bruce
> **You could save £150k in IHT + £10k/yr in income tax with 4 changes.**

Below: 4 tiles, sorted by £ impact, each with status colour:

| Tile | Headline | £ Impact | Tap action |
|---|---|---|---|
| 1 (red) | "Your estate loses £140k to IHT" | £140k lifetime | drill-down |
| 2 (amber) | "Escape the £100k tax trap" | £10k / year | drill-down |
| 3 (amber) | "Use your pension carry-forward" | £24k one-time | drill-down |
| 4 (green) | "Your NI record is full — good" | £0 (passed) | drill-down |

Founder taps tile 1 (RNRB IHT).

### Scene 4 — Drill-down (20 sec)
Drill-down screen:
- **Top:** "Your estate is £3.96M. The Residence Nil-Rate Band (£175k) is fully lost above £2.35M, AND you have no direct descendants. Combined IHT cost: £140k."
- **Plain-English explanation** (3 sentences, no jargon)
- **3 strategy cards:**
  - Option A: Lifetime gifts to reduce estate below £2M (worked example with Bruce's £)
  - Option B: BPR-qualifying AIM portfolio £200k (£80k IHT saved after 2 yrs)
  - Option C: Charity 10% rule (reduces remaining IHT rate to 36%)
- **FCA boundary line at bottom:** "Information only — speak to a qualified adviser before acting."
- **"Ask Sonnu"** chip for follow-up question
- **"Share with my IFA"** button (deferred to v0.1)

### Scene 5 — Back to Optimiser, switch persona (5 sec)
Back button → Optimiser screen. Persona switcher in header — tap "Catherine".
Optimiser re-renders with **different** tiles relevant to Catherine (couple, business owner).
Demonstrates the personalisation.

**End of demo. ~90 seconds.**

---

## The "wow" moment

When the screen reads:
> **"You could save £150k in IHT + £10k/yr in income tax with 4 changes."**

That single sentence does what every other UK financial planning app fails to do: tell the user, in their own numbers, how much avoidable tax they're paying. The fact that we then SHOW THEM HOW separates Sonuswealth from compliance/budgeting tools.

---

## What's in scope for v0

### Screens (2 new + 1 modified)

1. **Optimiser landing screen** (`src/screens/Optimiser.jsx`) — NEW
   - Header with total savings summary
   - Sorted tile list driven by eligibility verdicts
   - Mobile drawer for tile drill-down
   - Persona switcher
   - ~250 lines React

2. **Optimiser drill-down** (`src/components/OptimiserDrill.jsx`) — NEW
   - Per-tile detail view
   - 2-3 strategy cards
   - FCA boundary line
   - Ask Sonnu chip
   - ~150 lines React

3. **Home screen mobile refit** (`src/screens/HomeScreen.jsx`) — MODIFIED
   - Existing screen, just add CoI strip + mobile breakpoint fixes
   - Optimiser tab in bottom nav

### Engine wiring (existing — light glue)

- `src/screens/Optimiser.jsx` calls `evaluateEligibility(persona, asOfDate)` → already exists
- Filters to actionable findings (`qualifies !== 'YES'`, has `fixHint`)
- Sorts by `applicableAmount` desc
- Renders top 5

### Demo personas (3)

- **Bruce Wayne** (persona-a) — retired £3.7M HNW — IHT-heavy demo
- **Catherine** (persona-c) — couple business-owner £10.9M — Ltd-director angle
- **Hugo** (persona-d) — foundation £47k — first-time buyer angle

For each, hand-curate the persona JSON to ensure rich Optimiser output. Add fields the eligibility rules need (gifts history, scheme_member_in, etc.) where missing.

### Optimiser scenarios actually shown (5 of 26)

From the eligibility engine — already built:
1. **PA-TAPER** (Bruce, Catherine if income > £100k)
2. **RNRB-DESCENDANT + RNRB-TAPER** (Bruce, Catherine)
3. **CARRY-FORWARD-AA** (Bruce, Catherine)
4. **HICBC** (Catherine if dependants + income £60-80k)
5. **SDLT-FTB** (Hugo)

The other 21 scenarios from OPTIMISER-SCENARIOS-v1.md = post-demo backlog.

### Build estimate

| Task | Hours |
|---|---|
| Optimiser landing screen | 4 |
| Optimiser drill-down component | 3 |
| Home mobile breakpoint fixes + CoI strip | 3 |
| Update 3 demo personas with rich eligibility data | 1 |
| Wire eligibility → Optimiser tiles | 1 |
| Manual QA on iPhone + iPad + laptop | 2 |
| **Total** | **~14 hours** |

That's **2-3 focused work sessions**. Achievable.

---

## What's out of scope for v0 (explicit deferred list)

These are **NOT** required for the demo. Each becomes a v0.1+ phase.

### Engine work — deferred
- Phase 8B: Per-effective-date temporal rules (mid-year Budgets)
- Phase 8B: Scottish income tax
- Phase 8B: DOB on all 92 personas
- Phase 8B: 18 macro variables (we'll use 2 for the demo — CPI + BoE rate)
- Phase 8B: Historical 2021-2026 testing accuracy
- Phase 8C-E: 45 additional eligibility rules
- Cron jobs deployment (code written but not live)
- Supabase migration 011 application (data layer not used by demo — JSON files fine)
- DeepSeek live validation (rule-validator sufficient for demo)

### UI work — deferred
- MyMoney complete tab
- Cashflow complete tab
- Tax & Estate complete tab
- Risk overlay tab
- Timeline tab
- Settings tab
- Reports tab
- Data Capture (upload/scan/manual input)
- IFA Practice mode
- Onboarding flow

### Other — deferred
- PDF export ("Share with IFA")
- Decision Engine integration ("Ask Sonnu" goes to a static modal in v0)
- Multi-jurisdiction (UK only)
- Couple shared dashboard (single user only)
- Notifications / APQ
- Auth / login

### Founder action items still pending (separate from build)
- Rotate leaked DeepSeek + Supabase service_role keys
- Push 10 local commits to GitHub
- Apply Supabase migration 011 (not needed for demo but eventually)

---

## Success criteria — testable

The demo is "done" when ALL of these pass:

- [ ] **Mobile (480×900):** Home + Optimiser + drill-down all render with no horizontal scroll, no text smaller than 14px, no overlapping elements
- [ ] **Laptop (1440×900):** Same screens render correctly
- [ ] **Persona-a Bruce:** Optimiser shows ≥4 tiles, top tile has £ value visible, drill-down opens in <1s
- [ ] **Persona-c Catherine:** Optimiser shows different mix of tiles (couple-specific findings present)
- [ ] **Persona-d Hugo:** Optimiser shows SDLT FTB tile prominently
- [ ] **Persona switch:** Re-renders all tiles within 500ms
- [ ] **CoI strip on Home:** Shows total £ exposure number that matches sum of Optimiser tile values
- [ ] **No console errors** in browser DevTools during full demo flow
- [ ] **Snap script** runs clean at 3 viewports × 2 themes = 6 snapshots, no regressions
- [ ] **FCA boundary line** visible on every drill-down screen
- [ ] **eligibility-smoke.mjs** still 36/36 PASS after persona updates
- [ ] **test-persona-snapshots.mjs** still 92/92 PASS

---

## What this DOES NOT prove

After the demo, we have NOT proved:
- Engine is historically accurate (Phase 8B problem)
- All UK eligibility rules covered (45 still in backlog)
- The Optimiser advice would survive IFA peer review
- Cron data freshness works in production
- Performance with real Supabase data
- Multi-jurisdiction support

These are post-demo questions. The demo proves: **the concept resonates, the UX flows, the numbers feel right**.

---

## Order of build (when you say go)

1. **Hour 1:** Curate persona-a, persona-c, persona-d JSON files with eligibility fields
2. **Hours 2-5:** Build Optimiser landing screen (mobile-first)
3. **Hours 6-8:** Build Optimiser drill-down with 2-3 strategy cards per tile
4. **Hours 9-11:** Home mobile refit (CoI strip + responsive breakpoints)
5. **Hour 12:** Wire bottom-nav tab + persona switcher
6. **Hour 13:** Snap regression + 6-viewport check
7. **Hour 14:** Polish + verify all success criteria

After 14 hours: demo-ready. Record a 90-sec screencap and you can show investors / advisers.

---

## Sign-off

**Founder:** ___ approve as written / ___ adjust scope / ___ start over

**Date sign-off:** _______________

---

*v1 demo definition. Once approved, no further scope additions without explicit re-sign. Backlog goes to .planning/ for post-demo.*
