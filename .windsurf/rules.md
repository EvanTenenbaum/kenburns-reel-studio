# Windsurf Rules — Ken Burns Reel Studio

Read `AGENTS.md` at the project root for complete context, architecture, data model, and coding standards.

## Quick Rules

1. Engine code (`client/src/engine/`) has ZERO React/DOM dependencies
2. Components access engine/store only through hooks
3. TypeScript strict mode — no `any` types
4. Mobile-first: 44px min touch targets, test at 375px width
5. Only animate `transform` and `opacity`
6. All project-modifying actions must be undoable (zundo)
7. Use `@/` path alias for imports
8. Conventional commits: `feat(scope): description`
9. Lazy-load heavy deps: Mediabunny (export), ffmpeg.wasm (fallback), WaveSurfer (audio)
10. Video export uses Mediabunny CanvasSource (NOT mp4-muxer which is deprecated)
