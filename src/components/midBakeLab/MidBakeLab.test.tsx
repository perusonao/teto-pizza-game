import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MID_BAKE_LAB_LABEL, MID_BAKE_LAB_MARK } from "../../preview/midBakeLab";
import { MidBakeLab, type LabTiming } from "./MidBakeLab";

afterEach(cleanup);

/** A manual frame source: `step(ms)` moves the clock and runs the frame callback registered so far. */
function manualTiming() {
  let time = 0;
  let nextHandle = 1;
  const pending = new Map<number, () => void>();
  const cancelled: number[] = [];
  const timing: LabTiming = {
    now: () => time,
    requestFrame: (callback) => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => {
      cancelled.push(handle);
      pending.delete(handle);
    },
  };
  const step = (ms: number, count = 1) => {
    for (let i = 0; i < count; i += 1) {
      time += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => callbacks.forEach((callback) => callback()));
    }
  };
  return { timing, step, cancelled };
}

const lab = () => screen.getByTestId("mb-lab");
const click = (id: string) => act(() => void fireEvent.click(screen.getByTestId(id)));

describe("MidBakeLab (stage C-2)", () => {
  it("shows the label, the mark and a ready screen where nothing can be added yet", () => {
    const { timing } = manualTiming();
    render(<MidBakeLab timing={timing} config={{ stock: 3 }} />);
    expect(screen.getByRole("note").textContent).toBe(MID_BAKE_LAB_LABEL);
    expect(lab().getAttribute("data-mark")).toBe(MID_BAKE_LAB_MARK);
    expect(lab().getAttribute("data-phase")).toBe("ready");
    expect((screen.getByTestId("mb-chip-natto") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("mb-close") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("mb-count").textContent).toBe("3");
    expect(screen.queryByTestId("mb-result")).toBeNull();
  });

  it("holds the needle at the window start, takes two taps, resumes by itself and ends with the result", () => {
    const { timing, step } = manualTiming();
    render(<MidBakeLab timing={timing} config={{ stock: 3 }} />);
    click("mb-start");
    step(100, 19);
    expect(lab().getAttribute("data-clock")).toBe("running");
    expect(Number(screen.getByTestId("mb-needle").getAttribute("data-position"))).toBeCloseTo(63.3, 1);
    step(100);
    expect(lab().getAttribute("data-clock")).toBe("holding");
    expect(screen.getByTestId("mb-status").getAttribute("data-hold")).toBe("1");
    expect(screen.getByTestId("mb-needle").getAttribute("data-position")).toBe("65.0");
    step(100, 5); // the needle stays put while holding
    expect(screen.getByTestId("mb-needle").getAttribute("data-position")).toBe("65.0");
    expect((screen.getByTestId("mb-chip-natto") as HTMLButtonElement).disabled).toBe(false);
    click("mb-chip-natto");
    expect(screen.getAllByTestId("mb-piece")).toHaveLength(1);
    expect(screen.getByTestId("mb-count").textContent).toBe("2");
    click("mb-chip-natto");
    expect(screen.getAllByTestId("mb-piece")).toHaveLength(2);
    expect(lab().getAttribute("data-clock")).toBe("running");
    step(100, 2);
    click("mb-takeout");
    const result = screen.getByTestId("mb-result");
    expect(result.getAttribute("data-completion")).toBe("complete");
    expect(result.getAttribute("data-bake")).toBe("perfect");
    expect(lab().getAttribute("data-phase")).toBe("finished");
  });

  it("blocks the take-out while holding and keeps the round going", () => {
    const { timing, step } = manualTiming();
    render(<MidBakeLab timing={timing} />);
    click("mb-start");
    step(100, 20);
    click("mb-takeout");
    expect(lab().getAttribute("data-phase")).toBe("baking");
    expect(screen.getByTestId("mb-log").textContent).toContain("止まっている間は取り出せない");
    expect(screen.getByTestId("mb-takeout").getAttribute("aria-disabled")).toBe("true");
  });

  it("the close button resumes the bake and a miss ends as 追加不足", () => {
    const { timing, step } = manualTiming();
    render(<MidBakeLab timing={timing} />);
    click("mb-start");
    step(100, 20);
    click("mb-close");
    expect(lab().getAttribute("data-clock")).toBe("running");
    step(100, 12);
    expect(screen.getByTestId("mb-result").getAttribute("data-completion")).toBe("missing-additions");
  });

  it("the alternative control (collapsed by default) adds through the same path", () => {
    const { timing, step } = manualTiming();
    render(<MidBakeLab timing={timing} />);
    expect(document.querySelector("details")?.hasAttribute("open")).toBe(false);
    click("mb-start");
    step(100, 20);
    click("mb-alt-add");
    expect(screen.getAllByTestId("mb-piece").map((piece) => piece.getAttribute("data-input"))).toEqual(["alternative"]);
  });

  it("the restart button gives a fresh round and the stage frame loop is cancelled when it unmounts", () => {
    const { timing, step, cancelled } = manualTiming();
    const view = render(<MidBakeLab timing={timing} />);
    click("mb-start");
    step(100, 20);
    click("mb-chip-natto");
    click("mb-restart");
    expect(lab().getAttribute("data-phase")).toBe("ready");
    expect(screen.queryAllByTestId("mb-piece")).toHaveLength(0);
    click("mb-start");
    view.unmount();
    expect(cancelled.length).toBeGreaterThan(0);
  });

  it("does not count time while the page is hidden", () => {
    const { timing, step } = manualTiming();
    render(<MidBakeLab timing={timing} />);
    click("mb-start");
    step(100, 3);
    const before = screen.getByTestId("mb-needle").getAttribute("data-position");
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    step(100, 10);
    expect(screen.getByTestId("mb-needle").getAttribute("data-position")).toBe(before);
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    step(100);
    expect(screen.getByTestId("mb-needle").getAttribute("data-position")).not.toBe(before);
  });
});
