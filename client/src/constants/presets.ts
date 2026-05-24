/**
 * Ken Burns motion presets.
 * Each preset defines a start and end viewport for common motion patterns.
 */

import type { KenBurnsConfig, MotionPreset, Viewport } from '@/types/kenburns';

export interface PresetDefinition {
  id: MotionPreset;
  label: string;
  description: string;
  startViewport: Viewport;
  endViewport: Viewport;
  /** Suggested image types this preset works well with */
  bestFor: string;
}

export const MOTION_PRESETS: PresetDefinition[] = [
  {
    id: 'zoom-in-center',
    label: 'Zoom In',
    description: 'Slowly zoom into the center of the image',
    startViewport: { x: 0.5, y: 0.5, zoom: 1 },
    endViewport: { x: 0.5, y: 0.5, zoom: 1.5 },
    bestFor: 'Portraits, centered subjects',
  },
  {
    id: 'zoom-out-center',
    label: 'Zoom Out',
    description: 'Slowly zoom out to reveal the full image',
    startViewport: { x: 0.5, y: 0.5, zoom: 1.5 },
    endViewport: { x: 0.5, y: 0.5, zoom: 1 },
    bestFor: 'Reveals, landscapes',
  },
  {
    id: 'pan-left',
    label: 'Pan Left',
    description: 'Pan from right to left across the image',
    startViewport: { x: 0.7, y: 0.5, zoom: 1.3 },
    endViewport: { x: 0.3, y: 0.5, zoom: 1.3 },
    bestFor: 'Wide scenes, groups',
  },
  {
    id: 'pan-right',
    label: 'Pan Right',
    description: 'Pan from left to right across the image',
    startViewport: { x: 0.3, y: 0.5, zoom: 1.3 },
    endViewport: { x: 0.7, y: 0.5, zoom: 1.3 },
    bestFor: 'Wide scenes, groups',
  },
  {
    id: 'pan-up',
    label: 'Pan Up',
    description: 'Pan from bottom to top',
    startViewport: { x: 0.5, y: 0.6, zoom: 1.2 },
    endViewport: { x: 0.5, y: 0.4, zoom: 1.2 },
    bestFor: 'Tall subjects, buildings',
  },
  {
    id: 'pan-down',
    label: 'Pan Down',
    description: 'Pan from top to bottom',
    startViewport: { x: 0.5, y: 0.4, zoom: 1.2 },
    endViewport: { x: 0.5, y: 0.6, zoom: 1.2 },
    bestFor: 'Tall subjects, waterfalls',
  },
  {
    id: 'zoom-in-top-left',
    label: 'Zoom Top-Left',
    description: 'Zoom into the top-left area',
    startViewport: { x: 0.5, y: 0.5, zoom: 1 },
    endViewport: { x: 0.3, y: 0.3, zoom: 1.8 },
    bestFor: 'Detail focus, corner subjects',
  },
  {
    id: 'zoom-in-top-right',
    label: 'Zoom Top-Right',
    description: 'Zoom into the top-right area',
    startViewport: { x: 0.5, y: 0.5, zoom: 1 },
    endViewport: { x: 0.7, y: 0.3, zoom: 1.8 },
    bestFor: 'Detail focus, corner subjects',
  },
  {
    id: 'zoom-out-bottom',
    label: 'Reveal from Bottom',
    description: 'Zoom out from the bottom area to reveal the full image',
    startViewport: { x: 0.5, y: 0.7, zoom: 1.6 },
    endViewport: { x: 0.5, y: 0.5, zoom: 1 },
    bestFor: 'Dramatic reveals',
  },
];

/**
 * Get a random motion preset (used on image import).
 */
export function getRandomPreset(): PresetDefinition {
  const index = Math.floor(Math.random() * MOTION_PRESETS.length);
  return MOTION_PRESETS[index];
}

/**
 * Get a preset by its ID.
 */
export function getPresetById(id: MotionPreset): PresetDefinition | undefined {
  return MOTION_PRESETS.find((p) => p.id === id);
}

/**
 * Create a KenBurnsConfig from a preset definition.
 */
export function configFromPreset(preset: PresetDefinition): KenBurnsConfig {
  return {
    startViewport: { ...preset.startViewport },
    endViewport: { ...preset.endViewport },
    easing: { type: 'preset', name: 'ease-in-out' },
    preset: preset.id,
  };
}
