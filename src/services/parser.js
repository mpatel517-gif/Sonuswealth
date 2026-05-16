// ─────────────────────────────────────────────────────────────────────────────
// PARSER SERVICE — vendor-agnostic document parsing interface (FP-5 contract).
//
// Single public function:
//   parseDocument(file, opts) → Promise<ParseResult>
//
// ParseResult:
//   {
//     fields: Array<{
//       id: string,
//       label: string,
//       value: number | string,
//       unit: 'gbp' | 'pct' | 'date' | 'text',
//       wrapper: string | null,
//       confidence: number (0..1),     // < 0.75 = needs review
//       source: string,                // human-readable provenance
//     }>,
//     docType: string,                  // detected document family
//     vendor: string,                   // which provider produced this
//     latencyMs: number,
//     warnings: string[],
//   }
//
// Providers conform to the same interface. Today: mock. Tomorrow: anthropic-vision
// (Claude Vision over the image/PDF), aws-textract (high-volume statement OCR),
// google-document-ai (form-style docs). Swap is one config change.
//
// To switch vendors:
//   import { setParserProvider } from './parser.js'
//   setParserProvider('anthropic-vision')
// Or set VITE_PARSER_PROVIDER in the build env.
//
// Each provider lives in services/parsers/<id>.js exporting a single
// async function (file, opts) → ParseResult. Add the provider id to the
// PROVIDERS registry below.
// ─────────────────────────────────────────────────────────────────────────────

import mockProvider from './parsers/mock.js'

const PROVIDERS = {
  mock: mockProvider,
  // 'anthropic-vision': lazy-import on first call so we don't ship the SDK at
  //   build time for the mock path. See parsers/README.md for the contract.
}

// Default chosen at module load. Override via setParserProvider() or env.
let _provider = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_PARSER_PROVIDER)
  ? import.meta.env.VITE_PARSER_PROVIDER
  : 'mock'

export function setParserProvider(id) {
  if (!PROVIDERS[id]) {
    throw new Error(`Unknown parser provider "${id}". Available: ${Object.keys(PROVIDERS).join(', ')}`)
  }
  _provider = id
}

export function getParserProvider() {
  return _provider
}

/**
 * Vendor-agnostic document parser. Hands off to the active provider.
 *
 * @param {File|Blob} file
 * @param {object} [opts]
 * @param {string} [opts.docTypeHint]  — e.g. 'sipp-statement', 'isa-statement'
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<ParseResult>}
 */
export async function parseDocument(file, opts = {}) {
  const provider = PROVIDERS[_provider]
  if (!provider) {
    throw new Error(`Parser provider "${_provider}" not registered`)
  }
  const t0 = Date.now()
  const result = await provider(file, opts)
  return {
    ...result,
    vendor: result.vendor || _provider,
    latencyMs: result.latencyMs ?? (Date.now() - t0),
    warnings: result.warnings || [],
  }
}
