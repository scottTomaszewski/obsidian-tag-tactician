# Bulk tag editing — frontmatter writing

Code: `src/batch/FileTagProcessor.ts` (`applyTagUpdates`, `dumpYaml`).

## Why not `FileManager.processFrontMatter`?

The obvious Obsidian API for editing only frontmatter is
`FileManager.processFrontMatter`. This plugin deliberately does **not** use it.

`processFrontMatter` (and `stringifyYaml`) cannot emit **flow/bracket-style** arrays
(`tags: [foo, bar]`) — it always writes block/hyphen style. Supporting the user's
chosen "brackets" tag-list style requires controlling the YAML dump, so the code
instead:

1. `app.vault.process(file, (oldContent) => ...)` to get/replace the raw file text.
2. `getFrontMatterInfo()` to locate the frontmatter block.
3. `parseYaml()` to read existing frontmatter, sets `tags`, then `js-yaml`'s `dump`
   to re-serialize.

```
brackets → yaml.dump(fmData, { flowLevel: 1 })   // arrays inline, rest block
hyphens  → yaml.dump(fmData, { flowLevel: -1 })  // all block style
```

### The tradeoff (documented inline in the source)

Because the plugin owns the serialization, **Obsidian's Properties UI or another
plugin using `processFrontMatter` may rewrite the file and override the chosen array
style.** This is an accepted limitation, kept to support bracket syntax. If round-trip
format stability becomes a real problem, this is the decision to revisit.

`js-yaml` is therefore an intentional runtime dependency — `eslint.config.mjs` turns
off `depend/ban-dependencies` partly for this reason.

## Behavior details

- **Only `.md` files** are processed (others filtered out, optionally warned about).
- **Empty result removes the `tags` key** (`fmData.tags = undefined`).
- **No frontmatter + no tags** → file untouched. **No frontmatter + tags** → a new
  `---` block is prepended.
- Files with **invalid/duplicate-key YAML** are skipped (surfaced in the modal).
- `modifiedCount` only counts files whose content actually changed (identical
  re-writes return `oldContent`).
- **No undo.** There is no transaction or backup; the README warns users accordingly.
