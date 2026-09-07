import type { CurlewClient, ResolvedOptions } from '../../types'

const STANDARD_METHODS = ['find', 'get', 'create', 'update', 'patch', 'remove']

const SKILL_DESCRIPTION =
  'Drive this FeathersJS server from the CLI with `curlew` — inspect services, run CRUD and custom methods, authenticate, and wait for events. Use when the user asks to query or modify server data, or to check server state.'

function isStandardMethods(methods: string[]): boolean {
  if (methods.length !== STANDARD_METHODS.length) return false
  const set = new Set(methods)
  return STANDARD_METHODS.every((method) => set.has(method))
}

/** The agent-facing body: real services, methods and custom commands. */
export async function renderBody(
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

  // Only advertise the mint when it is enabled — an agent shouldn't be offered
  // a command that answers with E_IMPERSONATION_DISABLED.
  const mintLine = options.impersonate
    ? '\ncurlew authenticate --as <user> --raw                 # mint a JWT for that user (in-process)'
    : ''

  const asHint = options.resolveUser
    ? " `--as` is resolved by this app's own `resolveUser`, so it takes more than an id (e.g. an email)."
    : ''

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

**Permissions:** calls run **internal/root by default** — full access, auth & authorization bypassed. Scope a call with \`--as <user>\` or \`--token <jwt>\`; \`--internal\` forces the default. Be deliberate with writes and bulk ops.

**Discover at runtime:** \`curlew services\`, \`curlew describe <service>\` (methods incl. custom), and \`curlew <command> --help\`.

${servicesSection}${commandsSection}### Grammar

\`\`\`bash
curlew find <service> -q '{"active":true}'   # -q = --query; dotted keys ok (e.g. project.name)
curlew findOne <service> -q '{...}'          # one record or null
curlew findAll <service> -q '{...}'          # every match, pagination off
curlew count <service> -q '{...}'            # bare number
curlew exists <service> [id]                 # { exists }, never a 404
curlew get <service> <id>
curlew create <service> -d '{...}'           # -d = --data; also @file.json or - (stdin); array = multi-create
curlew update <service> <id> -d '{...}'
curlew patch <service> <id> -d '{...}'
curlew remove <service> <id>
curlew patch <service> null -q '{...}' -d '{...}'   # bulk on multi services (id = null)

curlew call <service> <method> [id] [-d '{...}']    # Feathers custom methods
curlew watch <service> [event] -q '{...}' [--limit n]   # stream events as NDJSON (in-process)

# Safety: --dry-run on create/update/patch/remove reports {wouldAffect, sample}
# and changes nothing. Run it before any bulk write.
# Volume: --ndjson streams one record per line; findAll --ndjson pages through.

# <service> is an argument, so any path works: nested (api/v1/users), hyphenated,
# or a name that is also a curlew command (curlew find services).

curlew authenticate --email <e> --password <p>${mintLine}
curlew whoami [--token <jwt>]
curlew describe <service>
curlew waitUntil <service> [event] -q '{...}' --timeout <ms>   # in-process; blocks for one event
\`\`\`

Query shortcuts (merge into \`--query\`): \`--select id,email\`, \`--sort -createdAt\`, \`--skip\`, \`--limit\`. Add \`--pretty\` for indented JSON. \`--as\`/\`--token\` are in-process; over \`--remote\` only \`--token\` applies.${asHint}
`
}

/** The same body as a Claude Code Skill file (frontmatter + body). */
export function renderSkill(body: string): string {
  return `---\nname: curlew\ndescription: ${SKILL_DESCRIPTION}\n---\n\n${body}`
}
