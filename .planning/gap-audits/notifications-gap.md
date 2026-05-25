# Notifications — Spec-vs-Code Gap Audit

**Spec:** `2-Product-notifications-v1_0.md` (657 lines)
**Code:** `src/screens/NotificationCentre.jsx` (348 lines)
**Audit date:** 2026-05-23

---

## HEADLINE

Notifications has a **clean taxonomy match** — code defines the 6 type codes from spec (NC-SC / NC-DD / NC-RA / NC-TB / NC-EX / NC-RC) with `mandatory: true` on NC-RC per spec. `deriveNotifications` :48 computes notifications from APQ (NC-SC), SIPP-IHT countdown (NC-RC), and business-assets-no-will (NC-RA). 3 of 6 type categories actively wired; the other 3 (NC-DD Deadlines, NC-TB Tax Boundary, NC-EX Export Ready) plus §6.7–§6.11 (NC-RC Regulatory Change, Vault, X26 Pride, X27 Estate Proactive, Decision Engine notifications) are spec'd but not deriving. **Estimated effort: 1–2 weeks.**

---

## §2–§3 — Six type codes + four priority levels

| Type | Spec § | Code | Verdict |
|---|---|---|---|
| NC-SC (Score Change) | §6.1 | derives from APQ at :63 | ✅ PRESENT |
| NC-DD (Deadline) | §2 + §6 | type code defined but no derive logic | 🟡 PARTIAL — types declared, derivation missing |
| NC-RA (Rules Alert) | §6.3 | derives for business-assets-no-will at :105 | ✅ PRESENT (1 of N rules) |
| NC-TB (Tax Boundary) | §6.4 + §6.5 | type code defined but no derive logic | 🟡 PARTIAL |
| NC-EX (Execution / Export Ready) | §6.6 | type code defined but no derive logic | 🟡 PARTIAL |
| NC-RC (Regulatory Critical — MANDATORY) | §6.7 | NC-RC mandatory flag set; SIPP-IHT countdown derives :82 | ✅ PRESENT (1 of N rules) |

**4 priority levels (CRITICAL / HIGH / MEDIUM / LOW):** tone field carries AMBER/RED/GREEN. **Verdict: ✅ PRESENT (priority encoded as tone).**

---

## §4 — Standard payload envelope (D-NOTIF-1)

| Field | Spec § | Code | Verdict |
|---|---|---|---|
| Standard envelope structure | §4 | notification objects emit `type / sip_days / source_chip / mandatory` | 🟡 PARTIAL — full envelope schema not fully verified |

---

## §5 — Materiality thresholds

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Materiality threshold per type | §5 | implicit in derive functions but not centralised | 🟡 PARTIAL |

---

## §6 — Complete notification type registry

| Sub-section | Spec § | Code | Verdict |
|---|---|---|---|
| §6.1 State Change (NC-SC) | §6.1 | APQ-derived | ✅ PRESENT |
| §6.2 Decision-Driven (NC-DD) | §6.2 | not derived | ❌ MISSING |
| §6.3 Risk and Alert (NC-RA) | §6.3 | 1 of N (business-no-will) | 🟡 PARTIAL |
| §6.4 Time-Based UK (NC-TB) | §6.4 | not derived | ❌ MISSING |
| §6.5 Time-Based Other Jurisdictions | §6.5 | not derived | ❌ MISSING |
| §6.6 Execution (NC-EX) | §6.6 | not derived | ❌ MISSING |
| §6.7 Regulatory Change (NC-RC) | §6.7 | 1 of N (SIPP-IHT countdown) | 🟡 PARTIAL |
| §6.8 Vault Notifications (NEW) | §6.8 | not derived | ❌ MISSING |
| §6.9 X26 Pride / Drive-to-Update (NEW) | §6.9 | not derived | ❌ MISSING |
| §6.10 X27 Estate Proactive Discovery (NEW) | §6.10 | not derived | ❌ MISSING |
| §6.11 Decision Engine Notifications (NEW) | §6.11 | not derived | ❌ MISSING |

**4 of 11 sub-categories have at least one derivation rule wired. 7 sub-categories are empty.**

---

## §7 — CTA routing table

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Per-notification-type CTA routing | §7 | onNavigate prop on `NotifCard` :120 | 🟡 PARTIAL — routing prop wired, table-level binding unverified |

---

## §8 — Rules-version change modal

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Modal fires when rules-bundle activates (e.g. Budget Day) | §8 | not present | ❌ MISSING |

---

## §9 — Guaranteed delivery chain (L1)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| L1 delivery guarantee (acknowledged before user can proceed) | §9 | NC-RC mandatory flag is the L1 mechanism; depth unverified | 🟡 PARTIAL |

---

## §10 — Opt-in matrix

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Per-type consent model (§10.1) | §10.1 | not present | ❌ MISSING |

---

## Cross-screen contract

Notifications reads from:
- entity (for deriving SIPP-IHT countdown, business assets, will status, APQ)
- entity.notifications (for stored notification log if any)

Notifications writes to:
- event store (acknowledge / snooze / dismiss events)
- routes to: relevant tab via onNavigate

---

## Top 5 gaps to close

1. **Build derivation rules for 7 empty sub-categories** — NC-DD deadlines, NC-TB tax-boundary, NC-EX execution-ready, Vault notifications, X26 pride pins, X27 estate proactive, DE notifications. **Effort: 1 week.** Each is a small derive function reading entity state.
2. **§8 Rules-version change modal** — fires on bundle activation (Budget Day). **Effort: 2 days.**
3. **§10 Opt-in matrix** — per-type consent UI in Settings + enforcement at derive time. **Effort: 2 days.**
4. **§4 Standard payload envelope** — verify all derivations emit the full schema. **Effort: 1 day.**
5. **§9 L1 delivery guarantee** — strengthen mandatory NC-RC blocking until acknowledged. **Effort: 2 days.**

---

## Founder open items

§0.2 lists open items. Top: per-type opt-in defaults, rules-version-change UX.

---

## Nice-to-haves observed

1. **Smart batching** — don't fire 5 notifications in 10 min; collapse to a digest
2. **Quiet hours** — user-set "no notifications between 8pm–8am"
3. **Notification preview** in Settings — see what would fire today
4. **Per-tab notification badge** — small dot on each tab indicating new notifications relevant to it
5. **"Why am I seeing this?"** chip on every notification → explainer
6. **Notification analytics for IFAs** — which client notifications get acknowledged vs dismissed
7. **Channel preferences per type** — in-app / email / SMS / push, per category

---

## Foundational soundness verdict

Notifications **has the skeleton right** (taxonomy + 3 working derivers) but is **breadth-light** (7 sub-categories empty). **1–2 weeks** to ship spec-compliant.

---

*Audit complete: 2026-05-23.*
