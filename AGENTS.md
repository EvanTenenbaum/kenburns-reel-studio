# AGENTS.md — Agent Onboarding & Collaboration Guide

> This file is the single source of truth for any AI agent (Cursor, Copilot, Manus, Devin, Claude, etc.) working on this repository. Read this file **first** before touching any code.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Name** | Ken Burns Reel Studio |
| **Purpose** | Mobile-first web app for creating Instagram Reels from still images using Ken Burns (pan & zoom) motion, with timeline editing, transitions, and music |
| **Target Output** | 1080×1920 MP4 (H.264 + AAC) at 30fps, 15–90 seconds |
| **Primary Platform** | Mobile browsers (iOS Safari 16.4+, Android Chrome) |
| **Secondary Platform** | Desktop browsers (Chrome, Edge, Safari, Firefox 130+) |
| **License** | MIT |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React 19 SPA (Vite)                   │
├──────────┬──────────┬───────────┬───────────────────────┤
│  Editor  │ Timeline │  Preview  │   Export Pipeline      │
│   UI     │  Engine  │  Canvas   │                       │
├──────────┴──────────┴───────────┴───────────────────────┤
│                  Core Engine Layer                        │
├──────────┬──────────┬───────────┬───────────────────────┤
│ KenBurns │ Transi-  │  Audio    │  Mediabunny           │
│ Animator │ tions    │  Mixer    │  (CanvasSource)       │
└──────────┴──────────┴───────────┴───────────────────────┘
```

### Rendering Strategy (Dual-Path)

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **Real-time preview** | CSS transforms on `<img>` elements | 60fps on mobile, GPU-accelerated, zero overhead |
| **Frame-accurate scrubbing** | OffscreenCanvas + requestAnimationFrame | For timeline seeking; matches export output exactly |
| **Video export** | Mediabunny CanvasSource + Mp4OutputFormat | Abstracts WebCodecs, handles backpressure, tree-shakable (~20KB gzipped) |
| **Audio encoding** | Mediabunny AudioEncoder (AAC) with MP3 polyfill fallback | AAC where available; @mediabunny/mp3-encoder for Safari 16.4–18.7 |
| **Audio waveform** | WaveSurfer.js | Waveform display on timeline, touch-friendly |
| **Last-resort fallback** | ffmpeg.wasm (single-threaded) | Only for browsers without WebCodecs at all (<7% of users) |

### Browser Support Matrix

| Browser | WebCodecs Video | WebCodecs Audio | Strategy |
|---------|----------------|-----------------|----------|
| Chrome 94+ / Edge 94+ | Full | Full | Mediabunny (AVC + AAC) |
| Safari 26+ (iOS/macOS) | Full | Full | Mediabunny (AVC + AAC) |
| Safari 16.4–18.7 (iOS) | Full | **NOT available** | Mediabunny (AVC + MP3 polyfill) |
| Firefox 130+ | Full | Full | Mediabunny (AVC + AAC) |
| Samsung Internet 17+ | Full | Full | Mediabunny (AVC + AAC) |
| Older browsers | None | None | ffmpeg.wasm fallback |

---

## 3. Tech Stack

| Layer | Choice | Version | Bundle Impact |
|-------|--------|---------|---------------|
| Framework | React | 19.x | — |
| Build | Vite | 7.x | — |
| Language | TypeScript (strict) | 5.6+ | — |
| Styling | Tailwind CSS | 4.x | — |
| UI Components | shadcn/ui + Radix | Latest | — |
| Animation (UI only) | Framer Motion | 12.x | ~50KB gz (lazy) |
| State | Zustand + zundo (undo/redo) | 5.x / 2.x | ~4KB gz |
| Persistence | Dexie.js (IndexedDB) | 4.x | ~15KB gz |
| Routing | Wouter | 3.x | ~3KB gz |
| Video/Audio Muxing | Mediabunny | Latest | ~20-40KB gz (tree-shaken) |
| Audio Polyfill | @mediabunny/mp3-encoder | Latest | ~80KB gz (lazy, only on old Safari) |
| Fallback Encoding | @ffmpeg/ffmpeg | 0.12.x | ~15MB (lazy, last resort) |
| Audio Visualization | wavesurfer.js | 7.x | ~30KB gz |
| Audio Playback | Web Audio API | Native | 0 |
| Touch Gestures | @use-gesture/react | 10.x | ~15KB gz |
| Drag/Resize (timeline) | dnd-kit | Latest | ~20KB gz |

**Total initial bundle target: < 300KB gzipped** (heavy deps lazy-loaded)

---

## 4. Directory Structure

```
kenburns-reel-studio/
├── AGENTS.md                    ← YOU ARE HERE
├── README.md                    ← User-facing project overview
├── CONTRIBUTING.md              ← PR/commit/review standards
├── ARCHITECTURE.md              ← Deep technical design & algorithms
├── TODO.md                      ← Prioritized task backlog
├── .cursorrules                 ← Cursor AI agent context
├── .github/
│   ├── CODEOWNERS
│   ├── copilot-instructions.md  ← GitHub Copilot context
│   └── workflows/
│       └── ci.yml
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types/               ← Shared TypeScript interfaces
│       │   ├── project.ts       ← Project, Clip, Timeline types
│       │   ├── kenburns.ts      ← KenBurns keyframe types
│       │   ├── audio.ts         ← Audio track types
│       │   └── export.ts        ← Export config types
│       ├── store/               ← Zustand state stores
│       │   ├── useProjectStore.ts
│       │   ├── useTimelineStore.ts
│       │   └── useExportStore.ts
│       ├── engine/              ← Core rendering logic (NO UI, NO React)
│       │   ├── kenburns.ts      ← Ken Burns math & interpolation
│       │   ├── transitions.ts   ← Transition effects between clips
│       │   ├── renderer.ts      ← Canvas frame renderer
│       │   ├── exporter.ts      ← Mediabunny export pipeline
│       │   ├── audio-mixer.ts   ← Audio processing, volume, fades
│       │   └── capabilities.ts  ← Feature detection & codec checks
│       ├── components/          ← Reusable UI components
│       │   ├── ui/              ← shadcn/ui primitives (pre-installed)
│       │   ├── preview/         ← Video preview & viewport editor
│       │   ├── timeline/        ← Timeline track, playhead, clips
│       │   ├── controls/        ← Ken Burns control widgets
│       │   └── music/           ← Audio/music picker & waveform
│       ├── pages/               ← Route-level pages
│       │   ├── Home.tsx         ← Project list / new project
│       │   ├── Editor.tsx       ← Main editor workspace
│       │   └── Export.tsx       ← Export progress & download
│       ├── hooks/               ← Custom React hooks
│       │   ├── useKenBurns.ts   ← Viewport interpolation for preview
│       │   ├── useTimeline.ts   ← Playback, seeking, duration
│       │   ├── useAudio.ts      ← Audio playback & sync
│       │   ├── useExport.ts     ← Export orchestration
│       │   └── useGestures.ts   ← Touch gesture handlers
│       ├── lib/                 ← Pure utility functions
│       │   ├── math.ts          ← lerp, clamp, cubicBezier, easing
│       │   ├── image.ts         ← Loading, EXIF handling, thumbnails
│       │   ├── format.ts        ← Time formatting, file naming
│       │   └── utils.ts         ← General utilities
│       ├── constants/           ← App-wide constants
│       │   ├── instagram.ts     ← IG Reel specs (1080x1920, etc.)
│       │   ├── presets.ts       ← Ken Burns motion presets
│       │   └── defaults.ts      ← Default durations, easing curves
│       └── workers/             ← Web Worker scripts
│           └── export.worker.ts ← Off-thread export rendering
├── server/                      ← Minimal static server (placeholder)
├── shared/                      ← Shared constants
└── docs/                        ← Extended documentation
    ├── data-model.md            ← Complete data model reference
    ├── ken-burns-math.md        ← Ken Burns algorithm deep dive
    ├── export-pipeline.md       ← Video export technical details
    ├── audio-strategy.md        ← Audio encoding decision tree
    └── mobile-ux.md             ← Mobile UX patterns & gestures
