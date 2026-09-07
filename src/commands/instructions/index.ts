import type { CurlewClient, ResolvedOptions } from '../../types'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { defineCommand } from 'citty'
import { updateManagedBlock, wrapAgents } from './managed-block'
import { renderBody, renderSkill } from './render'

function readFileOrEmpty(file: string): string {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/**
 * `instructions` — emit agent-ready docs tailored to this app (real services,
 * methods and custom commands). Print to stdout, or write idempotently with
 * `--out`: the `agents` block is delimited by markers and replaced in place;
 * a `skill` file is overwritten.
 */
export function makeInstructionsCommand(
  client: CurlewClient,
  options: ResolvedOptions,
) {
  return defineCommand({
    meta: {
      name: 'instructions',
      description:
        'Print or write agent-ready instructions for driving this app (--format agents|skill, --out <file>)',
    },
    args: {
      format: {
        type: 'string',
        description: 'Output format: "agents" (default) or "skill"',
        default: 'agents',
      },
      out: {
        type: 'string',
        description:
          'Write to a file idempotently (agents: replace the marker block; skill: overwrite)',
      },
    },
    async run({ args }) {
      const body = await renderBody(client, options)
      const skill = args.format === 'skill'

      if (args.out) {
        mkdirSync(dirname(args.out), { recursive: true })
        const content = skill
          ? renderSkill(body)
          : updateManagedBlock(readFileOrEmpty(args.out), body)
        writeFileSync(args.out, content)
        process.stderr.write(`curlew: wrote instructions to ${args.out}\n`)
        return
      }

      process.stdout.write(skill ? renderSkill(body) : wrapAgents(body))
    },
  })
}
