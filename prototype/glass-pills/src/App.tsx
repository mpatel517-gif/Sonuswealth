import React from 'react';
import GlassPills from './components/GlassPills';

export default function App() {
  const initial = [
    { id: 'p1', label: 'Input', amount: 100 },
    { id: 'p2', label: 'Validate', amount: 0 },
    { id: 'p3', label: 'Review', amount: 50 },
    { id: 'p4', label: 'Finalize', amount: 0 }
  ];

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--bg)', color: 'var(--muted)' }} data-theme="dark">
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ color: 'var(--muted)' }}>Glass Theme — Pills & Validation Prototype</h1>

        <div className="glass" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Wealth Overview (placeholder chart)</h2>
          <div style={{ height: 240, borderRadius: 8, background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            TradingView / Lightweight chart goes here
          </div>
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Priority Actions — reorder & validate</h3>
          <GlassPills initial={initial} />
        </div>
      </div>
    </div>
  );
}
