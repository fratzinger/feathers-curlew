# Plugins

Plugins bundle reusable behavior — environment setup and command sets — behind a single name. Register
them with `plugins: [...]`, either in the `curlew()` plugin or in `curlew.config.ts` (merged like
`commands`).

```ts
import { defineCurlewPlugin } from 'feathers-curlew'

export function quietLogs() {
  return defineCurlewPlugin({
    name: 'quiet-logs',
    env: ({ mode }) =>
      mode === 'in-process' ? { LOG_LEVEL: 'error', DISABLE_CRON: '1' } : {},
  })
}
```

## The `env` hook

Runs **before the app is created** and applies the returned variables to `process.env` (a value of
`undefined` unsets one). This is how you make an in-process boot CLI-appropriate: quiet the logger, skip
cron/queue/worker startup, set `NODE_ENV`. It receives `{ mode, cwd, argv }`.

::: warning Import the app lazily
For the env vars to actually reach your app, `createApp` must import the app **lazily** — otherwise the app
module is evaluated (and reads env) before the hooks run:

```ts
export default defineCurlewConfig({
  plugins: [quietLogs()],
  // reads the env the hook just set:
  createApp: async () => (await import('./src/app')).createApp(),
})
```

:::

`env` only runs for **config-file** plugins (via the `curlew` bin), since app-side plugins are registered
after the app already exists.

## Command bundles

A plugin's `commands` are unioned into the available commands (deduped by name), so you can ship reusable
command sets across projects:

```ts
export function sqlPlugin() {
  return defineCurlewPlugin({
    name: 'sql',
    commands: [
      defineCurlewCommand({
        name: 'sql',
        requiresApp: true,
        args: { query: { type: 'positional', required: true } },
        async run({ app, args, output }) {
          output((await app!.get('postgresqlClient').raw(args.query)).rows)
        },
      }),
    ],
  })
}
```

## Plugin shape

```ts
interface CurlewPlugin {
  name: string
  env?: (ctx: {
    mode: 'in-process' | 'remote'
    cwd: string
    argv: string[]
  }) => Record<string, string | undefined> | void | Promise<...>
  commands?: CurlewCommand[]
}
```
