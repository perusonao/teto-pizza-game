/**
 * Eggplant (ナス) provisional state palette. PROVISIONAL: the colours come from the design candidate
 * `docs/design/candidates/ingredient-icons-2.0-eggplant-fry/eggplant-a-states.css` (Style Lock V2 §12, A = round slices)
 * and are NOT Owner-approved. Fry (Issue #749 F2+) is on HOLD, so the three fried values are placeholders for a hook, not a spec.
 * Exported so the tests / comparison sheet read one source.
 */
export type EggplantState =
  | "raw"
  | "baked-good"
  | "baked-burnt"
  | "fried-crisp"
  | "fried-over"
  | "fried-baked";

export const EGGPLANT_STATES: readonly EggplantState[] = [
  "raw",
  "baked-good",
  "baked-burnt",
  "fried-crisp",
  "fried-over",
  "fried-baked",
];

export interface EggplantTones {
  skin: string;
  /** Normal outline (skin ring stroke). */
  line: string;
  /** Darker outline used by `outline="strong"` (line x 0.5). */
  lineStrong: string;
  flesh: string;
  rim: string;
  core: string;
  seed: string;
  /** Fried crust ring opacity (0..1). */
  crust: number;
  /** Fried sheen opacity (0..1). */
  sheen: number;
}

export const EGGPLANT_PALETTE: Record<EggplantState, EggplantTones> = {
  raw: { skin: "#62407b", line: "#25182f", lineStrong: "#120c18", flesh: "#f2e6b6", rim: "#cdb974", core: "#e8d9a4", seed: "#9e916d", crust: 0, sheen: 0 },
  "baked-good": { skin: "#54366b", line: "#201529", lineStrong: "#100a14", flesh: "#e6c27a", rim: "#b68a3e", core: "#d9b269", seed: "#977c4a", crust: 0, sheen: 0 },
  "baked-burnt": { skin: "#2e1f38", line: "#110c15", lineStrong: "#08060a", flesh: "#8f6a36", rim: "#4d2f16", core: "#7d592d", seed: "#654923", crust: 0, sheen: 0 },
  "fried-crisp": { skin: "#6f4590", line: "#2a1a37", lineStrong: "#150d1c", flesh: "#f2a92a", rim: "#c4781f", core: "#e59b27", seed: "#9e6e1c", crust: 0.9, sheen: 0.55 },
  "fried-over": { skin: "#3b2547", line: "#160e1b", lineStrong: "#0b070e", flesh: "#7a4a1c", rim: "#3a1f0b", core: "#683e17", seed: "#583714", crust: 1, sheen: 0.1 },
  "fried-baked": { skin: "#5e3a7a", line: "#24162e", lineStrong: "#120b17", flesh: "#dd9022", rim: "#a8661a", core: "#ce8420", seed: "#925f17", crust: 0.9, sheen: 0.43 },
};
