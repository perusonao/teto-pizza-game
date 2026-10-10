import type { CDPSession, Page, TestInfo } from "@playwright/test";

/**
 * Progression 2.0 W1 I5b-5 Layout Contract: the viewport profiles and the safe-area override.
 *
 * Authority: I5b-5 Verification Design (`d4f96d0`) §3.1 (profiles, inset 47/34 = OD-V-2) and
 * the I5b-5 Preflight §2.1 / §4 (one `layout-chromium` project cycles all 7 profiles; each
 * WebKit project cycles only the N and S profiles of its own width; CDP override on Chromium
 * only, cleared with `{}` on every N/S profile because it survives resizes and navigations).
 *
 * `applyProfile` re-runs the safe-area self-check on every switch: if the requested inset does
 * not reach CSS `env(safe-area-inset-*)`, it throws -- the contract never silently measures a
 * profile it did not actually get (LC-0 checks the same thing as a standalone test).
 */

export type ProfileId = "N390" | "N360" | "S390" | "S360" | "P390i" | "E390i" | "E360i";
export type Engine = "chromium" | "webkit";

export interface Inset {
  top: number;
  bottom: number;
}

export interface Profile {
  id: ProfileId;
  width: number;
  height: number;
  inset: Inset | null;
}

export const SAFE_AREA_INSET: Inset = { top: 47, bottom: 34 };

export const PROFILES: Record<ProfileId, Profile> = {
  N390: { id: "N390", width: 390, height: 844, inset: null },
  N360: { id: "N360", width: 360, height: 800, inset: null },
  S390: { id: "S390", width: 390, height: 664, inset: null },
  S360: { id: "S360", width: 360, height: 640, inset: null },
  P390i: { id: "P390i", width: 390, height: 844, inset: SAFE_AREA_INSET },
  E390i: { id: "E390i", width: 390, height: 664, inset: SAFE_AREA_INSET },
  E360i: { id: "E360i", width: 360, height: 640, inset: SAFE_AREA_INSET },
};

const PROJECT_PROFILES: Record<string, ProfileId[]> = {
  "layout-chromium": ["N390", "N360", "S390", "S360", "P390i", "E390i", "E360i"],
  "webkit-390x844": ["N390", "S390"],
  "webkit-360x800": ["N360", "S360"],
};

/** The profiles this project cycles. An unknown project throws instead of cycling nothing. */
export function profilesFor(testInfo: TestInfo): Profile[] {
  const ids = PROJECT_PROFILES[testInfo.project.name];
  if (!ids) throw new Error(`Layout Contract: no profile set for project "${testInfo.project.name}"`);
  return ids.map((id) => PROFILES[id]);
}

/** The mount profile of a flow: `short` = S360 on Chromium (the S profile of the project's own
 *  width on WebKit), `nominal` = N390 (N of the own width on WebKit). */
export function mountProfileFor(testInfo: TestInfo, kind: "short" | "nominal"): Profile {
  const ids = profilesFor(testInfo).map((p) => p.id);
  if (testInfo.project.name === "layout-chromium") return PROFILES[kind === "short" ? "S360" : "N390"];
  return PROFILES[ids.find((id) => id.startsWith(kind === "short" ? "S" : "N"))!];
}

export interface AppliedProfile {
  innerWidth: number;
  innerHeight: number;
  vv: { width: number; height: number; offsetTop: number };
  dpr: number;
  sat: number;
  sab: number;
}

/** Test-side probe (never a production hook): reads the computed `env(safe-area-inset-*)`. */
export async function readViewport(page: Page): Promise<AppliedProfile> {
  return page.evaluate(() => {
    let probe = document.querySelector<HTMLElement>("[data-lc-probe]");
    if (!probe) {
      probe = document.createElement("div");
      probe.setAttribute("data-lc-probe", "");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;" +
        "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
      document.body.appendChild(probe);
    }
    const cs = getComputedStyle(probe);
    const vv = window.visualViewport;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      vv: { width: vv?.width ?? 0, height: vv?.height ?? 0, offsetTop: vv?.offsetTop ?? 0 },
      dpr: window.devicePixelRatio,
      sat: parseFloat(cs.paddingTop) || 0,
      sab: parseFloat(cs.paddingBottom) || 0,
    };
  });
}

/**
 * Issue #394 diagnostics: an in-memory, ordered trail of what the fixture was doing (checkpoint labels,
 * ProfileDriver stages, `waitForLayoutQuiet` read numbers) and of the page / context / browser lifecycle events.
 * A "Target page, context or browser has been closed" failure used to leave nothing to tell a page crash from a
 * teardown (WebKit has no trace, and a closed page cannot be screenshotted). Normal operation only pushes to an
 * array: no await, no page call, no timer. The last entries are written to stderr only when a lifecycle event
 * fires (`LayoutContract` detaches the listeners before the test's own teardown, so a normal close is silent).
 */
export interface TrailEntry {
  seq: number;
  tMs: number;
  kind: string;
  detail: string;
}

export class Trail {
  static readonly CAP = 500;
  static readonly STDERR_TAIL = 30;
  readonly entries: TrailEntry[] = [];
  /** Lifecycle events (crash / close / disconnected) seen while the listeners were attached. */
  readonly lifecycle: string[] = [];
  private seq = 0;
  private readonly t0 = performance.now();

  constructor(private readonly label = "") {}

  mark(kind: string, detail = ""): void {
    this.entries.push({ seq: (this.seq += 1), tMs: Math.round(performance.now() - this.t0), kind, detail });
    if (this.entries.length > Trail.CAP) this.entries.shift();
  }

