import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MidBakeLab } from "./MidBakeLab";

/** requestAnimationFrame driven by hand so the test controls the clock. */
let callbacks: FrameRequestCallback[] = [];
let clockMs = 0;
function advance(ms: number) {
  const step = 50;
  for (let t = 0; t < ms; t += step) {
    clockMs += step;
    const batch = callbacks;
    callbacks = [];
    act(() => batch.forEach((cb) => cb(clockMs)));
  }
}

beforeEach(() => {
  callbacks = [];
  clockMs = 1000;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => callbacks.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const status = () => screen.getByTestId("lab-status").getAttribute("data-lab-status");

describe("<MidBakeLab />", () => {
  it("holds at the window start, takes two taps, resumes and succeeds", () => {
    render(<MidBakeLab search="?dev=midbake" />);
    expect(screen.getByTestId("lab-chip-natto")).toBeDisabled();
    advance(2200);
    expect(status()).toBe("holding");
    const chip = screen.getByTestId("lab-chip-natto");
    expect(chip).toBeEnabled();
    fireEvent.click(chip);
    fireEvent.click(screen.getByTestId("lab-chip-natto"));
    expect(screen.getByTestId("lab-chip-natto")).toBeDisabled();
    advance(2500);
    expect(screen.getByTestId("lab-result")).toHaveAttribute("data-lab-completion", "complete");
    expect(screen.getByTestId("lab-log").textContent).toContain("accepted=2");
  });

  it("'とじる' ends the hold early and the bake reports a miss", () => {
    render(<MidBakeLab search="?dev=midbake" />);
    advance(2200);
    fireEvent.click(screen.getByTestId("lab-chip-natto"));
    fireEvent.click(screen.getByTestId("lab-close"));
    advance(2500);
    expect(screen.getByTestId("lab-result")).toHaveAttribute("data-lab-completion", "missing-additions");
  });

  it("the alternative control adds through the same path and is labelled in the log", () => {
    render(<MidBakeLab search="?dev=midbake" />);
    advance(2200);
    fireEvent.click(screen.getByTestId("lab-alt-natto"));
    expect(screen.getByTestId("lab-chip-natto").textContent).toContain("1/2");
    expect(screen.getByTestId("lab-log").textContent).toContain("alternative 1");
  });

  it("does not advance while the page is not focused, and the hold timeout does not run in the background", () => {
    render(<MidBakeLab search="?dev=midbake&hold=1000" />);
    advance(2200);
    expect(status()).toBe("holding");
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    advance(5000);
    expect(status()).toBe("holding");
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    advance(200);
    expect(status()).toBe("holding"); // a fresh interval starts on return; the timeout (1 s) has not elapsed
  });

  it("rAF stopped while hidden: the absence is never fed to the clock (a nearly spent hold timeout is not eaten on return)", () => {
    render(<MidBakeLab search="?dev=midbake&hold=500" />);
    advance(2200);
    advance(200); // ~450 ms of the 500 ms hold is spent: less than one capped frame (100 ms) remains
    expect(status()).toBe("holding");
    // Hidden: the browser runs no frames at all, and the page announces it.
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    clockMs += 60_000; // a long absence, no frame executed
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    advance(50); // first frame back: sets the new base only; without the reset it would add a capped 100 ms and end the hold
    expect(status()).toBe("holding");
    expect(screen.getByTestId("lab-chip-natto")).toBeEnabled();
  });

  it("'もう一度' starts a brand-new session", () => {
    render(<MidBakeLab search="?dev=midbake&hold=500" />);
    advance(5000);
    fireEvent.click(screen.getByTestId("lab-restart"));
    expect(screen.getByTestId("lab-chip-natto").textContent).toContain("0/2");
    expect(status()).toBe("running");
  });
});
