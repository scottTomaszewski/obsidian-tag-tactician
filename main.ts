import {
    App,
    Menu,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TAbstractFile,
    TFile,
    TFolder,
    ItemView,
    WorkspaceLeaf,
    MarkdownView,
} from "obsidian";
import * as yaml from "js-yaml";

import { EditTagsModal } from "./src/io/EditTagsModal";
import { applyTagUpdates } from "./src/io/FileTagProcessor";
import { BulkFrontmatterTagSettingsTab } from "./src/settings/BulkFrontmatterTagSettingsTab";

/**
 * -- Settings & Defaults (unchanged) --
 */
export type TagListStyle = "hyphens" | "brackets";

export interface BulkFrontmatterTagSettings {
    showNonMarkdownWarning: boolean;
    tagListStyle: TagListStyle;
}

export const DEFAULT_SETTINGS: BulkFrontmatterTagSettings = {
    showNonMarkdownWarning: true,
    tagListStyle: "hyphens", // could be "hyphens" or "brackets" by default
};

const FRONTMATTER_REGEX = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---/;

// We'll use a unique type for the related notes sidebar.
const RELATED_NOTES_VIEW_TYPE = "related-notes-view";

/**
 * Main Plugin Class
 */
export default class BulkFrontmatterTagManager extends Plugin {
    settings: BulkFrontmatterTagSettings;

    // ---------------------------
    // Fields for Related-Notes
    // ---------------------------
    private tagIndex: Map<string, Set<string>> = new Map(); // e.g. "person" -> Set(["Notes/Jon.md", "Notes/Sally.md"])
    private noteTitleMap: Map<string, string> = new Map();  // e.g. "Notes/Jon.md" -> "Jon"
    private activeFilePath: string | null = null;

