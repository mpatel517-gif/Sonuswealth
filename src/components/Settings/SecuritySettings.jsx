// ─────────────────────────────────────────────────────────────────────────────
// SecuritySettings — Phase 1.5 AU3 + AU4
// Privacy & Security panel: shows MFA status, lets user enroll/unenroll TOTP,
// shows step-up auth status, and signs out.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useAuth } from '../../state/auth.jsx'
import {
  enrollMFA,
  verifyMFAEnrolment,
  listMFAFactors,
  unenrollMFA,
  getAuthLevel,
} from '../../lib/auth.js'
import { requireStepUp, isElevated, elevationRemainingMs } from '../../lib/step-up.js'

export default function SecuritySettings() {
  const { user, isAuthenticated, isEmailVerified, signOut } = useAuth()
  const [factors, setFactors] = useState([])
  const [authLevel, setAuthLevel] = useState({ currentLevel: 'aal1', nextLevel: 'aal1' })
  const [enrolling, setEnrolling] = useState(null) // { factorId, qrCode, secret, uri } | null
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [elevatedTick, setElevatedTick] = useState(0)

  // Re-tick every second when elevated so the countdown updates
  useEffect(() => {
    if (!isElevated()) return
    const id = setInterval(() => setElevatedTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [elevatedTick])

  async function refresh() {
    if (!isAuthenticated) return
    setBusy(true)
    setError('')
    try {
      const [f, a] = await Promise.all([listMFAFactors(), getAuthLevel()])
      if (f.ok) setFactors(f.factors || [])
      if (a.ok) setAuthLevel(a)
    } finally { setBusy(false) }
  }

  useEffect(() => { refresh() }, [isAuthenticated, user?.id])

  async function startEnrolment() {
    setError(''); setInfo(''); setBusy(true)
    // Re-confirm identity before enrolling a new MFA factor
    const stepUp = await requireStepUp({ reason: 'Confirm your identity to enable two-factor authentication.' })
    if (!stepUp.ok) { setBusy(false); return }
    const r = await enrollMFA({ friendlyName: 'Authenticator app' })
    setBusy(false)
    if (!r.ok) { setError(r.error || 'Could not start enrolment.'); return }
    setEnrolling(r)
  }

  async function confirmEnrolment() {
    if (!enrolling || !code) return
    setBusy(true); setError('')
    const r = await verifyMFAEnrolment(enrolling.factorId, code.trim())
    setBusy(false)
    if (!r.ok) { setError(r.error || 'Incorrect code. Try again.'); return }
    setEnrolling(null); setCode('')
    setInfo('Two-factor authentication enabled.')
    refresh()
  }

  async function cancelEnrolment() {
    if (!enrolling) return
    setBusy(true)
    // Best-effort cleanup of the unverified factor
    await unenrollMFA(enrolling.factorId)
    setEnrolling(null); setCode(''); setError('')
    setBusy(false)
  }

  async function removeFactor(factorId) {
    setError(''); setInfo(''); setBusy(true)
    const stepUp = await requireStepUp({ reason: 'Confirm your identity to remove two-factor authentication.' })
    if (!stepUp.ok) { setBusy(false); return }
    const r = await unenrollMFA(factorId)
    setBusy(false)
    if (!r.ok) { setError(r.error || 'Could not remove factor.'); return }
    setInfo('Two-factor authentication disabled.')
    refresh()
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 16, color: 'var(--c-text2)', fontSize: 13 }}>
        Sign in to manage your security settings.
      </div>
    )
  }

  const verifiedFactors = factors.filter(f => f.status === 'verified')
  const hasMFA = verifiedFactors.length > 0
  const remainingS = Math.round(elevationRemainingMs() / 1000)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Identity */}
      <Block title="Identity">
        <Row label="Signed in as" value={user?.email || '—'} />
        <Row label="Email verified" value={isEmailVerified ? 'Yes' : 'Pending — check your inbox'} status={isEmailVerified ? 'ok' : 'warn'} />
        <Row label="Account ID" value={user?.id ? user.id.slice(0, 8) + '…' : '—'} mono />
      </Block>

      {/* Step-up status */}
      <Block title="Recent step-up">
        <Row
          label="Elevated session"
          value={isElevated() ? `Active — ${Math.max(0, remainingS)}s remaining` : 'Not elevated'}
          status={isElevated() ? 'ok' : 'neutral'}
        />
        <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 4 }}>
          Sensitive actions (recording values, removing security factors) require a re-password
          challenge. Once confirmed, you have 5 minutes before being prompted again.
        </div>
      </Block>

      {/* MFA / 2FA */}
      <Block title="Two-factor authentication">
        <Row
          label="Status"
          value={hasMFA ? `Enabled (${verifiedFactors.length} factor${verifiedFactors.length === 1 ? '' : 's'})` : 'Not enabled'}
          status={hasMFA ? 'ok' : 'warn'}
        />
        <Row label="Session assurance" value={authLevel.currentLevel.toUpperCase()} mono />

        {hasMFA && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {verifiedFactors.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: 'var(--c-surface2)',
                border: '1px solid var(--c-border2)', borderRadius: 10,
              }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 600 }}>
                    {f.friendly_name || 'Authenticator'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{f.factor_type?.toUpperCase()}</div>
                </div>
                <button type="button" onClick={() => removeFactor(f.id)} disabled={busy} style={{
                  padding: '6px 12px', borderRadius: 100,
                  background: 'transparent', border: '1px solid var(--c-coral-border, #F2B8B8)',
                  color: 'var(--c-coral-text, #8B1F1F)', fontSize: 12, fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {!hasMFA && !enrolling && (
          <button type="button" onClick={startEnrolment} disabled={busy} style={{
            marginTop: 12, padding: 12, borderRadius: 100,
            background: 'var(--c-acc)', color: 'var(--c-acc-contrast, #0B1F3A)',
            border: 'none', fontSize: 14, fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
          }}>Enable authenticator app</button>
        )}

        {enrolling && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--c-surface2)', border: '1px solid var(--c-border2)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 600, marginBottom: 8 }}>
              Scan this QR with your Authenticator app
            </div>
            {/* Supabase returns QR as a data URI */}
            {enrolling.qrCode && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <img src={enrolling.qrCode} alt="MFA QR code" style={{ width: 180, height: 180, borderRadius: 8, background: 'white' }} />
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', marginBottom: 8 }}>
              Or enter this code manually:
            </div>
            <div style={{
              padding: '8px 12px', textAlign: 'center', fontFamily: 'ui-monospace, Menlo, monospace',
              background: 'var(--c-bg2)', border: '1px solid var(--c-border)', borderRadius: 8,
              fontSize: 13, letterSpacing: 1.5, marginBottom: 12,
            }}>{enrolling.secret}</div>

            <label htmlFor="mfa-code" style={{
              display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--c-text3)',
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: .8,
            }}>6-digit code from app</label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              style={{
                width: '100%', padding: '12px 16px',
                background: 'var(--c-surface)', border: '1.5px solid var(--c-border)',
                borderRadius: 12, color: 'var(--c-text)', fontSize: 18, letterSpacing: 4,
                outline: 'none', textAlign: 'center',
              }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={cancelEnrolment} disabled={busy} style={{
                flex: 1, padding: 10, borderRadius: 100,
                background: 'var(--c-surface)', border: '1px solid var(--c-border2)',
                color: 'var(--c-text)', fontSize: 13, fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
              }}>Cancel</button>
              <button type="button" onClick={confirmEnrolment} disabled={busy || code.length !== 6} style={{
                flex: 1, padding: 10, borderRadius: 100,
                background: 'var(--c-acc)', color: 'var(--c-acc-contrast, #0B1F3A)',
                border: 'none', fontSize: 13, fontWeight: 700,
                cursor: (busy || code.length !== 6) ? 'wait' : 'pointer',
                opacity: (busy || code.length !== 6) ? 0.6 : 1,
              }}>Verify & enable</button>
            </div>
          </div>
        )}
      </Block>

      {/* Sign out */}
      <Block title="Session">
        <button type="button" onClick={signOut} style={{
          padding: 12, borderRadius: 100, width: '100%',
          background: 'transparent', border: '1px solid var(--c-coral-border, #F2B8B8)',
          color: 'var(--c-coral-text, #8B1F1F)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
        }}>Sign out of Sonuswealth</button>
      </Block>

      {(error || info) && (
        <div role={error ? 'alert' : 'status'} style={{
          padding: '10px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.4,
          background: error ? 'var(--c-coral, #FCE4E4)' : 'var(--c-gold-bg, #FFF6E0)',
          color: error ? 'var(--c-coral-text, #8B1F1F)' : 'var(--c-gold-text, #6B4500)',
          border: '1px solid ' + (error ? 'var(--c-coral-border, #F2B8B8)' : 'var(--c-gold-border, #F4D88A)'),
        }}>{error || info}</div>
      )}
    </div>
  )
}

function Block({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--c-text3)',
        textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8,
      }}>{title}</div>
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-border2)',
        borderRadius: 14, padding: 12,
      }}>{children}</div>
    </div>
  )
}

function Row({ label, value, status, mono }) {
  const colour = status === 'ok' ? 'var(--c-acc, #00BC8C)'
              : status === 'warn' ? 'var(--c-gold, #C58E00)'
              : 'var(--c-text)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <div style={{ fontSize: 12, color: 'var(--c-text2)' }}>{label}</div>
      <div style={{
        fontSize: 13, color: colour, fontWeight: 600,
        fontFamily: mono ? 'ui-monospace, Menlo, monospace' : undefined,
      }}>{value}</div>
    </div>
  )
}
