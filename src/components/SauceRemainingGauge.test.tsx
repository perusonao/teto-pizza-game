import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SauceRemainingGauge } from "./SauceRemainingGauge";

afterEach(cleanup);

describe("SauceRemainingGauge (#489)", () => {
  it("is a meter reporting the remaining percentage, with no visible text", () => {
    const { container } = render(<SauceRemainingGauge committedTotal={0.3} pendingTotal={0.2} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "50");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(container.textContent).toBe("");
  });
  it("is full at 100 and empty at 0 (clamped)", () => {
    const { rerender } = render(<SauceRemainingGauge committedTotal={0} pendingTotal={0} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
    rerender(<SauceRemainingGauge committedTotal={0.9} pendingTotal={0.9} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("meter")).toHaveAttribute("data-empty", "true");
  });

  it("takes the selected sauce's colour, and keeps the stage-1 red when none is given", () => {
    const { container, rerender } = render(<SauceRemainingGauge committedTotal={0.2} pendingTotal={0} color="#6b8e3d" />);
    expect(container.querySelector<HTMLElement>(".sauce-remaining-gauge")!.style.getPropertyValue("--sauce-gauge-color")).toBe("#6b8e3d");
    rerender(<SauceRemainingGauge committedTotal={0.2} pendingTotal={0} />);
    expect(container.querySelector<HTMLElement>(".sauce-remaining-gauge")!.style.getPropertyValue("--sauce-gauge-color")).toBe("");
  });

  it("an empty sauce and the pizza-wide limit look different: only the limit has the hatch and data-limit", () => {
    const { container, rerender } = render(<SauceRemainingGauge committedTotal={1} pendingTotal={0} />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-empty", "true");
    expect(screen.getByRole("meter")).not.toHaveAttribute("data-limit");
    expect(container.querySelector(".sauce-remaining-gauge__cap")).toBeNull();
    rerender(<SauceRemainingGauge committedTotal={1} pendingTotal={0} capBlocked={0.6} />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-limit", "total");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "ピザ全体の上限に達しました");
    expect(container.querySelector<HTMLElement>(".sauce-remaining-gauge__cap")!.style.height).toBe("60%");
    expect(container.textContent).toBe("");
  });

  it("a partly usable sauce with the cap in the way shows both the fill and the hatch", () => {
    const { container } = render(<SauceRemainingGauge committedTotal={0.8} pendingTotal={0} capBlocked={0.1} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "20");
    expect(container.querySelector<HTMLElement>(".sauce-remaining-gauge__fill")!.style.height).toBe("20%");
    expect(container.querySelector<HTMLElement>(".sauce-remaining-gauge__cap")!.style.height).toBe("10%");
  });
});
