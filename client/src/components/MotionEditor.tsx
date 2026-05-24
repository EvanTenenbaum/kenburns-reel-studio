import type { JSX } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, X } from 'lucide-react';

import type { EasingConfig, EasingPreset, Viewport } from '@/types/kenburns';
import { interpolateViewport } from '@/engine/kenburns';
import { MOTION_PRESETS, type PresetDefinition } from '@/constants/presets';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  computeImageDisplay,
  frameRectToViewport,
  viewportToFrameRect,
  type FrameRect,
  type ImageDisplay,
} from '@/lib/viewportFrame';

export type MotionKeyframe = 'start' | 'end';

type Corner = 'nw' | 'ne' | 'sw' | 'se';

interface MotionEditorProps {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  /** output aspect = width/height */
  canvasAspect: number;
  startViewport: Viewport;
  endViewport: Viewport;
  activeKeyframe: MotionKeyframe;
  /** Clip duration in ms — drives the speed slider and preview playback. */
  durationMs: number;
  /** Clip easing — drives the easing select and preview playback. */
  easing: EasingConfig;
  /** Clamp a viewport so the crop stays inside the image (provided by parent). */
  clampViewport: (vp: Viewport) => Viewport;
  onKeyframeChange: (kf: MotionKeyframe) => void;
  /** on release of a drag/resize gesture (one undo step) */
  onViewportCommit: (kf: MotionKeyframe, vp: Viewport) => void;
  onDurationChange: (ms: number) => void;
  onEasingChange: (easing: EasingConfig) => void;
  onApplyPreset: (preset: PresetDefinition) => void;
  onClose: () => void;
}

interface ContainerSize {
  width: number;
  height: number;
}

interface Gesture {
  mode: 'move' | 'resize';
  corner: Corner | null;
  startClientX: number;
  startClientY: number;
  startRect: FrameRect;
  containerLeft: number;
  containerTop: number;
}

const KEYFRAME_LABEL: Record<MotionKeyframe, string> = {
  start: 'Start',
  end: 'End',
};

const EASING_OPTIONS: { value: EasingPreset; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'slow-start', label: 'Slow Start' },
  { value: 'slow-end', label: 'Slow End' },
];

const CORNERS: { corner: Corner; className: string }[] = [
  { corner: 'nw', className: 'left-0 top-0 cursor-nwse-resize' },
  { corner: 'ne', className: 'left-full top-0 cursor-nesw-resize' },
  { corner: 'sw', className: 'left-0 top-full cursor-nesw-resize' },
  { corner: 'se', className: 'left-full top-full cursor-nwse-resize' },
];

const MIN_PREVIEW_MS = 600;

