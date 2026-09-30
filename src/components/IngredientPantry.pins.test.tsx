import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getIngredient, INGREDIENTS } from "../data/ingredients";
import { emptyHandSession, type HandSession } from "../logic/catalog/handSession";
import { IngredientPantry } from "./IngredientPantry";

/**
 * LC-R5-c: the dormant pin foundation inside the pantry (Model D; 方式 D presentation).
 * Production passes `handEditing = HAND_ENFORCEMENT_ENABLED` (false): the sheet must be exactly the R5-b sheet.
 * With `handEditing` forced on (tests only) a tile tap edits the App-level pins directly.
 */
const appCss = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const SAUCES = INGREDIENTS.filter((i) => i.category === "sauce").map((i) => i.id);
const name = (id: string) => getIngredient(id)!.nameJa;
const stock = (over: Record<string, number> = {}) => ({ ...Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])), ...over }) as never;
const tile = (id: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".pantry-tile__toggle")].find((b) => b.textContent?.includes(name(id)))!;
const strip = () => screen.queryByRole("group", { name: "選択中の材料" });
const field = () => screen.getByRole("searchbox", { name: "材料を検索" });

function Harness(props: { initial?: HandSession; inventory?: never; handEditing?: boolean; onSession?: (s: HandSession) => void; category?: "topping" | "sauce" }) {
  const [session, setSession] = useState<HandSession>(props.initial ?? emptyHandSession());
  props.onSession?.(session);
  return (
    <IngredientPantry
      category={props.category ?? "topping"}
      ownedIngredientIds={INGREDIENTS.map((i) => i.id)}
      inventory={props.inventory ?? stock()}
      onClose={() => {}}
      handEditing={props.handEditing}
      pinSession={session}
      onPinSessionChange={setSession}
    />
  );
}

afterEach(() => cleanup());

