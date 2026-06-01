# Architecture

## Mental model

A single `Plugin` subclass (`TagTacticianPlugin` in `main.ts`) composes three
independent features, each in its own `src/` subfolder, plus shared settings. There
is no central store or event bus — each feature registers its own Obsidian events and
reads from `app.metadataCache` / `app.vault` on demand.

`onload()` calls three `setup*` methods and registers the settings tab. `onunload()`
is intentionally empty — Obsidian detaches the plugin's leaves automatically.

## Module map

| Path | Responsibility |
|------|----------------|
| `main.ts` | Plugin entry. Wires the three features, loads/saves settings, augments the `Workspace` type for the undocumented `search:results-menu` event, and `expandFolders()` (folder selection → contained `TFile`s). |
| `src/settings/PluginSettings.ts` | `TagTacticianSettings` interface + `DEFAULT_SETTINGS`. The single source of truth for settings shape. |
| `src/settings/TagTacticianSettingTab.ts` | The settings UI (all three features' options). |
| `src/settings/BulkFrontmatterTagSettingsTab.ts` | Bulk-edit-specific settings section. |
| `src/settings/IconSelectionModal.ts` | Lucide icon picker used by nav-by-tag icon settings. |
| `src/batch/EditTagsModal.ts` | The bulk-edit modal: per-file table, add/remove tag inputs, live proposed-tag preview, select-all. Produces `{ file, finalTags }[]`. |
| `src/batch/FileTagProcessor.ts` | `applyTagUpdates()` — writes the final tag arrays back into each file's YAML frontmatter. **See [docs/bulk-tag-editing.md](docs/bulk-tag-editing.md) — non-obvious YAML handling.** |
| `src/batch/TagReader.ts` | `readFileTags()` — reads a file's existing tags (metadata cache first, file content fallback), stripping `#`. |
| `src/batch/TagSuggest.ts` | `AbstractInputSuggest` autocompleters: `ExistingTagSuggest` (all vault tags) and `FileTagSuggest` (tags on the selected files). |
| `src/relatedView/TagIndexer.ts` | `computeRelatedNotes()` scoring + tag-gathering/levenshtein helpers. **See [docs/related-notes-scoring.md](docs/related-notes-scoring.md).** |
| `src/relatedView/RelatedNotesView.ts` | Right-sidebar `ItemView` for related notes (filter box, show/hide tags & score, threshold). |
| `src/navByTag/NavByTagView.ts` | Left-sidebar `ItemView` shell: header controls (sort, expand/collapse, settings, filter) and the list container. Delegates rendering to the renderer. |
| `src/navByTag/TagNavigationRenderer.ts` | Builds the nested-tag `TagHierarchy`, then filters/sorts/renders it; owns sort mode, filter mode/query, and expand state. The largest file. |

## Core data flows

### 1. Bulk tag edit (the main write path)

1. User right-clicks file(s)/folder(s) — `file-menu`/`files-menu` event — or uses the
   search-results menu (`search:results-menu`). Handlers live in
   `main.ts:setupBatchTagEditing()`.
2. Folders are expanded to files (`expandFolders`), then `EditTagsModal` opens.
3. The modal reads current tags per file (`TagReader.readFileTags`), shows a live
   preview as the user types add/remove tags, and on **Apply** emits
   `{ file, finalTags }[]`.
4. `FileTagProcessor.applyTagUpdates()` rewrites each file's frontmatter and returns a
   modified count → `Notice`. **This is the only feature that writes to the vault.**

### 2. Related notes (read/scoring path)

1. `active-leaf-change` (debounced 150ms) records the active markdown file's path and
   calls `updateRelatedNotesView()`.
2. `RelatedNotesView` calls `plugin.computeRelatedNotes()` →
   `TagIndexer.computeRelatedNotes(path)`, which **iterates every markdown file in the
   vault** and scores each by weighted tag-prefix overlap + title/path levenshtein +
   reciprocal links. Results above the threshold render in the sidebar.
   (There is no persistent related-notes index — see the docs page.)

### 3. Tag navigation (read/hierarchy path)

1. `metadataCache "changed"` (debounced 150ms) refreshes `NavByTagView`.
2. The renderer builds a `TagHierarchy` from nested tags (`a/b/c` → nested groups),
   applies the active filter and sort, and renders collapsible groups. A note appears
   under every tag it carries.

## What is NOT here

- **No tests.** `npm test` passes with no test files.
- **No persistent index / cache** beyond `TagIndexer.noteTagsMap` (built once on
  layout-ready, used only for display lookups, not for scoring).
- **No inline-tag editing.** Bulk edits touch frontmatter `tags` only.
