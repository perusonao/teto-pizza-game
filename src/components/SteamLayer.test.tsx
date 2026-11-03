import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STEAM_LID_FULL_MS, STEAM_LID_MIN_MS } from "../logic/steam/steamLid";
import { STEAM_SHELL_COUNT } from "../logic/steam/steamPot";
import { STEAM_DONE_MS, STEAM_GUARD_MS } from "../logic/steam/steamScreen";
import { STEAM_PER_TAP, STEAM_SHAKE_MIN_MS } from "../logic/steam/steamShake";
import { resetSteamPreviewForTest } from "../preview/steamPreview";
import { SteamLayer } from "./SteamLayer";

/** Cooking Steam Phase 1 (#726, S3a): the pill / steam screen, with the experience gate OPEN. Fake timers (performance.now is faked with them). */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../data/steamExperienceGate", () => ({ STEAM_EXPERIENCE_PRODUCTION: false, steamExperienceEnabled: () => gate.open }));

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const now = () => performance.now();
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  gate.open = true;
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  resetSteamPreviewForTest();
});

type Props = Parameters<typeof SteamLayer>[0];
function setup(patch: Partial<Props> = {}, query = "") {
  window.history.replaceState(null, "", `/${query}`);
  resetSteamPreviewForTest();
  const onSteam = vi.fn();
  const onBusyChange = vi.fn();
  const props: Props = { phase: "PREPARE", makingStep: "TOPPING", roundKind: "GUIDED", active: true, selectedIngredientId: "clam", ownedIngredientIds: ["clam", "mussel"], makingStepToken: 0, resetToken: 0, onSteam, onBusyChange, ...patch };
  const view = render(<SteamLayer {...props} />);
  return { onSteam, onBusyChange, props, rerender: (next: Partial<Props>) => view.rerender(<SteamLayer {...props} {...next} />), container: view.container };
}
const pill = () => screen.getByTestId("cooking-steam-pill");
const steam = () => screen.queryByTestId("cooking-steam");
const openScreen = () => fireEvent.click(pill()); // keyboard-style click, detail 0
const pot = () => screen.getByTestId("cooking-steam-pot");
const title = () => screen.getByTestId("cooking-steam-title").textContent;
const openCount = () => Number(steam()!.getAttribute("data-open-count"));

/** An event stamped on the faked clock (the stamp is what the game measures, not when the handler ran). */
function stamped(type: string, at: number, target: HTMLElement, init: MouseEventInit & { key?: string } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "timeStamp", { value: at });
  act(() => void target.dispatchEvent(event));
}
const tapOn = (el: HTMLElement) => stamped("click", now(), el, { detail: 1 });
/** The pot's box, so a drag has a width to be measured against (jsdom lays nothing out). */
function sizePot(width = 200) {
  pot().getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: 150, width, height: 150, x: 0, y: 0, toJSON: () => ({}) });
}
function drag(xs: number[]) {
  sizePot();
  stamped("pointerdown", now(), pot(), { buttons: 1, clientX: xs[0] });
  for (const x of xs) {
    advance(40);
    stamped("pointermove", now(), pot(), { buttons: 1, clientX: x });
  }
}

describe("flag OFF / not offered: nothing is rendered", () => {
  it("OFF renders nothing", () => {
    gate.open = false;
    expect(setup().container).toBeEmptyDOMElement();
  });
  it.each([
    ["another ingredient (sausage is the sear's, beef the prep's)", { selectedIngredientId: "sausage", ownedIngredientIds: ["sausage"] }],
    ["nothing selected", { selectedIngredientId: null }],
    ["not owned", { ownedIngredientIds: [] }],
    ["not TOPPING", { makingStep: "SAUCE" }],
    ["not PREPARE", { phase: "BAKE" }],
    ["Lunch Rush", { roundKind: "LUNCH_RUSH" as const }],
    ["Dinner", { roundKind: "DINNER" as const }],
    ["the stage is not taking input", { active: false }],
  ])("%s", (_name, patch) => {
    expect(setup(patch as Partial<Props>).container).toBeEmptyDOMElement();
  });
  it("Guided and Free Cooking show the pill for clam and for mussel", () => {
    setup();
    expect(pill()).toHaveTextContent("蒸す");
    cleanup();
    setup({ roundKind: "FREE_COOK", selectedIngredientId: "mussel" });
    expect(pill()).toBeInTheDocument();
  });
  it("an already steamed ingredient shows the done mark instead of the pill", () => {
    setup({ steamedLook: { clam: 0.5 } });
    expect(screen.queryByTestId("cooking-steam-pill")).toBeNull();
    expect(screen.getByTestId("cooking-steam-done")).toHaveTextContent("蒸し済み");
  });
});

