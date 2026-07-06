# Custom Commands

Register your own commands with `defineCurlewCommand`. They receive a context with the `app`, the active
`client`, parsed `args`, and an `output` helper. This is the natural home for app-coupled commands like a
raw `sql` runner.

Custom commands live in the [plugin options](./config) (co-located with your server code) or in
`curlew.config.ts`.

## Example: a `sql` command

```ts
// curlew.config.ts
import { defineCurlewCommand, defineCurlewConfig } from 'feathers-curlew'
import { createCliApp } from './src/cli-app'

export default defineCurlewConfig({
  createApp: () => createCliApp(),
  commands: [
    defineCurlewCommand({
      name: 'sql',
      description: 'Run a raw SQL query against the app database.',
      requiresApp: true, // hidden/errors in remote mode
      args: {
        query: {
          type: 'positional',
          required: true,
          description: 'SQL to execute',
        },
      },
      async run({ app, args, output }) {
        // The Feathers knex generator stores the client under this key:
        const knex = app!.get('postgresqlClient')
        const result = await knex.raw(args.query)
        output(result.rows ?? result)
      },
    }),
  ],
})
```

```bash
npx curlew sql "select count(*) from users"
```

## The command context

```ts
interface CurlewCommandContext {
  args // parsed citty args (your args + the common flags)
  rawArgs: string[]
  client // the active CurlewClient
  app? // the Feathers app (in-process only)
  call // { internal?, as?, token?, query? } derived from flags
  options // resolved curlew options
  output: (data: unknown) => void // print JSON (honors --pretty)
}
```

Return a value **or** call `output(...)` — if `run` returns anything other than `undefined` and you did not
call `output`, the return value is printed as JSON.

## Notes

- Every custom command also gets the common flags (`--pretty`, `--internal`, `--as`, `--token`, `--query`).
- Set `requiresApp: true` for commands that touch the app/database directly; they error clearly in remote
  mode.
- `aliases: ['q']` registers extra names for the command.
