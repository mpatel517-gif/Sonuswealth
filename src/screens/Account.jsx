// FIX-3.B + 3.D — controlled email/password inputs, CTA-honesty (waitlist
// labels), all obData fields destructured + forwarded to onEnter().
import { useState } from 'react'

// Band identity colors via CSS variables so dark and light themes resolve
// correctly. Dark = mint/coral/gold/blue. Light = indigo/red/amber/blue
// (no green per Digital Sterling spec).
function fqBand(score) {
  if (score <= 20) return { name:'Exposed',     c:'var(--c-acc3)' }
  if (score <= 40) return { name:'Building',    c:'var(--c-amber-text, #FFB347)' }
  if (score <= 60) return { name:'Established', c:'var(--c-acc2)' }
  if (score <= 80) return { name:'Optimised',   c:'var(--c-acc)' }
  return                  { name:'Exceptional', c:'var(--c-acc)' }
}

function stageFor(age) {
  if (age < 30) return 'Foundation'; if (age < 45) return 'Accumulation'
  if (age < 55) return 'Consolidation'; if (age < 65) return 'Transition'
  if (age < 75) return 'Decumulation'; if (age < 85) return 'Preservation'
  return 'Legacy'
}

export default function Account({ obData, onEnter }) {
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

  const baseScore = Math.round(20 + (age/85)*25 + (focus.length/8)*15 + (setup.length/6)*10)
  const score = Math.min(72, Math.max(18, baseScore))
  const band  = fqBand(score)
  const stage = stageFor(age)

  // FIX-3.B/3.D — single payload bundles credentials + every obData field so
  // the parent (App.jsx) can derive a real persona. Pre-launch backend = none;
  // payload is consumed in-memory only.
  function joinWaitlist() {
    onEnter({
      email,
      password,
      entryMode, jurisdiction, age, income, liquidWealth, propertyValue,
      focus, setup, riskAppetite, willStatus, lpaStatus,
    })
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
          <div style={{ fontSize:22, fontWeight:800, color:'var(--c-text)', letterSpacing:-.5, marginBottom:6 }}>Unlock your FQ</div>
          <div style={{ fontSize:13, color:'var(--c-text2)', lineHeight:1.5, marginBottom:20 }}>
            Create your free account to see your personalised Financial Quotient dashboard.
          </div>

          {/* FQ preview */}
          <div style={{
            display:'flex', alignItems:'center', gap:12,
            background:'var(--c-surface2)', border:'1px solid var(--c-border2)',
            borderRadius:14, padding:'12px 16px', marginBottom:20,
          }}>
            <div style={{ fontSize:28, fontWeight:800, color: band.c, letterSpacing:-1 }}>{score}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--c-text3)', textTransform:'uppercase', letterSpacing:.8 }}>Your estimated FQ</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--c-text2)', marginTop:2 }}>{band.name} · {stage} · Age {age}</div>
            </div>
          </div>

          {/* FIX-3.B — pre-launch CTA-honesty: SSO not wired, so disable both
              and label as "(waitlist)". (See memory feedback_cta_honesty_pre_launch.md.) */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
            {[
              { label:'Continue with Google (waitlist)', emoji:'G',  aria:'Google sign-in coming soon' },
              { label:'Continue with Apple (waitlist)',  emoji:'🍎', aria:'Apple sign-in coming soon' },
            ].map(b => (
              <button key={b.label} disabled aria-label={b.aria} title="Coming soon" style={{
                padding:12, borderRadius:12,
                background:'var(--c-surface2)', border:'1px solid var(--c-border2)',
                fontSize:11, fontWeight:600, color:'var(--c-text3)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                cursor:'not-allowed', opacity:.6,
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

          {/* FIX-3.B — controlled email + password with autocomplete + labels. */}
          <form onSubmit={(e) => { e.preventDefault(); joinWaitlist() }}>
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
            }}>Password (this stays on your device — Phase 2)</label>
            <input
              id="acct-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Pick anything for now"
              style={{
                width:'100%', padding:'14px 16px', marginBottom:16,
                background:'var(--c-surface2)', border:'1.5px solid var(--c-border)',
                borderRadius:14, color:'var(--c-text)', fontSize:15, outline:'none',
                display:'block',
              }}
            />

            {/* FIX-3.B — pre-launch waitlist label, not action verb. Uses
                joinWaitlist() so obData reaches App.jsx → Dashboard. */}
            <button type="submit" style={{
              width:'100%', padding:15,
              background:'var(--c-acc)', color:'var(--c-acc-contrast, #0B1F3A)',
              borderRadius:100, fontSize:16, fontWeight:700,
              boxShadow:'var(--sh-acc)', marginBottom:10, border:'none', cursor:'pointer',
            }}>
              Join waitlist
            </button>
          </form>

          <div style={{ fontSize:11, color:'var(--c-text3)', textAlign:'center', lineHeight:1.5 }}>
            Pre-launch waitlist — nothing is stored remotely yet. By continuing you agree to Sonuswealth's Terms of Service.
          </div>
        </div>
      </div>
    </div>
  )
}
