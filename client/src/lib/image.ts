/**
 * Image loading, thumbnail generation and EXIF-aware decoding.
 *
 * `decodeImageBitmap` is worker-safe (Canvas/createImageBitmap only).
 * `createThumbnail` and `readImageMeta` run on the main thread.
 */

import { MAX_WORKING_RESOLUTION, THUMBNAIL_SIZE } from '@/constants/defaults';

export interface ImageMeta {
  naturalWidth: number;
  naturalHeight: number;
  /** base64 data URL thumbnail for timeline / project list display */
  thumbnail: string;
}

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

/**
 * Read natural dimensions and generate a small thumbnail data URL.
 * Main-thread only (uses a DOM canvas for toDataURL).
 */
export async function readImageMeta(
  blob: Blob,
  thumbSize: number = THUMBNAIL_SIZE
): Promise<ImageMeta> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const naturalWidth = bitmap.width;
  const naturalHeight = bitmap.height;

  const target = fitWithin(naturalWidth, naturalHeight, thumbSize);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Unable to create 2D context for thumbnail');
  }
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();

  const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
  return { naturalWidth, naturalHeight, thumbnail };
}

/** Whether a file is a supported raster image. */
export function isSupportedImage(file: File): boolean {
  return /^image\/(jpeg|png|webp|gif|bmp|avif)$/i.test(file.type);
}

/** Whether a file is a supported audio file. */
export function isSupportedAudio(file: File): boolean {
  return /^audio\//i.test(file.type);
}
