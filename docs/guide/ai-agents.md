# AI Agents

`feathers-curlew` is built to be driven by an AI agent (Claude Code, Cursor, …). The tool is already
self-describing — `curlew services`, `curlew describe <service>`, `curlew <command> --help` — so an agent
can explore the server at runtime. `curlew instructions` bootstraps that: it generates agent-ready docs
**tailored to your app** so the agent knows curlew exists and exactly how to use it.

## Generate instructions

```bash
# idempotent managed block in your AGENTS.md / CLAUDE.md
npx curlew instructions --out AGENTS.md

# or a Claude Code Skill (overwrites the file)
npx curlew instructions --format skill --out .claude/skills/curlew/SKILL.md
```

Without `--out` it prints to stdout. `--out` is idempotent: the `agents` block lives between
`<!-- curlew:instructions:start -->` and `<!-- curlew:instructions:end -->` and is replaced in place on
re-run (surrounding content is preserved); a `skill` file is overwritten. Re-run whenever your services
change — wire it as a package script (`"curlew:agents": "curlew instructions --out AGENTS.md"`) or a
pre-commit / CI step.

## What it contains

Everything is tailored to your actual app:

- **Services** — standard-CRUD services are grouped compactly; only services with custom or restricted
  methods are detailed, so 40 services don't produce 40 repetitive lines.
- **Custom commands** — your `defineCurlewCommand` names and descriptions.
- **Grammar & flags** — the command shapes (`find`/`get`/`create`/…, `findOne`/`count`/`exists`, bulk
  `null`, `call <service> <method>`, `authenticate`, `waitUntil`, `watch`, …) and the query/data flags.
- **Permission model** — front and center: internal/root by default, scope with `--as`/`--token`.
- **Safety** — that `--dry-run` reports `{ wouldAffect, sample }` and changes nothing, so an agent is
  told to preview a bulk write instead of discovering the blast radius afterwards.
- **Volume** — that `--ndjson` streams one record per line, so a large `find` doesn't fill the agent's
  context window with a single unbounded line.

The agent can always fall back to `curlew services` / `curlew describe <service>` for live details.

The mint line (`authenticate --as`) is only included when [`impersonate`](./permissions#minting-a-token-authenticate-as)
is enabled, and the `--as` hint only when [`resolveUser`](./permissions#resolving-as) is set — an agent
shouldn't be offered a command that answers with an error.

## Formats

| `--format`         | Output                                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| `agents` (default) | A Markdown block for AGENTS.md / CLAUDE.md, wrapped in managed markers.  |
| `skill`            | A full Claude Code `SKILL.md` (with `name` + `description` frontmatter). |
