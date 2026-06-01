# docs/

Deep references and gotchas, one topic per file. Start from
[../CLAUDE.md](../CLAUDE.md) and [../ARCHITECTURE.md](../ARCHITECTURE.md) for
orientation; come here when you need the non-obvious detail.

- [bulk-tag-editing.md](bulk-tag-editing.md) — why frontmatter is rewritten with
  `vault.process` + `js-yaml` instead of `FileManager.processFrontMatter`, and how the
  hyphens/brackets array style is produced.
- [related-notes-scoring.md](related-notes-scoring.md) — the related-notes similarity
  formula, its weights, and the full-vault-scan performance characteristic.

For session handoffs see [handoffs/](handoffs/).
