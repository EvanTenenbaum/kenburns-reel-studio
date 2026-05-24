/// <reference lib="webworker" />
/**
 * Export Web Worker.
 *
 * Renders every frame of the timeline to an OffscreenCanvas using the Ken
 * Burns engine, feeds frames to Mediabunny's CanvasSource, mixes audio with an
 * OfflineAudioContext, muxes to MP4 and posts the resulting buffer back.
 *
 * Layer rule: workers may import engine/, lib/, types/, constants/ only.
 */

import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  getFirstEncodableAudioCodec,
  type AudioCodec,
} from 'mediabunny';

import { computeViewportAtTime, clampViewport, viewportToSourceRect } from '@/engine/kenburns';
import { renderTransitionFrame, type Ctx2D } from '@/engine/transitions';
import { computeTimelineLayout, getClipAtTime } from '@/lib/timeline';
import { decodeImageBitmap } from '@/lib/image';
import { MAX_WORKING_RESOLUTION } from '@/constants/defaults';
import { QUALITY_BITRATES } from '@/types/export';
import type { Clip } from '@/types/project';
import type { AudioTrack } from '@/types/audio';
import type {
  ExportRequest,
  ExportWorkerInput,
  ExportWorkerOutput,
} from './exportTypes';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let cancelled = false;

ctx.onmessage = (event: MessageEvent<ExportWorkerInput>) => {
  const data = event.data;
  if (data.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (data.type === 'start') {
    cancelled = false;
    runExport(data).catch((err) => {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    });
  }
};

function post(message: ExportWorkerOutput, transfer?: Transferable[]): void {
  ctx.postMessage(message, transfer ?? []);
}

async function yieldToScheduler(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) {
    await scheduler.yield();
  } else {
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function runExport(req: ExportRequest): Promise<void> {
  const { canvas: canvasCfg, quality, totalDuration } = req;
  const width = canvasCfg.width;
  const height = canvasCfg.height;
  const fps = canvasCfg.fps;
  const totalFrames = Math.max(1, Math.ceil((totalDuration / 1000) * fps));

  post({
    type: 'progress',
    progress: progressOf('preparing', 0, totalFrames),
  });

  // Decode every clip's bitmap once.
  const bitmaps = new Map<string, ImageBitmap>();
  for (const clip of req.clips) {
    const blob = req.blobs[clip.imageBlobKey];
    if (!blob) continue;
    bitmaps.set(clip.id, await decodeImageBitmap(blob, MAX_WORKING_RESOLUTION));
  }

  const canvas = new OffscreenCanvas(width, height);
  const c2d = canvas.getContext('2d', { alpha: false }) as Ctx2D | null;
  if (!c2d) throw new Error('Could not acquire OffscreenCanvas 2D context');

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: QUALITY_BITRATES[quality],
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  // Optional audio.
  let audioSource: AudioBufferSource | null = null;
  let mixedAudio: AudioBuffer | null = null;
  if (req.includeAudio && req.audioTracks.length > 0) {
    mixedAudio = await mixAudio(req.audioTracks, req.blobs, totalDuration);
    if (mixedAudio) {
      const codec = await getFirstEncodableAudioCodec(
        ['aac', 'mp3', 'opus'] as AudioCodec[],
        {
          numberOfChannels: mixedAudio.numberOfChannels,
          sampleRate: mixedAudio.sampleRate,
        }
      );
      if (codec) {
        audioSource = new AudioBufferSource({ codec, bitrate: 128_000 });
        output.addAudioTrack(audioSource);
      }
    }
  }

  await output.start();

  const layout = computeTimelineLayout(req.clips, req.transitions);

  const drawClip = (clip: Clip, timeInClip: number) => {
    const bitmap = bitmaps.get(clip.id);
    if (!bitmap) return;
    const imgAspect = bitmap.height > 0 ? bitmap.width / bitmap.height : 1;
    const canvasAspect = width / height;
    const raw = computeViewportAtTime(clip.kenburns, timeInClip, clip.duration);
    const vp = clampViewport(raw, imgAspect, canvasAspect);
    const rect = viewportToSourceRect(vp, bitmap.width, bitmap.height, width, height);
    // Clamp the source rectangle strictly within the bitmap so drawImage can
    // never throw IndexSizeError on extreme viewports / rounding.
    const sx = Math.min(Math.max(0, rect.sx), Math.max(0, bitmap.width - 1));
    const sy = Math.min(Math.max(0, rect.sy), Math.max(0, bitmap.height - 1));
    const sw = Math.min(rect.sw, bitmap.width - sx);
    const sh = Math.min(rect.sh, bitmap.height - sy);
    if (sw <= 0 || sh <= 0) return;
    c2d.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  };

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (cancelled) {
        videoSource.close();
        audioSource?.close();
        await output.cancel();
        return;
      }

      const timeMs = (frame / fps) * 1000;
      c2d.fillStyle = '#000000';
      c2d.fillRect(0, 0, width, height);

      const active = getClipAtTime(timeMs, layout, req.transitions);
      if (active) {
        if (active.secondary && active.transition) {
          const fromClip = active.primary.clip;
          const toClip = active.secondary.clip;
          renderTransitionFrame(
            c2d,
            active.transition.type,
            active.transitionProgress,
            () => drawClip(fromClip, active.timeInPrimary),
            () => drawClip(toClip, active.timeInSecondary),
            width,
            height
          );
        } else {
          drawClip(active.primary.clip, active.timeInPrimary);
        }
      }

      await videoSource.add(frame / fps, 1 / fps);

      if (frame % 5 === 0 || frame === totalFrames - 1) {
        post({ type: 'progress', progress: progressOf('rendering', frame + 1, totalFrames) });
      }
      if (frame % 30 === 0) {
        await yieldToScheduler();
      }
    }

    if (audioSource && mixedAudio) {
      post({ type: 'progress', progress: progressOf('encoding', totalFrames, totalFrames) });
      await audioSource.add(mixedAudio);
    }

    post({ type: 'progress', progress: progressOf('muxing', totalFrames, totalFrames) });

    videoSource.close();
    audioSource?.close();
    await output.finalize();

    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error('Export produced no output buffer');

    post({ type: 'progress', progress: progressOf('complete', totalFrames, totalFrames) });
    post({ type: 'done', buffer, mimeType: 'video/mp4' }, [buffer]);
  } finally {
    Array.from(bitmaps.values()).forEach((bitmap) => bitmap.close());
  }
}

