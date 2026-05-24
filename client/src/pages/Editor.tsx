import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ChevronLeft, Loader2 } from 'lucide-react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { Preview } from '@/components/Preview';
import { Timeline } from '@/components/Timeline';
import { Toolbar } from '@/components/Toolbar';
import { ClipControls } from '@/components/ClipControls';
import { TransitionPicker } from '@/components/TransitionPicker';
import { AudioPanel } from '@/components/AudioPanel';
import { ExportSheet } from '@/components/ExportSheet';
import { Button } from '@/components/ui/button';
import { useProject } from '@/hooks/useProject';
import { usePlaybackClock } from '@/hooks/usePlayback';
import { useAutosave } from '@/hooks/useAutosave';

export default function Editor() {
  const [, navigate] = useLocation();
  const [matched, params] = useRoute('/editor/:id');
  const id = params?.id;

  const { project, totalDuration, loadProjectById } = useProject();

  // Owns the single playback rAF loop for the whole editor.
  usePlaybackClock(totalDuration);
  // Debounced persistence of every project change to IndexedDB.
  useAutosave();

  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!id) return;
    let active = true;

    if (project?.id === id) {
      setStatus('ready');
      return;
    }

    setStatus('loading');
    loadProjectById(id).then((found) => {
      if (!active) return;
      setStatus(found ? 'ready' : 'missing');
    });

    return () => {
      active = false;
    };
  }, [id, project?.id, loadProjectById]);

  useEffect(() => {
    if (status === 'missing') navigate('/');
  }, [status, navigate]);

  if (!matched) return null;

  if (status !== 'ready' || !project) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="editor-surface fixed inset-0 flex flex-col bg-background text-foreground">
      <header className="safe-top flex items-center gap-2 border-b border-border px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to projects"
          onClick={() => navigate('/')}
          className="h-11 w-11 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-base font-semibold truncate">
          {project.name}
        </h1>
      </header>

      <div className="relative flex-1 min-h-0 bg-black">
        <ErrorBoundary>
          <Preview />
        </ErrorBoundary>
      </div>

      <div className="flex justify-center py-2">
        <Toolbar />
      </div>

      <div className="h-[32%] min-h-[120px] border-t border-border bg-card/40">
        <Timeline />
      </div>

      <ErrorBoundary>
        <ClipControls />
        <TransitionPicker />
        <AudioPanel />
        <ExportSheet />
      </ErrorBoundary>
    </div>
  );
}
