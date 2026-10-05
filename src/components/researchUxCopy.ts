/** Discovery 3.0 Research Flow UX Phase 1: fixed Research copy. Every string is the same for every target, outcome and
 *  pool size: it names no recipe, ingredient, count or fact, and says nothing a hidden property could change (Contract 2.1).
 *  The ○× wording makes no promise for every ingredient: known ✓ ingredients and toppings past the K = 3 cap are not judged. */
export const RESEARCH_UX_COPY = {
  /** PREPARE, Research Target valid at the round's start (○× will be shown at RESULT). */
  prepareGuidance: "材料を足して試そう。焼くと使った材料の○×がわかるよ",
  /** PREPARE, Research Target not valid at the round's start (no ○× this round): no promise of a verdict. */
  prepareGuidanceNoRows: "試作ノートを見て、次に試す材料を考えよう",
  /** RESULT (Research ORIGINAL): replaces the general free-cook sentence, which is about Dex matches. */
  resultNote: "試作結果とノートを見て、次に試す材料を考えてみよう。",
  /** The PREPARE card's direct Notebook entry. */
  notebookEntry: "\u{1F4D3} 試作ノート",
  notebookBack: "もどる",
  /** The Research label line shared by the PREPARE card and the Hint sheet (one format). */
  contextLine: (labelJa: string): string => `\u{1F50E} 研究中 ${labelJa}`,
} as const;
