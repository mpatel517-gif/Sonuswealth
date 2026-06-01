# Mr T · Taxonomy Coverage Map — does the all-domain fixture actually display?

**Persona:** `?demo=mrt` — `fixture_purpose: "All-domain canonical regression fixture. Deliberately maximalist: populates every spec'd domain (A-X) … so screens render fully."`
**Finding (founder 2026-06-01 "smoke and mirrors"):** the DATA is complete. The failure is a **rendering shape-mismatch pattern** — several surfaces read a rich *nested* shape (`entity.estate.will.status`, `entity.estate.trusts[]`, DLA nested) while the personas carry a *simple top-level* shape (`willStatus`, `lpaStatus`, `nominationsStatus`, `hasTrust`, `trustGifts`, `directors_loan`). Where the reader's shape ≠ the data's shape, the surface shows empty/0 despite the data being present.

## Coverage status

| Domain | Data in fixture | Renders? | Note |
|---|---|---|---|
| Pensions (4 DC + DB CETV) | ✅ | ✅ | tiles + drill; DB handled |
| ISA / GIA / bonds / EIS / SEIS / VCT | ✅ | ✅ | Savings&Investments tile + composition |
| Property (residence + BTL) | ✅ | ✅ | tile + drill |
| Crypto (ETH/BTC) / alternatives | ✅ | ✅ | Alternatives tile |
| Cash | ✅ | ✅ | tile |
| Liabilities (mortgage/BTL/student/card) | ✅ | ✅ | **fixed this session** — sparklines, per-debt leaf, payoff |
| Protection (life/CI/IP/PMI) | ✅ | ✅ | Protection&Insurance tab — 4 policies, £750k, pillars |
| General + business insurance | ✅ | ✅ | renders |
| **Trusts & Estate** (will/LPA/nominations/trusts) | ✅ | ❌→✅ | **WAS the blaring error** — vault read nested shape, showed all "not started / 0 vehicles". **FIXED**: bridge readers to top-level `willStatus`/`lpaStatus`/`nominationsStatus`/`trustGifts`. Now VEHICLES 6, all docs IN PLACE. |
| **Business — DLA** | ✅ (`directors_loan`) | ❌→✅ | **FIXED**: reader now accepts `entity.directors_loan {balance,in_credit}`. Shows "Ltd owes you £19k · In credit". |
| **Business — Corp tax band** | ✅ (`companies[].annual_profit_after_tax`) | ❌→✅ | **FIXED**: derived from company profit (£78k → Marginal). Was "not captured". |
| **Business — BPR** | ✅ (`qualifies_for_bpr` + `incorporation_date`) | ❌→✅ | **FIXED**: read all BPR shapes; derive years from incorporation date. |
| Business — share schemes (EMI) | ✅ | ⚠️ | EMI £18k in data; surfaces on Business asset drill, not the Business tab — confirm. |
| Income Statement tab | ✅ | ✅ | verified — salary/dividend/rental render, no empties |
| Cashflow tab | ✅ | ✅ | verified — no empties |
| Tax & Allowances tab | ✅ | ✅ | verified — allowances render, no empties |

**Sweep result: every money tab now renders Mr T's content — no "not captured" / empty states remain** across Balance Sheet, Income, Cashflow, Tax, Protection, Business, Trusts & Estate.

## Root-cause pattern + fix recipe
Reader expects nested shape → personas carry simple flags → empty render. Fix = defensive reader that accepts BOTH shapes (the codebase already does this for assets/liabilities; estate/business were missed). Done for estate; apply the same to DLA and any `❓`/`⚠️` row found in the sweep.

## Fixed this session
- Estate Vault: `_willStatusOf` / `_nomStatusOf` / `_trustsOf` bridge helpers in MoneyTrusts + `lpaStatus()` top-level `entity.lpaStatus` override + `vehicleCount` via the helpers. Verified: VEHICLES 6, Will/LPA×2/Nominations/Trusts all "current / IN PLACE".
- Formatting: `gbp()` full-pound formatter (£1,189/mo, £8,279, no pennies) on LiabilityTile + DebtLeaf.
- "What you can do": FCA-safe options + overpayment money-math + what-if CTA on DebtLeaf.

## Remaining sweep (to make Mr T render 100%)
1. Business DLA reader → accept `entity.directors_loan`.
2. Confirm Business share_schemes[] + companies[] render.
3. Walk Income / Cashflow / Tax tabs for the same shape gap.
4. Apply the bridge-reader recipe to every gap found; re-verify Mr T end-to-end.