  /** Records an abnormal lifecycle event; the first one also writes the recent trail to stderr. */
  lifecycleEvent(event: string): void {
    this.mark("lifecycle", event);
    this.lifecycle.push(event);
    const head = `[lc-trail] ${this.label} LIFECYCLE ${event}`;
    if (this.lifecycle.length > 1) {
      process.stderr.write(`${head}\n`);
      return;
    }
    const tail = this.entries.slice(-Trail.STDERR_TAIL).map((e) => `[lc-trail]   #${e.seq} +${e.tMs}ms ${e.kind} ${e.detail}`.trimEnd());
    process.stderr.write([head, ...tail].join("\n") + "\n");
  }
}

/** One per test. Chromium gets a CDP session for the safe-area override; WebKit gets none. */
export class ProfileDriver {
  private constructor(
    private readonly page: Page,
    readonly engine: Engine,
    private readonly cdp: CDPSession | null,
    private readonly trail: Trail,
  ) {}

  static async create(page: Page, browserName: string, trail: Trail = new Trail()): Promise<ProfileDriver> {
    if (browserName === "chromium") {
      return new ProfileDriver(page, "chromium", await page.context().newCDPSession(page), trail);
    }
    if (browserName === "webkit") return new ProfileDriver(page, "webkit", null, trail);
    throw new Error(`Layout Contract: unsupported engine ${browserName}`);
  }

  async setSafeArea(inset: Inset | null) {
    if (!this.cdp) {
      if (inset) throw new Error(`Layout Contract: safe-area override requested on ${this.engine}`);
      return;
    }
    // `{}` clears the override (it persists across resizes and navigations otherwise).
    await this.cdp.send("Emulation.setSafeAreaInsetsOverride", {
      insets: inset ? { top: inset.top, bottom: inset.bottom, left: 0, right: 0 } : {},
    });
  }

  /** A headless WebKit page can sit without any rendering update for a long while after a viewport change, and the resize /
   *  observer / media-query notifications are only delivered by a rendering update: ask for two frames so that they are
   *  delivered now. Under a paused `page.clock` (BAKE) no frame comes, so the wait is bounded in real time. */
  private async pumpFrames(): Promise<void> {
    await Promise.race([
      this.page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))).catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 150)),
    ]);
  }

  /** Real-time wait until the dock and the stage stop moving: some layout is chosen by script from the stage as laid out
   *  (the family row's placement, #399), and an engine delivers the resize / observer notifications that drive it on its
   *  own schedule (WebKit can take more than the fixed wait above). Nothing is tolerated here: it only waits for the last
   *  layout to be the one that is judged; it returns as soon as three reads 50ms apart agree (or after 3s). */
  private async waitForLayoutQuiet(): Promise<void> {
    const read = () =>
      this.page.evaluate(() =>
        [".prepare-dock", ".game-screen--cooking > .pizza-stage"]
          .map((sel) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            return r ? `${r.top.toFixed(2)},${r.height.toFixed(2)}` : "-";
          })
          .join("|"),
      );
    this.trail.mark("quiet", "read#0");
    let prev = await read();
    let same = 0;
    for (let i = 0; i < 60 && same < 3; i += 1) {
      await this.page.waitForTimeout(50);
      this.trail.mark("quiet", `read#${i + 1}`);
      const now = await read();
      same = now === prev ? same + 1 : 0;
      prev = now;
    }
    this.trail.mark("quiet", `done same=${same}`);
  }

  /** Resize, set/clear the inset, let layout settle, then verify what actually applied. Uses a
   *  real-time wait (not rAF): BAKE cycles run with `page.clock` paused. */
  async apply(profile: Profile): Promise<AppliedProfile> {
    if (profile.inset && this.engine !== "chromium") {
      throw new Error(`Layout Contract: ${profile.id} needs the CDP inset override (Chromium only)`);
    }
    this.trail.mark("apply", `${profile.id} setViewport`);
    await this.page.setViewportSize({ width: profile.width, height: profile.height });
    this.trail.mark("apply", `${profile.id} safeArea`);
    await this.setSafeArea(profile.inset);
    // A headless WebKit page can drop the viewport notification of the first resize after a load (it is only delivered with
    // the next viewport change): deliver it once, so every listener re-reads the viewport that is actually applied.
    this.trail.mark("apply", `${profile.id} resizeEvent`);
    await this.page.evaluate(() => window.dispatchEvent(new Event("resize")));
    this.trail.mark("apply", `${profile.id} wait120`);
    await this.page.waitForTimeout(120);
    this.trail.mark("apply", `${profile.id} pumpFrames`);
    await this.pumpFrames();
    this.trail.mark("apply", `${profile.id} quiet`);
    await this.waitForLayoutQuiet();
    this.trail.mark("apply", `${profile.id} readViewport`);
    const applied = await readViewport(this.page);
    const want = profile.inset ?? { top: 0, bottom: 0 };
    const problems: string[] = [];
    if (applied.innerWidth !== profile.width) problems.push(`innerWidth ${applied.innerWidth} != ${profile.width}`);
    if (applied.innerHeight !== profile.height) problems.push(`innerHeight ${applied.innerHeight} != ${profile.height}`);
    if (Math.abs(applied.sat - want.top) > 1) problems.push(`env(safe-area-inset-top) ${applied.sat} != ${want.top}`);
    if (Math.abs(applied.sab - want.bottom) > 1) problems.push(`env(safe-area-inset-bottom) ${applied.sab} != ${want.bottom}`);
    if (problems.length) {
      throw new Error(`Layout Contract self-check failed @${profile.id} (${this.engine}): ${problems.join("; ")}`);
    }
    this.trail.mark("apply", `${profile.id} done`);
    return applied;
  }
}
