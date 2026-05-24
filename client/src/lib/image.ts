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
  const probe = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const target = fitWithin(probe.width, probe.height, maxSize);
  if (target.width === probe.width && target.height === probe.height) {
    return probe;
  }
  probe.close();
  return createImageBitmap(blob, {
    imageOrientation: 'from-image',
    resizeWidth: target.width,
    resizeHeight: target.height,
    resizeQuality: 'high',
  });
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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas encoding failed'))),
      type,
      quality
    );
  });
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
      reject(new Error('Image could not be decoded'));
    };
    img.src = url;
  });
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
  let bitmap: ImageBitmap | null = null;
  let element: HTMLImageElement | null = null;
  let source: CanvasImageSource;
  let width: number;
  let height: number;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    element = await loadHtmlImage(file);
    source = element;
    width = element.naturalWidth;
    height = element.naturalHeight;
  }

  try {
    if (!width || !height) {
      throw new Error('Image has no readable dimensions');
    }

    const blob = WORKER_SAFE_TYPE.test(file.type)
      ? file
      : await canvasToBlob(
          drawToCanvas(source, width, height, EXPORT_MAX_RESOLUTION),
          'image/jpeg',
          0.92
        );

    const thumbnail = drawToCanvas(
      source,
      width,
      height,
      THUMBNAIL_SIZE
    ).toDataURL('image/jpeg', 0.7);

    return { blob, naturalWidth: width, naturalHeight: height, thumbnail };
  } finally {
    if (bitmap) bitmap.close();
    if (element) URL.revokeObjectURL(element.src);
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
