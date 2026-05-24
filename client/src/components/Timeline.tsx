/**
 * Timeline — horizontally-scrollable filmstrip for the editor.
 *
 * Renders clip blocks (drag-to-reorder via dnd-kit), transition slots between
 * adjacent clips, a draggable ruler for scrubbing, a playhead line, and
 * pinch-to-zoom for adjusting the timeline scale.
 */

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePinch } from '@use-gesture/react';
import {
  ArrowLeft,
  ArrowRight,
  Blend,
  Circle,
  ImageIcon,
  Maximize,
  Plus,
  Scissors,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useProject } from '@/hooks/useProject';
import { usePlaybackControls } from '@/hooks/usePlayback';
import { getTransitionBetween } from '@/lib/timeline';
import type { ClipLayout } from '@/lib/timeline';
import { formatTime } from '@/lib/math';
import { useUIStore } from '@/store/projectStore';
import type { TransitionType } from '@/types/project';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const RULER_HEIGHT = 24;
const STRIP_HEIGHT = 88;

/** Visual metadata for each transition type shown in a slot. */
const TRANSITION_META: Record<TransitionType, { icon: LucideIcon; label: string }> = {
  cut: { icon: Scissors, label: 'Cut' },
  crossfade: { icon: Blend, label: 'Fade' },
  'fade-through-black': { icon: Circle, label: 'Black' },
  'fade-through-white': { icon: Circle, label: 'White' },
  'slide-left': { icon: ArrowLeft, label: 'Slide' },
  'slide-right': { icon: ArrowRight, label: 'Slide' },
  'zoom-through': { icon: Maximize, label: 'Zoom' },
  'blur-transition': { icon: Wind, label: 'Blur' },
};

function clipWidthPx(durationMs: number, pixelsPerSecond: number): number {
  return Math.max(44, (durationMs / 1000) * pixelsPerSecond);
}

interface SortableClipProps {
  layout: ClipLayout;
  pixelsPerSecond: number;
  selected: boolean;
  onSelect: (clipId: string) => void;
}

function SortableClip({ layout, pixelsPerSecond, selected, onSelect }: SortableClipProps) {
  const { clip, index } = layout;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clip.id });

  const style: CSSProperties = {
    width: clipWidthPx(clip.duration, pixelsPerSecond),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    backgroundImage: clip.thumbnail ? `url(${clip.thumbnail})` : undefined,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={`Clip ${index + 1}`}
      onClick={() => onSelect(clip.id)}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative h-full shrink-0 touch-none overflow-hidden rounded-md border border-border bg-muted bg-cover bg-center text-left',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected && 'ring-2 ring-primary',
        isDragging && 'z-10'
      )}
    >
      {!clip.thumbnail && (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="size-5" />
        </span>
      )}

      {/* Index badge */}
      <span className="absolute left-1 top-1 rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
        {index + 1}
      </span>

      {/* Duration label */}
      <span className="absolute bottom-1 right-1 rounded bg-background/70 px-1.5 py-0.5 text-[10px] tabular-nums text-foreground">
        {(clip.duration / 1000).toFixed(1)}s
      </span>
    </button>
  );
}

interface TransitionSlotProps {
  fromClipId: string;
  toClipId: string;
  type: TransitionType | null;
  onOpen: (fromClipId: string, toClipId: string) => void;
}

function TransitionSlot({ fromClipId, toClipId, type, onOpen }: TransitionSlotProps) {
  const meta = type ? TRANSITION_META[type] : null;
  const Icon = meta?.icon ?? Plus;

  const handlePress = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      // Never let this bubble into a clip drag.
      e.stopPropagation();
    },
    []
  );

  return (
    <div className="relative flex h-full w-0 shrink-0 items-center justify-center">
      <button
        type="button"
        aria-label={meta ? `Edit ${meta.label} transition` : 'Add transition'}
        onPointerDown={handlePress}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(fromClipId, toClipId);
        }}
        className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      >
        <span
          className={cn(
            'flex size-7 rotate-45 items-center justify-center rounded-md border shadow-sm transition-colors',
            meta
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="size-3.5 -rotate-45" />
        </span>
      </button>
    </div>
  );
}

