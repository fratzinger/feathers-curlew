# AGENTS.md

Guidance for AI agents and contributors working **on** feathers-curlew — an ESM-only CLI toolkit that
drives a FeathersJS v5 server (in-process or remote), built to be AI-friendly (JSON out, structured
errors, exit codes). User-facing docs live in `docs/` and `README.md`; this file is about the codebase.

## Commands

- `pnpm build` — bundle with tsdown → `dist/*.mjs` (ESM-only)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — vitest (builds real `feathers()` apps with `@feathersjs/memory`)
- `pnpm lint` / `pnpm lint:fix` — eslint (`@feathers-community/eslint-config`, runs Prettier as a rule)
- `pnpm format` / `pnpm format:check` — Prettier (single quotes, no semicolons)
- `pnpm docs:dev` / `pnpm docs:build` — VitePress

Before finishing a change, all of these must pass: **typecheck · lint · format:check · test · build**
(and `pnpm exec publint` for packaging). CI runs the same in `.github/workflows/ci.yml`.

## Architecture (`src/`)

- `plugin.ts` — `curlew()` feathers plugin; `app.configure(curlew(opts))` stashes opts on the app.
- `config.ts` — `defineCurlewConfig` + `loadCurlewConfig` (c12).
- `runner.ts` — `runCurlew(appOrClient, opts)`: resolves options (defu), builds the citty tree, runs
  `runCommand` in try/finally, owns app setup/teardown, **returns an exit code** (never calls `process.exit`).
- `client/{in-process,remote}.ts` — the two `CurlewClient` transports (interface in `types.ts`).
- `commands/*` — one file per command group; `commands/index.ts` `buildCli(ctx)` assembles the tree;
  `commands/shared.ts` holds `commonArgs`, `dispatch` (routes methods + shorthands), and query building.
- `params.ts` — turns flags into Feathers `params` (permission matrix, `--as`/`--token`/`--internal`).
- `plugins.ts` — the plugin system (`env` hook + command bundles).
- `wait.ts` — `waitForEvent` (sift matching against emitted events).
- `cli.ts` — the `curlew` bin (shebang; loads config, runs plugin `env` hooks, builds the client, calls runCurlew).
- `output.ts`, `errors.ts`, `session.ts`.

## Conventions

- **ESM-only.** No CJS. `type: module`; tsdown `format: ['esm']` → `.mjs` + `.d.mts`.
- **Don't hand-format** — Prettier (single quotes, no semicolons) is enforced via the eslint plugin; run `lint:fix`.
- Public helpers are `defineCurlew*` (`Config`/`Command`/`Plugin`). The custom-command helper is
  `defineCurlewCommand` — NOT citty's `defineCommand`.
- Internal imports are extensionless (everything is bundled).
- Tests drive `runCurlew` end-to-end against a real in-memory app and capture stdout/stderr via
  `test/helpers.ts` (`capture()`). Add tests for new behavior.
- Two config surfaces (plugin options + `curlew.config.ts`) are merged with defu; `commands`/`plugins`
  arrays are unioned then deduped by name (config-file wins).

## Gotchas

- **c12 is pinned to `^3`** — its `latest` tag is a 4.0 beta.
- **`sift`** is a direct dependency (not hoisted under pnpm) and powers `waitUntil` event matching.
- Per-service commands are generated from **`getServiceOptions(service).methods`** (`@feathersjs/feathers`),
  imported **lazily** because of CJS/ESM interop.
- **`env`-before-`createApp`:** plugin `env` hooks run in the bin before `createApp`; for the values to
  reach the app, `createApp` must import the app **lazily** (`async () => (await import('./app')).createApp()`).
- Native postinstalls (`esbuild`, `unrs-resolver`) are approved in `pnpm-workspace.yaml` (`allowBuilds`).
- `docs/.vitepress/**` and `eslint.config.mjs` are eslint-ignored (not in the tsconfig project used for
  type-aware linting).
- Feathers `Params` has no `authenticated`/`authentication` types → the auth branches in `params.ts` cast
  through `unknown`.
- The literal id `null` (`patch null` / `remove null`) maps to JS `null` for Feathers bulk ops; numeric-
  looking ids become numbers; UUIDs/strings pass through (`coerceId`).
