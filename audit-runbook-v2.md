# Sonuswealth Screen Audit — Runbook v2

**Scope:** all six screens — Home, My Money, Cashflow, Tax & Estate, Risk, Timeline —
**internals audited** plus **cross-screen reconciliation**. Supersedes runbook v1
(Home-only).

**For:** Claude Code (CLI). The main session is the **orchestrator** — it dispatches
sub-agents, merges findings, drives fixes, and decides when to stop. You do not need a
separate "master agent" file; the main thread is the master.

---

## 0. One-time setup (from the repo root)

```
mkdir -p .claude/skills .claude/agents audit-findings
cp -r home-audit-kit/claude-config/skills/*  .claude/skills/
cp    home-audit-kit/claude-config/agents/*  .claude/agents/
cp    home-audit-kit/*-inventory-v1.md       ./
cp    home-audit-kit/audit-runbook-v2.md     ./
```

`/agents` should list: `inventory-builder`, `conformance-auditor`, `interaction-auditor`,
`reconciliation-auditor`, `domain-auditor`, `scenario-auditor`.

---

## 1. Baselines

| Layer | Baseline | Authority |
|-------|----------|-----------|
| Structure / layout | each screen's HTML mockup if one exists; else its React component | structural truth |
| Numbers / shared values | engine — `rules-uk.js`, `src/engine/fq-calculator.js`, `timeline-engine.js` | reconciliation truth |
| Intent / plain-English / FCA | `2-Product-<screen>-*.md` | reference only — some specs are current, the Home spec is stale |
| Element coverage | `<screen>-inventory-v1.md` | the fixed checklist |

Two inventories ship pre-built: `home-inventory-v1.md` (complete, the template) and
`mymoney-inventory-v1.md` (a SEED from screenshots). The other four are built by the
`inventory-builder` (stage A).

---

## 2. The four stages

```
A. INVENTORY   — inventory-builder enumerates each screen → 6 inventories. Founder reviews.
B. PER-SCREEN  — the 5-auditor loop runs on each screen until its stopping rule fires.
C. CROSS-SCREEN— one global reconciliation pass once all 6 inventories exist.
D. DONE        — every screen ledgered at 100% coverage, no open DEMO-BLOCKING/FUNCTIONAL.
```

---

## 3. Severity tiers (orchestrator assigns; agents propose)

| Tier | Definition | Demo-day disposition |
|------|-----------|----------------------|
| **DEMO-BLOCKING** | dead element, wrong route, wrong number, dead-end, build placeholder visible | must fix before May 31 |
| **FUNCTIONAL** | works but inconsistent, mislabelled, imperfect landing | fix before May 31 if time; else triage |
| **POLISH** | cosmetic | post-demo backlog, never on the critical path |

---

## 4. Roles

| Role | Who | Writes |
|------|-----|--------|
| Orchestrator | main CLI thread | dispatch, the ledgers |
| inventory-builder | sub-agent | `<screen>-inventory-v1.md` |
| 5 auditors | sub-agents | `audit-findings/<screen>/pass-N/<agent>.md` |
| Fixer | `general-purpose` sub-agent or main thread | code patches + `fixlog.md` |

Auditors and the inventory-builder never edit `src/`. The thing that finds problems is
not the thing that fixes them away.

---

## 5. Stage A — build the inventories (pass 0 per screen)

For each screen with no inventory yet (Cashflow, Tax & Estate, Risk, Timeline — and
complete the My Money seed):

> Dispatch `inventory-builder` for <screen>. Give it the component path, the
> `home-inventory-v1.md` template, and any HTML mockup / spec in the repo. It writes
> `<screen>-inventory-v1.md` and stops.

**Founder gate:** Mihir eyeballs each generated inventory (~10 min) — *is every element
on my screen a row?* This is the cheapest, highest-leverage check in the whole process.
The audit is only as complete as the inventory. Do not start stage B for a screen until
its inventory is founder-reviewed.

---

## 6. Stage B — the per-screen audit loop

For one screen, one pass:

```
PASS N
  1. DISPATCH  — orchestrator spawns all 5 auditors in parallel on this screen.
                 Each gets the screen name + its inventory + "key every finding to an
                 element ID".
  2. COLLECT   — each returns audit-findings/<screen>/pass-N/<agent>.md. A finding with
                 no element ID is rejected and sent back.
  3. MERGE     — orchestrator builds audit-ledger-<screen>-passN.md: one row per
                 (element ID × finding), deduped, severity assigned; updates the
                 inventory verdict columns; computes Coverage %.
  4. GATE      — Coverage < 100% → re-dispatch auditors for the unverified rows only.
                 A pass is not a pass until every row has a verdict.
  5. FIX       — Fixer applies DEMO-BLOCKING + FUNCTIONAL from the ledger. POLISH →
                 home-audit-backlog.md. Every fix cites the element ID it closes.
  6. REGRESS   — run engine smoke tests + the screen's interaction smoke
                 (npm run test / node test-<screen>-screen.js). A fix that breaks a
                 green test is reverted, not kept.
  7. RE-AUDIT  — go to PASS N+1; fixed rows are re-tested from scratch.
```

