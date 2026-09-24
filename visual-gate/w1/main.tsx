import "./inject";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "./gate.css";
import App from "../../src/App.tsx";
import { PreviewRibbon } from "./PreviewRibbon";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <PreviewRibbon />
  </StrictMode>,
);
