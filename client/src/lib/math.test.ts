import { describe, it, expect } from 'vitest';
import { lerp, clamp, cubicBezier, applyEasing, formatTime, EASING_PRESETS } from './math';

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint when t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('works with negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns min when value is below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('returns max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('cubicBezier', () => {
  it('returns 0 at t=0', () => {
    expect(cubicBezier(0, 0.42, 0, 0.58, 1)).toBeCloseTo(0, 2);
  });

  it('returns 1 at t=1', () => {
    expect(cubicBezier(1, 0.42, 0, 0.58, 1)).toBeCloseTo(1, 2);
  });

  it('returns ~0.5 at t=0.5 for ease-in-out', () => {
    const result = cubicBezier(0.5, 0.42, 0, 0.58, 1);
    expect(result).toBeCloseTo(0.5, 1);
  });

  it('linear bezier returns t', () => {
    expect(cubicBezier(0.3, 0, 0, 1, 1)).toBeCloseTo(0.3, 2);
    expect(cubicBezier(0.7, 0, 0, 1, 1)).toBeCloseTo(0.7, 2);
  });
});

describe('applyEasing', () => {
  it('linear preset returns input unchanged', () => {
    const easing = { type: 'preset' as const, name: 'linear' as const };
    expect(applyEasing(0.5, easing)).toBeCloseTo(0.5, 2);
  });

  it('clamps input to 0-1', () => {
    const easing = { type: 'preset' as const, name: 'linear' as const };
    expect(applyEasing(-0.5, easing)).toBeCloseTo(0, 2);
    expect(applyEasing(1.5, easing)).toBeCloseTo(1, 2);
  });

  it('custom bezier works', () => {
    const easing = { type: 'bezier' as const, x1: 0, y1: 0, x2: 1, y2: 1 };
    expect(applyEasing(0.5, easing)).toBeCloseTo(0.5, 2);
  });
});

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('0:00.00');
  });

  it('formats seconds', () => {
    expect(formatTime(5000)).toBe('0:05.00');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(65000)).toBe('1:05.00');
  });

  it('formats centiseconds', () => {
    expect(formatTime(1500)).toBe('0:01.50');
  });
});

describe('EASING_PRESETS', () => {
  it('has all expected presets', () => {
    expect(EASING_PRESETS).toHaveProperty('linear');
    expect(EASING_PRESETS).toHaveProperty('ease-in');
    expect(EASING_PRESETS).toHaveProperty('ease-out');
    expect(EASING_PRESETS).toHaveProperty('ease-in-out');
    expect(EASING_PRESETS).toHaveProperty('slow-start');
    expect(EASING_PRESETS).toHaveProperty('slow-end');
  });

  it('linear preset has identity values', () => {
    const { x1, y1, x2, y2 } = EASING_PRESETS.linear;
    expect(x1).toBe(0);
    expect(y1).toBe(0);
    expect(x2).toBe(1);
    expect(y2).toBe(1);
  });
});
