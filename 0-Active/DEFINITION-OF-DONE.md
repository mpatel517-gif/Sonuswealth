# Definition of Done — every ticket, every time

**Created:** 2026-05-28
**Why:** 200+ tickets marked complete that the audit found were "scaffolded then abandoned." Same pattern surfaced again in the 2026-05-25..28 session. This file is the institutional answer to "what stops us repeating this 4 more times?"

**Status:** LOCKED. A ticket that doesn't pass every check below is not done — regardless of how confident the agent's summary sounds.

---

## The 5 evidence requirements (ALL must be filled)

Before any ticket flips from `in_progress` → `completed`, the ticket description must contain a literal evidence string with these five fields:

```
EVIDENCE:
  scope:    <what the ticket actually changes, one sentence>
  files:    <file paths touched, with line ranges>
  test:     <test command or harness that exercises the change>
  result:   <test output, paste a 1-line PASS/FAIL summary>
  reverts:  <how to undo this change cleanly if it breaks production>
```

Missing any field = ticket stays open. No exceptions for "trivial" tickets — trivial work that left out the evidence string is what built the 200-ticket pile.

---

## The 3 categories — each has its own additional gate

### A. Engine / data-layer tickets

In addition to the 5-field evidence string:

- [ ] `npm run test:dynamic` 12/12 personas PASS recorded in `result`
- [ ] If the change touched a selector, that selector listed in the test's SELECTORS array
- [ ] If the change touched netWorth or any £-tieout path, a manual `node -e "console.log(...)"` tie-out for at least one persona pasted in `result`

### B. UI / screen tickets

In addition to the 5-field evidence string:

- [ ] MCP `preview_screenshot` evidence at mobile (375) + tablet (768) + desktop (1280) — paths pasted in `result`
- [ ] Light + dark theme both shown
- [ ] If the change touched a hero number or category total, `preview_eval` DOM scrape tied to the engine selector
- [ ] Spec compliance — cite the relevant `2-Product/2-Product-*.md` section that this change implements or modifies

### C. Deploy / infra / migration tickets

In addition to the 5-field evidence string:

- [ ] If the work creates a Supabase migration or Edge Function: an explicit `DEPLOY.md` next to the function with step-by-step founder commands
- [ ] The ticket description must specify who runs each step — agent vs founder vs CI
- [ ] If the deploy step is founder-only (CLI session, secrets), the ticket has TWO checkboxes: "code written" and "deployed" — and is NOT completed until both are ticked

---

### D. Money-surface tickets (any pill / drill / leaf / chart that shows a user's money)

