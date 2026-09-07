import type { CurlewClient } from '../../types'
import { runCommand } from 'citty'
import { describe, expect, it } from 'vitest'
import { capture, fakeClient } from '../../../test/helpers'
import { makeServicesCommand } from '.'

async function run(client: CurlewClient, argv: string[] = []) {
  const cap = capture()
  try {
    await runCommand(makeServicesCommand(client), { rawArgs: argv })
    return { out: cap.stdout() }
  } finally {
    cap.restore()
  }
}

describe('services', () => {
  it('writes the client service paths as one JSON line', async () => {
    const client = fakeClient({
      listServices: () => ['users', 'user-settings', 'v1/user-settings'],
    })
    const { out } = await run(client)
    expect(out).toBe('["users","user-settings","v1/user-settings"]\n')
  })

  it('indents the list with --pretty', async () => {
    const client = fakeClient({ listServices: () => ['users', 'messages'] })
    const { out } = await run(client, ['--pretty'])
    expect(out).toBe('[\n  "users",\n  "messages"\n]\n')
  })

  it('falls back to an empty list when the services cannot be enumerated', async () => {
    const client = fakeClient({ listServices: () => undefined })
    const { out } = await run(client)
    expect(out).toBe('[]\n')
  })
})
