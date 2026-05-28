/**
 * src/components/Shell/FCADisclaimerFooter.jsx
 *
 * S2 chrome primitive (Phase 5, 2026-05-28)
 *
 * Single FCA-disclaimer footer used by every screen. Reads canonical
 * copy from `config/brand.js` so the negative-claim wording lives in
 * exactly one place (resolves the 10× duplication caught by P0-7).
 *
 * Visual contract:
 *   - 12px font, sw-text3 colour, centred
 *   - 24px top margin to lift it clear of last surface card
 *   - Wraps to 2 lines on mobile (no truncation)
 *
 * Use:
 *   import FCADisclaimerFooter from '../components/Shell/FCADisclaimerFooter.jsx'
 *   …
 *   <FCADisclaimerFooter />
 *
 * Variant prop:
 *   - `variant="compact"` → smaller (10px) for inline panels
 *   - `variant="footer"`  → default (12px) for end-of-page
 *   - `variant="badge"`   → pill-shaped for chrome bars
 */

import { BRAND } from '../../config/brand.js'

const variants = {
  compact: {
    fontSize: 10,
    padding: '4px 0',
    color: 'var(--c-text3)',
  },
  footer: {
    fontSize: 12,
    padding: '12px 0 24px',
    color: 'var(--c-text3)',
    textAlign: 'center',
    marginTop: 24,
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'var(--c-surface2)',
    color: 'var(--c-text2)',
    display: 'inline-block',
  },
}

export default function FCADisclaimerFooter({ variant = 'footer', style = {} }) {
  const base = variants[variant] || variants.footer
  return (
    <div
      role="contentinfo"
      aria-label="Regulatory disclaimer"
      style={{ ...base, ...style }}
    >
      {BRAND.disclaimer}
    </div>
  )
}
