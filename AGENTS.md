# dsh-lit-search

Academic literature search, citation and BibTeX tools for DeepSeek Harness and any agent (Crossref + OpenAlex).

## Environment Note: pnpm precheck is broken on this machine

The local pnpm 10 install fails with `ERR_PNPM_IGNORED_BUILDS` (esbuild postinstall)
and exits with code 1 on `pnpm install` / `pnpm test` / `pnpm vitest`, because pnpm's
deps-status precheck re-runs install before scripts. **Do not use `pnpm test`.**
Call the binaries in `node_modules/.bin` directly instead:

- Test: `./node_modules/.bin/vitest run`
- Build: `./node_modules/.bin/tsdown`

`pnpm-workspace.yaml` exists solely to declare `onlyBuiltDependencies: [esbuild]`,
explicitly approving esbuild's build script (it is harmless: the platform binary
`@esbuild/win32-x64` is already present under `.pnpm`, so vitest/tsdown work without
the postinstall anyway). Keep the file to only that key — no other config belongs there.

## Commands

- Test: `./node_modules/.bin/vitest run`
- Typecheck: `./node_modules/.bin/tsc --noEmit`
- Build: `./node_modules/.bin/tsdown`

## Conventions

- `core/` is pure TS business logic with zero dsh dependencies; `cli.ts` / `plugin.ts` are thin shells.
- All core functions return `Result<T>` (see `src/core/types.ts`); never throw raw exceptions to the plugin layer.
- All HTTP goes through `src/core/http.ts` (10s timeout, 1 retry on 5xx/network errors, UA with mailto).
- Tests use vitest with all HTTP mocked; never hit real APIs.
- `dist/` is intentionally NOT gitignored — build and commit before publishing so git installs work without a build step.
