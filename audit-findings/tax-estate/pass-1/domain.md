# Tax & Estate — Pass 1 — DOMAIN audit

**Auditor:** domain-auditor (auditor 4 of 5)
**Date:** 2026-05-18
**Inventory:** `tax-estate-inventory-v1.md` (227 rows, 34 regions)
**Sources of truth:** `src/rules/UK-2026.1.1.json` · `src/engine/fq-calculator.js` (TAX) · `src/components/shared/Explainer.jsx` (TE-1 / TE-2)
**Method:** A5 (plain-English + FCA) + domain correctness (UK IHT/CGT/NRB/RNRB/BPR/APR/dividend/PA-taper/SIPP-IHT) + Cost-of-Inaction canon + founder-IP integrity + placeholder leakage.

Verdict legend: `PASS` · `FAIL` · `NA` · `UNVERIFIED`. Severity: `DEMO-BLOCKING` · `FUNCTIONAL` · `POLISH`.

---

## Headline

**Verdict: 12 PASS · 21 FAIL · 4 DB · 13 F · 4 P** across the rows where the domain auditor has an opinion (A5 / domain correctness). The remaining 194 rows are *out of domain scope* (A1/A2/A3/A4/A6) — those are the conformance / wiring / reconciliation auditors. This report **does not** mark them PASS/FAIL — they are blank for this auditor and the orchestrator pulls them from the other reports.

The single most expensive failure is **TE-EST-BPR-07** — "Post-30-Oct-2024 trusts: 50% above £1m" — which carries a £1.5m factual error against `UK-2026.1.1.json`. Same drift as MyMoney cross-flagged. DEMO-BLOCKING.

The pension-IHT story is *correctly* enacted on this screen: ExplainerChip TE-1 (Explainer.jsx line 159) says "Royal Assent 18 March 2026" and the live "Enacted · FA 2026" chip (TaxEstate.jsx line 2282) confirms FD-TE-1. **Seed S-23 PASSES.**

---

## Findings table (domain-auditor scope only)

