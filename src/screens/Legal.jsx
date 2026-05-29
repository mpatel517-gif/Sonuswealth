// ─────────────────────────────────────────────────────────────────────────────
// Legal.jsx (L1-2, 2026-05-28)
//
// Renders one of the three legal documents based on the `doc` prop:
//   - 'privacy' → Privacy Policy
//   - 'terms'   → Terms of Service
//   - 'cookies' → Cookie Policy
//
// Content lives in src/content/legal/*.md as plain markdown so non-developers
// can edit. We use Vite's `?raw` import to pull the text in at build time; a
// minimal markdown renderer formats headings + paragraphs + lists.
//
// Why no react-markdown dependency: this is a single-purpose surface for three
// known documents. Pulling in remark+rehype adds ~80kb gzipped. The handful of
// markdown features used here render fine in <120 lines.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import privacyRaw from '../content/legal/privacy.md?raw'
import termsRaw   from '../content/legal/terms.md?raw'
import cookiesRaw from '../content/legal/cookies.md?raw'

const DOCS = {
  privacy:  { title: 'Privacy Policy',     raw: privacyRaw },
  terms:    { title: 'Terms of Service',   raw: termsRaw },
  cookies:  { title: 'Cookie Policy',      raw: cookiesRaw },
}

// ── Lightweight markdown → React renderer ──────────────────────────────────
// Supports: # heading, ## heading, ### heading, paragraphs, bullet lists,
// numbered lists, **bold**, *italic*, inline `code`, GFM tables, and
// [link](url). No HTML escape required because content is authored by us.
function renderMarkdown(src) {
  const lines = src.split('\n')
  const out = []
  let buf = []
  let listType = null    // 'ul' | 'ol' | null
  let tableBuf = null    // { headers: [], rows: [] } | null

  const flushParagraph = () => {
    if (buf.length) {
      out.push({ type: 'p', text: buf.join(' ') })
      buf = []
    }
  }
  const flushList = () => {
    if (listType) {
      out.push({ type: 'list', kind: listType, items: out._listItems || [] })
      out._listItems = []
      listType = null
    }
  }
  const flushTable = () => {
    if (tableBuf) {
      out.push({ type: 'table', ...tableBuf })
      tableBuf = null
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      flushParagraph(); flushList(); flushTable()
      out.push({ type: 'h', level: h[1].length, text: h[2] })
      continue
    }
    // Table row
    if (/^\|.*\|$/.test(line)) {
      flushParagraph(); flushList()
      const cells = line.slice(1, -1).split('|').map(s => s.trim())
      // Separator row (---) → marks header boundary
      if (cells.every(c => /^[-:\s]+$/.test(c))) continue
      if (!tableBuf) tableBuf = { headers: cells, rows: [] }
      else tableBuf.rows.push(cells)
      continue
    }
    if (tableBuf) flushTable()
    // List item
    const ul = /^\s*[-*]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ul || ol) {
      flushParagraph()
      const newType = ul ? 'ul' : 'ol'
      if (listType !== newType) {
        flushList()
        listType = newType
        out._listItems = []
      }
      out._listItems.push((ul || ol)[1])
      continue
    }
    if (listType) flushList()
    // Blank line → paragraph break
    if (!line.trim()) { flushParagraph(); continue }
    buf.push(line.trim())
  }
  flushParagraph(); flushList(); flushTable()
  return out
}