describe("production (handEditing off): no pin UI at all -- the R5-b sheet", () => {
  it("renders read-only tiles, no toggle / aria-pressed / badge / strip, even with pins in the session", () => {
    const pinned: HandSession = { sauce: [SAUCES[0]], cheese: [], topping: [TOPPINGS[0], TOPPINGS[3]] };
    render(<Harness initial={pinned} />);
    const list = document.querySelector(".pantry-sheet__list")!;
    expect(list.querySelectorAll("button")).toHaveLength(0);
    expect(list.querySelectorAll("[aria-pressed]")).toHaveLength(0);
    expect(document.querySelector(".pantry-tile__pin-badge, .pantry-tile--editable, .pantry-sheet__pins")).toBeNull();
    expect(strip()).toBeNull();
    expect(document.body.textContent).not.toMatch(/選択中|おまかせに戻す|\u{1F4CC}/u);
  });

  it("the DOM is byte-identical with and without pins / a writer (pins cannot leak into production)", () => {
    const { container: a } = render(
      <IngredientPantry category="topping" ownedIngredientIds={INGREDIENTS.map((i) => i.id)} inventory={stock()} onClose={() => {}} />,
    );
    const norm = (html: string) => html.replace(/_r_[0-9a-z]+_/g, "_id_");
    const plain = norm(a.innerHTML);
    cleanup();
    const write = vi.fn();
    const { container: b } = render(
      <IngredientPantry
        category="topping"
        ownedIngredientIds={INGREDIENTS.map((i) => i.id)}
        inventory={stock()}
        onClose={() => {}}
        pinSession={{ sauce: [], cheese: [], topping: [TOPPINGS[1]] }}
        onPinSessionChange={write}
      />,
    );
    expect(norm(b.innerHTML)).toBe(plain);
    for (const li of b.querySelectorAll(".pantry-tile")) fireEvent.click(li);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("forced on (handEditing): Model D direct pin edit", () => {
  it("a tile tap pins at once (no confirm), shows a 📌 badge + aria-pressed, a second tap unpins", () => {
    let latest = emptyHandSession();
    render(<Harness handEditing onSession={(s) => (latest = s)} />);
    fireEvent.click(tile(TOPPINGS[2]));
    expect(latest.topping).toEqual([TOPPINGS[2]]);
    expect(tile(TOPPINGS[2])).toHaveAttribute("aria-pressed", "true");
    expect(tile(TOPPINGS[2]).querySelector(".pantry-tile__pin-badge")).not.toBeNull();
    expect(tile(TOPPINGS[0])).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(tile(TOPPINGS[2]));
    expect(latest.topping).toEqual([]);
    expect(tile(TOPPINGS[2])).toHaveAttribute("aria-pressed", "false");
  });

  it("OD-R5-6: a no-stock tile cannot be newly pinned (aria-disabled, no write); an existing no-stock pin can be removed", () => {
    let latest = emptyHandSession();
    const inv = stock({ [TOPPINGS[1]]: 0, [TOPPINGS[4]]: 0 });
    render(<Harness handEditing inventory={inv} initial={{ sauce: [], cheese: [], topping: [TOPPINGS[4]] }} onSession={(s) => (latest = s)} />);
    expect(tile(TOPPINGS[1])).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(tile(TOPPINGS[1]));
    expect(latest.topping).toEqual([TOPPINGS[4]]);
    expect(tile(TOPPINGS[4])).not.toHaveAttribute("aria-disabled");
    fireEvent.click(tile(TOPPINGS[4]));
    expect(latest.topping).toEqual([]);
  });

  it("edits only the active category; invalid stored pins are not shown and are dropped on the next write", () => {
    let latest = emptyHandSession();
    const initial = { sauce: [SAUCES[1]], cheese: [], topping: ["ghost", SAUCES[0], TOPPINGS[5]] } as HandSession;
    render(<Harness handEditing initial={initial} onSession={(s) => (latest = s)} />);
    expect(within(strip()!).getAllByRole("button", { name: /を外す$/ }).map((b) => b.getAttribute("aria-label"))).toEqual([`${name(TOPPINGS[5])}を外す`]);
    fireEvent.click(tile(TOPPINGS[6]));
    expect(latest.topping).toEqual([TOPPINGS[5], TOPPINGS[6]]);
    expect(latest.sauce).toEqual([SAUCES[1]]);
  });

  it("OD-2: pins survive search and shelf changes; the strip still lists a pin the filter hides", () => {
    let latest = emptyHandSession();
    render(<Harness handEditing onSession={(s) => (latest = s)} />);
    fireEvent.click(tile(TOPPINGS[0]));
    fireEvent.change(field(), { target: { value: "zzzz" } });
    expect(document.querySelectorAll(".pantry-tile")).toHaveLength(0);
    expect(within(strip()!).getByRole("button", { name: `${name(TOPPINGS[0])}を外す` })).toBeInTheDocument();
    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "肉" }));
    expect(latest.topping).toEqual([TOPPINGS[0]]);
  });

  it("the strip: rendered only while a pin exists; unpin from the strip; おまかせに戻す clears the category", () => {
    let latest = emptyHandSession();
    render(<Harness handEditing onSession={(s) => (latest = s)} initial={{ sauce: [SAUCES[0]], cheese: [], topping: [] }} />);
    expect(strip()).toBeNull();
    fireEvent.click(tile(TOPPINGS[0]));
    fireEvent.click(tile(TOPPINGS[1]));
    fireEvent.click(within(strip()!).getByRole("button", { name: `${name(TOPPINGS[0])}を外す` }));
    expect(latest.topping).toEqual([TOPPINGS[1]]);
    fireEvent.click(within(strip()!).getByRole("button", { name: "おまかせに戻す" }));
    expect(latest).toEqual({ sauce: [SAUCES[0]], cheese: [], topping: [] });
    expect(strip()).toBeNull();
  });

  it("no digit in the strip (no pin count / capacity: OD-R5-7) and no scroll / search reset on a pin", () => {
    render(<Harness handEditing />);
    const list = document.querySelector<HTMLElement>(".pantry-sheet__list")!;
    fireEvent.change(field(), { target: { value: "" } });
    list.scrollTop = 120;
    for (const id of TOPPINGS.slice(0, 5)) fireEvent.click(tile(id));
    expect(strip()!.textContent).not.toMatch(/[0-9０-９]/);
    expect(list.scrollTop).toBe(120);
    expect(document.activeElement === field()).toBe(false);
  });

  it("方式 D: the strip is a fixed slot above the list, hidden by CSS while the sheet is keyboard-fitted", () => {
    render(<Harness handEditing initial={{ sauce: [], cheese: [], topping: [TOPPINGS[0]] }} />);
    const s = strip()!;
    expect(s.nextElementSibling).toHaveClass("pantry-sheet__list");
    expect(appCss).toMatch(/\.pantry-sheet\.pantry-sheet--fit \.pantry-sheet__pins \{\s*display: none;\s*\}/);
    // Badge / aria-pressed live on the tile, outside the strip, so they stay while it is hidden.
    expect(tile(TOPPINGS[0])).toHaveAttribute("aria-pressed", "true");
  });
});
