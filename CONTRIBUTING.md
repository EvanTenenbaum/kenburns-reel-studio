# Contributing to Ken Burns Reel Studio

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code, always deployable |
| `feat/<name>` | New feature development |
| `fix/<name>` | Bug fixes |
| `refactor/<name>` | Code restructuring without behavior change |
| `docs/<name>` | Documentation updates |

## Workflow

1. Check `TODO.md` for the highest-priority unclaimed task.
2. Create a branch from `main` following the naming convention above.
3. Implement the feature following all rules in `AGENTS.md` Section 8.
4. Ensure `pnpm check` passes with zero errors.
5. Ensure `pnpm test` passes (if tests exist for the module).
6. Run `pnpm format` to auto-format all files.
7. Update `TODO.md` to mark the task as `[x]` complete.
8. Write a clear PR description referencing the TODO item.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `style`

**Scopes:** `engine`, `timeline`, `preview`, `export`, `audio`, `ui`, `store`, `types`, `deps`, `gestures`

**Examples:**
```
feat(engine): implement cubic bezier easing function
fix(preview): clamp viewport to prevent showing image edges
refactor(store): split project store into separate clip/audio stores
docs(agents): add export pipeline sequence diagram
test(engine): add unit tests for viewport interpolation
perf(export): use OffscreenCanvas in worker for frame rendering
```

## Code Review Checklist

Before merging, verify:

- [ ] TypeScript strict mode passes (`pnpm check`)
- [ ] No `any` types introduced
- [ ] Engine code has zero React/DOM imports
- [ ] Components use hooks (not direct store/engine access)
- [ ] Mobile touch targets are at least 44×44px
- [ ] New features work at 375px viewport width
- [ ] Animations only use `transform` and `opacity`
- [ ] Blob URLs are revoked when no longer needed
- [ ] No console.log statements left in production code

## File Size Guidelines

| File Type | Max Lines | Action if Exceeded |
|-----------|-----------|-------------------|
| Component | 200 | Split into sub-components |
| Hook | 150 | Extract logic to engine/lib |
| Engine module | 300 | Split by responsibility |
| Store | 100 | Split into domain stores |
| Test file | 300 | Split by test suite |

## Testing Standards

- **Engine code**: Must have unit tests (pure functions are easy to test)
- **Hooks**: Test with `@testing-library/react-hooks` when complex
- **Components**: Visual testing via Storybook (stretch goal) or manual verification
- **Integration**: Test export pipeline end-to-end with a small project fixture

## Performance Budgets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Preview frame rate | 60fps on iPhone 12+ |
| Export speed | > 2× realtime (30s video in < 15s) |
| Bundle size (initial) | < 300KB gzipped |
| Mediabunny (lazy) | Loaded only on export |
| ffmpeg.wasm (lazy) | Loaded only as last resort (<7% of browsers) |
