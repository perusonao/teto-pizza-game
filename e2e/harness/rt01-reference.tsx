/** RT-01 harness entry (see ./rt01-reference-cases.tsx for what it renders and why). */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/App.css";
import { Harness } from "./rt01-reference-cases";

const style = document.createElement("style");
style.textContent = `
  body { margin: 0; background: #fbf4e6; }
  .rt01-harness { padding: 12px 16px 48px; font-family: system-ui, "Hiragino Sans", sans-serif; color: #3a2a1c; }
  .rt01-harness h1 { font-size: 18px; margin: 4px 0 12px; }
  .rt01-case { background: #fffdf8; border: 1px solid #e6d7bd; border-radius: 12px; padding: 10px 12px; margin: 0 0 12px; }
  .rt01-case__title { font-size: 16px; margin: 0; }
  .rt01-case__count { font-size: 13px; color: #8a5a2b; margin-left: 6px; }
  .rt01-case__note, .rt01-case__caption { font-size: 12px; margin: 2px 0; color: #6b5d50; }
  .rt01-case__views { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 6px; }
  .rt01-view { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: #6b5d50; }
  .rt01-view .player-reference-mini-pizza { margin: 0; }
  .rt01-compare { border-radius: 12px; padding: 8px 10px; margin: 10px 0; }
  .rt01-compare--before { background: #fdecea; border: 2px solid #e8a39b; }
  .rt01-compare--after { background: #eaf6ec; border: 2px solid #9bcfa5; }
  .rt01-compare__label { font-size: 14px; margin: 0 0 4px; }
  .rt01-view.pizza-select-grid-card { padding: 0; border: 0; background: none; box-shadow: none; min-height: 0; width: auto; }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
