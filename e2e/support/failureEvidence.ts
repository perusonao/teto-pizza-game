import { writeFile } from "node:fs/promises";
import { test as base, type Page, type TestInfo } from "@playwright/test";
import { budgetLeft, diagEnabled, diagLog, inFlightLabels } from "./diag";

/**
 * #394 Phase 2 (failure evidence): when a WebKit test FAILS, leave the DOM, the screenshot and WHERE it was waiting in the CI artifacts and job log.
 *
 * Why: the screenshot Playwright takes on failure is the only thing the artifacts held (trace is off on WebKit), a closed page gives none, the
 * artifact blobs are not always readable, and nothing recorded the DOM at the moment of failure -- so "Expected badge --near / Received --just" or
 * "element(s) not found" could not be told from a half-rendered page.
 *
 * What it adds, ONLY for a test that did not end as expected (a passing test runs nothing, writes nothing, waits for nothing):
 *  - `failure-evidence.json`: project / viewport / url / page closed / test budget left, the watched calls still in flight, the spec frames and the
 *    `Call log:` of every error (= which action or locator it was waiting on), and a compact DOM summary;
 *  - `failure-dom.html`: the page's `outerHTML` (capped at 200 KB);
 *  - one `[diag] failure-evidence ...` block on stderr, so the job log carries the essentials even when the artifact blob cannot be downloaded.
 *  The screenshot is Playwright's own (`screenshot: "only-on-failure"` in playwright.config.ts, unchanged). The files land in `test-results/`, which the
 *  existing "Upload failure artifacts" step already uploads on failure (workflow unchanged). No trace, no video.
 *
 * It only READS: every page access is bounded (3 s) and swallowed, nothing here can change a test's status, and no assertion, timeout, retry or skip is
 * added. Opt in per spec by importing `test` from this file instead of "@playwright/test" (`expect` and everything else stay the same).
 * `TETO_E2E_DIAG=0` switches it off, like the rest of the diagnostics.
 */

const DOM_CAP = 200_000;
const READ_MS = 3000;

export interface FailureEvidenceInfo {
  title: string;
  project: string;
  status: string | undefined;
  expectedStatus: string;
  durationMs: number;
  timeoutMs: number;
  errors: readonly { message?: string; stack?: string }[];
}

/** A test that ended other than as expected (failed, timed out, interrupted, or "passed" when it was expected to fail). */
export function endedUnexpectedly(info: Pick<TestInfo, "status" | "expectedStatus">): boolean {
  return info.status !== undefined && info.status !== info.expectedStatus && info.status !== "skipped";
}

