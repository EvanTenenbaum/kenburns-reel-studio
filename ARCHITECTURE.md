# Architecture — Ken Burns Reel Studio

## System Design Philosophy

This application is a **client-side video creation tool**. All computation — image processing, animation rendering, video encoding, and audio mixing — happens in the user's browser. There is no server-side rendering. This decision maximizes privacy (images never leave the device), eliminates infrastructure costs, and enables offline usage.

---

## 1. Rendering Pipeline

### 1.1 Preview Path (Real-Time)

The preview path prioritizes **60fps on mobile devices**. It uses CSS transforms exclusively because they are GPU-composited and avoid layout/paint costs.

```
User adjusts viewport → Zustand store updates → React re-renders
→ CSS transform applied to <img> → GPU composites frame
```

The preview container is a fixed aspect-ratio `<div>` (default 9:16) with `overflow: hidden`. The image inside receives a `transform: scale(Z) translate(X, Y)` computed from the current viewport at the current playhead time.

During playback, a `requestAnimationFrame` loop advances the playhead and triggers store updates at ~60fps. The actual CSS transition is not used for playback — we compute each frame's transform discretely for frame-accurate scrubbing.

### 1.2 Export Path (Offline Rendering via Mediabunny)

The export path prioritizes **quality and correctness** over speed. It renders every frame to a Canvas and feeds it to Mediabunny's CanvasSource, which handles WebCodecs encoding and MP4 muxing internally.

```
For each frame (0 to totalFrames):
  1. Determine which clip is active at this frame time
  2. Compute viewport interpolation for the clip
  3. If in transition zone, compute both clips + blend
  4. Draw to OffscreenCanvas (1080×1920)
  5. Call videoSource.add(timestamp, duration) → Mediabunny encodes + muxes
  6. Yield every 30 frames for thermal management
  7. When all frames added, finalize output → MP4 Blob
```

### 1.3 Web Worker Architecture

Export rendering runs in a Web Worker to avoid blocking the main thread:

```
Main Thread                    Worker Thread
─────────────                  ─────────────
Start export ──────────────→  Initialize Mediabunny Output
                               For each frame:
Progress update ←──────────    Render canvas + videoSource.add()
                               ...
Complete ←─────────────────   Return MP4 Blob (transferable)
```

The worker receives:
- All image bitmaps (transferred, not copied)
- Project data (clips, transitions, audio config)
- Export settings (resolution, fps, quality)

---

## 2. Ken Burns Engine

### 2.1 Coordinate System

All viewport coordinates are **normalized to 0–1** relative to the source image dimensions:
- `(0.5, 0.5)` = center of image
- `(0, 0)` = top-left corner
- `zoom = 1` = image fills the canvas (cover fit)
- `zoom = 2` = 2× magnification (shows 25% of image area)

### 2.2 Interpolation

Linear interpolation between start and end viewports, modified by an easing function:

```
progress = elapsed / duration           // 0 to 1
eased = cubicBezier(progress, easing)   // 0 to 1 (non-linear)
viewport = lerp(startViewport, endViewport, eased)
```

### 2.3 Image Fitting

Before applying Ken Burns, the source image must be fit to the canvas. The fitting strategy:

1. Compute the aspect ratio of the source image
2. If wider than canvas: fit height, crop width (landscape photos)
3. If taller than canvas: fit width, crop height (portrait photos)
4. The "base" zoom level (zoom=1) shows the image at cover-fit scale
5. Zoom > 1 magnifies further into the image

### 2.4 Boundary Clamping

To prevent showing empty space outside the image, the viewport is clamped:

```typescript
function clampViewport(vp: Viewport, imgAspect: number, canvasAspect: number): Viewport {
  const minZoom = computeMinZoom(imgAspect, canvasAspect);
  const zoom = Math.max(vp.zoom, minZoom);

  // Compute visible area at this zoom
  const visibleW = 1 / zoom;
  const visibleH = (1 / zoom) * (canvasAspect / imgAspect);

  // Clamp center so edges don't go past image bounds
  const x = clamp(vp.x, visibleW / 2, 1 - visibleW / 2);
  const y = clamp(vp.y, visibleH / 2, 1 - visibleH / 2);

  return { x, y, zoom };
}
```

### 2.5 Viewport to Canvas Draw (Export)

