# Task Backlog — Ken Burns Reel Studio

> Ordered by priority. Agents: pick the highest unclaimed task, create a branch, implement, and mark complete.

## Status Key

- `[ ]` — Not started
- `[~]` — In progress (note who/when)
- `[x]` — Complete

---

## Phase 1: Foundation (MVP Core)

### P1.1 — Project Infrastructure
- [ ] Install core dependencies: zustand, zundo, dexie, @use-gesture/react, wavesurfer.js, mediabunny, framer-motion, dnd-kit
- [ ] Set up Zustand stores with zundo undo/redo (useProjectStore, useTimelineStore, useExportStore)
- [ ] Define TypeScript types in `types/` directory (project.ts, kenburns.ts, audio.ts, export.ts)
- [ ] Set up Dexie.js database schema (projects, images, audioFiles tables)
- [ ] Implement auto-save middleware (debounced 2s writes to IndexedDB)
- [ ] Configure Vitest and write first test for Ken Burns math

### P1.2 — Ken Burns Engine
- [ ] Implement `engine/kenburns.ts` — viewport interpolation with easing
- [ ] Implement `engine/capabilities.ts` — feature detection (WebCodecs, AudioEncoder, OffscreenCanvas)
- [ ] Implement `lib/math.ts` — lerp, clamp, cubicBezier, easing presets
- [ ] Implement `lib/image.ts` — image loading, EXIF handling, createImageBitmap with resize, thumbnails
- [ ] Implement viewport boundary clamping (prevent showing outside image bounds)
- [ ] Implement `constants/presets.ts` — 9 motion presets with start/end viewports
- [ ] Implement `constants/instagram.ts` — output specs (resolution, bitrate, duration limits)
- [ ] Write unit tests for interpolation, clamping, and easing

### P1.3 — Preview Component
- [ ] Build `components/preview/PreviewCanvas.tsx` — aspect-ratio container with CSS transform rendering
- [ ] Implement real-time playback loop (requestAnimationFrame + store sync)
- [ ] Add viewport overlay UI (shows current crop rectangle on image)
- [ ] Implement pinch-to-zoom and drag-to-pan on preview for viewport editing (@use-gesture/react)

### P1.4 — Image Import
- [ ] Build image upload component (file input + drag-and-drop, accept jpg/png/webp/heic)
- [ ] Handle image loading: createImageBitmap with downscale (max 2160px), EXIF orientation
- [ ] Store image blob + thumbnail in Dexie, create runtime blob URL
- [ ] Auto-apply random Ken Burns preset on import
- [ ] Support multi-image import (batch processing)
- [ ] Support camera roll access on mobile (accept="image/*" capture)

---

## Phase 2: Timeline & Editing

### P2.1 — Timeline UI
- [ ] Build horizontal scrollable timeline track component
- [ ] Render clip thumbnails with duration-proportional widths
- [ ] Implement playhead indicator (vertical line, draggable for scrubbing)
- [ ] Add pinch-to-zoom on timeline (adjust time scale) via @use-gesture
- [ ] Implement clip selection (tap to select, highlight)
- [ ] Time ruler with tick marks (seconds/frames)

### P2.2 — Clip Management
- [ ] Drag-to-reorder clips on timeline (dnd-kit sortable)
- [ ] Drag clip edges to trim duration
- [ ] Delete clip (swipe-to-delete or long-press context menu)
- [ ] Duplicate clip action
- [ ] All clip operations must be undoable (via zundo)

### P2.3 — Ken Burns Controls
- [ ] Build viewport selector UI (start point + end point on image)
- [ ] Direction presets bottom sheet (9 presets with visual thumbnails)
- [ ] Easing curve selector (visual bezier editor or presets dropdown)
- [ ] Duration control per clip (slider or numeric input)
- [ ] "Swap start/end" quick action
- [ ] Live preview of Ken Burns motion while editing

### P2.4 — Transitions
- [ ] Build transition picker (between-clip insertion UI, bottom sheet)
- [ ] Implement crossfade transition rendering (canvas + preview)
- [ ] Implement fade-through-black transition
- [ ] Implement fade-through-white transition
- [ ] Implement slide transitions (left/right)
- [ ] Implement zoom-through transition
- [ ] Transition duration control (slider)
- [ ] Visual transition indicators on timeline (tappable)

---

## Phase 3: Audio & Music

### P3.1 — Audio Track
- [ ] Build audio import (file picker for MP3/WAV/M4A/OGG/AAC)
- [ ] Decode audio to AudioBuffer for waveform + playback
- [ ] Store audio blob in Dexie
- [ ] Integrate WaveSurfer.js for waveform display on timeline
- [ ] Sync audio playback with timeline playhead (Web Audio API)
- [ ] Audio trim controls (drag start/end handles on waveform)

### P3.2 — Audio Controls
- [ ] Volume slider per audio track (bottom sheet)
- [ ] Fade in/out duration controls
- [ ] Mute/unmute toggle
- [ ] Multiple audio track support (background music + sound effects)

### P3.3 — Audio Export Mixing
- [ ] Implement offline audio mixing via OfflineAudioContext
- [ ] Apply trims, volume envelope, fade in/out
- [ ] Output mixed AudioBuffer as Float32Array samples for Mediabunny

