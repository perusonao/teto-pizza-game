import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEAR_FULL_MS, SEAR_MIN_HOLD_MS } from "../logic/sear/searHold";
import { SEAR_DONE_MS, SEAR_GUARD_MS } from "../logic/sear/searOffer";
import { SearLayer } from "./SearLayer";

/** Cooking Sear Phase 1 (#724): the pill / long-press sear screen, with the experience gate OPEN. Fake timers (performance.now is faked with them). */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../data/searExperienceGate", () => ({ SEAR_EXPERIENCE_PRODUCTION: false, searExperienceEnabled: () => gate.open }));

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  gate.open = true;
});

type Props = Parameters<typeof SearLayer>[0];
function setup(patch: Partial<Props> = {}) {
  const onSear = vi.fn();
  const onBusyChange = vi.fn();
  const props: Props = { phase: "PREPARE", makingStep: "TOPPING", roundKind: "GUIDED", active: true, selectedIngredientId: "sausage", ownedIngredientIds: ["sausage"], makingStepToken: 0, resetToken: 0, onSear, onBusyChange, ...patch };
  const view = render(<SearLayer {...props} />);
  return { onSear, onBusyChange, props, rerender: (next: Partial<Props>) => view.rerender(<SearLayer {...props} {...next} />), container: view.container };
}
const pill = () => screen.getByTestId("cooking-sear-pill");
const hold = () => screen.getByTestId("cooking-sear-hold");
const sear = () => screen.queryByTestId("cooking-sear");
const openScreen = () => fireEvent.click(pill()); // keyboard-style click, detail 0

/** A pointer event stamped on the faked clock (the stamp is what the game measures, not when the handler ran). */
function fire(type: "pointerdown" | "pointerup" | "pointercancel", at: number, target: HTMLElement = hold()) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "timeStamp", { value: at });
  act(() => void target.dispatchEvent(event));
}
const now = () => performance.now();
const food = () => screen.getByTestId("cooking-sear-food");
const heldFor = (ms: number) => {
  const start = now() + 1;
  fire("pointerdown", start);
  advance(ms);
  fire("pointerup", start + ms);
};

describe("flag OFF / not offered: nothing is rendered", () => {
  it("OFF renders nothing", () => {
    gate.open = false;
    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });
  it.each([
    ["another ingredient (beef is the prep's)", { selectedIngredientId: "beef", ownedIngredientIds: ["beef"] }],
    ["nothing selected", { selectedIngredientId: null }],
    ["not owned", { ownedIngredientIds: [] }],
    ["not TOPPING", { makingStep: "SAUCE" }],
    ["not PREPARE", { phase: "BAKE" }],
    ["Lunch Rush", { roundKind: "LUNCH_RUSH" as const }],
    ["Dinner", { roundKind: "DINNER" as const }],
    ["the stage is not taking input", { active: false }],
  ])("%s", (_name, patch) => {
    const { container } = setup(patch as Partial<Props>);
    expect(container).toBeEmptyDOMElement();
  });
  it("Guided and Free Cooking show the pill", () => {
    setup();
    expect(pill()).toHaveTextContent("炙る");
    cleanup();
    setup({ roundKind: "FREE_COOK" });
    expect(pill()).toBeInTheDocument();
  });
});

