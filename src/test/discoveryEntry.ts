import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/**
 * Issue #373: HOME 「レシピ発見」 starts the one cookable Research Entry directly, opens the Dex's Research cards
 * for 2+ (the player picks), and only a save with no cookable entry starts targetless. Tests that just need "a free
 * cook round" from a save that has entries click the first Research card when the Dex opened.
 */
export async function pickFirstResearchIfDexOpened(user: UserEvent): Promise<void> {
  const cta = screen.queryAllByRole("button", { name: /このピザを研究する|を研究する$/ });
  if (cta.length > 0) await user.click(cta[0]);
}

/**
 * A targetless Free Cook for tests that pin the targetless / Hint contracts: HOME's 「レシピ発見」 no longer is one
 * when the save has a cookable Research Entry, but Pizza Select's 「レシピ発見へ」 still starts `START_FREE_COOK`
 * without a target.
 */
export async function startTargetlessFreeCookViaPizzaSelect(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
  await user.click(screen.getByRole("button", { name: /レシピ発見へ/ }));
}
