import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CurlewClient, ResolvedOptions } from '../types'
import { defineCommand } from 'citty'

const STANDARD_METHODS = ['find', 'get', 'create', 'update', 'patch', 'remove']

const SKILL_DESCRIPTION =
  'Drive this FeathersJS server from the CLI with `curlew` — inspect services, run CRUD and custom methods, authenticate, and wait for events. Use when the user asks to query or modify server data, or to check server state.'

const MARKER_START = '<!-- curlew:instructions:start -->'
const MARKER_END = '<!-- curlew:instructions:end -->'

function isStandardMethods(methods: string[]): boolean {
  if (methods.length !== STANDARD_METHODS.length) return false
  const set = new Set(methods)
  return STANDARD_METHODS.every((method) => set.has(method))
}

async function renderBody(
  client: CurlewClient,
  options: ResolvedOptions,
): Promise<string> {
  const services = client.listServices() ?? options.services

  let servicesSection = ''
  if (services.length > 0) {
    const standard: string[] = []
    const custom: string[] = []
    for (const name of services) {
      const methods = (await client.serviceMethods(name)) ?? STANDARD_METHODS
      if (isStandardMethods(methods)) standard.push(name)
      else custom.push(`- \`${name}\` — ${methods.join(', ')}`)
    }
    const lines = [
      '### Services',
      '',
      `${services.length} service${services.length === 1 ? '' : 's'} — run \`curlew describe <service>\` for a service's exact methods.`,
      '',
    ]
    if (standard.length > 0) {
      lines.push(
        `**Standard CRUD** (${STANDARD_METHODS.join(', ')}):`,
        standard.join(', '),
        '',
      )
    }
    if (custom.length > 0) {
      lines.push('**Custom or restricted methods:**', '', ...custom, '')
    }
    servicesSection = `${lines.join('\n')}\n`
  }

  let commandsSection = ''
  if (options.commands.length > 0) {
    const rows = options.commands.map(
      (command) =>
        `- \`curlew ${command.name}\`${command.description ? ` — ${command.description}` : ''}`,
    )
    commandsSection = `### Custom commands\n\n${rows.join('\n')}\n\n`
  }

  return `## Driving this FeathersJS server with \`curlew\`

\`curlew\` is a CLI wired into this app. It prints JSON to stdout; on failure it prints a JSON error to stderr and exits non-zero. Invoke it via the \`curlew\` bin (e.g. \`npx curlew …\`, or a package script).

**Permissions:** calls run **internal/root by default** — full access, auth & authorization bypassed. Scope a call with \`--as <userId>\` or \`--token <jwt>\`; \`--internal\` forces the default. Be deliberate with writes and bulk ops.

**Discover at runtime:** \`curlew services\`, \`curlew describe <service>\` (methods incl. custom), and \`curlew <command> --help\`.

${servicesSection}${commandsSection}### Grammar

\`\`\`bash
curlew <service> find -q '{"active":true}'   # -q = --query; dotted keys ok (e.g. project.name)
curlew <service> findOne -q '{...}'           # one record or null
curlew <service> count -q '{...}'             # bare number
curlew <service> get <id>
curlew <service> create -d '{...}'            # -d = --data; also @file.json or - (stdin); array = multi-create
curlew <service> patch <id> -d '{...}'
curlew <service> remove <id>
curlew <service> patch null -q '{...}' -d '{...}'   # bulk on multi services (id = null)

curlew service <path> <method> [id] [-d '{...}']    # any/nested path or custom method

curlew authenticate --email <e> --password <p>
curlew whoami [--token <jwt>]
curlew describe <service>
curlew waitUntil <service> [event] -q '{...}' --timeout <ms>   # in-process; matches emitted events
\`\`\`

Query shortcuts (merge into \`--query\`): \`--select id,email\`, \`--sort -createdAt\`, \`--skip\`, \`--limit\`. Add \`--pretty\` for indented JSON. \`--as\`/\`--token\` are in-process; over \`--remote\` only \`--token\` applies.
`
}

function renderSkill(body: string): string {
  return `---\nname: curlew\ndescription: ${SKILL_DESCRIPTION}\n---\n\n${body}`
}

/** Wrap the agents block in managed markers so it can be replaced in place. */
function wrapAgents(body: string): string {
  return `${MARKER_START}\n${body.trim()}\n${MARKER_END}\n`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Replace the managed block in `existing`, or append it if the markers are absent. */
function updateManagedBlock(existing: string, body: string): string {
  const block = `${MARKER_START}\n${body.trim()}\n${MARKER_END}`
  const region = new RegExp(
    `${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}`,
  )
  if (region.test(existing)) return `${existing.replace(region, block)}`
  const prefix =
    existing.trim().length > 0 ? `${existing.replace(/\s+$/, '')}\n\n` : ''
  return `${prefix}${block}\n`
}

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