```

---

## 5. Data Model (Core Types)

```typescript
// ─── types/project.ts ───────────────────────────────────────

interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  canvas: CanvasConfig;
  clips: Clip[];
  audioTracks: AudioTrack[];
  transitions: Transition[];
}

interface CanvasConfig {
  width: number;          // default 1080
  height: number;         // default 1920
  fps: 30;
  aspectRatio: AspectRatio;
}

type AspectRatio = '9:16' | '1:1' | '4:5' | '16:9';

interface Clip {
  id: string;
  imageUrl: string;          // blob URL (runtime) or IndexedDB key
  imageBlobKey: string;      // Dexie key for persistence
  startTime: number;         // ms offset on timeline (computed)
  duration: number;          // ms
  kenburns: KenBurnsConfig;
  order: number;
  thumbnail?: string;        // small base64 for timeline display
}

// ─── types/kenburns.ts ──────────────────────────────────────

interface KenBurnsConfig {
  startViewport: Viewport;   // where camera starts
  endViewport: Viewport;     // where camera ends
  easing: EasingConfig;
  preset?: MotionPreset;     // which preset was applied (if any)
}

interface Viewport {
  x: number;      // 0–1 normalized center X within image
  y: number;      // 0–1 normalized center Y within image
  zoom: number;   // 1 = cover fit, >1 = magnified
}