```typescript
function viewportToSourceRect(
  vp: Viewport,
  imgW: number, imgH: number,
  canvasW: number, canvasH: number
): { sx: number; sy: number; sw: number; sh: number } {
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

  // Apply zoom: visible region shrinks as zoom increases
  const visW = baseW / vp.zoom;
  const visH = baseH / vp.zoom;

  // Center at viewport position
  const sx = vp.x * imgW - visW / 2;
  const sy = vp.y * imgH - visH / 2;

  return { sx, sy, sw: visW, sh: visH };
}
```

---

## 3. Timeline System

### 3.1 Data Flow

```
Clips array (ordered) → compute absolute start times
→ detect transition overlaps → render timeline tracks
```

Each clip has a `startTime` and `duration`. Transitions create overlaps where both clips are visible simultaneously.

### 3.2 Time Computation

```typescript
function computeTimeline(clips: Clip[], transitions: Transition[]): TimelineLayout {
  let currentTime = 0;
  const layout: ClipLayout[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const prevTransition = transitions.find(t => t.toClipId === clip.id);
    const overlap = prevTransition ? prevTransition.duration : 0;

    clip.startTime = currentTime - overlap;
    layout.push({ clip, startTime: clip.startTime, endTime: clip.startTime + clip.duration });
    currentTime = clip.startTime + clip.duration;
  }

  return { layout, totalDuration: currentTime };
}
```

### 3.3 Transition Rendering

During a transition overlap, both clips are rendered and blended:

```typescript
function renderTransitionFrame(
  ctx: OffscreenCanvasRenderingContext2D,
  fromClip: Clip, toClip: Clip,
  transition: Transition,
  timeInTransition: number
) {
  const progress = timeInTransition / transition.duration;

  switch (transition.type) {
    case 'crossfade':
      renderClipFrame(ctx, fromClip, timeInClip(fromClip));
      ctx.globalAlpha = progress;
      renderClipFrame(ctx, toClip, timeInClip(toClip));
      ctx.globalAlpha = 1;
      break;
    case 'fade-through-black':
      if (progress < 0.5) {
        renderClipFrame(ctx, fromClip, timeInClip(fromClip));
        ctx.globalAlpha = progress * 2;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      } else {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalAlpha = (progress - 0.5) * 2;
        renderClipFrame(ctx, toClip, timeInClip(toClip));
      }
      ctx.globalAlpha = 1;
      break;
    // ... other transition types
  }
}
```

---

## 4. Video Export Pipeline (Mediabunny)

### 4.1 Why Mediabunny

Mediabunny (successor to the deprecated mp4-muxer library, same author) is a zero-dependency, tree-shakable TypeScript library that provides:

- **CanvasSource**: Directly captures canvas frames for video encoding — no manual VideoEncoder setup
- **Automatic WebCodecs abstraction**: Handles encoder configuration, backpressure, and chunk management
- **Multi-codec support**: Runtime codec detection with `getFirstEncodableAudioCodec()`
- **Custom encoder registration**: Enables polyfilling codecs not natively supported
- **Built-in PCM codecs**: Always-available audio encoding fallback
- **Streaming output**: BufferTarget for in-memory, StreamTarget for large files
- **Tree-shakable**: Only ~20-40KB gzipped for our use case (MP4 muxing + AVC + audio)

### 4.2 Export Implementation

```typescript
import {
  Output, Mp4OutputFormat, BufferTarget, CanvasSource,
  AudioSampleSource, getFirstEncodableAudioCodec, QUALITY_HIGH
} from 'mediabunny';

async function exportProject(project: Project): Promise<Blob> {
  const { width, height, fps } = project.canvas;
  const totalDuration = computeTotalDuration(project); // ms
  const totalFrames = Math.ceil((totalDuration / 1000) * fps);

  // 1. Create canvas and video source
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: getVideoBitrate(project.exportConfig.quality),
    // Mediabunny handles VideoEncoder internally
  });

  // 2. Determine best available audio codec
  const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus', 'mp3'])
    ?? 'pcm-s16'; // Built-in PCM encoder (always works, larger file)

  // 3. Create output
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  output.addVideoTrack(videoSource, { frameRate: fps });

  // 4. Add audio track if present
  let audioSource: AudioSampleSource | null = null;
  if (project.audioTracks.length > 0) {
    audioSource = new AudioSampleSource({
      codec: audioCodec,
      bitrate: 128_000,
    });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  // 5. Render frames with backpressure handling
  for (let frame = 0; frame < totalFrames; frame++) {
    const timeMs = (frame / fps) * 1000;
    renderFrameToCanvas(ctx, project, timeMs);

    // Mediabunny handles encoding + backpressure via returned promise
    await videoSource.add(frame / fps, 1 / fps);

    // Thermal management: yield every 30 frames
    if (frame % 30 === 0) {
      await scheduler.yield?.() ?? new Promise(r => setTimeout(r, 0));
      reportProgress(frame, totalFrames);
    }
  }

  // 6. Add audio samples
  if (audioSource && project.audioTracks.length > 0) {
    const mixedAudio = await mixAudioOffline(project);
    await feedAudioSamples(audioSource, mixedAudio);
    audioSource.close();
  }

  // 7. Finalize
  videoSource.close();
  await output.finalize();

  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}
```

