const MARKER_START = '<!-- curlew:instructions:start -->'
const MARKER_END = '<!-- curlew:instructions:end -->'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Wrap the agents block in managed markers so it can be replaced in place. */
export function wrapAgents(body: string): string {
  return `${MARKER_START}\n${body.trim()}\n${MARKER_END}\n`
}

/** Replace the managed block in `existing`, or append it if the markers are absent. */
export function updateManagedBlock(existing: string, body: string): string {
  const block = `${MARKER_START}\n${body.trim()}\n${MARKER_END}`
  const region = new RegExp(
    `${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}`,
  )
  if (region.test(existing)) return `${existing.replace(region, block)}`
  const prefix =
    existing.trim().length > 0 ? `${existing.replace(/\s+$/, '')}\n\n` : ''
  return `${prefix}${block}\n`
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  const wrapped = (body: string) => `${MARKER_START}\n${body}\n${MARKER_END}`

  describe('wrapAgents', () => {
    it('surrounds the body with the markers and trims it', () => {
      expect(wrapAgents('  hi  ')).toBe(`${wrapped('hi')}\n`)
    })
  })

  describe('updateManagedBlock', () => {
    it('creates the block in an empty file, with no leading blank line', () => {
      expect(updateManagedBlock('', 'body')).toBe(`${wrapped('body')}\n`)
    })

    it('appends after existing content, separated by one blank line', () => {
      expect(updateManagedBlock('# Title\n', 'body')).toBe(
        `# Title\n\n${wrapped('body')}\n`,
      )
    })

    it('collapses trailing whitespace before appending', () => {
      expect(updateManagedBlock('# Title\n\n\n', 'body')).toBe(
        `# Title\n\n${wrapped('body')}\n`,
      )
    })

    it('replaces an existing block in place, keeping what surrounds it', () => {
      const before = `# Title\n\n${wrapped('old')}\n\n## After\n`
      expect(updateManagedBlock(before, 'new')).toBe(
        `# Title\n\n${wrapped('new')}\n\n## After\n`,
      )
    })

    it('is idempotent: writing the same body twice changes nothing', () => {
      const once = updateManagedBlock('# Title\n', 'body')
      expect(updateManagedBlock(once, 'body')).toBe(once)
    })

    it('never appends a second block', () => {
      const twice = updateManagedBlock(updateManagedBlock('', 'a'), 'b')
      expect(twice.split(MARKER_START)).toHaveLength(2)
    })

    it('replaces only the first block when a file somehow has two', () => {
      const two = `${wrapped('a')}\n\n${wrapped('b')}\n`
      const result = updateManagedBlock(two, 'new')
      expect(result).toBe(`${wrapped('new')}\n\n${wrapped('b')}\n`)
    })

    it('handles a body containing regex metacharacters', () => {
      const body = 'costs $1 (50%) [see *docs*]'
      expect(updateManagedBlock('', body)).toContain(body)
    })
  })
}
