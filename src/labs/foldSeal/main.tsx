import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FoldSealLab } from "./FoldSealLab";

/** DEV-only entry (Issue #773 T6-F2). foldseal-lab.html is not part of any build, so this file is unreachable from index.html, production and Preview. */
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <FoldSealLab />
    </StrictMode>,
  );
}
