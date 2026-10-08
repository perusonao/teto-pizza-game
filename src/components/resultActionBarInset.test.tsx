import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useResultActionBarInset } from "./resultActionBarInset";

function Probe() {
  useResultActionBarInset();
  return (
    <div className="game-screen">
      <div className="result-panel__actions" />
    </div>
  );
}

describe("useResultActionBarInset (#423)", () => {
  it("publishes the bar's measured height on the scroller and releases it on unmount", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 122 } as DOMRect);
    const { container, unmount } = render(<Probe />);
    const scroller = container.querySelector<HTMLElement>(".game-screen")!;
    expect(scroller.dataset.resultBar).toBe("");
    expect(scroller.style.getPropertyValue("--result-bar-h")).toBe("122px");
    unmount();
    expect(scroller.dataset.resultBar).toBeUndefined();
    expect(scroller.style.getPropertyValue("--result-bar-h")).toBe("");
    vi.restoreAllMocks();
  });
});
