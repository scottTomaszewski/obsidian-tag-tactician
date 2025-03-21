import {
    App,
    Setting,
    TFile,
    TAbstractFile,
    Modal,
    Notice, parseFrontMatterTags,
} from "obsidian";
import * as yaml from "js-yaml";
import { ExistingTagSuggest, FileTagSuggest } from './TagSuggest';

/**
 * Basic data about a file's tags (current & proposed).
 */
interface FileTagData {
    file: TFile;
    currentTags: string[];
    proposedTags: string[];
    accepted: boolean; // whether this file is selected to receive changes
}

/**
 * Extended data that also includes references to DOM elements in the modal,
 * so we can update checkboxes and proposed-tag spans without casting.
 */
interface RenderableFileTagData extends FileTagData {
    checkboxEl?: HTMLInputElement;  // the file's "Accept/Reject" checkbox
    proposedEl?: HTMLSpanElement;   // the span showing the file's updated tags
}

/**
 * The modal that bulk-edits frontmatter tags across multiple files.
 */
export class EditTagsModal extends Modal {
    // Separate arrays for different categories of files:
    private mdFiles: TFile[];                // valid markdown files
    private nonMarkdownFiles: TAbstractFile[] = [];
    private invalidYamlFiles: TAbstractFile[] = [];

    /**
     * The user's callback, receiving an array of { file, finalTags } after the user applies changes.
     */
    onSubmit: (filesToUpdate: { file: TFile; finalTags: string[] }[]) => void;

    // The user's add/remove arrays, extracted from text inputs
    private tagsToAdd: string[] = [];
    private tagsToRemove: string[] = [];

    // Holds each file's current + proposed tags, along with references to UI elements
    private fileTagData: RenderableFileTagData[] = [];

    private addTagsInput: HTMLInputElement;
    private removeTagsInput: HTMLInputElement;
    private addTagSuggest: ExistingTagSuggest;
    private removeTagSuggest: FileTagSuggest;

    constructor(
        app: App,
        files: TAbstractFile[],
        onSubmit: (filesToUpdate: { file: TFile; finalTags: string[] }[]) => void
    ) {
        super(app);

        // Filter out valid .md files
        this.mdFiles = files.filter(
            (f): f is TFile => f instanceof TFile && f.extension === "md"
        );
        // The rest are "non-markdown" (folders or other extensions)
        this.nonMarkdownFiles = files.filter(
            (f) => !(f instanceof TFile && f.extension === "md")
        );

        this.onSubmit = onSubmit;
    }

