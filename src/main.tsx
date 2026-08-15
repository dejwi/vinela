import React from 'react'
import ReactDOM from 'react-dom/client'
import { preloadSettings } from '@/features/settings/hooks/useAppSettings'
import { App } from './app/App'
import './index.css'

// Pre-warm the app settings cache before React renders.
// This populates the hook's module-level cache so the Settings page
// renders immediately with correct values — no loading flash.
preloadSettings()

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
