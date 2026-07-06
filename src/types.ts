import type { Application } from '@feathersjs/feathers'
import type { ArgsDef, ParsedArgs } from 'citty'

/** How a call is authorized against the Feathers server. */
export type PermissionMode = 'internal' | 'authenticated'

/** Whether curlew talks to the app directly or over the wire. */
export type CurlewMode = 'in-process' | 'remote'

/** Transport used in remote mode. */
export type RemoteTransport = 'rest' | 'socketio'

/**
 * Per-call context derived from the common flags (`--internal`, `--as`,
 * `--token`, `--query`). Turned into Feathers `params` by the active client.
 */
export interface CallContext {
  /** Force an internal (no-provider) call that bypasses auth/authorization. */
  internal?: boolean
  /** Act as the user with this id (loads the user, runs authorization hooks). */
  as?: string
  /** JWT used to authenticate this single call. */
  token?: string
  /** Feathers query object (parsed from `--query <json>`). */
  query?: Record<string, unknown>
  /** Override `params.paginate` (used by the `findAll` shorthand). */
  paginate?: boolean
  /** Arbitrary extra Feathers params (`--params`), merged in-process; curlew's flags win. */
  params?: Record<string, unknown>
}

/** Remote transport configuration (curlew.config.ts `remote` field). */
export interface RemoteConfig {
  url: string
  transport?: RemoteTransport
  /** Service paths to expose as named sub-commands (remote can't auto-discover). */
  services?: string[]
  /** Default authentication strategy for `authenticate`. */
  strategy?: string
}

/** Options accepted by BOTH the `curlew()` plugin and `curlew.config.ts`. */
export interface CurlewOptions {
  /** Default permission mode. @default 'internal' */
  permission?: PermissionMode
  /** Service used to resolve `--as <userId>`. @default 'users' */
  userService?: string
  /** Authentication service path. @default 'authentication' */
  authService?: string
  /** `params.provider` label set on authenticated in-process calls. @default 'curlew' */
  provider?: string
  /** Extra service paths to expose as named sub-commands. */
  services?: string[]
  /** Custom commands, unioned across the plugin and config surfaces. */
  commands?: AnyCurlewCommand[]
  /** Plugins (env hooks + command bundles), unioned across surfaces. */
  plugins?: CurlewPlugin[]
}

/** The full config accepted by `curlew.config.ts` (CLI-side wiring). */
export interface CurlewConfig extends CurlewOptions {
  /** Factory returning a (transport-less) Feathers app for in-process mode. */
  createApp?: () => Application | Promise<Application>
  /** Run `app.setup()` before executing a command. @default true */
  setup?: boolean | ((app: Application) => void | Promise<void>)
  /** Run `app.teardown()` after executing a command. @default true */
  teardown?: boolean | ((app: Application) => void | Promise<void>)
  /** Remote transport settings (used in remote mode). */
  remote?: RemoteConfig
  /** Mode used when neither `--remote` nor `--url` is passed. @default 'in-process' */
  defaultMode?: CurlewMode
}

/** Fully-resolved options (all defaults applied) used internally. */
export interface ResolvedOptions {
  permission: PermissionMode
  userService: string
  authService: string
  provider: string
  services: string[]
  commands: AnyCurlewCommand[]
  plugins: CurlewPlugin[]
}

/** Context passed to a plugin's `env` hook (before the app is booted). */
export interface CurlewPluginContext {
  mode: CurlewMode
  cwd: string
  /** The command arguments (after curlew's own bin flags are removed). */
  argv: string[]
}

/**
 * A curlew plugin, registered via `plugins: [...]` (merged like `commands`).
 * `env` runs before the app boots (config-file plugins, via the bin) and its
 * returned variables are applied to `process.env`; `commands` are unioned into
 * the available commands.
 */
export interface CurlewPlugin {
  name: string
  env?: (
    context: CurlewPluginContext,
  ) =>
    | Record<string, string | undefined>
    | void
    | Promise<Record<string, string | undefined> | void>
  commands?: AnyCurlewCommand[]
}

export interface AuthenticatePayload {
  strategy?: string
  [key: string]: unknown
}

export interface AuthenticateResult {
  accessToken: string
  user?: unknown
  [key: string]: unknown
}

/**
 * Transport abstraction. `createInProcessClient` and `createRemoteClient`
 * both implement this; the command layer is written against it.
 */
export interface CurlewClient {
  readonly mode: CurlewMode
  /** The underlying app in in-process mode; `undefined` when remote. */
  readonly app?: Application
  /** Known service paths, or `undefined` if they can't be enumerated. */
  listServices: () => string[] | undefined
  /** Registered method names for a service, or `undefined` if not introspectable. */
  serviceMethods: (service: string) => Promise<string[] | undefined>
  find: (service: string, ctx: CallContext) => Promise<unknown>
  get: (service: string, id: string, ctx: CallContext) => Promise<unknown>
  create: (service: string, data: unknown, ctx: CallContext) => Promise<unknown>
  update: (
    service: string,
    id: string,
    data: unknown,
    ctx: CallContext,
  ) => Promise<unknown>
  patch: (
    service: string,
    id: string,
    data: unknown,
    ctx: CallContext,
  ) => Promise<unknown>
  remove: (service: string, id: string, ctx: CallContext) => Promise<unknown>
  /** Call a Feathers custom method `(data, params)`. */
  custom: (
    service: string,
    method: string,
    data: unknown,
    ctx: CallContext,
  ) => Promise<unknown>
  authenticate: (payload: AuthenticatePayload) => Promise<AuthenticateResult>
  /** Resolve the acting user for the given call context, or `null`. */
  whoami: (ctx: CallContext) => Promise<unknown>
  /** Clear any stored session (remote); a no-op in-process. */
  logout: () => Promise<void>
  teardown: () => Promise<void>
}

/** Context passed to a custom command's `run`. */
export interface CurlewCommandContext<T extends ArgsDef = ArgsDef> {
  args: ParsedArgs<T>
  rawArgs: string[]
  client: CurlewClient
  /** Present only in in-process mode. */
  app?: Application
  call: CallContext
  options: ResolvedOptions
  /** Emit a value as JSON to stdout (honors `--pretty`). */
  output: (data: unknown) => void
}

/** A user-defined command (`defineCurlewCommand`). */
export interface CurlewCommand<T extends ArgsDef = ArgsDef> {
  name: string
  description?: string
  args?: T
  aliases?: string[]
  /** If true, hidden/errors in remote mode (needs direct app access). */
  requiresApp?: boolean
  run: (ctx: CurlewCommandContext<T>) => unknown | Promise<unknown>
}

/** A command with its arg types erased — how commands are stored/merged. */
export type AnyCurlewCommand = CurlewCommand<any>

/** Options for the programmatic `runCurlew` entry point. */
export interface RunCurlewOptions extends CurlewConfig {
  /** Argument vector to parse. @default process.argv.slice(2) */
  argv?: string[]
  mode?: CurlewMode
  /** Version string surfaced by `--version`. */
  version?: string
}
