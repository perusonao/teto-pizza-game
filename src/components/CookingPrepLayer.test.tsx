import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CookingPrepLayer } from "./CookingPrepLayer";

/**
 * Cooking Prep Phase 1 PR-B S4: the pill / pan screen behaviour, with the experience gate OPEN. The OFF half is the first test (and the production
 * default is pinned by src/logic/prep/prepIngredient.flagOff.test.ts). Real timers: the whole flow takes about 1.5 s.
 */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../data/prepExperienceGate", () => ({ PREP_EXPERIENCE_PRODUCTION: false, prepExperienceEnabled: () => gate.open }));

const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
afterEach(() => {
  cleanup();
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
const surface = () => screen.getByTestId("cooking-prep-surface");
async function openPan() {
  fireEvent.click(pill()); // keyboard-style click (detail 0)
  await sleep(0);
}
async function toss(times: number) {
  for (let i = 0; i < times; i += 1) {
    fireEvent.pointerDown(surface());
    await sleep(140); // past the 120 ms debounce
  }
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
  it("three taps finish it; only the third reaches onPrep, once, and the dock stays inert for the guard", async () => {
    const { onPrep, onBusyChange } = setup();
    await openPan();
    expect(screen.getByTestId("cooking-prep-pan")).toHaveAttribute("data-tosses", "0");
    await toss(2);
    expect(screen.getByTestId("cooking-prep-pan")).toHaveAttribute("data-tosses", "2");
    expect(onPrep).not.toHaveBeenCalled();
    await toss(1);
    expect(screen.getByTestId("cooking-prep-pan")).toHaveAttribute("data-mode", "done");
    expect(onPrep).not.toHaveBeenCalled(); // the "ジュッ！" moment first
    await sleep(760);
    expect(onPrep).toHaveBeenCalledTimes(1);
    expect(onPrep).toHaveBeenCalledWith("beef");
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
    expect(screen.getByTestId("cooking-prep-guard")).toBeInTheDocument(); // input is swallowed right after it closes (AC-16 c)
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    await sleep(360);
    expect(screen.queryByTestId("cooking-prep-guard")).toBeNull();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(onPrep).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("taps closer than 120 ms count once", async () => {
    setup();
    await openPan();
    fireEvent.pointerDown(surface());
    fireEvent.pointerDown(surface());
    fireEvent.pointerDown(surface());
    expect(screen.getByTestId("cooking-prep-pan")).toHaveAttribute("data-tosses", "1");
  });

  it("there is no time limit and no failure: a slow player finishes the same way", async () => {
    const { onPrep } = setup();
    await openPan();
    fireEvent.pointerDown(surface());
    await sleep(900);
    expect(screen.getByTestId("cooking-prep-pan")).toHaveAttribute("data-tosses", "1");
    expect(onPrep).not.toHaveBeenCalled();
  });

  it("× cancels: nothing is dispatched and the pill is back", async () => {
    const { onPrep } = setup();
    await openPan();
    await toss(2);
    fireEvent.click(screen.getByTestId("cooking-prep-cancel"));
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
    expect(pill()).toBeInTheDocument();
    await sleep(900);
    expect(onPrep).not.toHaveBeenCalled();
  });

  it("a step change / reset discards it without dispatching", async () => {
    const { onPrep, rerender } = setup();
    await openPan();
    await toss(2);
    rerender({ makingStepToken: 1 });
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
    await openPan();
    rerender({ resetToken: 1 });
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
    await sleep(100);
    expect(onPrep).not.toHaveBeenCalled();
  });

  it("losing focus of the window discards it (AC-10), also during the 'done' moment", async () => {
    const { onPrep } = setup();
    await openPan();
    fireEvent(window, new Event("blur"));
    expect(screen.queryByTestId("cooking-prep-pan")).toBeNull();
    await openPan();
    await toss(3);
    fireEvent(window, new Event("blur"));
    await sleep(800);
    expect(onPrep).not.toHaveBeenCalled();
  }, 10_000);

  it("keyboard: Enter / Space (click detail 0) tosses; the surface is a labelled button and the count is announced", async () => {
    setup();
    await openPan();
    expect(surface().tagName).toBe("BUTTON");
    expect(surface()).toHaveAttribute("aria-label", expect.stringContaining("3回タップ"));
    expect(screen.getByRole("status")).toHaveTextContent("フライパンです。3回タップして炒めます");
    fireEvent.click(surface());
    expect(screen.getByRole("status")).toHaveTextContent("1 / 3");
    expect(screen.getByTestId("cooking-prep-pan").textContent).toContain("炒めよう");
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
