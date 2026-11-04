import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BEST_END_MS, BEST_START_MS, PAN_ARM_MS, PAN_TOTAL_MS } from "../logic/prep/panDoneness";
import { PREP_DONE_MS, PREP_GUARD_MS } from "../logic/prep/prepOffer";
import { CookingPrepLayer } from "./CookingPrepLayer";

/**
 * Cooking Prep Phase 1B (#696): the pill / pan screen timing game, with the experience gate OPEN. The OFF half is the first test (and the production
 * default is pinned by src/logic/prep/prepIngredient.flagOff.test.ts). Fake timers (performance.now is faked with them), so every press lands on an exact
 * millisecond; the grade rules themselves are in src/logic/prep/panDoneness.test.ts.
 */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../data/prepExperienceGate", () => ({ PREP_EXPERIENCE_PRODUCTION: false, prepExperienceEnabled: () => gate.open }));

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  gate.open = true;
});

type Props = Parameters<typeof CookingPrepLayer>[0];
function setup(patch: Partial<Props> = {}) {
  const onPrep = vi.fn();
  const onBusyChange = vi.fn();
  const props: Props = { phase: "PREPARE", makingStep: "TOPPING", roundKind: "GUIDED", active: true, selectedIngredientId: "beef", ownedIngredientIds: ["beef"], makingStepToken: 0, resetToken: 0, onPrep, onBusyChange, ...patch };
  const view = render(<CookingPrepLayer {...props} />);
  return { onPrep, onBusyChange, props, rerender: (next: Partial<Props>) => view.rerender(<CookingPrepLayer {...props} {...next} />), container: view.container };
}
const pill = () => screen.getByTestId("cooking-prep-pill");
const take = () => screen.getByTestId("cooking-prep-take");
const pan = () => screen.queryByTestId("cooking-prep-pan");
const grade = () => screen.getByTestId("cooking-prep-pan").getAttribute("data-grade");
/** Opens the pan (a keyboard-style click, detail 0) and returns the moment it started, on the faked clock. */
function openPan() {
  fireEvent.click(pill());
  return performance.now();
}
/** A press of 「取り出す！」 stamped `elapsed` ms after `startedAt` -- the stamp is what the game grades, not when the handler ran. */
function pressAt(startedAt: number, elapsed: number, target: HTMLElement = take()) {
  const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "timeStamp", { value: startedAt + elapsed });
  act(() => void target.dispatchEvent(event));
}

describe("flag OFF / not offered: nothing is rendered", () => {
  it("OFF: no DOM at all", () => {
    gate.open = false;
    expect(setup().container).toBeEmptyDOMElement();
  });
  it.each([
    ["Lunch Rush", { roundKind: "LUNCH_RUSH" as const }],
    ["Dinner", { roundKind: "DINNER" as const }],
    ["SAUCE step", { makingStep: "SAUCE" as const }],
    ["another ingredient", { selectedIngredientId: "mozzarella" }],
    ["nothing selected", { selectedIngredientId: null }],
    ["beef not owned", { ownedIngredientIds: [] }],
    ["stage not active", { active: false }],
  ])("ON but %s: no DOM", (_n, patch) => {
    expect(setup(patch).container).toBeEmptyDOMElement();
  });
});

describe("the pill", () => {
  it("shows for beef, opens the pan only when released on it, and not from a press that began elsewhere", () => {
    setup();
    expect(pill()).toHaveTextContent("🍳 炒める");
    fireEvent.pointerUp(pill(), { clientX: 0, clientY: 0 }); // no pointerdown on the pill first
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
    fireEvent.pointerDown(pill());
    vi.spyOn(pill(), "getBoundingClientRect").mockReturnValue({ left: 100, right: 220, top: 400, bottom: 444, width: 120, height: 44, x: 100, y: 400, toJSON: () => ({}) });
    fireEvent.pointerUp(pill(), { clientX: 300, clientY: 420 }); // released outside the pill
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
    fireEvent.pointerDown(pill());
    fireEvent.pointerUp(pill(), { clientX: 150, clientY: 420 });
    expect(screen.getByTestId("cooking-prep-pan")).toBeInTheDocument();
  });

  it("opens from the keyboard too (Enter / Space reach click with detail 0)", () => {
    setup();
    fireEvent.click(pill());
    expect(screen.getByTestId("cooking-prep-pan")).toBeInTheDocument();
  });

  it("a pointer click (detail > 0) does not open on its own: pointerup is the only pointer path", () => {
    setup();
    fireEvent.click(pill(), { detail: 1 });
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
  });
});

