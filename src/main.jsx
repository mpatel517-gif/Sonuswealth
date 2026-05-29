import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/animations.css'
import './styles/design-tokens.css'
import App from './App.jsx'
import { initObservability } from './lib/observability.js'
import { primeLiveContent } from './hooks/useContent.js'

// L1-4 (2026-05-28): kick off Sentry + PostHog init as early as possible so
// uncaught render errors in App's first render can still be captured. The
// promise is intentionally not awaited — observability must never block
// first paint. When DSNs aren't configured this is a no-op.
initObservability()

// L3-5 (2026-05-28): prime the live content overlay in the background. If
// the content-pull function 200s, the next render sees fresh copy. If it
// fails or the env vars are missing, the static src/content/uk-en.json
// bundle remains the source of truth — copy never disappears.
primeLiveContent()

// Set body to full height and centre the app
document.body.style.cssText = 'margin:0;padding:0;min-height:100vh;display:flex;justify-content:center;'
document.getElementById('root').style.cssText = 'width:100%;display:flex;justify-content:center;'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
