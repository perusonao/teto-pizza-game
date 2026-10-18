/**
 * #535 B2 on-device diagnostics (TEMPORARY -- delete after the iPhone Safari HV FAIL is understood and fixed).
 *
 * The Owner's iPhone Safari HV (PR #546, HEAD 9496acb) found the square dough drawn but neither tap nor long press did anything, while
 * every desktop / Playwright Chromium + WebKit run (mouse and touch) works. This is a read-only instrument, not a fix: with
 * `?diag=1` (Preview / DEV only, together with `?pan=square`) a small overlay shows what the phone actually delivers --
 *
 *   - the last pointer events seen at the WINDOW (capture phase: did the finger reach the page at all, and on which element?) and at
 *     the LAYER's own handlers (did it reach SquareDoughLayer?), with pointerType / pointerId / time / gesture phase;
 *   - the layer's `interactive` flag and gesture phase, its rect and computed touch-action, the viewport / DPR / UA;
 *   - counters: press effects applied, hold ticks, commits issued (COMMIT_SQUARE_DOUGH), commits the reducer accepted (the committed
 *     dough came back through the `dough` prop), discards, window-level fallbacks used;
 *   - the topmost element under the finger at pointerdown (`elementFromPoint`), and whether `setPointerCapture` succeeded.
 *
 * It never touches the gesture: it only records. Everything is O(1) per event (no React state in the handlers; the panel polls the
 * recorder at 5 Hz), listeners are passive and window-level, and the overlay has `pointer-events: none` so it cannot take a touch.
 *
 * PRODUCTION never contains it: the recorder exists only behind the static `import.meta.env.DEV || VITE_PREVIEW_MODE` check (a
 * production `vite build` folds `squareDoughDiag` to `null` and drops this module -- ./squareDoughDiag.gate.test.ts scans a real build
 * for the marker). With `diag` absent, `squareDoughDiag` is `null` and every call site is a no-op: nothing is drawn, nothing is
 * recorded, no listener is added.
 */
/** Present in this module only. The production-bundle gate looks for it. */
export const SQUARE_DOUGH_DIAG_MARK = "square-dough-diag-v1";
/** The query parameter name. */
export const DIAG_PARAM = "diag";

const HISTORY_LENGTH = 10;

export type DiagCount =
  | "pressApplied"
  | "holdTicks"
  | "commitIssued"
  | "reducerAccepted"
  | "discarded"
  | "windowFallbackUp"
  | "windowFallbackCancel"
  | "capturedOk"
  | "captureFailed"
  | "ignoredNotInteractive"
  | "ignoredBusy"
  | "ignoredOutsidePan";

const COUNT_KEYS: readonly DiagCount[] = [
  "pressApplied",
  "holdTicks",
  "commitIssued",
  "reducerAccepted",
  "discarded",
  "windowFallbackUp",
  "windowFallbackCancel",
  "capturedOk",
  "captureFailed",
  "ignoredNotInteractive",
  "ignoredBusy",
  "ignoredOutsidePan",
];

/** `true` only when the query string asks for it exactly once with the value `1`. */
export function resolveDiagEnabled(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(DIAG_PARAM);
  return all.length === 1 && all[0] === "1";
}

/** `TAG.firstClass` (and `#testid` when it has one), short enough for one line of the panel. */
export function describeTarget(target: unknown): string {
  if (typeof target !== "object" || target === null) return "-";
  const el = target as { tagName?: unknown; className?: unknown; getAttribute?: (name: string) => string | null };
  const tag = typeof el.tagName === "string" ? el.tagName : "?";
  const raw = el.className;
  const className = typeof raw === "string" ? raw : typeof raw === "object" && raw !== null && "baseVal" in raw ? String((raw as { baseVal: unknown }).baseVal) : "";
  const first = className.trim().split(/\s+/)[0] ?? "";
  const testId = typeof el.getAttribute === "function" ? el.getAttribute("data-testid") : null;
  const text = `${tag}${first ? `.${first}` : ""}${testId ? `#${testId}` : ""}`;
  return text.length > 26 ? `${text.slice(0, 25)}~` : text;
}

interface EventLike {
  readonly type: string;
  readonly pointerType?: string;
  readonly pointerId?: number;
  readonly target?: EventTarget | null;
}

interface Entry {
  readonly text: string;
}

export interface DiagStatus {
  interactive: boolean | null;
  phase: string;
  resetToken: number;
  layerRect: string;
  touchAction: string;
  /** What the last pointerdown's elementFromPoint saw. */
  topAtDown: string;
  /** The last setPointerCapture outcome. */
  capture: string;
}

/** The recorder. Every method is O(1) and swallows its own errors: a diagnostic must never break the gesture it observes. */
export class SquareDoughDiag {
  readonly counts: Record<DiagCount, number> = Object.fromEntries(COUNT_KEYS.map((k) => [k, 0])) as Record<DiagCount, number>;
  readonly status: DiagStatus = { interactive: null, phase: "-", resetToken: 0, layerRect: "-", touchAction: "-", topAtDown: "-", capture: "-" };
  /** Bumped on every change; the panel redraws only when it moved. */
  version = 0;
  private readonly entries: Entry[] = [];
  private readonly moves: Record<"win" | "layer", { n: number; last: string }> = { win: { n: 0, last: "-" }, layer: { n: 0, last: "-" } };
  private seq = 0;
  private readonly bornAt: number;

