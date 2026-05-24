import { describe, it, expect } from 'vitest';
import {
  computeTimelineLayout,
  computeTotalDuration,
  getClipAtTime,
  getTransitionBetween,
} from './timeline';
import type { Clip, Transition } from '@/types/project';
import type { KenBurnsConfig } from '@/types/kenburns';

const kb: KenBurnsConfig = {
  startViewport: { x: 0.5, y: 0.5, zoom: 1 },
  endViewport: { x: 0.5, y: 0.5, zoom: 1.5 },
  easing: { type: 'preset', name: 'linear' },
};

function makeClip(id: string, order: number, duration: number): Clip {
  return {
    id,
    imageUrl: '',
    imageBlobKey: `blob-${id}`,
    startTime: 0,
    duration,
    kenburns: kb,
    order,
    naturalWidth: 1000,
    naturalHeight: 1000,
  };
}

describe('computeTimelineLayout', () => {
  it('lays out clips sequentially with no transitions', () => {
    const clips = [makeClip('a', 0, 4000), makeClip('b', 1, 3000)];
    const layout = computeTimelineLayout(clips, []);
    expect(layout[0].startTime).toBe(0);
    expect(layout[0].endTime).toBe(4000);
    expect(layout[1].startTime).toBe(4000);
    expect(layout[1].endTime).toBe(7000);
  });

  it('overlaps adjacent clips by the transition duration', () => {
    const clips = [makeClip('a', 0, 4000), makeClip('b', 1, 3000)];
    const transitions: Transition[] = [
      { id: 't1', type: 'crossfade', duration: 1000, fromClipId: 'a', toClipId: 'b' },
    ];
    const layout = computeTimelineLayout(clips, transitions);
    expect(layout[1].startTime).toBe(3000); // 4000 - 1000 overlap
    expect(layout[1].endTime).toBe(6000);
  });

  it('does not overlap for cut transitions', () => {
    const clips = [makeClip('a', 0, 4000), makeClip('b', 1, 3000)];
    const transitions: Transition[] = [
      { id: 't1', type: 'cut', duration: 1000, fromClipId: 'a', toClipId: 'b' },
    ];
    const layout = computeTimelineLayout(clips, transitions);
    expect(layout[1].startTime).toBe(4000);
  });

  it('sorts clips by order before layout', () => {
    const clips = [makeClip('b', 1, 3000), makeClip('a', 0, 4000)];
    const layout = computeTimelineLayout(clips, []);
    expect(layout[0].clip.id).toBe('a');
    expect(layout[1].clip.id).toBe('b');
  });
});

describe('computeTotalDuration', () => {
  it('sums durations minus overlaps', () => {
    const clips = [makeClip('a', 0, 4000), makeClip('b', 1, 3000)];
    expect(computeTotalDuration(clips, [])).toBe(7000);
    const transitions: Transition[] = [
      { id: 't1', type: 'crossfade', duration: 1000, fromClipId: 'a', toClipId: 'b' },
    ];
    expect(computeTotalDuration(clips, transitions)).toBe(6000);
  });

  it('returns 0 for an empty timeline', () => {
    expect(computeTotalDuration([], [])).toBe(0);
  });
});

describe('getClipAtTime', () => {
  const clips = [makeClip('a', 0, 4000), makeClip('b', 1, 3000)];
  const transitions: Transition[] = [
    { id: 't1', type: 'crossfade', duration: 1000, fromClipId: 'a', toClipId: 'b' },
  ];
  const layout = computeTimelineLayout(clips, transitions);

  it('returns a single clip outside the transition region', () => {
    const frame = getClipAtTime(1000, layout, transitions);
    expect(frame?.primary.clip.id).toBe('a');
    expect(frame?.secondary).toBeUndefined();
    expect(frame?.timeInPrimary).toBe(1000);
  });

  it('returns both clips and progress during a transition', () => {
    // overlap region is [3000, 4000); midpoint 3500 -> progress 0.5
    const frame = getClipAtTime(3500, layout, transitions);
    expect(frame?.primary.clip.id).toBe('a');
    expect(frame?.secondary?.clip.id).toBe('b');
    expect(frame?.transition?.id).toBe('t1');
    expect(frame?.transitionProgress).toBeCloseTo(0.5);
  });

  it('clamps to the last clip past the end', () => {
    const frame = getClipAtTime(99999, layout, transitions);
    expect(frame?.primary.clip.id).toBe('b');
  });

  it('returns null for an empty layout', () => {
    expect(getClipAtTime(0, [], [])).toBeNull();
  });
});

describe('getTransitionBetween', () => {
  it('finds a transition by clip pair', () => {
    const transitions: Transition[] = [
      { id: 't1', type: 'crossfade', duration: 1000, fromClipId: 'a', toClipId: 'b' },
    ];
    expect(getTransitionBetween(transitions, 'a', 'b')?.id).toBe('t1');
    expect(getTransitionBetween(transitions, 'b', 'a')).toBeUndefined();
  });
});