type EasingConfig =
  | { type: 'preset'; name: EasingPreset }
  | { type: 'bezier'; x1: number; y1: number; x2: number; y2: number };

type EasingPreset = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'slow-start' | 'slow-end';

type MotionPreset =
  | 'zoom-in-center'
  | 'zoom-out-center'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'zoom-in-top-left'
  | 'zoom-in-top-right'
  | 'zoom-out-bottom'
  | 'custom';

// ─── types/audio.ts ─────────────────────────────────────────

interface AudioTrack {
  id: string;
  name: string;
  blobKey: string;           // Dexie key for audio file blob
  url: string;               // runtime blob URL
  startTime: number;         // ms offset on timeline
  duration: number;          // ms (how long it plays)
  volume: number;            // 0–1
  fadeIn: number;            // ms
  fadeOut: number;           // ms
  trimStart: number;         // ms offset into the audio file
  trimEnd: number;           // ms end point in the audio file
}

// ─── types/export.ts ─────────────────────────────────────────

interface ExportConfig {
  quality: 'draft' | 'standard' | 'high';
  resolution: { width: number; height: number };
  fps: 30;
  videoBitrate: number;      // bps
  audioBitrate: number;      // bps
  includeAudio: boolean;
}

interface ExportProgress {
  state: 'idle' | 'preparing' | 'rendering' | 'encoding' | 'muxing' | 'complete' | 'error';
  currentFrame: number;
  totalFrames: number;
  percent: number;           // 0–100
  estimatedTimeRemaining: number; // ms
  error?: string;
}

// ─── Transitions ────────────────────────────────────────────

interface Transition {
  id: string;
  type: TransitionType;
  duration: number;          // ms (overlap between clips)
  fromClipId: string;
  toClipId: string;
}

type TransitionType =
  | 'cut'
  | 'crossfade'
  | 'fade-through-black'
  | 'fade-through-white'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-through'
  | 'blur-transition';
