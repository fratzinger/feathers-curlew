import type { CurlewMode, RemoteTransport } from '../types'

export interface BinFlags {
  mode?: CurlewMode
  url?: string
  transport?: RemoteTransport
  cwd?: string
  /** Everything left over — the command tree's argv. */
  rest: string[]
}

/** Peel off curlew's own (transport-selection) flags before the command tree. */
export function peelBinFlags(argv: string[]): BinFlags {
  const rest: string[] = []
  const flags: BinFlags = { rest }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--remote':
        flags.mode = 'remote'
        break
      case '--in-process':
        flags.mode = 'in-process'
        break
      case '--url':
        flags.url = argv[++i]
        break
      case '--transport':
        flags.transport = argv[++i] as RemoteTransport
        break
      case '--mode':
        flags.mode = argv[++i] as CurlewMode
        break
      case '--cwd':
        flags.cwd = argv[++i]
        break
      default:
        rest.push(arg)
    }
  }
  return flags
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  describe('peelBinFlags', () => {
    it('passes an ordinary command through untouched', () => {
      expect(peelBinFlags(['users', 'find', '-q', '{}'])).toEqual({
        rest: ['users', 'find', '-q', '{}'],
      })
    })

    it('reads the mode switches', () => {
      expect(peelBinFlags(['--remote']).mode).toBe('remote')
      expect(peelBinFlags(['--in-process']).mode).toBe('in-process')
      expect(peelBinFlags(['--mode', 'remote']).mode).toBe('remote')
    })

    it('consumes the value of a value-taking flag', () => {
      const flags = peelBinFlags(['--url', 'http://x', 'users', 'find'])
      expect(flags.url).toBe('http://x')
      // The URL must not leak into the command argv.
      expect(flags.rest).toEqual(['users', 'find'])
    })

    it('peels flags from anywhere in the argv, keeping command order', () => {
      const flags = peelBinFlags([
        'users',
        '--remote',
        'find',
        '--cwd',
        '/tmp',
        '-q',
        '{}',
      ])
      expect(flags.mode).toBe('remote')
      expect(flags.cwd).toBe('/tmp')
      expect(flags.rest).toEqual(['users', 'find', '-q', '{}'])
    })

    it('lets the last occurrence win', () => {
      expect(peelBinFlags(['--remote', '--in-process']).mode).toBe('in-process')
      expect(peelBinFlags(['--url', 'a', '--url', 'b']).url).toBe('b')
    })

    it('takes all four value flags together', () => {
      expect(
        peelBinFlags([
          '--url',
          'http://x',
          '--transport',
          'socketio',
          '--cwd',
          '.',
        ]),
      ).toEqual({
        url: 'http://x',
        transport: 'socketio',
        cwd: '.',
        rest: [],
      })
    })

    it('yields an empty argv for no input', () => {
      expect(peelBinFlags([])).toEqual({ rest: [] })
    })
  })
}