export function Timeline() {
  const { layout, transitions, totalDuration, reorderClips } = useProject();
  const { seek } = usePlaybackControls();

  const playhead = useUIStore((s) => s.playhead);
  const selectedClipId = useUIStore((s) => s.selectedClipId);
  const pixelsPerSecond = useUIStore((s) => s.pixelsPerSecond);
  const selectClip = useUIStore((s) => s.selectClip);
  const setTransitionContext = useUIStore((s) => s.setTransitionContext);
  const openPanelKind = useUIStore((s) => s.openPanelKind);
  const setPixelsPerSecond = useUIStore((s) => s.setPixelsPerSecond);

  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const pinchBaseRef = useRef(pixelsPerSecond);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleSelectClip = useCallback(
    (clipId: string) => {
      selectClip(clipId);
      openPanelKind('clip');
    },
    [selectClip, openPanelKind]
  );

  const handleOpenTransition = useCallback(
    (fromClipId: string, toClipId: string) => {
      setTransitionContext({ fromClipId, toClipId });
      openPanelKind('transition');
    },
    [setTransitionContext, openPanelKind]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = layout.map((l) => l.clip.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from === -1 || to === -1) return;

      reorderClips(arrayMove(ids, from, to));
    },
    [layout, reorderClips]
  );

  // Clips render in flow at their (floored) duration widths. The playhead and
  // scrubber must use the SAME flow geometry, otherwise transition overlaps
  // (which shrink totalDuration) misalign the playhead from the clip blocks.
  const geometry = useMemo(() => {
    const widths = layout.map((l) => clipWidthPx(l.clip.duration, pixelsPerSecond));
    const offsets: number[] = [];
    let acc = 0;
    for (const w of widths) {
      offsets.push(acc);
      acc += w;
    }
    return { widths, offsets, totalWidth: acc };
  }, [layout, pixelsPerSecond]);

  const timeToFlowPx = useCallback(
    (t: number): number => {
      if (layout.length === 0) return 0;
      let idx = 0;
      for (let i = 0; i < layout.length; i++) {
        if (t >= layout[i].startTime) idx = i;
      }
      const { clip, startTime } = layout[idx];
      const frac = clip.duration > 0 ? (t - startTime) / clip.duration : 0;
      const clamped = frac < 0 ? 0 : frac > 1 ? 1 : frac;
      return geometry.offsets[idx] + clamped * geometry.widths[idx];
    },
    [layout, geometry]
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const inner = innerRef.current;
      if (!inner || layout.length === 0) return;
      const rect = inner.getBoundingClientRect();
      const px = Math.min(Math.max(clientX - rect.left, 0), geometry.totalWidth);
      // Map flow px back to real time using the matching clip block.
      let idx = 0;
      for (let i = 0; i < geometry.offsets.length; i++) {
        if (px >= geometry.offsets[i]) idx = i;
      }
      const { clip, startTime } = layout[idx];
      const w = geometry.widths[idx] || 1;
      const frac = Math.min(Math.max((px - geometry.offsets[idx]) / w, 0), 1);
      seek(startTime + frac * clip.duration);
    },
    [layout, geometry, seek]
  );

  const rulerDraggingRef = useRef(false);

  const handleRulerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      rulerDraggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      seekFromClientX(e.clientX);
    },
    [seekFromClientX]
  );

  const handleRulerPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!rulerDraggingRef.current) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX]
  );

  const handleRulerPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      rulerDraggingRef.current = false;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    []
  );

  usePinch(
    (state) => {
      if (state.first) {
        pinchBaseRef.current = pixelsPerSecond;
      }
      const scale =
        typeof state.offset?.[0] === 'number' && state.offset[0] > 0
          ? state.offset[0]
          : 1;
      setPixelsPerSecond(pinchBaseRef.current * scale);
    },
    {
      target: scrollRef,
      eventOptions: { passive: false },
    }
  );

  const contentWidth = Math.max(geometry.totalWidth, 1);
  const playheadLeft = timeToFlowPx(playhead);
  const clipIds = layout.map((l) => l.clip.id);

  if (layout.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center bg-card text-sm text-muted-foreground"
        style={{ height: STRIP_HEIGHT + RULER_HEIGHT }}
      >
        No clips yet — add images to begin
      </div>
    );
  }

  return (
    <div className="w-full select-none border-t border-border bg-card">
      <div
        ref={scrollRef}
        className="relative w-full touch-pan-x overflow-x-auto overflow-y-hidden"
      >
        <div
          ref={innerRef}
          className="relative"
          style={{ width: contentWidth, minWidth: '100%' }}
        >
          {/* Ruler / scrub track */}
          <div
            role="slider"
            aria-label="Timeline scrubber"
            aria-valuemin={0}
            aria-valuemax={Math.round(totalDuration)}
            aria-valuenow={Math.round(playhead)}
            tabIndex={0}
            onPointerDown={handleRulerPointerDown}
            onPointerMove={handleRulerPointerMove}
            onPointerUp={handleRulerPointerUp}
            onPointerCancel={handleRulerPointerUp}
            className="relative cursor-pointer border-b border-border bg-background/40"
            style={{ height: RULER_HEIGHT }}
          >
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground">
              {formatTime(playhead)}
            </span>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground">
              {formatTime(totalDuration)}
            </span>
          </div>

          {/* Clip strip with sortable clips + transition slots */}
          <div className="relative p-2" style={{ height: STRIP_HEIGHT }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={clipIds} strategy={horizontalListSortingStrategy}>
                <div className="flex h-full items-stretch gap-0">
                  {layout.map((item, i) => {
                    const next = layout[i + 1];
                    const transition = next
                      ? getTransitionBetween(transitions, item.clip.id, next.clip.id)
                      : undefined;
                    return (
                      <div key={item.clip.id} className="flex h-full items-stretch">
                        <SortableClip
                          layout={item}
                          pixelsPerSecond={pixelsPerSecond}
                          selected={selectedClipId === item.clip.id}
                          onSelect={handleSelectClip}
                        />
                        {next && (
                          <TransitionSlot
                            fromClipId={item.clip.id}
                            toClipId={next.clip.id}
                            type={transition ? transition.type : null}
                            onOpen={handleOpenTransition}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Playhead — spans ruler + strip */}
          <div
            className="pointer-events-none absolute top-0 z-20 w-0.5 bg-primary"
            style={{ left: playheadLeft, height: STRIP_HEIGHT + RULER_HEIGHT }}
          >
            <span className="absolute -top-0.5 left-1/2 size-2 -translate-x-1/2 rounded-full bg-primary" />
          </div>
        </div>
      </div>

      {/* Zoom controls (touch-friendly fallback for pinch) */}
      <div className="flex items-center justify-end gap-1 px-2 py-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Zoom out timeline"
          className="size-8"
          onClick={() => setPixelsPerSecond(pixelsPerSecond * 0.8)}
        >
          <span className="text-base leading-none">−</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Zoom in timeline"
          className="size-8"
          onClick={() => setPixelsPerSecond(pixelsPerSecond * 1.25)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
