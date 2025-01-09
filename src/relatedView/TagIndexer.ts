import { App, TFile } from "obsidian";

/**
 * TagIndexer: Responsible for building an index of (tag -> set of notePaths)
 * and (notePath -> noteTitle) so we can quickly find related notes.
 */
export class TagIndexer {
    private app: App;
    private tagIndex: Map<string, Set<string>>;
    private noteTitleMap: Map<string, string>;
    private noteTagsMap: Map<string, Set<string>> = new Map();

    constructor(app: App) {
        this.app = app;
        this.tagIndex = new Map();
        this.noteTitleMap = new Map();
        this.noteTagsMap = new Map();
    }

    /**
     * Build the index for all .md files in the vault.
     */
    public async buildIndex(): Promise<void> {
        const allFiles = this.app.vault.getMarkdownFiles();
        this.tagIndex.clear();
        this.noteTitleMap.clear();

        for (const file of allFiles) {
            await this.indexSingleFile(file);
        }

        console.log(`[TagIndexer] Indexed ${allFiles.length} files.`);
    }

    /**
     * Analyze a single file for tags and title, update maps.
     */
    private async indexSingleFile(file: TFile) {
        const notePath = file.path;
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) {
            // If there's no metadata (very unlikely), skip
            return;
        }

        // 1) Collect tags from obsidian cache
        const tags: Set<string> = new Set();
        if (cache.tags) {
            for (const t of cache.tags) {
                let rawTag = t.tag; // e.g. "#topic/health"
                if (rawTag.startsWith("#")) rawTag = rawTag.substring(1);
                tags.add(rawTag);
            }
        }

        // frontmatter tags
        if (cache.frontmatter && cache.frontmatter.tags) {
            const fmTags = cache.frontmatter.tags;
            if (Array.isArray(fmTags)) {
                fmTags.forEach((tag) => typeof tag === "string" && tags.add(tag));
            } else if (typeof fmTags === "string") {
                fmTags.split(/[, ]+/).forEach((t) => t && tags.add(t));
            }
        }

        // 2) Insert into tagIndex
        for (const t of tags) {
            if (!this.tagIndex.has(t)) {
                this.tagIndex.set(t, new Set());
            }
            this.tagIndex.get(t)!.add(notePath);
        }

        // 3) Title
        let noteTitle = file.basename;
        if (cache.frontmatter && typeof cache.frontmatter.title === "string") {
            noteTitle = cache.frontmatter.title;
        } else if (cache.headings && cache.headings.length > 0) {
            noteTitle = cache.headings[0].heading;
        }
        this.noteTitleMap.set(notePath, noteTitle);
        this.noteTagsMap.set(notePath, tags);
    }

    public computeRelatedNotes(currentNotePath: string): Array<{ notePath: string; score: number }> {
        // 1) figure out the tags for the current note
        const file = this.app.vault.getAbstractFileByPath(currentNotePath);
        if (!(file instanceof TFile)) return [];

        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return [];

        // gather tags for the current note
        const currTags: Set<string> = new Set();
        if (cache.tags) {
            for (const t of cache.tags) {
                let rawTag = t.tag;
                if (rawTag.startsWith("#")) rawTag = rawTag.substring(1);
                currTags.add(rawTag);
            }
        }
        if (cache.frontmatter && cache.frontmatter.tags) {
            const fmTags = cache.frontmatter.tags;
            if (Array.isArray(fmTags)) {
                fmTags.forEach((tag) => typeof tag === "string" && currTags.add(tag));
            } else if (typeof fmTags === "string") {
                fmTags.split(/[, ]+/).forEach((t) => t && currTags.add(t));
            }
        }

        // expand the current note's tags into prefix segments
        const currentNoteSegments = gatherAllPrefixSegmentsForNote(currTags);

        // 2) gather candidates: all notes that share at least one *full tag* with the current note
        // (We could also do a big union. But let's keep it similar to your existing logic.)
        const overlapCount = new Map<string, number>();

        for (const tag of currTags) {
            const noteSet = this.tagIndex.get(tag);
            if (!noteSet) continue;
            for (const candidatePath of noteSet) {
                if (candidatePath === currentNotePath) continue; // skip self
                // We'll just track that this candidate is "in play".
                // We'll compute a final overlap score below.
                overlapCount.set(candidatePath, 0);
            }
        }

        // 3) compute score for each candidate, including prefix overlap + title similarity
        const currentTitle = (this.noteTitleMap.get(currentNotePath) ?? "").toLowerCase();

        const results: { notePath: string; score: number }[] = [];

        // For each candidate that at least shares one *full tag* with the current note,
        // let's compute the deeper prefix-segment overlap.
        overlapCount.forEach((dummy, candidatePath) => {
            // get candidate's tag set
            // First, gather all "full" tags from the candidate
            const candFile = this.app.vault.getAbstractFileByPath(candidatePath);
            if (!(candFile instanceof TFile)) return;

            const candCache = this.app.metadataCache.getFileCache(candFile);
            if (!candCache) return;

            const candTags: Set<string> = new Set();
            if (candCache.tags) {
                for (const t of candCache.tags) {
                    let rawTag = t.tag;
                    if (rawTag.startsWith("#")) rawTag = rawTag.substring(1);
                    candTags.add(rawTag);
                }
            }
            if (candCache.frontmatter && candCache.frontmatter.tags) {
                const fmTags = candCache.frontmatter.tags;
                if (Array.isArray(fmTags)) {
                    fmTags.forEach((tag) => typeof tag === "string" && candTags.add(tag));
                } else if (typeof fmTags === "string") {
                    fmTags.split(/[, ]+/).forEach((t) => t && candTags.add(t));
                }
            }

            // expand to prefix segments
            const candidateSegments = gatherAllPrefixSegmentsForNote(candTags);

            // how many prefix segments are in common?
            let prefixOverlapScore = 0;
            for (const seg of candidateSegments) {
                if (currentNoteSegments.has(seg)) {
                    prefixOverlapScore += 1;
                }
            }

            // plus title similarity
            let titleSimScore = 0;
            const candidateTitle = (this.noteTitleMap.get(candidatePath) ?? "").toLowerCase();
            if (candidateTitle.includes(currentTitle) || currentTitle.includes(candidateTitle)) {
                titleSimScore = 1;
            }

            // total score
            const totalScore = prefixOverlapScore + 2 * titleSimScore;
            results.push({ notePath: candidatePath, score: totalScore });
        });

        // 4) sort descending
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    public getNoteTags(notePath: string): Set<string> {
        return this.noteTagsMap.get(notePath) ?? new Set();
    }
}

/**
 * Expand "person/family/child" into an array (or set) of all prefix segments:
 * ["person", "person/family", "person/family/child"].
 */
function expandTagIntoPrefixes(fullTag: string): string[] {
    const segments = fullTag.split("/");
    const prefixes: string[] = [];
    for (let i = 1; i <= segments.length; i++) {
        // Join the first i segments with "/"
        prefixes.push(segments.slice(0, i).join("/"));
    }
    return prefixes;
}

/**
 * Build a set of all "virtual tags" (prefix segments) for a note.
 * e.g. if note has tags ["person/family", "career/company_name"],
 * this might return [
 *   "person", "person/family",
 *   "career", "career/company_name"
 * ]
 */
function gatherAllPrefixSegmentsForNote(noteTags: Set<string>): Set<string> {
    const allSegments = new Set<string>();
    for (const tag of noteTags) {
        const prefixes = expandTagIntoPrefixes(tag);
        for (const p of prefixes) {
            allSegments.add(p);
        }
    }
    return allSegments;
}