async function mixAudio(
  tracks: AudioTrack[],
  blobs: Record<string, Blob>,
  totalDuration: number
): Promise<AudioBuffer | null> {
  const OfflineCtor =
    (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!OfflineCtor) return null;

  const sampleRate = 48_000;
  const length = Math.ceil((totalDuration / 1000) * sampleRate);
  if (length <= 0) return null;

  const audioCtx = new OfflineCtor(2, length, sampleRate);
  let scheduled = 0;

  for (const track of tracks) {
    if (track.muted) continue;
    const blob = blobs[track.blobKey];
    if (!blob) continue;

    let decoded: AudioBuffer;
    try {
      decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer());
    } catch {
      continue;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = decoded;
    const gain = audioCtx.createGain();

    const startSec = track.startTime / 1000;
    const trimStartSec = Math.max(0, track.trimStart / 1000);
    const playDur = Math.max(0, (track.trimEnd - track.trimStart) / 1000);
    if (playDur <= 0) continue;

    const fadeIn = Math.max(0, track.fadeIn / 1000);
    const fadeOut = Math.max(0, track.fadeOut / 1000);
    const endSec = startSec + playDur;
    const vol = Math.max(0, Math.min(1, track.volume));

    // Keep automation event times strictly monotonic so overlapping fades
    // (fadeIn + fadeOut >= playDur) cannot throw or spike.
    const inEnd = Math.min(endSec, startSec + fadeIn);
    gain.gain.setValueAtTime(fadeIn > 0 ? 0 : vol, startSec);
    if (fadeIn > 0) gain.gain.linearRampToValueAtTime(vol, inEnd);
    if (fadeOut > 0) {
      const outStart = Math.min(endSec, Math.max(inEnd, endSec - fadeOut));
      gain.gain.setValueAtTime(vol, outStart);
      gain.gain.linearRampToValueAtTime(0, endSec);
    }

    source.connect(gain).connect(audioCtx.destination);
    source.start(startSec, trimStartSec, playDur);
    scheduled += 1;
  }

  if (scheduled === 0) return null;
  return audioCtx.startRendering();
}

function progressOf(
  state: 'preparing' | 'rendering' | 'encoding' | 'muxing' | 'complete',
  currentFrame: number,
  totalFrames: number
) {
  const percent = totalFrames > 0 ? Math.round((currentFrame / totalFrames) * 100) : 0;
  return {
    state,
    currentFrame,
    totalFrames,
    percent,
    estimatedTimeRemaining: 0,
  } as const;
}
