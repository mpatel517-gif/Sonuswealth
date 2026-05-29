/**
 * Sonuswealth · src/state/step-up.jsx
 *
 * <StepUpProvider> — installs the modal that handles step-up challenges
 * requested via `requireStepUp()` from `src/lib/step-up.js`.
 *
 * Mount once at App root (inside AuthProvider). The provider has no public
 * props; sensitive ops just call `await requireStepUp({ reason })`.
 *
 * v0 challenge UI: re-enter password. Verified against Supabase Auth by
 * calling signInWithPassword with the current user's email. On success,
 * the lib sets a 5-minute elevated window.
 */

import { useEffect, useRef, useState } from 'react';
import { _installModalOpener, verifyPassword } from '../lib/step-up.js';
import { useAuth } from './auth.jsx';

export function StepUpProvider({ children }) {
  const { user, isDemo } = useAuth();
  const [req, setReq] = useState(null); // { reason, level, resolve, reject } or null
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Keep latest req in a ref so the registered opener never closes over a
  // stale value.
  const reqRef = useRef(null);
  reqRef.current = req;

  useEffect(() => {
    const uninstall = _installModalOpener((incoming) => {
      // Demo mode → fail-open. Founder demos don't need re-password every
      // sensitive op.
      if (isDemo) {
        incoming.resolve({ ok: true });
        return;
      }
      setError('');
      setPassword('');
      setReq(incoming);
    });
    return uninstall;
  }, [isDemo]);

  function cancel() {
    const current = reqRef.current;
    if (current) current.resolve({ ok: false, cancelled: true });
    setReq(null);
    setPassword('');
    setError('');
    setBusy(false);
  }

  async function submit() {
    const current = reqRef.current;
    if (!current || busy) return;
    setBusy(true);
    setError('');
    try {
      // Re-password: verify against the signed-in user's email.
      if (!user?.email) {
        setError('No active session. Sign in first.');
        return;
      }
      const r = await verifyPassword(user.email, password);
      if (!r.ok) {
        setError(r.error || 'Incorrect password.');
        return;
      }
      current.resolve({ ok: true });
      setReq(null);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {children}
      {req && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="step-up-title"
          onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            width: '100%', maxWidth: 360,
            background: 'var(--c-surface)', border: '1px solid var(--c-border2)',
            borderRadius: 20, padding: 24, boxShadow: 'var(--sh2)',
          }}>
            <div id="step-up-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', marginBottom: 6 }}>
              Confirm your identity
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 16 }}>
              {req.reason}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <label htmlFor="step-up-password" style={{
                display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--c-text3)',
                marginBottom: 6, textTransform: 'uppercase', letterSpacing: .8,
              }}>Password</label>
              <input
                id="step-up-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                style={{
                  width: '100%', padding: '14px 16px', marginBottom: 12,
                  background: 'var(--c-surface2)', border: '1.5px solid var(--c-border)',
                  borderRadius: 14, color: 'var(--c-text)', fontSize: 15, outline: 'none',
                }}
              />

              {error && (
                <div role="alert" style={{
                  background: 'var(--c-coral, #FCE4E4)', color: 'var(--c-coral-text, #8B1F1F)',
                  border: '1px solid var(--c-coral-border, #F2B8B8)',
                  borderRadius: 10, padding: '10px 12px', marginBottom: 12,
                  fontSize: 12, lineHeight: 1.4,
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={cancel} disabled={busy} style={{
                  flex: 1, padding: 12, borderRadius: 100,
                  background: 'var(--c-surface2)', border: '1px solid var(--c-border2)',
                  color: 'var(--c-text)', fontSize: 14, fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={busy} style={{
                  flex: 1, padding: 12, borderRadius: 100,
                  background: 'var(--c-acc)', color: 'var(--c-acc-contrast, #0B1F3A)',
                  border: 'none', fontSize: 14, fontWeight: 700,
                  cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
                }}>{busy ? 'Verifying…' : 'Confirm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
