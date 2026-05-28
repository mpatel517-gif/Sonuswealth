/**
 * v0.3 Phase 2 shared chart kit — barrel.
 * Authored against route-specs MASTER §3 + per-route §4 anatomy tables.
 *
 * One component, one route signature (or one cross-cutting reuse). Downstream
 * route builders (Phases 4-7) MUST consume from this barrel rather than
 * inventing per-route variants. Five incompatible Sankey APIs is the failure
 * mode this barrel prevents.
 */

export { default as Marimekko } from './Marimekko.jsx';
export { default as Sankey } from './Sankey.jsx';
export { default as CalendarHeatmap } from './CalendarHeatmap.jsx';
export { default as SharedBullet } from './SharedBullet.jsx';
export { default as LiquidityLadder } from './LiquidityLadder.jsx';
export { default as TaxTreatmentBlock } from './TaxTreatmentBlock.jsx';
export { default as IHTDeltaCard } from './IHTDeltaCard.jsx';
export { default as EstateVault } from './EstateVault.jsx';
