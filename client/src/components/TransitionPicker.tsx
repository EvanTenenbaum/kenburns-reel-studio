import { useProject } from '@/hooks/useProject';
import { useUIStore } from '@/store/projectStore';
import {
  MIN_TRANSITION_DURATION_MS,
  MAX_TRANSITION_DURATION_MS,
  DEFAULT_TRANSITION_DURATION_MS,
} from '@/constants/instagram';
import { getTransitionBetween } from '@/lib/timeline';
import { TRANSITIONS } from '@/engine/transitions';
import type { Transition, TransitionType } from '@/types/project';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function TransitionPicker() {
  const openPanel = useUIStore((s) => s.openPanel);
  const transitionContext = useUIStore((s) => s.transitionContext);
  const closePanel = useUIStore((s) => s.closePanel);

  const {
    transitions,
    addTransition,
    updateTransition,
    removeTransition,
  } = useProject();

  const ctx = transitionContext;
  const existing = ctx
    ? getTransitionBetween(transitions, ctx.fromClipId, ctx.toClipId)
    : undefined;

  const selectedType: TransitionType = existing ? existing.type : 'cut';
  const duration = existing?.duration ?? DEFAULT_TRANSITION_DURATION_MS;

  const handleSelect = (type: TransitionType) => {
    if (!ctx) return;
    if (type === 'cut') {
      if (existing) removeTransition(existing.id);
      return;
    }
    const t: Transition = {
      id: existing?.id ?? crypto.randomUUID(),
      type,
      duration: existing?.duration ?? DEFAULT_TRANSITION_DURATION_MS,
      fromClipId: ctx.fromClipId,
      toClipId: ctx.toClipId,
    };
    addTransition(t);
  };

  const handleDurationCommit = (value: number) => {
    if (!ctx) return;
    if (existing) {
      updateTransition(existing.id, { duration: value });
    } else {
      const t: Transition = {
        id: crypto.randomUUID(),
        type: 'crossfade',
        duration: value,
        fromClipId: ctx.fromClipId,
        toClipId: ctx.toClipId,
      };
      addTransition(t);
    }
  };

  return (
    <Drawer
      open={openPanel === 'transition'}
      onOpenChange={(o) => {
        if (!o) closePanel();
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Transition</DrawerTitle>
          <DrawerDescription>
            Choose how this clip blends into the next.
          </DrawerDescription>
        </DrawerHeader>

        {ctx ? (
          <ScrollArea className="max-h-[70vh] overflow-y-auto">
            <div className="flex flex-col gap-6 px-4 pb-[env(safe-area-inset-bottom)]">
              <div className="grid grid-cols-2 gap-2">
                {TRANSITIONS.map((meta) => {
                  const active = selectedType === meta.type;
                  return (
                    <button
                      key={meta.type}
                      type="button"
                      onClick={() => handleSelect(meta.type)}
                      className={cn(
                        'bg-secondary text-secondary-foreground hover:bg-secondary/80 flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-md p-3 text-left transition-colors',
                        active && 'ring-2 ring-primary'
                      )}
                    >
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="text-muted-foreground text-xs leading-tight">
                        {meta.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedType !== 'cut' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Duration</Label>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {`${(duration / 1000).toFixed(2)}s`}
                    </span>
                  </div>
                  <Slider
                    className="py-3"
                    min={MIN_TRANSITION_DURATION_MS}
                    max={MAX_TRANSITION_DURATION_MS}
                    step={50}
                    value={[duration]}
                    onValueCommit={(v) => handleDurationCommit(v[0])}
                  />
                </div>
              ) : null}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-muted-foreground px-4 pb-[env(safe-area-inset-bottom)] pt-2 text-sm">
            No transition selected.
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