/** The spec-side stack frames of an error (where the test code was when it stopped), skipping node_modules and Playwright's own frames. */
export function specFrames(stack: string | undefined, max = 3): string[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at ") && /[\\/]e2e[\\/]/.test(line) && !line.includes("node_modules"))
    .slice(0, max)
    .map((line) => line.replace(/^at /, "").replace(/\(?\/?[^()\s]*[\\/]e2e[\\/]/, (m) => `${m.startsWith("(") ? "(" : ""}e2e/`));
}

/** The `Call log:` block of a Playwright error message (the action / locator it was waiting on), capped. */
export function callLog(message: string | undefined, maxLines = 20): string[] {
  if (!message) return [];
  const at = message.indexOf("Call log:");
  if (at < 0) return [];
  return message
    .slice(at + "Call log:".length)
    .split("\n")
    .map((l) => l.replace(ANSI, "").trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const firstLine = (text: string | undefined) => (text ?? "").replace(ANSI, "").split("\n").find((l) => l.trim()) ?? "";

/** Runs a page read with a hard upper bound; a rejection, a closed page or silence all become `null`. */
async function bounded<T>(read: () => Promise<T>, ms = READ_MS): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      read().catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
        timer.unref?.();
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Runs in the page. Compact on purpose: the full DOM goes to failure-dom.html. */
function readDomInPage(cap: number) {
  const root = document.documentElement;
  const html = root.outerHTML;
  const active = document.activeElement as HTMLElement | null;
  return {
    html: html.length > cap ? html.slice(0, cap) : html,
    htmlLength: html.length,
    summary: {
      readyState: document.readyState,
      url: location.href,
      viewport: `${innerWidth}x${innerHeight}`,
      scrollY: Math.round(scrollY),
      appFrames: document.querySelectorAll(".app-frame").length,
      resultPanelClasses: [...document.querySelectorAll('[class*="result-panel"]')].slice(0, 12).map((e) => e.className),
      dialogs: [...document.querySelectorAll('[role="dialog"], dialog[open]')].slice(0, 5).map((e) => e.className || e.tagName),
      active: active ? `${active.tagName.toLowerCase()}.${String(active.className).slice(0, 60)}` : null,
      bodyText: (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 400),
    },
  };
}

/**
 * A `body` attachment lives only inside the HTML / JSON report; a file under the test's output directory ALSO lands in `test-results/`, which the
 * failure-artifact upload step collects. Falls back to the body when the file cannot be written.
 */
async function attachFile(info: TestInfo, name: string, content: string, contentType: string): Promise<void> {
  try {
    const path = info.outputPath(name);
    await writeFile(path, content);
    await info.attach(name, { path, contentType });
  } catch {
    await info.attach(name, { body: content, contentType });
  }
}

/** Attaches the evidence for a failed test. Never throws. */
export async function collectFailureEvidence(page: Page, info: TestInfo): Promise<void> {
  try {
    if (!diagEnabled()) return;
    const closed = page.isClosed();
    const dom = closed ? null : await bounded(() => page.evaluate(readDomInPage, DOM_CAP));
    const left = budgetLeft();
    const errors = info.errors.map((e) => ({
      message: firstLine(e.message),
      frames: specFrames(e.stack),
      callLog: callLog(e.message),
    }));
    const evidence = {
      test: info.title,
      project: info.project.name,
      status: info.status,
      expectedStatus: info.expectedStatus,
      durationMs: info.duration,
      timeoutMs: info.timeout,
      budgetLeftMs: left ? Math.round(left.ms) : null,
      pageClosed: closed,
      pageUrl: closed ? null : page.url(),
      pagesInContext: closed ? null : (() => { try { return page.context().pages().length; } catch { return null; } })(),
      inFlight: inFlightLabels(page),
      domRead: closed ? "page is closed" : dom ? "ok" : "no answer within 3s",
      domHtmlLength: dom?.htmlLength ?? null,
      domTruncated: dom ? dom.htmlLength > DOM_CAP : null,
      dom: dom?.summary ?? null,
      errors,
    };
    await attachFile(info, "failure-evidence.json", JSON.stringify(evidence, null, 2), "application/json");
    if (dom) await attachFile(info, "failure-dom.html", dom.html, "text/plain");

    const first = errors[0];
    diagLog(
      `failure-evidence ${info.project.name} "${info.title}" ${info.status}: ${first?.message ?? "(no error message)"}` +
        `\n[diag]   waiting at: ${first?.frames.join(" <- ") || "(no spec frame)"}` +
        (first?.callLog.length ? `\n[diag]   call log: ${first.callLog.slice(0, 6).join(" | ")}` : "") +
        `\n[diag]   page: closed=${closed} url=${evidence.pageUrl ?? "-"} dom=${evidence.domRead} in-flight=${evidence.inFlight.join(" | ") || "-"} budget-left=${evidence.budgetLeftMs ?? "n/a"}ms` +
        (dom ? `\n[diag]   dom: ${JSON.stringify({ ...dom.summary, bodyText: undefined })} text="${dom.summary.bodyText.slice(0, 160)}"` : ""),
    );
  } catch {
    // evidence only: a failure here must never change the test's outcome
  }
}

/** `test` with the failure-evidence fixture attached to every test of the spec. Everything else is Playwright's `test`, unchanged. */
export const test = base.extend<{ failureEvidence: void }>({
  failureEvidence: [
    async ({ page }, use, testInfo) => {
      await use();
      if (endedUnexpectedly(testInfo)) await collectFailureEvidence(page, testInfo);
    },
    { auto: true },
  ],
});
