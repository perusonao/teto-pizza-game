import type { CapacitorConfig } from '@capacitor/cli'

// M1 PoC only (#571). `appId` / `appName` are PROVISIONAL placeholders: the store name, Bundle ID and release country are
// Owner decisions for M3 and must not be treated as final.
const config: CapacitorConfig = {
  appId: 'com.example.tetopizza.poc',
  appName: 'Teto Pizza PoC',
  webDir: 'dist-app',
}

export default config
