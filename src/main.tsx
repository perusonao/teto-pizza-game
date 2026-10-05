import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyPreviewHvSeed } from './preview/hvSeeds'

// Discovery Progression Inspector: a DEV / Preview only, read-only developer screen, opened with
// `?inspector=discovery`. Both env checks are replaced statically by Vite, so a production build
// drops this branch and the dynamically imported ./dev chunk with it (src/dev/inspectorAccess.gate.test.ts).
// No in-app link leads here. It replaces <App />, so no player state is loaded or saved.
const inspectorRequested =
  (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) &&
  new URLSearchParams(window.location.search).get('inspector') === 'discovery'

// DEV State Editor (Issue #403): a DEV / Preview only developer page, opened with `?dev=state`. The same static
// env gate as the Inspector, so a production build drops this branch and the dynamically imported ./devtools
// chunk with it (src/devtools/devtoolsAccess.test.ts, src/preview/previewIsolation.gate.test.ts). No in-app link
// leads here. It replaces <App />, and merely opening it never writes the save (it also never seeds, below).
const devStateRequested =
  (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) &&
  new URLSearchParams(window.location.search).get('dev') === 'state'

// An Inspector / DEV State Editor request never seeds: both are read-only on open, and a seed would reset / write the Preview save.
// Discovery Hint 5.0 H5-5: Preview builds only. `?hv=<scenario>` seeds the Preview save before the
// app loads it. `import.meta.env.VITE_PREVIEW_MODE` is set only by the Preview build pipeline and is
// replaced statically, so a production build drops this call and ./preview/hvSeeds.ts with it.
if (import.meta.env.VITE_PREVIEW_MODE && !inspectorRequested && !devStateRequested) {
  try {
    applyPreviewHvSeed(window.location.search, window.localStorage)
  } catch {
    // A failing seed must never stop the game from starting.
  }
}

const root = createRoot(document.getElementById('root')!)

if (inspectorRequested) {
  void import('./dev/DiscoveryProgressionInspector').then(({ DiscoveryProgressionInspector }) => {
    root.render(
      <StrictMode>
        <DiscoveryProgressionInspector />
      </StrictMode>,
    )
  })
} else if (devStateRequested) {
  void import('./devtools/StateEditorShell').then(({ StateEditorShell }) => {
    root.render(
      <StrictMode>
        <StateEditorShell />
      </StrictMode>,
    )
  })
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