describe("opening the screen", () => {
  it("opens from the pill (keyboard click); a press released elsewhere does not", () => {
    setup();
    expect(steam()).toBeNull();
    stamped("pointerdown", now(), pill());
    stamped("pointerup", now(), pill(), { clientX: 9999, clientY: 9999 }); // released far off the pill
    expect(steam()).toBeNull();
    openScreen();
    expect(steam()).toHaveAttribute("data-mode", "idle");
    expect(steam()).toHaveAttribute("data-ingredient", "clam");
  });
  it("both operations are offered by default (the Preview / DEV comparison), starting on the lid; the query narrows it", () => {
    setup();
    openScreen();
    expect(steam()).toHaveAttribute("data-variant", "lid");
    expect(screen.getByTestId("cooking-steam-variant-lid")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("cooking-steam-variant-shake")).toHaveAttribute("aria-pressed", "false");
    cleanup();
    setup({}, "?cookSteam=on&cookSteamVariant=shake");
    openScreen();
    expect(steam()).toHaveAttribute("data-variant", "shake");
    expect(screen.queryByTestId("cooking-steam-variant-lid")).toBeNull();
    cleanup();
    setup({}, "?cookSteamVariant=lid");
    openScreen();
    expect(steam()).toHaveAttribute("data-variant", "lid");
    expect(screen.queryByTestId("cooking-steam-variant-shake")).toBeNull();
  });
  it("× closes it and keeps nothing", () => {
    const { onSteam } = setup();
    openScreen();
    fireEvent.click(screen.getByTestId("cooking-steam-cancel"));
    expect(steam()).toBeNull();
    expect(onSteam).not.toHaveBeenCalled();
  });
  it("a new step / a discarded pizza / another ingredient discards an open screen without dispatching anything", () => {
    const { onSteam, rerender } = setup();
    openScreen();
    rerender({ makingStepToken: 1 });
    expect(steam()).toBeNull();
    openScreen();
    rerender({ resetToken: 1 });
    expect(steam()).toBeNull();
    openScreen();
    rerender({ selectedIngredientId: "mussel" });
    expect(steam()).toBeNull();
    expect(onSteam).not.toHaveBeenCalled();
  });
  it("the page losing focus / being hidden mid-steam discards it", () => {
    const { onSteam } = setup();
    openScreen();
    fireEvent.click(screen.getByTestId("cooking-steam-lid-button"));
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(steam()).toBeNull();
    expect(onSteam).not.toHaveBeenCalled();
  });
  it("mussel uses its own colours but the same screen", () => {
    setup({ selectedIngredientId: "mussel" });
    openScreen();
    expect(steam()).toHaveAttribute("data-ingredient", "mussel");
    expect(screen.getAllByTestId(/^cooking-steam-shell-/)).toHaveLength(STEAM_SHELL_COUNT);
  });
});