  private readonly now: () => number;

  constructor(now: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now())) {
    this.now = now;
    this.bornAt = this.now();
  }

  /**
   * One pointer / touch / click event seen at `src` ("win" = window capture phase, "layer" = SquareDoughLayer's own handler).
   * `pointermove` is never a history line: in the real wiring every move arrives twice (window, then layer), so it would fill the whole
   * history in a handful of events and push the gesture start out. Moves are counted per source since the last pointerdown instead,
   * and shown in one summary line.
   */
  event(src: "win" | "layer", event: EventLike, phase: string): void {
    try {
      const ptype = event.pointerType ?? "-";
      const id = event.pointerId ?? "-";
      if (event.type === "pointermove") {
        this.moves[src].n += 1;
        this.moves[src].last = `${ptype} id${id} ph=${phase} ${describeTarget(event.target)}`;
        this.version += 1;
        return;
      }
      if (event.type === "pointerdown") {
        this.moves.win = { n: 0, last: "-" };
        this.moves.layer = { n: 0, last: "-" };
      }
      this.seq += 1;
      const t = Math.round(this.now() - this.bornAt);
      this.entries.push({ text: `#${this.seq} +${t} ${src} ${event.type} ${ptype} id${id} ph=${phase} ${describeTarget(event.target)}` });
      if (this.entries.length > HISTORY_LENGTH) this.entries.shift();
      this.version += 1;
    } catch {
      /* never let a diagnostic throw */
    }
  }

  /** A free-form line (capture result, fallback used, ...). */
  note(text: string): void {
    try {
      this.seq += 1;
      this.entries.push({ text: `#${this.seq} +${Math.round(this.now() - this.bornAt)} ${text}` });
      if (this.entries.length > HISTORY_LENGTH) this.entries.shift();
      this.version += 1;
    } catch {
      /* ignore */
    }
  }

  count(key: DiagCount, by = 1): void {
    this.counts[key] += by;
    this.version += 1;
  }

  /** Cheap field updates (no allocation); the panel picks them up on its next poll. */
  setStatus(patch: Partial<DiagStatus>): void {
    Object.assign(this.status, patch);
    this.version += 1;
  }

  /** The text the panel shows. */
  snapshot(environment: string): string {
    const c = this.counts;
    const s = this.status;
    const head = [
      `SQUARE DIAG ${SQUARE_DOUGH_DIAG_MARK}`,
      environment,
      `interactive=${s.interactive === null ? "?" : s.interactive} phase=${s.phase} reset=${s.resetToken} touch-action=${s.touchAction}`,
      `layer ${s.layerRect}  top@down ${s.topAtDown}  capture ${s.capture}`,
      `press=${c.pressApplied} hold=${c.holdTicks} commit=${c.commitIssued} accepted=${c.reducerAccepted} discard=${c.discarded} ` +
        `capOk=${c.capturedOk} capFail=${c.captureFailed} winUp=${c.windowFallbackUp} winCancel=${c.windowFallbackCancel} ` +
        `ign(int/busy/pan)=${c.ignoredNotInteractive}/${c.ignoredBusy}/${c.ignoredOutsidePan}`,
    ];
    const lines = this.entries.map((e) => e.text);
    head.push(`moves since down: win=${this.moves.win.n} layer=${this.moves.layer.n}  last win: ${this.moves.win.last}`);
    return [...head, ...lines].join("\n");
  }

  /**
   * Window-level, capture-phase, PASSIVE listeners: they see an event before any handler and can neither stop nor cancel it, so they
   * show whether a finger reached the page and on which element. Returns the cleanup.
   */
  attachWindow(getPhase: () => string): () => void {
    if (typeof window === "undefined") return () => undefined;
    const types = [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "gotpointercapture",
      "lostpointercapture",
      "touchstart",
      "touchend",
      "touchcancel",
      "click",
    ];
    const listener = (event: Event) => this.event("win", event as unknown as EventLike, getPhase());
    for (const type of types) window.addEventListener(type, listener, { capture: true, passive: true });
    return () => {
      for (const type of types) window.removeEventListener(type, listener, { capture: true } as EventListenerOptions);
    };
  }
}

function pageSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

/**
 * The one recorder of this page load, or `null` (diagnostics off). `null` in production: the condition is static, so a production
 * build drops this whole module (see the header).
 */
export const squareDoughDiag: SquareDoughDiag | null =
  import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE ? (resolveDiagEnabled(pageSearch()) ? new SquareDoughDiag() : null) : null;

/** Viewport / device facts that rule an environment in or out (a one-off line at the top of the panel). */
export function describeEnvironment(): string {
  if (typeof window === "undefined") return "-";
  const vv = window.visualViewport;
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  const sha = import.meta.env.VITE_PREVIEW_SHA ?? "?";
  const pr = import.meta.env.VITE_PREVIEW_PR ?? "?";
  const ua = navigator.userAgent.replace(/Mozilla\/5\.0 \(/, "").replace(/\) AppleWebKit.*$/, ")");
  return (
    `PR#${pr} ${sha} | win ${window.innerWidth}x${window.innerHeight} dpr ${window.devicePixelRatio}` +
    ` vv ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}@${vv.scale}` : "-"} standalone=${standalone}\n${ua}`
  );
}
