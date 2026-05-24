/**
 * Default values used throughout the application.
 */

import type { ExportConfig } from '@/types/export';
import type { CanvasConfig } from '@/types/project';

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  width: 1080,
  height: 1920,
  fps: 30,
  aspectRatio: '9:16',
};

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  quality: 'standard',
  resolution: { width: 1080, height: 1920 },
  fps: 30,
  videoBitrate: 6_000_000,
  audioBitrate: 128_000,
  includeAudio: true,
};

/** Maximum working resolution for image processing (longest side in px) */
export const MAX_WORKING_RESOLUTION = 2160;

/**
 * Maximum source resolution (longest side in px) decoded for video export.
 * Sources are super-sampled relative to the 1080p output so that zoomed-in
 * Ken Burns frames still sample enough detail to stay sharp instead of grainy.
 */
export const EXPORT_MAX_RESOLUTION = 4096;

/** Maximum number of clips per project (can be reduced based on device memory) */
export const MAX_CLIPS = 20;

/** Auto-save debounce interval in ms */
export const AUTO_SAVE_DEBOUNCE_MS = 2000;

/** Default audio fade in/out duration in ms */
export const DEFAULT_AUDIO_FADE_MS = 500;

/** Default audio volume */
export const DEFAULT_AUDIO_VOLUME = 0.8;

/** Thumbnail size (longest side) for timeline display */
export const THUMBNAIL_SIZE = 150;

/** Minimum touch target size in px */
export const MIN_TOUCH_TARGET = 44;
