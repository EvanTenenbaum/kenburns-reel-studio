import type { JSX } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Moveable from 'react-moveable';
import type { OnDrag, OnDragEnd, OnResize, OnResizeEnd } from 'react-moveable';
import { X } from 'lucide-react';

import type { Viewport } from '@/types/kenburns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  computeImageDisplay,
  frameRectToViewport,
  viewportToFrameRect,
  type FrameRect,
  type ImageDisplay,
} from '@/lib/viewportFrame';

export type MotionKeyframe = 'start' | 'end';

interface MotionEditorProps {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  /** output aspect = width/height */
  canvasAspect: number;
  startViewport: Viewport;
  endViewport: Viewport;
  activeKeyframe: MotionKeyframe;
  /** Clamp a viewport so the crop stays inside the image (provided by parent). */
  clampViewport: (vp: Viewport) => Viewport;
  onKeyframeChange: (kf: MotionKeyframe) => void;
  /** live, during gesture */
  onViewportChange: (kf: MotionKeyframe, vp: Viewport) => void;
  /** on release (one undo step) */
  onViewportCommit: (kf: MotionKeyframe, vp: Viewport) => void;
  onClose: () => void;
}

interface ContainerSize {
  width: number;
  height: number;
}

const KEYFRAME_LABEL: Record<MotionKeyframe, string> = {
  start: 'Start',
  end: 'End',
};

