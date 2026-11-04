import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { setDiagSink } from "./support/diag";
import { callLog, collectFailureEvidence, endedUnexpectedly, specFrames } from "./support/failureEvidence";

/**
 * #394 Phase 2: regression coverage for `e2e/support/failureEvidence.ts` on SYNTHETIC pages (no game). What the evidence must hold when a test fails, and
 * what it must never do: throw, wait long, or write anything for a test that did not fail.
 */

const lines: string[] = [];
test.beforeEach(() => {
  lines.length = 0;
  setDiagSink((line) => lines.push(line));
});
test.afterEach(() => setDiagSink(null));

function fakeInfo(page: Page, errors: { message?: string; stack?: string }[], status = "failed") {
  const attached: { name: string; body: string; contentType?: string }[] = [];
  const info = {
    title: "synthetic",
    project: { name: "webkit-390x844" },
    status,
    expectedStatus: "passed",
    duration: 1234,
    timeout: 30_000,
    errors,
    outputPath: (name: string) => join(tmpdir(), `failure-evidence-spec-${process.pid}-${name}`),
    attach: async (name: string, o: { body?: string; path?: string; contentType?: string }) =>
      void attached.push({ name, body: o.body ?? readFileSync(o.path as string, "utf8"), contentType: o.contentType }),
  } as unknown as TestInfo;
  return { info, attached };
}

const ERROR = {
  message: "Error: expect(locator).toBeVisible()\n\nLocator: .result-panel--discovery\nReceived: <element(s) not found>\nCall log:\n  - waiting for locator('.result-panel--discovery')\n  - waiting 100ms",
  stack: "Error: x\n    at /repo/e2e/some.spec.ts:171:5\n    at /repo/node_modules/playwright/lib/x.js:1:1\n    at helper (/repo/e2e/gestures.ts:20:3)",
};

test.describe("failure evidence", () => {
  test("a failed test gets the DOM, the waiting location and the page state, and one job-log block", async ({ page }) => {
    await page.setContent(`<div class="app-frame"><section class="result-panel result-panel--near">焼き加減: 惜しい</section></div>`);
    const { info, attached } = fakeInfo(page, [ERROR]);
    await collectFailureEvidence(page, info);

    expect(attached.map((a) => a.name).sort()).toEqual(["failure-dom.html", "failure-evidence.json"]);
    const json = JSON.parse(attached.find((a) => a.name === "failure-evidence.json")!.body);
    expect(json.pageClosed).toBe(false);
    expect(json.domRead).toBe("ok");
    expect(json.dom.appFrames).toBe(1);
    expect(json.dom.resultPanelClasses).toEqual(["result-panel result-panel--near"]);
    expect(json.errors[0].frames).toEqual(["e2e/some.spec.ts:171:5", "helper (e2e/gestures.ts:20:3)"]);
    expect(json.errors[0].callLog).toEqual(["- waiting for locator('.result-panel--discovery')", "- waiting 100ms"]);
    expect(attached.find((a) => a.name === "failure-dom.html")!.body).toContain("result-panel--near");
    expect(lines.join("\n")).toContain("failure-evidence webkit-390x844");
    expect(lines.join("\n")).toContain("waiting at: e2e/some.spec.ts:171:5");
  });

  test("a closed page still leaves the waiting location, and does not throw or wait", async ({ page }) => {
    await page.setContent("<p>x</p>");
    await page.close();
    const { info, attached } = fakeInfo(page, [ERROR]);
    const started = Date.now();
    await collectFailureEvidence(page, info);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(attached.map((a) => a.name)).toEqual(["failure-evidence.json"]);
    const json = JSON.parse(attached[0].body);
    expect(json.pageClosed).toBe(true);
    expect(json.domRead).toBe("page is closed");
    expect(json.errors[0].frames[0]).toBe("e2e/some.spec.ts:171:5");
  });

  test("a page that does not answer is given up on after the bound", async ({ page }) => {
    await page.setContent("<p>x</p>");
    const stalled = new Proxy(page, {
      get(target, prop) {
        if (prop === "evaluate") return () => new Promise(() => {});
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const { info, attached } = fakeInfo(page, [ERROR]);
    const started = Date.now();
    await collectFailureEvidence(stalled, info);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(JSON.parse(attached[0].body).domRead).toBe("no answer within 3s");
  });

  test("an attach that throws never escapes", async ({ page }) => {
    const { info } = fakeInfo(page, [ERROR]);
    (info as unknown as { attach: () => Promise<never> }).attach = () => Promise.reject(new Error("disk full"));
    await expect(collectFailureEvidence(page, info)).resolves.toBeUndefined();
  });

  test("TETO_E2E_DIAG=0 switches it off", async ({ page }) => {
    const { info, attached } = fakeInfo(page, [ERROR]);
    process.env.TETO_E2E_DIAG = "0";
    try {
      await collectFailureEvidence(page, info);
    } finally {
      delete process.env.TETO_E2E_DIAG;
    }
    expect(attached).toEqual([]);
  });
});

test.describe("helpers", () => {
  test("only a test that ended unexpectedly counts as failed", () => {
    expect(endedUnexpectedly({ status: "passed", expectedStatus: "passed" })).toBe(false);
    expect(endedUnexpectedly({ status: "skipped", expectedStatus: "skipped" })).toBe(false);
    expect(endedUnexpectedly({ status: "failed", expectedStatus: "passed" })).toBe(true);
    expect(endedUnexpectedly({ status: "timedOut", expectedStatus: "passed" })).toBe(true);
    expect(endedUnexpectedly({ status: "passed", expectedStatus: "failed" })).toBe(true);
  });

  test("specFrames keeps spec-side frames only; callLog tolerates a missing log", () => {
    expect(specFrames(ERROR.stack)).toEqual(["e2e/some.spec.ts:171:5", "helper (e2e/gestures.ts:20:3)"]);
    expect(specFrames(undefined)).toEqual([]);
    expect(callLog("no log here")).toEqual([]);
    expect(callLog(undefined)).toEqual([]);
  });
});
