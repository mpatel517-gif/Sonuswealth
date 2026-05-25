# IFA Practice — Spec-vs-Code Gap Audit

**Spec:** `2-Product-ifa-practice-v1_0.md` (788 lines)
**Code:** `src/screens/IFAPractice.jsx` (686 lines)
**Audit date:** 2026-05-23

---

## HEADLINE

IFA Practice has a **substantial demo shell with explicit Phase 2 stubs** for the operational features. Code has practice dashboard structure, client roster (`RosterSection` :290), KPI derivation per client (`deriveKpis` :120), `AdviserModePreview` :451 (for showing the IFA what they'd see as the client). The `Phase2Stub` component at :410 is used throughout to honestly stub the not-yet-built features (Engine data pending — Phase 2 IFA persona wiring). Spec is ambitious: 3-tier entity hierarchy (practice/adviser/client) with Supabase RLS, book intelligence charts, notes + meeting management, referrals, white-label reports. **Estimated effort to ship: 2–3 weeks.**

---

## §2 — Entity model (Option B operator hierarchy)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| 3-tier hierarchy (practice → adviser → client) | §2.1 | structural in IFAPractice + client roster | 🟡 PARTIAL — UI shows it; Supabase entity model needs verification |
| Supabase RLS rules (Option B isolation) | §2.2 | not visible in this screen (DB-layer concern) | 🟡 PARTIAL — needs supabase/migrations grep |
| Data isolation principle | §2.3 | inferred from RLS | 🟡 PARTIAL |
| Practice entity schema | §2.4 | client data in code; practice entity definition needs verification | 🟡 PARTIAL |

---

## §3 — IFA portal surfaces

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Navigation model | §3.1 | structural | 🟡 PARTIAL |

---

## §4 — Practice dashboard (client roster)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Purpose (Q1) | §4.1 | reflected in screen structure | ✅ PRESENT |
| 3-zone layout | §4.2 | structural | 🟡 PARTIAL — zones unverified |
| Book intelligence charts (Q2) | §4.3 | `KpiTile` :424 + KPI derivation | 🟡 PARTIAL — basic KPIs present; full book-intelligence charts not visible |
| Client roster with filter/search/sort | §4.4 | `RosterSection` :290 (~120 lines) — search + filter + archetype filter | ✅ PRESENT |

---

## §5 — Adviser-mode client view

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| What adviser mode adds | §5.1 | `AdviserModePreview` :451 (~230 lines) | ✅ PRESENT |
| What is NOT changed (clarity boundary) | §5.2 | implicit | 🟡 PARTIAL |
| Tab-level adviser context | §5.3 | preview pattern shows it; full tab integration needs verification | 🟡 PARTIAL |

---

## §6 — Notes + meeting management

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Notes (IFA writes about client) | §6 | not visible | ❌ MISSING (likely Phase 2 stub) |
| Meeting management | §6 | not visible | ❌ MISSING |

---

## Cross-screen contract

IFA Practice reads from:
- entity (each client's entity, with adviser-mode flag)
- practice entity (top-level adviser business)

IFA Practice writes to:
- Notes layer (Phase 2)
- Meeting layer (Phase 2)
- Reports module (generates client reports)
- Document Vault (per-client documents)

---

## Top 5 gaps to close

1. **Phase 2 wiring** — replace `Phase2Stub` placeholders with real data paths. Each stub probably hides 1–2 days of work × N stubs. **Effort: 1 week.**
2. **Notes + meeting management (§6)** — IFA needs to log every client interaction (FCA suitability requirement). **Effort: 1 week.**
3. **Supabase RLS verification + practice entity schema** — verify Option B isolation actually enforces at DB layer. **Effort: 3 days.**
4. **Book intelligence charts (§4.3)** — Q2 demands per-book aggregate visualisations (book NW distribution, average FQ score, client risk distribution). **Effort: 4 days.**
5. **White-label IFA reports** — practice logo, footer, contact in generated reports (cross-tab with Reports module). **Effort: 2 days.**

---

## Founder open items

Spec §0 is dense; v1.0 has scope-decision rationale (§0.3) but does not list open items by ID; check round-2 expected gaps.

---

## Nice-to-haves observed

1. **Client review template auto-gen** — IFA review meetings have a standard prep doc; auto-populate from client state
2. **Bulk action across clients** — "mark all my clients reviewed this quarter"
3. **Referral pipeline tracker** — visible referral funnel for the practice
4. **CPD hours auto-log** — every Sonuswealth interaction counts toward IFA's continuing-prof-dev hours
5. **Client satisfaction pulse** — quick anonymous quarterly survey
6. **Practice benchmarking** (anonymous) — how does this practice compare to others on client-FQ-average?
7. **Compliance audit replay** — every action by adviser logged for regulator audit trail
8. **Voyant-data-mapping wizard** during onboarding (cross with Onboarding §IFA.4)

---

## Foundational soundness verdict

IFA Practice is **a substantial demo with honest Phase 2 stubs**. Roster + adviser-mode preview both meaningfully built. **2–3 weeks** to ship spec-compliant.

---

*Audit complete: 2026-05-23.*
