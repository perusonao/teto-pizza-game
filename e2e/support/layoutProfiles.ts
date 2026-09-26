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

/** One per test. Chromium gets a CDP session for the safe-area override; WebKit gets none. */
export class ProfileDriver {
  private constructor(
    private readonly page: Page,
    readonly engine: Engine,
    private readonly cdp: CDPSession | null,
  ) {}

  static async create(page: Page, browserName: string): Promise<ProfileDriver> {
    if (browserName === "chromium") {
      return new ProfileDriver(page, "chromium", await page.context().newCDPSession(page));
    }
    if (browserName === "webkit") return new ProfileDriver(page, "webkit", null);
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

  /** Resize, set/clear the inset, let layout settle, then verify what actually applied. Uses a
   *  real-time wait (not rAF): BAKE cycles run with `page.clock` paused. */
  async apply(profile: Profile): Promise<AppliedProfile> {
    if (profile.inset && this.engine !== "chromium") {
      throw new Error(`Layout Contract: ${profile.id} needs the CDP inset override (Chromium only)`);
    }
    await this.page.setViewportSize({ width: profile.width, height: profile.height });
    await this.setSafeArea(profile.inset);
    await this.page.waitForTimeout(120);
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
    return applied;
  }
}