    async onOpen() {
        const {contentEl} = this;
        this.modalEl.addClass("tt-bulk-tag-modal");
        contentEl.empty();
        contentEl.createEl("h2", {text: "Bulk edit frontmatter tags"});

        // 1) Warn user about non-markdown files
        if (this.nonMarkdownFiles.length > 0) {
            contentEl.createEl("p", {
                text: `Warning: The following ${
                    this.nonMarkdownFiles.length === 1 ? "item is" : "items are"
                } not Markdown files (won't be modified):`,
            });
            const ul = contentEl.createEl("ul");
            this.nonMarkdownFiles.forEach((f) => {
                ul.createEl("li", {text: f.name});
            });
        }

        // 2) Read frontmatter from each valid MD file (may also skip invalid YAML)
        await this.loadFileTagData();

        // 2a) If we found invalid YAML files, show a warning
        if (this.invalidYamlFiles.length > 0) {
            contentEl.createEl("p", {
                cls: "warning",
                text: `The following file(s) have invalid or duplicate YAML keys (won't be modified):`,
            });
            const ul = contentEl.createEl("ul");
            this.invalidYamlFiles.forEach((f) => {
                ul.createEl("li", {text: f.name});
            });
        }

        // 3) Render the top input fields for "tags to add" / "tags to remove"
        new Setting(contentEl)
            .setName("Add Tags")
            .setDesc("Tags to add to files, separated by commas.")
            .addText(input => {
                input.setPlaceholder("Tags to add (comma separated)")
                .onChange(async (value) => {
                    this.tagsToAdd = this.parseTagInput(value);
                    this.updateProposedTags();
                });
                new ExistingTagSuggest(this.app, input.inputEl);
            });

        new Setting(contentEl)
            .setName("Remove Tags")
            .setDesc("Tags to remove from files, separated by commas.")
            .addText(input => {
                input.setPlaceholder("Tags to remove (comma separated)")
                .onChange(async (value) => {
                    this.tagsToRemove = this.parseTagInput(value);
                    this.updateProposedTags();
                });
                new FileTagSuggest(this.app, input.inputEl, this.mdFiles);
            });
        
        // 4) Add "Select All" / "Deselect All" buttons
        new Setting(contentEl)
            .setName("File selection")
            .setDesc("Check or uncheck all files at once.")
            .addButton((btn) =>
                btn
                    .setButtonText("Select all")
                    .onClick(() => {
                        for (const tagData of this.fileTagData) {
                            tagData.accepted = true;
                            if (tagData.checkboxEl) {
                                tagData.checkboxEl.checked = true;
                            }
                        }
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Deselect all")
                    .onClick(() => {
                        for (const tagData of this.fileTagData) {
                            tagData.accepted = false;
                            if (tagData.checkboxEl) {
                                tagData.checkboxEl.checked = false;
                            }
                        }
                    })
            );

        // 5) Create the container for our "table"
        const tableContainer = contentEl.createEl("div", {
            cls: "bulk-tag-table-container",
        });

        // Header row
        const headerRow = tableContainer.createEl("div", {
            cls: "bulk-tag-table-row table-header-row",
        });
        headerRow.createEl("span", {cls: "cb-col"});
        headerRow.createEl("span", {
            text: "File name",
            cls: "file-name-col header-col",
        });
        headerRow.createEl("span", {
            text: "Current tags",
            cls: "current-tags-col header-col",
        });
        headerRow.createEl("span", {
            text: "Proposed tags",
            cls: "proposed-tags-col header-col",
        });

        // 6) Render each file row
        for (const tagData of this.fileTagData) {
            this.renderFileRow(tableContainer, tagData);
        }

        // 7) Confirm button at the bottom
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.createEl('button', {
            text: 'Apply Changes',
            cls: 'mod-cta'
        }).addEventListener('click', () => this.applyChanges());
        
        buttonContainer.createEl('button', {
            text: 'Cancel'
        }).addEventListener('click', () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }

    /**
     * Loads frontmatter from each MD file. If YAML is invalid, we skip that file.
     */
    private async loadFileTagData() {
        this.fileTagData = [];
        this.invalidYamlFiles = [];

        for (const file of this.mdFiles) {
            const frontmatter = this.app.metadataCache.getFileCache(file).frontmatter;
            let currentTags = parseFrontMatterTags(frontmatter);
            currentTags = currentTags === null ? currentTags = [] : currentTags;

            // remove leading #
            currentTags = currentTags.map((t) => t.startsWith("#") ? t.slice(1) : t);

            const proposedTags = [...currentTags].sort();
            this.fileTagData.push({
                file,
                currentTags,
                proposedTags,
                accepted: true,
            });
        }
    }

    /**
     * Renders a single "row" for the given file's data, storing references to the
     * checkbox and proposed tags elements directly in the tagData object.
     */
    private renderFileRow(containerEl: HTMLElement, tagData: RenderableFileTagData) {
        const rowEl = containerEl.createEl("div", {cls: "bulk-tag-table-row"});

        // Checkbox
        const cbContainer = rowEl.createEl("div", {cls: "cb-col"});
        const checkbox = cbContainer.createEl("input", {type: "checkbox"}) as HTMLInputElement;
        checkbox.checked = tagData.accepted;
        checkbox.onchange = () => {
            tagData.accepted = checkbox.checked;
        };
        // Store a reference for later (no casting needed).
        tagData.checkboxEl = checkbox;

        // File name
        rowEl.createEl("span", {
            text: tagData.file.name,
            cls: "file-name-col",
        });

        // Current tags
        const currTags = rowEl.createEl("span", {cls: "current-tags-col"});
        tagData.currentTags.forEach(t => currTags.createEl("a", {cls: "tag", text: t, attr: {disabled: true}}));

        // Proposed tags
        const propTags = rowEl.createEl("span", {cls: "proposed-tags-col"});
        tagData.proposedTags.forEach(t => propTags.createEl("a", {cls: "tag", text: t, attr: {disabled: true}}));

        // Store a reference to update text later
        tagData.proposedEl = propTags;
    }

    /**
     * Recalculates the proposedTags for each file after user modifies
     * "tags to add" or "tags to remove." Also updates the UI text.
     */
    private updateProposedTags() {
        for (const tagData of this.fileTagData) {
            let newTagSet = [...tagData.currentTags];

            // Add any missing new tags
            for (const tag of this.tagsToAdd) {
                if (!newTagSet.includes(tag)) {
                    newTagSet.push(tag);
                }
            }

            // Remove tags that appear in tagsToRemove
            newTagSet = newTagSet.filter((t) => !this.tagsToRemove.includes(t));

            // Sort the resulting tags.
            newTagSet.sort();

            // Update proposedTags
            tagData.proposedTags = newTagSet;

            // Update the UI if we have a reference
            if (tagData.proposedEl !== undefined) {
                // Clear old tags
                tagData.proposedEl.empty();

                // Rebuild each tag as a disabled <a> element
                newTagSet.forEach((t) => {
                    tagData.proposedEl?.createEl("a", {
                        cls: "tag",
                        text: t,
                        attr: { disabled: true },
                    });
                });
            }
        }
    }

    applyChanges() {

        
        // Gather the final set of files that are accepted
        const updates = this.fileTagData
            .filter((td) => td.accepted)
            .map((td) => ({
                file: td.file,
                finalTags: td.proposedTags,
            }));

        if (updates.length === 0) {
            new Notice("No files selected for update.");
            this.close();
            return;
        }

        this.close();
        this.onSubmit(updates);
    }

    private parseTagInput(input: string): string[] {
        return input.split(/[,\s]+/).filter(tag => tag.trim().length > 0).map(tag => tag.trim());
    }
}

// ----------------------------------------------------------------
// Utility Helpers
// ----------------------------------------------------------------

function parseTagInput(input: string): string[] {
    if (!input || !input.trim()) {
        return [];
    }
    // Split by commas or spaces, remove duplicates
    return Array.from(
        new Set(
            input
                .split(/[, ]+/)
                .map((part) => part.trim())
                .filter((part) => !!part)
        )
    );
}

function normalizeTags(tagsValue: unknown): string[] {
    if (!tagsValue) return [];

    if (Array.isArray(tagsValue)) {
        return tagsValue.flatMap((item) =>
            typeof item === "string" ? item : []
        );
    }

    if (typeof tagsValue === "string") {
        return tagsValue
            .split(/[, ]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
    }

    return [];
}
