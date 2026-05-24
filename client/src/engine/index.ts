/**
 * Engine barrel export.
 * All engine modules are pure computation — NO React, NO DOM.
 */

export {
  computeViewportAtTime,
  clampViewport,
  viewportToCSS,
  viewportToSourceRect,
  computeMinZoom,
  interpolateViewport,
} from './kenburns';

export {
  detectCapabilities,
  getExportStrategy,
  getMaxWorkingResolution,
  getMaxClips,
} from './capabilities';

export type { AppCapabilities } from './capabilities';
