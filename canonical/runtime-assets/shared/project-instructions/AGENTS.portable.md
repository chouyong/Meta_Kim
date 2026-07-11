# Meta_Kim runtime (portable notes)

This project has local Meta_Kim runtime capability projections installed for
agent runtimes such as Codex, Cursor, and OpenClaw. They are generated helpers —
not part of this project's source — and they do not change what this project is.

## Generated, git-ignored assets

These are produced locally by the Meta_Kim installer and are expected to be
git-ignored. They are machine-specific and safe to delete and regenerate:

- `.codex/`, `.agents/` — Codex agents, skills, hooks, capability index
- `.cursor/` — Cursor rules, skills, hooks, capability index
- `openclaw/` — OpenClaw workspaces, skills, capability index

They are not edited by hand. This project does not contain, and is not expected
to contain, Meta_Kim's own source layer (its `canonical/`, `config/`, or
`package.json`); those live only in the separate Meta_Kim source repository.

## Regenerating

Regenerate these assets from your Meta_Kim **source** checkout — not from this
project — for example:

    npx meta-kim project bootstrap --apply --project-dir <this-project-dir>

The published `meta-kim` CLI is portable; run the project bootstrap against this
directory whenever the local projections need to be refreshed.

## What this block is not

This is a short portable pointer maintained by Meta_Kim. It is intentionally not
the Meta_Kim maintainer guide: it carries no source-repo release, sync, or
canonical-source maintenance instructions, and no absolute machine paths. Text
outside this managed block belongs to this project and is never modified.
