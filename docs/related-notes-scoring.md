# Related notes — similarity scoring

Code: `src/relatedView/TagIndexer.ts` (`computeRelatedNotes` + helpers).

## The formula

For the active note, every *other* markdown file in the vault gets a score:

```
score = wTag   * tagPrefixOverlap
      + wTitle * titleSimilarity
      + wPath  * pathSimilarity
      + wLink  * linkScore
```

Weights are the `weight*` settings (each defaults to `1.0`; set to `0` to disable a
factor). Candidates with `score > 0` are returned sorted descending; the view then
hides anything below `minimumRelatedNotesScore` (default `1`).

### Factors

- **tagPrefixOverlap** — count of shared tag *prefix segments*. Each tag is expanded
  into prefixes (`programming/python/django` →
  `programming`, `programming/python`, `programming/python/django`), so notes sharing
  a parent tag score partial overlap. Tags are gathered from both inline `#tags` and
  frontmatter `tags` (`gatherTagsFromCache`).
- **titleSimilarity** — `levenshteinSimilarity` of the two lowercased basenames
  (normalized 0–1: `(len - distance) / len`).
- **pathSimilarity** — levenshtein similarity of full paths, **only when both files
  are not at the vault root** (`parent.path !== "/"`); otherwise 0.
- **linkScore** — 0–2: +1 if the candidate links to the active note's basename, +1 if
  the active note links to the candidate's.

## Performance characteristic (gotcha)

`computeRelatedNotes` does a **full vault scan on every invocation** — it iterates
`getMarkdownFiles()` and runs levenshtein per candidate, on each (debounced)
active-leaf change. There is no persistent related-notes index. The class comment
("no longer relies on a big index") reflects a deliberate move away from a prebuilt
index toward on-demand computation.

`TagIndexer.noteTagsMap` (built once via `buildIndex()` on layout-ready) is **not**
used for scoring — only `getNoteTags()` for display in the view. Scoring re-reads the
metadata cache directly.

For large vaults this is O(notes × title/path length) per note switch; if it becomes a
bottleneck, caching/precomputation is the lever (tracked in [../FOLLOWUPS.md](../FOLLOWUPS.md)).
