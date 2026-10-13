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
});
