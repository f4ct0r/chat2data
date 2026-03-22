# Repository Guidelines

## Project Structure & Module Organization

This repository is currently spec-first. Product and design docs live under `docs/superpowers/specs/`. When implementation starts, keep the Electron app code separated by responsibility:

- `src/main/` for the Electron main process and app lifecycle
- `src/renderer/` for the UI layer
- `src/core/` for database access, query execution, and agent logic
- `src/shared/` for types, constants, and helpers
- `tests/` or `src/**/__tests__/` for automated tests
- `assets/` for icons, images, and packaged resources

Keep one database adapter per file, for example `src/core/db/adapters/mysql.ts`.

## Build, Test, and Development Commands

No build pipeline is committed yet. When the app is scaffolded, standard scripts should be exposed in `package.json`:

- `npm install` to install dependencies
- `npm run dev` to launch the desktop app locally
- `npm test` to run the test suite
- `npm run build` to produce production bundles

If you add or rename scripts, document them in `README.md`.

## Coding Style & Naming Conventions

Use TypeScript, 2-space indentation, and small modules with clear boundaries. Prefer `camelCase` for variables and functions, `PascalCase` for React components and classes, and `kebab-case` for filenames, except component files. Keep renderer code free of direct Node access; expose native capabilities through preload APIs.

## Testing Guidelines

Add unit tests for core logic such as SQL classification, query execution normalization, and agent safety checks. Keep tests close to the code they cover. Name test files after the unit under test, such as `query-executor.test.ts` or `sql-rules.test.ts`.

## Commit & Pull Request Guidelines

Use short, imperative commit messages, optionally prefixed by type, for example `feat: add connection manager` or `docs: update design spec`. Pull requests should include a clear summary, scope, testing notes, and screenshots or recordings for UI changes. Call out any database or security implications explicitly.

## Security & Configuration Tips

Never commit real database credentials. Store secrets locally and encrypted, keep plaintext passwords out of the renderer, and avoid logging sensitive SQL or connection strings unless strictly necessary for debugging.
