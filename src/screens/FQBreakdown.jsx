import { useState } from 'react'
import { calcFQ, fqTrajectory, fmt, daysLeft } from '../engine/fq-calculator.js'
import { DIMENSIONS, narrativeFor } from '../config/dimensions.js'

// Generic improvement actions per dimension — kept generic so they work for
// every persona. Persona-specific actions (e.g. "Start SIPP drawdown £37.7k/yr")
// are demo-only and shouldn't be baked into the UI layer.
const GENERIC_ACTIONS = {
  behaviour: [
    { label:'Review direct debits and subscriptions', pts:1, note:'Cancel anything no longer used' },
    { label:'Set up a monthly savings direct debit',  pts:1, note:'Any amount — habit matters more than size' },
    { label:'Review pension nominations',             pts:1, note:'Keep nominations current' },
  ],
  capital: [
    { label:'Review your retirement income target',   pts:1, note:'Still the right number for you?' },
    { label:'Model your drawdown timing',             pts:2, note:'When to start and how much' },
    { label:'Top up your ISA allowance',              pts:2, note:'£20k available each tax year' },
  ],
  tax: [
    { label:'Start pension drawdown at a tax-efficient rate', pts:5, note:'Typically up to the basic-rate band' },
    { label:'Use this year\'s ISA allowance',          pts:2, note:'Does not carry forward — use or lose' },
    { label:'Use CGT allowance via Bed-and-ISA',       pts:1, note:'£3,000 exempt amount resets April' },
    { label:'Review pension nominations',              pts:1, note:'Keep aligned with your will' },
  ],
  protection: [
    { label:'Set up life insurance in trust',          pts:6, note:'In trust = excluded from estate for IHT' },
    { label:'Consider critical illness cover',         pts:4, note:'Income replacement if unable to work' },
    { label:'Register a Lasting Power of Attorney',    pts:2, note:'Key estate-readiness document' },
  ],
  cashflow: [
    { label:'Move excess cash to ISA',                 pts:1, note:'Above 24 months of expenses is surplus' },
    { label:'Review cash interest rate',               pts:1, note:'Make sure cash is earning' },
    { label:'Model cashflow under drawdown',           pts:1, note:'Impact of pension drawdown on monthly flow' },
  ],
  debt: [
    { label:'No high-interest debt — maintain',        pts:0, note:'Avoid new consumer debt' },
    { label:'Review mortgage terms at renewal',        pts:1, note:'Rate + remaining term check' },
  ],
  estate: [
    { label:'Start pension drawdown',                  pts:7, note:'Reduces estate AND improves tax score' },
    { label:'Update pension nominations',              pts:2, note:'Keep aligned with current wishes' },
    { label:'Register a Lasting Power of Attorney',    pts:2, note:'Essential estate-readiness document' },
    { label:'Review will',                             pts:1, note:'Ensure current and reflects wishes' },
  ],
}

function buildDimConfig(entity) {
  return DIMENSIONS.map(d => ({
    ...d,
    ...narrativeFor(entity, d.key),
    actions: GENERIC_ACTIONS[d.key] || [],
  }))
}

