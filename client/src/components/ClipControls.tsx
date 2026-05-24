import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [adjustFraming, setAdjustFraming] = useState(false);

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
        <DrawerHeader>
          <DrawerTitle>Clip Settings</DrawerTitle>
          <DrawerDescription>
            Adjust duration, motion, and easing for this clip.
          </DrawerDescription>
        </DrawerHeader>

        {clip ? (
          <ScrollArea className="max-h-[70vh] overflow-y-auto">
            <div className="flex flex-col gap-6 px-4 pb-[env(safe-area-inset-bottom)]">
              {/* Duration */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>Duration</Label>
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
              <div className="flex flex-col gap-2">
                <Label>Motion</Label>
                <div className="grid grid-cols-3 gap-2">
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
                          'bg-secondary text-secondary-foreground hover:bg-secondary/80 flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-md p-2 text-center text-xs font-medium transition-colors',
                          active && 'ring-2 ring-primary'
                        )}
                      >
                        {clip.thumbnail ? (
                          <span
                            className="h-6 w-6 shrink-0 rounded-sm bg-cover bg-center"
                            style={{ backgroundImage: `url(${clip.thumbnail})` }}
                          />
                        ) : null}
                        <span className="leading-tight">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Easing */}
              <div className="flex flex-col gap-2">
                <Label>Easing</Label>
                <Select
                  value={easingValue}
                  onValueChange={(name) =>
                    updateClipKenBurns(clip.id, {
                      ...clip.kenburns,
                      easing: { type: 'preset', name: name as EasingPreset },
                    })
                  }
                >
                  <SelectTrigger className="w-full">
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

              {/* Adjust framing */}
              <div className="flex flex-col gap-2">
                <div className="flex min-h-[44px] items-center justify-between gap-3">
                  <Label htmlFor="adjust-framing">
                    Adjust framing in preview
                  </Label>
                  <Switch
                    id="adjust-framing"
                    checked={adjustFraming}
                    onCheckedChange={setAdjustFraming}
                  />
                </div>
                {adjustFraming ? (
                  <p className="text-muted-foreground text-sm">
                    Drag and pinch the preview to reposition the shot.
                  </p>
                ) : null}
              </div>

              {/* Delete */}
              <Button
                variant="destructive"
                className="min-h-[44px] w-full"
                onClick={() => {
                  removeClip(clip.id);
                  closePanel();
                }}
              >
                <Trash2 />
                Delete clip
              </Button>
            </div>
          </ScrollArea>
        ) : (
          <div className="text-muted-foreground px-4 pb-[env(safe-area-inset-bottom)] pt-2 text-sm">
            No clip selected.
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