describe("operation A: put the lid on, wait, lift it", () => {
  const lidButton = () => screen.getByTestId("cooking-steam-lid-button");

  it("the shells open one by one as the steam builds; there is no gauge, number or timer", () => {
    setup();
    openScreen();
    expect(lidButton()).toHaveTextContent("ふたをする");
    tapOn(lidButton());
    expect(steam()).toHaveAttribute("data-mode", "steaming");
    expect(screen.getByTestId("cooking-steam-pot")).toHaveAttribute("data-lid", "on");
    expect(lidButton()).toHaveTextContent("ふたを開ける");
    expect(openCount()).toBe(0);
    advance(STEAM_LID_FULL_MS / 2);
    expect(openCount()).toBe(2);
    expect(screen.getByTestId("cooking-steam-shell-0")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("cooking-steam-shell-2")).toHaveAttribute("data-open", "false");
    advance(STEAM_LID_FULL_MS);
    expect(openCount()).toBe(STEAM_SHELL_COUNT);
    const root = steam()!;
    expect(root.querySelector("progress, meter, [role=progressbar], [role=timer]")).toBeNull();
    expect(root.textContent).not.toMatch(/\d/);
  });

  it("lifting the lid keeps what the shells reached: ONE onSteam, then the words, then it closes with the guard and the done mark", () => {
    const { onSteam, onBusyChange, rerender } = setup();
    openScreen();
    tapOn(lidButton());
    advance(STEAM_LID_FULL_MS / 2); // level 0.5
    tapOn(lidButton());
    expect(onSteam).toHaveBeenCalledTimes(1);
    expect(onSteam).toHaveBeenCalledWith("clam", 0.5);
    expect(steam()).toHaveAttribute("data-mode", "done");
    expect(title()).toBe("ちょっと開いた");
    advance(STEAM_DONE_MS - 1);
    expect(steam()).not.toBeNull();
    advance(1);
    expect(steam()).toBeNull();
    expect(screen.getByTestId("cooking-steam-guard")).toBeInTheDocument();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    advance(STEAM_GUARD_MS);
    expect(screen.queryByTestId("cooking-steam-guard")).toBeNull();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(onSteam).toHaveBeenCalledTimes(1);
    rerender({ steamedLook: { clam: 0.5 } });
    expect(screen.getByTestId("cooking-steam-done")).toBeInTheDocument();
  });

  it("a lift that comes too early keeps nothing and asks for a little longer", () => {
    const { onSteam } = setup();
    openScreen();
    tapOn(lidButton());
    advance(STEAM_LID_MIN_MS - 1);
    tapOn(lidButton());
    expect(onSteam).not.toHaveBeenCalled();
    expect(steam()).toHaveAttribute("data-mode", "idle");
    expect(title()).toBe("もう少し蒸してね");
    expect(lidButton()).toHaveTextContent("ふたをする");
  });

  it("a full pot held for a long while reads 'over' -- still a kept result, never a failure", () => {
    const { onSteam } = setup();
    openScreen();
    tapOn(lidButton());
    advance(STEAM_LID_FULL_MS + 4000);
    tapOn(lidButton());
    expect(onSteam).toHaveBeenCalledWith("clam", 1);
    expect(steam()).toHaveAttribute("data-look", "over");
  });

  it("?cookSteamMs= moves the curve and shows which setting this page is on (comparison only)", () => {
    const { onSteam } = setup({}, "?cookSteam=on&cookSteamMs=3000");
    openScreen();
    expect(steam()).toHaveAttribute("data-full-ms", "3000");
    expect(screen.getByTestId("cooking-steam-tune")).toBeInTheDocument();
    tapOn(lidButton());
    advance(3000);
    tapOn(lidButton());
    expect(onSteam.mock.calls[0][1]).toBeCloseTo(0.95, 5);
  });
  it("without the query nothing about the setting is shown", () => {
    setup();
    openScreen();
    expect(screen.queryByTestId("cooking-steam-tune")).toBeNull();
  });
});

