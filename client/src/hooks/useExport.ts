/**
 * Export lifecycle: spins up the export Web Worker, gathers blobs from
 * IndexedDB, relays progress, and exposes the finished MP4 as an object URL.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useProjectStore } from '@/store/projectStore';
import { loadBlob } from '@/store/db';
import { computeTotalDuration } from '@/lib/timeline';
import { detectCapabilities, getExportStrategy } from '@/engine/capabilities';
import { QUALITY_BITRATES } from '@/types/export';
import type { ExportProgress, ExportQuality } from '@/types/export';
import type { ExportRequest, ExportWorkerOutput } from '@/workers/exportTypes';

const IDLE: ExportProgress = {
  state: 'idle',
  currentFrame: 0,
  totalFrames: 0,
  percent: 0,
  estimatedTimeRemaining: 0,
};

export interface StartExportOptions {
  quality: ExportQuality;
  includeAudio: boolean;
}

export function useExport() {
  const [progress, setProgress] = useState<ExportProgress>(IDLE);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const startedAtRef = useRef(0);
  const resultRef = useRef<string | null>(null);

  const strategy = getExportStrategy(detectCapabilities());
  // The worker renders into an OffscreenCanvas, so it is a hard requirement.
  const canExport =
    strategy !== 'unsupported' && typeof OffscreenCanvas !== 'undefined';

  const cleanupWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const revokeResult = useCallback(() => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupWorker();
      revokeResult();
    };
  }, [cleanupWorker, revokeResult]);

  const reset = useCallback(() => {
    cleanupWorker();
    revokeResult();
    setResultUrl(null);
    setProgress(IDLE);
  }, [cleanupWorker, revokeResult]);

  const cancel = useCallback(() => {
    workerRef.current?.postMessage({ type: 'cancel' });
    cleanupWorker();
    setProgress((p) => ({ ...p, state: 'cancelled' }));
  }, [cleanupWorker]);

  const start = useCallback(
    async (options: StartExportOptions) => {
      const project = useProjectStore.getState().project;
      if (!project || project.clips.length === 0) {
        toast.error('Add at least one image before exporting');
        return;
      }
      if (!canExport) {
        toast.error('Your browser does not support video export');
        return;
      }

      revokeResult();
      setResultUrl(null);
      setProgress({ ...IDLE, state: 'preparing' });
      startedAtRef.current = performance.now();

      try {
        const blobs: Record<string, Blob> = {};
        for (const clip of project.clips) {
          const blob = await loadBlob(clip.imageBlobKey);
          if (blob) blobs[clip.imageBlobKey] = blob;
        }
        if (options.includeAudio) {
          for (const track of project.audioTracks) {
            const blob = await loadBlob(track.blobKey);
            if (blob) blobs[track.blobKey] = blob;
          }
        }

        const totalDuration = computeTotalDuration(project.clips, project.transitions);

        const worker = new Worker(
          new URL('../workers/exportWorker.ts', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<ExportWorkerOutput>) => {
          const msg = event.data;
          if (msg.type === 'progress') {
            setProgress(withEta(msg.progress, startedAtRef.current));
          } else if (msg.type === 'done') {
            const blob = new Blob([msg.buffer], { type: msg.mimeType });
            const url = URL.createObjectURL(blob);
            resultRef.current = url;
            setResultUrl(url);
            setProgress((p) => ({ ...p, state: 'complete', percent: 100 }));
            toast.success('Export complete');
            cleanupWorker();
          } else if (msg.type === 'error') {
            setProgress((p) => ({ ...p, state: 'error', error: msg.message }));
            toast.error('Export failed');
            cleanupWorker();
          }
        };

        worker.onerror = (err) => {
          setProgress((p) => ({ ...p, state: 'error', error: err.message }));
          toast.error('Export failed');
          cleanupWorker();
        };

        const request: ExportRequest = {
          type: 'start',
          canvas: project.canvas,
          quality: options.quality,
          includeAudio: options.includeAudio,
          totalDuration,
          clips: project.clips,
          transitions: project.transitions,
          audioTracks: project.audioTracks,
          blobs,
        };
        worker.postMessage(request);
      } catch (err) {
        console.error('Export setup failed', err);
        setProgress((p) => ({
          ...p,
          state: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
        toast.error('Export failed');
        cleanupWorker();
      }
    },
    [canExport, cleanupWorker, revokeResult]
  );

  return {
    progress,
    resultUrl,
    canExport,
    isExporting:
      progress.state !== 'idle' &&
      progress.state !== 'complete' &&
      progress.state !== 'error' &&
      progress.state !== 'cancelled',
    qualityBitrates: QUALITY_BITRATES,
    start,
    cancel,
    reset,
  };
}

function withEta(progress: ExportProgress, startedAt: number): ExportProgress {
  if (progress.percent <= 0) return progress;
  const elapsed = performance.now() - startedAt;
  const total = elapsed / (progress.percent / 100);
  return { ...progress, estimatedTimeRemaining: Math.max(0, total - elapsed) };
}
