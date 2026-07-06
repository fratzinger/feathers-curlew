# Permissions

curlew is an admin/automation tool, so by default it makes **internal** calls with full access. You can
tighten this globally or per call.

## Default: internal

An internal Feathers call omits `params.provider`, which bypasses authentication and authorization hooks.
This is the default (`permission: 'internal'`):

```bash
npx curlew users patch 42 --data '{"role":"admin"}'   # full access
```

Change the default in your config:

```ts
export default defineCurlewConfig({
  permission: 'authenticated', // require identity by default
})
```

In `authenticated` mode, a call without `--as` or `--token` fails with `E_AUTH_REQUIRED`.

## Per-call overrides (in-process)

| Flag            | Effect                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--internal`    | Force an internal, full-access call (no provider).                                                                           |
| `--as <userId>` | Load the user via the `userService` and run as them. Sets `provider` + `user` + `authenticated`, so authorization hooks run. |
| `--token <jwt>` | Resolve the JWT via the `jwt` strategy and run as that user.                                                                 |

```bash
# Run as a specific user (permissions apply)
npx curlew users find --as 7

# Run with a token
npx curlew users find --token "$JWT"
```

The services used for resolution are configurable:

```ts
export default defineCurlewConfig({
  userService: 'users', // resolves --as
  authService: 'authentication', // resolves --token
  provider: 'curlew', // params.provider label on authenticated calls
})
```

## Remote mode

Over the wire the server enforces authorization, so `--internal` and `--as` cannot bypass it — they are
warned-and-ignored. Use `authenticate` (persists a JWT) or `--token`.
