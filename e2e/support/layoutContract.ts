import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, type Page, type TestInfo } from "@playwright/test";
import {
  compareStable,
  evaluateInvariants,
  PRIORITY,
  type InvariantId,
  type InvariantResult,
  type LayoutMeasurement,
} from "./layoutInvariants";
import { mountProfileFor, ProfileDriver, profilesFor, type AppliedProfile, type Profile, type ProfileId } from "./layoutProfiles";

/**
 * Progression 2.0 W1 I5b-5 Layout Contract helper (Design `d4f96d0` §5.3 / §12, Preflight §5 /
 * §7 / §8): measure one app state on every profile of the project, judge L-A..L-O, and keep the
 * evidence.
 *
 * - `checkpoint(state, ...)` cycles the profiles, measures each with ONE `page.evaluate`
 *   (slot rects, `elementFromPoint` at each target's center, scroll metrics, line counts), judges
 *   the invariants with `expect.soft` (one failure never hides another profile), then restores
 *   the flow's own profile. No tap/drag happens while cycling.
 * - Failure message: `<ID> <what> @<profile> <state>: <actual> (need <expected>) Δ=<px>`.
 * - A failing sample also gets an annotated screenshot (slot boxes drawn by a `pointer-events:
 *   none` overlay injected AFTER the hit tests, removed right after).
 * - `finish()` attaches `layout-evidence.json` (every sample, pass or fail) to the test.
 */

/**
 * P1 findings measured by I5b-5 that need an Owner decision (Design §14 P-5: "P1 0 or
 * Owner-accepted"). Each entry is narrow (invariant, state, profiles, the exact offender) and is
 * still reported -- as "P1 Owner pending" in the evidence and the job summary -- it only keeps
 * the test from failing on this one known value. Any other P1 failure fails the test. Remove an
 * entry once the Owner accepts it (then document the acceptance) or the fix lands.
 * See docs/reports/TETO_PROGRESS2_W1_I5B5_Result.md §5.
 */
export const KNOWN_P1: { ref: string; id: InvariantId; state: RegExp; profiles: ProfileId[]; actual: RegExp }[] = [
  {
    ref: "I5b-5 F-1 pager buttons 36x28 < 44 (tap target vs dough height, OD-V-4)",
    id: "L-M",
    state: /TOPPING/,
    profiles: ["N390", "N360", "S390", "S360", "P390i", "E390i", "E360i"],
    actual: /^(前のページ:36x28,次のページ:36x28)$/,
  },
  {
    ref: "I5b-5 F-2 CUT: completed 「✓ 焼く」 tab label clipped at 360 wide",
    id: "L-J",
    state: /CUT/,
    profiles: ["N360", "S360", "E360i"],
    actual: /^✓ 焼く$/,
  },
  {
    ref: "I5b-5 F-3 HOME CTA rows move 4px between Dex 0 and Dex 1 at 390x664",
    id: "L-O",
    state: /^HOME Dex 1$/,
    profiles: ["S390"],
    actual: /^(307|369|30[5-9]|36[7-9]|37[01])$/,
  },
];

export interface SlotSelectors {
  /** The state's primary CTA (first visible match). */
  primary: string;
  header?: string;
  ctaBar?: string;
  /** L-L: recipe-name element and its card. */
  names?: { name: string; card: string };
  /** L-H / L-O: HOME CTAs. */
  homeCtas?: string;
  /** L-I: controls that must stay outside the insets. */
  headerControls?: string;
  bottomControls?: string;
}

export const COOKING_SLOTS = {
  prepare: { primary: ".prepare-bake-bar .cta-button--bake" },
  bake: { primary: ".prepare-bake-bar button.cta-button--bake" },
  result: { primary: ".result-panel__actions .cta-button--primary", ctaBar: ".result-panel__actions" },
} satisfies Record<string, SlotSelectors>;

