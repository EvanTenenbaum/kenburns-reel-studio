/**
 * Bridges the Ken Burns engine to the preview. Given a clip and a time within
 * that clip, returns the clamped viewport and a CSS transform string.
 */

import { useCallback } from 'react';
import {
  computeViewportAtTime,
  clampViewport,
  viewportToCSS,
} from '@/engine/kenburns';
import type { Clip } from '@/types/project';
import type { Viewport } from '@/types/kenburns';

export function useKenBurns(canvasAspect: number) {
  const getViewport = useCallback(
    (clip: Clip, timeInClip: number): Viewport => {
      const raw = computeViewportAtTime(clip.kenburns, timeInClip, clip.duration);
      const imgAspect =
        clip.naturalHeight > 0 ? clip.naturalWidth / clip.naturalHeight : 1;
      return clampViewport(raw, imgAspect, canvasAspect);
    },
    [canvasAspect]
  );

  const getTransform = useCallback(
    (clip: Clip, timeInClip: number, containerW: number, containerH: number): string => {
      const vp = getViewport(clip, timeInClip);
      return viewportToCSS(vp, containerW, containerH);
    },
    [getViewport]
  );

  /** Clamp an arbitrary viewport to a clip's image so it stays cover-fit. */
  const clampForClip = useCallback(
    (clip: Clip, vp: Viewport): Viewport => {
      const imgAspect =
        clip.naturalHeight > 0 ? clip.naturalWidth / clip.naturalHeight : 1;
      return clampViewport(vp, imgAspect, canvasAspect);
    },
    [canvasAspect]
  );

  return { getViewport, getTransform, clampForClip };
}