**Why this compounds and flat re-reads do not:** the build *changes* between passes
(audit → fix → re-audit). Re-running an unchanged file ten times yields ten copies of the
same blind spots — repetition, not compounding.

---

## 7. Stage C — cross-screen reconciliation pass

Run once all six inventories exist (it needs both ends of every comparison). Dispatch the
`reconciliation-auditor` in global mode:

> Build the full reconciliation matrix across all six screens. For every shared value
> (Net Worth, Wealth Score, Risk Score, Cost of Inaction, dimension scores, deadlines),
> assert: same engine function, same value, same `fmt()` format on every screen it
> appears. Write `audit-ledger-reconciliation.md`.

Findings here are fixed and then the affected screens get one more stage-B pass.

---

## 8. STOPPING RULE (per screen)

Stop a screen's loop when **both** hold:
1. **Two consecutive passes** with **zero new DEMO-BLOCKING and zero new FUNCTIONAL**
   findings (POLISH-only allowed in the final pass).
2. Coverage = 100% on both.

Hard cap **6 passes per screen**. If the cap is hit with open DEMO-BLOCKING items, **STOP
and escalate to Mihir** — a cap-hit means something structural is wrong and more passes
will not fix it.

"Run it 10 times" is not the rule. The number of passes is whatever the rule needs —
usually 3–5.

---

## 9. THE 2-DAY PLAN (honest)

Six screens to full stopping-rule convergence in two days is unlikely. What two days
**can** deliver — and what to aim for — is total visibility plus a clean demo:

| | Block | Work | Output |
|---|------|------|--------|
| **Day 1 AM** | Stage A | inventory-builder on Cashflow, T&E, Risk, Timeline (parallel); complete the My Money seed. Founder reviews all six (~1 hr). | 6 founder-reviewed inventories |
| **Day 1 PM** | Stage B pass 1 | 5 auditors × 6 screens (parallelise hard — screens are independent). Merge into 6 ledgers. | **The whole iceberg, ranked. No more "tip of the iceberg."** |
| **Day 2 AM** | Fix | Fixer works **severity-first across all screens**: every DEMO-BLOCKING first (a blocker anywhere breaks the demo), then FUNCTIONAL by impact. Regress after each batch. | DEMO-BLOCKING closed |
| **Day 2 PM** | Stage B pass 2 + Stage C | Re-audit fixed screens; run the cross-screen reconciliation pass; triage remaining FUNCTIONAL; backlog POLISH. | Every screen ledgered at 100% coverage; reconciliation done |

**Realistic 2-day outcome:** all six screens fully ledgered at 100% coverage, every
DEMO-BLOCKING fixed, reconciliation complete, FUNCTIONAL triaged, POLISH backlogged.
**Full stopping-rule convergence on all six may need a pass 3 that spills past the
window** — that is expected; flag it, do not fake it.

Fix order is **severity-first, not screen-first**. Do not perfect Home while a
DEMO-BLOCKING bug sits on Risk.

---

## 10. Inventory drift rule

Within a pass the inventory is fixed. Between passes it changes only when an auditor
finds a build element not listed (→ add row, mark `UNLISTED-ADDED`) or a fix removes an
element (→ mark `REMOVED` with the fixlog reference). Every drift event is logged in the
ledger's `§drift`. Silent inventory edits are forbidden — that is how coverage gets
gamed.

---

## 11. Dispatch prompts (copy/paste)

**Stage A (per screen):**
> Build the inventory for <screen>. Dispatch `inventory-builder` with the component path
> and the `home-inventory-v1.md` template. Stop when it writes `<screen>-inventory-v1.md`.

**Stage B (per screen, per pass):**
> Run the <screen> audit pass N. Read `<screen>-inventory-v1.md`, follow
> `audit-runbook-v2.md`. Spawn all five auditors in parallel; each writes to
> `audit-findings/<screen>/pass-N/<agent>.md`, every finding keyed to an element ID.
> Merge into `audit-ledger-<screen>-passN.md`, assign severity, update inventory
> verdicts, report Coverage %. Show me the ledger before fixing.

**Stage C:**
> Run the cross-screen reconciliation pass per runbook §7.

---

## 12. Definition of done

Done when, for every screen, the stopping rule has fired with no open
DEMO-BLOCKING/FUNCTIONAL, and each final ledger states, with real numbers:

> *"<Screen> inventory: Y rows. Coverage 100%. X PASS. 0 FAIL at
> DEMO-BLOCKING/FUNCTIONAL. Z POLISH backlogged."*

…plus `audit-ledger-reconciliation.md` showing zero cross-screen mismatches. That set of
sentences — with real numbers — is the only valid form of "99% confident."

---

*— end audit-runbook-v2.md —*
