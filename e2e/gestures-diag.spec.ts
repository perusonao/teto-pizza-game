import { expect, test, type Page } from "@playwright/test";
import { cutThreeLines } from "./gestures";
import { observePageLifecycle, probeMainThread, reloadApp, setDiagSink, watched } from "./support/diag";

/**
 * #394 Phase 2 (D1-D3): regression coverage for the diagnostics in `e2e/support/diag.ts`, on SYNTHETIC pages (no game): what the watchdog must do, and --
 * as important -- what it must never do.
 *
 *  1. Healthy path: silent, same result, same rejection.
 *  2. A stalled call IS reported, with the page's state and the test budget; a page whose main thread is really busy answers "silent".
 *  3. A page that closes under a pending call is named; a reload that is slow is reported; a healthy reload is silent.
 *  4. CUT: the real `cutThreeLines` makes EXACTLY the pointer sequence it made before the diagnostics (compared against the old body, event by event);
 *     a stroke the page drops is reported with the pointer trace; neither case throws or changes the outcome.
 *
 * The thresholds are shortened per call (`pendingMs`, `probeMs`) so the tests take about a second each; none of this is a timeout of any real test.
 */

const lines: string[] = [];
test.beforeEach(() => {
  lines.length = 0;
  setDiagSink((line) => lines.push(line));
});
test.afterEach(() => setDiagSink(null));

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function serve(page: Page, name: string, html: (url: URL) => string, delayMs: () => number = () => 0, query = "") {
  await page.route(new RegExp(`/${name.replace(/\./g, "\\.")}(\\?.*)?$`), async (route) => {
    const wait = delayMs();
    if (wait > 0) await sleep(wait);
    await route.fulfill({ contentType: "text/html", body: html(new URL(route.request().url())) });
  });
  await page.goto(`${name}${query}`);
}

test.describe("watchdog: healthy path", () => {
  test("a quick call returns its value and writes nothing, even after the pending threshold has passed", async ({ page }) => {
    const value = await watched(page, "quick", async () => {
      await sleep(40);
      return 7;
    }, { pendingMs: 250, slowMs: 5000 });
    expect(value).toBe(7);
    await sleep(600); // a timer that was not cleared would fire here
    expect(lines).toEqual([]);
  });

  test("a rejection comes out unchanged (same error object), and the watchdog adds nothing to it", async ({ page }) => {
    const boom = new Error("boom: from the wrapped call");
    await expect(watched(page, "rejects", () => Promise.reject(boom), { pendingMs: 250 })).rejects.toBe(boom);
    await sleep(500);
    expect(lines).toEqual([]);
  });

  test("TETO_E2E_DIAG=0 switches every line off", async ({ page }) => {
    const previous = process.env.TETO_E2E_DIAG;
    process.env.TETO_E2E_DIAG = "0";
    try {
      const value = await watched(page, "off", async () => {
        await sleep(700);
        return "done";
      }, { pendingMs: 200, slowMs: 100 });
      expect(value).toBe("done");
      expect(lines).toEqual([]);
    } finally {
      if (previous === undefined) delete process.env.TETO_E2E_DIAG;
      else process.env.TETO_E2E_DIAG = previous;
    }
  });
});

test.describe("watchdog: a stall is reported", () => {
  test("a call still pending after the threshold is reported with the page state and the budget; it still completes with its own result", async ({ page }) => {
    await page.goto("about:blank");
    const value = await watched(page, "slow mouse.up", async () => {
      await sleep(500);
      return "finished";
    }, { pendingMs: 300, probeMs: 500, slowMs: 5000 });
    expect(value).toBe("finished");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[diag\] slow mouse\.up: still pending after 0\.[3-9]s \(page closed: false; main thread answered in \d+ms; test budget left ~?\d+\.\ds\)$/);
  });

  test("a call that is still running when the watchdog fires again is reported again (at most 3 times), and a late finish is noted once", async ({ page }) => {
    await page.goto("about:blank");
    await watched(page, "very slow", () => sleep(1500), { pendingMs: 250, probeMs: 100, slowMs: 1000 });
    const pending = lines.filter((line) => line.includes("still pending"));
    expect(pending.length).toBeGreaterThanOrEqual(2);
    expect(pending.length).toBeLessThanOrEqual(3);
    expect(lines.filter((line) => line.includes("took 1.")).length).toBe(1);
  });

  test("the probe tells the three page states apart: answering, silent (no reply within the bound) and gone", async () => {
    // Deterministic stand-ins for a page object (a busy renderer does not stall every CDP evaluate in Chromium, so a real hog cannot stand in here).
    const answering = { isClosed: () => false, evaluate: async () => 1 };
    const silent = { isClosed: () => false, evaluate: () => new Promise<number>(() => undefined) };
    const rejecting = { isClosed: () => false, evaluate: () => Promise.reject(new Error("Target page, context or browser has been closed\nCall log: ...")) };
    const gone = { isClosed: () => true, evaluate: () => new Promise<number>(() => undefined) };
    expect(await probeMainThread(answering as unknown as Page, 300)).toMatch(/^main thread answered in \d+ms$/);
    expect(await probeMainThread(silent as unknown as Page, 300)).toBe("main thread silent for 300ms");
    expect(await probeMainThread(rejecting as unknown as Page, 300)).toBe("evaluate failed: Target page, context or browser has been closed");
    expect(await probeMainThread(gone as unknown as Page, 300)).toBe("page is closed");
  });

  test("a stalled call on a page that does not answer is reported as such, and the call still ends with its own result", async () => {
    const silent = { isClosed: () => false, evaluate: () => new Promise<number>(() => undefined) } as unknown as Page;
    const result = await watched(silent, "mouse.up (page not answering)", async () => {
      await sleep(900);
      return "late result";
    }, { pendingMs: 250, probeMs: 200, slowMs: 5000 });
    expect(result).toBe("late result");
    expect(lines[0]).toMatch(/^\[diag\] mouse\.up \(page not answering\): still pending after 0\.[2-9]s \(page closed: false; main thread silent for 200ms; test budget left ~?\d+\.\ds\)$/);
  });

  test("a page that closes under a pending call is named with that call; a close at the end of a test stays silent", async ({ context }) => {
    const page = await context.newPage();
    await page.goto("about:blank");
    observePageLifecycle(page);
    const pending = watched(page, "mouse.move(10,10)", () => sleep(1200), { pendingMs: 5000 });
    await sleep(150);
    await page.close();
    await pending;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[diag\] page closed while 1 call\(s\) were pending: mouse\.move\(10,10\) \(test budget left /);

    lines.length = 0;
    const idle = await context.newPage();
    observePageLifecycle(idle);
    await idle.close();
    await sleep(100);
    expect(lines).toEqual([]);
  });
});

