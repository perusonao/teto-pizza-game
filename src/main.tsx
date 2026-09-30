import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyPreviewHvSeed } from './preview/hvSeeds'

// Discovery Hint 5.0 H5-5: Preview builds only. `?hv=<scenario>` seeds the Preview save before the
// app loads it. `import.meta.env.VITE_PREVIEW_MODE` is set only by the Preview build pipeline and is
// replaced statically, so a production build drops this call and ./preview/hvSeeds.ts with it.
if (import.meta.env.VITE_PREVIEW_MODE) {
  try {
    applyPreviewHvSeed(window.location.search, window.localStorage)
  } catch {
    // A failing seed must never stop the game from starting.
  }
}

const root = createRoot(document.getElementById('root')!)

function renderApp() {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// CUT-S2 Owner HV (Issue #288): Preview/DEV builds only. Vite replaces both env flags statically, so a
// production build drops this branch, the dynamic import and the whole ./preview/cutHvBoot chunk; it
// renders the normal app immediately. In a Preview build the boot module decides whether `?cuthv=1`
// was asked for, and anything else (or any failure) falls through to the normal app.
if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
  void import('./preview/cutHvBoot').then(({ bootCutHvIfRequested }) => bootCutHvIfRequested(root, window.location.search)).then(
    (handled) => {
      if (!handled) renderApp()
    },
    renderApp,
  )
} else {
  renderApp()
}
