import "./inject";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/App.css";
import "./board.css";
import { Board } from "./QaBoard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Board />
  </StrictMode>,
);
