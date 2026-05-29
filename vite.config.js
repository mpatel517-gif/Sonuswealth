import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// L5-6 (2026-05-28): explicit chunking strategy.
//
// Before: one 2.5 MB main chunk loaded on every screen. The bundle warning
// at every build was a daily reminder that we were shipping everything to
// every user even when most surfaces only need a slice.
//
// After: vendor / engine / charts / app split. First paint loads vendor +
// app; engine + charts load lazily as soon as the user hits a screen that
// needs them. Same total bytes, much faster Time-to-Interactive on the
// landing screen.
//
// Strategy:
//   - 'vendor' — react + react-dom + supabase (rarely changes; long cache)
//   - 'engine' — fq-calculator, tax-estate-engine, cashflow-engine, risk-engine
//                (re-deployed every Budget; medium cache)
//   - 'charts' — chart components + heavy Cashflow V2 components (svg-heavy,
//                only loaded on screens that use them)
//   - 'app'    — everything else (the screens themselves)
//
// `manualChunks` works with both Vite's Rolldown bundler and the legacy
// esbuild dev path. If a future module move breaks a chunk boundary the
// bundle still builds — the module just lands in the closest parent chunk.
export default defineConfig({
  plugins: [react()],
  build: {
    // Warning threshold up to 800kB — engine chunk legitimately exceeds 500.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
            if (id.includes('@supabase'))                          return 'vendor-supabase'
            return 'vendor'
          }
          if (id.includes('/src/engine/'))                         return 'engine'
          if (id.includes('/src/components/charts/'))              return 'charts'
          if (id.includes('/src/components/Cashflow/'))            return 'charts-cashflow'
          if (id.includes('/src/components/MyMoney/'))             return 'mymoney'
          return undefined
        },
      },
    },
  },
})
