/**
 * Preview — the centered, letterboxed stage that renders the active clip(s) of
 * the reel at the current playhead position, with live Ken Burns motion,
 * transition compositing, and touch/drag/pinch viewport editing for a single
 * active clip.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { ImageIcon } from 'lucide-react';

import { useProject } from '@/hooks/useProject';
import { useKenBurns } from '@/hooks/useKenBurns';
import { useUIStore } from '@/store/projectStore';
import { getClipAtTime } from '@/lib/timeline';
import { getTransitionPreviewStyle } from '@/lib/transitionPreview';
import { OUTPUT_SPECS } from '@/constants/instagram';
import { cn } from '@/lib/utils';
import type { Clip } from '@/types/project';
import type { KenBurnsConfig } from '@/types/kenburns';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Movement (px) below which a drag is treated as a tap. */
const TAP_THRESHOLD = 6;

function clampUnit(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampZoom(v: number): number {
  return v < MIN_ZOOM ? MIN_ZOOM : v > MAX_ZOOM ? MAX_ZOOM : v;
}

/** Deep copy of a Ken Burns config's viewports (enough for live editing). */
function cloneConfig(config: KenBurnsConfig): KenBurnsConfig {
  return {
    ...config,
    startViewport: { ...config.startViewport },
    endViewport: { ...config.endViewport },
  };
}

export function Preview() {
  const { project, layout, transitions, aspectRatio, updateClipKenBurns } =
    useProject();

  const canvasAspect = useMemo(() => {
    const spec = OUTPUT_SPECS[aspectRatio];
    return spec.width / spec.height;
  }, [aspectRatio]);

  const { getTransform, clampForClip } = useKenBurns(canvasAspect);

  const playhead = useUIStore((s) => s.playhead);
  const selectClip = useUIStore((s) => s.selectClip);

  // ── Stage measurement ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setContainer({ w: rect.width, h: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Letterbox: fit a canvasAspect-shaped box inside the measured container.
  const stage = useMemo(() => {
    if (container.w <= 0 || container.h <= 0) return { w: 0, h: 0 };
    const byWidth = container.w / canvasAspect;
    if (byWidth <= container.h) {
      return { w: container.w, h: byWidth };
    }
    return { w: container.h * canvasAspect, h: container.h };
  }, [container, canvasAspect]);

  const stageW = stage.w;
  const stageH = stage.h;

  // ── Active frame ───────────────────────────────────────────────────────────
  const frame = useMemo(
    () => getClipAtTime(playhead, layout, transitions),
    [playhead, layout, transitions]
  );

  const isSingle = Boolean(frame && !frame.secondary);
  const activeClip: Clip | null = frame ? frame.primary.clip : null;

  // ── Live edit draft ──────────────────────────────────────────────────────--
  const [draft, setDraft] = useState<KenBurnsConfig | null>(null);
  // Track which clip the draft belongs to so a frame change cannot mis-apply it.
  const draftClipIdRef = useRef<string | null>(null);

  // Drop any stale draft if the active single clip changes.
  useEffect(() => {
    if (!isSingle || !activeClip) {
      if (draft !== null) setDraft(null);
      draftClipIdRef.current = null;
      return;
    }
    if (draftClipIdRef.current && draftClipIdRef.current !== activeClip.id) {
      setDraft(null);
      draftClipIdRef.current = null;
    }
  }, [isSingle, activeClip, draft]);

  // ── Gestures (single active clip only) ──────────────────────────────────────
  const gesturesEnabled = isSingle && activeClip !== null && stageW > 0 && stageH > 0;

  const buildPannedConfig = useCallback(
    (base: KenBurnsConfig, dxn: number, dyn: number): KenBurnsConfig => {
      const next = cloneConfig(base);
      next.startViewport.x = clampUnit(base.startViewport.x + dxn);
      next.startViewport.y = clampUnit(base.startViewport.y + dyn);
      next.endViewport.x = clampUnit(base.endViewport.x + dxn);
      next.endViewport.y = clampUnit(base.endViewport.y + dyn);
      return next;
    },
    []
  );

  const buildZoomedConfig = useCallback(
    (base: KenBurnsConfig, scale: number): KenBurnsConfig => {
      const next = cloneConfig(base);
      next.startViewport.zoom = clampZoom(base.startViewport.zoom * scale);
      next.endViewport.zoom = clampZoom(base.endViewport.zoom * scale);
      return next;
    },
    []
  );

  const commitDraft = useCallback(
    (clip: Clip, config: KenBurnsConfig) => {
      const committed = cloneConfig(config);
      committed.startViewport = clampForClip(clip, committed.startViewport);
      committed.endViewport = clampForClip(clip, committed.endViewport);
      updateClipKenBurns(clip.id, committed);
      setDraft(null);
      draftClipIdRef.current = null;
    },
    [clampForClip, updateClipKenBurns]
  );

  useGesture(
    {
      onDrag: ({ movement: [mx, my], first, last, tap, memo }) => {
        if (!gesturesEnabled || !activeClip) return memo;
        const base: KenBurnsConfig =
          (memo as KenBurnsConfig | undefined) ??
          cloneConfig(activeClip.kenburns);

        if (first) {
          draftClipIdRef.current = activeClip.id;
        }

        // Treat a near-stationary press/release as a selection tap.
        if (tap || (last && Math.hypot(mx, my) < TAP_THRESHOLD)) {
          selectClip(activeClip.id);
          if (last) setDraft(null);
          return base;
        }

        const startZoom = base.startViewport.zoom || 1;
        const dxn = -(mx / stageW) / startZoom;
        const dyn = -(my / stageH) / startZoom;
        const next = buildPannedConfig(base, dxn, dyn);

        if (last) {
          commitDraft(activeClip, next);
        } else {
          draftClipIdRef.current = activeClip.id;
          setDraft(next);
        }
        return base;
      },
      onPinch: ({ offset: [scale], first, last, memo }) => {
        if (!gesturesEnabled || !activeClip) return memo;
        const base: KenBurnsConfig =
          (memo as KenBurnsConfig | undefined) ??
          cloneConfig(activeClip.kenburns);

        if (first) {
          draftClipIdRef.current = activeClip.id;
        }

        const next = buildZoomedConfig(base, scale);
        if (last) {
          commitDraft(activeClip, next);
        } else {
          draftClipIdRef.current = activeClip.id;
          setDraft(next);
        }
        return base;
      },
    },
    {
      target: stageRef,
      enabled: gesturesEnabled,
      drag: { filterTaps: true },
      pinch: { scaleBounds: { min: MIN_ZOOM / MAX_ZOOM, max: MAX_ZOOM }, rubberband: true },
    }
  );

  // ── Render ───────────────────────────────────────────────────────────────--
  const hasClips = project !== null && layout.length > 0 && frame !== null;

  // The clip used for live single-clip rendering (apply draft if present).
  const renderClip: Clip | null = useMemo(() => {
    if (!isSingle || !activeClip) return activeClip;
    if (draft && draftClipIdRef.current === activeClip.id) {
      return { ...activeClip, kenburns: draft };
    }
    return activeClip;
  }, [isSingle, activeClip, draft]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-950 p-3">
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
      >
        <div
          ref={stageRef}
          className="relative touch-none overflow-hidden rounded-lg bg-black select-none"
          style={{
            width: stageW > 0 ? `${stageW}px` : '100%',
            height: stageH > 0 ? `${stageH}px` : '100%',
            aspectRatio: `${canvasAspect}`,
          }}
        >
          {!hasClips || !frame ? (
            <EmptyState />
          ) : frame.secondary && frame.transition ? (
            <TransitionLayers
              fromClip={frame.primary.clip}
              toClip={frame.secondary.clip}
              timeInFrom={frame.timeInPrimary}
              timeInTo={frame.timeInSecondary}
              type={frame.transition.type}
              progress={frame.transitionProgress}
              stageW={stageW}
              stageH={stageH}
              getTransform={getTransform}
            />
          ) : renderClip && renderClip.imageUrl ? (
            <SingleLayer
              clip={renderClip}
              timeInClip={frame.timeInPrimary}
              stageW={stageW}
              stageH={stageH}
              getTransform={getTransform}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface LayerProps {
  clip: Clip;
  timeInClip: number;
  stageW: number;
  stageH: number;
  getTransform: (
    clip: Clip,
    timeInClip: number,
    containerW: number,
    containerH: number
  ) => string;
}

function SingleLayer({ clip, timeInClip, stageW, stageH, getTransform }: LayerProps) {
  const transform =
    stageW > 0 && stageH > 0 ? getTransform(clip, timeInClip, stageW, stageH) : 'none';
  return (
    <img
      src={clip.imageUrl}
      alt=""
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style={{
        transform,
        transformOrigin: 'center',
        willChange: 'transform',
      }}
    />
  );
}

interface TransitionLayersProps {
  fromClip: Clip;
  toClip: Clip;
  timeInFrom: number;
  timeInTo: number;
  type: Parameters<typeof getTransitionPreviewStyle>[0];
  progress: number;
  stageW: number;
  stageH: number;
  getTransform: LayerProps['getTransform'];
}

function TransitionLayers({
  fromClip,
  toClip,
  timeInFrom,
  timeInTo,
  type,
  progress,
  stageW,
  stageH,
  getTransform,
}: TransitionLayersProps) {
  const s = getTransitionPreviewStyle(type, progress);
  const measured = stageW > 0 && stageH > 0;
  const fromKB = measured ? getTransform(fromClip, timeInFrom, stageW, stageH) : 'none';
  const toKB = measured ? getTransform(toClip, timeInTo, stageW, stageH) : 'none';

  return (
    <>
      {/* Outgoing layer */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          opacity: s.fromOpacity,
          transform: s.fromTransform,
          filter: s.fromBlurPx > 0 ? `blur(${s.fromBlurPx}px)` : undefined,
          willChange: 'transform, opacity',
        }}
      >
        {fromClip.imageUrl ? (
          <img
            src={fromClip.imageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ transform: fromKB, transformOrigin: 'center', willChange: 'transform' }}
          />
        ) : null}
      </div>

      {/* Incoming layer */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          opacity: s.toOpacity,
          transform: s.toTransform,
          filter: s.toBlurPx > 0 ? `blur(${s.toBlurPx}px)` : undefined,
          willChange: 'transform, opacity',
        }}
      >
        {toClip.imageUrl ? (
          <img
            src={toClip.imageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ transform: toKB, transformOrigin: 'center', willChange: 'transform' }}
          />
        ) : null}
      </div>

      {/* Fade-through overlay */}
      {s.overlayColor ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: s.overlayColor,
            opacity: s.overlayOpacity,
            willChange: 'opacity',
          }}
        />
      ) : null}
    </>
  );
}

function EmptyState() {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-3',
        'px-6 text-center text-muted-foreground'
      )}
    >
      <ImageIcon className="h-10 w-10 opacity-60" aria-hidden />
      <p className="text-sm">Add images to start your reel</p>
    </div>
  );
}
