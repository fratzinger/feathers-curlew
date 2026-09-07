export { createInProcessClient } from './client/in-process'
export { createRemoteClient } from './client/remote'
export { defineCurlewConfig, loadCurlewConfig } from './config'
export { defineCurlewCommand } from './define-command'
export { CurlewError } from './errors'
export { mintAccessToken } from './impersonate/index'
export { curlew } from './plugin'
export { defineCurlewPlugin } from './plugins'
export { runCurlew } from './runner'
export type {
  AnyCurlewCommand,
  AuthenticatePayload,
  AuthenticateResult,
  CallContext,
  CurlewClient,
  CurlewCommand,
  CurlewCommandContext,
  CurlewConfig,
  CurlewMode,
  CurlewOptions,
  CurlewPlugin,
  CurlewPluginContext,
  ImpersonateContext,
  PermissionMode,
  RemoteConfig,
  RemoteTransport,
  ResolvedOptions,
  ResolveUserContext,
  RunCurlewOptions,
} from './types'
export { waitForEvent, watchEvents } from './wait/index'

export type {
  QueryMatcher,
  WaitForEventOptions,
  WaitForEventResult,
  WatchedEvent,
  WatchEventsOptions,
} from './wait'