describe("operation B: shake the pot", () => {
  const query = "?cookSteam=on&cookSteamVariant=shake";
  const openButton = () => screen.getByTestId("cooking-steam-open");
  const shakeButton = () => screen.getByTestId("cooking-steam-shake");

  it("lifting the lid is not possible before any steam, and there is no lid drawn", () => {
    setup({}, query);
    openScreen();
    expect(openButton()).toBeDisabled();
    expect(screen.queryByTestId("cooking-steam-lid")).toBeNull();
  });

  it("dragging across the pot builds steam: shells open; stopping lets it fade", () => {
    setup({}, query);
    openScreen();
    drag([0, 100, 0, 100, 0, 100, 0, 100, 0, 100, 0, 100, 0, 100]); // sweeps
    expect(steam()).toHaveAttribute("data-mode", "steaming");
    expect(openCount()).toBeGreaterThanOrEqual(2);
    expect(openButton()).toBeEnabled();
    const reached = openCount();
    advance(8000);
    expect(openCount()).toBeLessThan(reached);
  });

  it("the tap alternative alone can open every shell and keep it", () => {
    const { onSteam } = setup({}, query);
    openScreen();
    for (let i = 0; i < 8; i += 1) {
      tapOn(shakeButton());
      advance(50);
    }
    expect(openCount()).toBe(STEAM_SHELL_COUNT);
    advance(STEAM_SHAKE_MIN_MS);
    tapOn(openButton());
    expect(onSteam).toHaveBeenCalledTimes(1);
    expect(onSteam.mock.calls[0][0]).toBe("clam");
    expect(onSteam.mock.calls[0][1]).toBeGreaterThan(0.4);
    expect(steam()).toHaveAttribute("data-mode", "done");
  });

  it("the arrow keys are the two directions of a sweep (keyboard shake)", () => {
    setup({}, query);
    openScreen();
    sizePot();
    expect(openCount()).toBe(0);
    for (let i = 0; i < 14; i += 1) {
      fireEvent.keyDown(pot(), { key: i % 2 === 0 ? "ArrowRight" : "ArrowLeft" });
      advance(40);
    }
    expect(steam()).toHaveAttribute("data-mode", "steaming");
    expect(openCount()).toBeGreaterThanOrEqual(2);
    // other keys do nothing
    cleanup();
    setup({}, query);
    openScreen();
    sizePot();
    for (const key of ["a", "Enter", "ArrowUp", "ArrowDown"]) fireEvent.keyDown(pot(), { key });
    expect(steam()).toHaveAttribute("data-mode", "idle");
  });

  it("a lift that comes too early keeps nothing", () => {
    const { onSteam } = setup({}, query);
    openScreen();
    tapOn(shakeButton());
    advance(STEAM_SHAKE_MIN_MS - 100);
    tapOn(openButton());
    expect(onSteam).not.toHaveBeenCalled();
    expect(title()).toBe("もう少し蒸してね");
  });

  it("one tap adds the documented amount and nothing else is shown as a number", () => {
    setup({}, query);
    openScreen();
    tapOn(shakeButton());
    expect(STEAM_PER_TAP).toBe(0.1);
    expect(steam()!.textContent).not.toMatch(/\d/);
  });
});

describe("switching between the two operations (both offered)", () => {
  it("a switch while idle changes the screen; a half-way steam is discarded; the switch is locked while steaming", () => {
    const { onSteam } = setup();
    openScreen();
    fireEvent.click(screen.getByTestId("cooking-steam-variant-shake"));
    expect(steam()).toHaveAttribute("data-variant", "shake");
    tapOn(screen.getByTestId("cooking-steam-shake"));
    expect(steam()).toHaveAttribute("data-mode", "steaming");
    expect(screen.getByTestId("cooking-steam-variant-lid")).toBeDisabled();
    fireEvent.click(screen.getByTestId("cooking-steam-cancel"));
    expect(onSteam).not.toHaveBeenCalled();
    openScreen();
    fireEvent.click(screen.getByTestId("cooking-steam-variant-lid"));
    expect(steam()).toHaveAttribute("data-variant", "lid");
    expect(steam()).toHaveAttribute("data-mode", "idle");
  });
});

describe("accessibility and the stage", () => {
  it("announces in a polite status region, with the words and no digits", () => {
    setup();
    openScreen();
    const region = steam()!.querySelector('[role="status"]')!;
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region.textContent).not.toMatch(/\d/);
  });
  it("reports the dock-inert busy state while the screen is up and clears it when it goes", () => {
    const { onBusyChange } = setup();
    openScreen();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByTestId("cooking-steam-cancel"));
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it("never reads or writes the sear / prep treatments' test ids", () => {
    setup();
    openScreen();
    expect(screen.queryByTestId("cooking-sear")).toBeNull();
    expect(screen.queryByTestId("cooking-sear-pill")).toBeNull();
  });
});
