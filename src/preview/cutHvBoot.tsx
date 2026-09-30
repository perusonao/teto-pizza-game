import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { isCutHvRequested } from "./cutHvActivation";
import { CutHvPage } from "./CutHvPage";

/** Renders the CUT HV page and returns true only for an explicit `?cuthv=1`; false means "do nothing". */
export function bootCutHvIfRequested(root: Root, search: string): boolean {
  if (!isCutHvRequested(search)) return false;
  root.render(
    <StrictMode>
      <CutHvPage />
    </StrictMode>,
  );
  return true;
}
