# Getting Started

`feathers-curlew` is a CLI toolkit you hook into a [FeathersJS v5](https://feathersjs.com) server. It
turns your services into command-line commands so you — or an AI agent — can drive the server from a
terminal. Output is JSON by default, so it is easy to pipe and parse.

## Install

```bash
pnpm add feathers-curlew
```

Remote mode needs a couple of optional peers (skip them if you only run in-process):

```bash
pnpm add @feathersjs/rest-client @feathersjs/authentication-client
```

## 1. Configure the plugin

Register curlew in your app so it can carry options and custom commands:

```ts
// src/app.ts
import { curlew } from 'feathers-curlew'

app.configure(curlew())
```

## 2. Add a `curlew.config.ts`

The `curlew` binary loads a `curlew.config.ts` from your project root. It tells curlew how to build your
app for the CLI:

```ts
// curlew.config.ts
import { defineCurlewConfig } from 'feathers-curlew'
import { createApp } from './src/app'

export default defineCurlewConfig({
  createApp: () => createApp(),
})
```

::: tip Transport-less factory
`createApp()` should return an app configured with your services, hooks and authentication — but ideally
**without** HTTP transports (Socket.IO/Koa/Express). curlew calls `app.setup()` without an HTTP server, so
a transport-less app avoids surprises. See [In-Process Mode](./in-process).
:::

## 3. Run commands

```bash
# List services
npx curlew services

# CRUD — the verb first, the service path as its argument
npx curlew find users --query '{"$limit":5}'
npx curlew get users 42
npx curlew create users --data '{"email":"a@b.c","password":"secret"}'
npx curlew patch users 42 --data '{"role":"admin"}'
npx curlew remove users 42

# Authenticate
npx curlew authenticate --email a@b.c --password secret

# Any path works, including nested and hyphenated ones
npx curlew find api/v1/users
npx curlew find user-settings
```

Add `--pretty` for indented JSON. Errors are printed as JSON to stderr with a non-zero exit code.

That is the whole grammar. Read shortcuts (`findOne`, `count`, `exists`, `findAll`), Feathers custom
methods and bulk writes follow the same shape — see [Method commands](./config#method-commands) for the
full reference.

## Building queries

Use `--query` for arbitrary Feathers queries (operators like `$in`, `$gt`, …), plus shortcuts for the
common bits — they merge into the query and win:

```bash
npx curlew find users \
  --query '{"role":"admin"}' \
  --select id,email \
  --sort '-createdAt,name' \
  --skip 0 --limit 20
```

`--sort` accepts `-field` / `+field` or `field:desc` / `field:asc` (comma-separated).

Large or generated payloads can come from a file or stdin — `--data`/`--query` accept `@file.json`, and
`-` reads stdin:

```bash
npx curlew create users --data @user.json
cat users.json | npx curlew create users --data -
```

## Large results

By default a result is one JSON line, which gets unwieldy — and for an AI agent, unreadable — past a few
hundred records. `--ndjson` writes one record per line instead, and `findAll --ndjson` pages through the
service rather than loading everything at once:

```bash
npx curlew findAll users --ndjson | head -20
npx curlew findAll users --ndjson --page-size 500 > users.ndjson
```

Single records and `count` stay a single line, so `--ndjson` is safe to pass unconditionally.

## Teaching an AI agent about curlew

curlew is built to be driven by an AI agent. Generate instructions tailored to your app — real services,
methods, custom commands and the permission model — and drop them into your agent config (see
[AI Agents](./ai-agents) for the full story):

```bash
npx curlew instructions --out AGENTS.md   # idempotent managed block; re-run to update in place
```

## Programmatic use

You do not have to use the binary — you can run curlew from your own script:

```ts
import { runCurlew } from 'feathers-curlew'
import { app } from './src/app'

const exitCode = await runCurlew(app, { argv: ['find', 'users'] })
process.exit(exitCode)
```

## Next steps

- [In-Process Mode](./in-process) — how the app is booted
- [Remote Mode](./remote) — talk to a running server
- [Permissions](./permissions) — internal vs authenticated calls
- [Custom Commands](./custom-commands) — add your own, e.g. `sql`
- [Configuration](./config) — every option
