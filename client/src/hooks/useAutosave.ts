/**
 * Debounced persistence: writes the active project to IndexedDB ~2s after the
 * last change. Mounted once (in the Editor). Project mutations flow through the
 * data store, so a single store subscription captures them all.
 */

import { useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { saveProject } from '@/store/db';
import { AUTO_SAVE_DEBOUNCE_MS } from '@/constants/defaults';

export function useAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useProjectStore.subscribe((state) => {
      const project = state.project;
      if (!project) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void saveProject(project);
      }, AUTO_SAVE_DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
