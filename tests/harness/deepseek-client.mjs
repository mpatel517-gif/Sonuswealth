// ─────────────────────────────────────────────────────────────────────────────
// DeepSeek API client — direct connection (no OpenRouter)
// Reads VITE_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY from process.env
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local if env not already set
function loadEnv() {
  if (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY) return;
  const envFile = path.resolve(__dirname, '../../.env.local');
  if (!fs.existsSync(envFile)) return;
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  });
}
loadEnv();

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
                  || process.env.VITE_DEEPSEEK_API_KEY;
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

if (!DEEPSEEK_KEY) {
  console.warn('[deepseek-client] No DEEPSEEK_API_KEY found in env. Calls will fail until set.');
}

// Track session-level usage to enforce spend cap
let _tokensTotal = 0;
let _callsTotal = 0;
let _spendCapUSD = parseFloat(process.env.DEEPSEEK_SPEND_CAP_USD || '2.00');

// DeepSeek pricing (deepseek-chat): $0.27 / 1M input, $1.10 / 1M output (cache miss)
// Approximate $0.5 per 1M tokens average for conservative cap math.
const APPROX_USD_PER_TOKEN = 0.0000005;

export function getUsage() {
  return {
    calls: _callsTotal,
    tokens: _tokensTotal,
    approxCostUSD: +(_tokensTotal * APPROX_USD_PER_TOKEN).toFixed(4),
    capUSD: _spendCapUSD,
  };
}

export async function callDeepSeek(prompt, opts = {}) {
  if (!DEEPSEEK_KEY) {
    throw new Error('DEEPSEEK_API_KEY not set in environment');
  }
  const approxCost = _tokensTotal * APPROX_USD_PER_TOKEN;
  if (approxCost > _spendCapUSD) {
    throw new Error(`DeepSeek spend cap reached: $${approxCost.toFixed(4)} > $${_spendCapUSD}`);
  }

  const body = {
    model: opts.model || DEFAULT_MODEL,
    messages: [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      { role: 'user', content: prompt },
    ],
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.max_tokens ?? 1500,
    response_format: opts.json ? { type: 'json_object' } : undefined,
  };

  const start = Date.now();
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  if (!choice) throw new Error('DeepSeek returned no choices');

  const tokens = json.usage?.total_tokens || 0;
  _callsTotal += 1;
  _tokensTotal += tokens;

  return {
    text: choice.message?.content || '',
    model: json.model,
    tokens_used: tokens,
    duration_ms: Date.now() - start,
    finish_reason: choice.finish_reason,
  };
}

export async function callDeepSeekJSON(prompt, opts = {}) {
  const r = await callDeepSeek(prompt, { ...opts, json: true });
  try {
    return { ...r, json: JSON.parse(r.text) };
  } catch (e) {
    return { ...r, json: null, parse_error: e.message };
  }
}
