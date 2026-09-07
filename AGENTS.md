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
- `commands/*` — one file per command group (no barrel; `cli/build-cli.ts` assembles them).
  The grammar is **verb-first**: `curlew <method> <service> [id]`. The service is an argument, so the
  command tree is static — no introspection to build it, and any path works (nested, hyphenated, or a
  name that is also a curlew command).
  The shared pieces are `commands/common-args.ts` (`commonArgs`, `ServiceMethod`) and
  `commands/call-from-args.ts` (args → `CallContext`).
- A command with parts of its own gets a folder, with its tests inside. `index.ts` is the entry
  (a barrel, or the command itself when there is nothing to split), so the import sites don't change:
  - `commands/method/` — the ten verb commands (`find`, `findOne`, `findAll`, `count`, `exists`, `get`,
    `create`, `update`, `patch`, `remove`), all built from one factory; `method-args.ts` gives each its
    positionals (service first, then id), `write-guard.ts` holds `--dry-run` + `confirmBulk`, and
    `stream-all.ts` pages through for `findAll --ndjson`.
  - `commands/watch/` — `watch <service> [event]`, the streaming counterpart to `waitUntil`.
  - `commands/call/` — `call <service> <method> [id]`, the escape hatch for Feathers custom methods.
  - `commands/dispatch/` — routes a `(service, method, id?, data?)` tuple to a client call, incl. the
    `findOne`/`count`/`exists`/`findAll` shorthands and the bulk `null` id. Not a command itself, but
    the layer the verb commands sit on, so its tests (`read-shortcuts`, `multi`) live here.
  - `commands/instructions/` — `render.ts` (the agent-facing body + skill frontmatter) and
    `managed-block.ts` (the idempotent marker block for `--out`).
  - `commands/authenticate/`, `commands/services/` — single-file commands in `index.ts`.
- `utils/*` — one pure helper per file, each with its tests **in-source** (`import.meta.vitest`):
  `coerce-id`, `parse-json`, `parse-sort`, `to-number`, `build-query`, `extract-total`, `first-of`,
  `is-not-found`, `jwt-expires-at`.
- `params/` — `buildParams` in `index.ts` (permission matrix, `--as`/`--token`/`--internal`) and
  `resolve-acting-user.ts` (`--as`, via the optional `resolveUser` hook, plus the
  `E_AS_LOOKS_LIKE_JWT` guardrail). Id coercion lives in `utils/coerce-id.ts`.
- `impersonate/` — `mintAccessToken`: signs a JWT via the app's own `AuthenticationService`
  (`getPayload` + `getTokenOptions` + `createAccessToken`). Gated by the `impersonate` option; its
  tests cover the mint, while `commands/authenticate/` covers the gate and the flag plumbing.
- `plugins.ts` — the plugin system (`env` hook + command bundles).
- `wait/` — `waitForEvent` (`wait-for-event.ts`), `watchEvents` (`watch-events.ts`, the streaming
  variant) and `matcher.ts` (`toMatcher`: strips pagination keys, then builds a predicate via the
  `matcher` option — `sift` by default, same factory shape as `@feathersjs/memory`).
- `cli/` — `bin.ts` is the `curlew` executable (shebang; loads config, runs plugin `env` hooks, builds
  the client, calls `runCurlew`), `bin-flags.ts` peels curlew's own transport flags off argv, and
  `build-cli.ts` (`buildCli`) assembles the citty command tree from `commands/*`.
- `output/` — `writeResult`/`writeRaw`/`writeError`/`makeOutput` in `index.ts`, `ndjson.ts` for
  `rowsOf` + `writeNdjson` (`--ndjson`).
- `errors.ts`, `session.ts`.

## Conventions

- **ESM-only.** No CJS. `type: module`; tsdown `format: ['esm']` → `.mjs` + `.d.mts`.
- **Don't hand-format** — Prettier (single quotes, no semicolons) is enforced via the eslint plugin; run `lint:fix`.
- Public helpers are `defineCurlew*` (`Config`/`Command`/`Plugin`). The custom-command helper is
  `defineCurlewCommand` — NOT citty's `defineCommand`.
