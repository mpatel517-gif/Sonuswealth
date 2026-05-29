# Sonuswealth coverage manifest

**Generated:** 2026-05-25 21:56:18 UTC
**Purpose:** Every cell explicit. Empty = not tested. No hidden gaps.

## A. Tax-bundle coverage (UK)

| Tax year | Bundle file | Version | Mid-year events | FULL sections | STUB sections |
|---|---|---|---|---|---|
| 2021/22 | UK-2021.1.1.json | UK-2021.1.1 | 0 | income, pension, isa, capitalGains, inheritanceTax, nationalInsurance, taxEfficientInvestments | overseas, trusts, welshIT, milestones |
| 2022/23 | UK-2022.1.1.json | UK-2022.1.1 | 4 | income, pension, isa, capitalGains, inheritanceTax, nationalInsurance, taxEfficientInvestments | overseas, trusts, welshIT, milestones |
| 2023/24 | UK-2023.1.1.json | UK-2023.1.1 | 1 | income, pension, isa, capitalGains, inheritanceTax, nationalInsurance, taxEfficientInvestments | overseas, trusts, welshIT, milestones |
| 2024/25 | UK-2024.1.1.json | UK-2024.1.1 | 3 | income, pension, isa, capitalGains, inheritanceTax, nationalInsurance, taxEfficientInvestments | overseas, trusts, welshIT, milestones |
| 2025/26 | UK-2025.1.1.json | UK-2025.1.1 | 0 | income, pension, isa, capitalGains, inheritanceTax, nationalInsurance, taxEfficientInvestments | trusts, welshIT, milestones |
| 2026/27 | UK-2026.1.1.json | UK-2026.1.1 | 0 | n/a | n/a |

**Status:** 6/6 years built. ✓ all years covered.

## B. Persona inventory by family

Total persona-shaped JSON files on disk: **111**

| Family | Count | Schema | UI-renderable? | Wired in runner.mjs? |
|---|---|---|---|---|
| main | 7 | live-UI | yes | yes (--full) |
| matrix | 84 | live-UI / unknown | engine-only | yes (--matrix) |
| historical | 7 | unknown | engine-only | yes (--all-personas) |
| mrT | 13 | engine-test / live-UI | yes | yes (--family mrT, Phase A4) |

## C. Year × persona matrix (engine-direct coverage)

Cell content: `✓ <bundle.version>` if that year's bundle exists; `—` if the bundle is missing.

| Family | Persona | Schema | Jurisdiction | 2021/22 | 2022/23 | 2023/24 | 2024/25 | 2025/26 | 2026/27 |
|---|---|---|---|---|---|---|---|---|---|
| main | persona-a | live-UI | UK-2026.1 | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| main | persona-b | live-UI | UK-2026.1 | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| main | persona-c | live-UI | UK-2026.1 | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| main | persona-d | live-UI | UK-2026.1 | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| main | persona-e | live-UI | UK-2026.1 | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| main | persona-f | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| main | persona-g | live-UI | UK-2026.1 | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-aged-out | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-beneficiary | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-cohab-sep | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-core | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-couple | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-decum-complex | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-divorced | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-family | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-landlord | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-ltd-director | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-sole-trader | engine-test | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-uk-in | engine-test | UK+IN | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| mrT | mrT-uk-th | engine-test | UK+TH | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | aged-out-foundation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | beneficiary-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | beneficiary-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | beneficiary-decumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | beneficiary-foundation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | beneficiary-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | bruce-wayne-series | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-001 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-002 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-003 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-004 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-005 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-006 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-007 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-008 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-009 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-010 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-011 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-012 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-013 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-014 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-015 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-016 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-017 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-018 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-019 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-020 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-021 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-022 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-023 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-024 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-025 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-026 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | CASE-027 | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | cohab-sep-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | cohab-sep-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | cohab-sep-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-accumulation-uk-in | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-decumulation-uk-in | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-decumulation-uk-th | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-decumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-foundation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-legacy | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-preservation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | couple-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | divorced-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | divorced-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | divorced-decumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | divorced-legacy | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | divorced-preservation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | divorced-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | family-primary-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | family-primary-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | family-primary-foundation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | family-primary-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | global-test-matrix | unknown | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | landlord-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | landlord-consolidation-uk-in | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | landlord-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | landlord-decumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | landlord-preservation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | landlord-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | ltd-director-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | ltd-director-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | ltd-director-decumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | ltd-director-preservation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | ltd-director-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-accumulation-uk-in | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-consolidation-uk-in | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-decumulation-uk-th | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-decumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-foundation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-legacy | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-preservation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | single-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | sole-trader-accumulation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | sole-trader-consolidation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | sole-trader-foundation | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | sole-trader-transition | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| matrix | tony-stark-series | live-UI | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| historical | persona-series-A | unknown | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| historical | persona-series-B | unknown | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| historical | persona-series-C | unknown | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| historical | persona-series-D | unknown | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| historical | persona-series-E | unknown | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| historical | persona-series-F | unknown | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |
| historical | persona-series-G | unknown | UK | ✓ UK-2021.1.1 | ✓ UK-2022.1.1 | ✓ UK-2023.1.1 | ✓ UK-2024.1.1 | ✓ UK-2025.1.1 | ✓ UK-2026.1.1 |

## D. Jurisdiction coverage

| Code | Jurisdiction | Bundle status | Persona fixtures referencing |
|---|---|---|---|
| UK | United Kingdom | FULL (6 years) | 105 (persona-f, mrT-aged-out, mrT-beneficiary…) |
| IN | India | NONE — deferred to Phase D | 1 (mrT-uk-in) |
| TH | Thailand | NONE — deferred to Phase D | 1 (mrT-uk-th) |
| CA | Canada | NONE — deferred to Phase D | — |
| IE | Ireland | NONE — deferred to Phase D | — |
| AU | Australia | NONE — deferred to Phase D | — |

## E. Known gaps (surfaced explicitly — Phase D candidates)

- IN: 1 persona(s) reference this jurisdiction but engine has no India tax bundle
- TH: 1 persona(s) reference this jurisdiction but engine has no Thailand tax bundle
- 12 mrT-* fixtures use engine-test schema (nested individual.*) — NOT UI-renderable. Normaliser deferred to Phase D.

## F. How to regenerate

```sh
node scripts/build-coverage-manifest.mjs
```

Run after: (a) adding a new tax bundle, (b) creating a new persona JSON, (c) changing the jurisdiction list, (d) reclassifying a persona family.
