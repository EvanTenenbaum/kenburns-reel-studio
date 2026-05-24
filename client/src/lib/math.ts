/**
 * Pure math utilities for Ken Burns Reel Studio.
 * No React, no DOM — just math.
 */

/**
 * Linear interpolation between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Evaluate a cubic bezier curve at parameter t.
 * Uses De Casteljau's algorithm for numerical stability.
 *
 * @param t - Progress (0–1)
 * @param x1 - First control point X
 * @param y1 - First control point Y
 * @param x2 - Second control point X
 * @param y2 - Second control point Y
 * @returns The Y value at the given progress
 */
export function cubicBezier(t: number, x1: number, y1: number, x2: number, y2: number): number {
  // Find the t parameter for the given x using Newton-Raphson
  let guessT = t;

  for (let i = 0; i < 8; i++) {
    const currentX = sampleCurveX(guessT, x1, x2);
    const slope = sampleCurveDerivativeX(guessT, x1, x2);

    if (Math.abs(slope) < 1e-6) break;
    guessT -= (currentX - t) / slope;
  }

  guessT = clamp(guessT, 0, 1);
  return sampleCurveY(guessT, y1, y2);
}

function sampleCurveX(t: number, x1: number, x2: number): number {
  return ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
}

function sampleCurveY(t: number, y1: number, y2: number): number {
  return ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
}

function sampleCurveDerivativeX(t: number, x1: number, x2: number): number {
  return (3 * (1 - 3 * x2 + 3 * x1) * t + 2 * (3 * x2 - 6 * x1)) * t + 3 * x1;
}

/**
 * Named easing presets as cubic bezier control points.
 */
export const EASING_PRESETS = {
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  'ease-in': { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  'ease-out': { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  'ease-in-out': { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  'slow-start': { x1: 0.6, y1: 0, x2: 0.4, y2: 1 },
  'slow-end': { x1: 0.2, y1: 0, x2: 0.8, y2: 1 },
} as const;

/**
 * Apply an easing function to a progress value.
 */
export function applyEasing(
  progress: number,
  easing: { type: 'preset'; name: keyof typeof EASING_PRESETS } | { type: 'bezier'; x1: number; y1: number; x2: number; y2: number }
): number {
  const p = clamp(progress, 0, 1);

  if (easing.type === 'preset') {
    const { x1, y1, x2, y2 } = EASING_PRESETS[easing.name];
    return cubicBezier(p, x1, y1, x2, y2);
  }

  return cubicBezier(p, easing.x1, easing.y1, easing.x2, easing.y2);
}

/**
 * Convert milliseconds to a formatted time string (MM:SS.ms).
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}
