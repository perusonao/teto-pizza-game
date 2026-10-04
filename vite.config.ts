import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { TEST_HOOKS_ENABLED, testHooksPlugin } from './tools/testHooksPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  base: '/teto-pizza-game/',
  plugins: [react(), ...(TEST_HOOKS_ENABLED ? [testHooksPlugin()] : [])],
})
