# Ken Burns Reel Studio

A mobile-first web application for creating Instagram Reels from still images using Ken Burns (pan & zoom) motion effects, with a timeline editor, transitions, and music support.

---

## What It Does

1. **Import photos** from your camera roll or file system
2. **Apply Ken Burns motion** — choose from presets or manually set start/end viewports with pinch-to-zoom and drag
3. **Arrange on a timeline** — reorder clips, adjust durations, add transitions between them
4. **Add music** — import audio, trim it, set volume and fades, see the waveform on the timeline
5. **Export as MP4** — renders a 1080×1920 H.264 video ready for Instagram Reels, directly in the browser

All processing happens **entirely on-device**. No uploads, no servers, no accounts. Your photos never leave your phone.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | Zustand + zundo (undo/redo) |
| Persistence | Dexie.js (IndexedDB) |
| Video Export | Mediabunny (WebCodecs + MP4 muxing) |
| Audio | Web Audio API + WaveSurfer.js |
| Gestures | @use-gesture/react |
| Timeline DnD | dnd-kit |
| Animation | Framer Motion |

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type checking
pnpm check

# Run tests
pnpm test

# Format code
pnpm format
```

Open `http://localhost:3000` on your phone or use Chrome DevTools mobile emulation (375px width).

---

## Project Structure

```
client/src/
├── types/          TypeScript interfaces (project, clip, kenburns, audio, export)
├── engine/         Core computation (NO React dependencies)
├── store/          Zustand state stores with undo/redo
├── hooks/          Custom React hooks (bridge between store/engine and UI)
├── components/     UI components (preview, timeline, controls, music)
├── pages/          Route-level pages (Home, Editor, Export)
├── lib/            Pure utility functions (math, image helpers)
├── constants/      App constants (Instagram specs, motion presets)
└── workers/        Web Worker scripts (export rendering)
```

---

## For AI Agents & Contributors

This repository is structured for immediate agent onboarding:

| Document | Purpose |
|----------|---------|
| [`AGENTS.md`](./AGENTS.md) | Complete project context, data model, algorithms, and coding rules |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Deep technical design (rendering pipeline, export, audio) |
| [`TODO.md`](./TODO.md) | Prioritized task backlog — pick the highest unclaimed task |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Branch strategy, commit conventions, review checklist |
| [`.cursorrules`](./.cursorrules) | Quick reference for Cursor AI |
| [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) | GitHub Copilot context |

**Start here:** Read `AGENTS.md` from top to bottom before writing any code.

---

## Browser Support

| Browser | Video Export | Audio Export |
|---------|-------------|-------------|
| Chrome 94+ / Edge 94+ | H.264 via WebCodecs | AAC |
| Safari 16.4+ (iOS/macOS) | H.264 via WebCodecs | MP3 (polyfill) |
| Firefox 130+ | H.264 via WebCodecs | AAC |
| Samsung Internet 17+ | H.264 via WebCodecs | AAC |
| Older browsers | ffmpeg.wasm fallback | ffmpeg.wasm fallback |

---

## Output Specifications

| Parameter | Default Value |
|-----------|--------------|
| Resolution | 1080 × 1920 (9:16) |
| Frame rate | 30 fps |
| Video codec | H.264 (AVC) |
| Audio codec | AAC-LC (128 kbps) |
| Container | MP4 |
| Duration | 15–90 seconds |

Also supports 1:1, 4:5, and 16:9 aspect ratios.

---

## License

MIT
