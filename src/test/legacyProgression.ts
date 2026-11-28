import { vi } from "vitest";

// Import before app modules in suites that assert the legacy rules.
vi.mock("../logic/progression/progressionModelFlag", async (importOriginal) => ({
  ...await importOriginal<typeof import("../logic/progression/progressionModelFlag")>(),
  PROGRESSION_MODEL_ID: "legacy",
  progressionModelId: () => "legacy",
}));