function BandBar({ total }) {
  // Band identity colors via CSS variables — theme-aware.
  // Dark = traditional palette (red/orange/blue/green/bright-green).
  // Light = Digital Sterling (red/amber/blue/indigo/indigo).
  const bands = [
    {name:'Exposed',    range:'0–20',  from:0,  to:20,  bg:'var(--c-acc3-bg)',  col:'var(--c-acc3)'},
    {name:'Building',   range:'21–40', from:21, to:40,  bg:'var(--c-gold-bg)',  col:'var(--c-amber-text, #FF9500)'},
    {name:'Established',range:'41–60', from:41, to:60,  bg:'var(--c-acc2-bg)',  col:'var(--c-acc2)'},
    {name:'Optimised',  range:'61–80', from:61, to:80,  bg:'var(--c-acc-bg)',   col:'var(--c-acc)'},
    {name:'Exceptional',range:'81–100',from:81, to:100, bg:'var(--c-acc-bg)',   col:'var(--c-acc)'},
  ]
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:'flex',height:38,borderRadius:8,overflow:'hidden',marginBottom:6}}>
        {bands.map(b=>(
          <div key={b.name} style={{flex:1,background:b.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1}}>
            <span style={{fontSize:11,fontWeight:700,color:b.col}}>{b.name}</span>
            <span style={{fontSize:11,color:b.col,opacity:.7}}>{b.range}</span>
          </div>
        ))}
      </div>
      <div style={{position:'relative',height:28}}>
        <div style={{position:'absolute',left:`${total}%`,transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center'}}>
          <div style={{fontSize:13,color:'var(--c-acc2)',lineHeight:1}}>↑</div>
          <div style={{width:8,height:8,borderRadius:'50%',background:'var(--c-acc2)'}}/>
          <div style={{fontSize:11,color:'var(--c-acc2)',whiteSpace:'nowrap',marginTop:2}}>Today · {total}</div>
        </div>
        <div style={{position:'absolute',left:'82%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center'}}>
          <div style={{fontSize:13,color:'var(--c-acc)',lineHeight:1}}>↑</div>
          <div style={{width:8,height:8,borderRadius:'50%',background:'var(--c-acc)'}}/>
          <div style={{fontSize:11,color:'var(--c-acc)',whiteSpace:'nowrap',marginTop:2}}>Target · 82</div>
        </div>
      </div>
    </div>
  )
}

const DIM_ROUTES = {
  behaviour: 'money',
  capital:   'money',
  tax:       'tax',
  protection:'risk',
  cashflow:  'flow',
  debt:      'money',
  estate:    'tax',
}
const SCREEN_LABELS = { money: 'MyMoney', tax: 'Tax & Estate', risk: 'Risk', flow: 'Cashflow', timeline: 'Timeline' }

