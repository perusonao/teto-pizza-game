/**
 * #467 (diagnostic, Preview only): make the browser environment visible on screen.
 *
 * Owner HV saw the cut / RESULT pizza break inside the LINE in-app browser, while a normal Android browser with
 * `?pieceRelief=off` drew it correctly. Those two reports change BOTH the environment and the SVG filter, so they cannot
 * separate the two causes. The Preview badge therefore prints the environment next to the existing `RELIEF OFF` mark: every
 * screenshot / recording then says by itself which browser and which filter state it shows.
 *
 * Classification is by user-agent token only (`Line/` for the LINE app, `; wv)` for an Android WebView, `Chrome/<major>`);
 * it reads nothing else, stores nothing and changes no behaviour. Read ONLY behind `import.meta.env.VITE_PREVIEW_MODE`
 * (set by the Preview build pipeline alone), so a production `vite build` compiles it out; the gate test scans for the mark.
 * Diagnostic only -- not a fix.
 */

/** Present in this module only. The production-bundle gate looks for it. */
export const BROWSER_ENV_PREVIEW_MARK = "browser-env-preview-v1";

export interface BrowserEnv {
  /** The LINE app's in-app browser (`Line/<version>` token). */
  line: boolean;
  /** An Android System WebView (`; wv)` token). LINE's in-app browser is expected to be one; this tells us if it is. */
  webview: boolean;
  /** Chromium major version from `Chrome/<major>`, or null when the token is absent. */
  chromeMajor: number | null;
}

export function classifyBrowserEnv(userAgent: unknown): BrowserEnv {
  const ua = typeof userAgent === "string" ? userAgent : "";
  const chrome = /\bChrome\/(\d+)/.exec(ua);
  return {
    line: /\bLine\/\d/.test(ua),
    webview: /;\s*wv\)/.test(ua),
    chromeMajor: chrome ? Number(chrome[1]) : null,
  };
}

/** The badge suffix, e.g. `LINE·WV·C124` or `BROWSER·C124`; `UA?` when nothing could be read. */
export function browserEnvBadgeLabel(env: BrowserEnv): string {
  const parts = [env.line ? "LINE" : "BROWSER"];
  if (env.webview) parts.push("WV");
  parts.push(env.chromeMajor === null ? "C?" : `C${env.chromeMajor}`);
  return parts.join("·");
}

let cached: string | null = null;

/** Read once on the first call after page load and kept for the session. */
export function browserEnvForPreview(): string {
  if (cached === null) {
    cached = browserEnvBadgeLabel(classifyBrowserEnv(typeof navigator === "undefined" ? "" : navigator.userAgent));
  }
  return cached;
}
