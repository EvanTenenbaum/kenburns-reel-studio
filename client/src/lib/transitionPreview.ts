/**
 * Preview-side transition styling. Produces opacity / transform / overlay
 * values for two stacked clip layers during a transition. Pure — no React/DOM.
 */

import type { TransitionType } from '@/types/project';

export interface TransitionPreviewStyle {
  fromOpacity: number;
  toOpacity: number;
  /** Extra transform applied to the outgoing layer wrapper */
  fromTransform: string;
  /** Extra transform applied to the incoming layer wrapper */
  toTransform: string;
  /** Solid overlay color for fade-through transitions */
  overlayColor: string | null;
  overlayOpacity: number;
  fromBlurPx: number;
  toBlurPx: number;
}

const NONE: TransitionPreviewStyle = {
  fromOpacity: 1,
  toOpacity: 0,
  fromTransform: 'none',
  toTransform: 'none',
  overlayColor: null,
  overlayOpacity: 0,
  fromBlurPx: 0,
  toBlurPx: 0,
};

export function getTransitionPreviewStyle(
  type: TransitionType,
  progress: number
): TransitionPreviewStyle {
  const p = clampUnit(progress);

  switch (type) {
    case 'cut':
      return { ...NONE, fromOpacity: p < 1 ? 1 : 0, toOpacity: p < 1 ? 0 : 1 };

    case 'crossfade':
      return { ...NONE, fromOpacity: 1, toOpacity: p };

    case 'fade-through-black':
    case 'fade-through-white':
      return {
        ...NONE,
        fromOpacity: p < 0.5 ? 1 : 0,
        toOpacity: p < 0.5 ? 0 : 1,
        overlayColor: type === 'fade-through-black' ? '#000000' : '#ffffff',
        overlayOpacity: 1 - Math.abs(p - 0.5) * 2,
      };

    case 'slide-left':
      return {
        ...NONE,
        fromOpacity: 1,
        toOpacity: 1,
        fromTransform: `translateX(${(-p * 100).toFixed(2)}%)`,
        toTransform: `translateX(${((1 - p) * 100).toFixed(2)}%)`,
      };

    case 'slide-right':
      return {
        ...NONE,
        fromOpacity: 1,
        toOpacity: 1,
        fromTransform: `translateX(${(p * 100).toFixed(2)}%)`,
        toTransform: `translateX(${(-(1 - p) * 100).toFixed(2)}%)`,
      };

    case 'zoom-through':
      return {
        ...NONE,
        fromOpacity: 1 - p,
        toOpacity: p,
        fromTransform: `scale(${(1 + 0.3 * p).toFixed(3)})`,
        toTransform: `scale(${(0.7 + 0.3 * p).toFixed(3)})`,
      };

    case 'blur-transition':
      return {
        ...NONE,
        fromOpacity: 1,
        toOpacity: p,
        fromBlurPx: p * (1 - p) * 40,
        toBlurPx: p * (1 - p) * 40,
      };

    default:
      return { ...NONE, fromOpacity: 1, toOpacity: p };
  }
}

function clampUnit(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