export function MotionEditor(props: MotionEditorProps): JSX.Element {
  const {
    imageUrl,
    naturalWidth,
    naturalHeight,
    canvasAspect,
    startViewport,
    endViewport,
    activeKeyframe,
    durationMs,
    easing,
    clampViewport,
    onKeyframeChange,
    onViewportCommit,
    onDurationChange,
    onEasingChange,
    onApplyPreset,
    onClose,
  } = props;

  const stageRef = useRef<HTMLDivElement | null>(null);

  const [container, setContainer] = useState<ContainerSize>({
    width: 0,
    height: 0,
  });

  // The active frame's live rectangle, in stage pixels.
  const [activeRect, setActiveRect] = useState<FrameRect | null>(null);
  const [isGesturing, setIsGesturing] = useState(false);

  // Preview playback state.
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRect, setPreviewRect] = useState<FrameRect | null>(null);

  // Measure the stage area (the region above the controls) with a ResizeObserver.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setContainer((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasImage = naturalWidth > 0 && naturalHeight > 0;
  const hasContainer = container.width > 0 && container.height > 0;

  const display: ImageDisplay = hasImage && hasContainer
    ? computeImageDisplay(
        naturalWidth,
        naturalHeight,
        container.width,
        container.height,
      )
    : { scale: 0, offsetX: 0, offsetY: 0, dispW: 0, dispH: 0 };

  const activeViewport =
    activeKeyframe === 'start' ? startViewport : endViewport;
  const inactiveKeyframe: MotionKeyframe =
    activeKeyframe === 'start' ? 'end' : 'start';
  const inactiveViewport =
    activeKeyframe === 'start' ? endViewport : startViewport;

  // Sync the active frame rect from props whenever the active keyframe, its
  // viewport, or the layout changes. We do NOT sync mid-gesture so our own
  // live updates are not clobbered.
  useEffect(() => {
    if (isGesturing) return;
    if (!hasImage || !hasContainer) {
      setActiveRect(null);
      return;
    }
    const rect = viewportToFrameRect(
      activeViewport,
      naturalWidth,
      naturalHeight,
      canvasAspect,
      display,
    );
    setActiveRect((prev) =>
      prev &&
      almostEqual(prev.left, rect.left) &&
      almostEqual(prev.top, rect.top) &&
      almostEqual(prev.width, rect.width) &&
      almostEqual(prev.height, rect.height)
        ? prev
        : rect,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isGesturing,
    activeKeyframe,
    activeViewport.x,
    activeViewport.y,
    activeViewport.zoom,
    naturalWidth,
    naturalHeight,
    canvasAspect,
    display.scale,
    display.offsetX,
    display.offsetY,
    hasImage,
    hasContainer,
  ]);

  // Round-trip a candidate rect through the viewport + clamp so the displayed
  // crop is always the clamped truth: it can never drift, invert, or escape the
  // image. This is the heart of the "boxes stay put" guarantee.
  const applyRect = useCallback(
    (rect: FrameRect, commit: boolean): void => {
      if (display.scale === 0) return;
      const vp = clampViewport(
        frameRectToViewport(
          rect,
          naturalWidth,
          naturalHeight,
          canvasAspect,
          display,
        ),
      );
      const clampedRect = viewportToFrameRect(
        vp,
        naturalWidth,
        naturalHeight,
        canvasAspect,
        display,
      );
      setActiveRect(clampedRect);
      if (commit) onViewportCommit(activeKeyframe, vp);
    },
    [
      clampViewport,
      naturalWidth,
      naturalHeight,
      canvasAspect,
      display,
      activeKeyframe,
      onViewportCommit,
    ],
  );

  // Keep the latest applyRect reachable from the window pointer listeners
  // without re-binding them on every render.
  const applyRectRef = useRef(applyRect);
  applyRectRef.current = applyRect;
  const gestureRef = useRef<Gesture | null>(null);

  const computeCandidate = useCallback(
    (g: Gesture, clientX: number, clientY: number): FrameRect => {
      if (g.mode === 'move') {
        return {
          left: g.startRect.left + (clientX - g.startClientX),
          top: g.startRect.top + (clientY - g.startClientY),
          width: g.startRect.width,
          height: g.startRect.height,
        };
      }

      // Resize: the corner opposite the dragged handle is the fixed anchor.
      const { left, top, width, height } = g.startRect;
      const right = left + width;
      const bottom = top + height;
      const corner = g.corner ?? 'se';
      const signX = corner === 'ne' || corner === 'se' ? 1 : -1;
      const signY = corner === 'sw' || corner === 'se' ? 1 : -1;
      const anchorX = signX > 0 ? left : right;
      const anchorY = signY > 0 ? top : bottom;

      const px = clientX - g.containerLeft;
      const py = clientY - g.containerTop;
      const distX = Math.max(1, (px - anchorX) * signX);
      const distY = Math.max(1, (py - anchorY) * signY);
      // Keep the output aspect ratio: follow whichever axis the pointer led.
      const newWidth = Math.max(distX, distY * canvasAspect);
      const newHeight = newWidth / canvasAspect;

      return {
        left: signX > 0 ? anchorX : anchorX - newWidth,
        top: signY > 0 ? anchorY : anchorY - newHeight,
        width: newWidth,
        height: newHeight,
      };
    },
    [canvasAspect],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      e.preventDefault();
      applyRectRef.current(computeCandidate(g, e.clientX, e.clientY), false);
    },
    [computeCandidate],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      applyRectRef.current(computeCandidate(g, e.clientX, e.clientY), true);
      gestureRef.current = null;
      setIsGesturing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    },
    [computeCandidate, handlePointerMove],
  );

  const beginGesture = useCallback(
    (mode: 'move' | 'resize', corner: Corner | null, e: React.PointerEvent) => {
      if (isPreviewing || !activeRect || !stageRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const bounds = stageRef.current.getBoundingClientRect();
      gestureRef.current = {
        mode,
        corner,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startRect: activeRect,
        containerLeft: bounds.left,
        containerTop: bounds.top,
      };
      setIsGesturing(true);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [isPreviewing, activeRect, handlePointerMove, handlePointerUp],
  );

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp],
  );

  // ── Preview playback ──────────────────────────────────────────────────────
  const stopPreview = useCallback(() => {
    setIsPreviewing(false);
    setPreviewRect(null);
  }, []);

  useEffect(() => {
    if (!isPreviewing || !hasImage || !hasContainer || display.scale === 0) {
      return;
    }
    const total = Math.max(durationMs, MIN_PREVIEW_MS);
    let raf = 0;
    let startTs = 0;
    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const progress = ((ts - startTs) % total) / total;
      const vp = clampViewport(
        interpolateViewport(startViewport, endViewport, progress, easing),
      );
      setPreviewRect(
        viewportToFrameRect(
          vp,
          naturalWidth,
          naturalHeight,
          canvasAspect,
          display,
        ),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPreviewing,
    durationMs,
    easing,
    startViewport.x,
    startViewport.y,
    startViewport.zoom,
    endViewport.x,
    endViewport.y,
    endViewport.zoom,
    naturalWidth,
    naturalHeight,
    canvasAspect,
    display.scale,
    display.offsetX,
    display.offsetY,
    hasImage,
    hasContainer,
  ]);

  const selectKeyframe = useCallback(
    (kf: MotionKeyframe) => {
      stopPreview();
      onKeyframeChange(kf);
    },
    [stopPreview, onKeyframeChange],
  );

  const resetActiveKeyframe = useCallback(() => {
    if (display.scale === 0) return;
    const centered = clampViewport({ x: 0.5, y: 0.5, zoom: 1 });
    onViewportCommit(activeKeyframe, centered);
  }, [display.scale, clampViewport, onViewportCommit, activeKeyframe]);

  const inactiveRect: FrameRect | null =
    hasImage && hasContainer
      ? viewportToFrameRect(
          inactiveViewport,
          naturalWidth,
          naturalHeight,
          canvasAspect,
          display,
        )
      : null;

  const durationSec = (durationMs / 1000).toFixed(1);
  const easingValue: EasingPreset =
    easing.type === 'preset' ? easing.name : 'linear';

  return (
    <div className="absolute inset-0 flex flex-col bg-neutral-950 select-none">
      {/* Stage: the measured area where the image + crop frames live. */}
      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden bg-black"
        style={{ touchAction: 'none' }}
      >
        {/* The full image, dimmed (the excluded area). */}
        {hasContainer && hasImage ? (
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              left: display.offsetX,
              top: display.offsetY,
              width: display.dispW,
              height: display.dispH,
            }}
          />
        ) : null}

        {/* Dark scrim so everything outside the crop reads as excluded. */}
        {hasContainer && hasImage ? (
          <div
            className="pointer-events-none absolute bg-black/55"
            style={{
              left: display.offsetX,
              top: display.offsetY,
              width: display.dispW,
              height: display.dispH,
            }}
          />
        ) : null}

        {/* Preview: a single bright camera box travelling start → end. */}
        {isPreviewing && previewRect ? (
          <>
            <BrightCrop imageUrl={imageUrl} rect={previewRect} display={display} />
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-primary"
              style={{
                left: previewRect.left,
                top: previewRect.top,
                width: previewRect.width,
                height: previewRect.height,
              }}
            >
              <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                Preview
              </span>
            </div>
          </>
        ) : null}

        {/* Inactive keyframe frame: dashed, dimmed, tappable to activate. */}
        {!isPreviewing && inactiveRect ? (
          <button
            type="button"
            onClick={() => selectKeyframe(inactiveKeyframe)}
            className="absolute rounded-sm border-2 border-dashed border-white/60 bg-transparent"
            style={{
              left: inactiveRect.left,
              top: inactiveRect.top,
              width: inactiveRect.width,
              height: inactiveRect.height,
            }}
            aria-label={`Edit ${KEYFRAME_LABEL[inactiveKeyframe]} keyframe`}
          >
            <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white/90">
              {KEYFRAME_LABEL[inactiveKeyframe]}
            </span>
          </button>
        ) : null}

        {/* Active framed region, shown bright against the dimmed image. */}
        {!isPreviewing && activeRect ? (
          <BrightCrop imageUrl={imageUrl} rect={activeRect} display={display} />
        ) : null}

        {/* Active keyframe frame: solid, draggable, with corner resize handles. */}
        {!isPreviewing && activeRect ? (
          <div
            className="absolute touch-none rounded-sm border-2 border-primary"
            style={{
              left: activeRect.left,
              top: activeRect.top,
              width: activeRect.width,
              height: activeRect.height,
              cursor: isGesturing ? 'grabbing' : 'grab',
            }}
            onPointerDown={(e) => beginGesture('move', null, e)}
          >
            <span className="pointer-events-none absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
              {KEYFRAME_LABEL[activeKeyframe]}
            </span>

            {/* Thirds guides for framing. */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/25" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-white/25" />
              <div className="absolute left-0 top-1/3 h-px w-full bg-white/25" />
              <div className="absolute left-0 top-2/3 h-px w-full bg-white/25" />
            </div>

            {CORNERS.map(({ corner, className }) => (
              <span
                key={corner}
                onPointerDown={(e) => beginGesture('resize', corner, e)}
                className={cn(
                  'absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-primary bg-background shadow-md',
                  className,
                )}
              />
            ))}
          </div>
        ) : null}

        {/* Top overlay bar: keyframe toggle + Done. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
          <div className="flex items-center overflow-hidden rounded-lg border border-white/15 bg-black/60 backdrop-blur">
            {(['start', 'end'] as const).map((kf) => (
              <button
                key={kf}
                type="button"
                onClick={() => selectKeyframe(kf)}
                disabled={isPreviewing}
                className={cn(
                  'flex min-h-[44px] min-w-[64px] items-center justify-center px-4 text-sm font-medium transition-colors disabled:opacity-50',
                  activeKeyframe === kf
                    ? 'bg-primary text-primary-foreground'
                    : 'text-white hover:bg-white/10',
                )}
                aria-pressed={activeKeyframe === kf}
              >
                {KEYFRAME_LABEL[kf]}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="min-h-[44px] gap-2 border border-white/15 bg-black/60 text-white backdrop-blur hover:bg-black/70"
          >
            <X />
            Done
          </Button>
        </div>

        {/* Bottom-of-stage hint. */}
        {!isPreviewing ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur">
              Drag to pan · drag corners to zoom · editing{' '}
              {KEYFRAME_LABEL[activeKeyframe]}
            </span>
          </div>
        ) : null}
      </div>

      {/* Controls panel. */}
      <div className="shrink-0 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {/* Preview + reset row. */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => (isPreviewing ? stopPreview() : setIsPreviewing(true))}
              className="h-11 flex-1 gap-2 rounded-xl text-base font-medium"
            >
              {isPreviewing ? <Pause className="size-5" /> : <Play className="size-5" />}
              {isPreviewing ? 'Stop preview' : 'Preview motion'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetActiveKeyframe}
              disabled={isPreviewing}
              className="h-11 gap-2 rounded-xl"
              aria-label={`Reset ${KEYFRAME_LABEL[activeKeyframe]} keyframe`}
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </div>

          {/* Speed (duration) + easing. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Speed (duration)</Label>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {durationSec}s
                </span>
              </div>
              <Slider
                className="py-2"
                min={1000}
                max={30000}
                step={100}
                value={[durationMs]}
                onValueChange={(v) => onDurationChange(v[0])}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm">Easing</Label>
              <Select
                value={easingValue}
                onValueChange={(name) =>
                  onEasingChange({ type: 'preset', name: name as EasingPreset })
                }
              >
                <SelectTrigger className="h-10 w-full rounded-xl">
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
          </div>

          {/* Motion-type presets. */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Motion type</Label>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {MOTION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    stopPreview();
                    onApplyPreset(preset);
                  }}
                  className="bg-muted text-foreground min-h-[40px] shrink-0 rounded-full px-4 text-sm font-medium transition-transform active:scale-95"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A full-brightness copy of the image, clipped to the crop rect, so the
 *  framed region "lights up" against the dimmed surroundings. */
function BrightCrop({
  imageUrl,
  rect,
  display,
}: {
  imageUrl: string;
  rect: FrameRect;
  display: ImageDisplay;
}): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    >
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          left: display.offsetX - rect.left,
          top: display.offsetY - rect.top,
          width: display.dispW,
          height: display.dispH,
        }}
      />
    </div>
  );
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5;
}
