import { describe, expect, it } from "vitest";
import { SauceDispenseController, type SauceDeposit } from "./sauceDispenseController";
import {
  isAllowedSauceDepositBatch,
  PRESENCE_DAB_QUANTITY,
  sauceQuantityCap,
} from "./sauceInteractionPolicy";
import { sauceHeadroom } from "../state/sauceLedger";
import { createEmptyPizza } from "../state/pizzaState";
import { computeScoringV2 } from "./scoringV2";
import { getRecipe } from "../data/recipes";
import { buildIdealMargheritaSauceFixture } from "../data/referencePizza";

describe("T25 I-7 presence-dab sauce policy", () => {
  it("pins yogurt to the existing atomic starter quantity without changing ordinary sauce caps", () => {
    expect(PRESENCE_DAB_QUANTITY).toBe(0.02);
    expect(sauceQuantityCap("yogurt-sauce")).toBe(0.02);
    expect(sauceQuantityCap("tomato-sauce")).toBe(1);
  });

  it("allows exactly one fresh 0.02 deposit and rejects hold, fractional, oversized, and repeat batches", () => {
    const dab = { x: 40, y: 60, amount: 0.02 };
    expect(isAllowedSauceDepositBatch("yogurt-sauce", 0, [dab])).toBe(true);
    expect(isAllowedSauceDepositBatch("yogurt-sauce", 0, [dab, dab])).toBe(false);
    expect(isAllowedSauceDepositBatch("yogurt-sauce", 0, [{ ...dab, amount: 0.01 }])).toBe(false);
    expect(isAllowedSauceDepositBatch("yogurt-sauce", 0, [{ ...dab, amount: 0.03 }])).toBe(false);
    expect(isAllowedSauceDepositBatch("yogurt-sauce", 0.02, [dab])).toBe(false);
    expect(isAllowedSauceDepositBatch("tomato-sauce", 0.5, [dab, dab])).toBe(true);
  });

  it("the shared dispenser emits one starter dab; hold and drag cannot add a tick", () => {
    const pizza = createEmptyPizza();
    const deposits: SauceDeposit[] = [];
    let pending = 0;
    const controller = new SauceDispenseController({
      onDeposit: (deposit) => {
        deposits.push(deposit);
        pending += deposit.amount;
      },
      getTotalDispensed: () => pending,
      getHeadroom: () => sauceHeadroom(pizza, "yogurt-sauce", pending),
    });

    controller.start(0, { x: 20, y: 20 });
    controller.move({ x: 80, y: 80 }, 500);
    controller.step(2_000);

    expect(deposits).toEqual([{ x: 20, y: 20, amount: 0.02 }]);
    expect(sauceHeadroom(pizza, "yogurt-sauce", pending)).toBe(0);
  });

  it("a secondary yogurt dab does not change the primary tomato sauce score", () => {
    const recipe = getRecipe("margherita")!;
    const tomato = buildIdealMargheritaSauceFixture();
    const tomatoOnly = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce"],
      sauceDeposits: tomato,
    };
    const withYogurt = {
      ...tomatoOnly,
      sauceIds: ["tomato-sauce", "yogurt-sauce"],
      sauceDeposits: [
        ...tomato.map((deposit) => ({ ...deposit, ingredientId: "tomato-sauce" })),
        { x: 50, y: 50, amount: 0.02, ingredientId: "yogurt-sauce" },
      ],
    };

    expect(computeScoringV2(recipe, withYogurt).components.sauce)
      .toEqual(computeScoringV2(recipe, tomatoOnly).components.sauce);
  });
});
