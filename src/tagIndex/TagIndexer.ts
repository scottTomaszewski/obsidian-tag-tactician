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

    /**
     * Return an array of "related notes" to `currentNotePath`, sorted by a custom score.
     */
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

        // 2) gather all notes that share at least one of those tags
        const overlapCount = new Map<string, number>();

        for (const tag of currTags) {
            const noteSet = this.tagIndex.get(tag);
            if (!noteSet) continue;
            for (const notePath of noteSet) {
                if (notePath === currentNotePath) continue; // skip self
                overlapCount.set(notePath, (overlapCount.get(notePath) ?? 0) + 1);
            }
        }

        // 3) compute a simple title similarity
        const currentTitle = (this.noteTitleMap.get(currentNotePath) ?? "").toLowerCase();

        const results: { notePath: string; score: number }[] = [];
        overlapCount.forEach((count, notePath) => {
            let titleSimScore = 0;
            const candidateTitle = (this.noteTitleMap.get(notePath) ?? "").toLowerCase();
            if (candidateTitle.includes(currentTitle) || currentTitle.includes(candidateTitle)) {
                titleSimScore = 1;
            }
            const totalScore = count + 2 * titleSimScore;
            results.push({ notePath, score: totalScore });
        });

        // 4) sort descending by score
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    public getNoteTags(notePath: string): Set<string> {
        return this.noteTagsMap.get(notePath) ?? new Set();
    }
}
