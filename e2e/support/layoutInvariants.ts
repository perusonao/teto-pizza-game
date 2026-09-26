/**
 * Progression 2.0 W1 I5b-5 Layout Contract: the invariants L-A..L-O as pure functions of one
 * geometry measurement (`LayoutMeasurement`, e2e/support/layoutContract.ts).
 *
 * Authority: I5b-5 Verification Design (`d4f96d0`) §5.1 / §5.2. Only the design's own constants
 * are used -- TOL 1px, the 8px pager/CTA gap (L-B, L-K), HOME CTA ≤2 lines / height ≤64 /
 * width:height ≥1.6 (L-H), 44px tap targets (L-M). L-N (dough diameter) is advisory with no floor
 * (OD-V-4 is still open), so it is recorded but never fails.
 */

export const TOL = 1;
export const PAGER_CTA_GAP = 8;
export const HOME_CTA_MAX_LINES = 2;
export const HOME_CTA_MAX_HEIGHT = 64;
export const HOME_CTA_MIN_ASPECT = 1.6;
export const RECIPE_NAME_MAX_LINES = 2;
export const TAP_TARGET_MIN = 44;

export type InvariantId =
  | "L-A"
  | "L-B"
  | "L-C"
  | "L-D"
  | "L-E"
  | "L-F"
  | "L-G"
  | "L-H"
  | "L-I"
  | "L-J"
  | "L-K"
  | "L-L"
  | "L-M"
  | "L-N"
  | "L-O";

export type Priority = "P0" | "P1" | "advisory";

export const PRIORITY: Record<InvariantId, Priority> = {
  "L-A": "P0",
  "L-B": "P0",
  "L-C": "P0",
  "L-D": "P0",
  "L-E": "P0",
  "L-F": "P0",
  "L-G": "P0",
  "L-H": "P1",
  "L-I": "P1",
  "L-J": "P1",
  "L-K": "P1",
  "L-L": "P1",
  "L-M": "P1",
  "L-N": "advisory",
  "L-O": "P1",
};

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export interface HitProbe {
  target: string;
  x: number;
  y: number;
  /** `tag.class#id` of what `elementFromPoint` returned (null: point outside the viewport). */
  hit: string | null;
  ok: boolean;
  rect: Rect;
}

export interface TextBox {
  label: string;
  rect: Rect;
  lines: number;
}

export interface LayoutMeasurement {
  vw: number;
  vh: number;
  sat: number;
  sab: number;
  rects: {
    header: Rect | null;
    hud: Rect | null;
    tabs: Rect | null;
    orderCard: Rect | null;
    stage: Rect | null;
    dough: Rect | null;
    tray: Rect | null;
    pager: Rect | null;
    ctaBar: Rect | null;
    primaryCta: Rect | null;
  };
  pagerPlaceholder: boolean;
  primary: HitProbe | null;
  primaryLines: number | null;
  chips: HitProbe[];
  pagerButtons: HitProbe[];
  tabs: { label: string; rect: Rect; ellipsis: boolean }[];
  scroll: {
    docScrollHeight: number;
    docClientHeight: number;
    docScrollWidth: number;
    gsSh: number | null;
    gsCh: number | null;
    scrollYBefore: number;
    scrollYAfter: number;
    scrollableCtaAncestor: string | null;
  };
  /** Visible, unclipped elements whose right edge passes the viewport (L-D). */
  overflowOffenders: string[];
  /** Recipe names (L-L): line count and how far the name box leaves its card. */
  names: (TextBox & { overflowPx: number })[];
  /** HOME CTAs in DOM order (L-H / L-O / L-M). */
  homeCtas: (TextBox & { primary: boolean })[];
  /** L-I: first control in the header, controls in the bottom bar. */
  headerControlTop: number | null;
  bottomControlBottom: number | null;
}

export interface InvariantResult {
  id: InvariantId;
  priority: Priority;
  pass: boolean;
  expected: string;
  actual: string | number;
  deltaPx: number | null;
  message: string;
  /** Set when this P1 failure is a registered, Owner-pending finding (KNOWN_P1). */
  knownOwnerPending?: string;
}

export interface CheckContext {
  profileId: string;
  state: string;
}

type Check = (m: LayoutMeasurement) => Omit<InvariantResult, "id" | "priority" | "message"> & { what: string };

