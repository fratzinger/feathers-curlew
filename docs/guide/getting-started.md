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

# CRUD, per service
npx curlew users find --query '{"$limit":5}'
npx curlew users get 42
npx curlew users create --data '{"email":"a@b.c","password":"secret"}'
npx curlew users patch 42 --data '{"role":"admin"}'
npx curlew users remove 42

# Authenticate
npx curlew authenticate --email a@b.c --password secret

# Any service path (including nested), generically
npx curlew service api/v1/users find
```

Add `--pretty` for indented JSON. Errors are printed as JSON to stderr with a non-zero exit code.

## Shorthands, custom methods & bulk ops

```bash
# Read shortcuts
npx curlew users findOne --query '{"email":"a@b.c"}'  # one record, or null
npx curlew users exists 42                            # → { "exists": true } (no 404 error)
npx curlew users count --query '{"active":true}'      # → 12
npx curlew users findAll                              # ignore pagination, return all

# Feathers custom methods: service <path> <method>
npx curlew service messages markRead --data '{"id":42}'

# Bulk patch/remove on `multi` services — use the literal id `null`
npx curlew users patch null --data '{"active":false}' --query '{"pending":true}'
npx curlew users remove null --query '{"expired":true}'

# Introspection & session
npx curlew describe messages          # methods a service supports (incl. custom)
npx curlew whoami --token "$JWT"      # resolve the current user
npx curlew --remote logout            # forget the stored remote session
```

Short flags: `-q` = `--query`, `-d` = `--data`. Multi `create` takes a JSON array
(`--data '[{…},{…}]'`).

### Building queries

Use `--query` for arbitrary Feathers queries (operators like `$in`, `$gt`, …), plus shortcuts for the
common bits — they merge into the query and win:

```bash
npx curlew users find \
  --query '{"role":"admin"}' \
  --select id,email \
  --sort '-createdAt,name' \
  --skip 0 --limit 20
```

`--sort` accepts `-field` / `+field` or `field:desc` / `field:asc` (comma-separated).

Large or generated payloads can come from a file or stdin — `--data`/`--query` accept `@file.json`, and
`-` reads stdin:

```bash
npx curlew users create --data @user.json
cat users.json | npx curlew users create --data -
```

## Teaching an AI agent about curlew

curlew is meant to be driven by an AI agent. Generate agent-ready instructions — tailored to your actual
services and custom commands — and drop them into your agent config:

```bash
# idempotent managed block in your AGENTS.md / CLAUDE.md
npx curlew instructions --out AGENTS.md

# or emit a Claude Code Skill (overwrites the file)
npx curlew instructions --format skill --out .claude/skills/curlew/SKILL.md
```

The output lists your real services and their methods, your custom commands, the command grammar, the
flags, and the permission model — so the agent knows exactly how to drive this server. `--out` is
idempotent: it replaces the block between `<!-- curlew:instructions:start -->` and
`<!-- curlew:instructions:end -->` (or overwrites the Skill file), so re-run it whenever your services
change and it updates in place.

## Programmatic use

You do not have to use the binary — you can run curlew from your own script:

```ts
import { runCurlew } from 'feathers-curlew'
import { app } from './src/app'

const exitCode = await runCurlew(app, { argv: ['users', 'find'] })
process.exit(exitCode)
```

## Next steps

- [In-Process Mode](./in-process) — how the app is booted
- [Remote Mode](./remote) — talk to a running server
- [Permissions](./permissions) — internal vs authenticated calls
- [Custom Commands](./custom-commands) — add your own, e.g. `sql`
- [Configuration](./config) — every option
