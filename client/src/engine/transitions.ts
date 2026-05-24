/**
 * Transition compositing for the export pipeline.
 * Pure canvas computation — NO React, NO DOM elements (Canvas API only).
 */

import type { TransitionType } from '@/types/project';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Draws a single clip's current frame, filling the whole canvas. */
export type FrameDrawer = (ctx: Ctx2D) => void;

export interface TransitionMeta {
  type: TransitionType;
  label: string;
  description: string;
}

export const TRANSITIONS: TransitionMeta[] = [
  { type: 'cut', label: 'Cut', description: 'Instant change, no blend' },
  { type: 'crossfade', label: 'Crossfade', description: 'Dissolve between clips' },
  { type: 'fade-through-black', label: 'Through Black', description: 'Fade out to black, then in' },
  { type: 'fade-through-white', label: 'Through White', description: 'Fade out to white, then in' },
  { type: 'slide-left', label: 'Slide Left', description: 'Next clip slides in from the right' },
  { type: 'slide-right', label: 'Slide Right', description: 'Next clip slides in from the left' },
  { type: 'zoom-through', label: 'Zoom Through', description: 'Zoom out of one into the next' },
  { type: 'blur-transition', label: 'Blur', description: 'Blur-dissolve between clips' },
];

/**
 * Composite a transition between two frames onto the canvas context.
 *
 * @param ctx - Destination 2D context (full canvas already cleared by caller)
 * @param type - Transition type
 * @param progress - Transition progress (0–1)
 * @param drawFrom - Draws the outgoing clip frame
 * @param drawTo - Draws the incoming clip frame
 * @param width - Canvas width in px
 * @param height - Canvas height in px
 */
export function renderTransitionFrame(
  ctx: Ctx2D,
  type: TransitionType,
  progress: number,
  drawFrom: FrameDrawer,
  drawTo: FrameDrawer,
  width: number,
  height: number
): void {
  const p = clampUnit(progress);

  switch (type) {
    case 'cut': {
      // No real overlap; show the incoming clip.
      drawTo(ctx);
      return;
    }

    case 'crossfade': {
      drawFrom(ctx);
      withAlpha(ctx, p, () => drawTo(ctx));
      return;
    }

    case 'fade-through-black':
    case 'fade-through-white': {
      const color = type === 'fade-through-black' ? '#000000' : '#ffffff';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      if (p < 0.5) {
        withAlpha(ctx, 1 - p * 2, () => drawFrom(ctx));
      } else {
        withAlpha(ctx, p * 2 - 1, () => drawTo(ctx));
      }
      return;
    }

    case 'slide-left': {
      withTranslate(ctx, -p * width, 0, () => drawFrom(ctx));
      withTranslate(ctx, (1 - p) * width, 0, () => drawTo(ctx));
      return;
    }

    case 'slide-right': {
      withTranslate(ctx, p * width, 0, () => drawFrom(ctx));
      withTranslate(ctx, -(1 - p) * width, 0, () => drawTo(ctx));
      return;
    }

    case 'zoom-through': {
      // Outgoing clip scales up and fades; incoming clip scales up from small.
      withTransform(ctx, width / 2, height / 2, 1 + 0.3 * p, 1 - p, () =>
        drawFrom(ctx)
      );
      withTransform(ctx, width / 2, height / 2, 0.7 + 0.3 * p, p, () =>
        drawTo(ctx)
      );
      return;
    }

    case 'blur-transition': {
      const supportsFilter = 'filter' in ctx;
      if (supportsFilter) ctx.filter = `blur(${(p * (1 - p) * 40).toFixed(2)}px)`;
      drawFrom(ctx);
      withAlpha(ctx, p, () => drawTo(ctx));
      if (supportsFilter) ctx.filter = 'none';
      return;
    }

    default: {
      drawFrom(ctx);
      withAlpha(ctx, p, () => drawTo(ctx));
    }
  }
}

function withAlpha(ctx: Ctx2D, alpha: number, fn: () => void): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = clampUnit(alpha);
  fn();
  ctx.globalAlpha = prev;
}

function withTranslate(ctx: Ctx2D, tx: number, ty: number, fn: () => void): void {
  ctx.save();
  ctx.translate(tx, ty);
  fn();
  ctx.restore();
}

function withTransform(
  ctx: Ctx2D,
  cx: number,
  cy: number,
  scale: number,
  alpha: number,
  fn: () => void
): void {
  ctx.save();
  ctx.globalAlpha = clampUnit(alpha);
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}

function clampUnit(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