export default function FQBreakdown({ entity, onClose, onNav, initialTab='radar', activeDimKey=null, embedded=false }) {
  const fqData = calcFQ(entity)
  const traj   = fqTrajectory(entity)
  const [view, setView]   = useState(initialTab)
  const [activeDim, setActiveDim] = useState(activeDimKey)

  // DIM_CONFIG is built per-entity — dimensions + persona narrative + generic actions
  const DIM_CONFIG = buildDimConfig(entity)

  // Filter actions to relevant dim if coming from a dot tap
  const filteredActions = activeDim
    ? DIM_CONFIG.filter(d => d.key === activeDim)
    : DIM_CONFIG

  return (
    <div style={{
      position: embedded ? 'relative' : 'absolute',
      inset: embedded ? undefined : 0,
      background: embedded ? 'transparent' : 'var(--c-bg,#080E1A)',
      overflowY: embedded ? 'visible' : 'auto',
      WebkitOverflowScrolling: 'touch',
      paddingBottom: embedded ? 0 : 24,
      zIndex: embedded ? 'auto' : 100,
      height: embedded ? '100%' : undefined,
    }}>
      {/* Header — suppressed when embedded inside OverlayShell (Dashboard renders the chrome) */}
      {!embedded && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 16px 12px',
          borderBottom:'1px solid rgba(255,255,255,.06)',
          position:'sticky', top:0,
          background:'var(--c-bg,#080E1A)', zIndex:10,
        }}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'rgba(138,155,192,.7)',textTransform:'uppercase',letterSpacing:.8}}>Financial Quotient</div>
            <div style={{fontSize:20,fontWeight:800,color:'var(--c-acc)',letterSpacing:-.5}}>
              {fqData.total}/100 · {fqData.band.name}
            </div>
          </div>
          <button onClick={onClose} style={{
            width:36,height:36,borderRadius:'50%',
            background:'rgba(255,255,255,.06)',
            color:'rgba(138,155,192,.8)',fontSize:16,
            display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
          }}>✕</button>
        </div>
      )}

      <div style={{padding:'16px 16px 0'}}>
        <BandBar total={fqData.total}/>

        {/* Tabs */}
        <div style={{display:'flex',gap:6,marginBottom:16}}>
          {[{id:'radar',label:'Radar'},{id:'dims',label:'Detail'},{id:'actions',label:'Actions'}].map(v=>(
            <button key={v.id} onClick={()=>{setView(v.id); if(v.id!=='actions') setActiveDim(null)}} style={{
              flex:1, padding:'9px 0', borderRadius:10, fontSize:13, fontWeight:600,
              background: view===v.id ? 'var(--c-acc)' : 'var(--c-tint-neutral, rgba(255,255,255,.06))',
              color: view===v.id ? 'var(--c-acc-contrast)' : 'var(--c-text3)',
              border:'none', cursor:'pointer',
            }}>{v.label}</button>
          ))}
        </div>

        {/* ── DETAIL VIEW ── */}
        {view==='dims' && (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {DIM_CONFIG.map(d => {
              const score = fqData.dims[d.key] || 0
              const pct   = Math.round((score / d.max) * 100)
              return (
                <div key={d.key} style={{
                  background:'rgba(255,255,255,.04)',
                  border:`1px solid rgba(255,255,255,.06)`,
                  borderRadius:14, overflow:'hidden',
                }}>
                  {/* Header */}
                  <div style={{
                    borderLeft:`4px solid ${d.colour}`,
                    padding:'12px 14px 10px',
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <span style={{fontSize:14,fontWeight:700,color:d.colour}}>{d.label}</span>
                      <span style={{fontSize:13,fontWeight:600,color:'rgba(240,244,255,.9)'}}>{score}/{d.max}
                        <span style={{fontSize:11,color:'rgba(138,155,192,.5)',marginLeft:4}}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{height:4,background:'rgba(255,255,255,.08)',borderRadius:100,marginBottom:10}}>
                      <div style={{height:'100%',width:`${pct}%`,background:d.colour,borderRadius:100}}/>
                    </div>
                    {/* 4 attributes */}
                    {[
                      {tag:'WHAT',  col:'rgba(138,155,192,.5)', text:d.definition},
                      {tag:'RISK',  col:'var(--c-gold)',        text:d.risk},
                      {tag:'ACTION',col:'var(--c-acc)',         text:d.action},
                      {tag:'FUTURE',col:'var(--c-acc2)',        text:d.future},
                    ].map(row=>(
                      <div key={row.tag} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:6}}>
                        <span style={{fontSize:11,fontWeight:700,color:row.col,width:46,flexShrink:0,paddingTop:2}}>{row.tag}</span>
                        <span style={{fontSize:13,color:'rgba(138,155,192,.8)',lineHeight:1.5}}>{row.text}</span>
                      </div>
                    ))}
                  </div>
                  {/* See actions for this dim */}
                  <button
                    onClick={()=>{setActiveDim(d.key); setView('actions')}}
                    style={{
                      width:'100%', padding:'10px 0',
                      background:`${d.colour}18`,
                      color:d.colour, fontSize:13, fontWeight:600,
                      border:'none', borderTop:`1px solid ${d.colour}30`,
                      cursor:'pointer',
                    }}>
                    See {d.label} actions →
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── ACTIONS VIEW — filtered by dim if coming from dot ── */}
        {view==='actions' && (
          <div>
            {/* Dim filter pills */}
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
              <button onClick={()=>setActiveDim(null)} style={{
                padding:'5px 12px', borderRadius:100, fontSize:11, fontWeight:600,
                background: !activeDim ? '#00E5A8' : 'rgba(255,255,255,.06)',
                color: !activeDim ? '#0B1F3A' : 'rgba(138,155,192,.7)',
                border:'none', cursor:'pointer',
              }}>All</button>
              {DIM_CONFIG.map(d=>(
                <button key={d.key} onClick={()=>setActiveDim(d.key)} style={{
                  padding:'5px 12px', borderRadius:100, fontSize:11, fontWeight:600,
                  background: activeDim===d.key ? d.colour : 'rgba(255,255,255,.06)',
                  color: activeDim===d.key ? '#0B1F3A' : 'rgba(138,155,192,.7)',
                  border:'none', cursor:'pointer',
                }}>{d.label}</button>
              ))}
            </div>

            {filteredActions.map(dim=>(
              <div key={dim.key} style={{marginBottom:16}}>
                {/* Dim header when showing all */}
                {!activeDim && (
                  <div style={{fontSize:11,fontWeight:700,color:dim.colour,textTransform:'uppercase',letterSpacing:.6,marginBottom:8}}>
                    {dim.label}
                  </div>
                )}
                {dim.actions.map((a,i)=>{
                  const route = a.route || DIM_ROUTES[dim.key]
                  return (
                    <div key={i} style={{
                      background:'rgba(255,255,255,.04)',
                      border:'1px solid rgba(255,255,255,.06)',
                      borderRadius:12, padding:'12px 14px', marginBottom:8,
                    }}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:'rgba(240,244,255,.9)',marginBottom:2}}>{a.label}</div>
                          <div style={{fontSize:11,color:'rgba(138,155,192,.65)'}}>{a.note}</div>
                        </div>
                        {a.pts > 0 && (
                          <div style={{
                            width:40,height:40,borderRadius:'50%',
                            background:`${dim.colour}22`,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:13,fontWeight:800,color:dim.colour,flexShrink:0,
                          }}>+{a.pts}</div>
                        )}
                      </div>
                      {onNav && route && (
                        <button onClick={()=>{ onNav(route); onClose?.() }} style={{
                          marginTop:8, padding:'6px 14px', borderRadius:100,
                          background:'rgba(45,242,195,0.15)', border:'1px solid rgba(45,242,195,0.3)',
                          color:'#2df2c3', fontSize:11, fontWeight:700, cursor:'pointer',
                          fontFamily:'inherit',
                        }}>
                          Go to {SCREEN_LABELS[route] || route} →
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── RADAR VIEW ── */}
        {view==='radar' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              {traj.map(t=>(
                <div key={t.label} style={{textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:800,color:t.colour}}>{t.score}</div>
                  <div style={{fontSize:11,color:'rgba(138,155,192,.6)',marginTop:2}}>{t.label}</div>
                </div>
              ))}
            </div>
            <div style={{height:4,background:'rgba(255,255,255,.06)',borderRadius:100,overflow:'hidden',marginBottom:12}}>
              <div style={{height:'100%',width:`${fqData.total}%`,background:'linear-gradient(90deg,#FF6B6B,#FFB347,#4D8EFF,#00E5A8)',borderRadius:100}}/>
            </div>
            {/* Dim scores summary */}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {DIM_CONFIG.map(d=>{
                const score=fqData.dims[d.key]||0
                const pct=Math.round((score/d.max)*100)
                return(
                  <div key={d.key} style={{display:'flex',alignItems:'center',gap:10}}
                    onClick={()=>{setActiveDim(d.key);setView('actions')}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:d.colour,flexShrink:0}}/>
                    <div style={{fontSize:13,color:d.colour,width:72,flexShrink:0}}>{d.label}</div>
                    <div style={{flex:1,height:4,background:'rgba(255,255,255,.08)',borderRadius:100}}>
                      <div style={{height:'100%',width:`${pct}%`,background:d.colour,borderRadius:100}}/>
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:'rgba(240,244,255,.8)',width:32,textAlign:'right'}}>{score}/{d.max}</div>
                  </div>
                )
              })}
            </div>
            <div style={{fontSize:11,color:'rgba(138,155,192,.5)',textAlign:'center',marginTop:12}}>Tap any row to see actions for that dimension</div>
          </div>
        )}
      </div>
    </div>
  )
}
