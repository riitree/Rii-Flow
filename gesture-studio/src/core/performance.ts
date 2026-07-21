export const MAX_COMPOSITION_FPS = 60;

export function normalizedCompositionFps(frameRate: number) {
  if (!Number.isFinite(frameRate) || frameRate <= 0) return 30;
  return Math.min(MAX_COMPOSITION_FPS, Math.max(1, frameRate));
}

export function compositionFrameBudget(frameRate: number) {
  return 1000 / normalizedCompositionFps(frameRate);
}

/**
 * Keeps composition aligned with the granted camera/recording rate instead of
 * blindly redrawing at the display's refresh rate. A small tolerance avoids
 * losing 60 fps to requestAnimationFrame timestamp jitter.
 */
export function shouldComposeFrame(now: number, lastComposedAt: number, frameRate: number) {
  if (!Number.isFinite(lastComposedAt)) return true;
  return now - lastComposedAt >= Math.max(0, compositionFrameBudget(frameRate) - 1);
}

export interface CompositionHealth {
  fps: number;
  averageMs: number;
  budgetPercent: number;
  overBudgetFrames: number;
}

export function compositionHealth(
  frames: number,
  totalComposeMs: number,
  elapsedMs: number,
  frameRate: number,
  overBudgetFrames: number
): CompositionHealth {
  const safeFrames = Math.max(0, frames);
  const averageMs = safeFrames ? totalComposeMs / safeFrames : 0;
  return {
    fps: elapsedMs > 0 ? Math.round((safeFrames * 1000) / elapsedMs) : 0,
    averageMs: Math.round(averageMs * 10) / 10,
    budgetPercent: Math.round((averageMs / compositionFrameBudget(frameRate)) * 100),
    overBudgetFrames: Math.max(0, Math.round(overBudgetFrames))
  };
}