function fmt(n: number) {
  return Math.round(n * 10) / 10;
}

function ok(what: string): ReturnType<Check> {
  return { pass: true, expected: "", actual: "", deltaPx: null, what };
}

/** L-A (and L-F, which is L-A on the BAKE CTA): inside the viewport minus the bottom inset,
 *  below the header, and hit-testable at its center. */
function ctaReachable(m: LayoutMeasurement): ReturnType<Check> {
  const p = m.primary;
  if (!p) return { pass: false, expected: "primary CTA present", actual: "missing", deltaPx: null, what: "CTA" };
  const limit = m.vh - m.sab;
  if (p.rect.bottom > limit + TOL) {
    return { pass: false, expected: `bottom <= ${limit}`, actual: fmt(p.rect.bottom), deltaPx: fmt(limit - p.rect.bottom), what: "CTA bottom" };
  }
  const header = m.rects.header;
  if (header && p.rect.top < header.bottom - TOL) {
    return { pass: false, expected: `top >= header.bottom ${fmt(header.bottom)}`, actual: fmt(p.rect.top), deltaPx: fmt(p.rect.top - header.bottom), what: "CTA under header" };
  }
  if (!p.ok) return { pass: false, expected: `elementFromPoint = ${p.target}`, actual: p.hit ?? "null", deltaPx: null, what: "CTA hit" };
  return ok("CTA");
}

