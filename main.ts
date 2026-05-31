import {
    Menu,
    Notice,
    Plugin,
    TAbstractFile,
    TFolder,
    MarkdownView,
    TFile,
    Vault,
    EventRef,
} from "obsidian";

import { EditTagsModal } from "./src/batch/EditTagsModal";
import { applyTagUpdates } from "./src/batch/FileTagProcessor";
import { TagTacticianSettingTab } from "./src/settings/TagTacticianSettingTab";
import { TagTacticianSettings, DEFAULT_SETTINGS } from "./src/settings/PluginSettings";
import { TagIndexer } from "./src/relatedView/TagIndexer";
import { RelatedNotesView, RELATED_NOTES_VIEW_TYPE } from "./src/relatedView/RelatedNotesView";
import { NavByTagView, TAG_NAVIGATION_VIEW_TYPE } from "./src/navByTag/NavByTagView";

/** Shape of a search result child exposed by the (untyped) search view. */
interface SearchResultItem {
    file: TFile;
}

/** Minimal shape of the search leaf passed to the "search:results-menu" event. */
interface SearchResultsLeaf {
    dom: { vChildren: { children: SearchResultItem[] } };
}

// The "search:results-menu" event is not part of Obsidian's public typings.
// Augment the Workspace interface so it can be used without resorting to `any`.
declare module "obsidian" {
    interface Workspace {
        on(
            name: "search:results-menu",
            callback: (menu: Menu, leaf: SearchResultsLeaf) => unknown,
        ): EventRef;
    }
}

/**
 * Main plugin class for Tag Tactician
 */
export default class TagTacticianPlugin extends Plugin {
    settings: TagTacticianSettings;
    public tagIndexer: TagIndexer;
    private activeFilePath: string | null = null;

    async onload() {
        await this.loadSettings();

        // Setup plugin features
        this.setupBatchTagEditing();
        this.setupRelatedNotesView();
        this.setupNavByTag();

        // Add the settings tab
        this.addSettingTab(new TagTacticianSettingTab(this.app, this));
    }

    /**
     * Clean up when plugin is disabled. Obsidian detaches the plugin's leaves
     * automatically, so no manual cleanup is required here.
     */
    onunload() {
    }

    // --------------------------------
    // Settings
    // --------------------------------
    
    /**
     * Load plugin settings
     */
    async loadSettings() {
        const data = (await this.loadData()) as Partial<TagTacticianSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }

    /**
     * Save plugin settings
     */
    async saveSettings() {
        await this.saveData(this.settings);
    }

    // --------------------------------
    // Batch Tag Editing
    // --------------------------------
    
    /**
     * Set up batch tag editing feature
     */
    private setupBatchTagEditing() {
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

        // Search results menu command
        this.registerEvent(
            this.app.workspace.on("search:results-menu", (menu: Menu, leaf: SearchResultsLeaf) => {
                const files = leaf.dom.vChildren.children.map((child) => child.file);
                if (files.length < 1) return;

                menu.addItem((item) => {
                    item
                        .setTitle(`Edit tags on ${files.length} notes...`)
                        .setIcon("tag")
                        .onClick(() => {
                            new EditTagsModal(this.app, files, async (updates) => {
                                const modifiedCount = await applyTagUpdates(
                                    this.app,
                                    updates,
                                    this.settings
                                );
                                new Notice(`Updated frontmatter tags in ${modifiedCount} file(s).`);
                            }).open();
                        });
                })
            })
        )
    }

