import { create } from 'zustand';
import { toast } from 'sonner';
import { DEFAULT_AUDIO_FADE_MS, DEFAULT_AUDIO_VOLUME, DEFAULT_CANVAS_CONFIG } from '@/constants/defaults';
import { DEFAULT_CLIP_DURATION_MS, DEFAULT_TRANSITION_DURATION_MS } from '@/constants/instagram';
import { configFromPreset, getRandomPreset, MOTION_PRESETS } from '@/constants/presets';
import type { AudioTrack } from '@/types/audio';
import type { KenBurnsConfig, MotionPreset } from '@/types/kenburns';
import type { Clip, Project, Transition, TransitionType } from '@/types/project';
import { materializeProject, saveBlob, saveProject } from './db';

type PanelName = 'clip' | 'transition' | 'audio' | 'export' | null;

interface UIState {
  playhead: number;
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  activePanel: PanelName;
  timelineZoom: number;
  isPlaying: boolean;
}

interface ProjectState {
  project: Project | null;
  ui: UIState;
  past: Project[];
  future: Project[];
  createProject: (name?: string) => Project;
  loadProject: (project: Project) => Promise<void>;
  addClipFromFile: (file: File) => Promise<void>;
  removeClip: (clipId: string) => void;
  reorderClips: (fromIndex: number, toIndex: number) => void;
  updateClipDuration: (clipId: string, duration: number) => void;
  updateClipKenBurns: (clipId: string, kenburns: KenBurnsConfig) => void;
  applyPreset: (clipId: string, preset: MotionPreset) => void;
  addTransition: (fromClipId: string, toClipId: string, type?: TransitionType) => void;
  updateTransition: (transitionId: string, patch: Partial<Pick<Transition, 'type' | 'duration'>>) => void;
  addAudioTrackFromFile: (file: File) => Promise<void>;
  removeAudioTrack: (trackId: string) => void;
  updateAudioTrack: (trackId: string, patch: Partial<AudioTrack>) => void;
  seek: (time: number) => void;
  setSelectedClip: (clipId: string | null) => void;
  setSelectedTransition: (transitionId: string | null) => void;
  setPanel: (panel: PanelName) => void;
  setPlaying: (playing: boolean) => void;
  setTimelineZoom: (zoom: number) => void;
  undo: () => void;
  redo: () => void;
  persistNow: () => Promise<void>;
}

const emptyUI: UIState = {
  playhead: 0,
  selectedClipId: null,
  selectedTransitionId: null,
  activePanel: null,
  timelineZoom: 1,
  isPlaying: false,
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function clone(project: Project): Project {
  return structuredClone(project);
}

function recomputeTimeline(project: Project): Project {
  let cursor = 0;
  const clips = project.clips
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((clip, index) => {
      const next = { ...clip, order: index, startTime: cursor };
      const transition = project.transitions.find((item) => item.fromClipId === clip.id);
      cursor += clip.duration - (transition?.duration ?? 0);
      return next;
    });

  const validIds = new Set(clips.map((clip) => clip.id));
  const transitions = project.transitions.filter((transition) => (
    validIds.has(transition.fromClipId) && validIds.has(transition.toClipId)
  ));

  return { ...project, clips, transitions, updatedAt: Date.now() };
}

function createDefaultProject(name = 'Untitled Reel'): Project {
  const now = Date.now();
  return {
    id: id('project'),
    name,
    createdAt: now,
    updatedAt: now,
    canvas: DEFAULT_CANVAS_CONFIG,
    clips: [],
    audioTracks: [],
    transitions: [],
  };
}

function withHistory(set: (partial: Partial<ProjectState> | ((state: ProjectState) => Partial<ProjectState>)) => void, mutate: (project: Project) => Project): void {
  set((state) => {
    if (!state.project) return {};
    const next = recomputeTimeline(mutate(clone(state.project)));
    scheduleSave(next);
    return { project: next, past: [...state.past, clone(state.project)].slice(-40), future: [] };
  });
}

function scheduleSave(project: Project): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveProject(project).catch((error: unknown) => {
      console.error(error);
      toast.error('Autosave failed');
    });
  }, 600);
}

function imageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Could not read image dimensions'));
    image.src = url;
  });
}

