/**
 * Project state (undoable via zundo) and ephemeral UI state (NOT undoable).
 *
 * Layer rule: store may import types/, engine/, lib/, constants/ — never React
 * components or DOM. All project mutations go through actions here so they are
 * tracked by the temporal (undo/redo) middleware.
 */

import { create } from 'zustand';
import { temporal } from 'zundo';
import { nanoid } from 'nanoid';

import type { Project, Clip, Transition, AspectRatio, CanvasConfig } from '@/types/project';
import type { AudioTrack } from '@/types/audio';
import type { KenBurnsConfig } from '@/types/kenburns';
import { computeTimelineLayout } from '@/lib/timeline';
import { OUTPUT_SPECS, DEFAULT_FPS } from '@/constants/instagram';

export interface ProjectState {
  project: Project | null;

  createProject: (name: string, aspectRatio?: AspectRatio) => Project;
  /** Replace the active project (used when loading from IndexedDB). */
  setProject: (project: Project | null) => void;
  setName: (name: string) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;

  addClip: (clip: Clip) => void;
  removeClip: (clipId: string) => void;
  reorderClips: (orderedIds: string[]) => void;
  updateClipKenBurns: (clipId: string, kenburns: KenBurnsConfig) => void;
  updateClipDuration: (clipId: string, durationMs: number) => void;

  addTransition: (transition: Transition) => void;
  updateTransition: (transitionId: string, patch: Partial<Omit<Transition, 'id'>>) => void;
  removeTransition: (transitionId: string) => void;

  addAudioTrack: (track: AudioTrack) => void;
  removeAudioTrack: (trackId: string) => void;
  updateAudioTrack: (trackId: string, patch: Partial<Omit<AudioTrack, 'id'>>) => void;
}

function canvasFromAspect(aspectRatio: AspectRatio): CanvasConfig {
  const spec = OUTPUT_SPECS[aspectRatio];
  return {
    width: spec.width,
    height: spec.height,
    fps: DEFAULT_FPS,
    aspectRatio,
  };
}

/** Re-index clip order, prune dangling transitions, recompute start times. */
function normalize(project: Project): Project {
  const clips = [...project.clips]
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ ...c, order: i }));

  const adjacent = new Set<string>();
  for (let i = 0; i < clips.length - 1; i++) {
    adjacent.add(`${clips[i].id}>${clips[i + 1].id}`);
  }
  const transitions = project.transitions.filter((t) =>
    adjacent.has(`${t.fromClipId}>${t.toClipId}`)
  );

  const layout = computeTimelineLayout(clips, transitions);
  const startById = new Map(layout.map((l) => [l.clip.id, l.startTime]));
  const withTimes = clips.map((c) => ({ ...c, startTime: startById.get(c.id) ?? 0 }));

  return { ...project, clips: withTimes, transitions, updatedAt: Date.now() };
}

