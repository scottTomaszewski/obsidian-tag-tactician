import {
    App,
    Setting,
    TFile,
    TAbstractFile,
    Modal,
    Notice,
} from "obsidian";
import * as yaml from "js-yaml";

const FRONTMATTER_REGEX = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---/;

interface FileTagData {
    file: TFile;
    currentTags: string[];
    proposedTags: string[];
    accepted: boolean; // whether this file is selected to receive changes
}

export class EditTagsModal extends Modal {
    mdFiles: TFile[];
    nonMarkdownFiles: TAbstractFile[] = [];
    invalidYamlFiles: TAbstractFile[] = [];

    // Instead of onSubmit(toAdd, toRemove), we now do a more advanced pattern:
    onSubmit: (filesToUpdate: { file: TFile; finalTags: string[] }[]) => void;

    // The user’s add/remove arrays, extracted from text inputs
    private tagsToAdd: string[] = [];
    private tagsToRemove: string[] = [];

    // Holds each file’s current + proposed tags, plus a checkbox state
    private fileTagData: FileTagData[] = [];

    constructor(
        app: App,
        files: TAbstractFile[],
        // We'll pass the final set of updates (per file) to onSubmit
        onSubmit: (filesToUpdate: { file: TFile; finalTags: string[] }[]) => void
    ) {
        super(app);

        // Filter to .md files only
        this.mdFiles = files.filter(
            (f) => f instanceof TFile && f.extension === "md"
        ) as TFile[];

        // Keep everything else as "non-markdown" so we can warn about them
        this.nonMarkdownFiles = files.filter(
            (f) => !(f instanceof TFile && f.extension === "md")
        );

        this.onSubmit = onSubmit;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Bulk Edit Frontmatter Tags" });

        // 1) Warn user about non-markdown files
        if (this.nonMarkdownFiles.length > 0) {
            contentEl.createEl("p", {
                text: `Warning: The following ${
                    this.nonMarkdownFiles.length === 1 ? "item is" : "items are"
                } not Markdown files (won't be modified):`,
            });
            const ul = contentEl.createEl("ul");
            this.nonMarkdownFiles.forEach((f) => {
                ul.createEl("li", { text: f.name });
            });
        }

        // 2) Read frontmatter from each valid MD file to gather current tags (may also skip invalid YAML)
        await this.loadFileTagData();

        // 2a) If we found invalid YAML files, show a warning about them, too
        if (this.invalidYamlFiles.length > 0) {
            contentEl.createEl("p", {
                cls: "warning",
                text: `The following file(s) have invalid or duplicate YAML keys (won't be modified):`,
            });
            const ul = contentEl.createEl("ul");
            this.invalidYamlFiles.forEach((f) => {
                ul.createEl("li", { text: f.name });
            });
        }

        // 3) Render the top input fields for "tags to add" / "tags to remove"
        const addSetting = new Setting(contentEl)
            .setName("Tags to Add (comma or space separated)")
            .addText((text) => {
                text.setPlaceholder("foo, bar/1");
                text.onChange((val) => {
                    this.tagsToAdd = parseTagInput(val);
                    this.updateProposedTags(); // update the table rows in real time
                });
            });

        const removeSetting = new Setting(contentEl)
            .setName("Tags to Remove (comma or space separated)")
            .addText((text) => {
                text.setPlaceholder("bar/2, oldTag");
                text.onChange((val) => {
                    this.tagsToRemove = parseTagInput(val);
                    this.updateProposedTags();
                });
            });

        // 4) Add "Select All" / "Deselect All" buttons
        new Setting(contentEl)
            .setName("File Selection")
            .setDesc("Check or uncheck all files at once.")
            .addButton((btn) =>
                btn
                    .setButtonText("Select All")
                    .onClick(() => {
                        this.fileTagData.forEach((tagData) => {
                            tagData.accepted = true;
                            const checkbox = (tagData as any)._checkboxEl as HTMLInputElement;
                            if (checkbox) {
                                checkbox.checked = true;
                            }
                        });
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Deselect All")
                    .onClick(() => {
                        this.fileTagData.forEach((tagData) => {
                            tagData.accepted = false;
                            const checkbox = (tagData as any)._checkboxEl as HTMLInputElement;
                            if (checkbox) {
                                checkbox.checked = false;
                            }
                        });
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
        headerRow.createEl("span", { cls: "cb-col" });
        headerRow.createEl("span", { text: "File Name", cls: "file-name-col header-col" });
        headerRow.createEl("span", { text: "Current Tags", cls: "current-tags-col header-col" });
        headerRow.createEl("span", { text: "Proposed Tags", cls: "proposed-tags-col header-col" });

        // 6) Render each file row
        this.fileTagData.forEach((tagData) => {
            this.renderFileRow(tableContainer, tagData);
        });

        // 7) Confirm button at the bottom
        new Setting(contentEl)
            .setName("")
            .addButton((btn) =>
                btn
                    .setButtonText("Apply Changes")
                    .setCta()
                    .onClick(() => {
                        // Gather the final set of files that are accepted
                        const updates = this.fileTagData
                            .filter((td) => td.accepted) // only those checked
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
                    })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    // ----------------------------------------------------------------
    // Loads frontmatter for each file to get `currentTags`.
    // If the YAML is invalid or has duplicates keys, we skip it
    // and add that file to this.invalidYamlFiles.
    // ----------------------------------------------------------------
    private async loadFileTagData() {
        this.fileTagData = [];
        this.invalidYamlFiles = [];

        for (const file of this.mdFiles) {
            let fileContent = await this.app.vault.read(file);

            const fmMatch = fileContent.match(FRONTMATTER_REGEX);
            let currentTags: string[] = [];
            let skipFile = false;

            if (fmMatch) {
                const yamlBody = fmMatch[1];
                try {
                    const fmData: any = yaml.load(yamlBody) || {};
                    currentTags = normalizeTags(fmData.tags);
                } catch (err) {
                    console.error(`Failed to parse YAML in ${file.path}`, err);
                    // Skip this file, add to invalidYamlFiles
                    this.invalidYamlFiles.push(file);
                    skipFile = true;
                }
            }

            // If there's no frontmatter at all (fmMatch = null),
            // that's typically fine, we'll just treat it as no tags
            // and create frontmatter if the user adds new ones.
            // No reason to skip it unless you want to.
            // But if skipFile is true, we continue.
            if (skipFile) continue;

            // Proposed tags starts out the same as current
            const proposedTags = [...currentTags];

            this.fileTagData.push({
                file,
                currentTags,
                proposedTags,
                accepted: true,
            });
        }
    }

    // ----------------------------------------------------------------
    // Renders a single "row" for the given file's data
    // ----------------------------------------------------------------
    private renderFileRow(
        containerEl: HTMLElement,
        tagData: FileTagData
    ) {
        // You can style this row with CSS to look like a table
        const rowEl = containerEl.createEl("div", { cls: "bulk-tag-table-row" });

        // A checkbox for accept/reject
        const checkbox = rowEl.createEl("input", {
            type: "checkbox",
            cls: "cb-col",
        });
        checkbox.checked = tagData.accepted;
        checkbox.onchange = () => {
            tagData.accepted = checkbox.checked;
        };

        (tagData as any)._checkboxEl = checkbox;

        // File name
        rowEl.createEl("span", {
            text: tagData.file.name,
            cls: "file-name-col",
        });

        // Current tags
        rowEl.createEl("span", {
            text: tagData.currentTags.join(", "),
            cls: "current-tags-col",
        });

        // Proposed tags
        const proposedEl = rowEl.createEl("span", {
            text: tagData.proposedTags.join(", "),
            cls: "proposed-tags-col",
        });
        (tagData as any)._proposedSpanEl = proposedEl;
    }

    // ----------------------------------------------------------------
    // Recalculate the proposedTags for each file after user input
    // ----------------------------------------------------------------
    private updateProposedTags() {
        for (const tagData of this.fileTagData) {
            // Start from the file’s current tags
            let newTagSet = [...tagData.currentTags];

            // 1) Add new tags if missing
            for (const tag of this.tagsToAdd) {
                if (!newTagSet.includes(tag)) {
                    newTagSet.push(tag);
                }
            }

            // 2) Remove tags that appear in tagsToRemove
            newTagSet = newTagSet.filter((t) => !this.tagsToRemove.includes(t));

            // Update the row data
            tagData.proposedTags = newTagSet;

            // Also update the UI text
            const proposedEl = (tagData as any)._proposedSpanEl as HTMLElement;
            if (proposedEl) {
                proposedEl.textContent = newTagSet.join(", ");
            }
        }
    }
}

// ----------------------------------------------------------------
// Utility Helpers
// ----------------------------------------------------------------

function parseTagInput(input: string): string[] {
    if (!input || !input.trim()) {
        return []; // return an empty array if there's no actual input
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
