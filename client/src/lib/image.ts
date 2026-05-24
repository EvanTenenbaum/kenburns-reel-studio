/**
 * Image loading, thumbnail generation and EXIF-aware decoding.
 *
 * `decodeImageBitmap` is worker-safe (Canvas/createImageBitmap only).
 * `prepareImageImport` runs on the main thread (uses a DOM canvas + `<img>`).
 */

import {
  EXPORT_MAX_RESOLUTION,
  MAX_WORKING_RESOLUTION,
  THUMBNAIL_SIZE,
} from '@/constants/defaults';

export interface ImageMeta {
  naturalWidth: number;
  naturalHeight: number;
  /** base64 data URL thumbnail for timeline / project list display */
  thumbnail: string;
}

export interface PreparedImage extends ImageMeta {
  /**
   * The blob to persist. The original file when it is already in a format the
   * export Web Worker can decode; otherwise a transcoded JPEG (e.g. iOS HEIC).
   */
  blob: Blob;
}

/**
 * Formats we trust `createImageBitmap` to decode everywhere, including inside
 * the export Web Worker (which has no DOM `<img>` fallback). Anything else —
 * most importantly iOS HEIC/HEIF — is transcoded to JPEG at import time so the
 * preview and the export pipeline can both read it.
 */
const WORKER_SAFE_TYPE = /^image\/(jpeg|png|webp|gif|avif)$/i;

/**
 * Compute resize dimensions so the longest side is at most `maxSize`,
 * preserving aspect ratio. Returns the original size if already small enough.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSize: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSize) return { width, height };
  const scale = maxSize / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Decode a blob to an ImageBitmap at working resolution, respecting EXIF
 * orientation. Safe to call inside a Web Worker.
 */
export async function decodeImageBitmap(
  blob: Blob,
  maxSize: number = MAX_WORKING_RESOLUTION
): Promise<ImageBitmap> {
  const probe = await createBitmap(blob);
  const target = fitWithin(probe.width, probe.height, maxSize);
  if (target.width === probe.width && target.height === probe.height) {
    return probe;
  }
  probe.close();
  try {
    return await createImageBitmap(blob, {
      imageOrientation: 'from-image',
      resizeWidth: target.width,
      resizeHeight: target.height,
      resizeQuality: 'high',
    });
  } catch {
    // Some engines reject the resize/orientation options bag — decode plain.
    return createImageBitmap(blob);
  }
}

/** Decode a blob to an ImageBitmap, tolerating engines that reject the
 *  `imageOrientation` option (older Safari) by retrying without it. */
async function createBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(blob);
  }
}

/** Draw a decoded image source into a (downscaled) canvas, preserving aspect. */
function drawToCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxSize: number
): HTMLCanvasElement {
  const target = fitWithin(srcW, srcH, maxSize);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create 2D context');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return canvas;
}

function dataURLToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Encode a canvas to a Blob. iOS Safari's `toBlob` can return null on large
 *  canvases, so fall back to the more reliable `toDataURL` path. */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  const viaToBlob = await new Promise<Blob | null>((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
  if (viaToBlob && viaToBlob.size > 0) return viaToBlob;
  return dataURLToBlob(canvas.toDataURL(type, quality));
}

/** Decode via an HTMLImageElement — the fallback for formats (HEIC) that
 *  `createImageBitmap` may not support but the browser can still render. */
function loadHtmlImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image element decode failed'));
    };
    img.src = url;
  });
}

interface DecodedSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

/** Decode a file to a drawable source + intrinsic size, trying every avenue:
 *  createImageBitmap (with then without options), then an `<img>` element. */
async function decodeSource(file: File): Promise<DecodedSource> {
  try {
    const bmp = await createBitmap(file);
    if (bmp.width > 0 && bmp.height > 0) {
      return {
        source: bmp,
        width: bmp.width,
        height: bmp.height,
        cleanup: () => bmp.close(),
      };
    }
    bmp.close();
  } catch {
    /* fall through to the <img> path */
  }
  const img = await loadHtmlImage(file);
  if (!img.naturalWidth || !img.naturalHeight) {
    URL.revokeObjectURL(img.src);
    throw new Error('decoded image has no dimensions');
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    cleanup: () => URL.revokeObjectURL(img.src),
  };
}

/** Transcode a decoded source to a JPEG blob, downscaling progressively so a
 *  canvas/memory limit on a large photo cannot fail the whole import. */
async function encodeJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const sizes = [EXPORT_MAX_RESOLUTION, MAX_WORKING_RESOLUTION, 1600, 1080];
  let lastError: unknown;
  for (const maxSize of sizes) {
    try {
      const canvas = drawToCanvas(source, width, height, maxSize);
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (blob.size > 0) return blob;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('could not encode image');
}

/**
 * Decode and prepare an imported file for the editor: read its dimensions,
 * build a thumbnail, and return a persistable blob. Formats the export worker
 * cannot decode (notably iOS HEIC/HEIF) are transcoded to JPEG so that the
 * preview and the export pipeline can both read the stored blob.
 *
 * Main-thread only (uses a DOM canvas and an `<img>` decode fallback).
 */
export async function prepareImageImport(file: File): Promise<PreparedImage> {
  const { source, width, height, cleanup } = await decodeSource(file);
  try {
    const blob = WORKER_SAFE_TYPE.test(file.type)
      ? file
      : await encodeJpeg(source, width, height, 0.92);

    let thumbnail = '';
    try {
      thumbnail = drawToCanvas(source, width, height, THUMBNAIL_SIZE).toDataURL(
        'image/jpeg',
        0.7
      );
    } catch {
      // A thumbnail is nice-to-have; never fail the import over it.
      thumbnail = '';
    }

    return { blob, naturalWidth: width, naturalHeight: height, thumbnail };
  } finally {
    cleanup();
  }
}

/** Whether a file is a candidate raster image we should attempt to import. */
export function isSupportedImage(file: File): boolean {
  // Trust an explicit image MIME type (covers HEIC/HEIF from iOS).
  if (file.type) return /^image\//i.test(file.type);
  // Some platforms hand over files with an empty type — fall back to the
  // extension so iOS photo-library picks are not silently rejected.
  return /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name);
}

/** Whether a file is a supported audio file. */
export function isSupportedAudio(file: File): boolean {
  return /^audio\//i.test(file.type);
}
