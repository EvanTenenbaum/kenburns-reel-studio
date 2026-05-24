/**
 * Ken Burns motion types.
 *
 * Coordinate system:
 * - All viewport coordinates are normalized to 0–1 relative to source image dimensions
 * - (0.5, 0.5) = center of image
 * - (0, 0) = top-left corner
 * - zoom = 1 = image fills canvas in cover-fit mode
 * - zoom = 2 = 2× magnification (shows 25% of image area)
 */

export interface Viewport {
  /** Normalized center X position within image (0–1) */
  x: number;
  /** Normalized center Y position within image (0–1) */
  y: number;
  /** Zoom level (1 = cover fit, >1 = magnified) */
  zoom: number;
}

export interface KenBurnsConfig {
  /** Where the camera starts */
  startViewport: Viewport;
  /** Where the camera ends */
  endViewport: Viewport;
  /** Easing curve controlling animation speed */
  easing: EasingConfig;
  /** Which preset was applied (if any) */
  preset?: MotionPreset;
}

export type EasingConfig =
  | { type: 'preset'; name: EasingPreset }
  | { type: 'bezier'; x1: number; y1: number; x2: number; y2: number };

export type EasingPreset =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'slow-start'
  | 'slow-end';

export type MotionPreset =
  | 'zoom-in-center'
  | 'zoom-out-center'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'zoom-in-top-left'
  | 'zoom-in-top-right'
  | 'zoom-out-bottom'
  | 'custom';
