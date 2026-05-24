# One-Shot Build Prompt

Use this prompt with Claude Code, Cursor (Composer mode), or any AI coding agent to build the entire application in one pass. Clone this repo first, then paste the prompt below.

---

## The Prompt

You are building the complete Ken Burns Reel Studio application. The repository is already scaffolded with architecture docs, types, engine code, and tests.

CRITICAL: Read AGENTS.md completely before writing any code. It contains the data model, algorithms, dependency boundaries, and coding rules you MUST follow.

### Your Mission

Implement the ENTIRE working application in one pass. The app lets users create Instagram Reels from still images using Ken Burns (pan & zoom) effects, with a timeline, transitions, and music — all running client-side in the browser.

### What Already Exists (DO NOT rewrite)

- `client/src/types/` — Full TypeScript interfaces (Project, Clip, KenBurnsConfig, AudioTrack, ExportConfig)
- `client/src/engine/kenburns.ts` — Viewport interpolation, clamping, CSS transform output, canvas source rect
- `client/src/engine/capabilities.ts` — Browser feature detection (WebCodecs, AudioEncoder, OffscreenCanvas)
- `client/src/lib/math.ts` — lerp, clamp, cubicBezier, applyEasing, formatTime
- `client/src/constants/` — Motion presets (9 patterns), Instagram output specs, app defaults
- Unit tests (33 passing) — `engine/kenburns.test.ts`, `lib/math.test.ts`
- `vitest.config.ts` — Test configuration

### What You Must Build (in dependency order)

#### Layer 1: State & Persistence

1. `client/src/store/projectStore.ts` — Zustand store with zundo middleware for undo/redo. Actions: createProject, addClip, removeClip, reorderClips, updateClipKenBurns, updateClipDuration, addTransition, updateTransition, addAudioTrack, removeAudioTrack, updateAudioTrack. Ephemeral state (playhead, zoom, UI panels) in a separate slice NOT tracked by zundo.
2. `client/src/store/db.ts` — Dexie.js database with tables: projects (metadata), blobs (image/audio binary data). Methods: saveProject, loadProject, saveBlob, loadBlob, deleteProject.

#### Layer 2: Hooks (bridge store/engine → components)

3. `client/src/hooks/useProject.ts` — Wraps projectStore, provides computed values (totalDuration, currentClip, timelineLayout)
4. `client/src/hooks/usePlayback.ts` — requestAnimationFrame loop, playhead management, play/pause/seek
5. `client/src/hooks/useKenBurns.ts` — Given a clip + current time, returns the interpolated viewport using engine functions
6. `client/src/hooks/useExport.ts` — Manages export lifecycle, progress reporting, cancel support

#### Layer 3: Components

7. `client/src/components/Preview.tsx` — Full-screen Ken Burns preview. Uses CSS transforms (NOT canvas) for real-time display. Shows current clip with animated viewport. Supports pinch-to-zoom and drag to set start/end viewport positions.
8. `client/src/components/Timeline.tsx` — Horizontal scrollable timeline at bottom of screen. Clips shown as thumbnail strips with duration proportional to width. Drag-to-reorder via dnd-kit. Tap clip to select. Transition slots between clips. Playhead indicator. Pinch to zoom timeline scale.
9. `client/src/components/ClipControls.tsx` — Bottom sheet (Vaul Drawer) for selected clip. Duration slider, Ken Burns preset picker (grid of 9 presets with mini-preview), easing curve selector, manual viewport adjustment toggle.
10. `client/src/components/TransitionPicker.tsx` — Bottom sheet showing transition type grid with mini animated previews. Duration slider.
11. `client/src/components/AudioPanel.tsx` — Bottom sheet for music. Import button, WaveSurfer.js waveform display, volume slider, fade in/out controls, trim handles.
12. `client/src/components/ExportSheet.tsx` — Bottom sheet showing quality picker, aspect ratio selector, progress bar during export, download/share buttons on completion.
13. `client/src/components/Toolbar.tsx` — Floating action bar above timeline: Add Image, Add Music, Undo, Redo, Play/Pause, Export.

#### Layer 4: Pages & Routing

14. `client/src/pages/Home.tsx` — Project list (load from Dexie) + "New Project" button. Shows thumbnails of existing projects.
15. `client/src/pages/Editor.tsx` — Main editing view. Layout: Preview (top 60%), Toolbar (middle), Timeline (bottom 30%). All panels are bottom sheets that slide up over the preview.

#### Layer 5: Export Pipeline

16. `client/src/workers/exportWorker.ts` — Web Worker that: creates OffscreenCanvas, iterates frames (30fps × total duration), for each frame calls viewportToSourceRect + drawImage, feeds frames to Mediabunny CanvasSource, mixes audio via OfflineAudioContext, muxes into MP4, posts progress back to main thread, returns final blob.

