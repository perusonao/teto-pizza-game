import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../App";
import mainSource from "../main.tsx?raw";

/**
 * The Discovery Progression Inspector is not reachable from normal production navigation. The bundle-level
 * proof (a real production `vite build` holds no Inspector code) is in ../preview/previewIsolation.gate.test.ts.
 */

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("Inspector is unreachable from the normal app", () => {
  it("<App /> never renders the Inspector, even with ?inspector=discovery in the URL", () => {
    window.history.replaceState(null, "", "/?inspector=discovery");
    render(<App />);
    expect(screen.queryByText("Discovery Progression Inspector")).toBeNull();
    expect(document.querySelector("[data-inspector]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Discovery Progression Inspector|Inspector/);
  });

  it("no production source outside src/dev and src/main.tsx refers to the Inspector or its URL parameter", () => {
    const sources = import.meta.glob(["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx", "!../dev/**", "!../main.tsx"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    for (const [file, text] of Object.entries(sources)) {
      expect(text, file).not.toMatch(/inspector=discovery|DiscoveryProgressionInspector|Discovery Progression Inspector|discoveryProgressionModel/);
    }
  });

  it("main.tsx reaches it only behind the DEV / Preview env check, through a dynamic import", () => {
    const guard = /\(import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_PREVIEW_MODE\) &&\s*new URLSearchParams\(window\.location\.search\)\.get\('inspector'\) === 'discovery'/;
    expect(mainSource).toMatch(guard);
    // Every mention (the import path, the destructured name, the element) is inside the one guarded branch.
    const branch = mainSource.slice(mainSource.indexOf("if (inspectorRequested)"), mainSource.indexOf("} else {"));
    expect(mainSource.match(/DiscoveryProgressionInspector/g)?.length).toBe(branch.match(/DiscoveryProgressionInspector/g)?.length);
    expect(mainSource).toMatch(/import\('\.\/dev\/DiscoveryProgressionInspector'\)/);
    expect(mainSource).not.toMatch(/^import .*DiscoveryProgressionInspector/m);
  });
});
