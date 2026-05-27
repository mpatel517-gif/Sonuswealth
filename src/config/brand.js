// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH — BRAND CONFIGURATION
// Single source of truth for product name, tagline, and all brand strings.
// Every screen imports from here. Change this file → whole product updates.
// (Locked: D-NAME-2, 9 May 2026 — supersedes Caelixa, Finio.)
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {
  // ── Identity ──────────────────────────────────────────────────────────────
  name:           'Sonuswealth',
  nameDisplay:    'sonuswealth',
  logoAccent:     'wealth',

  // ── Positioning ───────────────────────────────────────────────────────────
  // Tagline locked 2026-05-16 by founder: "Your wealth, in one place."
  // Appears verbatim in Z0 first-render orientation card and top-header strap.
  tagline:        'Your wealth, in one place.',
  taglineShort:   'See, score, and grow your financial world — in one place.',

  // ── Meaning ───────────────────────────────────────────────────────────────
  nameExpanded:   'Your wealth, in one place — see, score, and grow your financial world.',

  // ── Regulatory disclaimer ─ shown verbatim on every tax-touching screen ──
  // 2026-05-27: reworded to lead with the affirmative ("Information and guidance
  // only. Not personal advice.") per FCA-policy canonical phrasing. The prior
  // wording ("Not regulated financial advice…") opened with a negative claim,
  // which compliance reviewers reject because it tells the reader what the
  // service is NOT before establishing what it IS.
  disclaimer:     'Information and guidance only. Not personal advice. Verify decisions with a qualified FCA-authorised adviser before acting.',
  rulesLabel:     (v = 'UK-2026.1', d = 'April 2026') => `Rules: ${v} · Last verified: ${d}`,
  rulesVersion:   'UK-2026.1',
  rulesBundle:    'UK-2026.1',
  dataDate:       'April 2026',
  appliedSince:   '2026-04-06',          // start of 2026/27 tax year
  nextRulesDate:  '2027-04-06',          // SIPP IHT activation (Royal Assent 18 Mar 2026)

  // ── App version ───────────────────────────────────────────────────────────
  // Bumped on each shipped wave. 2.7.0 = post-Batch 1 engine pre-fixes (May 2026).
  version:        '2.7.0',

  // ── Score names ───────────────────────────────────────────────────────────
  score:            'Sonuswealth Wealth Score',  // In-app display
  scoreShort:       'Wealth Score',              // Compact contexts
  scoreFull:        'Sonuswealth Wealth Score',  // Reports/exports
  riskScore:        'Sonuswealth Risk Score',
  riskScoreShort:   'Risk Score',
  netWorth:         'Net Worth',
  financialProfile: 'Financial Profile',

  // ── Deprecated aliases (kept for back-compat; resolve to new strings) ────
  finioScore:       'Sonuswealth Wealth Score',  // @deprecated use BRAND.score
}
