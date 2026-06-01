import { useEffect, useState } from 'react'
import { BRAND } from '../config/brand.js'
import { fqBand } from '../engine/fq-calculator.js'
// L3-4b (2026-05-28): externalised marketing copy (subhead, CTA labels,
// pre-launch banner) — editable in Supabase without a code deploy.
import { getContent } from '../hooks/useContent.js'

// ─────────────────────────────────────────────────────────────────────────────
// FIX-19 — Welcome screen (pre-launch honest)
// CRIT fixes:
//  N1/S1  CTAs renamed for honesty (no "Discover" / "View demo dashboard")
//  C1     Tagline consumed from BRAND (FIX-12 set canon)
//  R1     Hardcoded 43 counter removed; example bands chip instead
//  R1     Score band/colour/emoji unified via canonical fqBand()
// HIGH fixes:
//  - Reduced-motion respected (not bypassed)
//  - Hero copy de-Voyantified (no "Financial Intelligence" + neon mint)
//  - Sonu owl placeholder added (asset missing on disk)
//  - Logo glyph swap noted (asset missing on disk — kept inline w/ comment)
//  - "351 Days left" removed (no statutory anchor)
//  - FCA boundary footer added
// ─────────────────────────────────────────────────────────────────────────────

// Pair emoji to canonical band (per FIX-19 spec)
function bandEmoji(bandName) {
  if (bandName === 'Exposed' || bandName === 'Building') return '🌱'
  if (bandName === 'Established') return '📈'
  if (bandName === 'Optimised') return '⭐'
  if (bandName === 'Exceptional') return '🏆'
  return '📈'
}

function Stars() {
  const stars = Array.from({ length: 80 }, (_, i) => ({
    size:  Math.random() * 2.5 + 0.5,
    op:    (Math.random() * 0.6 + 0.2).toFixed(2),
    dur:   (Math.random() * 4 + 2).toFixed(1),
    delay: -(Math.random() * 4).toFixed(1),
    left:  Math.random() * 100,
    top:   Math.random() * 100,
  }))
  return (
    <div className="welcome-stars" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
      {stars.map((s, i) => (
        <div key={i} className="welcome-anim welcome-twinkle" style={{
          position:'absolute', borderRadius:'50%', background:'#fff',
          width: s.size, height: s.size,
          left: `${s.left}%`, top: `${s.top}%`,
          animation: `welcomeTwinkle ${s.dur}s ease-in-out infinite ${s.delay}s`,
          opacity: s.op,
        }} />
      ))}
    </div>
  )
}

function GlowOrbs() {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
      {[
        { w:400, h:400, bg:'rgba(77,142,255,.10)', top:'-100px', right:'-80px',  dur:'14s', delay:'0s'  },
        { w:300, h:300, bg:'rgba(77,142,255,.08)', bottom:'100px',left:'-60px', dur:'10s', delay:'-5s' },
        { w:200, h:200, bg:'rgba(77,142,255,.06)', top:'40%',  right:'20%',      dur:'16s', delay:'-8s' },
      ].map((g, i) => (
        <div key={i} className="welcome-anim welcome-orb" style={{
          position:'absolute', borderRadius:'50%', filter:'blur(100px)',
          width:g.w, height:g.h, background:g.bg,
          top:g.top, right:g.right, bottom:g.bottom, left:g.left,
          animation: `welcomeGlowDrift ${g.dur} ease-in-out infinite ${g.delay}`,
        }} />
      ))}
    </div>
  )
}

