import {App, CachedMetadata, TFile} from "obsidian";

/**
 * TagIndexer: Responsible for scanning notes for tags/titles,
 * but no longer relies on a big index for computing related notes.
 */
export class TagIndexer {
    private app: App;
    private noteTagsMap: Map<string, Set<string>> = new Map();

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Build a simple in-memory map for titles & tags of each note.
     * (Optional, if you want to skip repeated metadata lookups.)
     */
    public async buildIndex(): Promise<void> {
        const allFiles = this.app.vault.getMarkdownFiles();
        this.noteTagsMap.clear();

        for (const file of allFiles) {
            await this.indexSingleFile(file);
        }

        console.log(`[TagIndexer] Indexed ${allFiles.length} files.`);
    }

    private async indexSingleFile(file: TFile) {
        const notePath = file.path;
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) {
            return;
        }

        // Collect tags
        const tags: Set<string> = new Set();
        if (cache.tags) {
            for (const t of cache.tags) {
                let rawTag = t.tag;
                if (rawTag.startsWith("#")) rawTag = rawTag.substring(1);
                tags.add(rawTag);
            }
        }
        if (cache.frontmatter && cache.frontmatter.tags) {
            const fmTags = cache.frontmatter.tags;
            if (Array.isArray(fmTags)) {
                fmTags.forEach((tag) => typeof tag === "string" && tags.add(tag));
            } else if (typeof fmTags === "string") {
                fmTags.split(/[, ]+/).forEach((t) => t && tags.add(t));
            }
        }

        this.noteTagsMap.set(notePath, tags);
    }

    /**
     * Approach #2:
     * - Read the current note's metadata directly
     * - Expand tags into prefix segments
     * - Iterate *all* notes in the vault (except self)
     * - For each, gather prefix segments, compute overlap + title similarity
     */
    public computeRelatedNotes(currentNotePath: string): Array<{ notePath: string; score: number }> {
        // 1) Get current note's tags and expand into prefix segments
        const file = this.app.vault.getAbstractFileByPath(currentNotePath);
        if (!(file instanceof TFile)) return [];

        const currCache = this.app.metadataCache.getFileCache(file);
        if (!currCache) return [];

        // gather current note's full tags from the cache
        const currFullTags = gatherTagsFromCache(currCache, file);

        // expand to prefix segments
        const currentNoteSegments = gatherAllPrefixSegmentsForNote(currFullTags);

        // also get the current note's title
        const currentTitle = file.basename.toLowerCase();

        // 2) Iterate *every* note in the vault, compute overlap
        const allFiles = this.app.vault.getMarkdownFiles();
        const results: { notePath: string; score: number }[] = [];

        for (const candidateFile of allFiles) {
            const candidatePath = candidateFile.path;
            if (candidatePath === currentNotePath) {
                continue; // skip the current note
            }

            // gather candidate's tags from the cache
            const candCache = this.app.metadataCache.getFileCache(candidateFile);
            if (!candCache) continue;

            const candTags = gatherTagsFromCache(candCache, candidateFile);
            const candidateSegments = gatherAllPrefixSegmentsForNote(candTags);

            // compute prefix overlap
            let prefixOverlapScore = 0;
            for (const seg of candidateSegments) {
                if (currentNoteSegments.has(seg)) {
                    prefixOverlapScore += 1;
                }
            }

            // Title similarity
            const candidateTitle = candidateFile.basename.toLowerCase();
            let titleSimScore = 0;
            if (candidateTitle.includes(currentTitle) || currentTitle.includes(candidateTitle)) {
                titleSimScore = 1;
            }

            const totalScore = prefixOverlapScore + 2 * titleSimScore;
            if (totalScore > 0) {
                results.push({ notePath: candidatePath, score: totalScore });
            }
        }

        // sort descending
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    /**
     * Accessor if you need the tags for a note from the in-memory map (like in your view).
     */
    public getNoteTags(notePath: string): Set<string> {
        return this.noteTagsMap.get(notePath) ?? new Set();
    }
}

/**
 * Helper: gather full tags from a file's cache + fallback to file basename if no frontmatter
 */
function gatherTagsFromCache(cache: CachedMetadata, file: TFile): Set<string> {
    const tags: Set<string> = new Set();
    if (cache.tags) {
        for (const t of cache.tags) {
            let rawTag = t.tag;
            if (rawTag.startsWith("#")) rawTag = rawTag.substring(1);
            tags.add(rawTag);
        }
    }
    if (cache.frontmatter && cache.frontmatter.tags) {
        const fmTags = cache.frontmatter.tags;
        if (Array.isArray(fmTags)) {
            fmTags.forEach((tag) => typeof tag === "string" && tags.add(tag));
        } else if (typeof fmTags === "string") {
            fmTags.split(/[, ]+/).forEach((t) => t && tags.add(t));
        }
    }
    return tags;
}

/**
 * Expand "person/family/child" => ["person", "person/family", "person/family/child"].
 */
function expandTagIntoPrefixes(fullTag: string): string[] {
    const segments = fullTag.split("/");
    const prefixes: string[] = [];
    for (let i = 1; i <= segments.length; i++) {
        prefixes.push(segments.slice(0, i).join("/"));
    }
    return prefixes;
}

/**
 * For a note's set of full tags, build a set of all prefix segments.
 * e.g. if note has ["person/family", "career/company_name"],
 * returns ["person", "person/family", "career", "career/company_name"].
 */
function gatherAllPrefixSegmentsForNote(noteTags: Set<string>): Set<string> {
    const allSegments = new Set<string>();
    for (const tag of noteTags) {
        for (const prefix of expandTagIntoPrefixes(tag)) {
            allSegments.add(prefix);
        }
    }
    return allSegments;
}
