<p align="center">
  <img src="./docs/public/header.svg" alt="feathers-curlew — CLI for FeathersJS" width="560">
</p>

> An AI-friendly CLI toolkit for driving [FeathersJS v5](https://feathersjs.com) servers — in-process or
> remote. JSON in, JSON out.

You configure `feathers-curlew` into your app with `app.configure(curlew())`. Every service becomes a
command (`curlew users find`, `curlew users create …`), plus `authenticate` and your own custom commands
(like `sql`). Output is JSON by default with non-zero exit codes on error, so an AI agent can drive your
server reliably.

## Install

```bash
pnpm add feathers-curlew
# optional, for remote mode:
pnpm add @feathersjs/rest-client @feathersjs/authentication-client
```

## Quickstart

**1. Configure the plugin** in your app:

```ts
// src/app.ts
import { curlew } from 'feathers-curlew'

app.configure(curlew())
```

**2. Add a `curlew.config.ts`** in your project root:

```ts
import { defineCurlewConfig } from 'feathers-curlew'
import { createApp } from './src/app'

export default defineCurlewConfig({
  createApp: () => createApp(),
})
```

**3. Run commands:**

```bash
npx curlew services
npx curlew users find --query '{"$limit":5}'
npx curlew users create --data '{"email":"a@b.c","password":"secret"}'
npx curlew authenticate --email a@b.c --password secret
npx curlew service api/v1/users find        # any path, generically
```

Add `--pretty` for indented JSON. Errors go to stderr as JSON with exit code 1.

## Modes

- **In-process** (default): boots your app (`app.setup()`) and calls services directly — full DB access,
  supports custom `sql`-style commands.
- **Remote**: talks to a running server over REST/Socket.IO via `@feathersjs/client`.

```bash
npx curlew --remote --url http://localhost:3030 users find
```

## Permissions

Calls are **internal** (full access) by default. Scope them per call, or change the default with
`permission: 'authenticated'`:

```bash
npx curlew users patch 42 --data '{"role":"admin"}'   # internal (default)
npx curlew users find --as 7                          # run as a user
npx curlew users find --token "$JWT"                  # run with a token
```

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

process.exit(await runCurlew(app, { argv: ['users', 'find'] }))
```

## Documentation

Full docs (built with VitePress) live in [`docs/`](./docs). Run them locally with `pnpm docs:dev`.

## License

MIT
