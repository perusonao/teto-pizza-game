/**
 * Discovery 3.0 Research Recipe (Issue #346), S4 / OD-RX-4: the one primary CTA after a recipe was
 * discovered. Pure; reads nothing but two derived facts the caller already has.
 *
 * Priority (first that applies):
 * 1. a Research Entry the player can still research now -> 「次のピザを研究する」
 * 2. a new material waiting in the Shop                   -> 「新しい食材を見る」
 * 3. otherwise                                            -> 「図鑑を見る」
 *
 * Privacy: the result carries the *registered* entries' opaque ids only (so the caller can start the
 * research when exactly one is left); it has no count, no "remaining" wording and says nothing about
 * unregistered recipes. The labels are fixed strings.
 */

export type PostDiscoveryPrimaryKind = "RESEARCH_NEXT" | "SHOP_NEW_MATERIAL" | "DEX";

export interface PostDiscoveryPrimaryInput {
  /** Research Entries that can be researched right now (registered AND cookable), in the Research order. */
  researchableEntryIds: readonly string[];
  /** A material is unlocked for the Shop and not bought yet (the Shop's own NEW row). */
  newMaterialAvailable: boolean;
}

export interface PostDiscoveryPrimary {
  kind: PostDiscoveryPrimaryKind;
  labelJa: string;
  /** `RESEARCH_NEXT` with exactly one entry: start it directly. With 2+ the caller returns to the
   *  anonymous Research card selection (the Dex), so this stays `null`. */
  directResearchId: string | null;
}

export const POST_DISCOVERY_LABEL_JA: Readonly<Record<PostDiscoveryPrimaryKind, string>> = {
  RESEARCH_NEXT: "\u{1F50E} 次のピザを研究する",
  SHOP_NEW_MATERIAL: "\u{1F6D2} 新しい食材を見る",
  DEX: "\u{1F4D6} 図鑑を見る",
};

export function postDiscoveryPrimary(input: PostDiscoveryPrimaryInput): PostDiscoveryPrimary {
  if (input.researchableEntryIds.length > 0) {
    return {
      kind: "RESEARCH_NEXT",
      labelJa: POST_DISCOVERY_LABEL_JA.RESEARCH_NEXT,
      directResearchId: input.researchableEntryIds.length === 1 ? input.researchableEntryIds[0] : null,
    };
  }
  if (input.newMaterialAvailable) {
    return { kind: "SHOP_NEW_MATERIAL", labelJa: POST_DISCOVERY_LABEL_JA.SHOP_NEW_MATERIAL, directResearchId: null };
  }
  return { kind: "DEX", labelJa: POST_DISCOVERY_LABEL_JA.DEX, directResearchId: null };
}
