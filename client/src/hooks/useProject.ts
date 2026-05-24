/**
 * Primary data hook: exposes the active project, mutation actions, computed
 * timeline values, undo/redo, and async import/load operations.
 *
 * Components must use this rather than importing the store directly.
 */

import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';

import { useProjectStore, useUIStore } from '@/store/projectStore';
import {
  saveProject as dbSaveProject,
  loadProject as dbLoadProject,
  listProjects as dbListProjects,
  deleteProject as dbDeleteProject,
  saveBlob,
  loadBlob,
} from '@/store/db';
import type { Project } from '@/types/project';
import { computeTimelineLayout, computeTotalDuration } from '@/lib/timeline';
import { prepareImageImport, isSupportedImage } from '@/lib/image';
import { configFromPreset, getRandomPreset } from '@/constants/presets';
import { DEFAULT_CLIP_DURATION_MS } from '@/constants/instagram';
import { DEFAULT_AUDIO_FADE_MS, DEFAULT_AUDIO_VOLUME } from '@/constants/defaults';
import type { AspectRatio, Clip } from '@/types/project';
import type { AudioTrack } from '@/types/audio';

export function useProject() {
  const project = useProjectStore((s) => s.project);

  // Stable action references.
  const createProject = useProjectStore((s) => s.createProject);
  const setProject = useProjectStore((s) => s.setProject);
  const setName = useProjectStore((s) => s.setName);
  const setAspectRatio = useProjectStore((s) => s.setAspectRatio);
  const addClip = useProjectStore((s) => s.addClip);
  const removeClipAction = useProjectStore((s) => s.removeClip);
  const reorderClips = useProjectStore((s) => s.reorderClips);
  const updateClipKenBurns = useProjectStore((s) => s.updateClipKenBurns);
  const updateClipDuration = useProjectStore((s) => s.updateClipDuration);
  const addTransition = useProjectStore((s) => s.addTransition);
  const updateTransition = useProjectStore((s) => s.updateTransition);
  const removeTransition = useProjectStore((s) => s.removeTransition);
  const addAudioTrack = useProjectStore((s) => s.addAudioTrack);
  const removeAudioTrackAction = useProjectStore((s) => s.removeAudioTrack);
  const updateAudioTrack = useProjectStore((s) => s.updateAudioTrack);

  // Undo / redo via the temporal store.
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0);
  const undo = useCallback(() => useProjectStore.temporal.getState().undo(), []);
  const redo = useCallback(() => useProjectStore.temporal.getState().redo(), []);
  const clearHistory = useCallback(
    () => useProjectStore.temporal.getState().clear(),
    []
  );

  const clips = project?.clips ?? [];
  const transitions = project?.transitions ?? [];

  const layout = useMemo(
    () => computeTimelineLayout(clips, transitions),
    [clips, transitions]
  );
  const totalDuration = useMemo(
    () => computeTotalDuration(clips, transitions),
    [clips, transitions]
  );

  const newProject = useCallback(
    (name: string, aspectRatio: AspectRatio = '9:16') => {
      const created = createProject(name, aspectRatio);
      useProjectStore.temporal.getState().clear();
      useUIStore.getState().resetUI();
      void dbSaveProject(created);
      return created;
    },
    [createProject]
  );

  const loadProjectById = useCallback(
    async (id: string): Promise<boolean> => {
      const stored = await dbLoadProject(id);
      if (!stored) return false;

      // Release blob URLs from the previously loaded project to avoid leaks.
      const previous = useProjectStore.getState().project;
      if (previous && previous.id !== id) {
        previous.clips.forEach((c) => c.imageUrl && URL.revokeObjectURL(c.imageUrl));
        previous.audioTracks.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      }

      const hydratedClips = await Promise.all(
        stored.clips.map(async (c) => {
          const blob = await loadBlob(c.imageBlobKey);
          return { ...c, imageUrl: blob ? URL.createObjectURL(blob) : '' };
        })
      );
      const hydratedAudio = await Promise.all(
        stored.audioTracks.map(async (a) => {
          const blob = await loadBlob(a.blobKey);
          return { ...a, url: blob ? URL.createObjectURL(blob) : '' };
        })
      );

      setProject({ ...stored, clips: hydratedClips, audioTracks: hydratedAudio });
      useProjectStore.temporal.getState().clear();
      useUIStore.getState().resetUI();
      return true;
    },
    [setProject]
  );

  const importImages = useCallback(
    async (files: FileList | File[]): Promise<number> => {
      const list = Array.from(files).filter(isSupportedImage);
      if (list.length === 0) {
        toast.error('No supported images selected');
        return 0;
      }

      let added = 0;
      for (const file of list) {
        try {
          const prepared = await prepareImageImport(file);
          const blobKey = nanoid();
          await saveBlob(blobKey, prepared.blob);
          const preset = getRandomPreset();
          const clip: Clip = {
            id: nanoid(),
            imageUrl: URL.createObjectURL(prepared.blob),
            imageBlobKey: blobKey,
            startTime: 0,
            duration: DEFAULT_CLIP_DURATION_MS,
            kenburns: configFromPreset(preset),
            order: 0,
            thumbnail: prepared.thumbnail,
            naturalWidth: prepared.naturalWidth,
            naturalHeight: prepared.naturalHeight,
          };
          addClip(clip);
          added += 1;
        } catch (err) {
          console.error('Failed to import image', file.name, err);
          const detail =
            err instanceof Error && err.message ? ` — ${err.message}` : '';
          toast.error(`Could not import ${file.name}${detail}`);
        }
      }

      if (added > 0) {
        toast.success(added === 1 ? 'Image added' : `${added} images added`);
      }
      return added;
    },
    [addClip]
  );

  const importAudio = useCallback(
    async (file: File): Promise<boolean> => {
      try {
        const blobKey = nanoid();
        await saveBlob(blobKey, file);
        const url = URL.createObjectURL(file);
        const durationMs = await readAudioDuration(url);
        const track: AudioTrack = {
          id: nanoid(),
          name: file.name.replace(/\.[^.]+$/, ''),
          blobKey,
          url,
          startTime: 0,
          duration: durationMs,
          volume: DEFAULT_AUDIO_VOLUME,
          fadeIn: DEFAULT_AUDIO_FADE_MS,
          fadeOut: DEFAULT_AUDIO_FADE_MS,
          trimStart: 0,
          trimEnd: durationMs,
          muted: false,
        };
        addAudioTrack(track);
        toast.success('Music added');
        return true;
      } catch (err) {
        console.error('Failed to import audio', err);
        toast.error('Could not import audio file');
        return false;
      }
    },
    [addAudioTrack]
  );

  const listAllProjects = useCallback((): Promise<Project[]> => dbListProjects(), []);

  const deleteProjectById = useCallback(
    (id: string): Promise<void> => dbDeleteProject(id),
    []
  );

  const removeClip = useCallback(
    (clipId: string) => {
      const clip = useProjectStore.getState().project?.clips.find((c) => c.id === clipId);
      if (clip?.imageUrl) URL.revokeObjectURL(clip.imageUrl);
      removeClipAction(clipId);
    },
    [removeClipAction]
  );

  const removeAudioTrack = useCallback(
    (trackId: string) => {
      const track = useProjectStore
        .getState()
        .project?.audioTracks.find((a) => a.id === trackId);
      if (track?.url) URL.revokeObjectURL(track.url);
      removeAudioTrackAction(trackId);
    },
    [removeAudioTrackAction]
  );

  return {
    project,
    clips,
    transitions,
    audioTracks: project?.audioTracks ?? [],
    layout,
    totalDuration,
    aspectRatio: project?.canvas.aspectRatio ?? '9:16',

    // actions
    setName,
    setAspectRatio,
    addClip,
    removeClip,
    reorderClips,
    updateClipKenBurns,
    updateClipDuration,
    addTransition,
    updateTransition,
    removeTransition,
    addAudioTrack,
    removeAudioTrack,
    updateAudioTrack,

    // history
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,

    // async ops
    newProject,
    loadProjectById,
    listAllProjects,
    deleteProjectById,
    importImages,
    importAudio,
  };
}

function readAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const ms = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
      resolve(Math.round(ms));
    };
    audio.onerror = () => resolve(0);
    audio.src = url;
  });
}