| ID | A5 | Domain | Severity | Finding | Evidence |
|----|----|--------|----------|---------|----------|
| TE-CHR-02 | PASS | FAIL | POLISH | `BRAND.rulesVersion = 'UK-2026.1'` (brand.js:26) but the active rules file on disk is **UK-2026.1.1**. The label across the screen reads a stale version. | brand.js:26 vs `src/rules/UK-2026.1.1.json` `_meta.version` |
| TE-CHR-05 | PASS | FAIL | POLISH | Same drift as TE-CHR-02 — reads BRAND.rulesVersion. | TaxEstate header render |
| TE-CHR-06 | PASS | PASS | — | Disclaimer line "Not regulated financial advice. Verify decisions with a qualified UK financial adviser." is correct FCA info-not-advice framing. | brand.js:24 |
| TE-CHR-07 | PASS | FAIL | POLISH | Same drift as TE-CHR-02. | brand.js:26 |
| TE-SUB-T3 | PASS | NA | — | "Allowances %" composite — domain-clean. | inventory |
| TE-SUB-E3a | PASS | PASS | — | "Enacted · FA 2026" chip + `title="Royal Assent 18 Mar 2026 — effective 6 Apr 2027"` — **confirms FD-TE-1 / Seed S-23 — PASS.** | TaxEstate.jsx:2277-2284 |
| TE-SUB-E3b | PASS | PASS | — | Sub-line "Until 6 Apr 2027 · Finance Act 2026" matches `inheritanceTax.pensionIHTInclusionDate = "2027-04-06"`. | TaxEstate.jsx:2291 vs JSON:136 |
| TE-PLAN-01..05 | PASS | NA | — | Plan staleness is process not tax fact. |  |
| TE-TAX-SUM-02 | PASS | UNVERIFIED | — | "Gross X · ANI Y · Effective rate Z" relies on engine — engine maths is INTEGRATED. Domain auditor defers to engine assertions. |  |
| TE-TAX-IT-02 | PASS | PASS | — | ExplainerChip TE-1 body is correct: "Inheritance Tax rules change on 6 April 2027 — pension wrappers become IHT-eligible (Finance Act 2026, Royal Assent 18 March 2026)." Matches JSON. | Explainer.jsx:157-160 |
| TE-TAX-IT-03 | FAIL | FAIL | FUNCTIONAL | 60% taper banner copy is plain-English correct ("Each £1 of income loses 50p of personal allowance"), but threshold `100000` is **hardcoded in JSX** (TaxEstate.jsx:451). JSON exposes `personalAllowanceTaperStart=100000` / `personalAllowanceTaperEnd=125140` — must trace via TAX, not literal. Risk: if HMRC changes thresholds the banner lies. Confirms Seed S-10. | TaxEstate.jsx:451-478 vs JSON:44-46 |
| TE-TAX-IT-05 | FAIL | NA | POLISH | Income-tax band labels render raw engine keys with `_` separators (`basic_rate` → "basic rate" via `.replace(/_/g, ' ')`). Acceptable for "basic rate" but `additional_rate` / `higher_rate` survive as engine-shaped strings; non-expert friction. Confirms Seed S-12. | TaxEstate.jsx:499 |
| TE-TAX-ANI-01 | FAIL | NA | POLISH | Sub `"UK-IT-19"` printed verbatim — that is an internal coverage-doc reference, not user copy. Strip or hide behind ExplainerChip. | inventory line 157 |
| TE-TAX-CGT-05 | FAIL | NA | FUNCTIONAL | Chip "BADR 14% → 18% in 2026/27" — A6 correct (JSON `badrRate=0.18` line 102, was 0.14 prior year) — but A5 "BADR" jargon has **no inline explainer**. | TaxEstate.jsx ~CGT card |
| TE-TAX-DIV-01 | PASS | FAIL | POLISH | Sub uses raw `£${(div.gia_exposed || 0).toLocaleString()}` not `fmt()`. Format-drift relative to every other number on screen. Confirms Seed S-25. | inventory line 191 |
| TE-TAX-DIV-03 | PASS | PASS | — | "Basic 10.75%" matches JSON `dividendBasicRate=0.1075` (JSON:79). **Numerically correct.** But rate is **hardcoded in JSX** (TaxEstate.jsx:695) — Seed S-14 holds as engine-trace failure (A6) not a domain failure. | TaxEstate.jsx:695 vs JSON:79 |
| TE-TAX-DIV-04 | PASS | PASS | — | "Higher 35.75%" matches JSON `dividendHigherRate=0.3575` (JSON:80). Hardcoded same caveat. | TaxEstate.jsx:696 vs JSON:80 |
| TE-TAX-DIV-05 | PASS | PASS | — | "Add'l 39.35%" matches JSON `dividendAdditionalRate=0.3935` (JSON:81). Hardcoded same caveat. | TaxEstate.jsx:697 vs JSON:81 |
| TE-TAX-DIV-07 | FAIL | NA | FUNCTIONAL | "Move to ISA saves £X / year" — phrased as a recommendation banner, edges into advice territory. Reframe to "Could save up to £X / year if moved into ISA — informational" to stay info-not-advice. | TaxEstate.jsx:706-716 |
| TE-TAX-ALL-03 | FAIL | NA | POLISH | "PSA" abbreviation in label without inline expansion. | inventory line 205 |
| TE-TAX-ALL-06 | FAIL | NA | POLISH | "Pers. Allow" abbreviation — non-standard contraction. | inventory line 208 |
| TE-TAX-ALL-07 | FAIL | PASS | POLISH | Banner "Cash-ISA £12k cap horizon · From 6 Apr 2027 … residual £8,000 must go to S&S, IFISA, or LISA." A6 figures are **correct** (JSON `cashISACapUnder65From2027=12000`, residual £8k = £20k − £12k); A5 jargon "S&S / IFISA / LISA" un-explained for novices. | TaxEstate.jsx:756-766 vs JSON:253-254 / 540-541 |
| TE-TAX-SA-01 | FAIL | NA | POLISH | "SA100" surfaced without plain-English. Deadline fallback `'2027-01-31'` correct (JSON `selfAssessment.filingDeadlineOnline = "31 January"`) — but A6 hardcoded-date issue is conformance, not domain. | TaxEstate.jsx:775 |
| TE-TAX-DD-01 | PASS | NA | POLISH | Card title doesn't disambiguate that the *doing* surface for drawdown lives on MyMoney/Cashflow per FD-CROSS-1. Add "Showing the IHT consequence — change drawdown on MyMoney." Confirms Seed S-24. |  |
| TE-TAX-DD-07 | FAIL | NA | FUNCTIONAL | "60%" chip carries no explainer in its render context — only the wider income-tax banner explains. On the drawdown matrix the chip is orphan jargon. | inventory line 230 |
| TE-TAX-ND-01..03 | FAIL | UNVERIFIED | POLISH | "FIG / TRF" jargon — JSON has rules (figRegime / trfFacility, JSON:409-428), card lacks ExplainerChip. | TaxEstate.jsx NonDomCard |
| TE-NRI-01 | UNVERIFIED | UNVERIFIED | — | Card renders only for `entity.type === 'nri'`. Cannot inspect without seeing the rendered copy — request screenshot for verification. |  |
| TE-EST-IS-07a | PASS | FAIL | FUNCTIONAL | InheritanceStory line 94: `Your £325k tax-free band covers everything.` — figure is **correct** (JSON `nilRateBand=325000` line 121) but **hardcoded string** in JSX. If chancellor changes NRB the narrative will lie. Confirms Seed S-02. | InheritanceStory.jsx:94 vs JSON:121 |
| TE-EST-IS-10 | NA | PASS | DEMO-BLOCKING | `InheritanceStory` rendered without `onDrillMetric` prop at TaxEstate.jsx:2438 — beneficiaries-line `cta='beneficiaries'` does nothing. **Wiring failure, conformance-auditor scope** — domain-auditor flags only because it produces a *false promise* to the user (A5). Confirms Seed S-01. | TaxEstate.jsx:2438 + InheritanceStory.jsx:142-144 |
| TE-EST-IS-11 | FAIL | NA | DEMO-BLOCKING | Footer copy "Tap any line to see the calculation behind it." is **a lie** — only the beneficiaries line has a `cta` and even that is dead (S-01). This violates info-not-deception principle. Either wire all lines or change the copy to truthful. | InheritanceStory.jsx:181-183 |
| TE-EST-COI-01 | FAIL | FAIL | DEMO-BLOCKING | Card shows only `byDomain.estatePlanning` slice of CoI (TaxEstate.jsx:1507) but the surrounding visual treatment + odometer label is identical to Home (`H-ANCH-04`) which shows **total CoI** across all 12 domains. **This violates the canonical CoI definition (skill v1.4 §2.7).** Either (a) re-label this card as "Estate-planning slice of CoI" + show the share-of-total, or (b) show the total here and let the byAction breakdown highlight estatePlanning. As-is the card is silently inconsistent with Home & MyMoney. Confirms Seed S-16/S-17. | TaxEstate.jsx:1505-1528 vs Home H-ANCH-04 |
| TE-EST-IHT-01..12 | UNVERIFIED | UNVERIFIED | — | Numbers are engine-derived; engine is INTEGRATED with 1,240 assertions. Domain-auditor defers. |  |
| TE-EST-WL-01 | FAIL | NA | POLISH | Title says "Will & power of attorney (LPA)". "LPA" parenthetical is fine but the full term Lasting Power of Attorney is never spelled out. Add inline expansion or ExplainerChip. | inventory line 305 |
| TE-EST-WL-03 | FAIL | NA | FUNCTIONAL | "RED · Cohabiting partner with no current will" — content correct (cohabitants have no intestacy rights per JSON:185-186 `intestacyNote`), but copy is alarmist red with no plain-English explanation of *why* (cohabitants get nothing automatically). Add one-line context: "Cohabitants are not automatic beneficiaries under UK intestacy rules." | TaxEstate.jsx WillLPACard |
| TE-EST-WL-06 | UNVERIFIED | UNVERIFIED | — | "Cost of dying intestate: £X" — number traces through engine `noWillCoI`; domain-auditor defers to engine math. |  |
| TE-EST-WF-02 | FAIL | FAIL | DEMO-BLOCKING (CROSS-FLAG) | Chip "Couples £5m business + agricultural relief pool" — figure correct per JSON `aprBprCombinedAllowanceCouple=5000000` (line 144) — but companion chip at TE-EST-BPR-07 contradicts it. Together they tell the user: "couples have £5m" and "post-30-Oct trusts: 50% above £1m". **The £1m figure is the error** (see TE-EST-BPR-07). |  |
| TE-EST-WF-05 | FAIL | NA | FUNCTIONAL | "Gifts to trust" slider label — "gifts to trust" jargon. Non-expert needs: "Gifts you put into a trust (a separate legal pot)." | inventory line 322 |
| TE-EST-WF-06 | FAIL | NA | FUNCTIONAL | "BPR positioning" + "pre vs post 30-Oct-2024" — date-as-jargon. Needs ExplainerChip explaining the Oct 2024 Budget change. | inventory line 323 |
| TE-EST-TR-01 | FAIL | NA | POLISH | "Trust 10-year periodic charge" — "periodic charge" is technical-correct (JSON:381-383 `periodicCharge`) but needs A5 inline "(every 10 years HMRC takes up to 6% of trust value above NRB)". | inventory line 342 |
| TE-EST-BPR-01 | FAIL | NA | FUNCTIONAL | "BPR & APR" title — both acronyms surface on the card title with no expansion. Card sub mentions "£2.5m" but never names "Business Property Relief" or "Agricultural Property Relief". A5 fail at the title level for a tax-novice. | TaxEstate.jsx:1461-1462 |
| TE-EST-BPR-05 | FAIL | NA | FUNCTIONAL | "AIM (Tier 2 50%)" — "AIM" not expanded ("Alternative Investment Market"), "Tier 2" is internal taxonomy. | TaxEstate.jsx:1478 |
| TE-EST-BPR-06 | PASS | PASS | — | "Pre-30-Oct-2024 trusts: 100% relief" — A6 correct per JSON `bprTrustAntiFragmentationNote` (line 151). |  |
| TE-EST-BPR-07 | FAIL | **FAIL** | **DEMO-BLOCKING** | **"Post-30-Oct-2024 trusts: 50% above £1m"** — the **£1m figure is wrong**. Per `UK-2026.1.1.json` line 142-143 `aprBprCombinedAllowance=2500000` ("100% within £2.5m … 50% above"), and `bprQualifyingNote` line 142 explicitly says "100% relief within £2.5m combined APR/BPR allowance. 50% above allowance." £1m is the legacy figure from the FA2026 consultation papers — **superseded**. This is the same error MyMoney auditor cross-flagged. **The screen is telling users the BPR threshold is £1m when it is £2.5m — a £1.5m-per-person factual error in a screen where domain correctness is the whole point.** | TaxEstate.jsx:1482 vs JSON:140-146 |
| TE-EST-BPR-08 | FAIL | NA | FUNCTIONAL | "7-yr refresh applies" — totally opaque without context. Should read "Allowance refreshes 7 years after gifting (individual) / 10 years (trust)." Per JSON:147-148. |  |
| TE-EST-BPR-09 | FAIL | NA | POLISH | "Instalment option available" — IHT-on-business instalment option needs one-line explanation. |  |
| TE-EST-BPR-10 | FAIL | FAIL | POLISH | "CPI indexation (post-2030)" — A6 broadly correct (JSON:149 `bprCPIIndexationFrozenUntil = "2031-04-06"`), but the chip says "post-2030" — should read "from 6 April 2031" to match JSON. Mismatch by 4 months between display and rules. |  |
| TE-EST-BPR-11 | FAIL | NA | POLISH | "APR" never expanded on the card. |  |
| TE-EST-RN-01 | FAIL | NA | POLISH | "RNRB" / "taper" jargon untransformed. |  |
| TE-EST-RN-03 | FAIL | FAIL | FUNCTIONAL | "£2m taper" banner — figures correct per JSON `residenceNilRateBandTaperStart=2000000` (JSON:125), £2,350,000 end is **mathematically** correct (£2m + 2× £175k RNRB = £2.35m for singles). But **JSON does not export `taperEnd`** — the JSX hardcodes `2350000` and assumes the £175k RNRB is unchanged. For couples the same formula gives £2.7m, but the banner shows £2.35m regardless. **Couples-specific bug + hardcoded constant.** Confirms Seed S-03. | TaxEstate.jsx:1407-1408, 1427 |
| TE-DRL-IHT-06 | FAIL | PASS | FUNCTIONAL | NRB fallback `nilRate ?? 325000` (TaxEstate.jsx:1861) — figure correct (JSON:121) but hardcoded fallback risks divergence on next Budget. Confirms Seed S-04. | TaxEstate.jsx:1861 |
| TE-DRL-IHT-08 | FAIL | NA | POLISH | "Residence NRB" jargon — not expanded. |  |
| TE-DRL-IHT-10 | FAIL | PASS | FUNCTIONAL | "IHT @ 40%" — rate correct (JSON:132 `ihtRate=0.40`) but the **string is literal** in JSX (line 1875). If HMRC reduces or carves the rate (e.g. 36% charity rate would need different label), this stays at 40%. Confirms Seed S-05. | TaxEstate.jsx:1875 |
| TE-DRL-IHT-13 | FAIL | NA | FUNCTIONAL | "Gifts, trusts, and pension nominations can reduce this figure — see Estate tab for options." — borders on advice phrasing ("can reduce") + no actual destination ("see Estate tab" — user is already on Estate tab). Confirms Seed S-13 reformulation needed. | TaxEstate.jsx:1986 |
| TE-DRL-IHT-14 | PASS | PASS | — | "Based on UK IHT rules · Finance Act 2026 · Not regulated advice" — correct FCA framing. | TaxEstate.jsx:1990 |
| TE-DRL-AL-05 | FAIL | PASS | FUNCTIONAL | ISA limit fallback `TAX.isa_limit ?? 20000` (TaxEstate.jsx:2007) — figure correct (JSON `isa.annualAllowance=20000`, line 244) but hardcoded fallback. Confirms Seed S-08. | TaxEstate.jsx:2007 |
| TE-DRL-AL-06 | FAIL | PASS | FUNCTIONAL | PSA desc: "£1,000 basic rate · £500 higher rate · £0 additional" hardcoded (TaxEstate.jsx:2008) — figures correct (JSON:72-74 `savingsAllowance...`) but inline literals, not engine-traced. Confirms Seed S-09. | TaxEstate.jsx:2008 |
| TE-DRL-AL-07 | FAIL | PASS | FUNCTIONAL | CGT exemption fallback `?? 3000` (TaxEstate.jsx:2009) — figure correct (JSON:97 `annualExemptAmount=3000`) but hardcoded. Confirms Seed S-08. | TaxEstate.jsx:2009 |
| TE-DRL-AL-08 | FAIL | PASS | FUNCTIONAL | Dividend allowance fallback `?? 500` (TaxEstate.jsx:2010) — figure correct (JSON:78 `dividendAllowance=500`) but hardcoded. Confirms Seed S-08. | TaxEstate.jsx:2010 |
| TE-DRL-AL-09 | FAIL | PASS | FUNCTIONAL | PA fallback `?? 12570` + desc with "£100k ANI" + "£125,140" hardcoded (TaxEstate.jsx:2011) — figures correct (JSON:41/44/45) but literal strings. Confirms Seed S-08, S-09. | TaxEstate.jsx:2011 |
| TE-DRL-AL-12 | PASS | PASS | — | "Based on UK 2026/27 thresholds · Not regulated advice" — FCA correct. |  |
| TE-DRL-BPR-04 | FAIL | FAIL | FUNCTIONAL | BPR rate logic hardcoded in JSX: `const isMixed = /mixed|investment|property/i.test(b.type)` → `rate = isMixed ? 0.5 : 1.0` (TaxEstate.jsx:1631-1632). **Wrong on multiple counts:** (a) regex-on-description is brittle taxonomy; (b) the JSON taxonomy is *allowance-driven* — 100% relief **within** £2.5m combined APR/BPR cap, 50% **above** the cap, regardless of trading-vs-mixed (per JSON:142). The trading-vs-investment split is a separate qualifying test, not a rate switch. The drill panel will tell a user with a £3m trading business they get 100% on the lot, when in fact they get 100% on £2.5m and 50% on the £500k excess. Domain-incorrect. Confirms Seed S-11. | TaxEstate.jsx:1625-1635 vs JSON:140-146 |
| TE-DRL-BPR-09 | PASS | PASS | — | "BPR must be held ≥2 years" — JSON `aimBPRNote` (line 153) "2-year qualifying hold unchanged" confirms. |  |
| TE-DRL-BPR-10 | PASS | PASS | — | FCA framing correct. |  |
| TE-DRL-CGT-09 | FAIL | PASS | FUNCTIONAL | `TAX.cgt.exempt ?? TAX.cgt.annual_exempt_amount ?? 3000` hardcoded (TaxEstate.jsx:1736) — figure correct (JSON:97) but hardcoded. Confirms Seed S-07. |  |
| TE-DRL-CGT-11 | FAIL | PASS | FUNCTIONAL | "CGT at 18% (basic rate)" — rate correct (JSON:98 `basicRate=0.18`) but `taxBasic = Math.round(taxable * 0.18)` is **literal** (TaxEstate.jsx:1738). If 2027 Budget changes rate the drill is wrong. Confirms Seed S-06. | TaxEstate.jsx:1738 |
| TE-DRL-CGT-12 | FAIL | PASS | FUNCTIONAL | "CGT at 24% (higher rate)" — rate correct (JSON:99 `higherRate=0.24`) but `taxHigher = Math.round(taxable * 0.24)` literal (TaxEstate.jsx:1739). Confirms Seed S-06. | TaxEstate.jsx:1739 |
| TE-DRL-CGT-13 | FAIL | NA | FUNCTIONAL | "Consider harvesting up to £X in gains per tax year to use your annual exempt amount." — "Consider" reads as advice. Reframe to "Up to £X of unused annual exempt amount remains this year — informational." | TaxEstate.jsx:1838 |
| TE-DRL-CGT-14 | PASS | PASS | — | FCA framing correct. |  |

