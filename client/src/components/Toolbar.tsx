import { useRef } from 'react';
import {
  ImagePlus,
  Music,
  Undo2,
  Redo2,
  Play,
  Pause,
  Download,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useProject } from '@/hooks/useProject';
import { usePlaybackControls } from '@/hooks/usePlayback';
import { useUIStore } from '@/store/projectStore';

/**
 * Floating horizontal action bar that sits just above the timeline. The Editor
 * is responsible for positioning it; this component only renders the bar.
 */
export function Toolbar() {
  const { importImages, undo, redo, canUndo, canRedo } = useProject();
  const { isPlaying, toggle } = usePlaybackControls();
  const openPanelKind = useUIStore((s) => s.openPanelKind);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await importImages(files);
    }
    event.target.value = '';
  };

  return (
    <div
      className="flex items-center gap-1 rounded-2xl border border-border bg-card/90 px-2 py-1.5 shadow-lg shadow-black/30 backdrop-blur-md"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Group: add media */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl transition-transform active:scale-[0.97]"
          aria-label="Add image"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="size-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl transition-transform active:scale-[0.97]"
          aria-label="Add music"
          onClick={() => openPanelKind('audio')}
        >
          <Music className="size-5" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-7" />

      {/* Group: history */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl transition-transform active:scale-[0.97]"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => undo()}
        >
          <Undo2 className="size-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl transition-transform active:scale-[0.97]"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={() => redo()}
        >
          <Redo2 className="size-5" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-7" />

      {/* Play / pause */}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="h-11 w-11 rounded-xl transition-transform active:scale-[0.97]"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={() => toggle()}
      >
        {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
      </Button>

      <Separator orientation="vertical" className="mx-1 h-7" />

      {/* Primary action: export */}
      <Button
        type="button"
        variant="default"
        size="icon"
        className="h-11 w-11 rounded-xl shadow-sm transition-transform active:scale-[0.97]"
        aria-label="Export"
        onClick={() => openPanelKind('export')}
      >
        <Download className="size-5" />
      </Button>
    </div>
  );
}