### Design Requirements

- **Dark theme** — Dark background (#0a0a0a), subtle borders, high contrast text
- **Mobile-first** — Design for 375px width. All touch targets ≥ 44px. Primary actions in thumb zone (bottom of screen). Use Vaul Drawer for all panels/settings (NOT modals).
- **Gestures** — @use-gesture/react for pinch-to-zoom (preview viewport + timeline scale), drag (viewport pan, timeline scrub), swipe (dismiss panels)
- **Animation** — Framer Motion for panel entrances (slide up from bottom, 200ms ease-out). No animation on frequent interactions. CSS transitions for button presses (scale 0.97 on active).
- **Typography** — Use "Space Grotesk" for headings (bold, tight tracking) and "Inter" for body/UI. Import via Google Fonts in client/index.html.

### Technical Constraints

- Install these dependencies: `pnpm add zustand dexie wavesurfer.js @use-gesture/react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities mediabunny vaul`
- Engine code (`client/src/engine/`) must have ZERO React imports — it's pure computation
- Components access state ONLY through hooks, never import stores directly
- Lazy-load Mediabunny (only on export), WaveSurfer (only when audio panel opens)
- Use `React.lazy()` for the Editor page (it's heavy)
- All user actions that modify project state must work with undo/redo (zundo tracks them automatically via Zustand)
- Persist projects to IndexedDB via Dexie on every state change (debounced 2 seconds)
- Handle image EXIF orientation (createImageBitmap handles this automatically)
- Generate 150px thumbnails on image import for timeline display
- Prevent pull-to-refresh during editing: `overscroll-behavior: none` on editor page
- Respect safe area insets: `env(safe-area-inset-bottom)` for bottom toolbar/timeline

### Export Pipeline Details

```typescript
// Pseudocode for export flow:
const canvasSource = new CanvasSource(canvas, { fps: 30 });
const muxer = new Muxer({ video: canvasSource });

for (let frame = 0; frame < totalFrames; frame++) {
  const time = (frame / 30) * 1000; // ms
  const { clip, timeInClip } = getClipAtTime(time, clips, transitions);
  const viewport = computeViewportAtTime(clip.kenburns, timeInClip, clip.duration);
  const srcRect = viewportToSourceRect(viewport, img.width, img.height, 1080, 1920);
  ctx.drawImage(img, srcRect.sx, srcRect.sy, srcRect.sw, srcRect.sh, 0, 0, 1080, 1920);
  // Handle transitions: blend two clips during overlap
  await canvasSource.captureFrame();
  if (frame % 30 === 0) await scheduler.yield?.(); // thermal management
}

// Audio: mix all tracks with OfflineAudioContext, encode, mux
await muxer.finalize();
const blob = muxer.getBlob();
```

### File Structure Reminder

```
client/src/
├── types/          ← EXISTS, don't touch
├── engine/         ← EXISTS, don't touch
├── lib/            ← EXISTS (math.ts), can add more utilities
├── constants/      ← EXISTS, don't touch
├── store/          ← BUILD THIS (projectStore.ts, db.ts)
├── hooks/          ← BUILD THIS (useProject, usePlayback, useKenBurns, useExport)
├── components/     ← BUILD THIS (Preview, Timeline, ClipControls, etc.)
├── pages/          ← MODIFY Home.tsx, ADD Editor.tsx
├── workers/        ← BUILD THIS (exportWorker.ts)
└── App.tsx         ← MODIFY (add routes)
```

### Quality Bar

- TypeScript strict mode, zero `any` types
- Every component must work at 375px width
- Preview must maintain 60fps during Ken Burns animation (CSS transforms only)
- Export must not freeze the UI (Web Worker)
- Undo/redo must work for all editing actions
- Empty states for: no projects, no clips, no audio
- Error boundaries around Preview and Export
- Toast notifications (sonner) for: image imported, export complete, export failed

### When Done

Run `pnpm check` (zero errors), `pnpm test` (all pass), and verify the app works in Chrome DevTools mobile emulation at 375×812 (iPhone 13 mini). The user should be able to: import 3+ images → see Ken Burns animation preview → reorder on timeline → add a transition → import music → export MP4 → download the file.

---

## Usage Tips

| Environment | How to Use |
|-------------|-----------|
| **Claude Code** | Clone repo, paste this entire prompt as your first message |
| **Cursor (Composer)** | Reference this file with `@PROMPT.md` in composer mode |
| **Aider** | Run `aider --read PROMPT.md` to load as context |
| **Any agent** | Read AGENTS.md first, then use this as the build instruction |

If the agent struggles with the full scope in one pass, split into two rounds:
1. **Round 1:** Layers 1–3 (state, hooks, components)
2. **Round 2:** Layers 4–5 (pages, export pipeline)
