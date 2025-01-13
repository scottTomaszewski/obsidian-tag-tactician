import {
    Menu,
    Notice,
    Plugin,
    TAbstractFile,
    TFolder,
    MarkdownView,
} from "obsidian";

import {EditTagsModal} from "./src/batch/EditTagsModal";
import {applyTagUpdates} from "./src/batch/FileTagProcessor";
import {TagTacticianSettingTab} from "./src/settings/TagTacticianSettingTab";

import {TagTacticianSettings, DEFAULT_SETTINGS} from "./src/settings/PluginSettings";
import {TagIndexer} from "./src/relatedView/TagIndexer";
import {RelatedNotesView, RELATED_NOTES_VIEW_TYPE} from "./src/relatedView/RelatedNotesView";

export default class TagTacticianPlugin extends Plugin {
    settings: TagTacticianSettings;

    // "Related Notes" fields can now live in a separate class, but we keep a reference here:
    public tagIndexer: TagIndexer;
    private activeFilePath: string | null = null;

    async onload() {
        console.log("Loading Tag Tactician plugin...");
        await this.loadSettings();

        // Register events for the Bulk Tag Editing
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file) => {
                if (!file) return;
                this.addTagMenuItem(menu, [file]);
            })
        );
        this.registerEvent(
            this.app.workspace.on("files-menu", (menu, files) => {
                if (!files || files.length === 0) return;
                this.addTagMenuItem(menu, files);
            })
        );

        // Initialize the TagIndexer (for "Related Notes")
        this.tagIndexer = new TagIndexer(this);

        // Register the "Related Notes" view
        this.registerView(RELATED_NOTES_VIEW_TYPE, (leaf) => new RelatedNotesView(leaf, this));

        // 4) Add command to show the "Related Notes" sidebar
        this.addCommand({
            id: "open-related-notes-view",
            name: "Open Related Notes Sidebar",
            callback: () => this.activateRelatedNotesView(),
        });

        // Listen for active note changes (only if it's a MarkdownView)
        let timer: number | null = null;
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                window.clearTimeout(timer!);
                timer = window.setTimeout(() => {
                    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (!mdView) return;
                    const file = mdView.file;
                    this.activeFilePath = file?.path ?? null;
                    this.updateRelatedNotesView();
                }, 150);
            })
        );

        // Handle note previews in the "related notes" view
        this.registerHoverLinkSource(
            RELATED_NOTES_VIEW_TYPE,
            {
                display: 'Related Notes',
                defaultMod: true,
            },
        );

        // Build the tag index after layout is ready (so getMarkdownFiles() won't be empty)
        this.app.workspace.onLayoutReady(async () => {
            await this.tagIndexer.buildIndex();
            console.log(`[RelatedNotes] Index built after layout ready.`);
        });

        // Add the settings tab
        this.addSettingTab(new TagTacticianSettingTab(this.app, this));
    }

    onunload() {
        console.log("Unloading Tag Tactician plugin...");
        this.app.workspace.detachLeavesOfType(RELATED_NOTES_VIEW_TYPE);
    }

    private addTagMenuItem(menu: Menu, selection: TAbstractFile[]) {
        menu.addItem((item) => {
            item
                .setTitle("Edit Tags (Frontmatter)")
                .setIcon("hashtag")
                .onClick(async () => {
                    const allItems = expandFolders(selection);
                    new EditTagsModal(this.app, allItems, async (updates) => {
                        const modifiedCount = await applyTagUpdates(
                            this.app,
                            updates,
                            this.settings
                        );
                        new Notice(`Updated frontmatter tags in ${modifiedCount} file(s).`);
                    }).open();
                });
        });
    }

    // --------------------------------
    // Settings
    // --------------------------------
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // --------------------------------
    // Related Notes
    // --------------------------------
    public updateRelatedNotesView() {
        const leaves = this.app.workspace.getLeavesOfType(RELATED_NOTES_VIEW_TYPE);
        if (!leaves.length) return;
        const leaf = leaves[0];
        const view = leaf.view instanceof RelatedNotesView ? leaf.view : null;
        if (view) view.refresh();
    }

    async activateRelatedNotesView() {
        let leaf = this.app.workspace.getLeavesOfType(RELATED_NOTES_VIEW_TYPE).first();
        if (!leaf) {
            leaf = this.app.workspace.getRightLeaf(false);
            await leaf.setViewState({type: RELATED_NOTES_VIEW_TYPE});
        }
        this.app.workspace.revealLeaf(leaf);
        this.updateRelatedNotesView();
    }

    /**
     * We re-scan the current note's tags, then ask `tagIndexer` to rank.
     */
    public computeRelatedNotes(): Array<{ notePath: string; score: number }> {
        if (!this.activeFilePath) return [];

        return this.tagIndexer.computeRelatedNotes(this.activeFilePath);
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

function gatherFolderContents(folder: TFolder, accumulator: TAbstractFile[]) {
    for (const child of folder.children) {
        if (child instanceof TFolder) {
            gatherFolderContents(child, accumulator);
        } else {
            accumulator.push(child);
        }
    }
}
