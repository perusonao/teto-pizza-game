import { act, screen } from "@testing-library/react";
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
 * A targetless Free Cook for tests that pin the targetless / Hint contracts. Neither HOME's 「レシピ発見」 nor (since #377)
 * Pizza Select's 「レシピ発見へ」 is one when the save has a cookable Research Entry, and there is deliberately no
 * Production UI for it. The Vitest-only hook (`tools/testHooksPlugin.ts`, never in a shipped build) dispatches the same
 * `START_FREE_COOK` without a target. `user` is unused; the signature stays so call sites read like the other helpers.
 */
export async function startTargetlessFreeCookViaTestHook(_user?: UserEvent): Promise<void> {
  const hooks = (globalThis as { __tetoTest?: { startTargetlessFreeCook: () => void } }).__tetoTest;
  if (!hooks) throw new Error("test hook missing: run under vitest.config.ts (tools/testHooksPlugin.ts)");
  await act(async () => hooks.startTargetlessFreeCook());
}
