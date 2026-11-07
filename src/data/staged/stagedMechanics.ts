/**
 * Staged mechanic registry (Issue #780 plan §5): every mechanic a staged recipe can wait for, its track (M1-M6), the
 * existing Issue / PR line that owns it, and its production state. `gate` names the build-time constant when the mechanic
 * exists but is OFF in Production. stagedCatalog.test.ts checks every GATED_OFF row against the gate file's literal (read as text, not imported,
 * so the unwired-isolation guards of those features keep holding) so this table cannot silently go stale.
 */
import type { StagedMechanicKey } from "./stagedTypes";

export type StagedMechanicState = "MISSING" | "GATED_OFF" | "PARTIAL";

export interface StagedMechanic {
  readonly key: StagedMechanicKey;
  readonly track: "M1" | "M2" | "M3" | "M4" | "M5" | "M6";
  readonly state: StagedMechanicState;
  readonly owner: string;
}

export const STAGED_MECHANICS: readonly StagedMechanic[] = [
  { key: "DOUGH_VARIANT", track: "M1", state: "PARTIAL", owner: "#577 (PR #775 PD-1a -> PD-1b/c -> PD-2 -> PD-3)" },
  { key: "PAN_PROFILE", track: "M2", state: "MISSING", owner: "#532 line (deep / shallow / steel pan: new design issue needed)" },
  { key: "DOUGH_SHAPE_TARGET", track: "M2", state: "MISSING", owner: "#532 / #536 (oval / boat / rectangle target: new design issue needed)" },
  { key: "ENCLOSE", track: "M3", state: "MISSING", owner: "#773 FOLD+SEAL (PR #785 F1, F2 lab)" },
  { key: "MID_BAKE", track: "M4", state: "MISSING", owner: "#604 / #611 (post_bake shipped; mid_bake: new issue needed)" },
  { key: "PREP", track: "M5", state: "GATED_OFF", owner: "#696" },
  { key: "FRY", track: "M5", state: "GATED_OFF", owner: "#749" },
  { key: "STEP_ORDER", track: "M6", state: "MISSING", owner: "new issue needed (cheese-under-sauce order)" },
  { key: "ZONED", track: "M6", state: "MISSING", owner: "#773 / PR #620 ZONED audit" },
  { key: "LAMINATE", track: "M6", state: "MISSING", owner: "new issue needed (deferral candidate, 1 recipe)" },
  { key: "MULTI_SPREAD_3", track: "M6", state: "MISSING", owner: "#521 (2 layers shipped; 3rd layer design only)" },
];

export function stagedMechanic(key: string): StagedMechanic | undefined {
  return STAGED_MECHANICS.find((m) => m.key === key);
}
