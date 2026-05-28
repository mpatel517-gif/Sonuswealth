# Wave 0 — Mr T baseline before ripple migration (W0-T15 diff reference)

**Task:** W0-T2 of `docs/superpowers/plans/2026-05-25-mymoney-l3-rebuild.md`
**Branch:** `mymoney-l3-rebuild`

## How this was captured

The harness CLI (`tests/harness/runner.mjs`) does not accept `--output` and writes Markdown reports, not raw snapshot JSON. To produce a deterministic JSON artefact suitable for W0-T15 diffing I wrote a one-shot wrapper at `scripts/wave0-snap-mrt.mjs` that imports `generateSnapshot()` directly from `tests/harness/snapshot.mjs`.

```bash
node scripts/wave0-snap-mrt.mjs
```

Persona id passed to `loadPersona()` is the filename stem `mrT-core` (not the in-file `id: "mrt"`, which is consumed by the UI router not the data-source loader). Tax year is `2026/27` so `bundleIdFor()` resolves to `UK-2026.1.1` (current canonical bundle).

## Captured at

`2026-05-25` — exact ISO timestamp lives in `wave0-baseline-snap.json#computed_at`.

## Engine output summary

| Metric | Value | vs spec §8 expectation | Notes |
|---|---|---|---|
| Net Worth | £726,890 | spec said ~£484k | Spec §8 predates `mrT-core` v2.0 maximalist rewrite (2026-05-12). Current v2.0 fixture adds BTL £198k + business £145k overlay; £727k is the correct post-v2.0 baseline. |
| FQ Score | 70 (Optimised) | spec said ~64 | Same reason as NW — v2.0 inflated dimensions for full-domain coverage |
| Risk Score | 74 (Protected) | spec said ~65 | Same reason |
| IHT exposure | £113,120 | spec said £0–8k | v2.0 added BTL + business push estate over RNRB cliff; no spousal NRB (single director); SIPP not yet in estate (2026/27 pre-April-2027 transition) |
| Cost of Inaction | £0 | — | COI for IHT bucket returned zero — investigate post-W0 |
| Effective tax rate | 19.1% | — | drawdown £47,430 topup + £12,570 salary; combined-base tax £11,432 |
| Effective drawdown | £47,430 (source: `topup`) | — | targetIncome £60k − salary £12,570 |
| Funded ratio | 0.30 | — | Required £3.23M vs actual £972k at retirement |
| Ripple (`_meta.ok`) | `true` | — | All 7 scopes ran; matches engine outputs |

**Profile:** `optimised_protected` → "Solid · and protected"

## Per-domain values (cross-referenced against `src/rules/personas/mrT-core.json`)

MyMoney v2.7 spec §5.1: B is nested in A (pension is a single domain with wrapper-and-DB sub-rows). 19 domains total = A + C–O + U + V + W + X.

