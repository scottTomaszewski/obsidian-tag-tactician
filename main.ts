import {
    App,
    Menu,
    Notice,
    Plugin,
    TAbstractFile,
    TFile,
    TFolder
} from "obsidian";
import * as yaml from "js-yaml";
import {EditTagsModal} from "./src/io/EditTagsModal";
import {applyTagUpdates} from "./src/io/FileTagProcessor";
import {BulkFrontmatterTagSettingsTab} from "./src/settings/BulkFrontmatterTagSettingsTab";

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

export default class BulkFrontmatterTagManager extends Plugin {
    settings: BulkFrontmatterTagSettings;

    async onload() {
        console.log("Loading Bulk Frontmatter Tag Manager plugin...");
        await this.loadSettings();

        // --------------------------------------------------------------------
        // Register "file-menu" event for single right-click selection
        // --------------------------------------------------------------------
        this.registerEvent(
            this.app.workspace.on(
                "file-menu",
                (menu: Menu, file: TAbstractFile, source: string) => {
                    // "file" is a single TAbstractFile. We'll wrap it in an array.
                    if (!file) return;
                    this.addTagMenuItem(menu, [file]);
                }
            )
        );

        // --------------------------------------------------------------------
        // Register "files-menu" event for multi-selections
        // --------------------------------------------------------------------
        this.registerEvent(
            this.app.workspace.on(
                "files-menu",
                (menu: Menu, files: TAbstractFile[], source: string) => {
                    if (!files || files.length === 0) return;
                    this.addTagMenuItem(menu, files);
                }
            )
        );

        this.addSettingTab(new BulkFrontmatterTagSettingsTab(this.app, this));
    }

    onunload() {
        console.log("Unloading Bulk Frontmatter Tag Manager plugin...");
    }

    // --------------------------------------------------------------------
    // Adds the "Edit Tags (Frontmatter)" item to the right-click menu
    // for the given selection of files/folders.
    // --------------------------------------------------------------------
    private addTagMenuItem(menu: Menu, selection: TAbstractFile[]) {
        menu.addItem((item) => {
            item
                .setTitle("Edit Tags (Frontmatter)")
                .setIcon("hashtag")
                .onClick(async () => {
                    // Expand any folders in the selection into all .md files
                    const allItems = expandFolders(selection);

                    // Open the advanced modal
                    new EditTagsModal(
                        this.app,
                        allItems,
                        async (updates) => {
                            // `updates` => array of { file, finalTags }
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
    // Helpers
    // --------------------------------
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
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
            // TFile or something else—just add directly
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
