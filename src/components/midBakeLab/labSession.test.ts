import { describe, expect, it } from "vitest";
import { createLabSession, labSessionReducer, labSnapshot, type LabSession, type LabSessionEvent } from "./labSession";
import { LAB_SCENARIOS, NATTO_LAB_SCENARIO, getLabScenario, labScenarioPlan, type LabScenario } from "./labIngredients";

const run = (session: LabSession, events: readonly LabSessionEvent[]) => events.reduce(labSessionReducer, session);
/** 100 ms frames (the per-frame cap) until `done` or `maxFrames`. */
function frames(session: LabSession, done: (s: LabSession) => boolean, maxFrames = 1000): LabSession {
  let s = session;
  for (let i = 0; i < maxFrames && !done(s); i++) s = labSessionReducer(s, { type: "FRAME", dtMs: 100 });
  return s;
}
const toHold = (s: LabSession) => frames(s, (x) => x.clock.status === "holding");
const tap = (ingredientId = "natto"): LabSessionEvent => ({ type: "ADD", ingredientId, op: "tap" });
const alt = (ingredientId = "natto"): LabSessionEvent => ({ type: "ADD", ingredientId, op: "alternative" });

describe("Lab scenarios (natto first)", () => {
  it("natto needs 2 pieces, offers tap + alternative, and produces a valid engine plan", () => {
    expect(getLabScenario(undefined)).toBe(NATTO_LAB_SCENARIO);
    expect(getLabScenario("unknown")).toBe(NATTO_LAB_SCENARIO);
    expect(LAB_SCENARIOS.map((s) => s.id)).toEqual(["natto"]);
    const plan = labScenarioPlan(NATTO_LAB_SCENARIO, 3000);
    expect(plan.requirements).toEqual([{ ingredientId: "natto", count: 2 }]);
    expect(() => createLabSession(NATTO_LAB_SCENARIO)).not.toThrow();
  });
});

describe("hold at the window start", () => {
  it("runs, then holds exactly at 65% with the engine in window-open", () => {
    const s = toHold(createLabSession(NATTO_LAB_SCENARIO));
    expect(s.clock.status).toBe("holding");
    expect(s.clock.elapsedMs).toBe(1950);
    expect(s.engine.status === "baking" && s.engine.stage).toBe("window-open");
    const snap = labSnapshot(s);
    expect(snap.trayOpen).toBe(true);
    expect(snap.positionPct).toBeCloseTo(65, 9);
    // The clock is frozen while holding.
    const later = run(s, [{ type: "FRAME", dtMs: 100 }]);
    expect(later.clock.elapsedMs).toBe(1950);
  });

  it("does not offer the tray before the hold", () => {
    const s = run(createLabSession(NATTO_LAB_SCENARIO), [{ type: "FRAME", dtMs: 100 }]);
    expect(labSnapshot(s).trayOpen).toBe(false);
  });

  it("two taps complete the additions, release the hold ('complete') and the bake finishes complete", () => {
    let s = run(toHold(createLabSession(NATTO_LAB_SCENARIO)), [tap()]);
    expect(s.clock.status).toBe("holding");
    s = run(s, [tap()]);
    expect(s.clock.status).toBe("running");
    expect(s.clock.released).toBe("complete");
    s = frames(s, (x) => x.clock.status === "finished");
    expect(s.engine.status === "finished" && s.engine.completion).toBe("complete");
    expect(labSnapshot(s).log).toMatchObject({ accepted: 2, acceptedDirect: 2, rejected: 0 });
  });

  it("'とじる' with too few pieces resumes and the bake ends missing-additions", () => {
    let s = run(toHold(createLabSession(NATTO_LAB_SCENARIO)), [tap(), { type: "CLOSE" }]);
    expect(s.clock.released).toBe("closed");
    s = frames(s, (x) => x.clock.status === "finished");
    expect(s.engine.status === "finished" && s.engine.completion).toBe("missing-additions");
    expect(labSnapshot(s).log.holdActiveMs).toBe(0);
  });

  it("the provisional timeout resumes by itself; later taps are rejected and the bake misses", () => {
    let s = toHold(createLabSession(NATTO_LAB_SCENARIO, { holdTimeoutMs: 500 }));
    s = frames(s, (x) => x.clock.status !== "holding");
    expect(s.clock.released).toBe("timeout");
    s = run(s, [tap()]);
    expect(labSnapshot(s).log.rejectedByReason["not-holding"]).toBe(1);
    s = frames(s, (x) => x.clock.status === "finished");
    expect(s.engine.status === "finished" && s.engine.completion).toBe("missing-additions");
    expect(labSnapshot(s).log.holdActiveMs).toBe(500);
  });
});

