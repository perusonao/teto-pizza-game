import { describe, expect, it, vi } from "vitest";
import { gameReducer } from "../../state/gameReducer";
import { normalised, placeSausageAndBake, toStep } from "./searFixtures";

/** Cooking Sear Phase 1 (#724): SEAR_INGREDIENT with the experience gate OPEN. The production-OFF half is ./searIngredient.flagOff.test.ts. */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../../data/searExperienceGate", () => ({ SEAR_EXPERIENCE_PRODUCTION: false, searExperienceEnabled: () => gate.open }));

const sear = (amount = 0.6, ingredientId = "sausage") => ({ type: "SEAR_INGREDIENT" as const, ingredientId, amount });

describe("SEAR_INGREDIENT: allowed (Guided / Free Cooking, TOPPING, sausage owned)", () => {
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: records the amount, once", (kind) => {
    const s = toStep(kind, "TOPPING");
    expect(s.searedLook).toBeUndefined();
    const once = gameReducer(s, sear(0.6));
    expect(once.searedLook).toEqual({ sausage: 0.6 });
    expect(gameReducer(once, sear(0.9))).toBe(once); // already seared: same reference, the first look stays
  });

  it("changes nothing but searedLook (no stock is consumed, nothing re-scored, the prep set is untouched)", () => {
    const s = toStep("GUIDED", "TOPPING");
    const { searedLook, ...after } = gameReducer(s, sear(0.4));
    expect(searedLook).toEqual({ sausage: 0.4 });
    expect(after).toStrictEqual(s);
  });

  it("clamps the amount into 0..1", () => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, sear(7)).searedLook).toEqual({ sausage: 1 });
    expect(gameReducer(s, sear(-2)).searedLook).toEqual({ sausage: 0 });
  });
});

describe("SEAR_INGREDIENT: refused with the SAME state reference", () => {
  it.each(["LUNCH_RUSH", "DINNER"] as const)("%s", (roundKind) => {
    const s = { ...toStep("GUIDED", "TOPPING"), roundKind };
    expect(gameReducer(s, sear())).toBe(s);
  });
  it.each(["DOUGH", "SAUCE"] as const)("makingStep %s", (step) => {
    const s = toStep("GUIDED", step);
    expect(gameReducer(s, sear())).toBe(s);
  });
  it("a phase other than PREPARE", () => {
    const baked = placeSausageAndBake(toStep("GUIDED", "TOPPING"), false);
    expect(gameReducer(baked, sear())).toBe(baked);
  });
  it("a non-target ingredient (beef is the 炒める prep's, not the sear's)", () => {
    const s = toStep("GUIDED", "TOPPING");
    for (const id of ["beef", "pineapple", "nope"]) expect(gameReducer(s, sear(0.5, id))).toBe(s);
  });
  it("a sausage the player does not own", () => {
    const s = toStep("GUIDED", "TOPPING", false);
    expect(gameReducer(s, sear())).toBe(s);
  });
  it.each([NaN, Infinity, -Infinity])("a non-finite amount (%s)", (amount) => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, sear(amount))).toBe(s);
  });
});

describe("SEAR_INGREDIENT: lifetime and independence", () => {
  it("RESET_PIZZA removes the property itself (not set to undefined)", () => {
    const seared = gameReducer(toStep("FREE_COOK", "TOPPING"), sear());
    const reset = gameReducer(seared, { type: "RESET_PIZZA" });
    expect("searedLook" in reset).toBe(false);
  });
  it("a new round, PLAY_AGAIN and RETRY_SAME_RECIPE do not carry it", () => {
    const done = placeSausageAndBake(toStep("GUIDED", "TOPPING"), 0.7);
    expect(done.searedLook).toEqual({ sausage: 0.7 });
    for (const action of [{ type: "PLAY_AGAIN" }, { type: "RETRY_SAME_RECIPE" }] as const) {
      const next = gameReducer(done, action as never);
      expect(next.searedLook).toBeUndefined();
    }
  });
  it("the prep (炒める) and the sear are independent state", () => {
    const s = toStep("GUIDED", "TOPPING");
    const seared = gameReducer(s, sear(0.5));
    expect(seared.preparedIngredientIds).toBeUndefined();
    expect(seared.preparedLook).toBeUndefined();
  });
});

describe("scoring, identification, inventory, the journal and the save are unaffected (AC: no scoring / save-format change)", () => {
  it.each([0, 0.2, 0.5, 0.9, 1])("amount %s: the finished round equals the unseared one apart from searedLook", (amount) => {
    const a = placeSausageAndBake(toStep("GUIDED", "TOPPING"), amount);
    const b = placeSausageAndBake(toStep("GUIDED", "TOPPING"), false);
    expect(normalised(a)).toStrictEqual(normalised(b));
  });
  it("Free Cooking likewise", () => {
    const a = placeSausageAndBake(toStep("FREE_COOK", "TOPPING"), 0.8);
    const b = placeSausageAndBake(toStep("FREE_COOK", "TOPPING"), false);
    expect(normalised(a)).toStrictEqual(normalised(b));
  });
});
