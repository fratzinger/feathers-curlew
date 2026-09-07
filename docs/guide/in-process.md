# In-Process Mode

In-process mode is the default. curlew imports your Feathers app, calls `app.setup()`, and invokes your
services directly (`app.service(path)[method](...)`). Because it runs inside your app, it has full database
access and can run [custom commands](./custom-commands) such as `sql`.

## The app factory

`curlew.config.ts` provides a `createApp()` factory:

```ts
import { defineCurlewConfig } from 'feathers-curlew'
import { createApp } from './src/app'

export default defineCurlewConfig({
  createApp: () => createApp(), // may be async
})
```

### Why a transport-less app?

curlew calls `app.setup()` **without** an HTTP server. If your app configures HTTP transports
(`@feathersjs/koa`, `@feathersjs/express`, `@feathersjs/socketio`), their setup may expect a running
server. The most robust pattern is a factory that configures everything **except** transports:

```ts
// src/cli-app.ts
import configuration from '@feathersjs/configuration'
import { feathers } from '@feathersjs/feathers'
import { curlew } from 'feathers-curlew'
import { authentication } from './authentication'
import { services } from './services'

export function createCliApp() {
  const app = feathers()
  app.configure(configuration())
  app.configure(authentication)
  app.configure(services)
  app.configure(curlew())
  return app
}
```

## Setup & teardown

By default curlew runs `app.setup()` before a command and `app.teardown()` afterwards. Control this in the
config:

```ts
export default defineCurlewConfig({
  createApp: () => createApp(),
  setup: true, // false to skip, or a function: (app) => Promise<void>
  teardown: true, // false to skip, or a function: (app) => Promise<void>
})
```

When you call `runCurlew(app)` programmatically on an app you have already set up, pass `setup: false`.

## Custom params

`--query` covers the common case, but Feathers `params` can carry anything your hooks read
(`params.tenantId`, feature flags, a handle set by an earlier hook, …). Pass arbitrary extra params
in-process with `--params`:

```bash
curlew patch users 42 --data '{"plan":"pro"}' --params '{"tenantId":"acme","skipAudit":true}'
```

curlew's own flags (`--query`, `--as`/`--token`/`--internal`, pagination) win on their keys; `--params`
fills in the rest. Extra params are server-side only, so `--params` is ignored in remote mode.

## Waiting for events

`waitUntil <service> [event]` blocks until the service emits a matching event, then prints
`{ event, service, data }` — a bounded, condition-based way to react to something happening:

```bash
curlew waitUntil orders created --query '{"status":"paid","total":{"$gt":100}}' --timeout 30000
```

- Matching uses the full Feathers/Mongo query (`$in`, `$gt`, `$or`, …) via `sift`.
- Omit the `event` positional to listen for any of `created`/`updated`/`patched`/`removed`.
- On timeout it exits non-zero with an `E_TIMEOUT` error, so an agent knows the event never happened.

Because in-process boots an **isolated** app, `waitUntil` only sees events that app emits itself —
background/scheduler jobs, or external sources it subscribes to (message queues, webhooks). It does **not**
see the effect of a separate `curlew` command (a different app instance). It's also available
programmatically: `import { waitForEvent } from 'feathers-curlew'`.

## Streaming events

`watch <service> [event]` is the streaming counterpart: where `waitUntil` blocks for one event and exits,
`watch` keeps printing — one JSON line per event — until you interrupt it:

```bash
curlew watch orders --query '{"status":"paid"}'
curlew watch orders created --limit 10        # stop after 10 events
curlew watch orders --timeout 60000           # stop after a minute
```

It uses the same `sift` matching and the same isolated-app caveat as `waitUntil`. Output is NDJSON, so it
pipes: `curlew watch orders | jq -r '.data.id'`. Programmatically:
`import { watchEvents } from 'feathers-curlew'`.

### Custom event matching

`--query` is matched with [`sift`](https://github.com/crcn/sift.js) by default. `matcher` swaps that out —
same shape as `@feathersjs/memory`'s option, so a configured sift instance drops straight in, or a
different engine entirely:

```ts
import sift from 'sift'

export default defineCurlewConfig({
  // sift with your own operators
  matcher: (query) => sift(query, { operations: myOperations }),
})
```

It is a **factory**: given the query it returns a predicate over the event data. curlew strips the
pagination/projection keys (`$limit`, `$skip`, `$sort`, `$select`) before calling it — those say how to
fetch, not what to match — and treats a predicate that throws as "no match", so one odd payload can't tear
down a long-running `watch`. It applies to both `waitUntil` and `watch`.

## The command set

The command tree is **static** — the service is an argument, not a command — so nothing has to be
introspected to build it:

- One command per verb: `find`, `findOne`, `findAll`, `count`, `exists`, `get`, `create`, `update`,
  `patch`, `remove`. Each takes the service path first: `curlew find users`, `curlew patch users 42`.
- Any path works, including nested (`curlew find api/v1/orders`) and names that are also curlew
  commands (`curlew find services`).
- `call <service> <method>` for Feathers **custom methods** (e.g. `curlew call messages markRead`).
- Built-ins: `authenticate`, `whoami`, `logout`, `services`, `describe`, `waitUntil`, `watch`,
  `instructions`.
- Your [custom commands](./custom-commands).

Use `curlew describe <service>` to see which methods a service supports — calling one it genuinely does
not have fails with `E_UNKNOWN_METHOD`.

::: warning `describe` lists what is exposed, not what is callable
`describe` reports `getServiceOptions().methods` — the methods a service exposes to **external** clients.
curlew's calls are internal (no `provider`), so that allowlist does not gate them: if your class
implements `update` but omits it from `methods`, `curlew update users 42` still runs. Restrict internal
access with hooks, not with `methods`.
:::