**Added 2026-05-31.** New failure mode (per the doc's own §"When to update" rule): the 2026-05-31 pension rebuild passed §A and §B on every pass — evidence string filled, build green, snaps clean, numbers tied out, spec cited — and the founder *still* rejected it five times running. Because §A/§B check **build-integrity**, not **domain & experience completeness**. The IFA/compliance/dataviz/drillability lenses existed as skills but were never *in the gate* — they ran reactively, scoped to whatever the founder had just flagged. That is the "founder is the QA" loop. This gate closes it.

In addition to the 5-field evidence string + §B (it is also a UI ticket), ALL of these lens checks must PASS, and **they run BEFORE the founder sees the work, not after:**

- [ ] **IFA completeness** (`sonuswealth-ifa-auditor`) — no top-tier ("face-fall") finding open. Specifically: shows **income (£/yr), not only capital**; projections are **full-lifecycle** (accumulate → draw down), not accumulation-only; growth is **per-asset + shown as a range** (low/mid/high), never one confident line; **DB-vs-DC resolved** before any pot value/TFC/drawdown is rendered; state pension + other income integrated where relevant.
- [ ] **FCA compliance** (`sonuswealth-compliance`) — **no RED**. Projections labelled "your assumption, not a forecast"; user-adjustable inputs **bounded** to defensible ranges; guided actions framed as **general principle, not a personal recommendation**; any relief/benefit figure **conditioned on verified facts** (relevant earnings, MPAA, drawing status).
- [ ] **Drillability** (`drillability-checker`) — every number drills to source → formula → provenance, and **every aggregate drills to its constituents down to the real leaf** (e.g. pension → funds → per-fund history). No dead-ends. PP-3.
- [ ] **Data-viz** (`sonuswealth-dataviz-critic` + `chart-or-table-decider`) — every visual **communicates** (scale, legend, labels), is the **right chart type**, and is not decorative-only. PP-11.
- [ ] **Accuracy** (`accuracy-auditor`) — no hardcoded UK figure; every threshold reads from the rules bundle / `TAX`.

**How it runs (this is the part that removes the founder as QA):** the five lenses are dispatched **in parallel** (Workflow orchestration) against the built surface; findings are fixed and the surface re-gated until all five PASS; only then does it reach the founder. The founder reviews **direction + gate-passed work** — never hunts faults. A money-surface ticket with any open lens finding stays `in_progress`.

**The one thing this gate does NOT catch — and no gate can:** *"is this the right product, conceived the right way for this user's actual job?"* That is product vision, not a checklist, and it stays a human call (founder + a product owner who lives in the domain). The gate guarantees every surface is **complete, correct, compliant, legible, and deep**; it does not guarantee it's the **right surface**. Don't pretend it does.

---

## The "partial done" trap — banned

The pattern: ship the scaffold, leave the wiring, mark the ticket done, move on. Every L3 ticket in this project that came back as a complaint started this way.

**Rule:** if a ticket has any of these phrases in its description or summary, the status MUST be `in_progress`, not `completed`:

- "foundation done"
- "pattern proven, sweep deferred"
- "client side complete, deploy pending" → use the two-checkbox pattern in §C instead
- "demo done, full pass to follow"
- "ready for verification"
- "smoke-test green, full audit deferred"

If the work genuinely splits into "foundation" + "sweep," create TWO tickets. Close the first, leave the second open. Don't roll them into one mushy "DONE (partial)" entry.

---

## The weekly cross-app verification pass (cadence answer)

The founder's question — "what stops us doing this 4 more times?" — also needs a recurring check, not just per-ticket discipline.

**Once per week** (suggested: Friday), run the full-app verification:

1. **Engine layer:** `npm run test:dynamic` 12/12 personas — must be 0 fails
2. **Engine layer:** `npm run test:home` (if it exists) — must be 0 fails
3. **UI layer:** MCP snap at 3 viewports × 2 themes × 4 personas across the 7 main routes. Diff against last week's snapshots. Anything that moved more than a known-change list = surfaces immediately.
4. **Deploy layer:** `supabase functions list` — every function we authored should be in the list. If `content-pull`, `ask-sonu-proxy`, `dsar-export`, `cron-context-pull`, `cron-rules-activation` aren't all present, that's the gap.
5. **Build layer:** CI green on `main` for the last 5 commits.

Any failure here creates a ticket immediately. Failures aren't "we'll come back to it" — they're the signal that the discipline slipped.

---

## How this stops the pattern

The 200-ticket pile happened because:
- Code was written. Tests weren't.
- "Done" was self-declared. Evidence wasn't.
- New work surfaced during execution. The old ticket flipped to ✓ anyway.

The 5-field evidence string + the partial-done ban + the weekly verification together close all three loops:

| Failure mode | Closed by |
|---|---|
| "I wrote code, it must work" | `test:` field in evidence string + category-specific test gate |
| "It works for the happy path" | 12-persona dynamic harness for engine; 4-persona snap for UI |
| "Done means scaffolded" | Partial-done ban — no "foundation done" closures |
| "We'll deploy it later" | Two-checkbox pattern in §C |
| "It used to work" | Weekly cross-app verification + last-week diff |
| "Tests + snaps pass but it's financially shallow / non-compliant / capital-not-income / dead-ends instead of drilling" | §D money-surface lens gate (IFA + compliance + drillability + dataviz + accuracy), run in parallel BEFORE the founder sees it |

---

## When to update this doc

Update only when:
1. A new category of work emerges (e.g. ML model tickets — would need its own §D)
2. A new failure mode surfaces that the current gates didn't catch — add the gate that would have caught it
3. A gate proves to be theatre rather than safety — remove it

DO NOT update to weaken a gate because a specific ticket "feels overkill." That's the path that built the 200-ticket pile.

---

**Last updated:** 2026-05-28 (initial draft)
