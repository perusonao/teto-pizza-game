/** The provisional final-third window. Kept here so Owner review changes one authority. */
export const DEFAULT_MID_BAKE_WINDOW = { start: 0.65, end: 0.9 } as const;

export interface MidBakeWindow {
  readonly start: number;
  readonly end: number;
}

export type MidBakeStage = "before-window" | "window-open" | "rebaking" | "done";

export function isValidMidBakeWindow(window: MidBakeWindow): boolean {
  return Number.isFinite(window.start) && Number.isFinite(window.end) && window.start >= 0 && window.start < window.end && window.end <= 1;
}

export function sanitizeBakeProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

/** The addition window is half-open: its end already belongs to rebaking. */
export function midBakeStageAt(progress: number, window: MidBakeWindow = DEFAULT_MID_BAKE_WINDOW): MidBakeStage {
  if (!isValidMidBakeWindow(window)) throw new Error("Invalid MID_BAKE window");
  const value = sanitizeBakeProgress(progress);
  if (value >= 1) return "done";
  if (value < window.start) return "before-window";
  if (value < window.end) return "window-open";
  return "rebaking";
}

export function progressFromElapsed(elapsedMs: number, totalBakeMs: number): number {
  if (!Number.isFinite(totalBakeMs) || totalBakeMs <= 0) return 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return sanitizeBakeProgress(elapsedMs / totalBakeMs);
}
