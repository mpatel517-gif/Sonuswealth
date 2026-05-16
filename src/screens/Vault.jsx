// ─────────────────────────────────────────────────────────────────────────────
// Vault — Phase 1: read-only document catalogue.
//
// Documents flow in from DataCapture (FIX-16). Vault surfaces them; uploads
// and permissions are Phase 2 (D-VAULT-PERMS-1).
// Spec: 2-Product/2-Product-document-vault-v1_0.md §4 (6 estate classes)
//
// Stores only — does NOT discover gaps (T&E owns), does NOT generate (Reports
// owns), does NOT verify (Upload owns).
// ─────────────────────────────────────────────────────────────────────────────

// Spec §4 taxonomy — 6 estate classes (Phase 1) + 4 Phase 2 classes.
const VAULT_TYPES = {
  // Phase 1 — estate (priority for Sonuswealth):
  will:                 'Will',
  lpa_property:         'LPA (Property & Affairs)',
  lpa_health:           'LPA (Health & Welfare)',
  expression_of_wishes: 'Expression of Wishes',
  trust_deed:           'Trust Deed',
  nomination:           'Pension/ISA Nomination',
  // Phase 2 — broader financial paper trail:
  statement:            'Account Statement',
  policy:               'Insurance Policy',
  deed:                 'Property Deed',
  return:               'Tax Return',
}

const TYPE_TINT = {
  will:                 'sw-chip-coral',
  lpa_property:         'sw-chip-violet',
  lpa_health:           'sw-chip-violet',
  expression_of_wishes: 'sw-chip-amber',
  trust_deed:           'sw-chip-amber',
  nomination:           'sw-chip-mint',
  statement:            'sw-chip-mint',
  policy:               'sw-chip-blue',
  deed:                 'sw-chip-amber',
  return:               'sw-chip-mint',
}

export default function Vault({ entity, onBack }) {
  const docs = (entity && Array.isArray(entity.documents)) ? entity.documents : []

  return (
    <div className="screen" style={{ padding: '16px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} className="sw-press" style={{
            padding: '4px 10px', borderRadius: 8,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer',
          }}>← Home</button>
        )}
        <div style={{ flex: 1 }}>
          <div className="sw-eyebrow">Document vault</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', marginTop: 2 }}>
            Your wealth paper trail
          </div>
        </div>
      </div>

      {/* Phase 2 banner — Settings.jsx flags S6 phase2={true} */}
      <div style={{
        padding: '10px 12px', marginBottom: 12,
        background: 'var(--c-tint-violet, var(--c-tint-neutral))',
        border: '1px solid var(--c-border)', borderRadius: 10,
        fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--c-text)' }}>Phase 2</strong> — full uploads,
        permissions, and version history coming next. Vault is currently a read-only
        catalogue.
      </div>

      {/* Demo content banner */}
      <div style={{
        padding: '10px 12px', marginBottom: 12,
        background: 'var(--c-tint-neutral)',
        border: '1px solid var(--c-border)', borderRadius: 10,
        fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
      }}>
        Demo content — Phase 2 will surface uploaded documents and Vault metadata
        reads from DataCapture.
      </div>

      <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 16 }}>
        Every document you upload, scan, or generate will live here. Encrypted at rest,
        indexed for search. Phase 1 — read-only catalogue. Permissions and uploads
        coming in Phase 2 (D-VAULT-PERMS-1).
      </div>

      {docs.length === 0 ? (
        <div className="sw-tile" style={{
          padding: 24, textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--c-tint-neutral)',
            display: 'grid', placeItems: 'center', fontSize: 22,
          }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
            No documents on file
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, maxWidth: 320 }}>
            In Phase 2, every will, LPA, trust deed, nomination, statement, and policy
            you upload, scan, or email-in via DataCapture will land here automatically —
            tagged by type, dated, and searchable. For now this catalogue is empty
            because the persona does not yet carry a <code>documents[]</code> array.
          </div>
        </div>
      ) : (
        <div className="sw-tile" style={{ padding: 0 }}>
          {docs.map((d, i) => {
            const label = VAULT_TYPES[d.type] || d.type || 'Document'
            const tint  = TYPE_TINT[d.type] || ''
            return (
              <button
                key={d.id || i}
                className="sw-press"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', width: '100%',
                  background: 'transparent', border: 'none',
                  borderTop: i > 0 ? '1px solid var(--c-border)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--c-tint-neutral)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 16, color: 'var(--c-text2)', flexShrink: 0,
                }}>📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--c-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{d.name || label}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
                    {d.date || '—'}{d.size ? ` · ${d.size}` : ''}
                  </div>
                </div>
                <span className={`sw-chip sw-chip-sm ${tint}`}>{label}</span>
                <span style={{ color: 'var(--c-text3)', fontSize: 16 }}>›</span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{
        marginTop: 16, padding: 12,
        background: 'var(--c-tint-neutral)', borderRadius: 10,
        fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55,
      }}>
        Vault is read-only from this screen — uploads and scans live in Data Capture
        (FIX-16). Permission chips per beneficiary arrive in Phase 2.
      </div>
    </div>
  )
}
