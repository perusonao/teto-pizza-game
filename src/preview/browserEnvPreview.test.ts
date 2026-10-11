import { describe, expect, it } from "vitest";
import { browserEnvBadgeLabel, classifyBrowserEnv } from "./browserEnvPreview";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";
const WEBVIEW_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36";
const LINE_ANDROID = `${WEBVIEW_ANDROID} Line/14.5.0`;

describe("#467 browser environment label", () => {
  it("a normal Android Chrome is BROWSER with its major version", () => {
    expect(classifyBrowserEnv(CHROME_ANDROID)).toEqual({ line: false, webview: false, chromeMajor: 124 });
    expect(browserEnvBadgeLabel(classifyBrowserEnv(CHROME_ANDROID))).toBe("BROWSER·C124");
  });

  it("an Android WebView is flagged WV", () => {
    expect(browserEnvBadgeLabel(classifyBrowserEnv(WEBVIEW_ANDROID))).toBe("BROWSER·WV·C124");
  });

  it("the LINE in-app browser is flagged by its Line/ token", () => {
    expect(classifyBrowserEnv(LINE_ANDROID)).toEqual({ line: true, webview: true, chromeMajor: 124 });
    expect(browserEnvBadgeLabel(classifyBrowserEnv(LINE_ANDROID))).toBe("LINE·WV·C124");
  });

  it("does not mistake other tokens for LINE", () => {
    expect(classifyBrowserEnv("Mozilla/5.0 Chrome/124.0 Mobile Safari/537.36 Airline/1").line).toBe(false);
    expect(classifyBrowserEnv("Mozilla/5.0 Chrome/124.0 Mobile Safari/537.36 Line").line).toBe(false);
  });

  it("an unreadable user agent says so instead of guessing", () => {
    expect(browserEnvBadgeLabel(classifyBrowserEnv(undefined))).toBe("BROWSER·C?");
    expect(browserEnvBadgeLabel(classifyBrowserEnv(42))).toBe("BROWSER·C?");
  });
});
