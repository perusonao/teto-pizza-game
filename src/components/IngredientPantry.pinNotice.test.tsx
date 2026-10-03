import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getIngredient, INGREDIENTS } from "../data/ingredients";
import { emptyHandSession, type HandSession } from "../logic/catalog/handSession";
import { IngredientPantry, PIN_CAPACITY_NOTICE } from "./IngredientPantry";

/**
 * LC-R6-c (OD-R5e-3 / OD-R6a-4 / OD-R5c-5 / OD-R6a-5): the capacity-full notice and the search-focus keyboard rule of the
 * pantry pin UI. `handEditing` is the App's `HAND_ENFORCEMENT_ENABLED && an active hand`; here it is forced on directly.
 * `pinFits` is the Model C rule the App hands down: a NEW pin that would not be on the visible hand is refused.
 */
const appCss = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");
const name = (id: string) => getIngredient(id)!.nameJa;
const stock = () => Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])) as never;
const tile = (id: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".pantry-tile__toggle")].find((b) => b.textContent?.includes(name(id)))!;
const status = () => screen.getByRole("status");
const FULL = "sausage"; // the ingredient the stub hand refuses (the hand is "full")

function Harness(props: { handEditing?: boolean; initial?: HandSession; onWrite?: (s: HandSession) => void }) {
  const [session, setSession] = useState<HandSession>(props.initial ?? emptyHandSession());
  props.onWrite?.(session);
  return (
    <IngredientPantry
      category="topping"
      ownedIngredientIds={INGREDIENTS.map((i) => i.id)}
      inventory={stock()}
      onClose={() => {}}
      handEditing={props.handEditing ?? true}
      pinSession={session}
      onPinSessionChange={setSession}
      pinFits={(_candidate, id) => id !== FULL}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("production / inactive hand (handEditing off): the sheet has no notice region at all", () => {
  it("renders no status region and no notice element, so the DOM stays the R5-b sheet", () => {
    render(<Harness handEditing={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector(".pantry-sheet__notice")).toBeNull();
    expect(document.querySelector(".pantry-tile__toggle")).toBeNull();
  });
});

describe("capacity-full notice (OD-R5e-3 / OD-R6a-4)", () => {
  it("is an always-mounted, empty, polite role=status region while pin editing is on", () => {
    render(<Harness />);
    expect(status()).toHaveAttribute("aria-live", "polite");
    expect(status()).toHaveTextContent("");
    expect(status()).not.toHaveClass("pantry-sheet__notice--shown");
  });

  it("a refused NEW pin shows the notice (no number), writes nothing, and keeps the tile pressable / not aria-disabled", () => {
    const writes: HandSession[] = [];
    render(<Harness onWrite={(s) => writes.push(s)} />);
    const before = writes.length;
    fireEvent.click(tile(FULL));
    expect(status()).toHaveTextContent(PIN_CAPACITY_NOTICE);
    expect(status()).toHaveClass("pantry-sheet__notice--shown");
    expect(PIN_CAPACITY_NOTICE).not.toMatch(/[0-9０-９]/);
    expect(status().textContent).not.toMatch(/[0-9０-９]|\u{1F4CC}/u);
    expect(tile(FULL)).toHaveAttribute("aria-pressed", "false");
    expect(tile(FULL)).not.toHaveAttribute("aria-disabled");
    expect(writes.length).toBe(before); // no session write: the pins are unchanged
    expect(document.querySelector(".pantry-sheet__pins")).toBeNull();
  });

  it("disappears after 3 s", () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(tile(FULL));
    expect(status()).toHaveClass("pantry-sheet__notice--shown");
    act(() => vi.advanceTimersByTime(2999));
    expect(status()).toHaveClass("pantry-sheet__notice--shown");
    act(() => vi.advanceTimersByTime(1));
    expect(status()).not.toHaveClass("pantry-sheet__notice--shown");
    expect(status()).toHaveTextContent("");
  });

  it("a repeated refusal restarts the 3 s timer", () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(tile(FULL));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(tile(FULL));
    act(() => vi.advanceTimersByTime(2500)); // 4.5 s after the first, 2.5 s after the second
    expect(status()).toHaveClass("pantry-sheet__notice--shown");
    act(() => vi.advanceTimersByTime(500));
    expect(status()).not.toHaveClass("pantry-sheet__notice--shown");
  });

  it("the next tap clears it at once: a successful pin, an unpin, a strip unpin and おまかせに戻す", () => {
    render(<Harness />);
    fireEvent.click(tile(FULL));
    fireEvent.click(tile("basil")); // a pin that fits
    expect(status()).toHaveTextContent("");
    expect(tile("basil")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(tile(FULL));
    expect(status()).toHaveTextContent(PIN_CAPACITY_NOTICE);
    fireEvent.click(tile("basil")); // unpin
    expect(status()).toHaveTextContent("");

    fireEvent.click(tile("basil"));
    fireEvent.click(tile(FULL));
    fireEvent.click(within(screen.getByRole("group", { name: "選択中の材料" })).getByRole("button", { name: `${name("basil")}を外す` }));
    expect(status()).toHaveTextContent("");

    fireEvent.click(tile("basil"));
    fireEvent.click(tile(FULL));
    fireEvent.click(within(screen.getByRole("group", { name: "選択中の材料" })).getByRole("button", { name: "おまかせに戻す" }));
    expect(status()).toHaveTextContent("");
  });

  it("is an out-of-flow overlay at the sheet's bottom edge (never pushes the list / strip), without pointer events", () => {
    const rule = appCss.match(/\.pantry-sheet__notice\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/bottom:/);
    expect(rule).toMatch(/pointer-events:\s*none/);
    expect(rule).toMatch(/opacity:\s*0/);
    expect(appCss).toMatch(/\.pantry-sheet__notice--shown\s*\{[^}]*opacity:\s*1/);
    // the sheet is the positioned ancestor (fixed), so the notice follows its keyboard-fitted bottom edge
    expect(appCss.match(/\.pantry-sheet\s*\{([^}]*)\}/)?.[1] ?? "").toMatch(/position:\s*fixed/);
  });
});

describe("search-focus keyboard rule (OD-R5c-5 / OD-R6a-5, initial behavior)", () => {
  it("while the search field has the focus a tile press does not take the focus (default prevented); the pin still applies", () => {
    render(<Harness />);
    fireEvent.focus(screen.getByRole("searchbox", { name: "材料を検索" }));
    expect(fireEvent.pointerDown(tile("basil"))).toBe(false); // defaultPrevented
    fireEvent.click(tile("basil"));
    expect(tile("basil")).toHaveAttribute("aria-pressed", "true");
  });

  it("without a focused field a tile press is untouched (default not prevented)", () => {
    render(<Harness />);
    expect(fireEvent.pointerDown(tile("basil"))).toBe(true);
    fireEvent.focus(screen.getByRole("searchbox", { name: "材料を検索" }));
    fireEvent.blur(screen.getByRole("searchbox", { name: "材料を検索" }));
    expect(fireEvent.pointerDown(tile("basil"))).toBe(true);
  });

  it("a refused pin while searching still shows the notice and keeps the field's text", () => {
    render(<Harness />);
    const input = screen.getByRole("searchbox", { name: "材料を検索" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ソ" } });
    fireEvent.click(tile(FULL));
    expect(status()).toHaveTextContent(PIN_CAPACITY_NOTICE);
    expect(input).toHaveValue("ソ");
  });
});
