# Followups

Small deferred findings. Larger planned efforts → `ROADMAP.md` (not yet created).

- **`versions.json` is stale.** It maps `{"0.9.3": "1.7.2"}` while the plugin is at
  `1.10.1`. The `just release` flow updates `manifest.json`/`package.json` but not
  `versions.json`, which Obsidian uses to map plugin versions → minAppVersion. Decide
  whether to maintain it (and add it to the release script) or accept it as-is.
- **Icon picker has no search.** `src/settings/IconSelectionModal.ts` — `TODO - add
  search`.
- **Related-notes list is hard-capped/unfiltered.** `src/relatedView/RelatedNotesView.ts`
  — `TODO - make this slice configurable or infinite scrolling`.
- **Related-notes scoring is a full vault scan per note switch.** No persistent index;
  candidate for caching/precomputation if large-vault performance matters. See
  [docs/related-notes-scoring.md](docs/related-notes-scoring.md).
- **No tests exist.** `npm test` runs jest with `--passWithNoTests`. The pure helpers
  (`levenshteinSimilarity`, tag-prefix expansion, YAML dump styles) are the natural
  first targets.