describe("the long press", () => {
  it("opens the sear screen from the pill; a press that is only released elsewhere does not", () => {
    setup();
    expect(sear()).toBeNull();
    openScreen();
    expect(sear()).not.toBeNull();
    expect(sear()).toHaveAttribute("data-mode", "idle");
  });

  it("while the finger is down the sausage browns; there is no gauge, number or timer anywhere", () => {
    setup();
    openScreen();
    const before = food().getAttribute("style");
    fire("pointerdown", now() + 1);
    expect(sear()).toHaveAttribute("data-mode", "holding");
    advance(SEAR_FULL_MS / 2);
    const mid = food().getAttribute("style");
    expect(mid).not.toBe(before);
    advance(SEAR_FULL_MS);
    const late = food().getAttribute("style");
    expect(late).not.toBe(mid);
    const root = sear()!;
    expect(root.querySelector("progress, meter, [role=progressbar], [role=timer]")).toBeNull();
    expect(root.textContent).not.toMatch(/\d/);
  });

  it("letting go keeps what the hold reached: ONE onSear with that amount, then the words, then it closes with the pill replaced by the done mark", () => {
    const { onSear, rerender } = setup();
    openScreen();
    heldFor(SEAR_FULL_MS / 2); // amount 0.5
    expect(onSear).toHaveBeenCalledTimes(1);
    expect(onSear).toHaveBeenCalledWith("sausage", 0.5);
    expect(screen.getByTestId("cooking-sear-title")).toHaveTextContent("こんがり焼き目");
    expect(sear()).toHaveAttribute("data-mode", "done");
    advance(SEAR_DONE_MS + 1);
    expect(sear()).toBeNull();
    expect(screen.getByTestId("cooking-sear-guard")).toBeInTheDocument();
    advance(SEAR_GUARD_MS + 1);
    expect(screen.queryByTestId("cooking-sear-guard")).toBeNull();
    // the parent now reports it as seared
    rerender({ searedLook: { sausage: 0.5 } });
    expect(screen.getByTestId("cooking-sear-done")).toHaveTextContent("炙り済み");
    expect(screen.queryByTestId("cooking-sear-pill")).toBeNull();
  });

  it("a tap shorter than the minimum keeps nothing and says to keep pressing", () => {
    const { onSear } = setup();
    openScreen();
    const start = now() + 1;
    fire("pointerdown", start);
    fire("pointerup", start + SEAR_MIN_HOLD_MS - 1);
    advance(SEAR_DONE_MS * 2);
    expect(onSear).not.toHaveBeenCalled();
    expect(sear()).toHaveAttribute("data-mode", "idle");
    expect(screen.getByTestId("cooking-sear-title")).toHaveTextContent("もう少し押し続けてね");
  });

  it("there is no failure: a very long hold is simply the fully seared look", () => {
    const { onSear } = setup();
    openScreen();
    heldFor(SEAR_FULL_MS * 4);
    expect(onSear).toHaveBeenCalledWith("sausage", 1);
    expect(screen.getByTestId("cooking-sear-title")).toHaveTextContent("まっくろ焦げ目");
  });

  it("the system taking the finger away (pointercancel) keeps nothing, and the screen stays so the player can try again", () => {
    const { onSear } = setup();
    openScreen();
    fire("pointerdown", now() + 1);
    advance(2000);
    fire("pointercancel", now());
    advance(SEAR_DONE_MS * 2);
    expect(onSear).not.toHaveBeenCalled();
    expect(sear()).toHaveAttribute("data-mode", "idle");
    heldFor(1000);
    expect(onSear).toHaveBeenCalledTimes(1);
  });

  it("× closes without keeping anything, also in the middle of a hold", () => {
    const { onSear } = setup();
    openScreen();
    fire("pointerdown", now() + 1);
    advance(1500);
    fireEvent.click(screen.getByTestId("cooking-sear-cancel"));
    expect(sear()).toBeNull();
    advance(SEAR_DONE_MS * 2);
    expect(onSear).not.toHaveBeenCalled();
    expect(screen.getByTestId("cooking-sear-pill")).toBeInTheDocument();
  });

  it("leaving the page (blur) mid-hold discards it", () => {
    const { onSear } = setup();
    openScreen();
    fire("pointerdown", now() + 1);
    advance(1500);
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(sear()).toBeNull();
    expect(onSear).not.toHaveBeenCalled();
  });

  it("a step change / reset remounts the layer and discards an open screen", () => {
    const { onSear, rerender } = setup();
    openScreen();
    fire("pointerdown", now() + 1);
    rerender({ resetToken: 1 });
    expect(sear()).toBeNull();
    expect(onSear).not.toHaveBeenCalled();
  });

  it("keyboard: Enter / Space held = a hold (repeats ignored)", () => {
    const { onSear } = setup();
    openScreen();
    const b = hold();
    fireEvent.keyDown(b, { key: " " });
    fireEvent.keyDown(b, { key: " ", repeat: true });
    advance(2000);
    fireEvent.keyUp(b, { key: " " });
    expect(onSear).toHaveBeenCalledTimes(1);
    const amount = onSear.mock.calls[0][1] as number;
    expect(amount).toBeGreaterThan(0.3);
    expect(amount).toBeLessThanOrEqual(1);
  });

  it("the dock is reported busy while the screen (and the short guard) is up, and released after", () => {
    const { onBusyChange } = setup();
    openScreen();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    heldFor(1000);
    advance(SEAR_DONE_MS + SEAR_GUARD_MS + 5);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("the hold button never asks for a click: a click with a pointer (detail > 0) does nothing", () => {
    const { onSear } = setup();
    openScreen();
    fireEvent.click(hold(), { detail: 1 });
    advance(SEAR_DONE_MS * 2);
    expect(onSear).not.toHaveBeenCalled();
  });
});
