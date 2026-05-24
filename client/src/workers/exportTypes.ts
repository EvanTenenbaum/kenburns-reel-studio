/**
 * Message protocol shared between the main thread (useExport) and the export
 * Web Worker. Types only — safe to import from either context.
 */

import type { Clip, Transition, CanvasConfig } from '@/types/project';
import type { AudioTrack } from '@/types/audio';
import type { ExportProgress, ExportQuality } from '@/types/export';

export interface ExportRequest {
  type: 'start';
  canvas: CanvasConfig;
  quality: ExportQuality;
  includeAudio: boolean;
  totalDuration: number;
  clips: Clip[];
  transitions: Transition[];
  audioTracks: AudioTrack[];
  /** blobKey → binary data for every referenced image and audio file */
  blobs: Record<string, Blob>;
}

export interface ExportCancel {
  type: 'cancel';
}

export type ExportWorkerInput = ExportRequest | ExportCancel;

export interface ExportProgressMessage {
  type: 'progress';
  progress: ExportProgress;
}

export interface ExportDoneMessage {
  type: 'done';
  buffer: ArrayBuffer;
  mimeType: string;
}

export interface ExportErrorMessage {
  type: 'error';
  message: string;
}

export type ExportWorkerOutput =
  | ExportProgressMessage
  | ExportDoneMessage
  | ExportErrorMessage;
