/**
 * Steam Gameplay V2 for Issue #755: each shell has its own opening time and
 * overcook window. A player rescues a shell by tapping it while it is plump.
 *
 * This is a standalone Preview/DEV Lab only. No game reducer, score, recipe,
 * storage, inventory, Dex or production Steam dependency. Caller owns the clock.
 * Different visible batches are deterministic and contain no hidden randomness.
 */
export type SteamV2Heat = "low" | "high";
export type SteamV2Batch = "clam" | "mussel";
export type SteamV2ShellStatus = "closed" | "ready" | "over" | "rescued" | "missed";
export type SteamV2Verdict = "perfect" | "partial" | "missed";

export interface SteamV2Shell {
  readonly label: string;
  readonly size: number;
  /** Heat-progress level at which this shell is fully open. */
  readonly opensAt: number;
  /** Exposure limit after opening. Strong fire incurs exposure faster. */
  readonly tolerance: number;
}

export const STEAM_V2_BATCHES: Record<SteamV2Batch, { label: string; shells: readonly SteamV2Shell[] }> = {
  clam: {
    label: "あさり・大小まざり",
    shells: [
      { label: "小ぶり", size: 0.86, opensAt: 0.28, tolerance: 0.90 },
      { label: "ふつう", size: 1, opensAt: 0.40, tolerance: 1.08 },
      { label: "ふつう", size: 1.04, opensAt: 0.53, tolerance: 1.20 },
      { label: "大きめ", size: 1.12, opensAt: 0.67, tolerance: 1.36 },
      { label: "大ぶり", size: 1.22, opensAt: 0.82, tolerance: 1.48 },
    ],
  },
  mussel: {
    label: "ムール貝・大粒",
    shells: [
      { label: "小ぶり", size: 0.94, opensAt: 0.34, tolerance: 0.84 },
      { label: "ふつう", size: 1.08, opensAt: 0.47, tolerance: 1.03 },
      { label: "大きめ", size: 1.17, opensAt: 0.62, tolerance: 1.17 },
      { label: "大ぶり", size: 1.24, opensAt: 0.77, tolerance: 1.35 },
      { label: "特大", size: 1.30, opensAt: 0.94, tolerance: 1.50 },
    ],
  },
};

/** Strong fire speeds cooking, but shrinks ready shells much sooner. */
export const STEAM_V2_PROGRESS_PER_SECOND = { low: 0.12, high: 0.22 } as const;
export const STEAM_V2_EXPOSURE_PER_SECOND = { low: 0.29, high: 1.0 } as const;
const TOTAL = 5;

export interface SteamV2Cooking {
  status: "cooking";
  batch: SteamV2Batch;
  startedAt: number;
  lastAt: number;
  heat: SteamV2Heat;
  progress: number;
  exposure: readonly number[];
  rescued: readonly boolean[];
}

export interface SteamV2Result {
  batch: SteamV2Batch;
  verdict: SteamV2Verdict;
  rescuedCount: number;
  shells: readonly SteamV2ShellStatus[];
  elapsedMs: number;
}

export type SteamV2State =
  | { status: "idle" }
  | SteamV2Cooking
  | { status: "released"; result: SteamV2Result };

export type SteamV2Action =
  | { type: "START"; now: number; batch: SteamV2Batch }
  | { type: "SET_HEAT"; heat: SteamV2Heat; now: number }
  | { type: "PICK"; index: number; now: number }
  | { type: "OPEN"; now: number }
  | { type: "INTERRUPT" }
  | { type: "RESET" };

export const STEAM_V2_IDLE: SteamV2State = { status: "idle" };

function validTime(now: number, lastAt: number): boolean {
  return Number.isFinite(now) && now >= lastAt;
}

function validBatch(batch: SteamV2Batch): boolean {
  return batch === "clam" || batch === "mussel";
}