### 4.3 Audio Codec Fallback Strategy

```
┌─ canEncode('aac') ? ──── YES ──▶ Use AAC (smallest, universal playback)
│
└─ NO ─┬─ @mediabunny/mp3-encoder registered? ── YES ──▶ Use MP3
        │
        └─ NO ──▶ Use PCM-s16 (large file, always works)
```

On Safari 16.4–18.7 (iOS), the WebCodecs AudioEncoder is not available. The app lazy-loads `@mediabunny/mp3-encoder` (~80KB) which registers a custom MP3 encoder with Mediabunny:

```typescript
import { registerEncoder } from 'mediabunny';
import { Mp3Encoder } from '@mediabunny/mp3-encoder';

// Register once at startup (or lazily when needed)
registerEncoder('mp3', Mp3Encoder);
```

### 4.4 Fallback (ffmpeg.wasm) — Last Resort

When WebCodecs is entirely unavailable (<7% of browsers):
1. Render all frames to PNG blobs
2. Lazy-load ffmpeg.wasm (single-threaded, ~15MB)
3. Write frame PNGs to virtual filesystem
4. Run: `ffmpeg -framerate 30 -i frame%04d.png -i audio.aac -c:v libx264 -pix_fmt yuv420p output.mp4`
5. Read output file and create download blob

---

## 5. Audio System

### 5.1 Playback (Preview)

During preview, audio is played via the Web Audio API:

```
AudioContext → GainNode (volume + fades) → AudioDestination
                ↑
         AudioBufferSourceNode (decoded audio file)
```

Audio playback is synchronized to the timeline playhead. When the user scrubs, audio seeks to match. Fade in/out is implemented via `GainNode.gain.linearRampToValueAtTime()`.

### 5.2 Waveform Display

WaveSurfer.js renders the audio waveform on the timeline track. It receives the decoded audio buffer and displays it aligned to the timeline's time scale, with touch-friendly trim handles.

### 5.3 Export Audio Mixing (OfflineAudioContext)

For export, audio is processed offline using `OfflineAudioContext`:

```typescript
async function mixAudioOffline(project: Project): Promise<AudioBuffer> {
  const totalDuration = computeTotalDuration(project) / 1000; // seconds
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, totalDuration * sampleRate, sampleRate);

  for (const track of project.audioTracks) {
    const buffer = await decodeAudioBlob(track.blobKey);
    const source = offline.createBufferSource();
    source.buffer = buffer;

    // Apply volume
    const gain = offline.createGain();
    gain.gain.value = track.volume;

    // Apply fades
    gain.gain.setValueAtTime(0, track.startTime / 1000);
    gain.gain.linearRampToValueAtTime(track.volume, (track.startTime + track.fadeIn) / 1000);
    gain.gain.setValueAtTime(track.volume, (track.startTime + track.duration - track.fadeOut) / 1000);
    gain.gain.linearRampToValueAtTime(0, (track.startTime + track.duration) / 1000);

    source.connect(gain).connect(offline.destination);
    source.start(track.startTime / 1000, track.trimStart / 1000);
  }

  return offline.startRendering();
}
```

---

## 6. Mobile UX Architecture

### 6.1 Screen Layout (Editor Page)

