import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { TechniqueReveal } from "./TechniqueReveal";
import { TECHNIQUES } from "../data/techniques";

afterEach(cleanup);

/** Dough Kind P1 (#577) design §5.7 R6: the technique id never reaches the DOM (`dough-pinsa-romana` contains `romana`, the undiscovered recipe's name). */
describe("TechniqueReveal renders no raw technique id", () => {
  it("shows the name for every registered technique but no id in text or attributes", () => {
    for (const t of TECHNIQUES) {
      const { container } = render(<TechniqueReveal techniqueIds={[t.id]} />);
      expect(container).toHaveTextContent(`「${t.nameJa}」`);
      expect(container.querySelector("[data-technique-name]")).not.toBeNull();
      expect(container.innerHTML).not.toContain(t.id);
      cleanup();
    }
  });
});