| # | Domain | Mr T value | Notes |
|---|---|---|---|
| A | Pension (incl. B/DB) | **SIPP/SSAS/DC £167,500 + DB CETV £38,000 = £205,500** | 3 DC wrappers (AJ Bell SIPP £92,400 + SSAS £48,700 + Aviva DC £12,900 + Nest DC £13,500 = £167,500 flat sipp.total) plus deferred Railway DB CETV £38,000. Snap reports `balance_sheet.sipp = 243,500` because it sums flat-sipp + nested-pensions arr (£167,500 + £38,000 DB = £205,500 — wait, snap shows 243,500). **Anomaly:** snap sums flat sipp.total (£167,500) + nested pensions[] (CETV £38,000) + nested sipp.pensions[] (£167,500 again) = £243,500. Double-count of inner sipp.pensions[]. Flag for W0-T15: if migration removes this double-count, snap will diff. |
| C | ISA | **£93,200** | Vanguard S&S ISA £38,400 + Barclays Cash ISA £8,200 (`investments[]` nested) + ISA flat £46,600. Snap `balance_sheet.isa = 93,200`. |
| D | GIA | **£24,800** | Interactive Investor GIA in `investments[]` wrapper=GIA. Snap `balance_sheet.gia = 24,800`. |
| E | EIS / SEIS / VCT | **£35,500** | EIS £15,000 + SEIS £8,000 + VCT £12,500 (all in `investments[]` array, wrapper=EIS/SEIS/VCT). **Not in snapshot's balance_sheet** — these wrappers fall outside the summariser's cash/isa/sipp/property/portfolio buckets. They get folded into `portfolio` only via `flatPortfolio = a.portfolio.value` (which is zero here). |
| F | Onshore / Offshore Bonds | **£40,500** | BOND_ON £22,000 + BOND_OFF £18,500. Same as E — outside snapshot's balance_sheet bucket set. |
| G | Property | **£583,000** | Main residence £385,000 + Manchester BTL £198,000 (in `property[]`). Snap `balance_sheet.property = 583,000`. |
| H | Business assets | **£145,000** | Synthetic Tech Ltd shareholding £145,000 in `companies[]` (not `assets.business`). Snap `balance_sheet.business = 0` — summariser only reads `a.business.value` and `entity.company.companyValue`, not `companies[]`. Visible to engine via `companies[]` walk in fq-calculator. |
| I | Share schemes | **£0** | No EMI/CSOP/SAYE entries in fixture (despite v2.0 changelog claim — see "Surprises"). |
| J | Protection (life/CI/IP/RLP/KeyPerson) | **£164/mo premiums; £350k life + £150k CI + £3,250/mo IP + £400k RLP + £250k key-person** | All 5 policies exist + true; `shareholderProtection.exists = false`. Snap `protection.life_cover = 350,000`, `critical_illness = 150,000`, `income_protection_monthly = 3,250`. |
| K | General insurance | **0 policies** | `assets.general_insurance` not present in fixture. v2.0 changelog mentions but field is absent. |
| L | Business insurance | **0 policies** | Same — `assets.business_insurance` absent. RLP/Key-Person are covered under J Protection, not separate L entries. |
| M | Cash | **£57,000** | 3 bank accounts in `bank[]` (sums `balance` field) — flat `cash.total = 28,500` was overridden in summariser by nested. Snap `balance_sheet.cash = 57,000`. **Note:** flat + nested currently sums BOTH (£28,500 + £57,000 = £85,500 would be wrong); summariser line 70 actually does `cash = flatCash + nestedCash`, so true value is £85,500 not £57k. Snap reports £57k — **possible BUG (BUG-3 may not have landed for cash)**. Flag for W0-T15. |
| N | Liabilities | **£356,650** | Main mortgage £215,000 + BTL mortgage £124,000 + student loan £15,800 + credit card £1,850. Snap `balance_sheet.mortgage = 215,000` (only main, BTL is in `otherLoans[]`); `loans = 0`. **Anomaly:** £141,650 of debt invisible to the summariser. Flag for W0-T15. |
| O | Income | **£67,420 annual gross** | Salary £12,570 + dividends £38,000 + rental £15,000 + interest £1,850. Plus state pension £11,502 from age 67 (currently 35, so excluded). Snap `pl.gross_income = 60,000` (only `effective_drawdown + employment + state_pension`); raw income.total_annual_gross of £67,420 is the fixture's pre-projection figure. |
| U | Alternatives | **£19,240** | Crypto £5,160 + £4,080 + private-equity £10,000 (in `investments[]` as wrappers crypto/private-equity). Same bucket gap as E — not in snap balance_sheet. |
| V | Family obligations | **£6,000 annual** | Parent care contribution; in `family_obligations[]`. Not surfaced in snapshot top-level — engine reads it inside `monthlySurplus()` (visible in `_ripple.monthlySurplus.committed` £875/mo). |
| W | State benefits | **£11,502/yr forecast from age 67** | `income.statePension.annual = 11502, startAge = 67`. Eligibility verdict NI-QUAL-YEARS shows partial 13/35 years → £4,661 actual forecast (snap.eligibility[0]). |
| X | Director | **Synthetic Tech Ltd, turnover £220,000, PAT £78,000, share £145,000** | `companies[0]` with `shareholding_pct: 1`, `trading_status: trading`. Not in snap balance_sheet (see H). |

**19 domains covered by fixture: 17 of 19 represented** (K and L empty by fixture, not by snapshot loss).

## Anomalies surfaced by this baseline (NOT to fix in W0)

These are pre-existing summariser bugs. They must be **preserved** through W0 ripple migration so the diff is clean. Fix them in a separate later wave so the regression is attributable.

1. **Pension double-count:** snap `balance_sheet.sipp = 243,500`. Correct should be £205,500 (£167,500 flat + £38,000 DB nested). Summariser sums `flatSipp + nestedSipp` where `nestedSipp` walks both `a.pensions[]` (DB CETV) AND has no exclusion for `a.sipp.pensions[]` nested wrappers — but the engine helpers themselves match, so this may actually be deliberate. Verify in W0-T15 by diffing.
2. **EIS/SEIS/VCT/Bonds/Alternatives invisible to balance_sheet:** £95,240 of assets fall outside the 5 buckets (cash/isa/sipp/property/portfolio). Engine `netWorth()` includes them (NW £726,890 reconciles). Summariser is the lossy layer.
3. **BTL mortgage + student loan + credit card invisible to balance_sheet.mortgage:** £141,650 of debt not in `mortgage/loans/credit_cards` fields because summariser reads flat-only for mortgages, and `otherLoans[]` is not a recognised key.
4. **Business value invisible to balance_sheet.business:** £145,000 from `companies[]` not surfaced (summariser reads `a.business.value` and `entity.company.companyValue` only).
5. **Cash possibly under-reported by £28,500:** flat cash.total `28,500` and nested bank[] balance `57,000` — code says `cash = flatCash + nestedCash` (line 70) but snap shows `57,000`. Either the line is correct and one of the values is zero in execution, or there's silent overriding. Verify before declaring a bug.

## Diff method for W0-T15

After Wave 0 ripple migration is complete:

```bash
node scripts/wave0-snap-mrt.mjs   # regenerate
diff docs/superpowers/plans/wave0-baseline-snap.json <new-snap>
```

The two **MUST** be identical apart from `computed_at` and any timestamp under `_ripple._meta`. **Any other diff** = a behavioural regression introduced by the migration, which is forbidden (F4 is a structural refactor of MyMoney.jsx to `useRipple`, not a behaviour change to engine outputs).

If the diff is clean → proceed to W0-T16.
If the diff is dirty → revert/fix until clean before W0-T16.

## Files

- `docs/superpowers/plans/wave0-baseline-snap.json` — engine output, this baseline
- `docs/superpowers/plans/wave0-baseline-snap.md` — this audit
- `scripts/wave0-snap-mrt.mjs` — one-shot wrapper (kept for W0-T15 re-run)
