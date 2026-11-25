import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { TEST_HOOKS_ENABLED, testHooksPlugin } from './tools/testHooksPlugin.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Native app build (Capacitor, M1 of #571): `vite build --mode app`. Relative base (the WebView serves the bundle from
  // its own origin, not from /teto-pizza-game/) and a separate output directory, so the browser build and its Preview are untouched.
  const isApp = mode === 'app'
  return {
    base: isApp ? './' : '/teto-pizza-game/',
    ...(isApp ? { build: { outDir: 'dist-app' } } : {}),
    plugins: [react(), ...(TEST_HOOKS_ENABLED ? [testHooksPlugin()] : [])],
  }
})
