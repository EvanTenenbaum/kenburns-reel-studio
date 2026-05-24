/**
 * Core project data model for Ken Burns Reel Studio.
 * All types here are serializable to JSON for IndexedDB persistence.
 */

import type { AudioTrack } from './audio';
import type { KenBurnsConfig } from './kenburns';

export type AspectRatio = '9:16' | '1:1' | '4:5' | '16:9';

export interface CanvasConfig {
  width: number;
  height: number;
  fps: 30;
  aspectRatio: AspectRatio;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  canvas: CanvasConfig;
  clips: Clip[];
  audioTracks: AudioTrack[];
  transitions: Transition[];
}

export interface Clip {
  id: string;
  /** Runtime blob URL for display (not persisted) */
  imageUrl: string;
  /** Dexie key for the stored image blob */
  imageBlobKey: string;
  /** Absolute start time on timeline in ms (computed from clip order + transitions) */
  startTime: number;
  /** Duration in ms */
  duration: number;
  /** Ken Burns motion configuration */
  kenburns: KenBurnsConfig;
  /** Position in clip sequence (0-indexed) */
  order: number;
  /** Small base64 thumbnail for timeline display */
  thumbnail?: string;
  /** Natural width of the source image */
  naturalWidth: number;
  /** Natural height of the source image */
  naturalHeight: number;
}

export interface Transition {
  id: string;
  type: TransitionType;
  /** Duration of the overlap between clips in ms */
  duration: number;
  fromClipId: string;
  toClipId: string;
}

export type TransitionType =
  | 'cut'
  | 'crossfade'
  | 'fade-through-black'
  | 'fade-through-white'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-through'
  | 'blur-transition';

// Re-export from sibling modules for convenience
export type { AudioTrack } from './audio';
export type { KenBurnsConfig, Viewport, EasingConfig, EasingPreset, MotionPreset } from './kenburns';
