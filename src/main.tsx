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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
