# Remote Mode

Remote mode talks to a **running** server over the wire using
[`@feathersjs/rest-client`](https://feathersjs.com/api/client/rest.html) (default) or Socket.IO. There is
no direct database access, so [custom commands](./custom-commands) that need the app (`requiresApp: true`)
are unavailable.

## Optional peers

Remote transports are optional peer dependencies, imported lazily. Install what you use:

```bash
# REST (default)
pnpm add @feathersjs/rest-client @feathersjs/authentication-client

# Socket.IO
pnpm add @feathersjs/socketio-client @feathersjs/authentication-client socket.io-client
```

## Configure

```ts
// curlew.config.ts
import { defineCurlewConfig } from 'feathers-curlew'

export default defineCurlewConfig({
  remote: {
    url: 'http://localhost:3030',
    transport: 'rest', // or 'socketio'
    strategy: 'local', // default authenticate strategy
    // Remote can't auto-discover services, so declare the ones you want as
    // named commands. The generic `service <path> <method>` always works.
    services: ['users', 'messages'],
  },
})
```

## Run

```bash
# Force remote (or set defaultMode: 'remote' in the config)
npx curlew --remote users find
npx curlew --remote --url https://api.example.com users get 42

# Authenticate — the JWT is persisted and reused on later calls
npx curlew --remote authenticate --email a@b.c --password secret
```

## Sessions

`authenticate` stores the returned JWT in a `0600` file under your OS config directory
(`$XDG_CONFIG_HOME/feathers-curlew/sessions.json`), namespaced by URL. Later remote calls reuse it
automatically. Pass `--token <jwt>` to override it for a single call.

## What changes vs in-process

- `--internal` and `--as` are meaningless over the wire (the server enforces authorization) and are
  warned-and-ignored. Use `authenticate` or `--token` instead.
- Only services listed in `remote.services` get named commands; everything else uses `service`.