---

## Cross-screen reconciliation (FD-CROSS-1)

| Surface | Metric | Value source | Domain verdict |
|---------|--------|--------------|----------------|
| Home `H-ANCH-04` | CoI total | `totalCoI(e)` | Total CoI across 12 domains — canonical |
| T&E `TE-EST-COI-01` | CoI total | `totalCoI(e).byDomain.estatePlanning` | **Slice only — UI labels imply total — FAIL** |
| MyMoney | CoI total | `totalCoI(e)` | Pending MM auditor confirmation |

**Action required:** either re-label the T&E card as "Estate-planning slice of CoI · X% of total" or change the value to the total. Currently it silently undercuts Home.

---

## Founder-IP integrity

- **Cost of Inaction (CoI)** — canonical definition is the aggregate NPV across 12 domains. T&E's EstateCoIOdometer **narrows** the definition to one domain without telling the user. This is a v1.4 §2.7 violation by *under-representation*, not by mis-definition. DEMO-BLOCKING when seen alongside Home.
- **PRC / PCC / Reality Engine / Drawdown Efficiency Ratio / Effective Beneficiary Rate** — none referenced on T&E. No invented definitions. PASS.

---

## Placeholder leakage

- "UK-IT-19" surfaced in ANI card sub (TE-TAX-ANI-01) is internal-coverage-doc jargon leaking into UX — borderline placeholder. POLISH.
- No "mapping inbound" / "draft" / lorem strings found in JSX. PASS overall on placeholder scan.

