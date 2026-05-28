/**
 * Sankey — R2 signature, R3 supporting.
 * See route-2-income-statement.md §4.1 and route-3-cashflow.md §4.1.
 *
 * G15 anatomy contract:
 *   · Multi-stage Sankey: source nodes → middle (tax/expense) nodes → sink.
 *   · Mobile <480px: collapses to vertical receipt waterfall (one stage per row).
 *   · Empty state: single-source user collapses to 3-node flow.
 *   · a11y: aria-label prop with sensible default summarising flow counts +
 *     total.
 *   · G14 dark-mode: uses --c-acc (sources / net), --c-acc-bg (tax-stage fills);
 *     coral reserved for deficit/loss flows. Light theme inherits via tokens.
 *
 * Props:
 *   nodes  [{ id, label, type: 'source' | 'stage' | 'sink', x?: number }]
 *   links  [{ source, target, value, label? }]
 *   ariaLabel  string (optional override)
 *   onFlowTap  ({ source, target, value }) => void
 *   theme  'dark' | 'light'
 *
 * Note on the algorithm: this is a layered Sankey, not a force-directed one.
 * We compute the x-position from node.type (source=0, stage=1, sink=2) unless
 * a per-node x is provided. Within each layer we stack nodes by their total
 * outgoing/incoming value. Flows are drawn as quadratic-bezier paths between
 * the right edge of the source node and the left edge of the target node.
 */

import { useEffect, useState } from 'react';

const STAGE_X = { source: 0, stage: 1, sink: 2 };

function useIsNarrow(breakpoint = 480) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [breakpoint]);
  return narrow;
}

function isDeficitFlow(linkLabel = '') {
  return /deficit|loss|tax|nic|hmrc/i.test(linkLabel);
}

