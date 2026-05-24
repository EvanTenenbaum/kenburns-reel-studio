# Vercel Deployment Notes

This repository is configured for deployment to [Vercel](https://vercel.com/) as a **Vite-powered React single-page application**. Vercel supports repository-level project configuration through `vercel.json`, including build commands, install commands, output directories, and routing rewrites.[^1] Vercel’s Vite documentation also notes that SPA deep links require a rewrite to `/index.html`, which is why this repository includes a catch-all rewrite.[^2]

> Vercel states that file-based configuration “lives in your repository and gets version-controlled with your code,” which makes `vercel.json` the appropriate place to store reproducible deployment settings for future agents and maintainers.[^1]

| Setting | Repository Value | Purpose |
|---|---:|---|
| Framework preset | `vite` | Tells Vercel to treat the project as a Vite frontend application. |
| Install command | `pnpm install --frozen-lockfile` | Ensures installs use the committed `pnpm-lock.yaml` without silently changing dependencies. |
| Build command | `pnpm build` | Runs the existing project build pipeline, which builds the Vite client and bundles the placeholder server. |
| Output directory | `dist/public` | Matches `vite.config.ts`, where Vite writes production static assets. |
| SPA routing | `/(.*)` → `/index.html` | Allows direct navigation and refreshes on client-side routes. |

## Local Verification

Run the following commands from the repository root before deploying changes.

```bash
pnpm install --frozen-lockfile
pnpm build
```

The build has been verified locally in the Manus sandbox. The production assets are emitted to `dist/public`, and the project currently builds without errors.

## Initial Vercel Setup

The project can be imported from GitHub in the Vercel dashboard or linked through the Vercel CLI once an authenticated Vercel session or token is available. Use these settings if Vercel does not auto-detect them from `vercel.json`.

| Vercel Field | Value |
|---|---:|
| Repository | `EvanTenenbaum/kenburns-reel-studio` |
| Framework Preset | `Vite` |
| Root Directory | repository root |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | `dist/public` |

No application-specific environment variables are required for the current client-side deployment. If future work adds server-side APIs, background jobs, or third-party integrations, document the required Vercel environment variables in this file and configure them in the Vercel project dashboard.

## References

[^1]: [Vercel Docs — Project Configuration](https://vercel.com/docs/project-configuration)
[^2]: [Vercel Docs — Vite on Vercel](https://vercel.com/docs/frameworks/vite)
