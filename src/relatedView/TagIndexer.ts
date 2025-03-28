import {App, CachedMetadata, TFile} from "obsidian";
import TagTacticianPlugin from "../../main";

/**
 * TagIndexer: Responsible for scanning notes for tags/titles,
 * but no longer relies on a big index for computing related notes.
 */
export class TagIndexer {
    private plugin: TagTacticianPlugin;
    private noteTagsMap: Map<string, Set<string>> = new Map();

    constructor(plugin: TagTacticianPlugin) {
        this.plugin = plugin;
    }

    /**
     * Build a simple in-memory map for titles & tags of each note.
     * (Optional, if you want to skip repeated metadata lookups.)
     */
    public async buildIndex(): Promise<void> {
        const allFiles = this.plugin.app.vault.getMarkdownFiles();
        this.noteTagsMap.clear();

        for (const file of allFiles) {
            await this.indexSingleFile(file);
        }

        console.log(`[TagIndexer] Indexed ${allFiles.length} files.`);
    }

    private async indexSingleFile(file: TFile) {
        const notePath = file.path;
        const cache = this.plugin.app.metadataCache.getFileCache(file);
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
        const file = this.plugin.app.vault.getAbstractFileByPath(currentNotePath);
        if (!(file instanceof TFile)) return [];

        const currCache = this.plugin.app.metadataCache.getFileCache(file);
        if (!currCache) return [];

        // gather current note's full tags from the cache
        const currFullTags = gatherTagsFromCache(currCache);

        // expand to prefix segments
        const currentNoteSegments = gatherAllPrefixSegmentsForNote(currFullTags);

        // also get the current note's title
        const currentTitle = file.basename.toLowerCase();

        // 2) Iterate *every* note in the vault, compute overlap
        const allFiles = this.plugin.app.vault.getMarkdownFiles();
        const results: { notePath: string; score: number }[] = [];

        const weightTagSimilarity = this.plugin.settings.weightTagSimilarity;
        const weightTitleSimilarity = this.plugin.settings.weightTitleSimilarity;
        const weightPathSimilarity = this.plugin.settings.weightPathSimilarity;
        const weightLinkInterconnections = this.plugin.settings.weightLinkInterconnections;

        for (const candidateFile of allFiles) {
            const candidatePath = candidateFile.path;
            if (candidatePath === currentNotePath) {
                continue; // skip the current note
            }

            // gather candidate's tags from the cache
            const candCache = this.plugin.app.metadataCache.getFileCache(candidateFile);
            if (!candCache) continue;

            const candTags = gatherTagsFromCache(candCache);
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
            const titleSimScore = levenshteinSimilarity(currentTitle, candidateTitle);

            // Path similarity
            let pathSimScore = 0
            if (candidateFile.parent.path !== "/" && file.parent.path !== "/") {
                pathSimScore = levenshteinSimilarity(file.path, candidatePath);
            }

            // Links to each other
            let linkScore = 0;
            if (candCache.links?.map(l => l.link).includes(file.basename)) {
                linkScore++;
            }
            if (currCache.links?.map(l => l.link).includes(candidateFile.basename)) {
                linkScore++;
            }

            const totalScore = 0
                + (weightTagSimilarity * prefixOverlapScore)
                + (weightTitleSimilarity * titleSimScore)
                + (weightPathSimilarity * pathSimScore)
                + (weightLinkInterconnections * linkScore);
            if (totalScore > 0) {
                results.push({notePath: candidatePath, score: totalScore});
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
 * Utility function to collect tags from metadata cache
 */
export function gatherTagsFromCache(cache: CachedMetadata): Set<string> {
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
 * Given a full tag like "programming/python/django", return
 * ["programming", "programming/python", "programming/python/django"]
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
 * Get all tag prefix segments from a note
 */
export function gatherAllPrefixSegmentsForNote(noteTags: Set<string>): Set<string> {
    const allSegments = new Set<string>();
    for (const tag of noteTags) {
        for (const prefix of expandTagIntoPrefixes(tag)) {
            allSegments.add(prefix);
        }
    }
    return allSegments;
}

/**
 * Calculate the Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    const dp: number[][] = [];

    for (let i = 0; i <= m; i++) {
        dp[i] = [i];
    }

    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1, // deletion
                dp[i][j - 1] + 1, // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return dp[m][n];
}

/**
 * Calculate a similarity score between two strings based on Levenshtein distance
 */
export function levenshteinSimilarity(s1: string, s2: string): number {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longerLength - levenshteinDistance(longer, shorter)) / parseFloat(longerLength);
}