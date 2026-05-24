# Aider Conventions — Ken Burns Reel Studio

Read `AGENTS.md` at the project root for complete context.

## Key Points

- Mobile-first web app for creating Instagram Reels from still images using Ken Burns effects
- Tech: React 19 + TypeScript strict + Vite 7 + Tailwind 4 + Zustand + zundo + Dexie + Mediabunny
- Engine code (`client/src/engine/`) = pure computation, NO React/DOM
- Components access engine/store ONLY through hooks
- Video export via Mediabunny CanvasSource (successor to deprecated mp4-muxer)
- All user actions modifying project state must be undoable (zundo middleware)
- 44px minimum touch targets, test at 375px width
- Only animate `transform` and `opacity`
- Conventional commits: `feat(scope): description`
- Check TODO.md for current priorities
