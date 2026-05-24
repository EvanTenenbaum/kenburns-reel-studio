/**
 * Ken Burns animation engine.
 * Pure computation — NO React, NO DOM dependencies.
 * Only depends on types/ and lib/.
 */

import type { Viewport, KenBurnsConfig, EasingConfig } from '@/types/kenburns';
import { lerp, clamp, applyEasing } from '@/lib/math';

/**
 * Compute the viewport at a given time within a clip.
 *
 * @param config - Ken Burns configuration with start/end viewports and easing
 * @param timeInClip - Current time within the clip in ms
 * @param clipDuration - Total clip duration in ms
 * @returns Interpolated viewport at the given time
 */
export function computeViewportAtTime(
  config: KenBurnsConfig,
  timeInClip: number,
  clipDuration: number
): Viewport {
  const progress = clamp(timeInClip / clipDuration, 0, 1);
  const easedProgress = applyEasing(progress, config.easing);
  const { startViewport: s, endViewport: e } = config;

  return {
    x: lerp(s.x, e.x, easedProgress),
    y: lerp(s.y, e.y, easedProgress),
    zoom: lerp(s.zoom, e.zoom, easedProgress),
  };
}

/**
 * Clamp a viewport to prevent showing empty space outside the image.
 *
 * @param vp - Viewport to clamp
 * @param imgAspect - Source image aspect ratio (width / height)
 * @param canvasAspect - Canvas aspect ratio (width / height)
 * @returns Clamped viewport that stays within image bounds
 */
export function clampViewport(
  vp: Viewport,
  imgAspect: number,
  canvasAspect: number
): Viewport {
  // Minimum zoom to ensure cover-fit (no empty space)
  const minZoom = imgAspect > canvasAspect
    ? 1 // Landscape image: height-fit is cover
    : canvasAspect / imgAspect; // Portrait image: width-fit is cover

  const zoom = Math.max(vp.zoom, minZoom);

  // Compute half of the visible area in normalized coordinates
  const halfVisX = 0.5 / zoom;
  const halfVisY = (0.5 / zoom) * (canvasAspect / imgAspect);

  return {
    x: clamp(vp.x, halfVisX, 1 - halfVisX),
    y: clamp(vp.y, halfVisY, 1 - halfVisY),
    zoom,
  };
}

/**
 * Convert a viewport to a CSS transform string for preview rendering.
 * The image should be sized to cover-fit the container at zoom=1.
 *
 * @param vp - Current viewport
 * @param containerW - Container width in pixels
 * @param containerH - Container height in pixels
 * @returns CSS transform string
 */
export function viewportToCSS(
  vp: Viewport,
  containerW: number,
  containerH: number
): string {
  const scale = vp.zoom;
  const tx = (0.5 - vp.x) * containerW;
  const ty = (0.5 - vp.y) * containerH;
  return `scale(${scale}) translate(${tx}px, ${ty}px)`;
}

/**
 * Convert a viewport to source rectangle coordinates for canvas drawImage.
 * Used during export rendering.
 *
 * @param vp - Current viewport
 * @param imgW - Source image width in pixels
 * @param imgH - Source image height in pixels
 * @param canvasW - Output canvas width in pixels
 * @param canvasH - Output canvas height in pixels
 * @returns Source rectangle { sx, sy, sw, sh } for ctx.drawImage()
 */
export function viewportToSourceRect(
  vp: Viewport,
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number
): { sx: number; sy: number; sw: number; sh: number } {
  const canvasAspect = canvasW / canvasH;
  const imgAspect = imgW / imgH;

  // Base: cover-fit the image to canvas
  let baseW: number;
  let baseH: number;
  if (imgAspect > canvasAspect) {
    // Landscape image: fit height, crop width
    baseH = imgH;
    baseW = imgH * canvasAspect;
  } else {
    // Portrait image: fit width, crop height
    baseW = imgW;
    baseH = imgW / canvasAspect;
  }

  // Apply zoom: visible region shrinks as zoom increases
  const visW = baseW / vp.zoom;
  const visH = baseH / vp.zoom;

  // Center at viewport position
  const sx = vp.x * imgW - visW / 2;
  const sy = vp.y * imgH - visH / 2;

  return { sx, sy, sw: visW, sh: visH };
}

/**
 * Compute the minimum zoom level that ensures cover-fit.
 */
export function computeMinZoom(imgAspect: number, canvasAspect: number): number {
  return imgAspect > canvasAspect ? 1 : canvasAspect / imgAspect;
}

/**
 * Interpolate between two viewports with a given easing.
 * Convenience wrapper for computeViewportAtTime when you already have progress.
 */
export function interpolateViewport(
  start: Viewport,
  end: Viewport,
  progress: number,
  easing: EasingConfig
): Viewport {
  const easedProgress = applyEasing(clamp(progress, 0, 1), easing);
  return {
    x: lerp(start.x, end.x, easedProgress),
    y: lerp(start.y, end.y, easedProgress),
    zoom: lerp(start.zoom, end.zoom, easedProgress),
  };
}
