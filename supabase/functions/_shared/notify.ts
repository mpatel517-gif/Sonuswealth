// ─────────────────────────────────────────────────────────────────────────────
// notify — shared notification helper for cron Edge Functions (L4-6, 2026-05-28)
//
// Today each cron posts to Slack directly with its own fetch + error handling.
// This helper centralises the pattern so:
//   1. New crons get the alert path for free — `await postSlack(text)`.
//   2. Adding SendGrid email later is one new function here, not a sweep.
//   3. The "no webhook env set" case is logged consistently.
//
// Usage in a cron:
//   import { postSlack } from '../_shared/notify.ts';
//   if (anyStale) await postSlack(`*${name}* — ${summary}`);
//
// All notify calls are best-effort. They never throw, never fail the cron.
// ─────────────────────────────────────────────────────────────────────────────

const SLACK_WEBHOOK   = Deno.env.get('CRON_SLACK_WEBHOOK')    || '';
const SENDGRID_KEY    = Deno.env.get('CRON_SENDGRID_API_KEY') || '';
const SENDGRID_FROM   = Deno.env.get('CRON_SENDGRID_FROM')    || 'alerts@sonuswealth.example';
const SENDGRID_TO     = Deno.env.get('CRON_SENDGRID_TO')      || ''; // founder email — required for email alerts

export async function postSlack(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!SLACK_WEBHOOK) {
    console.warn('[notify] CRON_SLACK_WEBHOOK not set — Slack message dropped:', text.slice(0, 120));
    return { ok: false, error: 'no_webhook' };
  }
  try {
    const res = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[notify] Slack HTTP', res.status, body);
      return { ok: false, error: `slack_http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[notify] Slack post threw:', (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

export async function sendEmail(subject: string, text: string, html?: string): Promise<{ ok: boolean; error?: string }> {
  if (!SENDGRID_KEY || !SENDGRID_TO) {
    console.warn('[notify] SendGrid env not set — email dropped:', subject);
    return { ok: false, error: 'no_sendgrid_env' };
  }
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: SENDGRID_TO }] }],
        from:    { email: SENDGRID_FROM },
        subject,
        content: [
          { type: 'text/plain', value: text },
          ...(html ? [{ type: 'text/html', value: html }] : []),
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[notify] SendGrid HTTP', res.status, body);
      return { ok: false, error: `sendgrid_http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[notify] SendGrid threw:', (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

// Convenience: post to BOTH channels with sensible severity defaults.
// Severity:
//   - 'info'    → Slack only (low-noise)
//   - 'warn'    → Slack only
//   - 'urgent'  → Slack + email (founder needs to act)
export async function notify(severity: 'info' | 'warn' | 'urgent', subject: string, text: string) {
  const results: Array<{ channel: string; ok: boolean; error?: string }> = [];
  const slackText = severity === 'info' ? text : `*${severity.toUpperCase()}* ${subject}\n${text}`;
  results.push({ channel: 'slack', ...(await postSlack(slackText)) });
  if (severity === 'urgent') {
    results.push({ channel: 'email', ...(await sendEmail(subject, text)) });
  }
  return results;
}
