// AU1 (Phase 1.5) — real Supabase Auth signup wired through useAuth().
// Account.jsx now creates an actual account on submit. Email verification
// state is surfaced; users land on Dashboard either way (verification can
// complete out-of-band). Signed-in returning users see a sign-in form.
// Demo URL param (?demo=X) bypasses this screen entirely from App.jsx.
import { useState } from 'react'
import { BRAND } from '../config/brand.js'
import { calcFQ, fqBand, lifeStageFor } from '../engine/fq-calculator.js'
import { useAuth } from '../state/auth.jsx'

export default function Account({ obData, onEnter }) {
  const { signUp, signIn, signInWithProvider, resendVerification } = useAuth()
  // FIX-3.D — destructure ALL fields collected by Onboarding (not just 3 of 11).
  // Anything missing here was being silently dropped before reaching App.jsx.
  const {
    entryMode    = null,
    jurisdiction = null,
    age          = 38,
    income       = 0,
    liquidWealth = 0,
    propertyValue = 0,
    focus        = [],
    setup        = [],
    riskAppetite = null,
    willStatus   = null,
    lpaStatus    = null,
  } = obData || {}

  // FIX-3.B — controlled state for email + password.
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

  // AU1 — auth state. mode: 'signup' (default) | 'signin'. busy: in-flight.
  // error: server error to show. needsVerify: true after signup with email
  // confirmation enabled (Supabase returns user but no session).
  const [mode,        setMode]        = useState('signup')
  const [busy,        setBusy]        = useState(false)
  const [error,       setError]       = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)

  // Build minimal entity stub so the engine scores the preview consistently.
  // Only fields calcFQ reads at the top level are needed; assets/drawdown default
  // to zero → engine produces a low-to-mid score appropriate for a new user.
  const _previewEntity = {
    age,
    assets: {
      isa:        { value: liquidWealth > 0 ? liquidWealth * 0.5 : 0 },
      cash:       { value: liquidWealth > 0 ? liquidWealth * 0.5 : 0 },
      property:   { residential: [{ value: propertyValue || 0 }] },
      sipp:       { total: 0, pensions: [] },
      protection: {},
    },
    income:           income  || 0,
    targetIncome:     income  || 30000,
    drawdown:         0,
    isHigherRateTaxpayer: (income || 0) > 50270,
    wills:            willStatus === 'yes' ? [{ status:'signed' }] : [],
    lpa:              lpaStatus  === 'yes' ? [{ status:'registered' }] : [],
  }
  const fq    = calcFQ(_previewEntity)
  const score = fq.total
  const band  = fqBand(score)
  const stage = lifeStageFor(age).name

  // AU1 — Real signup/signin. obData is still forwarded to onEnter so the
  // Dashboard persona builds correctly. If Supabase returns a session, the
  // user is fully signed in; if not (email confirmation pending), we let
  // them through to Dashboard but show a verify-banner via useAuth().
  async function handleSubmit() {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const args = { email: email.trim(), password }
      const r = mode === 'signup'
        ? await signUp({ ...args, metadata: { age, jurisdiction, entryMode } })
        : await signIn(args)
      if (!r.ok) {
        setError(r.error || 'Sign-in failed.')
        return
      }
      // Signup with email confirmation enabled returns user but no session.
      // Show verify banner but still progress to Dashboard so the user sees
      // their preview. Auth gate in App.jsx allows this transient state.
      if (mode === 'signup' && !r.session) {
        setNeedsVerify(true)
      }
      onEnter({
        email: args.email,
        password, // forwarded in case downstream needs it; not stored
        entryMode, jurisdiction, age, income, liquidWealth, propertyValue,
        focus, setup, riskAppetite, willStatus, lpaStatus,
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    if (!email) return
    setBusy(true)
    const r = await resendVerification(email.trim())
    setBusy(false)
    if (r.ok) setError('Verification email re-sent. Check your inbox.')
    else setError(r.error || 'Could not resend verification.')
  }

  // AU2 — OAuth SSO. supabase-js redirects on success; on failure (e.g.
  // provider not enabled in Supabase project yet) we show a clear message.
  async function handleOAuth(provider) {
    if (busy) return
    setError('')
    setBusy(true)
    const r = await signInWithProvider(provider)
    // If supabase did the redirect we never reach here. If it failed,
    // surface the error and unbusy.
    setBusy(false)
    if (!r.ok) setError(r.error || `${provider} sign-in failed.`)
  }

  return (
    <div style={{
      position:'absolute', inset:0, background:'var(--c-bg)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px 16px', overflowY:'auto',
    }}>
      <div style={{
        width:'100%', maxWidth:360,
        background:'var(--c-surface)', border:'1px solid var(--c-border2)',
        borderRadius:28, overflow:'hidden', boxShadow:'var(--sh2)',
      }}>
        {/* Blurred preview */}
        <div style={{ position:'relative', height:160, background:'var(--c-bg2)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', bottom:20, left:0, right:0, display:'flex', gap:8, padding:'0 20px', filter:'blur(6px)', opacity:.4 }}>
            {[1,2,3].map(i => <div key={i} style={{ flex:1, height:48, background:'var(--c-surface)', borderRadius:10 }} />)}
          </div>
          <div style={{ position:'absolute', inset:0, background:'var(--c-bg2)', backdropFilter:'blur(4px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
            <div style={{ fontSize:32 }}>🔒</div>
            <div style={{ fontSize:13, color:'var(--c-text2)', fontWeight:500 }}>Your dashboard is ready</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:24 }}>
          <div style={{ fontSize:22, fontWeight:800, color:'var(--c-text)', letterSpacing:-.5, marginBottom:6 }}>
            {mode === 'signup' ? `Unlock your ${BRAND.scoreShort}` : 'Welcome back'}
          </div>
          <div style={{ fontSize:13, color:'var(--c-text2)', lineHeight:1.5, marginBottom:20 }}>
            {mode === 'signup'
              ? `Create your free account to see your personalised ${BRAND.score} dashboard.`
              : 'Sign in to your Sonuswealth account.'}
          </div>

          {/* Score preview */}
          <div style={{
            display:'flex', alignItems:'center', gap:12,
            background:'var(--c-surface2)', border:'1px solid var(--c-border2)',
            borderRadius:14, padding:'12px 16px', marginBottom:20,
          }}>
            <div style={{ fontSize:28, fontWeight:800, color: band.colour, letterSpacing:-1 }}>{score}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--c-text3)', textTransform:'uppercase', letterSpacing:.8 }}>Your {BRAND.scoreShort}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--c-text2)', marginTop:2 }}>{band.name} · {stage} · Age {age}</div>
            </div>
          </div>

          {/* AU2 — OAuth SSO wired to Supabase Auth. If a provider isn't yet
              enabled in the Supabase project the error banner explains the
              state honestly rather than the buttons silently failing. */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
            {[
              { provider:'google', label:'Continue with Google', emoji:'G',  aria:'Sign in with Google' },
              { provider:'apple',  label:'Continue with Apple',  emoji:'🍎', aria:'Sign in with Apple' },
            ].map(b => (
              <button key={b.provider} type="button" onClick={() => handleOAuth(b.provider)} disabled={busy} aria-label={b.aria} style={{
                padding:12, borderRadius:12,
                background:'var(--c-surface2)', border:'1px solid var(--c-border2)',
                fontSize:11, fontWeight:600, color:'var(--c-text)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
              }}>
                <span aria-hidden="true" style={{ fontSize:15 }}>{b.emoji}</span> {b.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'14px 0', fontSize:13, color:'var(--c-text3)' }}>
            <div style={{ flex:1, height:1, background:'var(--c-border)' }} />
            or
            <div style={{ flex:1, height:1, background:'var(--c-border)' }} />
          </div>

          {/* AU1 — controlled email + password wired to real Supabase Auth. */}
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            <label htmlFor="acct-email" style={{
              display:'block', fontSize:11, fontWeight:600, color:'var(--c-text3)',
              marginBottom:6, textTransform:'uppercase', letterSpacing:.8,
            }}>Email address</label>
            <input
              id="acct-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width:'100%', padding:'14px 16px', marginBottom:12,
                background:'var(--c-surface2)', border:'1.5px solid var(--c-border)',
                borderRadius:14, color:'var(--c-text)', fontSize:15, outline:'none',
                display:'block',
              }}
            />

            <label htmlFor="acct-password" style={{
              display:'block', fontSize:11, fontWeight:600, color:'var(--c-text3)',
              marginBottom:6, textTransform:'uppercase', letterSpacing:.8,
            }}>Password{mode === 'signup' ? ' (8+ characters)' : ''}</label>
            <input
              id="acct-password"
              name={mode === 'signup' ? 'new-password' : 'current-password'}
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Create a strong password' : 'Your password'}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              style={{
                width:'100%', padding:'14px 16px', marginBottom:16,
                background:'var(--c-surface2)', border:'1.5px solid var(--c-border)',
                borderRadius:14, color:'var(--c-text)', fontSize:15, outline:'none',
                display:'block',
              }}
            />

            {/* AU1 — error / verification status banner */}
            {error && (
              <div role="alert" style={{
                background:'var(--c-coral, #FCE4E4)', color:'var(--c-coral-text, #8B1F1F)',
                border:'1px solid var(--c-coral-border, #F2B8B8)',
                borderRadius:10, padding:'10px 12px', marginBottom:12,
                fontSize:12, lineHeight:1.4,
              }}>{error}</div>
            )}
            {needsVerify && !error && (
              <div role="status" style={{
                background:'var(--c-gold-bg, #FFF6E0)', color:'var(--c-gold-text, #6B4500)',
                border:'1px solid var(--c-gold-border, #F4D88A)',
                borderRadius:10, padding:'10px 12px', marginBottom:12,
                fontSize:12, lineHeight:1.4,
              }}>
                Account created. Check your inbox for a verification link.{' '}
                <button type="button" onClick={handleResend} disabled={busy} style={{
                  background:'none', border:'none', textDecoration:'underline',
                  color:'inherit', cursor:'pointer', padding:0, font:'inherit',
                }}>Resend</button>
              </div>
            )}

            <button type="submit" disabled={busy} style={{
              width:'100%', padding:15,
              background:'var(--c-acc)', color:'var(--c-acc-contrast, #0B1F3A)',
              borderRadius:100, fontSize:16, fontWeight:700,
              boxShadow:'var(--sh-acc)', marginBottom:10, border:'none',
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
            }}>
              {busy
                ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
                : (mode === 'signup' ? 'Create account' : 'Sign in')}
            </button>
          </form>

          {/* AU1 — toggle between signup and signin */}
          <div style={{ fontSize:12, color:'var(--c-text2)', textAlign:'center', marginBottom:8 }}>
            {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
            <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setNeedsVerify(false); }}
              style={{ background:'none', border:'none', color:'var(--c-acc)', cursor:'pointer', padding:0, font:'inherit', fontWeight:600, textDecoration:'underline' }}>
              {mode === 'signup' ? 'Sign in' : 'Create an account'}
            </button>
          </div>

          <div style={{ fontSize:11, color:'var(--c-text3)', textAlign:'center', lineHeight:1.5 }}>
            By continuing you agree to Sonuswealth's Terms of Service.
          </div>
        </div>
      </div>
    </div>
  )
}