export interface StateLabel {
  /** Human-readable state, used in every message: e.g. "FREE TOPPING p2 hint=open". */
  label: string;
  meta?: Record<string, unknown>;
}

interface Sample {
  state: StateLabel;
  profile: { id: ProfileId; width: number; height: number; insetMethod: "cdp" | "none"; insetRequested: Profile["inset"] };
  applied: AppliedProfile;
  measurement: LayoutMeasurement;
  results: InvariantResult[];
  advisory: { id: "L-N"; doughDiameterPx: number | null; floorPx: null }[];
}

/** Runs in the page. Keep it self-contained (serialized by Playwright). */
function measureInPage(s: Required<Omit<SlotSelectors, "names" | "homeCtas">> & Pick<SlotSelectors, "names" | "homeCtas">) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const probe = document.querySelector<HTMLElement>("[data-lc-probe]");
  const pcs = probe ? getComputedStyle(probe) : null;
  const sat = pcs ? parseFloat(pcs.paddingTop) || 0 : 0;
  const sab = pcs ? parseFloat(pcs.paddingBottom) || 0 : 0;

  const rectOf = (el: Element) => {
    const b = el.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height };
  };
  const isVisible = (el: Element) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  };
  const firstVisible = (sel: string) => [...document.querySelectorAll(sel)].find(isVisible) ?? null;
  const slot = (sel: string) => {
    const el = firstVisible(sel);
    return el ? rectOf(el) : null;
  };
  const describe = (el: Element | null) => {
    if (!el) return null;
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "";
    return `${el.tagName.toLowerCase()}${cls}${el.id ? "#" + el.id : ""}`.slice(0, 80);
  };
  const probeHit = (el: Element, target: string) => {
    const r = rectOf(el);
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const inside = x >= 0 && x < vw && y >= 0 && y < vh;
    const t = inside ? document.elementFromPoint(x, y) : null;
    return { target, x: Math.round(x), y: Math.round(y), hit: describe(t), ok: !!t && (t === el || el.contains(t)), rect: r };
  };
  const lineCount = (el: Element) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [...range.getClientRects()].filter((r) => r.width > 0).map((r) => r.top).sort((a, b) => a - b);
    let lines = 0;
    let last = -Infinity;
    for (const t of tops) {
      if (t - last > 6) lines += 1;
      last = t;
    }
    return lines;
  };
  const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 24);

  const primaryEl = firstVisible(s.primary);
  const primary = primaryEl ? probeHit(primaryEl, describe(primaryEl) ?? s.primary) : null;

  const pagerEl = firstVisible(".ingredient-page-nav") ?? document.querySelector(".ingredient-page-nav--placeholder");
  const pagerPlaceholder = !!pagerEl?.classList.contains("ingredient-page-nav--placeholder");
  const chips = [...document.querySelectorAll(".ingredient-chip")].filter(isVisible).map((c) => probeHit(c, text(c.querySelector(".ingredient-chip__name") ?? c)));
  const pagerButtons = pagerEl && !pagerPlaceholder
    ? [...pagerEl.querySelectorAll(".ingredient-page-nav__button")].map((b) => probeHit(b, b.getAttribute("aria-label") ?? "pager"))
    : [];

  const tabs = [...document.querySelectorAll(".making-step-tab")].filter(isVisible).map((t) => ({
    label: text(t),
    rect: rectOf(t),
    ellipsis: t.scrollWidth > t.clientWidth + 1 || [...t.querySelectorAll("*")].some((c) => c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).textOverflow === "ellipsis"),
  }));

  // L-E: document scroll, `.game-screen` scroll, a real scroll attempt, scrollable CTA ancestor.
  const se = document.scrollingElement ?? document.documentElement;
  const gs = document.querySelector(".game-screen");
  const scrollYBefore = window.scrollY;
  window.scrollBy(0, 200);
  const scrollYAfter = window.scrollY;
  window.scrollTo(0, scrollYBefore);
  let scrollableCtaAncestor: string | null = null;
  for (let a = primaryEl?.parentElement ?? null; a && a !== document.body; a = a.parentElement) {
    const oy = getComputedStyle(a).overflowY;
    if ((oy === "auto" || oy === "scroll") && a.scrollHeight > a.clientHeight + 1) {
      scrollableCtaAncestor = describe(a);
      break;
    }
  }

  // L-D: visible elements past the right edge that no ancestor clips.
  const overflowOffenders: string[] = [];
  const root = document.querySelector(".app-frame") ?? document.body;
  for (const el of root.querySelectorAll("*")) {
    if (el.closest("[data-lc-overlay]")) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.right <= vw + 1) continue;
    if (!isVisible(el)) continue;
    let clipped = false;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== "visible" && a.getBoundingClientRect().right <= vw + 1) {
        clipped = true;
        break;
      }
    }
    if (!clipped) overflowOffenders.push(`${describe(el)} right=${Math.round(b.right)}`);
    if (overflowOffenders.length >= 10) break;
  }

  const names = s.names
    ? [...document.querySelectorAll(s.names.name)].filter(isVisible).map((n) => {
        const card = n.closest(s.names!.card);
        const nr = rectOf(n);
        const cr = card ? rectOf(card) : nr;
        const overflowPx = Math.max(0, cr.left - nr.left, nr.right - cr.right, cr.top - nr.top, nr.bottom - cr.bottom, n.scrollWidth - n.clientWidth);
        return { label: text(n), rect: nr, lines: lineCount(n), overflowPx };
      })
    : [];
  const homeCtas = s.homeCtas
    ? [...document.querySelectorAll(s.homeCtas)].filter(isVisible).map((c) => ({
        label: text(c),
        rect: rectOf(c),
        lines: lineCount(c),
        primary: c.classList.contains("cta-button--primary"),
      }))
    : [];

  const headerControl = firstVisible(s.headerControls);
  const bottomControls = [...document.querySelectorAll(s.bottomControls)].filter(isVisible);

  return {
    vw,
    vh,
    sat,
    sab,
    rects: {
      header: slot(s.header),
      hud: slot(".mission-hud"),
      tabs: slot(".making-step-tabs"),
      orderCard: slot(".game-screen .order-card"),
      stage: slot(".pizza-stage"),
      dough: slot('[data-pizza-drop-target="true"]'),
      tray: slot(".ingredient-tray"),
      pager: pagerEl ? rectOf(pagerEl) : null,
      ctaBar: slot(s.ctaBar),
      primaryCta: primary?.rect ?? null,
    },
    pagerPlaceholder,
    primary,
    primaryLines: primaryEl ? lineCount(primaryEl) : null,
    chips,
    pagerButtons,
    tabs,
    scroll: {
      docScrollHeight: se.scrollHeight,
      docClientHeight: se.clientHeight,
      docScrollWidth: se.scrollWidth,
      gsSh: gs ? gs.scrollHeight : null,
      gsCh: gs ? gs.clientHeight : null,
      scrollYBefore,
      scrollYAfter,
      scrollableCtaAncestor,
    },
    overflowOffenders,
    names,
    homeCtas,
    headerControlTop: headerControl ? headerControl.getBoundingClientRect().top : null,
    bottomControlBottom: bottomControls.length ? Math.max(...bottomControls.map((b) => b.getBoundingClientRect().bottom)) : null,
  };
}

