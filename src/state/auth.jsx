/**
 * Caelixa · src/state/auth.jsx
 *
 * React context wrapping the auth client. Exposes:
 *   - user, session, loading, isAuthenticated, isEmailVerified
 *   - isDemo (true when URL has ?demo=X — auth gating skipped)
 *   - signUp(), signIn(), signOut(), resendVerification()
 *
 * Mount: <AuthProvider> wraps the app root. It subscribes to
 * onAuthStateChange and re-renders consumers when session changes.
 *
 * Consumers: any component can call `const { user, ... } = useAuth()`.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signInWithProvider as authSignInWithProvider,
  signOut as authSignOut,
  resendVerification as authResendVerification,
  requestPasswordReset as authRequestPasswordReset,
  getSessionAsync,
  onAuthStateChange,
  isEmailVerified as authIsEmailVerified,
} from '../lib/auth.js';

const AuthContext = createContext(null);

/**
 * Detect founder-demo mode from the URL. `?demo=X` (any value) toggles
 * demo mode, which bypasses auth gating so the snap script and founder
 * deep-links keep working without sign-in.
 */
function readDemoFlag() {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(window.location.search);
    return !!p.get('demo');
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemo]              = useState(readDemoFlag);

  // Initial session restore + subscribe to changes
  useEffect(() => {
    let mounted = true;

    // 1. Restore session from localStorage (Supabase handles this internally)
    getSessionAsync().then((s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user || null);
      setLoading(false);
    });

    // 2. Subscribe to subsequent changes
    const unsubscribe = onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user || null);
      // Any auth-state change implies we're no longer loading
      setLoading(false);
    });

    return () => {
      mounted = false;
      try { unsubscribe(); } catch { /* ignore */ }
    };
  }, []);

  const signUp = useCallback(async (args) => {
    const r = await authSignUp(args);
    // signUp does NOT auto-populate session if email confirmations are on
    // (Supabase returns user but no session). The onAuthStateChange
    // subscription handles the SIGNED_IN event when verification completes.
    if (r.ok && r.session) {
      setSession(r.session);
      setUser(r.user);
    } else if (r.ok && r.user && !r.session) {
      // user object only — show "check your email" state
      setUser(r.user);
    }
    return r;
  }, []);

  const signIn = useCallback(async (args) => {
    const r = await authSignIn(args);
    if (r.ok) {
      setSession(r.session);
      setUser(r.user);
    }
    return r;
  }, []);

  const signOut = useCallback(async () => {
    const r = await authSignOut();
    if (r.ok) {
      setSession(null);
      setUser(null);
    }
    return r;
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isDemo,
    isAuthenticated: !!session,
    isEmailVerified: authIsEmailVerified(user),
    signUp,
    signIn,
    signInWithProvider: authSignInWithProvider,
    signOut,
    resendVerification: authResendVerification,
    requestPasswordReset: authRequestPasswordReset,
  }), [user, session, loading, isDemo, signUp, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth state from any component below <AuthProvider>.
 * Falls back to a safe default if used outside the provider (e.g. tests).
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    // Safe default — pretends to be in demo mode so screens render without crashing
    return {
      user: null, session: null, loading: false, isDemo: true,
      isAuthenticated: false, isEmailVerified: false,
      signUp:  async () => ({ ok: false, error: 'AuthProvider not mounted' }),
      signIn:  async () => ({ ok: false, error: 'AuthProvider not mounted' }),
      signInWithProvider: async () => ({ ok: false, error: 'AuthProvider not mounted' }),
      signOut: async () => ({ ok: false, error: 'AuthProvider not mounted' }),
      resendVerification:   async () => ({ ok: false, error: 'AuthProvider not mounted' }),
      requestPasswordReset: async () => ({ ok: false, error: 'AuthProvider not mounted' }),
    };
  }
  return ctx;
}
