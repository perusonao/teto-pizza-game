import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { INGREDIENTS } from "../data/ingredients";
import { IngredientPantry } from "./IngredientPantry";

/** LC-R5-b: the pantry search field (owned rows of the active category, AND shelf, approved aliases, IME contract). */
const appCss = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const inventory = Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])) as never;
const names = () => [...document.querySelectorAll(".pantry-tile__name")].map((n) => n.textContent);
const field = () => screen.queryByRole("searchbox", { name: "材料を検索" }) as HTMLInputElement | null;
const listEl = () => document.querySelector<HTMLElement>(".pantry-sheet__list")!;
const chips = () => [...document.querySelectorAll(".shelf-chip")].map((n) => n.textContent);
const open = (category: "sauce" | "cheese" | "topping" = "topping", owned: readonly string[] = TOPPINGS, onClose = () => {}) =>
  render(<IngredientPantry category={category} ownedIngredientIds={owned} inventory={inventory} onClose={onClose} />);
const type = (value: string) => fireEvent.change(field()!, { target: { value } });

afterEach(() => cleanup());

describe("search field visibility (owned rows of the active category > 6; never text / shelf / result count)", () => {
  it("shows for the 24 owned toppings, not for sauce (3) or cheese (4), not for 6 or fewer toppings", () => {
    open("topping");
    expect(field()).not.toBeNull();
    cleanup();
    open("sauce", INGREDIENTS.filter((i) => i.category === "sauce").map((i) => i.id));
    expect(field()).toBeNull();
    cleanup();
    open("cheese", INGREDIENTS.filter((i) => i.category === "cheese").map((i) => i.id));
    expect(field()).toBeNull();
    cleanup();
    open("topping", TOPPINGS.slice(0, 6));
    expect(field()).toBeNull();
    cleanup();
    open("topping", TOPPINGS.slice(0, 7));
    expect(field()).not.toBeNull();
  });

  it("stays when the result is empty and when a shelf is chosen (the field is never removed)", () => {
    open();
    type("zzzz");
    expect(names()).toEqual([]);
    expect(field()).not.toBeNull();
    expect(field()).toHaveValue("zzzz");
    fireEvent.click(screen.getByRole("button", { name: "肉系" }));
    expect(field()).not.toBeNull();
  });

  it("is not auto-focused: opening lands on 閉じる and never on the field", () => {
    open();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "閉じる" }));
    expect(document.activeElement).not.toBe(field());
  });

  it("is a search input with the mobile attributes and no example / suggestion text", () => {
    open();
    const f = field()!;
    expect(f).toHaveAttribute("type", "search");
    expect(f).toHaveAttribute("inputmode", "search");
    expect(f).toHaveAttribute("enterkeyhint", "search");
    expect(f).toHaveAttribute("autocomplete", "off");
    expect(f).toHaveAttribute("autocapitalize", "off");
    expect(f).toHaveAttribute("autocorrect", "off");
    expect(f).toHaveAttribute("spellcheck", "false");
    expect(f).toHaveAttribute("maxlength", "20");
    expect(f).not.toHaveAttribute("placeholder");
    expect(f.closest("[role=search]")).not.toBeNull();
    expect(document.querySelector("datalist")).toBeNull();
  });

  it("the CSS keeps the field at 16px+ (no iOS focus zoom) and 44px tall, with a 44px clear button", () => {
    const block = (selector: string) => appCss.match(new RegExp(`${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    const input = block(".pantry-sheet__search-input");
    expect(Number(input.match(/font-size:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(16);
    expect(Number(input.match(/height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44);
    const clear = block(".pantry-sheet__search-clear");
    expect(Number(clear.match(/width:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44);
    expect(Number(clear.match(/height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44);
  });
});

describe("search matching (owned only, AND shelf, approved aliases)", () => {
  it("matches names across kana / width / long-vowel forms", () => {
    open();
    for (const q of ["ベーコン", "べーこん", "べこん", "ﾍﾞｰｺﾝ"]) {
      type(q);
      expect(names(), q).toEqual(["ベーコン"]);
    }
    type("");
    expect(names()).toHaveLength(27);
  });

  it("finds an ingredient by its approved written form (玉ねぎ / 卵) and by its name", () => {
    open();
    type("玉ねぎ");
    expect(names()).toEqual(["たまねぎ"]);
    type("卵");
    expect(names()).toEqual(["たまご"]);
    type("たまね");
    expect(names()).toEqual(["たまねぎ"]);
    type("タマ");
    expect(names()).toEqual(["たまご", "たまねぎ"]);
  });

  it("does not guess: unapproved written forms find nothing", () => {
    open();
    for (const q of ["ペペロニ", "馬鈴薯", "大蒜", "玉葱"]) {
      type(q);
      expect(names(), q).toEqual([]);
    }
  });

  it("ANDs with the shelf; the chip row does not depend on the text", () => {
    open();
    const before = chips();
    type("ハ");
    expect(chips()).toEqual(before);
    const withText = names();
    fireEvent.click(screen.getByRole("button", { name: "肉系" }));
    expect(names().every((n) => withText.includes(n!))).toBe(true);
    expect(names()).toEqual(["ハム"]);
    expect(chips()).toEqual(before);
    expect(field()).toHaveValue("ハ"); // a shelf change keeps the text
    type("zzzz");
    expect(names()).toEqual([]);
    expect(chips()).toEqual(before);
  });

  it("an unowned ingredient's name or alias finds nothing, and the empty state looks identical to gibberish", () => {
    const owned = TOPPINGS.filter((id) => id !== "onion" && id !== "bacon");
    open("topping", owned);
    type("たまねぎ");
    expect(names()).toEqual([]);
    const unowned = listEl().innerHTML;
    type("玉ねぎ");
    expect(listEl().innerHTML).toBe(unowned);
    type("ベーコン");
    expect(listEl().innerHTML).toBe(unowned);
    type("qqqq");
    expect(listEl().innerHTML).toBe(unowned);
    expect(listEl()).toHaveTextContent("該当する材料がありません");
    expect(listEl().innerHTML).not.toMatch(/たまねぎ|ベーコン|未所持|\d+\s*件/);
  });

  it("a changed text resets the list to the top; the sheet itself is untouched", () => {
    open();
    listEl().scrollTop = 120;
    type("ハ");
    expect(listEl().scrollTop).toBe(0);
  });

  it("closing resets the text (the sheet unmounts): reopening starts empty", () => {
    const { unmount } = open();
    type("バジル");
    unmount();
    open();
    expect(field()).toHaveValue("");
    expect(names()).toHaveLength(27);
  });

  it("✕ clears the text, keeps the focus in the field, and does not blur on press", () => {
    open();
    field()!.focus();
    type("バジル");
    const clear = screen.getByRole("button", { name: "検索をクリア" });
    const pointerDown = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
    clear.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    fireEvent.click(clear);
    expect(field()).toHaveValue("");
    expect(document.activeElement).toBe(field());
    expect(names()).toHaveLength(27);
  });
});

describe("IME contract: composition never changes the list; compositionend applies the confirmed text", () => {
  it("keeps the previous result (no empty flash) through 「たまねき」 and a kanji candidate, then settles on the confirmed 「玉ねぎ」", () => {
    open();
    type("タ"); // a plain (non-composition) input applies immediately
    const settled = names();
    expect(settled).toEqual(["たまご", "たまねぎ"]);
    fireEvent.compositionStart(field()!);
    for (const partial of ["たまね", "たまねき", "玉ねぎ"]) {
      type(partial);
      expect(names(), partial).toEqual(settled); // unchanged list
      expect(listEl()).not.toHaveTextContent("該当する材料がありません");
      expect(field()).toHaveValue(partial); // the field itself shows what is being composed
    }
    fireEvent.compositionEnd(field()!, { data: "玉ねぎ" });
    expect(names()).toEqual(["たまねぎ"]);
  });

  it("Safari order (compositionend, then a final input) is idempotent", () => {
    open();
    fireEvent.compositionStart(field()!);
    type("たまねき");
    expect(names()).toHaveLength(27);
    fireEvent.compositionEnd(field()!, { data: "たまねぎ" });
    type("たまねぎ"); // the input Safari fires after the end
    expect(names()).toEqual(["たまねぎ"]);
  });

  it("a confirmed string that matches nothing shows the neutral empty state only after the composition ended", () => {
    open();
    fireEvent.compositionStart(field()!);
    type("ぜんぜん");
    expect(listEl()).not.toHaveTextContent("該当する材料がありません");
    fireEvent.compositionEnd(field()!, { data: "ぜんぜん" });
    expect(listEl()).toHaveTextContent("該当する材料がありません");
    expect(field()).not.toBeNull();
  });

  it("a blur in the middle of a composition settles it (no stuck freeze)", () => {
    open();
    field()!.focus();
    fireEvent.compositionStart(field()!);
    type("たまね");
    expect(names()).toHaveLength(27);
    fireEvent.blur(field()!);
    expect(names()).toEqual(["たまねぎ"]);
    type("ベ"); // a later plain input applies again
    expect(names()).toEqual(["ベーコン"]);
  });

  it("an input event that carries isComposing does not apply (real Chromium / Safari flag)", () => {
    open();
    const f = field()!;
    f.value = "たま";
    const event = new InputEvent("input", { bubbles: true, isComposing: true, inputType: "insertCompositionText" });
    f.dispatchEvent(event);
    expect(names()).toHaveLength(27);
  });
});

describe("Enter / Escape", () => {
  it("a plain Enter lets go of the field and moves focus to the list", () => {
    open();
    field()!.focus();
    type("バジル");
    const notPrevented = fireEvent.keyDown(field()!, { key: "Enter", keyCode: 13 });
    expect(notPrevented).toBe(false); // preventDefault: no implicit submit
    expect(document.activeElement).toBe(listEl());
  });

  it("an Enter that confirms a conversion does nothing (keyCode 229, isComposing, or still composing)", () => {
    open();
    const f = field()!;
    f.focus();
    fireEvent.keyDown(f, { key: "Enter", keyCode: 229 });
    expect(document.activeElement).toBe(f);
    fireEvent.keyDown(f, { key: "Enter", keyCode: 13, isComposing: true });
    expect(document.activeElement).toBe(f);
    fireEvent.compositionStart(f);
    fireEvent.keyDown(f, { key: "Enter", keyCode: 13 });
    expect(document.activeElement).toBe(f);
  });

  it("Escape closes the sheet even while the field is focused (OD-R5-8)", () => {
    const onClose = vi.fn();
    open("topping", TOPPINGS, onClose);
    field()!.focus();
    fireEvent.keyDown(field()!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("no keyboard fit without visualViewport (CSS ceiling fallback)", () => {
  it("renders a plain sheet: no fit class, no custom properties", () => {
    open();
    const sheet = document.querySelector<HTMLElement>(".pantry-sheet")!;
    field()!.focus();
    expect(sheet.classList.contains("pantry-sheet--fit")).toBe(false);
    expect(sheet.getAttribute("style")).toBeNull();
  });
});
