# Document Vault — Spec-vs-Code Gap Audit

**Spec:** `2-Product-document-vault-v1_0.md` (705 lines)
**Code:** `src/screens/Vault.jsx` (161 lines — thin)
**Audit date:** 2026-05-23

---

## HEADLINE

Document Vault is **Phase 1 (read-only catalogue)** per its own header comment. Code explicitly says "uploads and permissions are Phase 2 (D-VAULT-PERMS-1)" — so the current state matches its own documented phase, not the full spec. Code lists 10 document types across 2 phases (6 estate + 4 financial). Spec demands richer: financial detail view, estate detail view (expanded), permission matrix per accessor role (owner/spouse/IFA/solicitor), step-up auth (L2) for downloads, IFA/solicitor access grant flow, 5+ entry points, storage + retention model, raw scan image policy. **Estimated effort to ship full spec: 3–4 weeks.**

---

## §0 — Canonical-home boundaries

| Rule | Code | Verdict |
|---|---|---|
| Vault STORES only; does NOT discover gaps (T&E owns) | code comment confirms (header line 8-9) | ✅ PRESENT |
| Does NOT generate reports (Reports owns) | confirmed | ✅ PRESENT |
| Does NOT verify uploads (DataCapture owns) | confirmed | ✅ PRESENT |

---

## §1 — Orientation statement (X25)

| Feature | Code | Verdict |
|---|---|---|
| X25 purpose statement | "Your wealth paper trail" — basic | 🟡 PARTIAL |

---

## §2 — Screen anatomy

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Browse surface (document list) | §2.1 | basic list iteration | 🟡 PARTIAL — list exists, depth unverified |
| Document detail view — financial | §2.2 | not present | ❌ MISSING |
| Document detail view — estate (expanded) | §2.3 | not present | ❌ MISSING |

---

## §3 — Document object model

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Core fields (all docs) | §3.1 | basic field list | 🟡 PARTIAL |
| Estate metadata (estate docs only) | §3.2 | not present | ❌ MISSING |
| Report metadata (report artefacts) | §3.3 | not present | ❌ MISSING |

---

## §4 — Document taxonomy

| Class | Spec § | Code | Verdict |
|---|---|---|---|
| Financial documents | §4.1 | 4 types (statement / policy / deed / return) in Phase 2 list | 🟡 PARTIAL (phase-gated) |
| Estate documents (X27) | §4.2 | 6 types (will / lpa_property / lpa_health / EoW / trust_deed / nomination) — Phase 1 active | ✅ PRESENT |
| Report artefacts (D-RF-4) | §4.3 | not present | ❌ MISSING |
| Tax documents | §4.4 | only "return" type | 🟡 PARTIAL |

---

## §5 — Entry points (how documents arrive)

| Entry point | Spec § | Code | Verdict |
|---|---|---|---|
| Manual upload | §5 | not present in Vault (lives in DataCapture FIX-16) | ✅ correctly delegated |
| Auto-ingest from DataCapture | §5 | docs come in via entity.documents array | ✅ PRESENT |
| IFA-sent documents | §5 | not present | ❌ MISSING |
| Solicitor-shared | §5 | not present | ❌ MISSING |
| Report-generated artefacts | §5 | not present | ❌ MISSING |

---

## §6 — Estate document permission matrix (X27 storage side)

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Permission matrix by class × accessor role | §6.1 | not present (Phase 2) | ❌ MISSING |
| Cohabiting partner red flag (X27) | §6.2 | not present | ❌ MISSING |
| Step-up auth (L2) for document download | §6.3 | not present | ❌ MISSING |
| IFA + solicitor access grant flow | §6.4 | not present | ❌ MISSING |

---

## §7 — Storage and retention

| Feature | Spec § | Code | Verdict |
|---|---|---|---|
| Financial + estate retention policy | §7.1 | not visible in Vault | ❌ MISSING (likely Supabase storage policy elsewhere) |
| Raw scan image policy | §7.2 | not present | ❌ MISSING |
| Report artefact retention (D-RF-4) | §7.3 | not present | ❌ MISSING |

---

## Cross-screen contract

Vault reads from:
- entity.documents (populated by DataCapture)

Vault writes to:
- nothing (read-only catalogue)

Vault is referenced by:
- Ask Sonu (reads metadata only, NOT content)
- T&E (reads "is there a will?" boolean from nomination/will doc presence)
- Reports (writes artefacts back to Vault)

---

## Top 5 gaps to close

1. **Permission matrix (§6.1)** — by document class × accessor role (owner/spouse/IFA/solicitor). **Effort: 1 week.** Blocks IFA-mode access entirely.
2. **Document detail views (§2.2 financial + §2.3 estate)** — currently only list view. **Effort: 1 week.**
3. **Step-up auth (§6.3)** for downloads. **Effort: 3 days.**
4. **Report artefact integration (§4.3 + D-RF-4)** — Reports module writes here. **Effort: 3 days.**
5. **Storage + retention model (§7)** — Supabase Storage policy + lifecycle rules. **Effort: 3 days.**

---

## Founder open items

D-VAULT-PERMS-1 (Phase 2 permission system) is the master open item. Phase 1 is shipped intentionally minimal.

---

## Nice-to-haves observed

1. **Document expiry warnings** — passport expires in 6 months, life insurance renewal, etc.
2. **OCR full-text search** across all uploaded documents
3. **Annotation layer** — IFA can add notes on top of any document
4. **Version history per document** — replace doc keeps prior versions
5. **Sharing audit log** — every access by IFA/solicitor logged for regulator review
6. **Document templates library** — provide blank LPA / Expression of Wishes templates as drafts
7. **Stale document chip** — "your Will is 12 years old — typical review window is 5"
8. **Bundle export** — generate ZIP of relevant docs for accountant / IFA handover

---

## Foundational soundness verdict

Vault is **intentionally Phase 1**. Code matches its own header. To move to Phase 2 (full spec), **3–4 weeks** of work primarily on permission matrix + detail views + step-up auth.

---

*Audit complete: 2026-05-23.*
