// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: parse-document (W5-5b)
// Purpose: server-side Claude Vision document parser for Data Capture's Upload /
//          Scan channels. Receives a file, returns FP-5 ParseResult fields.
//          Keeps ANTHROPIC_API_KEY server-side (never in the client bundle).
//
// This is the server endpoint the client adapter src/services/parsers/
// anthropic-vision.js already expects at POST /api/parse. It mirrors the
// security model of ask-sonu-proxy verbatim (JWT gate, CORS allow-list,
// sanitised upstream errors). It is DEPLOY-READY but INERT until:
//   1. supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (founder)
//   2. supabase functions deploy parse-document            (founder)
//   3. the app routes /api/parse → this function (vercel rewrite or supabase URL)
//   4. anthropic-vision provider registered in services/parser.js + REAL_PARSER_WIRED=true
// Until then DataCapture stays on the honest empty-state path (no fake fields).
//
// Security model (identical to ask-sonu-proxy):
//   · ANTHROPIC_API_KEY only in function secrets.
//   · Caller must present a valid Supabase JWT (binds Anthropic spend to users).
//   · CORS allow-list via PARSE_APP_ORIGIN.
//   · Response is the structured field list only — no upstream headers leaked.
//
// Privacy note: the uploaded document (which may contain PII / £ figures) is
// sent to Anthropic for OCR. This is disclosed in the capture consent copy. No
// document bytes are persisted server-side here — parse is transient.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const PARSE_APP_ORIGIN = Deno.env.get('PARSE_APP_ORIGIN') ?? '*';

// Vision-capable model. Document/image content blocks per Anthropic Vision API.
// Env-overridable so the model can be bumped (or set to Opus) without a redeploy
// of code — set VISION_MODEL in the function secrets. Default is current Sonnet,
// the right cost/quality tier for statement/scan OCR.
const VISION_MODEL = Deno.env.get('VISION_MODEL') ?? 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB — statements/scans are small

// Supported inbound media types → how we hand them to Claude.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const PDF_TYPE = 'application/pdf';

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    PARSE_APP_ORIGIN === '*' ? '*'
    : PARSE_APP_ORIGIN.split(',').map(s => s.trim()).includes(origin ?? '') ? (origin ?? '')
    : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

// The schema we instruct Claude to return. Each field maps to the FP-5 shape the
// client + DataCapture.toAssetEventPayload() consume: { id, label, value, unit,
// wrapper, confidence, source }. We keep the wrapper vocabulary aligned with
// DataCapture's WRAPPER_ROUTE so a parsed field routes into the balance sheet.
const SYSTEM_PROMPT = `You are a careful UK financial-document parser. You will be shown one document
(a bank/investment statement, contract note, valuation, pension statement, policy schedule, or similar).

Extract only the financial facts you can READ on the page. Do NOT infer, estimate, or invent.
Return STRICT JSON (no prose, no markdown fence) of this exact shape:
{
  "docType": "<short kebab e.g. bank-statement | sipp-statement | isa-statement | contract-note | valuation | policy-schedule | generic-statement>",
  "fields": [
    {
      "id": "<unique slug>",
      "label": "<human label e.g. 'AJ Bell SIPP value'>",
      "value": <number for gbp, else string>,
      "unit": "gbp" | "date" | "text",
      "wrapper": "SIPP" | "ISA" | "GIA" | "CASH" | "PROPERTY" | "BOND_ON" | "EIS" | "VCT" | null,
      "confidence": <0..1 — your honest read confidence>,
      "source": "document"
    }
  ],
  "warnings": ["<any legibility / ambiguity caveats>"]
}
Rules:
- gbp values are plain numbers (no £, no commas).
- confidence < 0.7 for anything blurry, handwritten, or ambiguous.
- If you cannot find any financial field, return fields: [] and a warning.
- wrapper is null unless the document clearly names the tax wrapper.`;

serve(async (req) => {
  const t0 = Date.now();
  const cors = corsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'proxy_misconfigured' }, 500, cors);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'auth_required' }, 401, cors);
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return jsonResponse({ error: 'auth_required' }, 401, cors);

  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await supa.auth.getUser(jwt);
  if (userErr || !userData?.user) return jsonResponse({ error: 'auth_invalid' }, 401, cors);

  // ── Read multipart file ──────────────────────────────────────────────────
  let file: File | null = null;
  let docTypeHint = '';
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
    const hint = form.get('docTypeHint');
    if (typeof hint === 'string') docTypeHint = hint.slice(0, 40);
  } catch {
    return jsonResponse({ error: 'invalid_multipart' }, 400, cors);
  }
  if (!file) return jsonResponse({ error: 'no_file' }, 400, cors);
  if (file.size > MAX_FILE_BYTES) return jsonResponse({ error: 'file_too_large' }, 413, cors);

  const mime = file.type || 'application/octet-stream';
  const bytes = new Uint8Array(await file.arrayBuffer());
  // base64 encode (chunked to avoid call-stack limits on large buffers)
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(binary);

  // Build the Vision content block. Images use an image block; PDFs use a
  // document block (Anthropic supports application/pdf as a document source).
  let contentBlock: Record<string, unknown>;
  if (IMAGE_TYPES.has(mime)) {
    contentBlock = { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };
  } else if (mime === PDF_TYPE) {
    contentBlock = { type: 'document', source: { type: 'base64', media_type: PDF_TYPE, data: b64 } };
  } else {
    return jsonResponse({ error: 'unsupported_media_type', mime }, 415, cors);
  }

  const anthropicBody = {
    model: VISION_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        { type: 'text', text: `Parse this ${docTypeHint || 'document'}. Return only the JSON.` },
      ],
    }],
  };

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });
  } catch {
    return jsonResponse({ error: 'upstream_unreachable' }, 502, cors);
  }

  const upstreamText = await upstreamRes.text();
  if (!upstreamRes.ok) {
    return jsonResponse({ error: 'upstream_error', status: upstreamRes.status },
      upstreamRes.status >= 500 ? 502 : upstreamRes.status, cors);
  }

  // Claude returns { content: [{ type:'text', text:'<json>' }] }. Extract + parse.
  let parsed: { docType?: string; fields?: unknown[]; warnings?: string[] } = {};
  try {
    const j = JSON.parse(upstreamText) as { content?: Array<{ type: string; text?: string }> };
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('').trim();
    // Strip an accidental ```json fence if the model added one.
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    parsed = JSON.parse(clean);
  } catch {
    return jsonResponse({ error: 'parse_unreadable', warnings: ['Model output was not valid JSON'] }, 502, cors);
  }

  const fields = Array.isArray(parsed.fields)
    ? parsed.fields.filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    : [];

  return jsonResponse({
    docType: parsed.docType || docTypeHint || 'generic-statement',
    fields,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    latencyMs: Date.now() - t0,
  }, 200, cors);
});
