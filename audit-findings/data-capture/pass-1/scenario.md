# A5 Scenario — Scenario / What-If Audit · DataCapture · Pass 1
**Auditor:** Scenario
**Date:** 2026-05-18
**Component:** `src/screens/DataCapture.jsx`

---

## Scope
Audit any what-if, preview, or score-impact features on data entry (e.g. "see how this changes your score"). If none, confirm NA and note any adjacent affordances.

---

## Findings

### No what-if / scenario features present

The DataCapture screen contains **no what-if, score-preview, or scenario simulation features**. It is a pure data-ingestion screen. No affordances exist that:
- Show a score change preview before commit
- Simulate "what would happen if I add this asset"
- Offer scenario branching
- Display projected impact of the captured data

This is architecturally correct per FD-DC-3: the screen emits `onCommit` envelopes; score recomputation is downstream. Showing a score delta on this screen before the envelope is processed would be premature and potentially misleading.

### Adjacent observations

1. **No post-commit feedback.** After `commitCapture()` fires, the modal closes and the user returns to the channel list with no confirmation message, no score-delta summary, no "added to your profile" feedback. While not a scenario feature, the absence of any post-commit signal (even "3 fields added") means users have no way to verify their data landed. FUNCTIONAL (covered in interaction.md A4-01).

2. **FP-5 confidence chips are a lightweight preview.** The confidence coloring (green/amber/red) gives users a signal of parse quality before accepting. This is the closest the screen comes to a "preview" feature — it previews field reliability not financial impact. Working correctly. ✓

3. **Manual form: no running total.** If a user manually adds multiple entries in sequence (one field per session), there is no running tally visible on the main screen. This is scope-appropriate for Wave 1.

---

## Verdict

**SCENARIO: N/A** — No what-if or score-impact features on this screen. Absence is architecturally correct.

No scenario-specific findings to raise.
