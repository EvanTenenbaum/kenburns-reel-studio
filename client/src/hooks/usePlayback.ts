/**
 * Playback split into two hooks so that exactly one rAF loop ever runs:
 *
 *  - `usePlaybackClock(totalDuration)` owns the requestAnimationFrame loop and
 *    must be mounted exactly once (in the Editor page).
 *  - `usePlaybackControls()` is a lightweight controls API (play/pause/seek)
 *    that any component can use without starting its own loop.
 *
 * Both read/write the playhead in the ephemeral UI store.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useUIStore, useProjectStore } from '@/store/projectStore';
import { computeTotalDuration } from '@/lib/timeline';

function currentTotalDuration(): number {
  const project = useProjectStore.getState().project;
  return project ? computeTotalDuration(project.clips, project.transitions) : 0;
}

export function usePlaybackClock(totalDuration: number): void {
  const isPlaying = useUIStore((s) => s.isPlaying);
  const setIsPlaying = useUIStore((s) => s.setIsPlaying);
  const setPlayhead = useUIStore((s) => s.setPlayhead);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const totalRef = useRef(totalDuration);
  totalRef.current = totalDuration;

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    lastTsRef.current = performance.now();
    const tick = (ts: number) => {
      const delta = ts - lastTsRef.current;
      lastTsRef.current = ts;
      const next = useUIStore.getState().playhead + delta;
      if (next >= totalRef.current) {
        setPlayhead(totalRef.current);
        setIsPlaying(false);
        return;
      }
      setPlayhead(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, setPlayhead, setIsPlaying]);
}

export function usePlaybackControls() {
  const isPlaying = useUIStore((s) => s.isPlaying);
  const setIsPlaying = useUIStore((s) => s.setIsPlaying);
  const setPlayhead = useUIStore((s) => s.setPlayhead);

  const play = useCallback(() => {
    const total = currentTotalDuration();
    if (total <= 0) return;
    if (useUIStore.getState().playhead >= total) setPlayhead(0);
    setIsPlaying(true);
  }, [setIsPlaying, setPlayhead]);

  const pause = useCallback(() => setIsPlaying(false), [setIsPlaying]);

  const toggle = useCallback(() => {
    if (useUIStore.getState().isPlaying) setIsPlaying(false);
    else play();
  }, [play, setIsPlaying]);

  const seek = useCallback(
    (ms: number) => {
      const total = currentTotalDuration();
      setPlayhead(Math.min(Math.max(ms, 0), total));
    },
    [setPlayhead]
  );

  const stop = useCallback(() => {
    setIsPlaying(false);
    setPlayhead(0);
  }, [setIsPlaying, setPlayhead]);

  return { isPlaying, play, pause, toggle, seek, stop };
}
