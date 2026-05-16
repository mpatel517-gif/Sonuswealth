// ─────────────────────────────────────────────────────────────────────────────
// Barrel export — every shared primitive in one import
//
// Usage:
//   import {
//     X28TopBar, DiffBadge, DeltaChip, CausalityStripe, DiffPulse,
//     HotspotIndicator, ExplainerChip, EXPLAINERS,
//     PlanStalenessBanner, CoIOdometer, RevealCard, Num, ProvenanceChip,
//     CrossMap5x5, BeneficiarySankey,
//   } from '../components/shared'
// ─────────────────────────────────────────────────────────────────────────────

// Existing primitives
export { default as OverlayShell }   from './OverlayShell.jsx'
export { default as TripleAnchor }   from './TripleAnchor.jsx'

// New cross-cutting primitives
export {
  default as X28TopBar,
  TIME_WINDOWS,
  VIEW_MODES,
} from './X28TopBar.jsx'

export {
  default as Diff,
  DiffBadge,
  DeltaChip,
  CausalityStripe,
  DiffPulse,
  HotspotIndicator,
} from './Diff.jsx'

export {
  default as ExplainerChip,
  EXPLAINERS,
} from './Explainer.jsx'

export { default as PlanStalenessBanner } from './PlanStalenessBanner.jsx'
export { default as CoIOdometer }         from './CoIOdometer.jsx'
export { default as RevealCard }          from './RevealCard.jsx'
export { default as Num, fmtNum }         from './Num.jsx'
export { default as ProvenanceChip }      from './ProvenanceChip.jsx'
export { default as AskPill }             from './AskPill.jsx'
export { default as GLOSSARY, Term }      from './Glossary.jsx'

// Animation / reveal primitives (pair with src/styles/animations.css and
// src/hooks/useAnimation.jsx)
export {
  default as Reveal,
  FadeInOnMount,
  RevealStagger,
  DrawSVG,
  Skeleton,
} from './Reveal.jsx'

// Cross-domain primitives (re-exported so screens can find them in one place)
export { default as CrossMap5x5 }         from '../Risk/CrossMap5x5.jsx'
export { default as BeneficiarySankey }   from '../Estate/BeneficiarySankey.jsx'
