/**
 * Timeline layout math — pure functions, no React/DOM.
 *
 * Clips are laid out in `order`. A transition between two adjacent clips
 * creates an overlap: the incoming clip starts `transition.duration` ms
 * before the outgoing clip ends. Total duration therefore equals the sum
 * of clip durations minus the sum of (non-cut) transition durations.
 */

import type { Clip, Transition, TransitionType } from '@/types/project';

export interface ClipLayout {
  clip: Clip;
  /** Absolute start time on the timeline in ms */
  startTime: number;
  /** Absolute end time on the timeline in ms */
  endTime: number;
  /** Position in the sorted sequence */
  index: number;
}

export interface ActiveFrame {
  /** The outgoing (or only) clip layout */
  primary: ClipLayout;
  /** The incoming clip layout, present only during a transition overlap */
  secondary?: ClipLayout;
  /** The transition being played, if any */
  transition?: Transition;
  /** Progress through the transition (0–1); 0 when not transitioning */
  transitionProgress: number;
  /** Time within the primary clip in ms */
  timeInPrimary: number;
  /** Time within the secondary clip in ms */
  timeInSecondary: number;
}

/** A transition with this type produces no overlap (hard cut). */
export const NON_OVERLAPPING: ReadonlySet<TransitionType> = new Set<TransitionType>(['cut']);

/**
 * Find the transition that connects two clips by id (order-independent on
 * lookup, but transitions are stored with explicit from/to ids).
 */
export function getTransitionBetween(
  transitions: Transition[],
  fromClipId: string,
  toClipId: string
): Transition | undefined {
  return transitions.find(
    (t) => t.fromClipId === fromClipId && t.toClipId === toClipId
  );
}

/**
 * Compute absolute start/end times for every clip, accounting for transition
 * overlaps. Clips are sorted by their `order` field.
 */
export function computeTimelineLayout(
  clips: Clip[],
  transitions: Transition[]
): ClipLayout[] {
  const sorted = [...clips].sort((a, b) => a.order - b.order);
  const layout: ClipLayout[] = [];
  let cursor = 0;

  for (let i = 0; i < sorted.length; i++) {
    const clip = sorted[i];
    const startTime = cursor;
    const endTime = startTime + clip.duration;
    layout.push({ clip, startTime, endTime, index: i });

    const next = sorted[i + 1];
    let overlap = 0;
    if (next) {
      const transition = getTransitionBetween(transitions, clip.id, next.id);
      if (transition && !NON_OVERLAPPING.has(transition.type)) {
        // Never overlap more than either clip can supply.
        overlap = Math.min(transition.duration, clip.duration, next.duration);
      }
    }
    cursor = endTime - overlap;
  }

  return layout;
}

/**
 * Total timeline duration in ms.
 */
export function computeTotalDuration(
  clips: Clip[],
  transitions: Transition[]
): number {
  const layout = computeTimelineLayout(clips, transitions);
  return layout.length > 0 ? layout[layout.length - 1].endTime : 0;
}

/**
 * Resolve which clip(s) are visible at an absolute timeline time, and the
 * transition state if two clips overlap.
 */
export function getClipAtTime(
  time: number,
  layout: ClipLayout[],
  transitions: Transition[]
): ActiveFrame | null {
  if (layout.length === 0) return null;

  const active = layout.filter((l) => time >= l.startTime && time < l.endTime);

  if (active.length === 0) {
    // Before the start, or exactly at/after the end — clamp to nearest clip.
    if (time < layout[0].startTime) {
      return singleFrame(layout[0], 0);
    }
    const last = layout[layout.length - 1];
    return singleFrame(last, last.clip.duration);
  }

  if (active.length === 1) {
    const only = active[0];
    return singleFrame(only, time - only.startTime);
  }

  // Two overlapping clips → a transition is in progress.
  const [primary, secondary] = active;
  const transition = getTransitionBetween(
    transitions,
    primary.clip.id,
    secondary.clip.id
  );
  const overlapStart = secondary.startTime;
  const overlapDuration = Math.max(primary.endTime - overlapStart, 1);
  const transitionProgress = clampUnit(
    (time - overlapStart) / overlapDuration
  );

  return {
    primary,
    secondary,
    transition,
    transitionProgress,
    timeInPrimary: time - primary.startTime,
    timeInSecondary: time - secondary.startTime,
  };
}

function singleFrame(layout: ClipLayout, timeInClip: number): ActiveFrame {
  return {
    primary: layout,
    transitionProgress: 0,
    timeInPrimary: timeInClip,
    timeInSecondary: 0,
  };
}

function clampUnit(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