    /**
     * onload: Called by Obsidian when the plugin is activated.
     */
    async onload() {
        console.log("Loading Bulk Frontmatter Tag Manager plugin...");
        await this.loadSettings();

        // 1) Register file-menu (single file) event
        this.registerEvent(
            this.app.workspace.on(
                "file-menu",
                (menu: Menu, file: TAbstractFile, source: string) => {
                    if (!file) return;
                    this.addTagMenuItem(menu, [file]);
                }
            )
        );

        // 2) Register files-menu (multiple selection) event
        this.registerEvent(
            this.app.workspace.on(
                "files-menu",
                (menu: Menu, files: TAbstractFile[], source: string) => {
                    if (!files || files.length === 0) return;
                    this.addTagMenuItem(menu, files);
                }
            )
        );

        // 4) Register a custom view for "Related Notes"
        this.registerView(
            RELATED_NOTES_VIEW_TYPE,
            (leaf) => new RelatedNotesView(leaf, this)
        );

        // 5) Add a command (or ribbon icon) to toggle the related notes view
        this.addCommand({
            id: "open-related-notes-view",
            name: "Open Related Notes Sidebar",
            callback: () => this.activateRelatedNotesView(),
        });

        // 6) Listen for active note changes, update `activeFilePath` & refresh the view.
        //    But ONLY if the new active leaf has a MarkdownView (i.e., it's a note).
        let timer: number | null = null;
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                window.clearTimeout(timer!);
                timer = window.setTimeout(() => {
                    // Try to get the currently active MarkdownView
                    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (!mdView) {
                        // If it's not a markdown file (could be file explorer, settings, etc.), DO NOTHING
                        return;
                    }

                    // We have a markdown view, so update
                    const file = mdView.file;
                    this.activeFilePath = file?.path ?? null;
                    this.updateRelatedNotesView();
                }, 150);
            })
        );


        this.addSettingTab(new BulkFrontmatterTagSettingsTab(this.app, this));

        // Build Tag Index for "Related Notes" (after layout is ready.  This is to avoid issues with the index not being populated)
        this.app.workspace.onLayoutReady(async () => {
            await this.buildRelatedNotesIndex();
        });

        console.log("BulkFrontmatterTagManager onload complete.");
    }

    /**
     * onunload: Called by Obsidian when the plugin is deactivated.
     */
    onunload() {
        console.log("Unloading Bulk Frontmatter Tag Manager plugin...");
        // Detach the related-notes view if open
        this.app.workspace.detachLeavesOfType(RELATED_NOTES_VIEW_TYPE);
    }

    // --------------------------------
    // Bulk Tag Manager: Right-Click Menu
    // --------------------------------
    private addTagMenuItem(menu: Menu, selection: TAbstractFile[]) {
        menu.addItem((item) => {
            item
                .setTitle("Edit Tags (Frontmatter)")
                .setIcon("hashtag")
                .onClick(async () => {
                    // Expand any folders in the selection into all .md files
                    const allItems = expandFolders(selection);

                    // Open the advanced modal for bulk tag editing
                    new EditTagsModal(
                        this.app,
                        allItems,
                        async (updates) => {
                            // updates => array of { file, finalTags }
                            const modifiedCount = await applyTagUpdates(
                                this.app,
                                updates,
                                this.settings
                            );
                            new Notice(`Updated frontmatter tags in ${modifiedCount} file(s).`);
                        }
                    ).open();
                });
        });
    }

    // --------------------------------
    // Helpers for Bulk Tag Manager
    // --------------------------------
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // --------------------------------
    // Related Notes Feature
    // --------------------------------

    /**
     * Build a global index of tags -> note paths, and notePath -> noteTitle,
     * so we can quickly find "related notes."
     */
    private async buildRelatedNotesIndex() {
        const allFiles = this.app.vault.getMarkdownFiles();
        this.tagIndex.clear();
        this.noteTitleMap.clear();

        for (const file of allFiles) {
            await this.indexSingleFile(file);
        }

        console.log(`[RelatedNotes] Indexed ${allFiles.length} files.`);
    }

    /**
     * Index a single file for tags and note title.
     */
    private async indexSingleFile(file: TFile) {
        const notePath = file.path;
        const content = await this.app.vault.read(file);

        // 1) Gather all tags
        const cache = this.app.metadataCache.getFileCache(file);
        const tags: Set<string> = new Set();

        // Inline tags from cache
        if (cache?.tags) {
            for (const t of cache.tags) {
                let rawTag = t.tag; // e.g. #topic/health
                if (rawTag.startsWith("#")) {
                    rawTag = rawTag.substring(1);
                }
                tags.add(rawTag);
            }
        }

        // Frontmatter tags
        if (cache?.frontmatter && cache.frontmatter.tags) {
            const fmTags = cache.frontmatter.tags;
            if (Array.isArray(fmTags)) {
                fmTags.forEach((t) => typeof t === "string" && tags.add(t));
            } else if (typeof fmTags === "string") {
                fmTags.split(/[, ]+/).forEach((t) => t && tags.add(t));
            }
        }

        // Update tagIndex
        for (const t of tags) {
            if (!this.tagIndex.has(t)) {
                this.tagIndex.set(t, new Set());
            }
            this.tagIndex.get(t)!.add(notePath);
        }

        // 2) Figure out a note title
        let noteTitle = file.basename;
        if (cache?.frontmatter && typeof cache.frontmatter.title === "string") {
            noteTitle = cache.frontmatter.title;
        } else if (cache?.headings && cache.headings.length > 0) {
            noteTitle = cache.headings[0].heading; // 1st heading
        }

        this.noteTitleMap.set(notePath, noteTitle);
    }

    /**
     * We only need to re-compute if the user flips to a new active file or we re-index.
     * We'll notify our custom view to refresh.
     */
    public updateRelatedNotesView() {
        const leaves = this.app.workspace.getLeavesOfType(RELATED_NOTES_VIEW_TYPE);
        if (!leaves.length) return;
        const leaf = leaves[0];
        const view = leaf.view instanceof RelatedNotesView ? leaf.view : null;
        if (view) {
            view.refresh();
        }
    }

    /**
     * Opens (or reveals) the "Related Notes" sidebar.
     */
    async activateRelatedNotesView() {
        let leaf = this.app.workspace.getLeavesOfType(RELATED_NOTES_VIEW_TYPE).first();
        if (!leaf) {
            // create a new leaf in right sidebar
            leaf = this.app.workspace.getRightLeaf(false);
            await leaf.setViewState({ type: RELATED_NOTES_VIEW_TYPE });
        }
        this.app.workspace.revealLeaf(leaf);
        this.updateRelatedNotesView();
    }

    /**
     * Compute an ordered list of "related" notes for the active file,
     * factoring in shared tags + partial title match.
     */
    public computeRelatedNotes(): Array<{ notePath: string; score: number }> {
        if (!this.activeFilePath) return [];

        const currentNotePath = this.activeFilePath;
        // gather current note tags by scanning tagIndex in reverse (less efficient) or by re-scanning:
        // For performance, let's re-scan from metadata
        const file = this.app.vault.getAbstractFileByPath(currentNotePath);
        if (!(file instanceof TFile)) return [];

        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return [];

        // gather current note's tags
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
                fmTags.forEach((t) => typeof t === "string" && currTags.add(t));
            } else if (typeof fmTags === "string") {
                fmTags.split(/[, ]+/).forEach((t) => t && currTags.add(t));
            }
        }

        // Merge all notes that share at least one tag
        const overlapCount = new Map<string, number>(); // notePath -> overlap
        for (const tag of currTags) {
            const noteSet = this.tagIndex.get(tag);
            if (!noteSet) continue;
            for (const n of noteSet) {
                if (n === currentNotePath) continue; // skip self
                overlapCount.set(n, (overlapCount.get(n) ?? 0) + 1);
            }
        }

        // compute a title similarity with the current note
        const currentTitle = (this.noteTitleMap.get(currentNotePath) ?? "").toLowerCase();

        const results: Array<{ notePath: string; score: number }> = [];
        overlapCount.forEach((count, notePath) => {
            // Tag overlap score is 'count'

            let titleSimScore = 0;
            const candidateTitle = (this.noteTitleMap.get(notePath) ?? "").toLowerCase();
            // e.g. if "Jon" is contained in "Jon's meeting", or vice versa
            if (
                currentTitle.includes(candidateTitle) ||
                candidateTitle.includes(currentTitle)
            ) {
                titleSimScore = 1; // or do more advanced approach
            }

            // Weighted sum: e.g. tags + 2 * titleSim
            const totalScore = count + 2 * titleSimScore;

            results.push({ notePath, score: totalScore });
        });

        // sort descending by score
        results.sort((a, b) => b.score - a.score);
        return results;
    }
}

