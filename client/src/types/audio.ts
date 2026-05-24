/**
 * Audio track types for Ken Burns Reel Studio.
 */

export interface AudioTrack {
  id: string;
  /** Display name (derived from file name) */
  name: string;
  /** Dexie key for the stored audio blob */
  blobKey: string;
  /** Runtime blob URL for playback (not persisted) */
  url: string;
  /** Start time on the timeline in ms */
  startTime: number;
  /** How long the audio plays in ms */
  duration: number;
  /** Volume level (0–1) */
  volume: number;
  /** Fade in duration in ms */
  fadeIn: number;
  /** Fade out duration in ms */
  fadeOut: number;
  /** Offset into the audio file where playback starts (trim start) in ms */
  trimStart: number;
  /** Offset into the audio file where playback ends (trim end) in ms */
  trimEnd: number;
  /** Whether this track is muted */
  muted: boolean;
}
