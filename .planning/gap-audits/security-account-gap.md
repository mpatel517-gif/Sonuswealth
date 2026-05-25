# Security / Account / Auth — Spec-vs-Code Gap Audit

**Spec:** No dedicated security spec; auth requirements live in:
- Settings §S4 Privacy & Security
- DataCapture §3.5 (step-up auth per D-AUTH-1)
- Document Vault §6.3 (step-up L2 for downloads)
- Onboarding §IFA.2 (practice signup → SSO)
- Foundation §X20 (step-up auth contract)
**Code:** `src/screens/Account.jsx` (194 lines)
**Audit date:** 2026-05-23

---

## HEADLINE

Security/Account is **a pre-launch waitlist landing page**. SSO buttons (Google + Apple) are disabled with `aria-label="Google sign-in coming soon"` — CTA-honest stub per FIX-3.B. No real authentication: no Supabase Auth integration, no OAuth flow, no email verification, no password hashing, no 2FA, no biometric, no step-up auth. The codebase has `obData` passing through Onboarding → Account → App.jsx as in-memory only (no backend persistence). This is acceptable for pre-launch demos with founder direction; **for any non-founder use it is non-shippable**. Estimated effort to ship production-grade auth: **3 weeks** (Supabase Auth + OAuth + 2FA + step-up auth across DataCapture + Vault writes).

---

## §AUTH-1 — Basic authentication

| Feature | Source spec | Code | Verdict |
|---|---|---|---|
| Email + password sign-up | implicit | controlled inputs at Account.jsx:25–26 | 🟡 STUB — inputs exist, no backend |
| Google SSO | implicit Onboarding §IFA.2 | disabled with "coming soon" aria | ❌ STUB (honest) |
| Apple SSO | implicit | disabled with "coming soon" aria | ❌ STUB (honest) |
| Email verification | implicit | not built | ❌ MISSING |
| Password reset flow | implicit | not built | ❌ MISSING |
| Session management | implicit | `obData` in-memory only — no session persistence | ❌ MISSING |

---

## §AUTH-2 — Step-up authentication (D-AUTH-1)

Spec references across multiple files:
- DataCapture §3.5 — step-up for manual entry of material values
- Document Vault §6.3 — step-up L2 for document download
- Foundation §X20 — step-up auth contract

| Feature | Source | Code | Verdict |
|---|---|---|---|
| D-AUTH-1 step-up trigger logic | Foundation §X20 | not built | ❌ MISSING |
| Step-up challenge UI (biometric / 2FA / re-password) | spec | not built | ❌ MISSING |
| Step-up L2 (high-trust) for sensitive operations | Vault §6.3 | not built | ❌ MISSING |
| Materiality threshold for step-up (e.g. asset value change > 0.5% NW) | implied | not built | ❌ MISSING |

---

## §AUTH-3 — IFA Practice authentication

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Practice signup flow | Onboarding §IFA.2 | not built | ❌ MISSING |
| Adviser-within-practice login | IFA Practice spec | not built | ❌ MISSING |
| Client invite + acceptance flow | IFA Practice spec | not built | ❌ MISSING |
| Solicitor / external-party time-limited access | Vault §6.4 | not built | ❌ MISSING |

---

## §AUTH-4 — Permission matrix (X27)

Spec lives in Vault §6 + Foundation §X27.

| Feature | Source | Code | Verdict |
|---|---|---|---|
| Permission matrix by document class × accessor role | Vault §6.1 | not built | ❌ MISSING |
| Cohabiting partner red flag (X27) | Vault §6.2 | not built | ❌ MISSING |
| Access grant log (audit trail) | regulatory implied | not built | ❌ MISSING |

---

## §AUTH-5 — Supabase Auth integration

| Feature | Implied | Code | Verdict |
|---|---|---|---|
| Supabase Auth wired (registered users in Supabase) | Layer 1 of master plan | not present | ❌ MISSING |
| Row-Level Security (RLS) policies | implied + IFA Practice §2.2 | needs grep in supabase/migrations | 🟡 PARTIAL — Layer 1 sets up RLS structure |
| OAuth providers configured in Supabase | implied | not configured | ❌ MISSING |
| MFA / TOTP setup | implied | not built | ❌ MISSING |

---

## §AUTH-6 — Settings S4 Privacy & Security

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Privacy controls (data deletion request, export) | §S4 | not visible in Settings.jsx | ❌ MISSING |
| Connected devices list + revoke | §S4 | not built | ❌ MISSING |
| Session log + force-logout | §S4 | not built | ❌ MISSING |
| 2FA enable / disable | §S4 | not built | ❌ MISSING |
| Biometric enable (touch / face ID) | §S4 | not built | ❌ MISSING |
| Hide-balances PIN | §S4 + privacy mode | not built | ❌ MISSING |

---

## §AUTH-7 — Pre-launch CTA-honesty

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Action verbs replaced with "waitlist" labels | feedback_cta_honesty_pre_launch | "Continue with Google (waitlist)" + "Continue with Apple (waitlist)" + "Join waitlist" button | ✅ PRESENT |
| Aria labels mark unbuilt features honestly | feedback | "Google sign-in coming soon" / "Apple sign-in coming soon" | ✅ PRESENT |

---

## Cross-screen contract

Auth layer underpins everything:
- Onboarding writes initial user
- Settings reads + writes user prefs
- DataCapture step-up auth on material changes
- Vault step-up auth on downloads
- IFA Practice multi-tier auth (practice / adviser / client)
- Reports access control

**Verdict: cross-cutting requirement, currently absent.** Layer 1 of master plan (data foundation) needs to include Supabase Auth wiring.

---

## Top 5 gaps to close

1. **Supabase Auth integration** — email/password signup + email verification + session management. **Effort: 3 days.** Foundational; everything else depends.
2. **OAuth providers** — Google + Apple SSO wired to Supabase Auth. **Effort: 2 days.**
3. **D-AUTH-1 step-up auth framework** — Foundation §X20 contract; biometric / 2FA / re-password challenges. **Effort: 1 week.**
4. **MFA + biometric** for end-users. **Effort: 3 days.**
5. **Permission matrix (X27)** for Vault + IFA practice access. **Effort: 1 week.**

---

## Founder open items

- D-AUTH-1 needs design closure (which method per which scenario)
- X27 permission matrix needs UX design
- Supabase Auth provider configuration (founder must approve OAuth client IDs)

---

## Nice-to-haves observed

1. **Passkey / WebAuthn** instead of password (modern, more secure)
2. **Magic link** option (passwordless sign-in via email)
3. **Per-tab unlock** — Vault and Estate documents require biometric per-session
4. **Time-limited access tokens** for solicitor/IFA grants (e.g. 7-day read-only access)
5. **Account-recovery dual-trustee** — for high-net-worth users, require 2-of-2 trusted contacts to recover
6. **Anti-phishing word** — user-set personal word shown at login to confirm legitimate site
7. **Suspicious-login alert** — geolocation / device fingerprint anomaly detection
8. **Compliance audit export** — every auth event exported on regulator request

---

## Foundational soundness verdict

Security/Auth is **the largest single hole in the production-readiness picture**. Pre-launch waitlist landing is honest but blocks anything beyond founder-driven demos. **3 weeks** to ship production-grade auth. Layer 1 of master plan must include this work explicitly.

**This audit should trigger an update to the master plan §5/§6 — add Auth layer as a Phase 1.5 step (after data foundation, before any other production work).**

---

*Audit complete: 2026-05-23.*
