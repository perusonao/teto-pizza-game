import { createContext } from "react";
import type { DedicatedVisualKey } from "./candidates";

export type VisualMap = Partial<Record<string, DedicatedVisualKey | null>>;

/** QA board only: overrides the page-level choice for one subtree, so A/B or before/after rows
 *  can sit side by side (`null` = force the plain emoji). */
export const W1VisualOverride = createContext<VisualMap>({});
