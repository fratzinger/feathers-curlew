# Configuration

There are two places to configure curlew, merged together (config file wins, then plugin, then defaults;
`commands` from both are unioned and de-duplicated by name):

1. **The plugin** — `app.configure(curlew(options))`. Best for app-coupled custom commands, versioned with
   your server.
2. **`curlew.config.ts`** — CLI-side wiring (app factory, remote settings, defaults), loaded by the
   binary.

## Plugin & shared options (`CurlewOptions`)

Valid in both the plugin and the config file.

| Option        | Type                            | Default            | Description                                                                                                |
| ------------- | ------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `permission`  | `'internal' \| 'authenticated'` | `'internal'`       | Default call permission.                                                                                   |
| `userService` | `string`                        | `'users'`          | Service used to resolve `--as`.                                                                            |
| `resolveUser` | `(ctx) => user \| id`           | –                  | Custom `--as` lookup. See [Permissions](./permissions#resolving-as).                                       |
| `impersonate` | `boolean \| (ctx) => string`    | `false`            | Allow `authenticate --as` to mint a JWT. See [Permissions](./permissions#minting-a-token-authenticate-as). |
| `confirmBulk` | `boolean`                       | `false`            | Require `--yes` for `patch`/`remove` with the id `null`. See [Permissions](./permissions#bulk-writes).     |
| `matcher`     | `(query) => (data) => boolean`  | `sift`             | How `waitUntil`/`watch` match events. See [In-Process](./in-process#custom-event-matching).                |
| `authService` | `string`                        | `'authentication'` | Authentication service path.                                                                               |
| `provider`    | `string`                        | `'curlew'`         | `params.provider` label on authenticated calls.                                                            |
| `services`    | `string[]`                      | `[]`               | Known service paths, for `services`/`instructions` when they can't be discovered.                          |
| `commands`    | `CurlewCommand[]`               | `[]`               | Custom commands.                                                                                           |
| `plugins`     | `CurlewPlugin[]`                | `[]`               | Plugins (env hooks + command bundles). See [Plugins](./plugins).                                           |

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

| Option      | Type                   | Default   | Description                                       |
| ----------- | ---------------------- | --------- | ------------------------------------------------- |
| `url`       | `string`               | –         | Server base URL (required for remote).            |
| `transport` | `'rest' \| 'socketio'` | `'rest'`  | Remote transport.                                 |
| `services`  | `string[]`             | –         | Known service paths (remote can't discover them). |
| `strategy`  | `string`               | `'local'` | Default `authenticate` strategy.                  |

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
| `--as <user>`          | Run as a user (in-process; see `resolveUser`).                       |
| `--token <jwt>`        | Authenticate the call with a JWT.                                    |
| `--params <json>`      | Extra Feathers params, in-process only (merged; curlew's flags win). |
| `--ndjson`             | Stream results as newline-delimited JSON, one record per line.       |
| `--dry-run`            | On a write: report `{ wouldAffect, sample }` and change nothing.     |
| `--yes`, `-y`          | Confirm a bulk write when `confirmBulk` is on.                       |

`--data` and `--query` also accept `@file.json` (read from a file) and `-` (read from stdin).

### Method commands

The verb comes first and the service path is its argument: `find <service>`, `get <service> <id>`,
`create <service>`, `update <service> <id>`, `patch <service> <id>`, `remove <service> <id>`, plus the
shorthands `findOne` (one record or `null`), `exists [id]` (`{ exists }`, no 404 error), `count`
(a bare number) and `findAll` (disables pagination). Bulk `patch`/`remove` use the literal id `null` on
`multi` services. Feathers **custom methods** are reachable through `call <service> <method>`.

```bash
# Read shortcuts
npx curlew findOne users --query '{"email":"a@b.c"}'  # one record, or null
npx curlew exists users 42                            # → { "exists": true } (no 404 error)
npx curlew count users --query '{"active":true}'      # → 12
npx curlew findAll users                              # ignore pagination, return all

# Feathers custom methods: call <service> <method>
npx curlew call messages markRead --data '{"id":42}'

# Bulk patch/remove on `multi` services — use the literal id `null`
npx curlew patch users null --data '{"active":false}' --query '{"pending":true}'
npx curlew remove users null --query '{"expired":true}'

# Preview any write first — reports what it would hit, changes nothing
npx curlew remove users null --query '{"expired":true}' --dry-run
# {"dryRun":true,"method":"remove","service":"users","wouldAffect":412,"sample":[…]}
```

Short flags: `-q` = `--query`, `-d` = `--data`, `-y` = `--yes`. Multi `create` takes a JSON array
(`--data '[{…},{…}]'`).

::: warning Bulk writes hit everything
`patch`/`remove` with the id `null` change **every matching record**, and calls are internal by default.
Run `--dry-run` first, and set `confirmBulk: true` to make `--yes` mandatory — see
[Permissions](./permissions#bulk-writes).
:::

Because the service is an argument rather than a command, **any** path works — nested
(`curlew find api/v1/users`), hyphenated, or a name that is also a curlew command
(`curlew find services`).

**Ids:** numeric-looking ids become numbers, the literal `null` triggers a bulk op, and everything else
(UUIDs, string ids) passes through unchanged. Dotted query keys (e.g. `{"project.name":"…"}`) are passed
to the adapter verbatim, so feathers-kysely-style relation queries work as-is.

### Top-level commands

`find`/`findOne`/`findAll`/`count`/`exists`/`get`/`create`/`update`/`patch`/`remove` (see above),
`call <path> <method>` (any method, incl. custom ones),
`watch <service> [event]` (stream events as NDJSON, in-process),
`authenticate` (log in, or mint a token with `--as`), `whoami` (resolve the current user),
`logout` (clear the stored remote session),
`services` (list services), `describe <path>` (methods a service supports),
`waitUntil <service> [event]` (in-process; block until a matching event fires), and
`instructions [--format agents|skill]` (generate agent-ready docs for this app).

```bash
npx curlew services                   # service paths curlew knows about
npx curlew describe messages          # methods a service supports (incl. custom)
npx curlew whoami --token "$JWT"      # resolve the current user
npx curlew watch orders created       # stream events as NDJSON (in-process)
npx curlew --remote logout            # forget the stored remote session
```

## Programmatic API

The package's exports, for embedding or advanced use:

- `curlew(options)` — the Feathers plugin (`app.configure`).
- `runCurlew(appOrClient, opts)` — run a command; resolves to the exit code (never calls `process.exit`).
- `defineCurlewConfig` / `defineCurlewCommand` / `defineCurlewPlugin` — typed identity helpers.
- `loadCurlewConfig(cwd?)` — load `curlew.config.ts` (via c12).
- `createInProcessClient(app, options)` / `createRemoteClient(remote, options)` — build a `CurlewClient` directly.
- `waitForEvent(app, service, options)` — the `waitUntil` primitive.
- `CurlewError` — error type with a `.code`.