    /**
     * Add tag editing menu item to the context menu
     */
    private addTagMenuItem(menu: Menu, selection: TAbstractFile[]) {
        menu.addItem((item) => {
            item
                .setTitle("Edit tags (frontmatter)")
                .setIcon("hashtag")
                .onClick(() => {
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
    // Related Notes
    // --------------------------------
    
    /**
     * Set up the Related Notes view
     */
    private setupRelatedNotesView() {
        // Initialize the TagIndexer (for "Related Notes")
        this.tagIndexer = new TagIndexer(this);
        
        // Register the "Related Notes" view
        this.registerView(RELATED_NOTES_VIEW_TYPE, (leaf) => new RelatedNotesView(leaf, this));

        // Add command to show the "Related Notes" sidebar
        this.addCommand({
            id: "open-related-notes-view",
            name: "Open related notes sidebar",
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
        });
    }

    /**
     * Update the Related Notes view
     */
    public updateRelatedNotesView() {
        const leaves = this.app.workspace.getLeavesOfType(RELATED_NOTES_VIEW_TYPE);
        if (!leaves.length) return;
        const leaf = leaves[0];
        const view = leaf.view instanceof RelatedNotesView ? leaf.view : null;
        if (view) view.refresh();
    }

    /**
     * Activate the Related Notes view
     */
    async activateRelatedNotesView() {
        // Find existing leaf or create a new one
        const leaves = this.app.workspace.getLeavesOfType(RELATED_NOTES_VIEW_TYPE);
        let leaf = leaves.length > 0 ? leaves[0] : null;
        
        if (!leaf) {
            // Create a new leaf
            const rightLeaf = this.app.workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({type: RELATED_NOTES_VIEW_TYPE});
                void this.app.workspace.revealLeaf(rightLeaf);
            }
        } else {
            // Use existing leaf
            void this.app.workspace.revealLeaf(leaf);
        }
        this.updateRelatedNotesView();
    }

    /**
     * Compute notes related to the active note
     * We re-scan the current note's tags, then ask `tagIndexer` to rank.
     */
    public computeRelatedNotes(): Array<{ notePath: string; score: number }> {
        if (!this.activeFilePath) return [];
        return this.tagIndexer.computeRelatedNotes(this.activeFilePath);
    }

    // --------------------------------
    // Nav By Tag
    // --------------------------------
    
    /**
     * Set up the Tag Navigation view
     */
    private setupNavByTag() {
        this.registerView(
            TAG_NAVIGATION_VIEW_TYPE,
            (leaf) => new NavByTagView(leaf, this)
        );

        // Add a command to open the tag-based file navigation view
        this.addCommand({
            id: "open-tag-navigation-view",
            name: "Open tag-based file navigation",
            callback: () => this.activateTagNavigationView(),
        });

        // Refresh the navigation view when metadata changes (debounced)
        let timer: number | null = null;
        this.registerEvent(
            this.app.metadataCache.on("changed", () => {
                window.clearTimeout(timer ?? undefined);
                timer = window.setTimeout(() => this.refreshTagNavigationView(), 150);
            })
        );
    }

    /**
     * Activate the Tag Navigation view
     */
    async activateTagNavigationView() {
        // Find existing leaf or create a new one
        const leaves = this.app.workspace.getLeavesOfType(TAG_NAVIGATION_VIEW_TYPE);
        let leaf = leaves.length > 0 ? leaves[0] : null;
        
        if (!leaf) {
            // Create a new leaf
            const leftLeaf = this.app.workspace.getLeftLeaf(false);
            if (leftLeaf) {
                await leftLeaf.setViewState({ type: TAG_NAVIGATION_VIEW_TYPE });
                await this.app.workspace.revealLeaf(leftLeaf);
            }
        } else {
            // Use existing leaf
            await this.app.workspace.revealLeaf(leaf);
        }
    }

    refreshTagNavigationView() {
        const leaves = this.app.workspace.getLeavesOfType(TAG_NAVIGATION_VIEW_TYPE);
        const leaf = leaves.length > 0 ? leaves[0] : null;
        if (!leaf) return;
        const view = leaf.view instanceof NavByTagView ? leaf.view : null;
        if (view) view.refresh();
    }
}

/**
 * Helper function to expand folders to files for batch operations
 */
function expandFolders(selection: TAbstractFile[]): TAbstractFile[] {
    const results: TAbstractFile[] = [];
    for (const item of selection) {
        if (item instanceof TFolder) {
            Vault.recurseChildren(item, (child) => {
                if (child instanceof TFile) {
                    results.push(child);
                }
            });
        } else {
            // If it's not a folder, just add it as-is
            results.push(item);
        }
    }
    return results;
}