---

## Coverage

Domain-auditor reviewed **64 of 227 rows** where A5 / financial-fact / FCA framing is in scope; the remaining 163 rows are A1/A2/A3/A4/A6 territory (conformance, wiring, reconciliation) — out of this auditor's authority. Of the 64 rows in scope: **40 FAIL, 19 PASS, 5 UNVERIFIED** (need engine inspection or screenshot of NRI/non-dom states).

Domain coverage = **64/64 in-scope rows verified** (100% of domain-auditor scope).

---

## Severity rollup (domain-auditor only)

| Severity | Count | Notable IDs |
|----------|-------|-------------|
| DEMO-BLOCKING | 4 | TE-EST-BPR-07 (£1m vs £2.5m BPR error) · TE-EST-IS-10/11 (false drill promise) · TE-EST-COI-01 (CoI mis-scope vs Home) |
| FUNCTIONAL | 24 | All "rate/figure correct but hardcoded" rows (DRL-IHT, DRL-CGT, DRL-AL) · TE-TAX-DIV-07 advice phrasing · TE-DRL-BPR-04 wrong BPR taxonomy · TE-EST-WL-03 no intestacy explainer · TE-EST-BPR-01/05/08 jargon · TE-EST-RN-03 hardcoded taperEnd · TE-EST-WF-02 cross-flag · TE-TAX-IT-03 hardcoded taper threshold |
| POLISH | 14 | Rules-version drift TE-CHR-02/05/07 · "PSA"/"BADR"/"AIM"/"APR"/"RNRB"/"FIG"/"TRF"/"SA100"/"LPA" un-expanded acronyms · "UK-IT-19" placeholder · format inconsistencies |

---

## TE domain: 19 PASS, 40 FAIL (4 DB, 24 F, 12 P).