/** Integrate only the fraction of an interval AFTER each shell opens. */
export function steamV2Advance(s: SteamV2Cooking, now: number): SteamV2Cooking {
  if (!validTime(now, s.lastAt) || now === s.lastAt) return s;
  const elapsed = (now - s.lastAt) / 1000;
  const speed = STEAM_V2_PROGRESS_PER_SECOND[s.heat];
  const exposureSpeed = STEAM_V2_EXPOSURE_PER_SECOND[s.heat];
  const shells = STEAM_V2_BATCHES[s.batch].shells;
  return {
    ...s,
    lastAt: now,
    progress: Math.min(1.5, s.progress + elapsed * speed),
    exposure: shells.map((shell, index) => {
      if (s.rescued[index]) return s.exposure[index];
      const crossingIn = Math.max(0, (shell.opensAt - s.progress) / speed);
      const openedSeconds = Math.max(0, elapsed - crossingIn);
      return s.exposure[index] + openedSeconds * exposureSpeed;
    }),
  };
}

function shellStatus(s: SteamV2Cooking, index: number): SteamV2ShellStatus {
  if (s.rescued[index]) return "rescued";
  const shell = STEAM_V2_BATCHES[s.batch].shells[index];
  if (s.progress < shell.opensAt - 1e-8) return "closed";
  return s.exposure[index] < shell.tolerance ? "ready" : "over";
}

export function steamV2Snapshot(state: SteamV2State, now: number): {
  status: SteamV2State["status"];
  batch: SteamV2Batch | null;
  heat: SteamV2Heat | null;
  shells: readonly SteamV2ShellStatus[];
  readyCount: number;
  rescuedCount: number;
  overCount: number;
  verdict: SteamV2Verdict | null;
} {
  if (state.status === "idle") return { status: "idle", batch: null, heat: null, shells: ["closed", "closed", "closed", "closed", "closed"], readyCount: 0, rescuedCount: 0, overCount: 0, verdict: null };
  if (state.status === "released") {
    const statuses = state.result.shells;
    return {
      status: "released",
      batch: state.result.batch,
      heat: null,
      shells: statuses,
      readyCount: 0,
      rescuedCount: state.result.rescuedCount,
      overCount: statuses.filter((x) => x === "over").length,
      verdict: state.result.verdict,
    };
  }
  const s = steamV2Advance(state, now);
  const statuses = STEAM_V2_BATCHES[s.batch].shells.map((_, i) => shellStatus(s, i));
  return {
    status: "cooking",
    batch: s.batch,
    heat: s.heat,
    shells: statuses,
    readyCount: statuses.filter((x) => x === "ready").length,
    rescuedCount: statuses.filter((x) => x === "rescued").length,
    overCount: statuses.filter((x) => x === "over").length,
    verdict: null,
  };
}

export function steamV2Reducer(state: SteamV2State, action: SteamV2Action): SteamV2State {
  switch (action.type) {
    case "START":
      return state.status === "idle" && validBatch(action.batch) && Number.isFinite(action.now)
        ? {
            status: "cooking",
            batch: action.batch,
            startedAt: action.now,
            lastAt: action.now,
            heat: "low",
            progress: 0,
            exposure: Array(TOTAL).fill(0) as number[],
            rescued: Array(TOTAL).fill(false) as boolean[],
          }
        : state;
    case "SET_HEAT":
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt)) return state;
      if (action.heat !== "low" && action.heat !== "high") return state;
      return { ...steamV2Advance(state, action.now), heat: action.heat };
    case "PICK": {
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt)) return state;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= TOTAL) return state;
      const s = steamV2Advance(state, action.now);
      if (shellStatus(s, action.index) !== "ready") return s;
      return { ...s, rescued: s.rescued.map((saved, i) => i === action.index ? true : saved) };
    }
    case "OPEN": {
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt)) return state;
      const s = steamV2Advance(state, action.now);
      const shells = STEAM_V2_BATCHES[s.batch].shells.map((_, i) => {
        const status = shellStatus(s, i);
        return status === "closed" || status === "ready" ? "missed" : status;
      }) as SteamV2ShellStatus[];
      const rescuedCount = shells.filter((x) => x === "rescued").length;
      return {
        status: "released",
        result: {
          batch: s.batch,
          verdict: rescuedCount === TOTAL ? "perfect" : rescuedCount === 0 ? "missed" : "partial",
          rescuedCount,
          shells,
          elapsedMs: action.now - s.startedAt,
        },
      };
    }
    case "INTERRUPT":
      return state.status === "cooking" ? STEAM_V2_IDLE : state;
    case "RESET":
      return STEAM_V2_IDLE;
  }
}
