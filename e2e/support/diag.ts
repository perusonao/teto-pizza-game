import { test, type Page } from "@playwright/test";

/**
 * #394 Phase 2 (D1): diagnostics for the two WebKit failure shapes that leave no trace today -- a `page.mouse.*` call that never returns
 * (`Input.dispatchMouseEvent: Page closed` after 120-180 s, 2026-10-23) and a `page.reload()` / `.app-frame` wait that runs into the test budget.
 *
 * DIAGNOSTIC ONLY. Nothing here can change whether a test passes:
 *  - the wrapped call's result, rejection and its own timeout are passed through untouched; the watchdog only READS (a timer, `page.isClosed()` and one
 *    bounded `page.evaluate` probe whose every outcome, including a rejection, is swallowed);
 *  - when everything is healthy it is silent: a line is written only when a call is still pending after `pendingMs` (default 8 s), or took `slowMs`
 *    (default 3 s) -- a healthy mouse call takes milliseconds;
 *  - no timeout, retry, skip or assertion is added or changed, and no wait is inserted on the normal path (the timers are `unref`'d, so they cannot
 *    keep a worker alive either).
 * Lines go to stderr (`[diag] ...`), so they sit in the CI job log, which is readable even where the artifacts are not.
 * Knobs (all optional): `TETO_E2E_DIAG=0` switches every line off; `TETO_E2E_DIAG_PENDING_MS` / `TETO_E2E_DIAG_SLOW_MS` set the thresholds.
 */

export interface DiagOptions {
  /** A call still running after this long is reported (and re-reported, up to 3 times). */
  pendingMs?: number;
  /** A call that finished but took at least this long is reported once. */
  slowMs?: number;
  /** How long the main-thread probe waits for the page before calling it silent. */
  probeMs?: number;
}

export type DiagSink = (line: string) => void;

const defaultSink: DiagSink = (line) => {
  process.stderr.write(`${line}\n`);
};
let sink: DiagSink = defaultSink;

/** Replaces where `[diag]` lines go (the synthetic regression tests capture them); `null` restores stderr. */
export function setDiagSink(next: DiagSink | null): void {
  sink = next ?? defaultSink;
}

export const diagEnabled = () => process.env.TETO_E2E_DIAG !== "0";

export function diagLog(message: string): void {
  if (!diagEnabled()) return;
  try {
    sink(`[diag] ${message}`);
  } catch {
    // a sink that throws must never fail a test
  }
}

const envMs = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const FIRST_SEEN = new WeakMap<object, number>();

/**
 * What is left of the running test's own timeout, or null outside a test / when the test has no timeout. The test's start time is not public API
 * (Playwright 1.56 keeps it in `_startWallTime`), so it is read from there when present; otherwise the time counts from the first diagnostic call of the
 * test, which OVERSTATES what is left (`approximate: true`). Diagnostics only: a wrong value is a wrong number in a log line, never a failed test.
 */
export function budgetLeft(): { ms: number; approximate: boolean } | null {
  try {
    const info = test.info();
    if (!info.timeout) return null;
    const own = (info as unknown as { _startWallTime?: number })._startWallTime;
    if (typeof own === "number") return { ms: info.timeout - (Date.now() - own), approximate: false };
    if (!FIRST_SEEN.has(info)) FIRST_SEEN.set(info, Date.now());
    return { ms: info.timeout - (Date.now() - (FIRST_SEEN.get(info) as number)), approximate: true };
  } catch {
    return null;
  }
}

export function budgetLeftMs(): number | null {
  return budgetLeft()?.ms ?? null;
}

/** The labels of the watched calls that are running on each page right now (so a page that closes under them can say which). */
const IN_FLIGHT = new WeakMap<Page, Set<string>>();

