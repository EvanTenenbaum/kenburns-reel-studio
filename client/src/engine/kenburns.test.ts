import { describe, it, expect } from 'vitest';
import {
  computeViewportAtTime,
  clampViewport,
  viewportToCSS,
  viewportToSourceRect,
  computeMinZoom,
} from './kenburns';
import type { KenBurnsConfig, Viewport } from '@/types/kenburns';

describe('computeViewportAtTime', () => {
  const config: KenBurnsConfig = {
    startViewport: { x: 0.3, y: 0.3, zoom: 1 },
    endViewport: { x: 0.7, y: 0.7, zoom: 2 },
    easing: { type: 'preset', name: 'linear' },
  };

  it('returns start viewport at t=0', () => {
    const vp = computeViewportAtTime(config, 0, 4000);
    expect(vp.x).toBeCloseTo(0.3);
    expect(vp.y).toBeCloseTo(0.3);
    expect(vp.zoom).toBeCloseTo(1);
  });

  it('returns end viewport at t=duration', () => {
    const vp = computeViewportAtTime(config, 4000, 4000);
    expect(vp.x).toBeCloseTo(0.7);
    expect(vp.y).toBeCloseTo(0.7);
    expect(vp.zoom).toBeCloseTo(2);
  });

  it('returns midpoint at t=duration/2 with linear easing', () => {
    const vp = computeViewportAtTime(config, 2000, 4000);
    expect(vp.x).toBeCloseTo(0.5);
    expect(vp.y).toBeCloseTo(0.5);
    expect(vp.zoom).toBeCloseTo(1.5);
  });

  it('clamps progress to 0-1 range', () => {
    const vpBefore = computeViewportAtTime(config, -1000, 4000);
    expect(vpBefore.x).toBeCloseTo(0.3);

    const vpAfter = computeViewportAtTime(config, 8000, 4000);
    expect(vpAfter.x).toBeCloseTo(0.7);
  });
});

describe('clampViewport', () => {
  it('does not modify a centered viewport at zoom=1 for a landscape image', () => {
    const vp: Viewport = { x: 0.5, y: 0.5, zoom: 1 };
    const result = clampViewport(vp, 16 / 9, 9 / 16);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.y).toBeCloseTo(0.5);
    expect(result.zoom).toBeGreaterThanOrEqual(1);
  });

  it('enforces minimum zoom for portrait images on 9:16 canvas', () => {
    const vp: Viewport = { x: 0.5, y: 0.5, zoom: 0.5 };
    const imgAspect = 3 / 4; // portrait image
    const canvasAspect = 9 / 16; // 9:16 canvas
    const result = clampViewport(vp, imgAspect, canvasAspect);
    expect(result.zoom).toBeGreaterThanOrEqual(computeMinZoom(imgAspect, canvasAspect));
  });

  it('clamps x position to prevent showing outside image bounds', () => {
    const vp: Viewport = { x: 0.0, y: 0.5, zoom: 2 };
    const result = clampViewport(vp, 16 / 9, 9 / 16);
    expect(result.x).toBeGreaterThan(0);
  });
});

describe('viewportToCSS', () => {
  it('returns identity transform for centered viewport at zoom=1', () => {
    const css = viewportToCSS({ x: 0.5, y: 0.5, zoom: 1 }, 1080, 1920);
    expect(css).toBe('scale(1) translate(0px, 0px)');
  });

  it('includes scale factor for zoomed viewport', () => {
    const css = viewportToCSS({ x: 0.5, y: 0.5, zoom: 2 }, 1080, 1920);
    expect(css).toContain('scale(2)');
  });
});

describe('viewportToSourceRect', () => {
  it('returns full image for centered viewport at zoom=1 with matching aspect', () => {
    const rect = viewportToSourceRect(
      { x: 0.5, y: 0.5, zoom: 1 },
      1080, 1920, // image matches canvas aspect
      1080, 1920
    );
    expect(rect.sx).toBeCloseTo(0);
    expect(rect.sy).toBeCloseTo(0);
    expect(rect.sw).toBeCloseTo(1080);
    expect(rect.sh).toBeCloseTo(1920);
  });

  it('returns smaller region for zoomed viewport', () => {
    const rect = viewportToSourceRect(
      { x: 0.5, y: 0.5, zoom: 2 },
      1080, 1920,
      1080, 1920
    );
    expect(rect.sw).toBeCloseTo(540);
    expect(rect.sh).toBeCloseTo(960);
  });
});

describe('computeMinZoom', () => {
  it('returns 1 for landscape image on portrait canvas', () => {
    expect(computeMinZoom(16 / 9, 9 / 16)).toBe(1);
  });

  it('returns > 1 for image narrower than canvas', () => {
    // Image aspect 1:3 (0.333) is narrower than canvas 9:16 (0.5625)
    const imgAspect = 1 / 3;
    const canvasAspect = 9 / 16;
    const minZoom = computeMinZoom(imgAspect, canvasAspect);
    // minZoom = canvasAspect / imgAspect = 0.5625 / 0.333 ≈ 1.6875
    expect(minZoom).toBeCloseTo(canvasAspect / imgAspect);
    expect(minZoom).toBeGreaterThan(1);
  });
});
