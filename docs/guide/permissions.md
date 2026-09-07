# Permissions

curlew is an admin/automation tool, so by default it makes **internal** calls with full access. You can
tighten this globally or per call.

## Default: internal

An internal Feathers call omits `params.provider`, which bypasses authentication and authorization hooks.
This is the default (`permission: 'internal'`):

```bash
npx curlew patch users 42 --data '{"role":"admin"}'   # full access
```

Change the default in your config:

```ts
export default defineCurlewConfig({
  permission: 'authenticated', // require identity by default
})
```

In `authenticated` mode, a call without `--as` or `--token` fails with `E_AUTH_REQUIRED`.

## Per-call overrides (in-process)

| Flag            | Effect                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--internal`    | Force an internal, full-access call (no provider).                                                                    |
| `--as <user>`   | Resolve the user (see below) and run as them. Sets `provider` + `user` + `authenticated`, so authorization hooks run. |
| `--token <jwt>` | Resolve the JWT via the `jwt` strategy and run as that user.                                                          |

```bash
# Run as a specific user (permissions apply)
npx curlew find users --as 7

# Run with a token
npx curlew find users --token "$JWT"
```

The services used for resolution are configurable:

```ts
export default defineCurlewConfig({
  userService: 'users', // resolves --as
  authService: 'authentication', // resolves --token
  provider: 'curlew', // params.provider label on authenticated calls
})
```

## Bulk writes

`patch <service> null` and `remove <service> null` hit **every matching record** at once, and calls are
internal by default — nothing else stands between a stray query and a wiped table.

Preview first. `--dry-run` works on `create`, `update`, `patch` and `remove`, reports what would happen
and changes nothing:

```bash
npx curlew remove users null -q '{"role":"guest"}' --dry-run
# {"dryRun":true,"method":"remove","service":"users","wouldAffect":412,"sample":[…]}
```

To make that mandatory, turn on `confirmBulk` — a bulk write then needs `--yes`:

```ts
export default defineCurlewConfig({
  confirmBulk: true,
})
```

```bash
npx curlew remove users null -q '{}'          # E_BULK_CONFIRM
npx curlew remove users null -q '{}' --yes    # runs
npx curlew remove users null -q '{}' --dry-run  # always allowed, never needs --yes
```

It is **off by default**, matching curlew's internal/root posture. Turning it on is the single cheapest
guard if an AI agent drives your server.

::: tip `wouldAffect` and `sample`
`sample` is always filled in, so a `wouldAffect` you don't trust is visible rather than reassuring.
:::

## Resolving `--as`

By default `--as` is the user's id: curlew calls `userService.get(value)`. In practice you more often
know an email or a name, so `resolveUser` lets you decide how the lookup works:

```ts
export default defineCurlewConfig({
  resolveUser: async ({ app, value }) => {
    if (!value.includes('@')) return value // fall through to userService.get()
    const [user] = await app
      .service('users')
      .find({ query: { email: value }, paginate: false })
    return user
  },
})
```

```bash
npx curlew find users --as 42
npx curlew find users --as thomas@mueller.de
npx curlew whoami --as thomas@mueller.de
```

Return a **user object** to use it as-is, or an **id** to have curlew load it from `userService`
(uncoerced — your id type is preserved). Returning nothing fails with `E_USER_NOT_FOUND`.

The hook applies everywhere `--as` does: every service call, `whoami`, and `authenticate --as`.

::: tip `--as` takes an identity, not a credential
Passing a JWT to `--as` fails with `E_AS_LOOKS_LIKE_JWT` — use `--token`. The two are not
interchangeable: only `--token` sets `params.authentication`, and only `--token` works in remote mode.
:::

## Minting a token (`authenticate --as`)

Sometimes you need the JWT itself — for curl, Playwright, browser devtools, or handing to an agent.
`authenticate --as` signs one for any user, without their credentials:

```ts
export default defineCurlewConfig({
  impersonate: true,
})
```

```bash
npx curlew authenticate --as 42                  # {"accessToken":"…","user":{…},"expiresAt":"…"}

TOKEN=$(npx curlew authenticate --as 42 --raw)   # just the token, unquoted
curl -H "Authorization: Bearer $TOKEN" http://localhost:3030/users
```

| Flag                  | Effect                                                          |
| --------------------- | --------------------------------------------------------------- |
| `--raw`               | Print only the `accessToken`, unquoted (also for a real login). |
| `--expires-in <span>` | Override the app's `jwtOptions.expiresIn`, e.g. `15m`.          |
| `--payload <json>`    | Extra JWT claims (also `@file.json` or `-` for stdin).          |

The token is signed by your app's own authentication service, so it carries the same `secret`,
`jwtOptions` and subject convention as a real login and verifies against your `jwt` strategy
unchanged. Hooks on the authentication service do **not** run — there is no strategy to authenticate.

For a token your app builds differently, take the mint over entirely:

```ts
export default defineCurlewConfig({
  impersonate: async ({ app, user }) => myCustomSigner(user),
})
```

### Why this one is opt-in

curlew is internal/root by default, so this is the one place it asks first. A minted JWT is a bearer
credential that outlives the command and travels — into chat, CI logs, or a replay against another
environment — which is a different risk profile from an internal service call that ends with the
process.

It is **in-process only** (`E_REQUIRES_APP` over `--remote`), nothing is written to the session file,
and `expiresAt` is always in the output so the blast radius is visible. To keep it out of production,
use a c12 environment override:

```ts
export default defineCurlewConfig({
  impersonate: true,
  $production: { impersonate: false },
})
```

## Remote mode

Over the wire the server enforces authorization, so `--internal` and `--as` cannot bypass it — they are
warned-and-ignored. Use `authenticate` (persists a JWT) or `--token`.