/**
 * A custom view that displays "Related Notes" in the sidebar.
 */
class RelatedNotesView extends ItemView {
    plugin: BulkFrontmatterTagManager;

    constructor(leaf: WorkspaceLeaf, plugin: BulkFrontmatterTagManager) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return RELATED_NOTES_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Related Notes";
    }

    async onOpen() {
        // Initial render
        this.refresh();
    }

    async onClose() {
        // Cleanup if needed
    }

    /**
     * Rebuilds the sidebar content
     */
    public refresh() {
        const container = this.containerEl;
        container.empty();

        container.createEl("h2", { text: "Related Notes" });

        // compute related notes
        const results = this.plugin.computeRelatedNotes();
        if (!results.length) {
            container.createEl("p", {
                text: "No related notes found.",
            });
            return;
        }

        // show top ~10
        const topResults = results.slice(0, 10);
        for (const { notePath, score } of topResults) {
            const row = container.createEl("div", { cls: "related-note-row" });
            row.createEl("div", { text: `Score: ${score}`, cls: "related-note-score" });

            const noteTitle = this.plugin.noteTitleMap.get(notePath) ?? notePath;
            const link = row.createEl("a", {
                cls: "related-note-link",
                text: noteTitle,
            });
            link.onclick = () => {
                const file = this.app.vault.getAbstractFileByPath(notePath);
                if (file instanceof TFile) {
                    this.app.workspace.getLeaf().openFile(file);
                }
            };
        }
    }
}

/**
 * Recursively expand any selected folders into all their files (including nested folders),
 * while leaving non-folder items as-is.
 */
function expandFolders(selection: TAbstractFile[]): TAbstractFile[] {
    const results: TAbstractFile[] = [];

    for (const item of selection) {
        if (item instanceof TFolder) {
            gatherFolderContents(item, results);
        } else {
            results.push(item);
        }
    }

    return results;
}

/**
 * Recursively collect all children of the given folder into `accumulator`.
 */
function gatherFolderContents(folder: TFolder, accumulator: TAbstractFile[]) {
    for (const child of folder.children) {
        if (child instanceof TFolder) {
            gatherFolderContents(child, accumulator);
        } else {
            accumulator.push(child);
        }
    }
}