export const CHECKS: Partial<Record<InvariantId, Check>> = {
  "L-A": ctaReachable,
  "L-F": ctaReachable,
  "L-B": (m) => {
    const { pager, ctaBar } = m.rects;
    if (!pager || !ctaBar) {
      return { pass: false, expected: "pager and CTA bar present", actual: `pager=${!!pager} bar=${!!ctaBar}`, deltaPx: null, what: "pager/CTA gap" };
    }
    const gap = ctaBar.top - pager.bottom;
    return gap + TOL >= PAGER_CTA_GAP
      ? ok("pager/CTA gap")
      : { pass: false, expected: `>= ${PAGER_CTA_GAP}`, actual: `gap=${fmt(gap)}px`, deltaPx: fmt(gap - PAGER_CTA_GAP), what: "pager/CTA gap" };
  },
  "L-C": (m) => {
    const cap = Math.min(m.rects.pager?.top ?? Infinity, m.rects.ctaBar?.top ?? Infinity);
    const low = m.chips.filter((c) => c.rect.bottom > cap + TOL);
    if (low.length) {
      const worst = Math.max(...low.map((c) => c.rect.bottom - cap));
      return { pass: false, expected: `chip.bottom <= ${fmt(cap)}`, actual: `${low.length} chip(s) below: ${low.map((c) => c.target).join(",")}`, deltaPx: fmt(-worst), what: "chips" };
    }
    const unhit = [...m.chips, ...m.pagerButtons].filter((c) => !c.ok);
    if (unhit.length) {
      return { pass: false, expected: "chips/pager buttons hittable", actual: unhit.map((c) => `${c.target}->${c.hit}`).join(", "), deltaPx: null, what: "chips/pager hit" };
    }
    if (m.chips.length === 0) return { pass: false, expected: ">= 1 visible chip", actual: 0, deltaPx: null, what: "chips" };
    return ok("chips");
  },
  "L-D": (m) => {
    if (m.scroll.docScrollWidth > m.vw) {
      return { pass: false, expected: `scrollWidth <= ${m.vw}`, actual: m.scroll.docScrollWidth, deltaPx: m.vw - m.scroll.docScrollWidth, what: "horizontal overflow" };
    }
    if (m.overflowOffenders.length) {
      return { pass: false, expected: `right <= ${m.vw}`, actual: m.overflowOffenders.slice(0, 5).join(", "), deltaPx: null, what: "horizontal overflow" };
    }
    return ok("horizontal overflow");
  },
  "L-E": (m) => {
    const s = m.scroll;
    if (s.docScrollHeight > s.docClientHeight + TOL) {
      return { pass: false, expected: `document scrollHeight <= ${s.docClientHeight}`, actual: s.docScrollHeight, deltaPx: s.docClientHeight - s.docScrollHeight, what: "page scroll" };
    }
    if (s.gsSh !== null && s.gsCh !== null && s.gsSh > s.gsCh + TOL) {
      return { pass: false, expected: `.game-screen sh <= ch ${s.gsCh}`, actual: s.gsSh, deltaPx: s.gsCh - s.gsSh, what: ".game-screen scroll" };
    }
    if (s.scrollYAfter !== 0) {
      return { pass: false, expected: "scrollY 0 after scrollBy(0,200)", actual: s.scrollYAfter, deltaPx: -s.scrollYAfter, what: "page scroll" };
    }
    if (s.scrollableCtaAncestor) {
      return { pass: false, expected: "no scrollable CTA ancestor", actual: s.scrollableCtaAncestor, deltaPx: null, what: "CTA in a scroller" };
    }
    return ok("scroll");
  },
  "L-G": (m) => {
    const { hud, tabs } = m.rects;
    if (!hud) return { pass: false, expected: "Lunch Rush HUD present", actual: "missing", deltaPx: null, what: "HUD/tabs" };
    if (!tabs) return ok("HUD/tabs");
    return hud.bottom <= tabs.top + TOL
      ? ok("HUD/tabs")
      : { pass: false, expected: `hud.bottom <= tabs.top ${fmt(tabs.top)}`, actual: fmt(hud.bottom), deltaPx: fmt(tabs.top - hud.bottom), what: "HUD/tabs overlap" };
  },
  "L-H": (m) => {
    if (m.homeCtas.length === 0) return { pass: false, expected: "HOME CTAs present", actual: 0, deltaPx: null, what: "HOME CTA shape" };
    for (const c of m.homeCtas) {
      if (c.lines > HOME_CTA_MAX_LINES) return { pass: false, expected: `<= ${HOME_CTA_MAX_LINES} lines`, actual: `${c.label}: ${c.lines} lines`, deltaPx: null, what: "HOME CTA label" };
      if (c.rect.height > HOME_CTA_MAX_HEIGHT + TOL) return { pass: false, expected: `height <= ${HOME_CTA_MAX_HEIGHT}`, actual: `${c.label}: ${fmt(c.rect.height)}`, deltaPx: fmt(HOME_CTA_MAX_HEIGHT - c.rect.height), what: "HOME CTA height" };
      const aspect = c.rect.width / c.rect.height;
      if (aspect < HOME_CTA_MIN_ASPECT) return { pass: false, expected: `width/height >= ${HOME_CTA_MIN_ASPECT}`, actual: `${c.label}: ${fmt(aspect)}`, deltaPx: null, what: "HOME CTA aspect" };
    }
    return ok("HOME CTA shape");
  },
  "L-I": (m) => {
    if (m.headerControlTop !== null && m.headerControlTop < m.sat - TOL) {
      return { pass: false, expected: `header control top >= ${m.sat}`, actual: fmt(m.headerControlTop), deltaPx: fmt(m.headerControlTop - m.sat), what: "control in top inset" };
    }
    const limit = m.vh - m.sab;
    if (m.bottomControlBottom !== null && m.bottomControlBottom > limit + TOL) {
      return { pass: false, expected: `bottom control <= ${limit}`, actual: fmt(m.bottomControlBottom), deltaPx: fmt(limit - m.bottomControlBottom), what: "control in bottom inset" };
    }
    return ok("insets");
  },
  "L-J": (m) => {
    if (m.tabs.length === 0) return { pass: false, expected: "step tabs present", actual: 0, deltaPx: null, what: "tabs" };
    const out = m.tabs.filter((t) => t.rect.right > m.vw + TOL);
    if (out.length) return { pass: false, expected: `tab.right <= ${m.vw}`, actual: out.map((t) => `${t.label}:${fmt(t.rect.right)}`).join(","), deltaPx: fmt(m.vw - Math.max(...out.map((t) => t.rect.right))), what: "tabs" };
    const cut = m.tabs.filter((t) => t.ellipsis);
    if (cut.length) return { pass: false, expected: "no ellipsis", actual: cut.map((t) => t.label).join(","), deltaPx: null, what: "tab label" };
    return ok("tabs");
  },
  "L-K": (m) => {
    const r = m.rects;
    const chain: [string, Rect | null][] = [
      ["header", r.header],
      ["hud", r.hud],
      ["tabs", r.tabs],
      ["orderCard", r.orderCard],
      ["stage", r.stage],
      ["tray", r.tray],
      ["pager", r.pager],
      ["ctaBar", r.ctaBar],
    ];
    const present = chain.filter((c): c is [string, Rect] => c[1] !== null);
    for (let i = 1; i < present.length; i += 1) {
      const [aName, a] = present[i - 1];
      const [bName, b] = present[i];
      const need = aName === "pager" && bName === "ctaBar" ? PAGER_CTA_GAP : 0;
      if (a.bottom + need > b.top + TOL) {
        return { pass: false, expected: `${aName}.bottom${need ? ` + ${need}` : ""} <= ${bName}.top`, actual: `${fmt(a.bottom)} vs ${fmt(b.top)}`, deltaPx: fmt(b.top - a.bottom - need), what: `skeleton ${aName}/${bName}` };
      }
    }
    return ok("skeleton");
  },
  "L-L": (m) => {
    if (m.names.length === 0) return { pass: false, expected: "recipe names present", actual: 0, deltaPx: null, what: "recipe names" };
    const long = m.names.filter((n) => n.lines > RECIPE_NAME_MAX_LINES);
    if (long.length) return { pass: false, expected: `<= ${RECIPE_NAME_MAX_LINES} lines`, actual: long.map((n) => `${n.label}:${n.lines}`).join(","), deltaPx: null, what: "recipe name lines" };
    const over = m.names.filter((n) => n.overflowPx > TOL);
    if (over.length) return { pass: false, expected: "name inside its card", actual: over.map((n) => `${n.label}:+${fmt(n.overflowPx)}`).join(","), deltaPx: fmt(-Math.max(...over.map((n) => n.overflowPx))), what: "recipe name overflow" };
    return ok("recipe names");
  },
  "L-M": (m) => {
    const targets = [
      ...(m.primary ? [{ label: m.primary.target, rect: m.primary.rect }] : []),
      ...m.homeCtas.map((c) => ({ label: c.label, rect: c.rect })),
      ...m.chips.map((c) => ({ label: c.target, rect: c.rect })),
      ...m.pagerButtons.map((c) => ({ label: c.target, rect: c.rect })),
    ];
    const small = targets.filter((t) => t.rect.width + TOL < TAP_TARGET_MIN || t.rect.height + TOL < TAP_TARGET_MIN);
    if (small.length) {
      const worst = Math.min(...small.map((t) => Math.min(t.rect.width, t.rect.height)));
      return { pass: false, expected: `>= ${TAP_TARGET_MIN}x${TAP_TARGET_MIN}`, actual: small.map((t) => `${t.label}:${fmt(t.rect.width)}x${fmt(t.rect.height)}`).join(","), deltaPx: fmt(worst - TAP_TARGET_MIN), what: "tap targets" };
    }
    return ok("tap targets");
  },
};

