import type { Viewport } from '@/types/kenburns';

/**
 * Geometry helpers for the on-image motion editor.
 *
 * Pure functions only — NO React/DOM imports. These mirror the export-time
 * Ken Burns math exactly so the editor is WYSIWYG against the rendered reel.
 */

/** A rectangle in container (screen) pixels. */
export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How the full image is laid out "contain" inside the editor container. */
export interface ImageDisplay {
  scale: number;
  offsetX: number;
  offsetY: number;
  dispW: number;
  dispH: number;
}

/** Maximum zoom the motion editor allows. */
export const MAX_MOTION_ZOOM = 4;

/**
 * Cover-fit base region (in image pixels) for a given output aspect ratio.
 * This is the visible crop when zoom === 1.
 */
export function coverBase(
  imgW: number,
  imgH: number,
  canvasAspect: number,
): { baseW: number; baseH: number } {
  const imgAspect = imgW / imgH;
  let baseW: number;
  let baseH: number;
  if (imgAspect > canvasAspect) {
    baseH = imgH;
    baseW = imgH * canvasAspect;
  } else {
    baseW = imgW;
    baseH = imgW / canvasAspect;
  }
  return { baseW, baseH };
}

/**
 * Compute how the full image is shown "contain" within the container.
 */
export function computeImageDisplay(
  imgW: number,
  imgH: number,
  containerW: number,
  containerH: number,
): ImageDisplay {
  const scale = Math.min(containerW / imgW, containerH / imgH);
  const dispW = imgW * scale;
  const dispH = imgH * scale;
  const offsetX = (containerW - dispW) / 2;
  const offsetY = (containerH - dispH) / 2;
  return { scale, offsetX, offsetY, dispW, dispH };
}

/**
 * Convert a normalized Viewport into a screen-pixel rectangle over the
 * displayed image.
 */
export function viewportToFrameRect(
  vp: Viewport,
  imgW: number,
  imgH: number,
  canvasAspect: number,
  display: ImageDisplay,
): FrameRect {
  const { baseW, baseH } = coverBase(imgW, imgH, canvasAspect);
  const { scale, offsetX, offsetY } = display;
  const visW = baseW / vp.zoom;
  const visH = baseH / vp.zoom;
  const sx = vp.x * imgW - visW / 2;
  const sy = vp.y * imgH - visH / 2;
  return {
    left: offsetX + sx * scale,
    top: offsetY + sy * scale,
    width: visW * scale,
    height: visH * scale,
  };
}

/**
 * Convert a screen-pixel rectangle over the displayed image back into a
 * normalized Viewport. Guards against divide-by-zero.
 */
export function frameRectToViewport(
  rect: FrameRect,
  imgW: number,
  imgH: number,
  canvasAspect: number,
  display: ImageDisplay,
): Viewport {
  const { baseW } = coverBase(imgW, imgH, canvasAspect);
  const { scale, offsetX, offsetY } = display;

  if (scale === 0 || imgW === 0 || imgH === 0) {
    return { x: 0.5, y: 0.5, zoom: 1 };
  }

  const visW = rect.width / scale;
  const visH = rect.height / scale;

  if (visW === 0) {
    return { x: 0.5, y: 0.5, zoom: 1 };
  }

  const zoom = baseW / visW;
  const cx = (rect.left - offsetX) / scale + visW / 2;
  const cy = (rect.top - offsetY) / scale + visH / 2;
  return { x: cx / imgW, y: cy / imgH, zoom };
}