```

---

## 6. Ken Burns Algorithm

### 6.1 Coordinate System

All viewport coordinates are **normalized to 0–1** relative to the source image:

- `(0.5, 0.5)` = center of image
- `(0, 0)` = top-left corner
- `zoom = 1` = image fills canvas in cover-fit mode
- `zoom = 2` = 2× magnification (shows 25% of image area)

### 6.2 Core Interpolation

```typescript
function computeViewportAtTime(
  clip: Clip,
  timeInClip: number // 0 to clip.duration in ms
): Viewport {
  const progress = timeInClip / clip.duration; // 0 to 1
  const easedProgress = applyEasing(progress, clip.kenburns.easing);
  const { startViewport: s, endViewport: e } = clip.kenburns;

  return clampViewport({
    x: lerp(s.x, e.x, easedProgress),
    y: lerp(s.y, e.y, easedProgress),
    zoom: lerp(s.zoom, e.zoom, easedProgress),
  });
}
```

### 6.3 Viewport to CSS Transform (Preview)

```typescript
function viewportToCSS(vp: Viewport, containerW: number, containerH: number): string {
  const scale = vp.zoom;
  const tx = (0.5 - vp.x) * containerW;
  const ty = (0.5 - vp.y) * containerH;
  return `scale(${scale}) translate(${tx}px, ${ty}px)`;
}
```

### 6.4 Viewport to Canvas Draw (Export)

```typescript
function viewportToCanvas(
  vp: Viewport,
  imgW: number, imgH: number,
  canvasW: number, canvasH: number
): { sx: number; sy: number; sw: number; sh: number } {
  // Visible region in image coordinates
  const canvasAspect = canvasW / canvasH;
  const imgAspect = imgW / imgH;

  // Base: cover-fit the image to canvas
  let baseW: number, baseH: number;
  if (imgAspect > canvasAspect) {
    baseH = imgH;
    baseW = imgH * canvasAspect;
  } else {
    baseW = imgW;
    baseH = imgW / canvasAspect;
  }

  // Apply zoom
  const visW = baseW / vp.zoom;
  const visH = baseH / vp.zoom;

  // Center at viewport position
  const sx = vp.x * imgW - visW / 2;
  const sy = vp.y * imgH - visH / 2;

  return { sx, sy, sw: visW, sh: visH };
}
```

### 6.5 Boundary Clamping

```typescript
function clampViewport(vp: Viewport, imgAspect: number, canvasAspect: number): Viewport {
  const minZoom = imgAspect > canvasAspect
    ? 1  // landscape image: height-fit is cover
    : canvasAspect / imgAspect; // portrait image: width-fit is cover

  const zoom = Math.max(vp.zoom, minZoom);
  const halfVisX = 0.5 / zoom;
  const halfVisY = 0.5 / zoom * (canvasAspect / imgAspect);

  return {
    x: clamp(vp.x, halfVisX, 1 - halfVisX),
    y: clamp(vp.y, halfVisY, 1 - halfVisY),
    zoom,
  };
}
```

---

## 7. Export Pipeline (Mediabunny)

```typescript
import {
  Output, Mp4OutputFormat, BufferTarget, CanvasSource,
  AudioSampleSource, getFirstEncodableAudioCodec, QUALITY_HIGH
} from 'mediabunny';

async function exportProject(project: Project): Promise<Blob> {
  const { width, height, fps } = project.canvas;
  const totalFrames = Math.ceil((computeTotalDuration(project) / 1000) * fps);

  // 1. Create canvas and video source
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: getVideoBitrate(project.exportConfig.quality),
  });

  // 2. Determine best audio codec
  const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus', 'mp3'])
    ?? 'pcm-s16'; // ultimate fallback: uncompressed PCM

  // 3. Create output
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  output.addVideoTrack(videoSource, { frameRate: fps });

  // 4. Add audio if present
  let audioSource: AudioSampleSource | null = null;
  if (project.audioTracks.length > 0) {
    audioSource = new AudioSampleSource({ codec: audioCodec, bitrate: 128_000 });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  // 5. Render frames
  for (let frame = 0; frame < totalFrames; frame++) {
    const timeMs = (frame / fps) * 1000;
    renderFrameToCanvas(ctx, project, timeMs);
    await videoSource.add(frame / fps, 1 / fps);
    reportProgress(frame, totalFrames);
  }

  // 6. Add audio samples (if applicable)
  if (audioSource && project.audioTracks.length > 0) {
    await addAudioSamples(audioSource, project);
  }

  // 7. Finalize
  videoSource.close();
  audioSource?.close();
  await output.finalize();

  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}
