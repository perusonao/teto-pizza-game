import { expect, test } from "@playwright/test";
import { evaluateInvariants, PAGER_CTA_GAP, type LayoutMeasurement, type Rect } from "./support/layoutInvariants";

/**
 * DM-3R-0 (Issue #245) Owner pre-merge condition for the L-B change: the tray-bottom fallback
 * applies only to a round whose PREPARE dock explicitly reserves no pager row. Pure checks on
 * synthetic measurements (no page) -- the real geometry is covered by the Layout Contract.
 */
const rect = (top: number, bottom: number): Rect => ({ top, bottom, left: 12, right: 378, width: 366, height: bottom - top }) as Rect;

function measurement(over: Partial<LayoutMeasurement["rects"]>, pagerReserved: boolean | null): LayoutMeasurement {
  return {
    vw: 390,
    vh: 664,
    sat: 0,
    sab: 0,
    rects: { header: null, hud: null, tabs: null, orderCard: null, stage: null, dough: null, tray: null, pager: null, ctaBar: rect(594, 664), primaryCta: null, ...over },
    pagerPlaceholder: false,
    pagerReserved,
    primary: null,
    primaryLines: null,
    chips: [],
    pagerButtons: [],
    tabs: [],
    scroll: { docScrollHeight: 664, docClientHeight: 664, docScrollWidth: 390, gsSh: null, gsCh: null, scrollYBefore: 0, scrollYAfter: 0, scrollableCtaAncestor: null },
    overflowOffenders: [],
    names: [],
    homeCtas: [],
    headerControlTop: null,
    bottomControlBottom: null,
  };
}

const lb = (m: LayoutMeasurement) => evaluateInvariants(m, ["L-B"], { profileId: "S390", state: "unit" })[0];

test.describe("L-B pager / CTA gap after DM-3R-0", () => {
  test("paging round: the pager row is still what is measured, with the same 8px gap", () => {
    expect(PAGER_CTA_GAP).toBe(8);
    expect(lb(measurement({ tray: rect(420, 540), pager: rect(546, 574) }, true)).pass).toBe(true); // gap 20
    // A pager too close to the bar still fails, even though the tray above it would pass.
    expect(lb(measurement({ tray: rect(420, 540), pager: rect(560, 590) }, true)).pass).toBe(false); // gap 4
  });

  test("paging round with its pager row missing fails -- the tray fallback never hides it", () => {
    const r = lb(measurement({ tray: rect(420, 540) }, true));
    expect(r.pass).toBe(false);
    // The same missing pager on a screen with no dock reservation at all fails as before.
    expect(lb(measurement({ tray: rect(420, 540) }, null)).pass).toBe(false);
  });

  test("non-paging round: the tray bottom is measured with the same 8px requirement", () => {
    expect(lb(measurement({ tray: rect(420, 586) }, false)).pass).toBe(true); // gap 8
    expect(lb(measurement({ tray: rect(420, 590) }, false)).pass).toBe(false); // gap 4
  });
});