/** What watched calls are running on `page` right now (empty when none). Read-only; used by the failure evidence. */
export function inFlightLabels(page: Page): string[] {
  return [...(IN_FLIGHT.get(page) ?? [])];
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const budgetText = () => {
  const left = budgetLeft();
  return left === null ? "n/a" : `${left.approximate ? "~" : ""}${seconds(left.ms)}`;
};

/**
 * One bounded round trip into the page's main thread. A renderer that is hung (or a page that is gone) cannot answer, so the answer itself says which
 * of "the page is alive but the input call is stuck" and "the page is not answering at all" it is. Never rejects, never waits longer than `timeoutMs`.
 */
export async function probeMainThread(page: Page, timeoutMs: number): Promise<string> {
  if (page.isClosed()) return "page is closed";
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  const answered = page.evaluate(() => performance.now()).then(
    () => `main thread answered in ${Date.now() - started}ms`,
    (error: Error) => `evaluate failed: ${String(error.message).split("\n")[0].slice(0, 100)}`,
  );
  const silent = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(`main thread silent for ${timeoutMs}ms`), timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([answered, silent]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Runs `action` exactly as given and returns / throws exactly what it does. While it runs, a watchdog reports it if it is still pending after
 * `pendingMs` (with the page's state and what is left of the test budget), and a call that finished slowly is noted once.
 */
export async function watched<T>(page: Page, label: string, action: () => Promise<T>, options: DiagOptions = {}): Promise<T> {
  if (!diagEnabled()) return action();
  const pendingMs = options.pendingMs ?? envMs("TETO_E2E_DIAG_PENDING_MS", 8000);
  const slowMs = options.slowMs ?? envMs("TETO_E2E_DIAG_SLOW_MS", 3000);
  const probeMs = options.probeMs ?? 2000;
  observePageLifecycle(page); // every watched call (so every mouse gesture and every reload) gets the crash / close reporting; idempotent per page
  const started = Date.now();
  let finished = false;
  let reports = 0;
  let timer: NodeJS.Timeout | undefined;

  const arm = () => {
    timer = setTimeout(() => void report(), pendingMs);
    timer.unref?.();
  };
  const report = async () => {
    reports += 1;
    const waited = Date.now() - started;
    const probe = await probeMainThread(page, probeMs).catch(() => "probe failed");
    if (finished) return; // it came back while we looked: the "took" line below says so, a "pending" line now would mislead
    diagLog(`${label}: still pending after ${seconds(waited)} (page closed: ${page.isClosed()}; ${probe}; test budget left ${budgetText()})`);
    if (reports < 3 && !finished) arm();
  };

  const running = IN_FLIGHT.get(page) ?? new Set<string>();
  IN_FLIGHT.set(page, running);
  running.add(label);
  arm();
  try {
    return await action();
  } finally {
    finished = true;
    running.delete(label);
    if (timer) clearTimeout(timer);
    const took = Date.now() - started;
    if (took >= slowMs) diagLog(`${label}: took ${seconds(took)} (test budget left ${budgetText()})`);
  }
}

type MouseButtonOptions = Parameters<Page["mouse"]["down"]>[0];
type MouseMoveOptions = Parameters<Page["mouse"]["move"]>[2];

/**
 * `page.mouse` with each call watched under a label that names the gesture and the call, so a stall points at the exact `move` / `down` / `up` of the
 * exact gesture. The arguments and the results are `page.mouse`'s own.
 */
export function diagMouse(page: Page, gesture: string) {
  const mouse = page.mouse;
  return {
    move: (x: number, y: number, options?: MouseMoveOptions) =>
      watched(page, `${gesture} mouse.move(${Math.round(x)},${Math.round(y)}${options?.steps ? `, steps ${options.steps}` : ""})`, () => mouse.move(x, y, options)),
    down: (options?: MouseButtonOptions) => watched(page, `${gesture} mouse.down`, () => mouse.down(options)),
    up: (options?: MouseButtonOptions) => watched(page, `${gesture} mouse.up`, () => mouse.up(options)),
  };
}

/**
 * Every diagnostic read of the page (`installPointerTrace`, `readPointerTrace`, `cutMarkCount`) goes through this: it waits at most `readMs` (default 2 s,
 * `TETO_E2E_DIAG_READ_MS`) and a read that rejects, or never answers, is "not done" -- so a page that stopped answering cannot make a DIAGNOSTIC wait out the
 * test budget, and the diagnostic can say so instead. The late result of an abandoned read is swallowed (no unhandled rejection).
 */
function bounded<T>(work: Promise<T>, readMs = envMs("TETO_E2E_DIAG_READ_MS", 2000)): Promise<{ done: true; value: T } | { done: false }> {
  let timer: NodeJS.Timeout | undefined;
  const settled = work.then(
    (value) => ({ done: true as const, value }),
    () => ({ done: false as const }),
  );
  const expired = new Promise<{ done: false }>((resolve) => {
    timer = setTimeout(() => resolve({ done: false }), readMs);
    timer.unref?.();
  });
  return Promise.race([settled, expired]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

const TRACE_KEY = "__tetoPointerTrace";
const TRACE_LIMIT = 200;

/**
 * Starts recording `pointerdown / pointermove / pointerup / pointercancel / lostpointercapture` in the page (a ring of the last 200). The listeners are
 * passive, run in the capture phase and never stop an event, so the app sees exactly what it saw before. Idempotent per page load; a reload clears it.
 * Never throws and waits at most the bounded read time (a page that does not answer is skipped).
 */
export async function installPointerTrace(page: Page): Promise<void> {
  if (!diagEnabled()) return;
  await bounded(
    page.evaluate(
      ({ key, limit }) => {
        const w = window as unknown as Record<string, unknown>;
        if (w[key]) return;
        const log: Array<[number, string, number, number, number, number, string]> = [];
        w[key] = log;
        const record = (event: Event) => {
          const pointer = event as PointerEvent;
          const target = event.target as Element | null;
          log.push([Math.round(performance.now()), event.type, pointer.pointerId, Math.round(pointer.clientX), Math.round(pointer.clientY), pointer.buttons, (target?.getAttribute?.("class") ?? "").slice(0, 40)]);
          if (log.length > limit) log.shift();
        };
        for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
          window.addEventListener(type, record, { capture: true, passive: true });
        }
      },
      { key: TRACE_KEY, limit: TRACE_LIMIT },
    ),
  );
}

/** The last `count` recorded pointer events as one compact line each (`t=1234ms pointermove #1 (310,420) buttons=1 .pizza-dough`), or a note why there are none. */
export async function readPointerTrace(page: Page, count = 20): Promise<string[]> {
  const read = await bounded(page.evaluate(({ key, n }) => ((window as unknown as Record<string, unknown>)[key] as unknown[][] | undefined)?.slice(-n) ?? null, { key: TRACE_KEY, n: count }));
  if (!read.done) return ["(pointer trace unreadable: the page did not answer a diagnostic read in time)"];
  if (!read.value) return ["(no pointer trace: not installed on this page load)"];
  return read.value.map((r) => `t=${r[0]}ms ${r[1]} #${r[2]} (${r[3]},${r[4]}) buttons=${r[5]} .${r[6]}`);
}

/** How many cut marks are on the pizza now (the CUT step's committed lines), or null when it cannot be read within the bounded read time. */
export async function cutMarkCount(page: Page): Promise<number | null> {
  const read = await bounded(page.locator(".pizza-cut-mark").count());
  return read.done ? read.value : null;
}

const COMMIT_POLL_MS = 100;
const COMMIT_POLL_LIMIT_MS = 1000;

/**
 * Called after a CUT gesture: did `expected` more lines get committed? The app commits a line only on a pointerup that follows a real drag
 * (`PizzaStage.handlePointerUp`), and drops anything else silently, so "the mouse calls all returned" does not prove the cut happened.
 * Silent when the count rose as expected (the normal path takes one read and returns at once). Otherwise it waits at most one second for a late React
 * commit and, if the lines are still missing, writes one `[diag]` line with the pointer trace tail. It never throws and never fails the test.
 */
export async function reportCutCommit(page: Page, label: string, before: number | null, expected: number): Promise<void> {
  if (!diagEnabled() || before === null) return;
  try {
    const unanswered = () =>
      diagLog(`${label}: the page did not answer a diagnostic read after the gesture (the mouse calls had returned; diagnostic only; test budget left ${budgetText()})`);
    let after = await cutMarkCount(page);
    if (after === null) return unanswered();
    for (let waited = 0; after - before < expected && waited < COMMIT_POLL_LIMIT_MS; waited += COMMIT_POLL_MS) {
      await page.waitForTimeout(COMMIT_POLL_MS);
      after = await cutMarkCount(page);
      if (after === null) return unanswered();
    }
    if (after - before >= expected) return;
    const trace = await readPointerTrace(page, 20);
    diagLog(`${label}: ${after - before} of ${expected} cut line(s) committed (marks ${before} -> ${after}; diagnostic only, a full CUT limit also looks like this). Last pointer events:\n  ${trace.join("\n  ")}`);
  } catch {
    // diagnostics only
  }
}

/** `page.reload()` under the watchdog; identical behaviour (same arguments, same result). */
export function reloadPage(page: Page, label = "reload", options?: Parameters<Page["reload"]>[0]) {
  return watched(page, `${label}: page.reload`, () => page.reload(options));
}

const LIFECYCLE_SEEN = new WeakSet<Page>();

/**
 * Reports a renderer crash the moment it happens, and a page close only when it happens UNDER a watched call (a close at the end of a test is normal and
 * stays silent). Attached once per page; it only observes.
 */
export function observePageLifecycle(page: Page): void {
  if (!diagEnabled() || LIFECYCLE_SEEN.has(page) || typeof page?.on !== "function") return;
  LIFECYCLE_SEEN.add(page);
  try {
    page.on("crash", () => diagLog(`page crashed (test budget left ${budgetText()})`));
    page.on("close", () => {
      const running = [...(IN_FLIGHT.get(page) ?? [])];
      if (running.length > 0) diagLog(`page closed while ${running.length} call(s) were pending: ${running.join(" | ")} (test budget left ${budgetText()})`);
    });
  } catch {
    // diagnostics only
  }
}

/**
 * The reload most specs make: `page.reload()` then wait for `.app-frame`. Exactly those two calls with Playwright's own timeouts, each under the watchdog,
 * so a run that stalls here says which of the two it was, for how long, whether the page still answered, and how much test budget was left.
 */
export async function reloadApp(page: Page, label = "reload"): Promise<void> {
  observePageLifecycle(page);
  await reloadPage(page, label);
  await watched(page, `${label}: waitForSelector(.app-frame)`, () => page.waitForSelector(".app-frame"));
}
