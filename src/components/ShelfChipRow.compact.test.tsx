import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShelfChipRow, type ShelfChipOption } from "./ShelfChipRow";

/**
 * The compact (Cooking Tray) row's alignment and edge-fade wiring (Issue #399). jsdom has no layout, so the geometry is
 * stubbed: 8 chips of 54px on a 60px pitch (left = index * 60 in scroll coordinates) in a 150px row that scrolls 480px,
 * read through getBoundingClientRect like the real row does (not the integer offset*). The geometry maths
 * itself is covered in src/logic/chipRowAlign.test.ts; here: when it runs, what it writes, and what it leaves alone.
 */
const OPTIONS: ShelfChipOption[] = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, label: `chip${i}`, ariaLabel: `chip${i}を表示` }));
const scrollLefts = new WeakMap<Element, number>();
const isRow = (el: Element) => el.classList.contains("tray-family-chips");
let rowWidth = 150;

beforeEach(() => {
  rowWidth = 150;
  const proto = HTMLElement.prototype;
  Object.defineProperty(proto, "getBoundingClientRect", {
    configurable: true,
    value(this: HTMLElement) {
      if (isRow(this)) return { left: 0, top: 0, width: rowWidth, height: 28, right: rowWidth, bottom: 28, x: 0, y: 0, toJSON: () => ({}) };
      const left = Array.prototype.indexOf.call(this.parentElement?.children ?? [], this) * 60 - (scrollLefts.get(this.parentElement!) ?? 0);
      return { left, top: 0, width: 54, height: 28, right: left + 54, bottom: 28, x: left, y: 0, toJSON: () => ({}) };
    },
  });
  Object.defineProperty(proto, "clientWidth", { configurable: true, get() { return isRow(this as Element) ? rowWidth : 0; } });
  Object.defineProperty(proto, "scrollWidth", { configurable: true, get() { return isRow(this as Element) ? 8 * 60 - 6 : 0; } });
  Object.defineProperty(proto, "scrollLeft", {
    configurable: true,
    get() { return scrollLefts.get(this as Element) ?? 0; },
    set(v: number) { scrollLefts.set(this as Element, Math.max(0, Math.min(v, 474 - rowWidth))); },
  });
});

afterEach(() => {
  cleanup();
  for (const k of ["getBoundingClientRect", "clientWidth", "scrollWidth", "scrollLeft"]) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});

const renderRow = (active: string, options = OPTIONS, onChange = vi.fn()) =>
  render(<ShelfChipRow compact options={options} active={active} onChange={onChange} ariaLabel="絞り込み" dataAttr="data-tray-family" />);
const row = () => screen.getByRole("group", { name: "絞り込み" });
const edge = () => ({ start: row().dataset.moreStart, end: row().dataset.moreEnd });

describe("ShelfChipRow (compact)", () => {
  it("initial alignment: the first chip stays at 0 with only a right affordance; a last-chip start lands against the end with only a left one", () => {
    const first = renderRow("f0");
    expect(row().scrollLeft).toBe(0);
    expect(edge()).toEqual({ start: "false", end: "true" });
    first.unmount();
    renderRow("f7");
    expect(row().scrollLeft).toBe(474 - 150);
    expect(edge()).toEqual({ start: "true", end: "false" });
  });

  it("an active change scrolls the least that brings the new chip in with its fade room, and writes the fade widths", () => {
    const { rerender } = renderRow("f0");
    rerender(<ShelfChipRow compact options={OPTIONS} active="f3" onChange={vi.fn()} ariaLabel="絞り込み" dataAttr="data-tray-family" />);
    // chip3 is left 180, right 234: 234 > 150 - 14 -> scrollLeft = 234 - 150 + 14.
    expect(row().scrollLeft).toBe(98);
    expect(edge()).toEqual({ start: "true", end: "true" });
    expect(row().style.getPropertyValue("--fade-start")).toBe("14px");
    expect(row().style.getPropertyValue("--fade-end")).toBe("14px");
    expect(screen.getByRole("button", { name: "chip3を表示" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "chip0を表示" })).toHaveAttribute("aria-pressed", "false");
  });

  it("an options change re-aligns an active chip that has moved out of the view", () => {
    const { rerender } = renderRow("f6", OPTIONS.slice(0, 7));
    const before = row().scrollLeft;
    expect(before).toBeGreaterThan(0);
    // The same active id, but a shorter list puts it first: the row settles to the start again.
    rerender(<ShelfChipRow compact options={[OPTIONS[6]!, OPTIONS[0]!]} active="f6" onChange={vi.fn()} ariaLabel="絞り込み" dataAttr="data-tray-family" />);
    expect(row().scrollLeft).toBe(0);
  });

  it("a size change re-checks the active chip, moving only when it is no longer whole", () => {
    renderRow("f7");
    const start = row().scrollLeft;
    rowWidth = 150; // same width: a resize event moves nothing
    act(() => void window.dispatchEvent(new Event("resize")));
    expect(row().scrollLeft).toBe(start);
    rowWidth = 120; // narrower: the last chip would be cut, so it follows
    act(() => void window.dispatchEvent(new Event("resize")));
    expect(row().scrollLeft).toBe(474 - 120);
  });

  it("a manual scroll updates the fades but never pulls the row back to the active chip", () => {
    const { rerender } = renderRow("f0");
    act(() => {
      row().scrollLeft = 200;
      fireEvent.scroll(row());
    });
    expect(row().scrollLeft).toBe(200);
    expect(edge()).toEqual({ start: "true", end: "true" });
    // Re-rendering with the same props (the parent re-rendering for another reason) leaves it where the user put it.
    rerender(<ShelfChipRow compact options={[...OPTIONS]} active="f0" onChange={vi.fn()} ariaLabel="絞り込み" dataAttr="data-tray-family" />);
    expect(row().scrollLeft).toBe(200);
    act(() => {
      row().scrollLeft = 999;
      fireEvent.scroll(row());
    });
    expect(edge()).toEqual({ start: "true", end: "false" });
  });

  it("caps a fade at the gap beside the active chip so the chip's own text is never under it", () => {
    renderRow("f3");
    // chip3: left 180, right 234; row scrolled to 98 -> 82px from the start edge and 14px from the end edge.
    expect(Number.parseFloat(row().style.getPropertyValue("--fade-end"))).toBeLessThanOrEqual(14);
    act(() => {
      row().scrollLeft = 180 - 6; // 6px from the start edge
      fireEvent.scroll(row());
    });
    expect(row().style.getPropertyValue("--fade-start")).toBe("6px");
  });

  it("selecting calls onChange with the id and keeps no selection state of its own", () => {
    const onChange = vi.fn();
    renderRow("f0", OPTIONS, onChange);
    fireEvent.click(screen.getByRole("button", { name: "chip4を表示" }));
    expect(onChange).toHaveBeenCalledWith("f4");
    expect(screen.getByRole("button", { name: "chip0を表示" })).toHaveAttribute("aria-pressed", "true");
  });

  it("the non-compact rows (Pantry / Inventory / Shop) keep the old behaviour: no fade attributes, no new alignment", () => {
    render(<ShelfChipRow options={OPTIONS} active="f7" onChange={vi.fn()} ariaLabel="棚" dataAttr="data-shelf" />);
    const plain = screen.getByRole("group", { name: "棚" });
    expect(plain).toHaveClass("shelf-chips");
    expect(plain.dataset.moreStart).toBeUndefined();
    expect(plain.style.getPropertyValue("--fade-start")).toBe("");
  });
});