export const useProjectStore = create<ProjectState>()(
  temporal(
    (set, get) => {
      const mutate = (fn: (project: Project) => Project) => {
        const current = get().project;
        if (!current) return;
        set({ project: normalize(fn(current)) });
      };

      return {
        project: null,

        createProject: (name, aspectRatio = '9:16') => {
          const now = Date.now();
          const project: Project = {
            id: nanoid(),
            name: name.trim() || 'Untitled Reel',
            createdAt: now,
            updatedAt: now,
            canvas: canvasFromAspect(aspectRatio),
            clips: [],
            audioTracks: [],
            transitions: [],
          };
          set({ project });
          return project;
        },

        setProject: (project) => set({ project }),

        setName: (name) => mutate((p) => ({ ...p, name })),

        setAspectRatio: (aspectRatio) =>
          mutate((p) => ({ ...p, canvas: canvasFromAspect(aspectRatio) })),

        addClip: (clip) =>
          mutate((p) => ({
            ...p,
            clips: [...p.clips, { ...clip, order: p.clips.length }],
          })),

        removeClip: (clipId) =>
          mutate((p) => ({
            ...p,
            clips: p.clips.filter((c) => c.id !== clipId),
            transitions: p.transitions.filter(
              (t) => t.fromClipId !== clipId && t.toClipId !== clipId
            ),
          })),

        reorderClips: (orderedIds) =>
          mutate((p) => {
            const rank = new Map(orderedIds.map((id, i) => [id, i]));
            return {
              ...p,
              clips: p.clips.map((c) => ({
                ...c,
                order: rank.get(c.id) ?? c.order,
              })),
            };
          }),

        updateClipKenBurns: (clipId, kenburns) =>
          mutate((p) => ({
            ...p,
            clips: p.clips.map((c) => (c.id === clipId ? { ...c, kenburns } : c)),
          })),

        updateClipDuration: (clipId, durationMs) =>
          mutate((p) => ({
            ...p,
            clips: p.clips.map((c) =>
              c.id === clipId ? { ...c, duration: durationMs } : c
            ),
          })),

        addTransition: (transition) =>
          mutate((p) => ({
            ...p,
            transitions: [
              ...p.transitions.filter(
                (t) =>
                  !(
                    t.fromClipId === transition.fromClipId &&
                    t.toClipId === transition.toClipId
                  )
              ),
              transition,
            ],
          })),

        updateTransition: (transitionId, patch) =>
          mutate((p) => ({
            ...p,
            transitions: p.transitions.map((t) =>
              t.id === transitionId ? { ...t, ...patch } : t
            ),
          })),

        removeTransition: (transitionId) =>
          mutate((p) => ({
            ...p,
            transitions: p.transitions.filter((t) => t.id !== transitionId),
          })),

        addAudioTrack: (track) =>
          mutate((p) => ({ ...p, audioTracks: [...p.audioTracks, track] })),

        removeAudioTrack: (trackId) =>
          mutate((p) => ({
            ...p,
            audioTracks: p.audioTracks.filter((a) => a.id !== trackId),
          })),

        updateAudioTrack: (trackId, patch) =>
          mutate((p) => ({
            ...p,
            audioTracks: p.audioTracks.map((a) =>
              a.id === trackId ? { ...a, ...patch } : a
            ),
          })),
      };
    },
    {
      partialize: (state) => ({ project: state.project }),
      limit: 100,
      equality: (a, b) => a.project === b.project,
    }
  )
);

// ─── Ephemeral UI state (NOT tracked by undo/redo) ──────────────────────────

export type PanelKind = 'none' | 'clip' | 'transition' | 'audio' | 'export';

/** The adjacent clip pair a transition is being edited for. */
export interface TransitionContext {
  fromClipId: string;
  toClipId: string;
}

export interface UIState {
  /** Playhead position on the timeline in ms */
  playhead: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  /** Which adjacent clip pair the transition picker targets */
  transitionContext: TransitionContext | null;
  /** Timeline scale in pixels per second */
  pixelsPerSecond: number;
  openPanel: PanelKind;

  setPlayhead: (ms: number) => void;
  setIsPlaying: (playing: boolean) => void;
  selectClip: (clipId: string | null) => void;
  selectTransition: (transitionId: string | null) => void;
  setTransitionContext: (context: TransitionContext | null) => void;
  setPixelsPerSecond: (value: number) => void;
  openPanelKind: (panel: PanelKind) => void;
  closePanel: () => void;
  resetUI: () => void;
}

export const DEFAULT_PIXELS_PER_SECOND = 60;

export const useUIStore = create<UIState>((set) => ({
  playhead: 0,
  isPlaying: false,
  selectedClipId: null,
  selectedTransitionId: null,
  transitionContext: null,
  pixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
  openPanel: 'none',

  setPlayhead: (ms) => set({ playhead: Math.max(0, ms) }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  selectClip: (selectedClipId) =>
    set({ selectedClipId, selectedTransitionId: null }),
  selectTransition: (selectedTransitionId) =>
    set({ selectedTransitionId, selectedClipId: null }),
  setTransitionContext: (transitionContext) => set({ transitionContext }),
  setPixelsPerSecond: (pixelsPerSecond) =>
    set({ pixelsPerSecond: Math.min(Math.max(pixelsPerSecond, 10), 400) }),
  openPanelKind: (openPanel) => set({ openPanel }),
  closePanel: () => set({ openPanel: 'none' }),
  resetUI: () =>
    set({
      playhead: 0,
      isPlaying: false,
      selectedClipId: null,
      selectedTransitionId: null,
      transitionContext: null,
      openPanel: 'none',
    }),
}));
