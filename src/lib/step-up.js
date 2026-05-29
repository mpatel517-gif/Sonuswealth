/**
 * Sonuswealth · src/lib/step-up.js
 *
 * Step-up authentication primitive (D-AUTH-1 / Phase 1.5 AU3).
 *
 * Contract:
 *   await requireStepUp({ reason, level })
 *     → resolves { ok: true,  elevatedUntil: <epoch_ms> } on success
 *     → resolves { ok: false, error: string,  cancelled?: true } on failure
 *
 * Sensitive operations (DataCapture material changes, Vault writes, document
 * downloads, settings changes) call this before proceeding. The first
 * successful challenge sets an in-memory elevated-session window (5 min
 * default); subsequent calls inside the window resolve immediately so users
 * aren't prompted on every keystroke.
 *
 * Levels (extensible):
 *   'password'   — re-enter password (always available, fallback)
 *   'totp'       — Authenticator app code (requires AU4 enrolment)
 *   'biometric'  — WebAuthn (requires AU4 WebAuthn enrolment, not in v0)
 *
 * Failure modes & guarantees:
 *   - When no AuthProvider is mounted (tests / SSR), requireStepUp resolves
 *     { ok: true } — caller can guard with isDemo if strict gating needed.
 *   - Cancelled-by-user is distinguished from challenge-failed so the UI
 *     can choose whether to retry vs back-off.
 *   - Promise-based queue: concurrent calls to requireStepUp share a single
 *     modal so the second caller doesn't open a second dialog.
 */

import { supabase } from './supabase.js';

// ── Module-level state ──────────────────────────────────────────────────────
let _elevatedUntil = 0; // epoch_ms — set on successful challenge
let _activeRequest = null; // Promise — coalesces concurrent callers
let _openModal = null; // installed by StepUpProvider — opens the UI

const ELEVATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ── Provider plumbing ───────────────────────────────────────────────────────

/**
 * Install the modal-opening callback. Called once by <StepUpProvider> on
 * mount. The callback receives { reason, level, resolve, reject } and is
 * expected to render UI then call resolve/reject when the user acts.
 *
 * @param {(req: { reason: string, level: string, resolve: Function, reject: Function }) => void} fn
 * @returns {() => void} uninstall handle
 */
export function _installModalOpener(fn) {
  _openModal = fn;
  return () => {
    if (_openModal === fn) _openModal = null;
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Request a step-up elevation for a sensitive action.
 *
 * @param {object} opts
 * @param {string} opts.reason — plain-English explanation for the modal
 *   (e.g. "Confirm to upload bank statement")
 * @param {'password'|'totp'|'biometric'} [opts.level='password']
 * @param {boolean} [opts.bypassCache=false] — force a fresh challenge
 * @returns {Promise<{ok: boolean, elevatedUntil?: number, error?: string, cancelled?: boolean}>}
 */
export async function requireStepUp(opts = {}) {
  const { reason = 'Confirm your identity', level = 'password', bypassCache = false } = opts;

  // 1. Within elevation window → resolve immediately
  if (!bypassCache && Date.now() < _elevatedUntil) {
    return { ok: true, elevatedUntil: _elevatedUntil, cached: true };
  }

  // 2. Coalesce concurrent callers to a single modal
  if (_activeRequest) return _activeRequest;

  // 3. No provider mounted → fail-open (test/SSR safety)
  if (!_openModal) {
    return { ok: true, elevatedUntil: 0, error: 'StepUpProvider not mounted (fail-open)' };
  }

  _activeRequest = new Promise((resolveOuter) => {
    _openModal({
      reason,
      level,
      resolve: (result) => {
        if (result?.ok) {
          _elevatedUntil = Date.now() + ELEVATION_WINDOW_MS;
        }
        _activeRequest = null;
        resolveOuter({
          ok: !!result?.ok,
          elevatedUntil: result?.ok ? _elevatedUntil : 0,
          error: result?.error,
          cancelled: result?.cancelled,
        });
      },
      reject: (err) => {
        _activeRequest = null;
        resolveOuter({ ok: false, error: err?.message || 'Step-up challenge failed' });
      },
    });
  });

  return _activeRequest;
}

/**
 * Verify a re-entered password against the current user's session. Used by
 * the modal's submit handler when level='password'.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function verifyPassword(email, password) {
  if (!email || !password) {
    return { ok: false, error: 'Email and password required.' };
  }
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message || 'Incorrect password.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Verification failed.' };
  }
}

/**
 * Whether the session is currently elevated (within the step-up window).
 */
export function isElevated() {
  return Date.now() < _elevatedUntil;
}

/**
 * How many ms remain on the current elevated window (0 if not elevated).
 */
export function elevationRemainingMs() {
  return Math.max(0, _elevatedUntil - Date.now());
}

/**
 * Forcibly clear the elevation (sign-out, sensitive op completed, timeout).
 */
export function clearElevation() {
  _elevatedUntil = 0;
}

/**
 * Test-only: reset module state. Not exported by default to avoid misuse.
 */
export function _resetForTests() {
  _elevatedUntil = 0;
  _activeRequest = null;
  _openModal = null;
}