export default function Welcome({ onStart, onDemo }) {
  // FIX R1: derive emoji + colour from canonical fqBand for the example band shown.
  // We show "Established 43" as the preview band (matches the example chip below).
  const exampleBand = fqBand(43)
  const exampleEmoji = bandEmoji(exampleBand.name)

  // FIX N1: onStart now routes to waitlist (parent App handles the route).
  // FIX S1: onDemo unchanged — persona picker IS the demo entry, honest now.

  return (
    <div style={{
      position:'relative', minHeight:'100vh', background:'var(--c-bg)',
      display:'flex', flexDirection:'column',
      justifyContent:'flex-end',
      padding:'0 24px max(48px,env(safe-area-inset-bottom))',
      overflow:'hidden',
    }}>
      {/* Animations — wrapped to respect prefers-reduced-motion (HIGH fix). */}
      <style>{`
        @keyframes welcomeTwinkle    { 0%,100%{opacity:.1} 50%{opacity:.8} }
        @keyframes welcomeGlowDrift  { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-40px) scale(1.05)} 66%{transform:translate(-20px,30px) scale(.95)} }
        @keyframes welcomeFloatCard  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @media (prefers-reduced-motion: reduce) {
          .welcome-anim, .welcome-twinkle, .welcome-orb, .welcome-float {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <Stars />
      <GlowOrbs />

      {/* Grid lines */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:'linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)',
        backgroundSize:'48px 48px',
      }} />

      {/* Hero content */}
      <div style={{ position:'relative', zIndex:2, width:'100%' }}>

        {/* Logo row — Sonu owl placeholder + wordmark.
            FIX-HIGH: real cube/staircase mark missing at /assets/logo/. Inline SVG kept
            with note. Sonu real asset missing at /assets/sonu/welcome.svg — using 🦉. */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:40 }}>
          <div style={{
            width:44, height:44, background:'var(--c-surface)',
            border:'1px solid var(--c-border2)', borderRadius:12,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <img src="/assets/logo/logo-app-icon.png" width={24} height={24} alt="Sonuswealth" style={{ borderRadius: 4, display: 'block' }} />
          </div>
          <div style={{ fontSize:26, fontWeight:800, color:'var(--c-text)', letterSpacing:-1 }}>
            {BRAND.nameDisplay}
          </div>
          {/* Sonu owl — placeholder until real asset lands */}
          <div aria-label="Sonu" title="Sonu" style={{
            marginLeft:'auto', fontSize:28, lineHeight:1,
            filter:'drop-shadow(0 2px 8px rgba(0,0,0,.4))',
          }}>
            🦉
          </div>
        </div>

        {/* Headline — FIX HIGH: removed "Your Financial Intelligence" anti-reference.
            Now uses canonical BRAND.tagline (set by FIX-12). */}
        <div style={{
          fontSize:40, fontWeight:800, color:'var(--c-text)',
          lineHeight:1.1, letterSpacing:-1.5, marginBottom:14,
          maxWidth:340,
        }}>
          {BRAND.tagline}
        </div>
        <div style={{ fontSize:15, color:'var(--c-text2)', lineHeight:1.6, marginBottom:28, maxWidth:340 }}>
          {getContent('welcome.subhead', 'See, score, and grow your financial world — one place for every part of your money life.')}
        </div>

        {/* Example-bands preview card — FIX R1: no more fake-precision counter.
            Static, honest, multiple bands shown to set expectation. */}
        <div className="welcome-anim welcome-float" style={{
          background:'var(--c-surface)', border:'1px solid var(--c-border2)',
          borderRadius:24, padding:18, marginBottom:18,
          boxShadow:'var(--sh2)',
          animation:'welcomeFloatCard 6s ease-in-out infinite',
        }}>
          <div style={{
            fontSize:11, fontWeight:700, color:'var(--c-text3)',
            textTransform:'uppercase', letterSpacing:1.2, marginBottom:10,
          }}>
            {getContent('welcome.previewEyebrow', "What you'll see")}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[43, 71, 85].map(n => {
              const b = fqBand(n)
              const em = bandEmoji(b.name)
              return (
                <div key={n} style={{
                  flex:'1 1 auto', minWidth:0,
                  background:'var(--c-surface2)', borderRadius:12,
                  padding:'10px 12px', display:'flex', flexDirection:'column', gap:2,
                  borderLeft:`3px solid ${b.colour}`,
                }}>
                  <div style={{ fontSize:18, fontWeight:800, color: b.colour, lineHeight:1 }}>
                    {n}<span style={{ fontSize:11, color:'var(--c-text3)', fontWeight:400 }}>/100</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--c-text2)', fontWeight:600 }}>
                    {b.name} {em}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize:11, color:'var(--c-text3)', marginTop:10, lineHeight:1.5 }}>
            {getContent('welcome.previewFootnote', 'Example scores. Yours is calculated from your real money picture.')}
          </div>
        </div>

        {/* Phase 1 banner — FIX N1: honest pre-launch context for CTAs below. */}
        <div style={{
          background:'rgba(77,142,255,.08)',
          border:'1px solid rgba(77,142,255,.25)',
          borderRadius:12, padding:'10px 14px', marginBottom:14,
          fontSize:12, color:'var(--c-text2)', lineHeight:1.5,
        }}>
          <strong style={{ color:'var(--c-text)' }}>{getContent('welcome.preLaunchHeading', 'Pre-launch.')}</strong>{' '}
          {getContent('welcome.preLaunchBody', 'Onboarding ships Phase 2.')}
        </div>

        {/* CTAs — AU6 (Phase 1.5): label now matches reality. Account creation
            is wired (Supabase Auth AU1+AU2), so "Get started" routes to real
            signup. Was "Join the waitlist" while auth was a stub. */}
        <button onClick={onStart} style={{
          width:'100%', padding:17,
          background:'var(--c-acc)', color:'var(--c-on-accent, #0B1F3A)',
          borderRadius:100, fontSize:16, fontWeight:700, letterSpacing:-.3,
          boxShadow:'var(--sh-acc)', marginBottom:10, border:'none', cursor:'pointer',
        }}>
          {getContent('welcome.primaryCta', 'Get started →')}
        </button>
        <button onClick={onDemo} style={{
          width:'100%', padding:14,
          background:'var(--c-surface)', border:'1px solid var(--c-border2)',
          color:'var(--c-text2)', borderRadius:100, fontSize:15, fontWeight:500,
          marginBottom:18, cursor:'pointer',
        }}>
          {getContent('welcome.secondaryCta', 'See a demo →')}
        </button>

        {/* FCA boundary — first FCA-relevant surface gets the line. */}
        <div style={{
          fontSize:11, color:'var(--c-text3)', lineHeight:1.55,
          textAlign:'center', maxWidth:380, margin:'0 auto',
          paddingTop:6, opacity:.85,
        }}>
          Sonuswealth is information and guidance — not regulated advice.
          Verify decisions with a qualified FCA-authorised adviser before acting.
        </div>
      </div>
    </div>
  )
}
