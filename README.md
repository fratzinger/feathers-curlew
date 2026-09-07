<p align="center">
  <img src="./docs/public/header.svg" alt="feathers-curlew — CLI for FeathersJS" width="560">
</p>

> An AI-friendly CLI toolkit for driving [FeathersJS v5](https://feathersjs.com) servers — in-process or
> remote. JSON in, JSON out.

You configure `feathers-curlew` into your app with `app.configure(curlew())`. Each Feathers method becomes
a verb that takes the service path as an argument — `curlew find users`, `curlew patch users 42` — plus
`authenticate`, `watch` and your own custom commands (like `sql`). Output is JSON with non-zero exit codes
on error, so an AI agent can drive your server reliably.

## Install

```bash
pnpm add feathers-curlew
# optional, for remote mode:
pnpm add @feathersjs/rest-client @feathersjs/authentication-client
```

## Quickstart

Configure the plugin in your app, then point curlew at an app factory:

```ts
// src/app.ts
app.configure(curlew())

// curlew.config.ts
export default defineCurlewConfig({ createApp: () => createApp() })
```

```bash
npx curlew services
npx curlew find users --query '{"$limit":5}'
npx curlew create users --data '{"email":"a@b.c","password":"secret"}'
npx curlew authenticate --email a@b.c --password secret
npx curlew find api/v1/users             # nested paths need nothing special
npx curlew call messages markRead -d '{"id":42}'   # Feathers custom method
```

Add `--pretty` for indented JSON. Errors go to stderr as JSON with exit code 1. Full walkthrough:
[Getting Started](./docs/guide/getting-started.md).

## Teach your AI agent

`feathers-curlew` is built to be driven by an AI agent. Generate instructions tailored to your app — real
services, methods, custom commands, and the safety model — and drop them into your agent config:

```bash
npx curlew instructions --out AGENTS.md                                      # idempotent managed block
npx curlew instructions --format skill --out .claude/skills/curlew/SKILL.md  # Claude Code Skill
```

Re-run after your services change; the block is replaced in place, never duplicated. See the
[AI Agents guide](./docs/guide/ai-agents.md).

## Modes

- **In-process** (default): boots your app (`app.setup()`) and calls services directly — full DB access,
  supports custom `sql`-style commands.
- **Remote**: talks to a running server over REST/Socket.IO via `@feathersjs/client`.

```bash
npx curlew --remote --url http://localhost:3030 find users
```

## Large results & live events

```bash
npx curlew findAll users --ndjson | head -20   # one record per line, paged through
npx curlew watch orders --query '{"status":"paid"}'   # stream events (in-process)
```

## Permissions & safety

Calls are **internal** (full access) by default. Scope them per call, or change the default with
`permission: 'authenticated'`:

```bash
npx curlew patch users 42 --data '{"role":"admin"}'   # internal (default)
npx curlew find users --as 7                          # run as a user
npx curlew find users --token "$JWT"                  # run with a token
```

Bulk writes (`patch`/`remove` with the id `null`) hit every matching record, so preview them — and make
confirmation mandatory if an agent is driving:

```bash
npx curlew remove users null -q '{"expired":true}' --dry-run
# {"dryRun":true,"method":"remove","service":"users","wouldAffect":412,"sample":[…]}
```

```ts
export default defineCurlewConfig({ confirmBulk: true }) // bulk writes now need --yes
```

See [Permissions](./docs/guide/permissions.md).

## Custom commands

```ts
import { defineCurlewCommand, defineCurlewConfig } from 'feathers-curlew'

export default defineCurlewConfig({
  createApp: () => createApp(),
  commands: [
    defineCurlewCommand({
      name: 'sql',
      requiresApp: true,
      args: { query: { type: 'positional', required: true } },
      async run({ app, args, output }) {
        const knex = app!.get('postgresqlClient')
        output((await knex.raw(args.query)).rows)
      },
    }),
  ],
})
```

## Programmatic use

```ts
import { runCurlew } from 'feathers-curlew'
import { app } from './src/app'

process.exit(await runCurlew(app, { argv: ['find', 'users'] }))
```

## Documentation

Full docs (built with VitePress) live in [`docs/`](./docs). Run them locally with `pnpm docs:dev`.

## License

MIT
