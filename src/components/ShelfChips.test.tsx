import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShelfChips } from "./ShelfChips";
import { INGREDIENT_SHELF_ORDER } from "../data/ingredientShelf";
import shelfSource from "./ShelfChips.tsx?raw";

afterEach(cleanup);

describe("ShelfChips (presentational)", () => {
  it("renders 「すべて」 first, then the given shelves in the given order, as toggle buttons in a group", () => {
    render(<ShelfChips shelves={["cheese", "meat", "other"]} active="all" onChange={vi.fn()} ariaLabel="材料の分類" />);
    const group = screen.getByRole("group", { name: "材料の分類" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["すべて", "チーズ", "肉系", "ちょっと変わった材料"]);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("marks exactly the active chip with aria-pressed (not colour alone)", () => {
    render(<ShelfChips shelves={["sauce", "meat"]} active="meat" onChange={vi.fn()} ariaLabel="x" />);
    expect(screen.getByRole("button", { name: "肉系" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "肉系" })).toHaveClass("shelf-chip--active");
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "ソース" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the chosen filter and keeps no state of its own", async () => {
    const onChange = vi.fn();
    render(<ShelfChips shelves={["meat", "other"]} active="all" onChange={onChange} ariaLabel="x" />);
    await userEvent.click(screen.getByRole("button", { name: "ちょっと変わった材料" }));
    await userEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(onChange.mock.calls).toEqual([["other"], ["all"]]);
    // The caller did not change `active`, so nothing moved: the component is fully controlled.
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows no counts and no extra text or hidden nodes", () => {
    const { container } = render(
      <ShelfChips shelves={[...INGREDIENT_SHELF_ORDER]} active="all" onChange={vi.fn()} ariaLabel="材料の分類" />,
    );
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.querySelectorAll("[hidden], [aria-hidden]")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(INGREDIENT_SHELF_ORDER.length + 1);
  });

  it("uses only the ingredientShelf authority (no taxonomy or ingredient data of its own; the row mechanics are ShelfChipRow's)", () => {
    const imports = [...shelfSource.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).sort();
    expect(imports).toEqual(["../data/ingredientShelf", "./ShelfChipRow"]);
  });

  it("never scrolls the page: only the row's own scrollLeft is touched", () => {
    expect(shelfSource).not.toMatch(/scrollIntoView|window\.scroll|scrollTo\(/);
  });
});
