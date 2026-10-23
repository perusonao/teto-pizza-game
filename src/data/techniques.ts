/**
 * Cooking Techniques 1.0 TQ-1A (Issue #262): the technique registry.
 *
 * Authority: docs/design/TETO_COOKING-TECHNIQUES_1.0_FINAL-IMPLEMENTATION-GATE.md §1 (Owner
 * Decisions OD-TQ-1 / 2 / 6 / 7 / 10改 / 15). A technique is a new *way* of cooking the player
 * discovers by doing it -- never bought, never a ⭐/Pitz reward, never a precondition for a recipe.
 * TQ-1 shipped NO_SAUCE; Square Dough F2 (Issue #538) adds TRAY (天板焼き, pan `"tray"`).
 *
 * Wired since TQ-1C / TQ-1D (the reducer, the RESULT's technique stage and the Dex's 調理法 section read it).
 * `nameJa` is shown only after the technique is discovered; `riddleJa` is the Dex's fixed clue (TQ-1D final copy,
 * Owner-approved: 「ソースなし」 / 「いつもの“ぬるもの”がなくても…？」).
 */

export type TechniqueId = "no-sauce" | "tray" | "dough-pinsa-romana" | "late-addition";

export interface TechniqueDefinition {
  id: TechniqueId;
  /** Shown only once discovered. */
  nameJa: string;
  /** The fixed one-line clue shown for an undiscovered-but-open technique ("？？？"). It must
   *  never name the technique or the concrete action (OD-TQ-5 / OD-TQ-6). */
  riddleJa: string;
  /** Shown with the name once discovered (Dex only). Absent for a technique that has none. For TRAY this is the
   *  Owner-approved general description (Square Dough F2): it describes the way of cooking, never a recipe, an
   *  ingredient or a count, and is the same for every player (the OD-TQ-5/6 exception is limited to it). */
  descriptionJa?: string;
}

/** Registry order is the deterministic order techniques are reported and recorded in. */
export const TECHNIQUES: readonly TechniqueDefinition[] = [
  { id: "no-sauce", nameJa: "ソースなし", riddleJa: "いつもの“ぬるもの”がなくても…？" },
  {
    id: "tray",
    nameJa: "天板焼き",
    riddleJa: "丸くなくても、ピザは焼ける。四つの角まで生地を広げてみよう。",
    descriptionJa: "四角い天板に生地を広げて焼く調理法。指で押し広げ、四隅まで伸ばして形を整えよう。",
  },
  // Dough Kind P1 (Issue #577; ID, name, riddle and description Owner-approved 2026-10-20). Inert until a catalog target
  // requires it (INV-TQ-4): no `RECIPES` entry does before P3. The raw id is never rendered (design §5.7 R6).
  {
    id: "dough-pinsa-romana",
    nameJa: "ピンサ生地",
    riddleJa: "同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。",
    descriptionJa: "空気を含んだ軽い食感が特徴の生地",
  },
  // 後乗せ (Issue #604 / #621; Owner 2026-10-22: N1 name, D1 description, R1 riddle). The riddle names neither the action nor the timing and is shown
  // from the affordance on; the description (which does say "after baking") is Dex-only, after the technique is discovered. Inert until a catalog
  // target declares a `late` value (INV-TQ-4): in Production no `RECIPES` entry does, so the affordance never opens and the Dex shows nothing.
  {
    id: "late-addition",
    nameJa: "後乗せ",
    riddleJa: "同じ材料でも、ひと手間の加え方で違う一枚になることがあるよ。",
    descriptionJa: "焼き上がったあとに、仕上げの具材をのせる調理法。香りや彩りが生きるよ。",
  },
];

export const KNOWN_TECHNIQUE_IDS: readonly string[] = TECHNIQUES.map((t) => t.id);

export function isTechniqueId(value: unknown): value is TechniqueId {
  return typeof value === "string" && KNOWN_TECHNIQUE_IDS.includes(value);
}
