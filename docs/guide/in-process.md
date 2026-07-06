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
curlew users patch 42 --data '{"plan":"pro"}' --params '{"tenantId":"acme","skipAudit":true}'
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

## What gets generated

- One named command per registered service whose path is a single token (`users`, `messages`).
  Nested paths (`api/v1/users`) are reached via the generic `service` command.
- Each service's sub-commands are **tailored to its exposed methods** (`getServiceOptions().methods`):
  CRUD verbs only when the service supports them, the read shorthands (`findOne`/`findAll`/`count`/`exists`)
  when `find` is exposed, and every **custom method** as its own sub-command (e.g. `curlew messages markRead`).
- Built-ins: `authenticate`, `whoami`, `logout`, `services`, `describe`, `service`.
- Your [custom commands](./custom-commands).

In remote mode there is no method introspection, so services get the standard CRUD set plus the read
shorthands.