```

---

## 8. Agent Rules & Standards

### 8.1 Code Style

| Rule | Standard |
|------|----------|
| Language | TypeScript strict mode (`"strict": true`), no `any` |
| Formatting | Prettier (config in `.prettierrc`) |
| Naming | camelCase for variables/functions, PascalCase for components/types/interfaces, UPPER_SNAKE for constants |
| Imports | Absolute paths via `@/` alias (maps to `client/src/`) |
| Components | Functional components only, named exports |
| State | Zustand stores in `store/`, local state with useState/useReducer |
| Side effects | Custom hooks in `hooks/`, never raw useEffect in page components |
| Engine code | ZERO React/DOM dependencies — pure TypeScript (Canvas/WebCodecs APIs allowed) |
| Tests | Vitest, co-located as `*.test.ts` next to source files |
| Comments | JSDoc for all exported functions; inline comments for non-obvious logic |

### 8.2 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body explaining WHY, not what]
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `style`

**Scopes:** `engine`, `timeline`, `preview`, `export`, `audio`, `ui`, `store`, `types`, `deps`, `gestures`

### 8.3 Dependency Boundaries (CRITICAL — enforced by convention)

| Directory | May Import From | MUST NOT Import |
|-----------|----------------|-----------------|
| `engine/` | `types/`, `lib/`, `constants/` | React, DOM APIs (except Canvas/WebCodecs/Web Workers) |
| `store/` | `types/`, `engine/`, `lib/` | React components, DOM |
| `hooks/` | `store/`, `engine/`, `types/`, `lib/` | Direct DOM manipulation, other hooks' internals |
| `components/` | `hooks/`, `types/`, `lib/`, other components, `@/components/ui/*` | Direct engine calls, direct store access |
| `pages/` | `components/`, `hooks/` | Engine, store, lib (access via hooks only) |
| `workers/` | `engine/`, `types/`, `lib/`, `constants/` | React, DOM, store, hooks, components |

### 8.4 Performance Rules

1. **Images**: Always use `createImageBitmap()` with `resizeWidth`/`resizeHeight` for off-thread decoding. Max working resolution: 2160px on longest side.
2. **Memory**: Keep at most 3 full-resolution ImageBitmaps in memory during export. Revoke blob URLs when clips are removed. Track memory via `performance.memory` where available.
3. **Canvas**: Use `OffscreenCanvas` in Web Workers for export. Fall back to main-thread canvas if unavailable.
4. **Animations**: Only animate `transform` and `opacity` for preview. Never animate layout properties.
5. **Mobile**: Target 60fps preview on iPhone 12+ / Pixel 6+. Degrade to 30fps on older devices.
6. **Bundle**: Lazy-load Mediabunny, ffmpeg.wasm, and Framer Motion. Initial load < 300KB gzipped.
7. **Export**: Encode in batches of 30 frames with `await scheduler.yield()` between batches to prevent thermal throttling.
8. **EXIF**: Handle image orientation metadata; `createImageBitmap` respects EXIF rotation by default.

### 8.5 Mobile-First Principles

1. All interactive elements: minimum 44×44px touch target
2. Primary actions at bottom of screen (thumb zone)
3. Use Vaul Drawer (bottom sheets) instead of modals for settings
4. Swipe gestures for timeline navigation via @use-gesture/react
5. Pinch-to-zoom on preview for viewport selection
6. No hover-dependent interactions (hover = enhancement only)
7. Test at 375px width minimum (iPhone SE viewport)
8. Respect safe area insets (`env(safe-area-inset-*)`)
9. Prevent pull-to-refresh during editing (`overscroll-behavior: none`)
10. Support both portrait and landscape orientation

### 8.6 Undo/Redo

All user actions that modify project state MUST be undoable via zundo middleware. The temporal store tracks:
- Clip add/remove/reorder
- Ken Burns viewport changes
- Transition changes
- Audio track changes
- Duration/timing changes

NOT tracked (ephemeral state): playhead position, zoom level, UI panel open/close.

---

## 9. Motion Presets

On image import, auto-apply a random Ken Burns preset to provide immediate visual feedback. Users can then customize or choose a different preset.

| Preset | Start Viewport | End Viewport | Best For |
|--------|---------------|--------------|----------|
| `zoom-in-center` | `{x:0.5, y:0.5, zoom:1}` | `{x:0.5, y:0.5, zoom:1.5}` | Portraits, centered subjects |
| `zoom-out-center` | `{x:0.5, y:0.5, zoom:1.5}` | `{x:0.5, y:0.5, zoom:1}` | Reveals, landscapes |
| `pan-left` | `{x:0.7, y:0.5, zoom:1.3}` | `{x:0.3, y:0.5, zoom:1.3}` | Wide scenes, groups |
| `pan-right` | `{x:0.3, y:0.5, zoom:1.3}` | `{x:0.7, y:0.5, zoom:1.3}` | Wide scenes, groups |
| `pan-up` | `{x:0.5, y:0.6, zoom:1.2}` | `{x:0.5, y:0.4, zoom:1.2}` | Tall subjects, buildings |
| `pan-down` | `{x:0.5, y:0.4, zoom:1.2}` | `{x:0.5, y:0.6, zoom:1.2}` | Tall subjects, waterfalls |
| `zoom-in-top-left` | `{x:0.5, y:0.5, zoom:1}` | `{x:0.3, y:0.3, zoom:1.8}` | Detail focus |
| `zoom-in-top-right` | `{x:0.5, y:0.5, zoom:1}` | `{x:0.7, y:0.3, zoom:1.8}` | Detail focus |
| `zoom-out-bottom` | `{x:0.5, y:0.7, zoom:1.6}` | `{x:0.5, y:0.5, zoom:1}` | Dramatic reveals |

---

## 10. Key Decisions Log

| # | Decision | Choice | Rationale | Alternatives Considered |
|---|----------|--------|-----------|------------------------|
| 1 | Video muxing library | Mediabunny | Successor to mp4-muxer (deprecated), CanvasSource API perfect for our use case, tree-shakable, handles WebCodecs abstraction | mp4-muxer (deprecated), manual WebCodecs + raw muxing |
| 2 | Audio on Safari 16.4–18.7 | @mediabunny/mp3-encoder polyfill | AudioEncoder unavailable; MP3 polyfill provides compressed audio without WebCodecs | PCM (too large), ffmpeg.wasm (too heavy for just audio) |
| 3 | Preview rendering | CSS transforms | GPU-composited, 60fps on mobile, zero JS overhead per frame | Canvas (more accurate but heavier), WebGL (overkill) |
| 4 | State management | Zustand + zundo | Minimal boilerplate, built-in undo/redo via zundo, works with React 19 | Redux Toolkit (heavy), Jotai (less undo support) |
| 5 | Persistence | Dexie.js (IndexedDB) | Clean API for storing large blobs + structured data, good TypeScript support | idb-keyval (too simple), raw IndexedDB (verbose) |
| 6 | Timeline UI | Custom (dnd-kit + @use-gesture) | No existing library matches mobile-first timeline needs | Twick SDK (too opinionated), react-resizable-panels (not timeline-shaped) |
| 7 | Audio waveform | WaveSurfer.js 7 | Best waveform rendering, responsive, touch-friendly | Custom canvas (too much work), peaks.js (heavier) |
| 8 | Touch gestures | @use-gesture/react | Composable with React, handles pinch/pan/drag, works with Framer Motion | Hammer.js (old, not React-native), custom (error-prone) |
| 9 | Aspect ratio | Multi-ratio support (default 9:16) | Users may want 1:1 or 4:5 for Instagram posts, 16:9 for YouTube | Fixed 9:16 only (too limiting) |
| 10 | ffmpeg.wasm role | Last-resort fallback only | 15MB download, only needed for <7% of browsers without WebCodecs | Primary encoder (too heavy for mobile) |

---

## 11. Getting Started (For Agents)

```bash
# 1. Install dependencies
pnpm install

# 2. Start dev server
pnpm dev

# 3. Run type checking
pnpm check

# 4. Run tests
pnpm test

# 5. Format code
pnpm format
```

### First-Time Agent Checklist

1. Read this entire `AGENTS.md`
2. Read `ARCHITECTURE.md` for rendering pipeline details
3. Read `TODO.md` for current priorities
4. Check `types/` for data model understanding
5. Review `engine/` for core algorithm implementations
6. Review `constants/presets.ts` for motion preset definitions
7. Run the app locally and test on mobile viewport (375px)
8. Verify you understand the dependency boundary rules (Section 8.3)

### When Picking Up a Task

1. Check `TODO.md` for the highest-priority unclaimed item
2. Create a feature branch: `feat/<short-description>`
3. Implement following rules in Section 8
4. Write/update tests for engine code
5. Test on mobile viewport in browser DevTools
6. Update `TODO.md` to mark task complete
7. Commit with conventional commit message

---

## 12. External Resources

| Resource | URL | Purpose |
|----------|-----|---------|
| Mediabunny Docs | https://mediabunny.dev | Video/audio muxing & encoding |
| Mediabunny GitHub | https://github.com/Vanilagy/mediabunny | Source, issues, examples |
| @mediabunny/mp3-encoder | https://www.npmjs.com/package/@mediabunny/mp3-encoder | Audio polyfill for old Safari |
| WebCodecs API (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API | Native encoding reference |
| WebCodecs Browser Support | https://caniuse.com/webcodecs | Compatibility table |
| WaveSurfer.js | https://wavesurfer.xyz/ | Audio waveform display |
| Dexie.js | https://dexie.org/ | IndexedDB wrapper |
| zundo | https://github.com/charkour/zundo | Zustand undo/redo middleware |
| @use-gesture/react | https://use-gesture.netlify.app/ | Touch gesture library |
| dnd-kit | https://dndkit.com/ | Drag-and-drop toolkit |
| gre/kenburns (archived) | https://github.com/gre/kenburns | Ken Burns algorithm reference |
| Instagram Reels Specs | https://help.instagram.com/ | Output format requirements |

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| **Viewport** | Normalized rectangle (x, y, zoom) defining visible portion of an image |
| **Clip** | Single image + Ken Burns config + duration on the timeline |
| **Timeline** | Ordered sequence of clips with transitions, producing a continuous video |
| **Transition** | Visual blend between two adjacent clips (crossfade, cut, etc.) |
| **Export** | Offline rendering of all frames + audio encoding → MP4 file |
| **Muxing** | Combining encoded video + audio streams into MP4 container |
| **Easing** | Bezier curve controlling animation speed (acceleration/deceleration) |
| **Scrubbing** | Dragging playhead to seek through timeline (frame-accurate) |
| **Cover fit** | Scaling image to fill canvas with no empty space (may crop edges) |
| **Preset** | Pre-configured start/end viewport pair for common Ken Burns motions |
| **CanvasSource** | Mediabunny API that captures canvas frames for video encoding |