export function MotionEditor(props: MotionEditorProps): JSX.Element {
  const {
    imageUrl,
    naturalWidth,
    naturalHeight,
    canvasAspect,
    startViewport,
    endViewport,
    activeKeyframe,
    clampViewport,
    onKeyframeChange,
    onViewportChange,
    onViewportCommit,
    onClose,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeFrameRef = useRef<HTMLDivElement | null>(null);

  const [container, setContainer] = useState<ContainerSize>({
    width: 0,
    height: 0,
  });

  // The active frame's live rectangle, in container pixels.
  const [activeRect, setActiveRect] = useState<FrameRect | null>(null);

  // Measure the container with a ResizeObserver.
  useLayoutEffect(() => {
    const el = containerRef.current;
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
  // viewport, or the layout changes. We gate on the *source* viewport + display
  // so our own emitted onViewportChange (which feeds back into props) does not
  // cause an infinite loop: the recomputed rect is value-equal to what we set.
  useEffect(() => {
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

  const emit = useCallback(
    (rect: FrameRect, commit: boolean) => {
      const vp = clampViewport(
        frameRectToViewport(
          rect,
          naturalWidth,
          naturalHeight,
          canvasAspect,
          display,
        ),
      );
      if (commit) {
        onViewportCommit(activeKeyframe, vp);
      } else {
        onViewportChange(activeKeyframe, vp);
      }
    },
    [
      clampViewport,
      naturalWidth,
      naturalHeight,
      canvasAspect,
      display,
      activeKeyframe,
      onViewportChange,
      onViewportCommit,
    ],
  );

  const handleDrag = useCallback(
    (e: OnDrag) => {
      e.target.style.left = `${e.left}px`;
      e.target.style.top = `${e.top}px`;
      const rect: FrameRect = {
        left: e.left,
        top: e.top,
        width: e.width,
        height: e.height,
      };
      setActiveRect(rect);
      emit(rect, false);
    },
    [emit],
  );

  const handleDragEnd = useCallback(
    (e: OnDragEnd) => {
      const el = e.target as HTMLElement;
      const rect: FrameRect = {
        left: parseFloat(el.style.left) || 0,
        top: parseFloat(el.style.top) || 0,
        width: el.offsetWidth,
        height: el.offsetHeight,
      };
      setActiveRect(rect);
      emit(rect, true);
    },
    [emit],
  );

  const handleResize = useCallback(
    (e: OnResize) => {
      const el = e.target as HTMLElement;
      el.style.width = `${e.width}px`;
      el.style.height = `${e.height}px`;
      const [dx, dy] = e.drag.beforeTranslate;
      el.style.transform = `translate(${dx}px, ${dy}px)`;

      const baseLeft = parseFloat(el.style.left) || 0;
      const baseTop = parseFloat(el.style.top) || 0;
      const rect: FrameRect = {
        left: baseLeft + dx,
        top: baseTop + dy,
        width: e.width,
        height: e.height,
      };
      setActiveRect(rect);
      emit(rect, false);
    },
    [emit],
  );

  const handleResizeEnd = useCallback(
    (e: OnResizeEnd) => {
      // Bake the translate produced during resize back into left/top so the
      // next gesture (and the props re-sync) starts from a clean transform.
      const el = e.target as HTMLElement;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const dx = matrix.m41;
      const dy = matrix.m42;
      const baseLeft = parseFloat(el.style.left) || 0;
      const baseTop = parseFloat(el.style.top) || 0;
      const rect: FrameRect = {
        left: baseLeft + dx,
        top: baseTop + dy,
        width: el.offsetWidth,
        height: el.offsetHeight,
      };
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.transform = '';
      setActiveRect(rect);
      emit(rect, true);
    },
    [emit],
  );

  // Moveable `position: 'css'` treats right/bottom as distances from the
  // container's right/bottom edges (not absolute coordinates), so the frame
  // stays clamped to the displayed image even when it is letterboxed.
  const bounds = {
    left: display.offsetX,
    top: display.offsetY,
    right: Math.max(0, container.width - (display.offsetX + display.dispW)),
    bottom: Math.max(0, container.height - (display.offsetY + display.dispH)),
    position: 'css' as const,
  };

  const showMoveable = hasImage && hasContainer && activeRect !== null;

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

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black select-none">
      {/* The full image, dimmed. */}
      {hasContainer && hasImage ? (
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none opacity-60"
          style={{
            left: display.offsetX,
            top: display.offsetY,
            width: display.dispW,
            height: display.dispH,
          }}
        />
      ) : null}

      {/* Dark scrim over the image to read everything outside the crop as
          excluded. The crop frames sit above this. */}
      {hasContainer && hasImage ? (
        <div
          className="pointer-events-none absolute bg-black/40"
          style={{
            left: display.offsetX,
            top: display.offsetY,
            width: display.dispW,
            height: display.dispH,
          }}
        />
      ) : null}

      {/* Inactive keyframe frame: dashed, dimmed, tappable to activate. */}
      {inactiveRect ? (
        <button
          type="button"
          onClick={() => onKeyframeChange(inactiveKeyframe)}
          className="absolute border-2 border-dashed border-muted-foreground/70 bg-transparent"
          style={{
            left: inactiveRect.left,
            top: inactiveRect.top,
            width: inactiveRect.width,
            height: inactiveRect.height,
          }}
          aria-label={`Edit ${KEYFRAME_LABEL[inactiveKeyframe]} keyframe`}
        >
          <span className="absolute left-1 top-1 rounded bg-card/80 px-1.5 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur">
            {KEYFRAME_LABEL[inactiveKeyframe]}
          </span>
        </button>
      ) : null}

      {/* Active keyframe frame: solid, bright, the Moveable target. */}
      {activeRect ? (
        <div
          ref={activeFrameRef}
          className="absolute border-2 border-primary"
          style={{
            left: activeRect.left,
            top: activeRect.top,
            width: activeRect.width,
            height: activeRect.height,
          }}
        >
          <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
            {KEYFRAME_LABEL[activeKeyframe]}
          </span>
        </div>
      ) : null}

      {showMoveable ? (
        <Moveable
          target={activeFrameRef}
          draggable
          resizable
          keepRatio
          renderDirections={['nw', 'ne', 'sw', 'se']}
          throttleDrag={0}
          throttleResize={0}
          origin={false}
          bounds={bounds}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
        />
      ) : null}

      {/* Top overlay bar: keyframe toggle + Done. */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur">
          {(['start', 'end'] as const).map((kf) => (
            <button
              key={kf}
              type="button"
              onClick={() => onKeyframeChange(kf)}
              className={cn(
                'flex min-h-[44px] min-w-[64px] items-center justify-center px-4 text-sm font-medium transition-colors',
                activeKeyframe === kf
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent',
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
          className="min-h-[44px] gap-2 border border-border bg-card/80 backdrop-blur"
        >
          <X />
          Done
        </Button>
      </div>
    </div>
  );
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5;
}
