/**
 * Instagram Reels and other platform output specifications.
 */

import type { AspectRatio } from '@/types/project';

export interface OutputSpec {
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  label: string;
  description: string;
}

export const OUTPUT_SPECS: Record<AspectRatio, OutputSpec> = {
  '9:16': {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    label: 'Reels / Stories',
    description: 'Instagram Reels, TikTok, YouTube Shorts',
  },
  '1:1': {
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    label: 'Square',
    description: 'Instagram posts, Facebook',
  },
  '4:5': {
    width: 1080,
    height: 1350,
    aspectRatio: '4:5',
    label: 'Portrait',
    description: 'Instagram portrait posts',
  },
  '16:9': {
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    label: 'Landscape',
    description: 'YouTube, presentations',
  },
};

/** Default output FPS */
export const DEFAULT_FPS = 30 as const;

/** Minimum reel duration in ms */
export const MIN_DURATION_MS = 15_000;

/** Maximum reel duration in ms */
export const MAX_DURATION_MS = 90_000;

/** Default clip duration in ms */
export const DEFAULT_CLIP_DURATION_MS = 4_000;

/** Minimum clip duration in ms */
export const MIN_CLIP_DURATION_MS = 1_000;

/** Maximum clip duration in ms */
export const MAX_CLIP_DURATION_MS = 30_000;

/** Default transition duration in ms */
export const DEFAULT_TRANSITION_DURATION_MS = 800;

/** Minimum transition duration in ms */
export const MIN_TRANSITION_DURATION_MS = 200;

/** Maximum transition duration in ms */
export const MAX_TRANSITION_DURATION_MS = 3_000;