### P3.4 — Music Library (Stretch)
- [ ] Curate list of royalty-free music URLs
- [ ] Build browsable music picker UI
- [ ] Preview music before adding to project
- [ ] Beat detection for auto-sync transitions (stretch goal)

---

## Phase 4: Export

### P4.1 — Mediabunny Export Pipeline
- [ ] Implement `engine/exporter.ts` using Mediabunny CanvasSource + Mp4OutputFormat
- [ ] Runtime codec detection: `getFirstEncodableAudioCodec(['aac', 'opus', 'mp3'])`
- [ ] Lazy-load @mediabunny/mp3-encoder for Safari 16.4–18.7 (no native AudioEncoder)
- [ ] Frame rendering loop with backpressure (await videoSource.add())
- [ ] Thermal management (scheduler.yield() or setTimeout every 30 frames)
- [ ] Memory management (load max 3 ImageBitmaps during export, release after use)
- [ ] Progress reporting (current frame / total frames → percentage + ETA)
- [ ] Cancel support (output.cancel())
- [ ] Error handling with retry-at-lower-quality option

### P4.2 — Audio in Export
- [ ] Feed mixed AudioBuffer samples to Mediabunny AudioSampleSource
- [ ] Handle codec fallback: AAC → MP3 (polyfill) → PCM-s16 (always works)
- [ ] Sync audio timing with video timeline

### P4.3 — Fallback Export (Last Resort)
- [ ] Implement ffmpeg.wasm fallback path (lazy-load ~15MB, single-threaded)
- [ ] Feature detection to choose export strategy (WebCodecs → ffmpeg)
- [ ] Handle browsers without WebCodecs at all (<7% of users)

### P4.4 — Export UX
- [ ] Build export settings bottom sheet (quality: draft/standard/high, resolution)
- [ ] Build export progress page with percentage, ETA, cancel button
- [ ] Video preview after export completes (play in <video> element)
- [ ] Download button (always available, triggers file save)
- [ ] Share button (Web Share API with files for mobile)
- [ ] "Share to Instagram" shortcut (via navigator.share)

### P4.5 — Web Worker (P1)
- [ ] Move export rendering to Web Worker for non-blocking UI
- [ ] Transfer ImageBitmaps to worker (zero-copy via transferable)
- [ ] Message protocol: start, progress, complete, error, cancel
- [ ] Fallback to main-thread export if Worker/OffscreenCanvas unavailable

---

## Phase 5: Polish & Production

### P5.1 — Undo/Redo
- [ ] Wire zundo temporal store to UI (undo/redo buttons in controls bar)
- [ ] Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z / Cmd+Z / Cmd+Shift+Z)
- [ ] Visual feedback on undo/redo (toast notification)

### P5.2 — Persistence & Projects
- [ ] Project list page (home screen, sorted by updatedAt)
- [ ] Create new / rename / delete projects
- [ ] Project thumbnail generation (first clip's thumbnail)
- [ ] Duplicate project

### P5.3 — Mobile Optimization
- [ ] Touch gesture refinement (dead zones, velocity thresholds)
- [ ] Haptic feedback on key interactions (navigator.vibrate)
- [ ] Safe area insets for notched phones (env(safe-area-inset-*))
- [ ] Prevent pull-to-refresh during editing (overscroll-behavior: none)
- [ ] Performance profiling on mid-range devices (iPhone 12, Pixel 6)
- [ ] Landscape orientation handling (graceful layout adjustment)

### P5.4 — Accessibility
- [ ] ARIA labels for all interactive controls
- [ ] Keyboard navigation for desktop usage
- [ ] Reduced motion support (prefers-reduced-motion: skip Ken Burns preview animation)
- [ ] Focus management for bottom sheets and modals
- [ ] Screen reader announcements for state changes

### P5.5 — PWA & Offline
- [ ] Service worker for app shell caching
- [ ] Offline indicator and graceful degradation
- [ ] Web app manifest with icons
- [ ] Install prompt (Add to Home Screen)

### P5.6 — Responsive Layouts
- [ ] Mobile layout (375px+): stacked preview/timeline
- [ ] Tablet layout (768px+): side-by-side preview + timeline
- [ ] Desktop layout (1024px+): full editor with sidebar controls

---

## Stretch Goals

- [ ] AI-powered Ken Burns suggestions (face detection via MediaPipe for smart focus points)
- [ ] Beat-sync mode (auto-cut clips to music beats)
- [ ] Text overlay support (titles, captions with animation)
- [ ] Filter/color grading per clip (CSS filters on canvas)
- [ ] Template system (pre-built motion + transition combos)
- [ ] Cloud sync (optional, user-controlled)
- [ ] Video clip support (extract frames from short video clips)
- [ ] Auto-duration mode (fit all clips to music length)
- [ ] Batch preset application (apply same motion to all clips)

---

## Notes for Agents

When picking up a task:
1. Check if the task has dependencies (tasks above it in the same section should be done first)
2. Engine tasks (`engine/`, `lib/`, `types/`, `constants/`) must have ZERO React/DOM dependencies
3. UI tasks (`components/`, `pages/`) should access engine/store only via hooks
4. Always run `pnpm check` before committing (TypeScript strict mode)
5. Mark completed tasks with `[x]` and note the commit hash
6. Follow conventional commits: `feat(scope): description`
7. Refer to AGENTS.md Section 8.3 for dependency boundary rules