- Internal imports are extensionless (everything is bundled).
- **Tests live next to the code** they cover, in one of two shapes. Pure helpers in `src/utils` keep
  them **in-source** — `if (import.meta.vitest) { const { describe, expect, it } = import.meta.vitest … }`
  — with any test-only dependency pulled in _inside_ the block (`await import('@feathersjs/errors')`)
  so it never becomes a runtime import. Everything else uses a colocated file
  (`src/commands/call-from-args.ts` → `src/commands/call-from-args.test.ts`, or `index.ts` +
  `<name>.test.ts` inside a command folder), because citty/app fixtures don't
  belong in production modules. `test/*.test.ts` holds the older cross-cutting suites. Vitest picks up
  all three (`include` + `includeSource` in `vitest.config.ts`).
  Shared test utilities stay in `test/helpers.ts`: `capture()` (stdout/stderr), `resolvedOptions()`,
  `fakeClient()` (a `CurlewClient` stub whose unstubbed methods throw). Unit tests run a single command
  via citty's `runCommand` against a `fakeClient`; integration tests drive `runCurlew` end-to-end against
  a real in-memory app. Add tests for new behavior.
- Two config surfaces (plugin options + `curlew.config.ts`) are merged with defu; `commands`/`plugins`
  arrays are unioned then deduped by name (config-file wins).

## Keeping code & docs in sync

The guides, the configuration reference and the `instructions` output are hand-written. When you add or
change a command, flag, config option or export, update them in the same change so they don't drift.

## Gotchas

- Every new `CurlewOptions` property needs a line in `pickOptions` (`options.ts`) — it copies only
  the keys it lists, so a missing line makes the option silently never arrive. `test/helpers.ts`
  spreads `DEFAULT_OPTIONS`, so a new _required_ `ResolvedOptions` field surfaces in typecheck.
- **Tests import the package by name (`from 'feathers-curlew'`)**, aliased to `src/index.ts` in
  `vitest.config.ts` and `tsconfig.json` `paths`. Never import the repo root by relative path
  (`'../../..'`): that resolves through `package.json` to `dist/`, so the test silently checks the last
  build instead of the sources — and stays green while it does.
- **A `paginate: false` service returns a bare array with no `total`**, so `$limit: 0` looks like "no
  matches". `dispatch/count-matching.ts` detects that and re-counts unpaginated; `count`, `exists` and
  `--dry-run` all go through it. Don't count from `extractTotal` alone.
- **`src/cli/bin.ts` resolves `../package.json` relative to the BUNDLE (`dist/cli.mjs`)**, not to its
  own source path. Moving the file must NOT change that string; renaming the tsdown `cli` entry key
  would. Nothing in the test suite loads the built bin, so a wrong path only shows up at runtime —
  check with `node dist/cli.mjs --version` after touching it.
- **In-source tests are stripped by `define: { 'import.meta.vitest': 'undefined' }`** in
  `tsdown.config.ts` — without it the test blocks (and their imports) would ship in `dist/`. After
  touching that config, check with `grep -c 'describe(' dist/*.mjs` (must be 0).
  `tsconfig.json` needs `vitest/importMeta` in `types` for `import.meta.vitest` to typecheck.
- **c12 is pinned to `^3`** — its `latest` tag is a 4.0 beta.
- **`typescript` is pinned to `^6`** — `typescript-eslint@8` (via `@feathers-community/eslint-config`)
  can't read TS 7's API, so `pnpm lint` dies with `Cannot read properties of undefined (reading 'Cjs')`.
  Typecheck, test and build are all fine on TS 7; only lint is not. Bump only once the config ships a
  typescript-eslint that supports TS 7.
- **`sift`** is a direct dependency (not hoisted under pnpm) and powers `waitUntil` event matching.
- `getServiceOptions(service).methods` (`@feathersjs/feathers`, imported **lazily** for CJS/ESM interop)
  now only feeds `describe`/`instructions` — it no longer shapes the command tree. A method the service
  object has but doesn't expose externally **is** callable (curlew calls are internal); a genuinely
  absent one fails with `E_UNKNOWN_METHOD` from the in-process client.
- **`env`-before-`createApp`:** plugin `env` hooks run in the bin before `createApp`; for the values to
  reach the app, `createApp` must import the app **lazily** (`async () => (await import('./app')).createApp()`).
- Native postinstalls (`esbuild`, `unrs-resolver`) are approved in `pnpm-workspace.yaml` (`allowBuilds`).
- `docs/.vitepress/**` and `eslint.config.mjs` are eslint-ignored (not in the tsconfig project used for
  type-aware linting).
- Feathers `Params` has no `authenticated`/`authentication` types → the auth branches in `params.ts` cast
  through `unknown`.
- The literal id `null` (`patch null` / `remove null`) maps to JS `null` for Feathers bulk ops; numeric-
  looking ids become numbers; UUIDs/strings pass through (`coerceId`).