test.describe("reloadApp", () => {
  const appHtml = () => '<!doctype html><div class="app-frame">app</div>';

  test("a healthy reload is silent and ends with the app frame present", async ({ page }) => {
    await serve(page, "diag-app.html", appHtml);
    await reloadApp(page, "synthetic");
    await expect(page.locator(".app-frame")).toHaveCount(1);
    expect(lines).toEqual([]);
  });

  test("a reload that stalls is reported as the reload (not the selector wait), and still completes", async ({ page }) => {
    let requests = 0;
    await serve(page, "diag-app.html", appHtml, () => (++requests >= 2 ? 1100 : 0));
    const previous = process.env.TETO_E2E_DIAG_PENDING_MS;
    process.env.TETO_E2E_DIAG_PENDING_MS = "300";
    try {
      await reloadApp(page, "synthetic");
    } finally {
      if (previous === undefined) delete process.env.TETO_E2E_DIAG_PENDING_MS;
      else process.env.TETO_E2E_DIAG_PENDING_MS = previous;
    }
    await expect(page.locator(".app-frame")).toHaveCount(1);
    expect(lines.some((line) => line.includes("synthetic: page.reload: still pending"))).toBe(true);
    expect(lines.some((line) => line.includes("waitForSelector"))).toBe(false);
  });
});

/** A dough-shaped drop target. `drop=1` makes the page ignore pointermove (so a drag never starts and no line is committed). */
const cutPage = (url: URL) => `<!doctype html><body style="margin:0">
<div data-pizza-drop-target="true" class="pizza-dough pizza-dough--interactive" style="position:absolute;left:50px;top:150px;width:290px;height:290px;touch-action:none"></div>
<script>
  const drop = ${JSON.stringify(url.searchParams.get("drop") === "1")};
  const dough = document.querySelector(".pizza-dough");
  window.__events = [];
  let moved = false;
  for (const type of ["pointerdown", "pointermove", "pointerup"]) {
    window.addEventListener(type, (e) => window.__events.push([e.type, Math.round(e.clientX), Math.round(e.clientY)]), true);
  }
  dough.addEventListener("pointerdown", () => { moved = false; });
  dough.addEventListener("pointermove", () => { if (!drop) moved = true; });
  dough.addEventListener("pointerup", () => {
    if (moved) { const m = document.createElement("div"); m.className = "pizza-cut-mark"; document.body.appendChild(m); }
    moved = false;
  });
</script></body>`;

async function recordedEvents(page: Page) {
  return page.evaluate(() => (window as unknown as { __events: [string, number, number][] }).__events.filter((e) => e[0] !== "lostpointercapture"));
}

/** The body `cutThreeLines` had before the diagnostics, verbatim (raw `page.mouse`, no watchdog, no trace). */
async function cutThreeLinesBefore(page: Page) {
  const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
  if (!box) throw new Error("no dough");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.46;
  for (const angleDeg of [0, 60, 120]) {
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
    await page.mouse.move(cx - dx, cy - dy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
    await page.mouse.up();
  }
}

test.describe("CUT diagnostics", () => {
  test("cutThreeLines makes exactly the pointer sequence the old body made, commits 3 lines, and writes nothing", async ({ page }) => {
    await serve(page, "diag-cut.html", cutPage);
    await cutThreeLinesBefore(page);
    const before = await recordedEvents(page);
    expect(await page.locator(".pizza-cut-mark").count()).toBe(3);

    await page.goto("diag-cut.html"); // a fresh page load: no marks, empty event log
    await cutThreeLines(page);
    const after = await recordedEvents(page);
    expect(await page.locator(".pizza-cut-mark").count()).toBe(3);

    expect(after).toEqual(before);
    expect(after.filter((e) => e[0] === "pointerdown")).toHaveLength(3);
    expect(after.filter((e) => e[0] === "pointerup")).toHaveLength(3);
    expect(lines).toEqual([]);
  });

  test("a page that drops the strokes is reported once with the pointer trace; the helper does not throw and the strokes are still made", async ({ page }) => {
    await serve(page, "diag-cut.html", cutPage, undefined, "?drop=1");
    await cutThreeLines(page);
    expect(await page.locator(".pizza-cut-mark").count()).toBe(0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("cutThreeLines: 0 of 3 cut line(s) committed (marks 0 -> 0;");
    expect(lines[0]).toContain("pointerdown");
    expect(lines[0]).toContain("pointermove");
    expect(lines[0]).toContain("pointerup");
    const events = await recordedEvents(page);
    expect(events.filter((e) => e[0] === "pointerdown")).toHaveLength(3); // the gesture itself is unchanged
  });
});
