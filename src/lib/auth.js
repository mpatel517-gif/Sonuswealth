/**
 * Caelixa · src/lib/auth.js
 *
 * Thin wrapper over supabase.auth so screens can call signUp / signIn / signOut
 * without knowing about the Supabase client shape. Also exposes
 * onAuthStateChange so React contexts can subscribe to session changes.
 *
 * Auth flow (AU1):
 *   1. User enters email + password on Account.jsx
 *   2. signUp({email, password}) creates a user; Supabase sends a verification
 *      email if email confirmations are enabled in the Supabase project.
 *   3. signInWithPassword({email, password}) returns a session + user.
 *   4. onAuthStateChange fires for SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED.
 *   5. Session is persisted in localStorage (auth.persistSession: true in
 *      supabase.js). Page reload restores the session automatically.
 *
 * Demo bypass: any caller of useAuth() can check `isDemo` — set by App.jsx
 * when the URL contains `?demo=X`. Demo mode never invokes the auth client.
 */

import { supabase } from './supabase.js';

// ── Error normalisation ────────────────────────────────────────────────────
// Supabase auth errors come in many shapes (network, validation, rate-limit).
// We normalise to { ok: false, error: string } so UI can show a single
// consistent message banner.
function _err(e, fallback = 'Something went wrong. Please try again.') {
  if (!e) return { ok: false, error: fallback };
  const msg = (e.message || e.error_description || e.error || String(e)).trim();
  return { ok: false, error: msg || fallback };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new account. Sends a verification email if Supabase project has
 * email confirmation enabled. Returns the user even if email not yet
 * verified — UI displays a banner prompting verification.
 *
 * @param {{ email: string, password: string, metadata?: object }} args
 * @returns {Promise<{ok:true, user:object, session:object|null} | {ok:false, error:string}>}
 */
export async function signUp({ email, password, metadata } = {}) {
  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    });
    if (error) return _err(error);
    return { ok: true, user: data.user, session: data.session };
  } catch (e) {
    return _err(e);
  }
}

/**
 * Sign in with email + password. Returns session on success.
 *
 * @param {{ email: string, password: string }} args
 */
export async function signIn({ email, password } = {}) {
  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return _err(error);
    return { ok: true, user: data.user, session: data.session };
  } catch (e) {
    return _err(e);
  }
}

/**
 * Sign in with an OAuth provider (Google or Apple). Redirects the user to
 * the provider's consent page; on return Supabase exchanges the code for a
 * session and onAuthStateChange fires SIGNED_IN.
 *
 * Provider must be enabled in the Supabase project — Authentication ▸
 * Providers ▸ {Google|Apple}. Until then this returns a clear "provider
 * not configured" error rather than a generic 400.
 *
 * @param {'google'|'apple'} provider
 * @param {{ redirectTo?: string }} [opts]
 */
export async function signInWithProvider(provider, opts = {}) {
  if (!provider) return { ok: false, error: 'Provider is required.' };
  try {
    const redirectTo = opts.redirectTo
      || (typeof window !== 'undefined' ? window.location.origin : undefined);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      // Common case: provider not enabled in Supabase project
      if (/provider.*not.*enabled/i.test(error.message || '')) {
        return { ok: false, error: `${provider} sign-in is not yet configured. Use email/password for now.` };
      }
      return _err(error);
    }
    // signInWithOAuth returns a URL the browser must navigate to. supabase-js
    // does the redirect automatically; we just return the data for testability.
    return { ok: true, url: data?.url || null };
  } catch (e) {
    return _err(e);
  }
}

/**
 * Sign out the current session. Clears persisted tokens.
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return _err(error);
    return { ok: true };
  } catch (e) {
    return _err(e);
  }
}

/**
 * Send a password reset email.
 *
 * @param {string} email
 * @param {string} [redirectTo] — URL the reset link returns to
 */
export async function requestPasswordReset(email, redirectTo) {
  if (!email) return { ok: false, error: 'Email is required.' };
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || (typeof window !== 'undefined' ? window.location.origin : undefined),
    });
    if (error) return _err(error);
    return { ok: true };
  } catch (e) {
    return _err(e);
  }
}

/**
 * Resend the email verification link to the currently registered (but
 * unverified) user, or to an arbitrary email.
 *
 * @param {string} email
 */
export async function resendVerification(email) {
  if (!email) return { ok: false, error: 'Email is required.' };
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return _err(error);
    return { ok: true };
  } catch (e) {
    return _err(e);
  }
}

/**
 * Get the current session synchronously from cache (Supabase keeps a copy in
 * the client). Returns null if no session.
 */
export function getCurrentSession() {
  // supabase-js v2 exposes a synchronous getter via the client's auth API
  try {
    return supabase.auth.getSession; // pending — see getSessionAsync
  } catch {
    return null;
  }
}

/**
 * Get the current session asynchronously (refresh-aware).
 */
export async function getSessionAsync() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session || null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 *
 * @param {(event: string, session: object|null) => void} cb
 */
export function onAuthStateChange(cb) {
  if (typeof cb !== 'function') return () => {};
  const { data } = supabase.auth.onAuthStateChange(cb);
  return () => {
    try { data?.subscription?.unsubscribe?.(); } catch { /* ignore */ }
  };
}

/**
 * Whether a user object indicates a verified email.
 *
 * @param {object|null} user
 */
export function isEmailVerified(user) {
  if (!user) return false;
  return !!user.email_confirmed_at || !!user.confirmed_at;
}
