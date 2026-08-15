# Agent Instructions

## Build Hygiene

- `pnpm build` runs `pnpm prebuild` first. The prebuild step removes only the generated `.next` directory and `tsconfig.tsbuildinfo` file.
- Do not run a production build while `pnpm dev` is using the same workspace. Stop or restart the dev server after a build so it does not serve a partial or stale `.next` output.
- If the browser shows an unstyled or partial page after a build, stop the dev server, run `pnpm clean:build`, then start `pnpm dev` again.
- Never delete source files, dependencies, or user data as part of build cleanup.
