import { describe, it, expect } from 'vitest';
import type { Viewport } from '@/types/kenburns';
import {
  coverBase,
  computeImageDisplay,
  viewportToFrameRect,
  frameRectToViewport,
} from './viewportFrame';

const CANVAS_ASPECT = 9 / 16;

interface ImageCase {
  name: string;
  imgW: number;
  imgH: number;
}

interface ContainerCase {
  containerW: number;
  containerH: number;
}

const images: ImageCase[] = [
  { name: 'landscape 4000x3000', imgW: 4000, imgH: 3000 },
  { name: 'portrait 3000x4000', imgW: 3000, imgH: 4000 },
];

const containers: ContainerCase[] = [
  { containerW: 800, containerH: 600 },
  { containerW: 1280, containerH: 720 },
];

const viewports: Viewport[] = [
  { x: 0.5, y: 0.5, zoom: 1 },
  { x: 0.4, y: 0.6, zoom: 2 },
  { x: 0.55, y: 0.45, zoom: 1.5 },
  { x: 0.5, y: 0.5, zoom: 3 },
];

describe('viewportFrame round-trip', () => {
  for (const img of images) {
    for (const container of containers) {
      const display = computeImageDisplay(
        img.imgW,
        img.imgH,
        container.containerW,
        container.containerH,
      );

      for (const vp of viewports) {
        it(`round-trips ${img.name} @ ${container.containerW}x${container.containerH} vp(${vp.x},${vp.y},${vp.zoom})`, () => {
          const rect = viewportToFrameRect(
            vp,
            img.imgW,
            img.imgH,
            CANVAS_ASPECT,
            display,
          );
          const back = frameRectToViewport(
            rect,
            img.imgW,
            img.imgH,
            CANVAS_ASPECT,
            display,
          );
          expect(back.x).toBeCloseTo(vp.x, 5);
          expect(back.y).toBeCloseTo(vp.y, 5);
          expect(back.zoom).toBeCloseTo(vp.zoom, 5);
        });
      }
    }
  }
});

describe('coverBase', () => {
  it('uses full height when imgAspect > canvasAspect (4000x3000)', () => {
    // imgAspect 1.333 > 0.5625 -> baseH = imgH, baseW = imgH * aspect
    const { baseW, baseH } = coverBase(4000, 3000, CANVAS_ASPECT);
    expect(baseH).toBeCloseTo(3000, 5);
    expect(baseW).toBeCloseTo(3000 * CANVAS_ASPECT, 5);
    expect(baseW / baseH).toBeCloseTo(CANVAS_ASPECT, 5);
  });

  it('uses full height when imgAspect > canvasAspect (3000x4000)', () => {
    // imgAspect 0.75 > 0.5625 -> baseH = imgH, baseW = imgH * aspect
    const { baseW, baseH } = coverBase(3000, 4000, CANVAS_ASPECT);
    expect(baseH).toBeCloseTo(4000, 5);
    expect(baseW).toBeCloseTo(4000 * CANVAS_ASPECT, 5);
    expect(baseW / baseH).toBeCloseTo(CANVAS_ASPECT, 5);
  });

  it('uses full width when imgAspect < canvasAspect (very tall image)', () => {
    // imgAspect 0.4 < 0.5625 -> baseW = imgW, baseH = imgW / aspect
    const { baseW, baseH } = coverBase(2000, 5000, CANVAS_ASPECT);
    expect(baseW).toBeCloseTo(2000, 5);
    expect(baseH).toBeCloseTo(2000 / CANVAS_ASPECT, 5);
    expect(baseW / baseH).toBeCloseTo(CANVAS_ASPECT, 5);
  });
});

describe('centered zoom=1 viewport', () => {
  it('produces a frame centered in the displayed image', () => {
    const imgW = 4000;
    const imgH = 3000;
    const display = computeImageDisplay(imgW, imgH, 800, 600);
    const rect = viewportToFrameRect(
      { x: 0.5, y: 0.5, zoom: 1 },
      imgW,
      imgH,
      CANVAS_ASPECT,
      display,
    );

    const rectCenterX = rect.left + rect.width / 2;
    const rectCenterY = rect.top + rect.height / 2;
    const dispCenterX = display.offsetX + display.dispW / 2;
    const dispCenterY = display.offsetY + display.dispH / 2;

    expect(rectCenterX).toBeCloseTo(dispCenterX, 5);
    expect(rectCenterY).toBeCloseTo(dispCenterY, 5);

    // The crop's aspect should equal the output aspect.
    expect(rect.width / rect.height).toBeCloseTo(CANVAS_ASPECT, 5);
  });
});
