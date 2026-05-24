/**
 * Browser capability detection for Ken Burns Reel Studio.
 * Determines which export strategy and features are available.
 *
 * NO React, NO DOM dependencies (except browser globals).
 */

import type { ExportStrategy } from '@/types/export';

export interface AppCapabilities {
  /** VideoEncoder available (WebCodecs) */
  webcodecs: boolean;
  /** AudioEncoder available (WebCodecs) */
  webcodecAudio: boolean;
  /** OffscreenCanvas available (for Web Worker rendering) */
  offscreenCanvas: boolean;
  /** navigator.share with file support */
  webShare: boolean;
  /** AudioContext available */
  webAudio: boolean;
  /** scheduler.yield() for thermal management */
  schedulerYield: boolean;
  /** Estimated device memory in GB (Chrome only, defaults to 4) */
  deviceMemory: number;
}

/**
 * Detect all browser capabilities at startup.
 * This is synchronous and safe to call during app initialization.
 */
export function detectCapabilities(): AppCapabilities {
  return {
    webcodecs: typeof VideoEncoder !== 'undefined',
    webcodecAudio: typeof AudioEncoder !== 'undefined',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    webShare: 'share' in navigator && 'canShare' in navigator,
    webAudio:
      typeof AudioContext !== 'undefined' ||
      typeof (globalThis as Record<string, unknown>).webkitAudioContext !== 'undefined',
    schedulerYield:
      'scheduler' in globalThis &&
      typeof (globalThis as Record<string, unknown> & { scheduler?: { yield?: unknown } }).scheduler?.yield === 'function',
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4,
  };
}

/**
 * Determine the best export strategy based on detected capabilities.
 */
export function getExportStrategy(capabilities: AppCapabilities): ExportStrategy {
  if (capabilities.webcodecs && capabilities.offscreenCanvas) {
    return 'mediabunny';
  }
  if (capabilities.webcodecs) {
    // WebCodecs available but no OffscreenCanvas — render on main thread
    return 'mediabunny';
  }
  // No WebCodecs at all — try ffmpeg.wasm (single-threaded)
  if (typeof Worker !== 'undefined') {
    return 'ffmpeg-st';
  }
  return 'unsupported';
}

/**
 * Determine the maximum recommended working resolution based on device memory.
 */
export function getMaxWorkingResolution(deviceMemory: number): number {
  if (deviceMemory <= 2) return 1440;
  if (deviceMemory <= 4) return 2160;
  return 3840;
}

/**
 * Determine the maximum recommended number of clips based on device memory.
 */
export function getMaxClips(deviceMemory: number): number {
  if (deviceMemory <= 2) return 5;
  if (deviceMemory <= 4) return 10;
  return 20;
}
