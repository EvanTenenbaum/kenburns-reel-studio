import { useEffect, useRef, useState } from 'react';
import { Music, Plus, Trash2 } from 'lucide-react';

import { useProject } from '@/hooks/useProject';
import { useUIStore } from '@/store/projectStore';
import { formatTime } from '@/lib/math';
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
    return <div className="bg-muted h-12 w-full rounded-lg" />;
  }

  return (
    <div
      ref={containerRef}
      className="bg-muted/40 h-12 w-full overflow-hidden rounded-lg"
    />
  );
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
    <div className="bg-card border-border space-y-5 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Music className="size-4" />
        </span>
        <span className="font-display flex-1 truncate text-sm">
          {track.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove track"
          className="text-destructive size-11 transition-transform active:scale-[0.97]"
          onClick={() => onRemove(track.id)}
        >
          <Trash2 />
        </Button>
      </div>

      <TrackWaveform url={track.url} />

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Volume</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {Math.round(track.volume * 100)}%
          </span>
        </div>
        <Slider
          className="py-2"
          value={[track.volume * 100]}
          min={0}
          max={100}
          step={1}
          onValueCommit={(v) => onUpdate(track.id, { volume: v[0] / 100 })}
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Fade in</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {track.fadeIn} ms
          </span>
        </div>
        <Slider
          className="py-2"
          value={[track.fadeIn]}
          min={0}
          max={3000}
          step={100}
          onValueCommit={(v) => onUpdate(track.id, { fadeIn: v[0] })}
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Fade out</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {track.fadeOut} ms
          </span>
        </div>
        <Slider
          className="py-2"
          value={[track.fadeOut]}
          min={0}
          max={3000}
          step={100}
          onValueCommit={(v) => onUpdate(track.id, { fadeOut: v[0] })}
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Trim</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatTime(track.trimStart)} – {formatTime(track.trimEnd)}
          </span>
        </div>
        <Slider
          className="py-2"
          value={[track.trimStart, track.trimEnd]}
          min={0}
          max={Math.max(track.duration, track.trimEnd, 100)}
          step={100}
          onValueCommit={(v) =>
            onUpdate(track.id, { trimStart: v[0], trimEnd: v[1] })
          }
        />
      </div>

      <div className="flex min-h-[44px] items-center justify-between">
        <Label htmlFor={`mute-${track.id}`} className="text-sm">
          Mute
        </Label>
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
        <DrawerHeader className="pt-2">
          <DrawerTitle className="font-display text-lg">Music</DrawerTitle>
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

        <div className="max-h-[85vh] flex-1 overflow-y-auto">
          <div className="space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {audioTracks.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl">
                  <Music className="size-7" />
                </span>
                <p className="text-muted-foreground text-sm">
                  No music added yet
                </p>
                <Button
                  className="h-12 rounded-xl px-6 transition-transform active:scale-[0.97]"
                  onClick={handlePick}
                >
                  <Plus className="size-5" />
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
                  className="h-12 w-full rounded-xl transition-transform active:scale-[0.97]"
                  onClick={handlePick}
                >
                  <Plus className="size-5" />
                  Add music
                </Button>
              </>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