async function thumbnailFor(url: string): Promise<string> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 150;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  if (!ctx) return url;
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export function totalDuration(project: Project | null): number {
  if (!project || project.clips.length === 0) return 0;
  return Math.max(...project.clips.map((clip) => clip.startTime + clip.duration));
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  ui: emptyUI,
  past: [],
  future: [],

  createProject: (name) => {
    const project = createDefaultProject(name);
    set({ project, ui: emptyUI, past: [], future: [] });
    scheduleSave(project);
    return project;
  },

  loadProject: async (project) => {
    const hydrated = await materializeProject(project);
    set({ project: recomputeTimeline(hydrated), ui: emptyUI, past: [], future: [] });
  },

  addClipFromFile: async (file) => {
    const project = get().project ?? get().createProject('Mobile Reel');
    const blobId = id('image');
    const imageUrl = URL.createObjectURL(file);
    const dims = await imageDimensions(imageUrl);
    const thumbnail = await thumbnailFor(imageUrl);
    await saveBlob({ id: blobId, projectId: project.id, kind: 'image', name: file.name, type: file.type, blob: file });
    const preset = getRandomPreset();
    const clip: Clip = {
      id: id('clip'),
      imageUrl,
      imageBlobKey: blobId,
      startTime: 0,
      duration: DEFAULT_CLIP_DURATION_MS,
      kenburns: configFromPreset(preset),
      order: project.clips.length,
      thumbnail,
      naturalWidth: dims.width,
      naturalHeight: dims.height,
    };
    withHistory(set, (draft) => ({ ...draft, clips: [...draft.clips, clip] }));
    set((state) => ({ ui: { ...state.ui, selectedClipId: clip.id, activePanel: null } }));
    toast.success(`Imported ${file.name}`);
  },

  removeClip: (clipId) => withHistory(set, (project) => ({
    ...project,
    clips: project.clips.filter((clip) => clip.id !== clipId),
    transitions: project.transitions.filter((transition) => transition.fromClipId !== clipId && transition.toClipId !== clipId),
  })),

  reorderClips: (fromIndex, toIndex) => withHistory(set, (project) => {
    const clips = project.clips.slice().sort((a, b) => a.order - b.order);
    const [moved] = clips.splice(fromIndex, 1);
    if (!moved) return project;
    clips.splice(toIndex, 0, moved);
    return { ...project, clips: clips.map((clip, order) => ({ ...clip, order })) };
  }),

  updateClipDuration: (clipId, duration) => withHistory(set, (project) => ({
    ...project,
    clips: project.clips.map((clip) => clip.id === clipId ? { ...clip, duration } : clip),
  })),

  updateClipKenBurns: (clipId, kenburns) => withHistory(set, (project) => ({
    ...project,
    clips: project.clips.map((clip) => clip.id === clipId ? { ...clip, kenburns } : clip),
  })),

  applyPreset: (clipId, preset) => {
    const knownPreset = MOTION_PRESETS.some((item) => item.id === preset) ? preset : 'zoom-in-center';
    const definition = MOTION_PRESETS.find((item) => item.id === knownPreset) ?? MOTION_PRESETS[0];
    get().updateClipKenBurns(clipId, configFromPreset(definition));
  },

  addTransition: (fromClipId, toClipId, type = 'crossfade') => withHistory(set, (project) => ({
    ...project,
    transitions: [
      ...project.transitions.filter((transition) => transition.fromClipId !== fromClipId),
      { id: id('transition'), fromClipId, toClipId, type, duration: DEFAULT_TRANSITION_DURATION_MS },
    ],
  })),

  updateTransition: (transitionId, patch) => withHistory(set, (project) => ({
    ...project,
    transitions: project.transitions.map((transition) => transition.id === transitionId ? { ...transition, ...patch } : transition),
  })),

  addAudioTrackFromFile: async (file) => {
    const project = get().project ?? get().createProject('Mobile Reel');
    const blobKey = id('audio');
    const url = URL.createObjectURL(file);
    await saveBlob({ id: blobKey, projectId: project.id, kind: 'audio', name: file.name, type: file.type, blob: file });
    const audio = document.createElement('audio');
    audio.src = url;
    await new Promise<void>((resolve) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => resolve();
    });
    const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : totalDuration(project);
    const track: AudioTrack = {
      id: id('audioTrack'),
      name: file.name,
      blobKey,
      url,
      startTime: 0,
      duration: Math.max(duration, 1000),
      volume: DEFAULT_AUDIO_VOLUME,
      fadeIn: DEFAULT_AUDIO_FADE_MS,
      fadeOut: DEFAULT_AUDIO_FADE_MS,
      trimStart: 0,
      trimEnd: Math.max(duration, 1000),
      muted: false,
    };
    withHistory(set, (draft) => ({ ...draft, audioTracks: [...draft.audioTracks, track] }));
    toast.success(`Added music: ${file.name}`);
  },

  removeAudioTrack: (trackId) => withHistory(set, (project) => ({
    ...project,
    audioTracks: project.audioTracks.filter((track) => track.id !== trackId),
  })),

  updateAudioTrack: (trackId, patch) => withHistory(set, (project) => ({
    ...project,
    audioTracks: project.audioTracks.map((track) => track.id === trackId ? { ...track, ...patch } : track),
  })),

  seek: (time) => set((state) => ({ ui: { ...state.ui, playhead: Math.max(0, Math.min(time, totalDuration(state.project))) } })),
  setSelectedClip: (clipId) => set((state) => ({ ui: { ...state.ui, selectedClipId: clipId, selectedTransitionId: null } })),
  setSelectedTransition: (transitionId) => set((state) => ({ ui: { ...state.ui, selectedTransitionId: transitionId, selectedClipId: null } })),
  setPanel: (panel) => set((state) => ({ ui: { ...state.ui, activePanel: panel } })),
  setPlaying: (playing) => set((state) => ({ ui: { ...state.ui, isPlaying: playing } })),
  setTimelineZoom: (zoom) => set((state) => ({ ui: { ...state.ui, timelineZoom: Math.max(0.5, Math.min(4, zoom)) } })),

  undo: () => set((state) => {
    const previous = state.past.at(-1);
    if (!previous || !state.project) return {};
    scheduleSave(previous);
    return { project: previous, past: state.past.slice(0, -1), future: [clone(state.project), ...state.future].slice(0, 40) };
  }),

  redo: () => set((state) => {
    const [next, ...future] = state.future;
    if (!next || !state.project) return {};
    scheduleSave(next);
    return { project: next, past: [...state.past, clone(state.project)].slice(-40), future };
  }),

  persistNow: async () => {
    const project = get().project;
    if (project) await saveProject(project);
  },
}));
