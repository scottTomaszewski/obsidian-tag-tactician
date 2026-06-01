# CLAUDE.md — Tag Tactician

Obsidian community plugin for tag management: **bulk frontmatter tag editing**,
**related-notes discovery** (tag/title/path/link similarity), and **tag-based
navigation** (collapsible hierarchy from nested tags). TypeScript, bundled with
esbuild into `main.js`. Desktop-only (`isDesktopOnly: true`), minAppVersion 1.7.2.

This repo *is* the plugin, but it lives inside a demo Obsidian vault
(`tag-tactician-demo/.obsidian/plugins/obsidian-tag-tactician`) so the build output
loads in a real vault for manual testing. The git remote is
`github.com:scottTomaszewski/obsidian-tag-tactician`.

## Where things are

- **Entry point:** `main.ts` — the `TagTacticianPlugin` class wires up the three
  features and settings. Start here.
- **Deeper map + data flows:** [ARCHITECTURE.md](ARCHITECTURE.md) — read this before
  changing feature code; don't re-scan `src/`.
- **Gotchas / deep references:** [docs/index.md](docs/index.md) — funky logic lives
  here (YAML round-tripping, related-notes scoring).
- **User-facing docs:** [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md) are
  separate sources of truth — link, don't restate.
- **Deferred findings:** [FOLLOWUPS.md](FOLLOWUPS.md).
- **Session handoffs:** [docs/handoffs/](docs/handoffs/).

## Commands

| Task | Command |
|------|---------|
| Dev build (watch, inline sourcemap) | `npm run dev` |
| Production build (typecheck + bundle) | `npm run build` |
| Production build, skip typecheck | `npm run build-no-check` |
| Lint | `npm run lint` |
| Test | `npm test` (jest; **no test files exist yet** — `--passWithNoTests`) |
| Cut a release | `just release <version>` (or `devbox run release <version>`) |

`just release <version>` bumps `manifest.json` + `package.json`, promotes the
`## Unreleased` CHANGELOG section to that version (or inserts one), runs
`build-no-check`, commits, pushes, and creates a GitHub release attaching `main.js`,
`manifest.json`, `styles.css`. It **aborts if the working tree is dirty**.

## Conventions

- **Strict TS** (`strictNullChecks`, `noImplicitAny`) — no `any`; augment Obsidian
  types via `declare module "obsidian"` when an API is missing from public typings
  (see the `search:results-menu` augmentation in `main.ts`).
- **ESLint = `eslint-plugin-obsidianmd` recommended.** Two intentional rule
  overrides documented inline in `eslint.config.mjs` (`depend/ban-dependencies` off
  for `js-yaml`/`builtin-modules`; type-aware rules off for JSON). Honor them.
- **User-facing text is sentence case** (Obsidian style guideline).
- **All CSS lives in `styles.css`** — no inline styles in TS.
- The `obsidian-plugin-development` skill encodes the full ruleset; consult it for
  API/lint questions.

## Sync agreement (keep docs true)

- Add or restructure a feature/module → update the module map in `ARCHITECTURE.md`.
- Change the YAML-writing or related-notes scoring logic → update the matching file
  in `docs/`.
- Defer something → add a line to `FOLLOWUPS.md`.
- Land a user-visible change → add it under `## Unreleased` in `CHANGELOG.md` (the
  release script promotes that heading).
