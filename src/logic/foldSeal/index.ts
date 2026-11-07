/**
 * FOLD+SEAL pure logic (Issue #773 T6-F1). UNWIRED: nothing in the game imports this directory (a test pins it). No UI, reducer, runtime, CSS, storage,
 * scoring, Dex, inventory, Research or hint effect; the `calzone` recipe is not added. Design: docs/reports/TETO_FOLD-SEAL_Design-Acceptance_2026-11-07.md.
 */
export * from "./foldSealConstants";
export * from "./foldSealGeometry";
export * from "./foldSealDoughShape";
export * from "./foldSealSeam";
export * from "./foldSealMachine";
