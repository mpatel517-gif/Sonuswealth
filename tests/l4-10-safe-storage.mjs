// ─────────────────────────────────────────────────────────────────────────────
// L4-10 — safe-storage LRU eviction test
//
// Covers:
//   1. safeSet writes and indexes by default
//   2. safeSet with indexed:false doesn't touch the LRU
//   3. safeGet returns value and touches LRU
//   4. safeRemove deletes value + index entry
//   5. Eviction picks the least-recently-touched indexed key
//   6. Non-indexed keys are never evicted
//   7. Warning event fires past 80% threshold
//   8. Urgent event fires past 95% threshold
//   9. Disabled localStorage returns safe fallback (no throw)
//
// Run: node tests/l4-10-safe-storage.mjs
// ─────────────────────────────────────────────────────────────────────────────

// ── localStorage stub with adjustable cap ───────────────────────────────────
function makeLs(cap = 4.5 * 1024 * 1024) {
  let store = new Map()
  let bytes = 0
  function size() { return bytes }
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null },
    setItem(k, v) {
      const s = String(v)
      const old = store.has(k) ? store.get(k).length + k.length : 0
      const next = bytes - old + (k.length + s.length)
      if (next > cap) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e }
      store.set(k, s)
      bytes = next
    },
    removeItem(k) {
      if (!store.has(k)) return
      const s = store.get(k)
      bytes -= (s.length + k.length)
      store.delete(k)
    },
    clear() { store.clear(); bytes = 0 },
    key(i) { return [...store.keys()][i] || null },
    get length() { return store.size },
    _size: size,
    _store: store,
  }
}

globalThis.localStorage = makeLs()

const ss = await import('../src/lib/safe-storage.js')

let fails = 0
function check(label, cond, detail) {
  if (cond) console.log(`✓ ${label}`)
  else { console.log(`✗ ${label} — ${detail || ''}`); fails++ }
}

function reset() {
  globalThis.localStorage = makeLs()
}

// ── Case 1 — safeSet writes + indexes by default ───────────────────────────
{
  reset()
  const r = ss.safeSet('a', 'one')
  check(
    'Case 1 — safeSet writes value + indexes by default',
    r.ok === true && localStorage.getItem('a') === 'one' && ss._internal.loadIndex().a != null,
    JSON.stringify(r)
  )
}

// ── Case 2 — indexed:false ─────────────────────────────────────────────────
{
  reset()
  ss.safeSet('legacy_key', 'x', { indexed: false })
  check(
    'Case 2 — indexed:false does not enter LRU',
    localStorage.getItem('legacy_key') === 'x' && ss._internal.loadIndex().legacy_key == null,
  )
}

// ── Case 3 — safeGet touches LRU ───────────────────────────────────────────
{
  reset()
  ss.safeSet('a', 'one')
  const beforeIdx = ss._internal.loadIndex()
  const t0 = beforeIdx.a.lastUsed
  // wait 5ms then read
  await new Promise(r => setTimeout(r, 5))
  const v = ss.safeGet('a')
  const afterIdx = ss._internal.loadIndex()
  check(
    'Case 3 — safeGet bumps lastUsed',
    v === 'one' && afterIdx.a.lastUsed > t0,
    `t0=${t0} after=${afterIdx.a.lastUsed}`
  )
}

// ── Case 4 — safeRemove ────────────────────────────────────────────────────
{
  reset()
  ss.safeSet('a', 'one')
  const ok = ss.safeRemove('a')
  check(
    'Case 4 — safeRemove clears value + index',
    ok === true && localStorage.getItem('a') === null && ss._internal.loadIndex().a == null,
  )
}

// ── Case 5 — LRU eviction picks least-recently-touched ─────────────────────
{
  // Small cap to force eviction
  globalThis.localStorage = makeLs(150)
  ss.safeSet('first',  'x'.repeat(40))   // ~40 bytes
  await new Promise(r => setTimeout(r, 5))
  ss.safeSet('second', 'y'.repeat(40))
  await new Promise(r => setTimeout(r, 5))
  ss.safeGet('first') // touch first → bumps lastUsed
  await new Promise(r => setTimeout(r, 5))
  // Now write a third that would push us over → eviction should pick `second`
  const r = ss.safeSet('third', 'z'.repeat(40))
  check(
    'Case 5 — eviction picks the least-recently-touched indexed key',
    r.ok === true && r.evicted.includes('second') && !r.evicted.includes('first'),
    JSON.stringify(r)
  )
}

// ── Case 6 — non-indexed keys are never evicted ────────────────────────────
{
  globalThis.localStorage = makeLs(150)
  ss.safeSet('legacy', 'x'.repeat(40), { indexed: false })
  ss.safeSet('a',      'a'.repeat(40))
  ss.safeSet('b',      'b'.repeat(40))
  const r = ss.safeSet('c', 'c'.repeat(40))
  check(
    'Case 6 — non-indexed legacy key survives pressure',
    localStorage.getItem('legacy') === 'x'.repeat(40),
    `evicted=${JSON.stringify(r.evicted)}`
  )
}

// ── Case 7 + 8 — warning thresholds fire (use small cap to make pct math easy) ─
{
  globalThis.localStorage = makeLs(1000)
  ss._internal.configure({ softCap: 1000 })
  let warnFired = false, urgentFired = false
  const fn = (e) => { if (e.level === 'warn') warnFired = true; if (e.level === 'urgent') urgentFired = true }
  ss.onWarning(fn)
  // ~85% — should fire warn
  ss.safeSet('w1', 'x'.repeat(800))
  check('Case 7 — warn fires above 80%', warnFired === true)
  // ~95% — should fire urgent
  ss.safeSet('w2', 'y'.repeat(100))
  check('Case 8 — urgent fires above 95%', urgentFired === true)
  ss.offWarning(fn)
  ss._internal.configure({ softCap: 4.5 * 1024 * 1024 }) // restore for downstream
}

// ── Case 9 — disabled localStorage degrades silently ───────────────────────
{
  const real = globalThis.localStorage
  globalThis.localStorage = undefined
  let raised = false
  try {
    const r1 = ss.safeSet('a', 'x')
    const r2 = ss.safeGet('a', 'fallback')
    check('Case 9a — safeSet returns ok:false', r1.ok === false)
    check('Case 9b — safeGet returns fallback', r2 === 'fallback')
  } catch { raised = true }
  check('Case 9c — disabled storage does not throw', raised === false)
  globalThis.localStorage = real
}

console.log(`\nL4-10 safe-storage test — fails=${fails}`)
if (fails > 0) process.exit(1)
