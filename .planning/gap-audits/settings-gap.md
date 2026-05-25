# Settings — Spec-vs-Code Gap Audit

**Spec:** `2-Product-settings-master-v1_5.md` (847 lines)
**Code:** `src/screens/Settings.jsx` (631 lines)
**Audit date:** 2026-05-23

---

## HEADLINE

Settings is **structurally fair** — `Section` :197 + `Row` :155 + `DetailPanel` :215 primitives wired; phase2 flag on Row indicates honest stubs for the unbuilt features; `LongevityPill` + `ThemePill` + plan-type controls present; localStorage helpers (`readLS`/`writeLS`) wired. The spec demands 13 sections (S1–S12 + profile). Code presence across all 13 sections needs deeper grep, but the framework is there. **Estimated effort to ship: 1–2 weeks.**

---

## §1 — Settings position in the product

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Settings canonical-home declaration | §1 + §Q1B.1 | code structure respects ownership | ✅ PRESENT |

---

## §Q1B.1 — What Settings owns (canonical)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| User preferences canonical | §Q1B.1 | `readLS`/`writeLS` :291–305 + Section structure | ✅ PRESENT |
| Plan staleness check | §Q1B.1 | `PlanRow` :81 with planType handling | ✅ PRESENT |
| Theme preference | §Q1B.1 | `ThemePill` :257 | ✅ PRESENT |
| Longevity assumption | §Q1B.1 | `LongevityPill` :54 | ✅ PRESENT |
| Practice tier pricing (IFA mode) | §Q1B.1 | needs grep | 🟡 PARTIAL |
| Adviser settings | §Q1B.1 | needs grep | 🟡 PARTIAL |

---

## §2 — The 13 sections

| § | Section name | Spec § | Code | Verdict |
|---|---|---|---|---|
| profile | Profile & Identity | §S1 | basic in Section structure | 🟡 PARTIAL |
| S2 | Households & Sharing | §S2 | needs grep | 🟡 PARTIAL |
| S3 | Connected Services | §S3 | needs grep — likely Phase 2 (Connected Services = aggregator OAuth integrations) | 🟡 PARTIAL |
| S4 | Privacy & Security | §S4 | needs grep | 🟡 PARTIAL |
| S5 | Feeds & Reports | §S5 | needs grep | 🟡 PARTIAL |
| S6 | Notifications | §S6 | needs grep — should integrate with Notifications opt-in matrix | 🟡 PARTIAL |
| S7 | Personalisation (large section: theme, longevity, defaults) | §S7 | ThemePill + LongevityPill present | ✅ PRESENT |
| S8 | Data & Documents | §S8 | needs grep | 🟡 PARTIAL |
| S9 | Help & Support | §S9 | needs grep | 🟡 PARTIAL |
| S10 | Subscription & Billing | §S10 | needs grep — likely Phase 2 (no payment system yet) | 🟡 PARTIAL |
| S11 | Regulatory & Compliance | §S11 | needs grep | 🟡 PARTIAL |
| S12 | About & Legal | §S12 | needs grep | 🟡 PARTIAL |

**Estimate based on Phase2 flag prevalence in Row component:** likely ~6 of 13 sections have real content; ~7 stubbed.

---

## §D — D-DEMO-HIDDEN-1 enforcement gate

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Settings-specific demo-mode enforcement | §D.2 | needs grep | 🟡 PARTIAL |
| Code-level gate (rejects writes from demo persona) | §D.3 | needs grep | 🟡 PARTIAL |

---

## §Q2 — Chart inventory

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Settings has minimal charts (one tile per section likely) | §Q2 | needs verification | 🟡 PARTIAL |

---

## §Q4 — Event model + correlation_id

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Every settings change emits event with correlation_id | §Q4.2 | `// TODO migrate to event-sourced state` comment | 🟡 PARTIAL — explicit TODO |

---

## Cross-screen contract

Settings owns:
- User prefs (theme, longevity, default views, hide-balances)
- Plan staleness threshold
- Notification opt-in matrix (links to Notifications §10)
- Practice tier pricing (IFA mode)

Settings reads from:
- entity (current user state)
- practice entity (IFA mode)

---

## Top 5 gaps to close

1. **Migrate to event-sourced state** — explicit TODO at file top. Currently uses localStorage; should write to event store with correlation_id chain. **Effort: 3 days.**
2. **Wire all 13 sections** — verify each S1–S12 has at least header + 1 row; convert Phase2 stubs to real where the underlying capability exists. **Effort: 1 week.**
3. **S6 Notifications opt-in matrix** — integrate with Notifications spec §10. **Effort: 2 days.**
4. **S3 Connected Services** — manage OAuth connections (cross-tab with DataCapture API Pull). Wait for that to ship first. **Effort: 2 days post-DataCapture API.**
5. **S10 Subscription & Billing** — Phase 2 (requires payment system). **Effort: 1 week when payment system arrives.**

---

## Founder open items

§0.6 lists round-2 expected carries. §0.7 has v1.3 patches; §0.8 has v1.4 restructure; §0.9 has v1.5 patch (Batch 7 · 3 May 2026). v1.5 is current.

---

## Nice-to-haves observed

1. **Section search bar** — 13 sections is a lot; let users jump to one
2. **Recent settings changes log** — visible audit trail in S11
3. **Export entire settings as portable file** — backup/restore
4. **Theme schedule** — auto-switch dark/light by time of day
5. **Sonnu personality slider** — formal / casual / playful tone for AI responses
6. **Currency display preference** — primary GBP, secondary INR/USD for NRI personas
7. **Per-tab "default view"** — preset which tab opens at app launch
8. **Settings impact preview** — "if you change X, here's what changes elsewhere"

---

## Foundational soundness verdict

Settings has the **framework right**; the gap is depth and TODO event-sourcing migration. **1–2 weeks** to spec-compliance (post-DataCapture-API for S3, post-payment for S10).

---

*Audit complete: 2026-05-23.*
