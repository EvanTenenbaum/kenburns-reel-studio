/**
 * Export configuration and progress types.
 */

export type ExportQuality = 'draft' | 'standard' | 'high';

export interface ExportConfig {
  quality: ExportQuality;
  resolution: { width: number; height: number };
  fps: 30;
  /** Video bitrate in bits per second */
  videoBitrate: number;
  /** Audio bitrate in bits per second */
  audioBitrate: number;
  /** Whether to include audio tracks in the export */
  includeAudio: boolean;
}

export type ExportState =
  | 'idle'
  | 'preparing'
  | 'rendering'
  | 'encoding'
  | 'muxing'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface ExportProgress {
  state: ExportState;
  currentFrame: number;
  totalFrames: number;
  /** Percentage complete (0–100) */
  percent: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining: number;
  /** Error message if state is 'error' */
  error?: string;
}

export type ExportStrategy = 'mediabunny' | 'ffmpeg-st' | 'unsupported';

/** Quality presets mapping to video bitrates (H.264, 1080×1920 @ 30fps) */
export const QUALITY_BITRATES: Record<ExportQuality, number> = {
  draft: 5_000_000,     // 5 Mbps (fast, smaller files)
  standard: 10_000_000, // 10 Mbps (crisp 1080p)
  high: 16_000_000,     // 16 Mbps (near-source 1080p, best for IG re-encode)
};
