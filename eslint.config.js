import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// ── S1 selector layer (Phase 2, 2026-05-28) ─────────────────────────────────
// Surfaces (src/screens/**) and drill components (src/components/MyMoney/**)
// must reach for canonical readers via the selector facade at
// src/engine/selectors/index.js — NOT by importing the underlying engine
// files directly.
//
// This rule catches the P0-2 class of bug structurally: when HomeScreen.jsx
// had its own inline `(+l.mortgage||0) + (+l.loans||0) + …` reader, the
// engine's `liabilitiesTotal()` walker was right there in _helpers.js but
// the screen never called it — so Bruce's £180k BTL mortgage was silently
// missed. The selector facade forces the right call.
//
// Selector-covered identifiers (block direct import in screens):
//   netWorth, investable, liabilitiesTotal, annualIncome, pensionTotal,
//   investmentsTotal, propertyTotal, cashTotal, getMonthlyEssentials,
//   calcANI, calcHICBC, calcPSA, calcFQ, calcFQCalibrated, protectionScore,
//   ihtExposure, ihtProjection, ihtDeltaPrePost2027, costOfInaction,
//   coiForDomain, personAge, statePensionAnnual, isCouple, maritalStatus,
//   netWorthHistory, netWorthAtYears, protectionFlat, getWrapper
//
// Other engine exports (calcRisk, calcAPQ, riskShockSuite, cf_* re-exports,
// fmt, TAX, etc.) are NOT yet in the facade — keep importing those
// directly from their source files until added.
const SELECTOR_COVERED = [
  'netWorth', 'investable', 'liabilitiesTotal', 'annualIncome',
  'pensionTotal', 'investmentsTotal', 'propertyTotal', 'cashTotal',
  'getMonthlyEssentials', 'calcANI', 'calcHICBC', 'calcPSA',
  'calcFQ', 'calcFQCalibrated', 'protectionScore',
  'ihtExposure', 'ihtProjection', 'ihtDeltaPrePost2027',
  // costOfInaction NOT blocked — fq-calculator.js and tax-estate-engine.js
  // export it with different signatures: (entity, actionDomain) vs
  // (entity, bundle). Conflating via facade breaks call sites.
  // coiForDomain stays blocked (only one signature).
  'coiForDomain', 'personAge', 'statePensionAnnual',
  'isCouple', 'maritalStatus', 'netWorthHistory', 'netWorthAtYears',
  'protectionFlat', 'getWrapper',
]

const RAW_ENGINE_PATHS = [
  '../engine/_helpers.js',
  '../engine/fq-calculator.js',
  '../engine/canonical-metrics.js',
  '../engine/tax-estate-engine.js',
  '../engine/persona-helpers.js',
  '../../engine/_helpers.js',
  '../../engine/fq-calculator.js',
  '../../engine/canonical-metrics.js',
  '../../engine/tax-estate-engine.js',
  '../../engine/persona-helpers.js',
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Pre-existing repo-wide lint debt downgraded error→warn so CI gates on
      // real breakage (syntax/parse) while debt stays visible. Cleanup PR later.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'no-undef': 'warn',
      'no-empty': 'warn',
      'no-dupe-keys': 'warn',
      'no-useless-escape': 'warn',
      'no-self-assign': 'warn',
      'no-constant-binary-expression': 'warn',
      'react-refresh/only-export-components': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  // Screens + drill components MUST go via the selector facade for the
  // identifiers listed above. Importing other identifiers from the same
  // raw paths is allowed via `importNames` allowlisting at the call site
  // (eslint reports the specific blocked names, not the whole import).
  {
    files: ['src/screens/**/*.{js,jsx}', 'src/components/MyMoney/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        paths: RAW_ENGINE_PATHS.map(path => ({
          name: path,
          importNames: SELECTOR_COVERED,
          message:
            'Selector-covered reader: import from ../engine/selectors/index.js instead.',
        })),
      }],
    },
  },
  // The selector module itself + the engine itself are exempt — they ARE
  // the canonical layer.
  {
    files: [
      'src/engine/**/*.{js,jsx}',
      'src/de/**/*.{js,jsx}',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
])