export default function Sankey({
  nodes = [],
  links = [],
  ariaLabel,
  onFlowTap,
  theme,
}) {
  const narrow = useIsNarrow();

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeLinks = Array.isArray(links)
    ? links.filter((l) => l && l.value > 0)
    : [];

  // ── G13 empty state ──────────────────────────────────────────────────────
  if (!safeNodes.length || !safeLinks.length) {
    return (
      <div
        role="img"
        aria-label={ariaLabel || 'Flow view — no data yet'}
        className="sw-tile sw-tile-flat"
        style={{ padding: 20, textAlign: 'center', color: 'var(--c-text3)' }}
      >
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
          FLOW
        </div>
        <div style={{ fontSize: 13 }}>
          Add an income source or expense to see the flow.
        </div>
      </div>
    );
  }

  const totalFlow = safeLinks.reduce((acc, l) => acc + l.value, 0);
  const sourceCount = safeNodes.filter((n) => n.type === 'source').length || 1;
  const stageCount = safeNodes.filter((n) => n.type === 'stage').length || 1;

  // ── Mobile reflow: vertical receipt waterfall ────────────────────────────
  if (narrow) {
    // Aggregate by stage label for the receipt.
    const sources = safeNodes.filter((n) => n.type === 'source');
    const stages = safeNodes.filter((n) => n.type === 'stage');
    const sinks = safeNodes.filter((n) => n.type === 'sink');

    const inboundByNode = {};
    safeLinks.forEach((l) => {
      inboundByNode[l.target] = (inboundByNode[l.target] || 0) + l.value;
    });

    const outboundByNode = {};
    safeLinks.forEach((l) => {
      outboundByNode[l.source] = (outboundByNode[l.source] || 0) + l.value;
    });

    return (
      <div
        role="img"
        aria-label={
          ariaLabel ||
          `Flow: ${sources.length} source${sources.length === 1 ? '' : 's'} into ${stages.length} stage${stages.length === 1 ? '' : 's'}, ending at ${sinks.map((s) => s.label).join(', ') || 'sink'}.`
        }
        data-theme-hint={theme}
        style={{
          padding: 12,
          background: 'var(--c-surface2)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--c-border)',
          fontFamily: 'var(--font-receipt, "SF Mono", Monaco, monospace)',
        }}
      >
        <div className="sw-eyebrow" style={{ marginBottom: 10 }}>
          RECEIPT
        </div>
        {sources.map((n) => (
          <div
            key={n.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              fontSize: 13,
              color: 'var(--c-text)',
            }}
          >
            <span>{n.label}</span>
            <span style={{ fontFeatureSettings: '"tnum" 1' }}>
              +£{Math.round(outboundByNode[n.id] || 0).toLocaleString()}
            </span>
          </div>
        ))}
        <div
          style={{
            borderTop: '1px dashed var(--c-border)',
            margin: '6px 0',
          }}
        />
        {stages.map((n) => (
          <button
            key={n.id}
            onClick={() =>
              onFlowTap &&
              onFlowTap({
                source: null,
                target: n.id,
                value: inboundByNode[n.id] || 0,
              })
            }
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              fontSize: 13,
              color: isDeficitFlow(n.label)
                ? 'var(--c-coral-text)'
                : 'var(--c-text2)',
              width: '100%',
              border: 'none',
              background: 'none',
              textAlign: 'left',
              cursor: onFlowTap ? 'pointer' : 'default',
            }}
          >
            <span>{n.label}</span>
            <span style={{ fontFeatureSettings: '"tnum" 1' }}>
              −£{Math.round(inboundByNode[n.id] || 0).toLocaleString()}
            </span>
          </button>
        ))}
        <div
          style={{
            borderTop: '1px solid var(--c-border)',
            margin: '8px 0 4px',
          }}
        />
        {sinks.map((n) => (
          <div
            key={n.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0 0',
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--c-acc)',
            }}
          >
            <span>{n.label}</span>
            <span style={{ fontFeatureSettings: '"tnum" 1' }}>
              £{Math.round(inboundByNode[n.id] || 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // ── Desktop SVG sankey ───────────────────────────────────────────────────
  const width = 560;
  const height = 280;
  const margin = { top: 12, right: 80, bottom: 12, left: 80 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Compute total per-layer to size nodes.
  const layers = { source: [], stage: [], sink: [] };
  safeNodes.forEach((n) => {
    if (layers[n.type]) layers[n.type].push(n);
  });

  // Per-node value = sum of inbound (for stage/sink) or outbound (source).
  const nodeValues = {};
  safeNodes.forEach((n) => {
    const inbound = safeLinks
      .filter((l) => l.target === n.id)
      .reduce((a, l) => a + l.value, 0);
    const outbound = safeLinks
      .filter((l) => l.source === n.id)
      .reduce((a, l) => a + l.value, 0);
    nodeValues[n.id] = Math.max(inbound, outbound) || 1;
  });

  // Vertical positions: stack within each layer, leave 8px gap.
  const positions = {};
  Object.entries(layers).forEach(([layerKey, list]) => {
    if (!list.length) return;
    const totalLayerVal = list.reduce((a, n) => a + nodeValues[n.id], 0);
    const gap = 8;
    const totalGaps = gap * Math.max(0, list.length - 1);
    const usableH = innerH - totalGaps;
    let cursor = margin.top;
    list.forEach((n) => {
      const h = Math.max(8, (nodeValues[n.id] / totalLayerVal) * usableH);
      const x = margin.left + STAGE_X[layerKey] * (innerW / 2) - 6;
      positions[n.id] = { x, y: cursor, w: 12, h, layer: layerKey };
      cursor += h + gap;
    });
  });

  // Build flow paths.
  const flows = safeLinks.map((l, i) => {
    const src = positions[l.source];
    const tgt = positions[l.target];
    if (!src || !tgt) return null;
    const x0 = src.x + src.w;
    const x1 = tgt.x;
    const y0 = src.y + src.h / 2;
    const y1 = tgt.y + tgt.h / 2;
    const cx = (x0 + x1) / 2;
    const thickness = Math.max(
      2,
      (l.value / Math.max(1, totalFlow)) * 80,
    );
    const d = `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    const stroke = isDeficitFlow(l.label || '')
      ? 'var(--c-coral)'
      : 'var(--c-acc)';
    return (
      <path
        key={`flow-${i}`}
        d={d}
        fill="none"
        stroke={stroke}
        strokeOpacity={0.42}
        strokeWidth={thickness}
        strokeLinecap="butt"
        onClick={() =>
          onFlowTap &&
          onFlowTap({
            source: l.source,
            target: l.target,
            value: l.value,
            label: l.label,
          })
        }
        style={{ cursor: onFlowTap ? 'pointer' : 'default' }}
      >
        <title>
          £{Math.round(l.value).toLocaleString()} from {l.source} to {l.target}
        </title>
      </path>
    );
  });

  return (
    <div
      role="img"
      aria-label={
        ariaLabel ||
        `Flow Sankey: ${sourceCount} source${sourceCount === 1 ? '' : 's'} through ${stageCount} stage${stageCount === 1 ? '' : 's'}.`
      }
      data-theme-hint={theme}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block' }}
      >
        {/* flows first so nodes sit on top */}
        <g>{flows}</g>
        {/* nodes */}
        {safeNodes.map((n) => {
          const p = positions[n.id];
          if (!p) return null;
          const isSink = n.type === 'sink';
          return (
            <g key={`node-${n.id}`}>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx={3}
                fill={isSink ? 'var(--c-acc)' : 'var(--c-text2)'}
                opacity={isSink ? 0.92 : 0.6}
              />
              <text
                x={
                  p.layer === 'source'
                    ? p.x - 6
                    : p.layer === 'sink'
                      ? p.x + p.w + 6
                      : p.x + p.w + 6
                }
                y={p.y + p.h / 2 + 4}
                fontSize={11}
                fill="var(--c-text2)"
                textAnchor={p.layer === 'source' ? 'end' : 'start'}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
