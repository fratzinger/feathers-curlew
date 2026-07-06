# Configuration

There are two places to configure curlew, merged together (config file wins, then plugin, then defaults;
`commands` from both are unioned and de-duplicated by name):

1. **The plugin** — `app.configure(curlew(options))`. Best for app-coupled custom commands, versioned with
   your server.
2. **`curlew.config.ts`** — CLI-side wiring (app factory, remote settings, defaults), loaded by the
   binary.

## Plugin & shared options (`CurlewOptions`)

Valid in both the plugin and the config file.

| Option        | Type                            | Default            | Description                                                      |
| ------------- | ------------------------------- | ------------------ | ---------------------------------------------------------------- |
| `permission`  | `'internal' \| 'authenticated'` | `'internal'`       | Default call permission.                                         |
| `userService` | `string`                        | `'users'`          | Service used to resolve `--as`.                                  |
| `authService` | `string`                        | `'authentication'` | Authentication service path.                                     |
| `provider`    | `string`                        | `'curlew'`         | `params.provider` label on authenticated calls.                  |
| `services`    | `string[]`                      | `[]`               | Extra service paths to expose as named commands.                 |
| `commands`    | `CurlewCommand[]`               | `[]`               | Custom commands.                                                 |
| `plugins`     | `CurlewPlugin[]`                | `[]`               | Plugins (env hooks + command bundles). See [Plugins](./plugins). |

## Config-file options (`CurlewConfig`)

Extends `CurlewOptions` with CLI-side settings.

| Option        | Type                        | Default        | Description                                        |
| ------------- | --------------------------- | -------------- | -------------------------------------------------- |
| `createApp`   | `() => App \| Promise<App>` | –              | Factory building the app for in-process mode.      |
| `setup`       | `boolean \| (app) => void`  | `true`         | Run `app.setup()` before a command.                |
| `teardown`    | `boolean \| (app) => void`  | `true`         | Run `app.teardown()` afterwards.                   |
| `remote`      | `RemoteConfig`              | –              | Remote transport settings (see below).             |
| `defaultMode` | `'in-process' \| 'remote'`  | `'in-process'` | Mode when neither `--remote` nor `--url` is given. |

### `RemoteConfig`

| Option      | Type                   | Default   | Description                                |
| ----------- | ---------------------- | --------- | ------------------------------------------ |
| `url`       | `string`               | –         | Server base URL (required for remote).     |
| `transport` | `'rest' \| 'socketio'` | `'rest'`  | Remote transport.                          |
| `services`  | `string[]`             | –         | Service paths to expose as named commands. |
| `strategy`  | `string`               | `'local'` | Default `authenticate` strategy.           |

## CLI flags

**Bin flags** (consumed by the `curlew` binary):

| Flag                           | Description                                |
| ------------------------------ | ------------------------------------------ |
| `--remote` / `--in-process`    | Select the mode.                           |
| `--mode <mode>`                | Same as above, explicit.                   |
| `--url <url>`                  | Remote server URL (implies remote).        |
| `--transport <rest\|socketio>` | Remote transport.                          |
| `--cwd <dir>`                  | Directory to load `curlew.config.ts` from. |

**Common command flags** (on every data command):

| Flag                   | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `--pretty`             | Indent the JSON output.                                              |
| `--query <json>`, `-q` | Feathers query as JSON (base for the shortcuts below).               |
| `--select <fields>`    | Fields to return ($select), e.g. `id,email`.                         |
| `--sort <spec>`        | Sort ($sort), e.g. `name:desc,age` or `-createdAt`.                  |
| `--skip <n>`           | Offset ($skip).                                                      |
| `--limit <n>`          | Max results ($limit).                                                |
| `--data <json>`, `-d`  | Body for `create`/`update`/`patch`/custom methods.                   |
| `--internal`           | Force an internal, full-access call.                                 |
| `--as <userId>`        | Run as a user (in-process).                                          |
| `--token <jwt>`        | Authenticate the call with a JWT.                                    |
| `--params <json>`      | Extra Feathers params, in-process only (merged; curlew's flags win). |

`--data` and `--query` also accept `@file.json` (read from a file) and `-` (read from stdin).

### Commands per service

Each service exposes `find`, `get <id>`, `create`, `update <id>`, `patch <id>`, `remove <id>`, plus the
shorthands `findOne` (one record or `null`), `exists [id]` (`{ exists }`, no 404 error), `count`
(a bare number) and `findAll` (disables pagination). Bulk `patch`/`remove` use the literal id `null` on
`multi` services. Feathers **custom methods** are reachable through `service <path> <method>`.

**Ids:** numeric-looking ids become numbers, the literal `null` triggers a bulk op, and everything else
(UUIDs, string ids) passes through unchanged. Dotted query keys (e.g. `{"project.name":"…"}`) are passed
to the adapter verbatim, so feathers-kysely-style relation queries work as-is.

### Top-level commands

`authenticate`, `whoami` (resolve the current user), `logout` (clear the stored remote session),
`services` (list services), `describe <path>` (methods a service supports), `service <path> <method>`,
`waitUntil <service> [event]` (in-process; block until a matching event fires), and
`instructions [--format agents|skill]` (generate agent-ready docs for this app).

## Programmatic API

The package's exports, for embedding or advanced use:

- `curlew(options)` — the Feathers plugin (`app.configure`).
- `runCurlew(appOrClient, opts)` — run a command; resolves to the exit code (never calls `process.exit`).
- `defineCurlewConfig` / `defineCurlewCommand` / `defineCurlewPlugin` — typed identity helpers.
- `loadCurlewConfig(cwd?)` — load `curlew.config.ts` (via c12).
- `createInProcessClient(app, options)` / `createRemoteClient(remote, options)` — build a `CurlewClient` directly.
- `waitForEvent(app, service, options)` — the `waitUntil` primitive.
- `CurlewError` — error type with a `.code`.