// Inline formatting — bold / italic / code / link
function renderInline(text, keyPrefix = 'i') {
  // Tokenise: split on the patterns we support.
  const parts = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ k: `${keyPrefix}-t-${i++}`, t: 'text', v: text.slice(last, m.index) })
    const tok = m[0]
    if (tok.startsWith('**')) parts.push({ k: `${keyPrefix}-b-${i++}`, t: 'b', v: tok.slice(2, -2) })
    else if (tok.startsWith('`')) parts.push({ k: `${keyPrefix}-c-${i++}`, t: 'c', v: tok.slice(1, -1) })
    else if (tok.startsWith('*')) parts.push({ k: `${keyPrefix}-i-${i++}`, t: 'i', v: tok.slice(1, -1) })
    else if (tok.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      parts.push({ k: `${keyPrefix}-l-${i++}`, t: 'l', v: lm[1], href: lm[2] })
    }
    last = m.index + tok.length
  }
  if (last < text.length) parts.push({ k: `${keyPrefix}-t-${i++}`, t: 'text', v: text.slice(last) })
  return parts.map(p => {
    if (p.t === 'b') return <strong key={p.k}>{p.v}</strong>
    if (p.t === 'i') return <em key={p.k}>{p.v}</em>
    if (p.t === 'c') return <code key={p.k} style={{
      fontFamily: 'ui-monospace, "SF Mono", monospace', fontSize: '0.9em',
      background: 'var(--c-surface2)', padding: '1px 4px', borderRadius: 4,
    }}>{p.v}</code>
    if (p.t === 'l') return <a key={p.k} href={p.href} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--c-acc)', textDecoration: 'underline' }}>{p.v}</a>
    return <span key={p.k}>{p.v}</span>
  })
}

function MarkdownBlock({ ast }) {
  return ast.map((node, idx) => {
    const key = `n-${idx}`
    if (node.type === 'h') {
      const sizes = { 1: 28, 2: 20, 3: 16, 4: 14, 5: 13, 6: 12 }
      const margins = { 1: '24px 0 16px', 2: '32px 0 12px', 3: '24px 0 10px' }
      const Tag = `h${node.level}`
      return (
        <Tag key={key} style={{
          fontSize: sizes[node.level] || 14, fontWeight: 800,
          margin: margins[node.level] || '16px 0 8px',
          color: 'var(--c-text)', letterSpacing: node.level === 1 ? -0.4 : -0.2,
        }}>{renderInline(node.text, key)}</Tag>
      )
    }
    if (node.type === 'p') {
      return (
        <p key={key} style={{
          fontSize: 14, lineHeight: 1.65, color: 'var(--c-text2)',
          margin: '0 0 12px',
        }}>{renderInline(node.text, key)}</p>
      )
    }
    if (node.type === 'list') {
      const Tag = node.kind === 'ol' ? 'ol' : 'ul'
      return (
        <Tag key={key} style={{
          fontSize: 14, lineHeight: 1.65, color: 'var(--c-text2)',
          margin: '0 0 14px', paddingLeft: 22,
        }}>
          {node.items.map((it, i) => (
            <li key={`${key}-i-${i}`} style={{ marginBottom: 4 }}>{renderInline(it, `${key}-${i}`)}</li>
          ))}
        </Tag>
      )
    }
    if (node.type === 'table') {
      return (
        <div key={key} style={{ overflowX: 'auto', margin: '0 0 14px' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: 13,
            color: 'var(--c-text2)',
          }}>
            <thead>
              <tr>
                {node.headers.map((h, i) => (
                  <th key={i} style={{
                    textAlign: 'left', padding: '8px 10px',
                    borderBottom: '2px solid var(--c-border)', color: 'var(--c-text)',
                    fontWeight: 700,
                  }}>{renderInline(h, `${key}-th-${i}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid var(--c-border)',
                      verticalAlign: 'top',
                    }}>{renderInline(cell, `${key}-td-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    return null
  })
}

export default function Legal({ doc = 'privacy', onBack }) {
  const meta = DOCS[doc] || DOCS.privacy
  const ast = useMemo(() => renderMarkdown(meta.raw), [meta.raw])
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)',
      padding: '24px 20px 80px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {onBack && (
          <button onClick={onBack} style={{
            padding: '6px 12px', borderRadius: 8, marginBottom: 16,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer',
          }}>← Back</button>
        )}
        <article>
          <MarkdownBlock ast={ast} />
        </article>
      </div>
    </div>
  )
}
