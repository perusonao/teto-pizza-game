import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DOUGH_CHIP_OTHER_JA, DOUGH_CHIP_PLAIN_JA, DoughKindSwitch } from "./DoughKindSwitch";

afterEach(cleanup);
const PINSA = "material-multigrain-long-ferment";

describe("DoughKindSwitch (Dough Kind P2, #577)", () => {
  it("a radiogroup of two radios whose visible text and aria-label are the same string (undiscovered: 「ふつうの生地」「ほかの生地」)", () => {
    render(<DoughKindSwitch selected="standard" otherLabel={DOUGH_CHIP_OTHER_JA} onSelect={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "生地の種類" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["ふつうの生地", "ほかの生地"]);
    expect(radios.map((r) => r.textContent)).toEqual(["ふつうの生地", "ほかの生地"]);
    expect(DOUGH_CHIP_PLAIN_JA).toBe("ふつうの生地");
  });

  it("marks only the selected radio, and selecting never changes the text (the name is shown by discovery, not by choosing)", () => {
    const { rerender } = render(<DoughKindSwitch selected="standard" otherLabel={DOUGH_CHIP_OTHER_JA} onSelect={() => {}} />);
    expect(screen.getByRole("radio", { name: "ふつうの生地" })).toHaveAttribute("aria-checked", "true");
    rerender(<DoughKindSwitch selected={PINSA} otherLabel={DOUGH_CHIP_OTHER_JA} onSelect={() => {}} />);
    expect(screen.getByRole("radio", { name: "ほかの生地" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "ふつうの生地" })).toHaveAttribute("aria-checked", "false");
    expect(document.body.textContent).not.toContain("ピンサ");
  });

  it("once the technique is discovered the second chip carries its name in text and aria-label, selected or not", () => {
    for (const selected of ["standard", PINSA] as const) {
      const { unmount } = render(<DoughKindSwitch selected={selected} otherLabel="ピンサ生地" onSelect={() => {}} />);
      const other = screen.getByRole("radio", { name: "ピンサ生地" });
      expect(other).toHaveTextContent("ピンサ生地");
      unmount();
    }
  });

  it("reports the chosen kind on click", () => {
    const onSelect = vi.fn();
    render(<DoughKindSwitch selected="standard" otherLabel={DOUGH_CHIP_OTHER_JA} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("radio", { name: "ほかの生地" }));
    expect(onSelect).toHaveBeenLastCalledWith(PINSA);
    fireEvent.click(screen.getByRole("radio", { name: "ふつうの生地" }));
    expect(onSelect).toHaveBeenLastCalledWith("standard");
  });

  it("renders neither the dough-kind value, the technique id, nor any Pinsa word in any attribute (R6, PK-18)", () => {
    for (const label of [DOUGH_CHIP_OTHER_JA]) {
      const { container, unmount } = render(<DoughKindSwitch selected={PINSA} otherLabel={label} onSelect={() => {}} />);
      expect(container.innerHTML).not.toMatch(/ピンサ|ロマーナ|pinsa|romana|multigrain|ferment/i);
      unmount();
    }
    const { container } = render(<DoughKindSwitch selected={PINSA} otherLabel="ピンサ生地" onSelect={() => {}} />);
    expect(container.innerHTML.replaceAll("ピンサ生地", "")).not.toMatch(/ピンサ|ロマーナ|pinsa|romana|multigrain|ferment/i);
  });
});