```
┌──────────────────────────┐
│     Preview (9:16)       │  ← 50% of screen height
│     [Live Ken Burns]     │
│                          │
├──────────────────────────┤
│  Playback Controls       │  ← Play/Pause, time, undo/redo
├──────────────────────────┤
│  Timeline                │  ← Scrollable, pinch-to-zoom
│  [Clip][Trans][Clip]...  │
│  [♪ Audio waveform ♪]   │
├──────────────────────────┤
│  Bottom Actions          │  ← Add clip, motion, music, export
└──────────────────────────┘
```

### 6.2 Gesture Mapping

| Gesture | Context | Action |
|---------|---------|--------|
| Tap | Preview | Toggle play/pause |
| Pinch | Preview | Adjust zoom level of viewport |
| Two-finger drag | Preview | Pan viewport center |
| Long press | Preview | Switch start/end viewport editing |
| Swipe left/right | Timeline | Scroll timeline |
| Pinch horizontal | Timeline | Zoom timeline scale |
| Long press + drag | Timeline clip | Reorder clips |
| Tap | Timeline clip | Select clip for editing |
| Drag edges | Timeline clip | Trim clip duration |
| Tap | Transition zone | Edit transition type/duration |

### 6.3 Bottom Sheet Pattern

All secondary controls use the Vaul Drawer component (bottom sheet):
- Ken Burns settings (easing, direction presets)
- Transition picker
- Audio volume/trim controls
- Export settings

This keeps the main editor uncluttered while providing full control.

---

## 7. State Management

### 7.1 Store Structure (Zustand + zundo)

```typescript
// useProjectStore - Source of truth for project data (with undo/redo via zundo)
interface ProjectStore {
  project: Project | null;
  clips: Clip[];
  transitions: Transition[];
  audioTracks: AudioTrack[];

  // Actions (all undoable)
  addClip: (image: File) => void;
  removeClip: (id: string) => void;
  reorderClips: (fromIndex: number, toIndex: number) => void;
  updateKenBurns: (clipId: string, config: Partial<KenBurnsConfig>) => void;
  updateClipDuration: (clipId: string, duration: number) => void;
  addTransition: (fromId: string, toId: string, type: TransitionType) => void;
  updateTransition: (id: string, config: Partial<Transition>) => void;
  addAudioTrack: (file: File) => void;
  removeAudioTrack: (id: string) => void;
  updateAudioTrack: (id: string, config: Partial<AudioTrack>) => void;
}

// useTimelineStore - Ephemeral playback state (NOT undoable)
interface TimelineStore {
  playhead: number;       // current time in ms
  isPlaying: boolean;
  duration: number;       // total computed duration
  zoom: number;           // timeline zoom level
  selectedClipId: string | null;

  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
}

// useExportStore - Export progress (NOT undoable)
interface ExportStore {
  state: ExportProgress['state'];
  progress: number;       // 0-100
  error: string | null;
  outputUrl: string | null;

  startExport: (project: Project, config: ExportConfig) => void;
  cancelExport: () => void;
}
```

### 7.2 Persistence (Dexie.js / IndexedDB)

```typescript
const db = new Dexie('KenBurnsReelStudio');

db.version(1).stores({
  projects: 'id, updatedAt',        // Project metadata (JSON)
  images: 'id, projectId',          // Image blobs (full-res + thumbnail)
  audioFiles: 'id, projectId',      // Audio file blobs
});
```

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Project metadata | IndexedDB (Dexie) | Structured, queryable, auto-saved |
| Image blobs | IndexedDB (Dexie) | Persistent across sessions |
| Image thumbnails | IndexedDB (small) | Fast timeline rendering |
| Audio file blobs | IndexedDB (Dexie) | Persistent across sessions |
| Runtime ImageBitmaps | In-memory only | Recreated from blobs on demand |
| Undo/redo history | In-memory (zundo) | Ephemeral, resets on page load |

Auto-save: project state is debounced (2s) and written to IndexedDB on every meaningful change.

---

## 8. Memory Management

### 8.1 The Problem

A 12MP phone photo (4032×3024) occupies ~48MB as RGBA bitmap. With 10 clips loaded simultaneously, that's 480MB — far exceeding mobile browser limits.

### 8.2 Strategy

1. **On import**: Create a downscaled working copy (max 2160px longest side) via `createImageBitmap(blob, { resizeWidth, resizeHeight })`. Store both original blob and working copy in IndexedDB.

2. **During editing**: Only keep the current clip's ImageBitmap in memory for preview. Timeline shows small thumbnails (150px wide).