describe("rejections", () => {
  it("taps before the hold and after the resume are rejected with 'not-holding' (no engine ADD)", () => {
    const early = run(createLabSession(NATTO_LAB_SCENARIO), [tap()]);
    expect(labSnapshot(early).log.rejectedByReason["not-holding"]).toBe(1);
    expect(early.engine).toEqual(createLabSession(NATTO_LAB_SCENARIO).engine);
  });

  it("a third piece, an unknown ingredient and an unsupported op are rejected without changing the additions", () => {
    const held = toHold(createLabSession(NATTO_LAB_SCENARIO, { holdAtWindowStart: true }));
    const one = run(held, [tap()]);
    const scenario: LabScenario = { ...NATTO_LAB_SCENARIO, ingredients: [{ ...NATTO_LAB_SCENARIO.ingredients[0], ops: ["tap"] }] };
    const tapOnly = run(toHold(createLabSession(scenario)), [alt()]);
    expect(labSnapshot(tapOnly).log.rejectedByReason["unsupported-op"]).toBe(1);
    const unknown = run(one, [tap("okra")]);
    expect(labSnapshot(unknown).log.rejectedByReason["unknown-ingredient"]).toBe(1);
    const full = run(one, [tap(), tap()]);
    expect(full.engine.status === "baking" && full.engine.additions).toHaveLength(2);
    expect(labSnapshot(full).log.rejectedByReason["not-holding"]).toBe(1); // released on completion, so the third is not-holding
  });

  it("over-limit is reported while still holding (a second ingredient still missing)", () => {
    const scenario: LabScenario = {
      id: "two",
      label: "two",
      recipeId: "x",
      ingredients: [
        { ingredientId: "natto", label: "n", glyph: "n", count: 1, ops: ["tap"] },
        { ingredientId: "french-fries", label: "f", glyph: "f", count: 1, requiredState: "fried", ops: ["tap"] },
      ],
    };
    const s = run(toHold(createLabSession(scenario)), [tap("natto"), tap("natto")]);
    expect(s.clock.status).toBe("holding");
    expect(labSnapshot(s).log).toMatchObject({ accepted: 1, rejected: 1 });
    expect(labSnapshot(s).log.rejectedByReason["over-limit"]).toBe(1);
  });
});

describe("input methods resolve to the same ADD", () => {
  it("tap and alternative produce identical additions except for the input label", () => {
    const direct = run(toHold(createLabSession(NATTO_LAB_SCENARIO)), [tap(), tap()]);
    const alternative = run(toHold(createLabSession(NATTO_LAB_SCENARIO)), [alt(), alt()]);
    const strip = (s: LabSession) => (s.engine.status === "idle" ? [] : s.engine.additions.map(({ input: _input, ...rest }) => rest));
    expect(strip(direct)).toEqual(strip(alternative));
    expect(direct.clock).toEqual(alternative.clock);
    const inputs = (s: LabSession) => (s.engine.status === "idle" ? [] : s.engine.additions.map((a) => a.input));
    expect(inputs(direct)).toEqual(["direct", "direct"]);
    expect(inputs(alternative)).toEqual(["alternative", "alternative"]);
  });
});

describe("extensibility: a second ingredient with a required state", () => {
  const scenario: LabScenario = {
    id: "fries",
    label: "fries",
    recipeId: "lomo-saltado",
    ingredients: [{ ingredientId: "french-fries", label: "ポテト", glyph: "🍟", count: 2, requiredState: "fried", ops: ["tap"] }],
  };
  it("hands over the required state and completes like natto, with no session code change", () => {
    const s = run(toHold(createLabSession(scenario)), [tap("french-fries"), tap("french-fries")]);
    expect(s.engine.status === "baking" && s.engine.additions.map((a) => a.ingredientState)).toEqual(["fried", "fried"]);
    expect(s.clock.released).toBe("complete");
  });
});

describe("plain clock (no hold) for comparison", () => {
  it("never opens the tray and misses, like an unmodified BAKE", () => {
    let s = createLabSession(NATTO_LAB_SCENARIO, { holdAtWindowStart: false });
    for (let i = 0; i < 40; i++) {
      s = run(s, [{ type: "FRAME", dtMs: 100 }]);
      expect(labSnapshot(s).trayOpen).toBe(false);
    }
    expect(s.engine.status === "finished" && s.engine.completion).toBe("missing-additions");
  });
});
