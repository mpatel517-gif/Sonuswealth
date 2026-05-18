# Decision Engine — Stage B Pass-2 SUMMARY
**Date:** 2026-05-18

## DB fixes verification

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| DB-1 | Brand filter gap — fcaRewriteTree() only filtered consequence text, not statement/option names/rationale | FIXED | fca-rewrite.js line 71: rw(tree.statement); lines 74-79: rw(opt.name), rw(opt.summary), rw(opt.rationale) per option; lines 82-91: recommendation.rationale also rewritten. All four field groups covered. |
| DB-2 | Ask bypass — intent=act never opened DE tree | FIXED | Ask.jsx line 1020: if (intent === 'act') setDecisionEngine({ topic: q.slice(0, 60) }) fires on success path. Line 1039: same in demo-fallback path. Both code paths covered. |
| DB-3 | Commit broken — no confirmation after commit | PARTIAL | OptionCard.jsx has "Commit to this path" button (line 227) wired through to orchestrator.commitPath() which calls commitPlanDE + logCommit. Persistence works. BUT: no confirmation overlay, toast, or in-screen success state exists. handleCommit in DecisionEngineV2 immediately calls onClose({ committed: true }). Silent close on high-irreversibility path is a UX gap. DB-3 was about broken commit; commit now executes but UX confirmation is absent. |
| DB-4 | VITE_ANTHROPIC_API_KEY error string exposed to user | FIXED | tree-generator.js line 25: throws Error('service_unavailable') — generic code, not the env var name. DecisionEngineV2.jsx lines 288-290: renders 'Service temporarily unavailable — please try again later.' for that code; all other errors get 'Something went wrong — please try again.' No env var name leaked. |
| DB-5 | enforceOptionsCount — tree could have 0 or 5+ options | FIXED | tree-generator.js lines 75-100: enforceOptionsCount() truncates >4 to exactly 4 (keeps 3 main + D), pads <4 with makePlaceholderOption(). Applied at pipeline step 5 (line 150) before return. |
| DB-6 | horizon field missing from response contract | FIXED | Two-layer fix: (1) composer.js RESPONSE_CONTRACT lines 349 and 400-401 mark horizon as REQUIRED; (2) tree-generator.js lines 135-143: horizon guard defaults to current UK tax year end if Claude omits it, with console.warn. |
| DB-7 | Home has no DE entry point — WONT-FIX (wired via WhatIf) | CONFIRMED WONT-FIX | DecisionEngineV2.jsx comment line 8 confirms opens from HomeScreen entry point and WhatIf cinema chips. No regression. |

## Regressions found

None. Pipeline order is correct: fcaRewriteTree (step 4) runs before enforceOptionsCount (step 5), so FCA rewrites apply to placeholder-padded options too.

## New findings

NF-1 (DB-3 residual — demo-blocker severity): Commit has no user-facing confirmation. handleCommit in DecisionEngineV2.jsx (lines 223-226) calls orc.commit(pathId) then immediately calls onClose({ committed: true, planId, pathId }). If onClose is undefined (DE opened standalone), call is a no-op and user gets zero feedback. Even when onClose is wired, the sheet just closes silently. For a high-irreversibility path (e.g. pension drawdown trigger), silent close is problematic. Recommend: add inline "Path committed — saved to your plan" toast or overlay in OptionCard.jsx or DecisionEngineV2.jsx before close.

NF-2 (minor): classifyIntent() in Ask.jsx line 123 uses ^ anchor — matches intent=act only if query starts with act/commit/do/execute/etc. "I want to act on my IHT" (mid-sentence act) classifies as explain and skips DE. Narrow coverage. Low severity for demo; flag for pre-launch.

NF-3 (minor): useOrchestrator in orchestrator.js line 239 uses require('react') inside a hook body. Non-standard; potential tree-shaking or strict ESM issue. Works at runtime in Vite. Low severity.

## Verdict

NEEDS-WORK — 1 item still needs attention

DB-3 (commit confirmation) is partially resolved: commit now executes correctly (persists to plan store via commitPlanDE, logs via logCommit). The UX confirmation overlay is absent — user receives no in-screen feedback that their commit landed. All other pass-1 DEMO-BLOCKING findings (DB-1 through DB-6) are fully resolved.

Priority fix: Add commit-success overlay or toast in OptionCard.jsx or DecisionEngineV2.jsx before calling onClose.