3. **During export**: Load at most 3 ImageBitmaps at a time (previous, current, next — needed for transitions). Release immediately after last frame of each clip.

4. **Blob URL hygiene**: `URL.revokeObjectURL()` when clips are removed or project is closed.

### 8.3 Image Loading Pipeline

```typescript
async function loadClipImage(clip: Clip): Promise<ImageBitmap> {
  const blob = await db.images.get(clip.imageBlobKey);
  if (!blob) throw new Error(`Image not found: ${clip.imageBlobKey}`);

  // createImageBitmap handles EXIF orientation automatically
  return createImageBitmap(blob.data, {
    resizeWidth: Math.min(blob.naturalWidth, 2160),
    resizeHeight: Math.min(blob.naturalHeight, 2160),
    resizeQuality: 'high',
  });
}
```

---

## 9. Feature Detection & Progressive Enhancement

```typescript
interface AppCapabilities {
  webcodecs: boolean;           // VideoEncoder available
  webcodecAudio: boolean;       // AudioEncoder available
  offscreenCanvas: boolean;     // OffscreenCanvas in workers
  webShare: boolean;            // navigator.share with files
  webAudio: boolean;            // AudioContext available
  schedulerYield: boolean;      // scheduler.yield() for thermal mgmt
  deviceMemory: number;         // navigator.deviceMemory (GB, Chrome only)
}

async function detectCapabilities(): Promise<AppCapabilities> {
  return {
    webcodecs: typeof VideoEncoder !== 'undefined',
    webcodecAudio: typeof AudioEncoder !== 'undefined',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    webShare: 'share' in navigator && 'canShare' in navigator,
    webAudio: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
    schedulerYield: 'scheduler' in globalThis && 'yield' in (globalThis as any).scheduler,
    deviceMemory: (navigator as any).deviceMemory ?? 4,
  };
}
```

### Degradation Strategy

| Missing Capability | Fallback |
|-------------------|----------|
| No WebCodecs (video) | Show "unsupported browser" with upgrade link |
| No AudioEncoder | Lazy-load @mediabunny/mp3-encoder polyfill |
| No OffscreenCanvas | Render on main thread (UI may stutter during export) |
| No Web Share | Download button only (no share sheet) |
| Low memory (<3GB) | Limit to 5 clips, reduce working resolution to 1440px |

---

## 10. Security & Privacy

| Concern | Mitigation |
|---------|-----------|
| Image privacy | All processing client-side; images never uploaded |
| XSS via file names | Sanitize all user-provided strings before rendering |
| Memory exhaustion | Limit project to 20 clips; revoke unused blob URLs |
| COOP/COEP headers | Only required for ffmpeg.wasm multi-threaded; graceful fallback |
| Service Worker | Cache app shell for offline; never cache user content |
| Third-party deps | Audit via `pnpm audit`; pin versions in lockfile |

---

## 11. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial load (LCP) | < 2s on 4G | Lighthouse mobile |
| Time to interactive | < 3s on 4G | Lighthouse mobile |
| Preview framerate | 60fps | DevTools Performance |
| Export speed | ≥ real-time (30fps encode) | Wall clock vs video duration |
| Memory (10 clips editing) | < 150MB | DevTools Memory |
| Memory (10 clips exporting) | < 250MB | DevTools Memory |
| Bundle (initial) | < 300KB gzipped | Build output |
| Bundle (with export libs) | < 500KB gzipped | After lazy load |

---

## 12. Output Specifications

### Instagram Reels

| Parameter | Value |
|-----------|-------|
| Resolution | 1080 × 1920 (9:16) |
| Frame rate | 30 fps |
| Video codec | H.264 (AVC) High Profile |
| Video bitrate | 5–10 Mbps |
| Audio codec | AAC-LC |
| Audio sample rate | 44100 Hz |
| Audio channels | Stereo (2) |
| Audio bitrate | 128 kbps |
| Duration | 15–90 seconds |
| Container | MP4 |

### Additional Supported Ratios

| Ratio | Resolution | Use Case |
|-------|-----------|----------|
| 9:16 | 1080 × 1920 | Instagram/TikTok Reels (default) |
| 1:1 | 1080 × 1080 | Instagram posts |
| 4:5 | 1080 × 1350 | Instagram portrait posts |
| 16:9 | 1920 × 1080 | YouTube, landscape |
