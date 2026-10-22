import "@testing-library/jest-dom/vitest";

// Save Protection PR-3: jsdom's `localStorage` is one object for a whole test file, so the page-lifetime save session
// (state/saveSession.ts) must not leak from one test into the next.
import { afterEach } from "vitest";
import { resetSaveSessionsForTests } from "../state/saveSession";
afterEach(() => resetSaveSessionsForTests());
