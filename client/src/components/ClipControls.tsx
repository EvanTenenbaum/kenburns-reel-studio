import { useEffect, useState } from 'react';
import { Move, Trash2 } from 'lucide-react';

import { useProject } from '@/hooks/useProject';
import { useUIStore } from '@/store/projectStore';
import { MOTION_PRESETS, configFromPreset } from '@/constants/presets';
import {
  MIN_CLIP_DURATION_MS,
  MAX_CLIP_DURATION_MS,
} from '@/constants/instagram';
import type { EasingPreset } from '@/types/kenburns';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const EASING_OPTIONS: { value: EasingPreset; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'slow-start', label: 'Slow Start' },
  { value: 'slow-end', label: 'Slow End' },
];

export function ClipControls() {
  const openPanel = useUIStore((s) => s.openPanel);
  const selectedClipId = useUIStore((s) => s.selectedClipId);
  const closePanel = useUIStore((s) => s.closePanel);

  const { clips, updateClipDuration, updateClipKenBurns, removeClip } =
    useProject();

  const clip = clips.find((c) => c.id === selectedClipId);

  const [durationLabel, setDurationLabel] = useState<number>(
    clip?.duration ?? MIN_CLIP_DURATION_MS
  );

  useEffect(() => {
    if (clip) setDurationLabel(clip.duration);
  }, [clip?.id, clip?.duration, clip]);

  const easingValue: EasingPreset =
    clip && clip.kenburns.easing.type === 'preset'
      ? clip.kenburns.easing.name
      : 'linear';

  return (
    <Drawer
      open={openPanel === 'clip'}
      onOpenChange={(o) => {
        if (!o) closePanel();
      }}
    >
      <DrawerContent>
        <DrawerHeader className="pt-2">
          <DrawerTitle className="font-display text-lg">
            Clip Settings
          </DrawerTitle>
          <DrawerDescription>
            Adjust duration, motion, and easing for this clip.
          </DrawerDescription>
        </DrawerHeader>

        {clip ? (
          <div className="max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col gap-7 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {/* Edit motion on image */}
              <Button
                className="h-12 w-full rounded-xl text-base font-medium transition-transform active:scale-[0.97]"
                onClick={() => {
                  useUIStore.getState().setMotionKeyframe('start');
                  closePanel();
                }}
              >
                <Move className="size-5" />
                Edit motion on image
              </Button>

              {/* Duration */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="font-display text-sm">Duration</Label>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {`${(durationLabel / 1000).toFixed(1)}s`}
                  </span>
                </div>
                <Slider
                  className="py-3"
                  min={MIN_CLIP_DURATION_MS}
                  max={MAX_CLIP_DURATION_MS}
                  step={100}
                  value={[durationLabel]}
                  onValueChange={(v) => setDurationLabel(v[0])}
                  onValueCommit={(v) => updateClipDuration(clip.id, v[0])}
                />
              </div>

              {/* Motion presets */}
              <div className="flex flex-col gap-3">
                <Label className="font-display text-sm">Motion preset</Label>
                <div className="grid grid-cols-3 gap-2.5">
                  {MOTION_PRESETS.map((preset) => {
                    const active = clip.kenburns.preset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          updateClipKenBurns(clip.id, configFromPreset(preset))
                        }
                        className={cn(
                          'bg-muted text-foreground flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl p-2 text-center transition-transform active:scale-[0.97]',
                          active && 'ring-2 ring-primary'
                        )}
                      >
                        {clip.thumbnail ? (
                          <span
                            className="h-8 w-8 shrink-0 rounded-md bg-cover bg-center"
                            style={{ backgroundImage: `url(${clip.thumbnail})` }}
                          />
                        ) : (
                          <span className="bg-background h-8 w-8 shrink-0 rounded-md" />
                        )}
                        <span className="text-[11px] font-medium leading-tight">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Easing */}
              <div className="flex flex-col gap-3">
                <Label className="font-display text-sm">Easing</Label>
                <Select
                  value={easingValue}
                  onValueChange={(name) =>
                    updateClipKenBurns(clip.id, {
                      ...clip.kenburns,
                      easing: { type: 'preset', name: name as EasingPreset },
                    })
                  }
                >
                  <SelectTrigger className="h-12 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EASING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delete */}
              <Button
                variant="destructive"
                className="h-12 w-full rounded-xl transition-transform active:scale-[0.97]"
                onClick={() => {
                  removeClip(clip.id);
                  closePanel();
                }}
              >
                <Trash2 className="size-5" />
                Delete clip
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-sm">
            No clip selected.
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