describe("the pan screen", () => {
  it("opens with the title and 「取り出す！」, and shows no gauge, bar, ring, number or countdown (Q3)", () => {
    setup();
    openPan();
    expect(screen.getByTestId("cooking-prep-pan").textContent).toContain("いい焼き色で取り出そう");
    expect(take()).toHaveTextContent("取り出す！");
    const root = screen.getByTestId("cooking-prep-pan");
    expect(root.querySelector('progress, meter, [role="progressbar"], [role="meter"], [role="timer"]')).toBeNull();
    expect(root.textContent).not.toMatch(/[0-9０-９]|秒|%|％|残り/);
    expect(screen.getByRole("status")).not.toHaveTextContent(/[0-9０-９]|秒|残り/);
  });

  it("「取り出す！」 is dim for the first PAN_ARM_MS, then wakes up; a press while dim is no grade at all", () => {
    const { onPrep } = setup();
    const t0 = openPan();
    expect(take()).toHaveAttribute("data-armed", "false");
    pressAt(t0, 0);
    pressAt(t0, PAN_ARM_MS - 1);
    expect(grade()).toBeNull();
    expect(screen.getByTestId("cooking-prep-pan")).toHaveAttribute("data-mode", "running");
    advance(PAN_ARM_MS);
    expect(take()).toHaveAttribute("data-armed", "true");
    expect(onPrep).not.toHaveBeenCalled();
  });

  it.each([
    [PAN_ARM_MS, "early"],
    [BEST_START_MS - 1, "early"],
    [BEST_START_MS, "best"],
    [BEST_END_MS - 1, "best"],
    [BEST_END_MS, "overdone"], // 4200 ms exactly is overdone (half-open)
    [PAN_TOTAL_MS - 1, "overdone"],
  ] as const)("a press stamped +%sms is %s", (elapsed, expected) => {
    setup();
    const t0 = openPan();
    pressAt(t0, elapsed);
    expect(grade()).toBe(expected);
  });

  it("a stamp from another clock (0, epoch milliseconds, NaN) is replaced by 'now' instead of grading nonsense", () => {
    setup();
    const t0 = openPan();
    advance(1000);
    const at = (value: number) => {
      const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "timeStamp", { value });
      act(() => void take().dispatchEvent(event));
    };
    at(Date.now()); // epoch ms: far from performance.now()
    expect(grade()).toBe("early"); // graded as 'now' (+1000), not as a time-out
    expect(t0).toBeDefined();
  });

  it("the stamp decides, not the timer: a handler that runs late still grades the press's own moment", () => {
    setup();
    const t0 = openPan();
    advance(5000); // the clock is far ahead, but the press says it happened at +3000
    pressAt(t0, 3000);
    expect(grade()).toBe("best");
  });

  it("the pan closes itself at the total: overdone, 'timed out' wording, nothing dispatched", () => {
    const { onPrep } = setup();
    openPan();
    advance(PAN_TOTAL_MS - 1);
    expect(grade()).toBeNull();
    advance(1);
    expect(grade()).toBe("overdone");
    expect(screen.getByTestId("cooking-prep-result")).toHaveTextContent("出し遅れた…");
    expect(onPrep).not.toHaveBeenCalled();
  });

  it("time-out wins a tie: a press stamped at the total is the time-out", () => {
    setup();
    const t0 = openPan();
    pressAt(t0, PAN_TOTAL_MS);
    expect(grade()).toBe("overdone");
    expect(screen.getByTestId("cooking-prep-result")).toHaveTextContent("出し遅れた…");
  });

  it("the stages switch exactly on their edges (data-stage), and the colour freezes at the press", () => {
    setup();
    const t0 = openPan();
    const stageAt = () => screen.getByTestId("cooking-prep-pan").getAttribute("data-stage");
    const expected: [number, string][] = [[0, "0"], [1799, "0"], [1800, "1"], [2099, "1"], [2100, "2"], [3599, "2"], [3600, "3"], [4199, "3"], [4200, "4"], [5999, "4"]];
    let now = 0;
    for (const [at, stage] of expected) {
      advance(at - now);
      now = at;
      expect(stageAt(), `+${at}ms`).toBe(stage);
    }
    // restart and freeze
    cleanup();
    setup();
    const t1 = openPan();
    advance(3000);
    pressAt(t1, 3000);
    const colour = screen.getByTestId("cooking-prep-beef").getAttribute("style");
    const stage = screen.getByTestId("cooking-prep-pan").getAttribute("data-stage");
    advance(400);
    expect(screen.getByTestId("cooking-prep-beef").getAttribute("style")).toBe(colour);
    expect(screen.getByTestId("cooking-prep-pan").getAttribute("data-stage")).toBe(stage);
    expect(t0).toBeDefined();
  });

  it("best: the result shows, then it closes by itself and only then reaches onPrep, once, with the progress; the dock stays inert for the guard", () => {
    const { onPrep, onBusyChange } = setup();
    const t0 = openPan();
    advance(3000);
    pressAt(t0, 3000);
    expect(grade()).toBe("best");
    expect(screen.getByTestId("cooking-prep-result")).toHaveTextContent("ちょうどいい！");
    expect(screen.queryByTestId("cooking-prep-choices")).toBeNull();
    expect(onPrep).not.toHaveBeenCalled();
    advance(PREP_DONE_MS - 1);
    expect(onPrep).not.toHaveBeenCalled();
    advance(1);
    expect(onPrep).toHaveBeenCalledTimes(1);
    expect(onPrep).toHaveBeenCalledWith("beef", 3000 / PAN_TOTAL_MS);
    expect(pan()).toBeNull();
    expect(screen.getByTestId("cooking-prep-guard")).toBeInTheDocument(); // AC-16 c
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    advance(PREP_GUARD_MS);
    expect(screen.queryByTestId("cooking-prep-guard")).toBeNull();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    advance(2000);
    expect(onPrep).toHaveBeenCalledTimes(1);
  });

  it("a second press after the first is ignored (one result, one dispatch)", () => {
    const { onPrep } = setup();
    const t0 = openPan();
    const button = take(); // the same element, still pressable by a second finger
    advance(3000);
    pressAt(t0, 3000, button);
    pressAt(t0, 3050, button);
    pressAt(t0, 5000, button);
    expect(grade()).toBe("best");
    advance(PREP_DONE_MS + 50);
    expect(onPrep).toHaveBeenCalledTimes(1);
  });

  it("early: nothing is dispatched until the player keeps it; 「これで使う」 reaches onPrep with that progress (after its short arm)", () => {
    const { onPrep } = setup();
    const t0 = openPan();
    advance(1000);
    pressAt(t0, 1000);
    expect(grade()).toBe("early");
    expect(screen.getByTestId("cooking-prep-result")).toHaveTextContent("まだ赤みが残ってる");
    expect(screen.getByTestId("cooking-prep-choices")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cooking-prep-use")); // too soon: the choices are not armed yet
    expect(onPrep).not.toHaveBeenCalled();
    advance(PAN_ARM_MS);
    fireEvent.click(screen.getByTestId("cooking-prep-use"));
    expect(onPrep).toHaveBeenCalledTimes(1);
    expect(onPrep).toHaveBeenCalledWith("beef", 1000 / PAN_TOTAL_MS);
    expect(screen.getByTestId("cooking-prep-guard")).toBeInTheDocument();
  });

  it("overdone: 「これで使う」 keeps the burnt look (progress at the press); the pan stays open until chosen, however long", () => {
    const { onPrep } = setup();
    const t0 = openPan();
    advance(5000);
    pressAt(t0, 5000);
    expect(grade()).toBe("overdone");
    expect(screen.getByTestId("cooking-prep-result")).toHaveTextContent("焦げちゃった");
    advance(30_000);
    expect(pan()).toBeInTheDocument();
    expect(onPrep).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("cooking-prep-use"));
    expect(onPrep).toHaveBeenCalledWith("beef", 5000 / PAN_TOTAL_MS);
  });

  it("「もう一度炒める」 starts a fresh run: running again, stage 0, nothing dispatched, the old press forgotten", () => {
    const { onPrep } = setup();
    const t0 = openPan();
    advance(1000);
    pressAt(t0, 1000);
    advance(PAN_ARM_MS);
    fireEvent.click(screen.getByTestId("cooking-prep-retry"));
    const root = screen.getByTestId("cooking-prep-pan");
    expect(root).toHaveAttribute("data-mode", "running");
    expect(root).toHaveAttribute("data-stage", "0");
    expect(root).not.toHaveAttribute("data-grade");
    expect(take()).toHaveAttribute("data-armed", "false");
    // the fresh run has its own clock: a press at +3000 of THIS run is best
    const t1 = performance.now();
    advance(3000);
    pressAt(t1, 3000);
    expect(grade()).toBe("best");
    expect(onPrep).not.toHaveBeenCalled();
  });

  it("× cancels at any moment: nothing is dispatched, the pill is back, and a pending result never fires", () => {
    const { onPrep } = setup();
    const t0 = openPan();
    advance(500);
    fireEvent.click(screen.getByTestId("cooking-prep-cancel")); // while running
    expect(pan()).toBeNull();
    expect(pill()).toBeInTheDocument();
    advance(PAN_TOTAL_MS + 1000);
    expect(onPrep).not.toHaveBeenCalled();
    const t2 = openPan();
    advance(1000);
    pressAt(t2, 1000);
    advance(PAN_ARM_MS);
    fireEvent.click(screen.getByTestId("cooking-prep-cancel")); // after an early result
    expect(pan()).toBeNull();
    advance(5000);
    expect(onPrep).not.toHaveBeenCalled();
    expect(t0).toBeDefined();
  });

  it("a step change / reset discards it without dispatching", () => {
    const { onPrep, rerender } = setup();
    openPan();
    advance(1000);
    rerender({ makingStepToken: 1 });
    expect(pan()).toBeNull();
    openPan();
    rerender({ resetToken: 1 });
    expect(pan()).toBeNull();
    advance(PAN_TOTAL_MS + 100);
    expect(onPrep).not.toHaveBeenCalled();
  });

  it("losing focus of the window discards it (AC-10): running, and during a result", () => {
    const { onPrep } = setup();
    openPan();
    fireEvent(window, new Event("blur"));
    expect(pan()).toBeNull();
    const t0 = openPan();
    advance(3000);
    pressAt(t0, 3000);
    fireEvent(window, new Event("blur"));
    advance(PREP_DONE_MS + 100);
    expect(pan()).toBeNull();
    expect(onPrep).not.toHaveBeenCalled();
  });

  it("the page being hidden discards it too", () => {
    const { onPrep } = setup();
    openPan();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    fireEvent(document, new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    expect(pan()).toBeNull();
    advance(PAN_TOTAL_MS + 100);
    expect(onPrep).not.toHaveBeenCalled();
  });

  it("keyboard: 「取り出す！」 is a focused button, Enter / Space (click detail 0) takes it, and the announcements name no time", () => {
    const { onPrep } = setup();
    openPan();
    expect(take().tagName).toBe("BUTTON");
    expect(take()).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("炒め中");
    advance(3000);
    fireEvent.click(take()); // detail 0 = keyboard
    expect(grade()).toBe("best");
    expect(screen.getByRole("status")).toHaveTextContent("ちょうどいい！");
    advance(PREP_DONE_MS);
    expect(onPrep).toHaveBeenCalledWith("beef", 3000 / PAN_TOTAL_MS);
  });

  it("a pointer click (detail > 0) does not take on its own: pointerdown is the only pointer path", () => {
    setup();
    openPan();
    advance(3000);
    fireEvent.click(take(), { detail: 1 });
    expect(grade()).toBeNull();
  });

  it("the beef gets visibly different colours at early / best / overdone (a three-way look)", () => {
    const looks: string[] = [];
    for (const at of [1000, 3000, 5500]) {
      cleanup();
      setup();
      const t0 = openPan();
      advance(at);
      pressAt(t0, at);
      looks.push(screen.getByTestId("cooking-prep-beef").getAttribute("style") ?? "");
    }
    expect(new Set(looks).size).toBe(3);
  });
});

describe("after it is prepped", () => {
  it("shows the mark, not the pill, and pressing it does nothing", () => {
    const { onPrep } = setup({ preparedIngredientIds: ["beef"] });
    const done = screen.getByTestId("cooking-prep-done");
    expect(done).toHaveTextContent("✓ 炒め済み");
    expect(screen.queryByTestId("cooking-prep-pill")).toBeNull();
    fireEvent.click(done);
    fireEvent.pointerDown(done);
    fireEvent.pointerUp(done);
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
    expect(onPrep).not.toHaveBeenCalled();
  });
});
