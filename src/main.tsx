// First, so the old "codevision.*" saved values are under their new names before any store reads them.
import './lib/migrateStorage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics'

// Before the router starts, so PostHog sees every URL change from the first one.
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
