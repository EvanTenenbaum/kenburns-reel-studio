# GitHub Copilot Instructions — Ken Burns Reel Studio

## Project Context

This is a mobile-first web app for creating Instagram Reels from still images using Ken Burns (pan & zoom) motion effects. It includes a timeline editor, transitions between clips, and music/audio support. All processing happens client-side in the browser.

## Key Files to Read

- `AGENTS.md` — Full architecture, data model, coding standards, and dependency rules
- `ARCHITECTURE.md` — Deep technical design (rendering pipeline, export, audio)
- `TODO.md` — Prioritized task backlog
- `.cursorrules` — Quick reference for rules and types

## Tech Stack

React 19, TypeScript (strict), Vite 7, Tailwind CSS 4, Zustand + zundo (undo/redo), Dexie.js (IndexedDB), Mediabunny (video export via CanvasSource), @use-gesture/react, dnd-kit, WaveSurfer.js, Framer Motion.

## Critical Constraints

1. **Engine code** (`client/src/engine/`) must have ZERO React or DOM dependencies. Only Canvas, WebCodecs, and Worker APIs are allowed.
2. **Components** must access engine/store only through hooks — never import stores or engine modules directly.
3. **Mobile-first**: All touch targets ≥ 44×44px. Test at 375px width. Use bottom sheets (Vaul Drawer) instead of modals.
4. **Performance**: Only animate `transform` and `opacity`. Lazy-load Mediabunny, ffmpeg.wasm, WaveSurfer.
5. **TypeScript strict**: No `any` types. All exported functions must have JSDoc comments.
6. **Undo/redo**: All project-modifying actions must go through Zustand stores with zundo middleware.

## Video Export Pattern (Mediabunny)

```typescript
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from 'mediabunny';

const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: 8_000_000 });
const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
output.addVideoTrack(videoSource, { frameRate: 30 });
await output.start();
// For each frame: render to canvas, then await videoSource.add(timestamp, duration);
await output.finalize();
```

## Viewport Coordinate System

All viewport values are normalized 0–1 relative to image dimensions:
- `(0.5, 0.5)` = center, `zoom = 1` = cover fit, `zoom > 1` = magnified

## Commit Convention

`<type>(<scope>): <description>` — Types: feat, fix, refactor, docs, test, perf, chore. Scopes: engine, timeline, preview, export, audio, ui, store, types, deps, gestures.
