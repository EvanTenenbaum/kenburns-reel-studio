import { useEffect, useRef, useState } from 'react';
import { Music, Plus, Trash2 } from 'lucide-react';

import { useProject } from '@/hooks/useProject';
import { useUIStore } from '@/store/projectStore';
import { formatTime } from '@/lib/math';
import { cn } from '@/lib/utils';
import type { AudioTrack } from '@/types/audio';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

function TrackWaveform({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url) {
      setFailed(true);
      return;
    }

    setFailed(false);
    let cancelled = false;
    let instance: { destroy: () => void } | null = null;

    void (async () => {
      try {
        const WaveSurfer = (await import('wavesurfer.js')).default;
        if (cancelled || !containerRef.current) return;
        instance = WaveSurfer.create({
          container: containerRef.current,
          url,
          height: 48,
          waveColor: '#52525b',
          progressColor: '#3b82f6',
          interact: false,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      try {
        instance?.destroy();
      } catch {
        /* ignore teardown errors */
      }
    };
  }, [url]);

  if (failed) {
    return <div className="bg-muted h-12 w-full rounded" />;
  }

  return <div ref={containerRef} className="h-12 w-full overflow-hidden" />;
}

function TrackCard({
  track,
  onRemove,
  onUpdate,
}: {
  track: AudioTrack;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<AudioTrack, 'id'>>) => void;
}) {
  return (
    <div className="bg-card border rounded-lg p-3 space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-sm font-medium">{track.name}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove track"
          className="size-11 text-destructive"
          onClick={() => onRemove(track.id)}
        >
          <Trash2 />
        </Button>
      </div>

      <TrackWaveform url={track.url} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Volume</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {Math.round(track.volume * 100)}%
          </span>
        </div>
        <Slider
          value={[track.volume * 100]}
          min={0}
          max={100}
          step={1}
          onValueCommit={(v) => onUpdate(track.id, { volume: v[0] / 100 })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Fade in</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {track.fadeIn} ms
          </span>
        </div>
        <Slider
          value={[track.fadeIn]}
          min={0}
          max={3000}
          step={100}
          onValueCommit={(v) => onUpdate(track.id, { fadeIn: v[0] })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Fade out</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {track.fadeOut} ms
          </span>
        </div>
        <Slider
          value={[track.fadeOut]}
          min={0}
          max={3000}
          step={100}
          onValueCommit={(v) => onUpdate(track.id, { fadeOut: v[0] })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Trim</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatTime(track.trimStart)} – {formatTime(track.trimEnd)}
          </span>
        </div>
        <Slider
          value={[track.trimStart, track.trimEnd]}
          min={0}
          max={Math.max(track.duration, track.trimEnd, 100)}
          step={100}
          onValueCommit={(v) =>
            onUpdate(track.id, { trimStart: v[0], trimEnd: v[1] })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor={`mute-${track.id}`}>Mute</Label>
        <Switch
          id={`mute-${track.id}`}
          checked={track.muted}
          onCheckedChange={(muted) => onUpdate(track.id, { muted })}
        />
      </div>
    </div>
  );
}

export function AudioPanel() {
  const openPanel = useUIStore((s) => s.openPanel);
  const closePanel = useUIStore((s) => s.closePanel);
  const { audioTracks, importAudio, removeAudioTrack, updateAudioTrack } =
    useProject();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = () => fileInputRef.current?.click();

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await importAudio(file);
    }
    event.target.value = '';
  };

  return (
    <Drawer
      open={openPanel === 'audio'}
      onOpenChange={(o) => {
        if (!o) closePanel();
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Music</DrawerTitle>
          <DrawerDescription>
            Add a soundtrack and shape its volume, fades, and trim.
          </DrawerDescription>
        </DrawerHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFiles}
        />

        <ScrollArea className="max-h-[60vh] flex-1">
          <div className="space-y-3 px-4 pb-[env(safe-area-inset-bottom)]">
            {audioTracks.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <Music className="text-muted-foreground size-8" />
                <p className="text-muted-foreground text-sm">No music added yet</p>
                <Button className="min-h-11" onClick={handlePick}>
                  <Plus />
                  Add music
                </Button>
              </div>
            ) : (
              <>
                {audioTracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    onRemove={removeAudioTrack}
                    onUpdate={updateAudioTrack}
                  />
                ))}
                <Button
                  variant="secondary"
                  className="min-h-11 w-full"
                  onClick={handlePick}
                >
                  <Plus />
                  Add music
                </Button>
                <div className={cn('h-2')} />
              </>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