export function evaluateInvariants(m: LayoutMeasurement, ids: InvariantId[], ctx: CheckContext): InvariantResult[] {
  return ids.flatMap((id) => {
    const check = CHECKS[id];
    if (!check) return [];
    const r = check(m);
    const message = r.pass
      ? `${id} ${r.what} @${ctx.profileId} ${ctx.state}: ok`
      : `${id} ${r.what} @${ctx.profileId} ${ctx.state}: ${r.actual} (need ${r.expected})${r.deltaPx !== null ? ` Δ=${r.deltaPx}px` : ""}`;
    return [{ id, priority: PRIORITY[id], pass: r.pass, expected: r.expected, actual: r.actual, deltaPx: r.deltaPx, message }];
  });
}

/** L-J (tabs top stable) and L-O (HOME skeleton stable) compare two measurements of the same
 *  profile. */
export function compareStable(
  id: "L-J" | "L-O",
  what: string,
  before: number,
  after: number,
  ctx: CheckContext,
): InvariantResult {
  const delta = after - before;
  const pass = Math.abs(delta) <= TOL;
  return {
    id,
    priority: PRIORITY[id],
    pass,
    expected: `${what} = ${fmt(before)} (±${TOL})`,
    actual: fmt(after),
    deltaPx: fmt(delta),
    message: pass
      ? `${id} ${what} stable @${ctx.profileId} ${ctx.state}: ok`
      : `${id} ${what} moved @${ctx.profileId} ${ctx.state}: ${fmt(before)} -> ${fmt(after)} Δ=${fmt(delta)}px (need ±${TOL})`,
  };
}
