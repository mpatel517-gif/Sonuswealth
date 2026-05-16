import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/animations.css'
import './styles/design-tokens.css'
import App from './App.jsx'

// Set body to full height and centre the app
document.body.style.cssText = 'margin:0;padding:0;min-height:100vh;display:flex;justify-content:center;'
document.getElementById('root').style.cssText = 'width:100%;display:flex;justify-content:center;'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