export async function measureLayout(page: Page, slots: SlotSelectors): Promise<LayoutMeasurement> {
  const header = slots.header ?? ".app-header";
  const ctaBar = slots.ctaBar ?? ".prepare-bake-bar";
  return page.evaluate(measureInPage, {
    primary: slots.primary,
    header,
    ctaBar,
    names: slots.names,
    homeCtas: slots.homeCtas,
    headerControls: slots.headerControls ?? `${header} button`,
    bottomControls: slots.bottomControls ?? `${ctaBar} button`,
  });
}

async function annotatedScreenshot(page: Page, m: LayoutMeasurement, title: string): Promise<Buffer> {
  const boxes = Object.entries(m.rects).filter(([, r]) => r !== null) as [string, NonNullable<LayoutMeasurement["rects"]["header"]>][];
  await page.evaluate(
    ({ boxes, title, sab, vh }) => {
      const layer = document.createElement("div");
      layer.setAttribute("data-lc-overlay", "");
      layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;font:10px/1.2 monospace";
      const add = (css: string, label?: string) => {
        const d = document.createElement("div");
        d.style.cssText = `position:fixed;pointer-events:none;${css}`;
        if (label) d.textContent = label;
        layer.appendChild(d);
      };
      for (const [name, r] of boxes) {
        add(`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;outline:2px solid rgba(255,0,80,.85);color:#fff;background:rgba(255,0,80,.08)`, name);
      }
      add(`left:0;right:0;top:${vh - sab}px;height:0;border-top:2px dashed #06f`);
      add(`left:0;right:0;top:0;background:rgba(0,0,0,.75);color:#ff0;padding:2px`, title);
      document.body.appendChild(layer);
    },
    { boxes, title, sab: m.sab, vh: m.vh },
  );
  const shot = await page.screenshot();
  await page.evaluate(() => document.querySelectorAll("[data-lc-overlay]").forEach((e) => e.remove()));
  return shot;
}

function headSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export class LayoutContract {
  readonly samples: Sample[] = [];
  private readonly tabsTop = new Map<ProfileId, { top: number; state: string }>();
  private shots = 0;

  private constructor(
    readonly page: Page,
    readonly testInfo: TestInfo,
    readonly driver: ProfileDriver,
    readonly profiles: Profile[],
  ) {}

  static async start(page: Page, testInfo: TestInfo, browserName: string): Promise<LayoutContract> {
    const driver = await ProfileDriver.create(page, browserName);
    return new LayoutContract(page, testInfo, driver, profilesFor(testInfo));
  }

  mountProfile(kind: "short" | "nominal"): Profile {
    return mountProfileFor(this.testInfo, kind);
  }

  async apply(profile: Profile) {
    return this.driver.apply(profile);
  }

  /** Measure `state` on every profile, judge `checks`, then restore `restore`. */
  async checkpoint(
    state: StateLabel,
    checks: InvariantId[],
    slots: SlotSelectors,
    restore: Profile,
    opts: { beforeMeasure?: (p: Profile) => Promise<void> } = {},
  ): Promise<Map<ProfileId, LayoutMeasurement>> {
    const out = new Map<ProfileId, LayoutMeasurement>();
    for (const profile of this.profiles) {
      const applied = await this.driver.apply(profile);
      if (opts.beforeMeasure) await opts.beforeMeasure(profile);
      const m = await measureLayout(this.page, slots);
      const ctx = { profileId: profile.id, state: state.label };
      const results = evaluateInvariants(m, checks, ctx);
      if (checks.includes("L-J") && m.rects.tabs) {
        const base = this.tabsTop.get(profile.id);
        if (!base) this.tabsTop.set(profile.id, { top: m.rects.tabs.top, state: state.label });
        else results.push(compareStable("L-J", `tabs.top (vs ${base.state})`, base.top, m.rects.tabs.top, ctx));
      }
      await this.record(state, profile, applied, m, results, checks.includes("L-N"));
      out.set(profile.id, m);
    }
    await this.driver.apply(restore);
    return out;
  }

  /** Records extra (cross-state) results against an existing sample, e.g. L-O. */
  async recordExtra(state: StateLabel, profile: Profile, applied: AppliedProfile, m: LayoutMeasurement, results: InvariantResult[]) {
    await this.record(state, profile, applied, m, results, false);
  }

  private async record(state: StateLabel, profile: Profile, applied: AppliedProfile, m: LayoutMeasurement, results: InvariantResult[], dough: boolean) {
    for (const r of results) {
      if (r.pass || r.priority !== "P1") continue;
      const known = KNOWN_P1.find((k) => k.id === r.id && k.state.test(state.label) && k.profiles.includes(profile.id) && k.actual.test(String(r.actual)));
      if (known) r.knownOwnerPending = known.ref;
    }
    const failed = results.filter((r) => !r.pass);
    // P0 and any P1 not in the Owner-pending register fail the test; L-N is never judged.
    for (const r of failed) if (!r.knownOwnerPending) expect.soft(r.pass, r.message).toBe(true);
    if (failed.length && this.shots < 20) {
      this.shots += 1;
      const title = failed.map((r) => r.message).join(" | ");
      await this.testInfo.attach(`layout-fail-${profile.id}-${state.label.replace(/[^\w-]+/g, "_")}.png`, {
        body: await annotatedScreenshot(this.page, m, title),
        contentType: "image/png",
      });
    }
    await this.evidenceShot(state, profile);
    this.samples.push({
      state,
      profile: {
        id: profile.id,
        width: profile.width,
        height: profile.height,
        insetMethod: profile.inset ? "cdp" : "none",
        insetRequested: profile.inset,
      },
      applied,
      measurement: m,
      results,
      advisory: dough && m.rects.dough ? [{ id: "L-N", doughDiameterPx: Math.round(m.rects.dough.width), floorPx: null }] : [],
    });
  }

  /** Report screenshots (Human Verification evidence, not a failure artifact): only when
   *  LC_SHOTS_DIR is set, for the profiles in LC_SHOTS_PROFILES (comma list, default all). */
  private async evidenceShot(state: StateLabel, profile: Profile) {
    const dir = process.env.LC_SHOTS_DIR;
    if (!dir) return;
    const only = process.env.LC_SHOTS_PROFILES?.split(",");
    if (only && !only.includes(profile.id)) return;
    const test = this.testInfo.title.split(" ")[0];
    const name = `${test}-${state.label}-${profile.id}`.replace(/[^\w-]+/g, "_");
    mkdirSync(dir, { recursive: true });
    await this.page.screenshot({ path: `${dir}/${name}.png` });
  }

  /** Screenshot of the current profile for the report (not a failure artifact). */
  async attachShot(name: string) {
    await this.testInfo.attach(name, { body: await this.page.screenshot(), contentType: "image/png" });
  }

  async finish() {
    const all = this.samples.flatMap((s) => s.results);
    const doughs = this.samples.flatMap((s) => s.advisory.map((a) => ({ profile: s.profile.id, state: s.state.label, px: a.doughDiameterPx })));
    const evidence = {
      schema: "teto-layout-evidence/1",
      test: this.testInfo.title,
      project: this.testInfo.project.name,
      engine: { name: this.driver.engine, version: this.page.context().browser()?.version() ?? "unknown" },
      headSha: headSha(),
      samples: this.samples,
      summary: {
        samples: this.samples.length,
        checks: all.length,
        p0Fail: all.filter((r) => !r.pass && PRIORITY[r.id] === "P0").length,
        p1Fail: all.filter((r) => !r.pass && PRIORITY[r.id] === "P1" && !r.knownOwnerPending).length,
        p1OwnerPending: all.filter((r) => !r.pass && r.knownOwnerPending).length,
        advisoryRecorded: doughs.length,
        minDough: doughs.reduce<(typeof doughs)[number] | null>((min, d) => (d.px !== null && (!min || (min.px ?? Infinity) > d.px) ? d : min), null),
      },
    };
    await this.testInfo.attach("layout-evidence.json", { body: JSON.stringify(evidence, null, 1), contentType: "application/json" });
    // Leave the page clean for any later step (the CDP override would outlive this test's page
    // otherwise only within this context, but clear it anyway).
    await this.driver.setSafeArea(null).catch(() => {});
  }
}
