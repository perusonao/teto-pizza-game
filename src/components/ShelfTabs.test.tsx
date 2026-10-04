import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FAMILY_DISPLAY } from "../data/familyDisplay";
import { SELECTION_ALL, type ShelfSelection } from "../data/ingredientShelf";
import { ShelfTabs } from "./ShelfTabs";
import tabsSource from "./ShelfTabs.tsx?raw";
import rowSource from "./ShelfChipRow.tsx?raw";

afterEach(cleanup);

const MAJORS = ["sauce", "cheese", "topping"] as const;
const FAMILIES = ["meat", "vegetable", "other"] as const;
const labels = (name: string) => within(screen.getByRole("group", { name })).getAllByRole("button").map((b) => b.textContent);
const topping: ShelfSelection = { major: "topping", family: "all" };

describe("ShelfTabs (presentational, two tiers)", () => {
  it("tier 1 is すべて + the given majors; tier 2 does not exist unless 具材 is selected", () => {
    render(<ShelfTabs majors={MAJORS} families={FAMILIES} selection={SELECTION_ALL} onChange={vi.fn()} />);
    expect(labels("材料の大分類")).toEqual(["すべて", "ソース", "チーズ", "具材"]);
    expect(screen.queryByRole("group", { name: "具材の分類" })).not.toBeInTheDocument();
    for (const major of ["sauce", "cheese"] as const) {
      cleanup();
      render(<ShelfTabs majors={MAJORS} families={FAMILIES} selection={{ major, family: "all" }} onChange={vi.fn()} />);
      expect(screen.queryByRole("group", { name: "具材の分類" })).not.toBeInTheDocument();
    }
  });

  it("tier 2 (under 具材) is すべて + the given families in authority order, labelled by familyDisplay", () => {
    render(<ShelfTabs majors={MAJORS} families={["other", "meat", "vegetable"]} selection={topping} onChange={vi.fn()} />);
    expect(labels("具材の分類")).toEqual(["すべて", FAMILY_DISPLAY.meat.labelJa, FAMILY_DISPLAY.vegetable.labelJa, FAMILY_DISPLAY.other.labelJa]);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("marks exactly the active tab of each tier with aria-pressed", () => {
    render(<ShelfTabs majors={MAJORS} families={FAMILIES} selection={{ major: "topping", family: "meat" }} onChange={vi.fn()} />);
    const major = within(screen.getByRole("group", { name: "材料の大分類" }));
    const family = within(screen.getByRole("group", { name: "具材の分類" }));
    expect(major.getByRole("button", { name: "具材" })).toHaveAttribute("aria-pressed", "true");
    expect(major.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
    expect(family.getByRole("button", { name: "肉系" })).toHaveAttribute("aria-pressed", "true");
    expect(family.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
  });

  it("OD-5 / OD-D: another major resets the family; re-tapping the active major emits nothing; a family tap keeps 具材", async () => {
    const onChange = vi.fn();
    render(<ShelfTabs majors={MAJORS} families={FAMILIES} selection={{ major: "topping", family: "meat" }} onChange={onChange} />);
    const major = within(screen.getByRole("group", { name: "材料の大分類" }));
    await userEvent.click(major.getByRole("button", { name: "具材" }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(major.getByRole("button", { name: "ソース" }));
    await userEvent.click(within(screen.getByRole("group", { name: "具材の分類" })).getByRole("button", { name: "ちょっと変わった材料" }));
    expect(onChange.mock.calls).toEqual([[{ major: "sauce", family: "all" }], [{ major: "topping", family: "other" }]]);
  });

  it("shows no counts and no hidden nodes, and each tier carries its own data attribute", () => {
    const { container } = render(<ShelfTabs majors={MAJORS} families={FAMILIES} selection={topping} onChange={vi.fn()} />);
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.querySelectorAll("[hidden], [aria-hidden]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-major]")).toHaveLength(MAJORS.length + 1);
    expect(container.querySelectorAll("[data-shelf]")).toHaveLength(FAMILIES.length + 1);
  });

  it("reads labels only through ingredientShelf and never scrolls the page", () => {
    const imports = [...tabsSource.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.some((i) => /hint|catalog/i.test(i))).toBe(false);
    expect(rowSource + tabsSource).not.toMatch(/scrollIntoView|window\.scroll|scrollTo\(/);
  });
});
