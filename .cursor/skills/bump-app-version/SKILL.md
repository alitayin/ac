---
name: bump-app-version
description: Bumps the application semver (e.g. 3.7.0 → 3.7.1), keeps package.json, package-lock.json, and any mirrored version files in sync. Use when the user asks to release, bump version, patch/minor/major, or update the app version everywhere.
---

# Bump application version

## Goal

Move the project to the next **semver** and ensure **every app-level copy** of that string matches. Do **not** change dependency versions inside `package-lock.json` except the **root** package entries.

## 1. Choose bump type

| User intent | NPM flag |
|-------------|----------|
| 3.7.0 → 3.7.1 | `patch` |
| 3.7.0 → 3.8.0 | `minor` |
| 3.7.0 → 4.0.0 | `major` |

If the user gives an **exact target** (e.g. `3.8.2`), compute whether it is patch/minor/major from the current version, or edit files directly to that string after updating `package.json`.

## 2. Preferred: npm (updates package + lock root)

From the repository root:

```bash
npm version patch --no-git-tag-version
```

Use `minor` or `major` instead of `patch` when appropriate. This updates:

- `package.json` → `"version"`
- `package-lock.json` → root `"version"` and root `"packages"."".version"` (npm 7+)

**Do not** hand-edit hundreds of lines in `package-lock.json`; let `npm version` handle the root.

## 3. Sync non-npm mirrors

After the new version is known, search for the **previous** version string in project-owned files (exclude `node_modules`):

```bash
rg --glob '!node_modules' 'OLD_VERSION' .
```

Update any intentional duplicates, for example:

- **`version.json`** — `{ "version": "x.y.z" }` if the app imports it for UI (e.g. header badge)
- **`CHANGELOG.md`** / release notes if the project maintains them
- **Docker tags**, **CI env defaults**, **README** “current version” lines — only if present

**Never** replace version strings that belong to **dependencies** (e.g. `"next": "14.x"`).

Rule of thumb: only touch files where the old app version appears as the **project’s own** version (same string as `package.json` before the bump).

## 4. This repo (agoracash)

- `package.json` — canonical npm version
- `version.json` — must match `package.json`; imported as `@/version.json` for the header UI
- After `npm version patch`, set `version.json` to the same `"version"` value if it still shows the old number

## 5. Verify

- `rg --glob '!node_modules' '"OLD_VERSION"'` → should be empty for app version (or only historical changelog text you intentionally kept)
- `node -p "require('./package.json').version"` matches `version.json` when applicable
- Run `npm run build` if the user cares about release readiness

## Anti-patterns

- Replacing every `3.7.0` in the repo — will break unrelated data or dependency metadata
- Editing only `package.json` and forgetting `version.json` when both exist
- Expecting `package-lock.json` to be updated without running `npm version` or `npm install` after a manual `package.json` edit
