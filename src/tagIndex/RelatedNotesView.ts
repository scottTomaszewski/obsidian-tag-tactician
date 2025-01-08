// src/tagIndex/RelatedNotesView.ts

import {ItemView, WorkspaceLeaf, TFile, Menu, setIcon} from "obsidian";
import BulkFrontmatterTagManager from "../../main";

/**
 * Unique ID for the related notes view (shared with main.ts).
 */
export const RELATED_NOTES_VIEW_TYPE = "related-notes-view";

/**
 * A custom view that displays "Related Notes" in the sidebar.
 */
export class RelatedNotesView extends ItemView {
    plugin: BulkFrontmatterTagManager;

    /** User-entered filter text for live filtering notes. */
    private filterQuery: string = "";

    /** Whether to show each note’s tags under its title. */
    private showTags: boolean = false;

    /** Whether to show each note’s score next to it. */
    private showScore: boolean = true;

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
        this.refresh();
    }

    async onClose() {
        // Cleanup if needed
    }

    /**
     * Rebuilds the entire sidebar content, including controls and the note list.
     */
    public refresh() {
        const container = this.containerEl;
        container.addClass("related-notes-container")
        container.empty();

        // Title
        const headerRow = container.createEl("div", {cls: "related-notes-header"});
        headerRow.createEl("h2", {text: "Related Notes"});

        // Single "Options" button that opens a menu
        const optionsBtn = headerRow.createEl("button", {cls: "clickable-icon"});
        setIcon(optionsBtn, "gear");
        optionsBtn.style.marginLeft = "1rem";

        // Handle clicking the button => show menu
        optionsBtn.onclick = (evt: MouseEvent) => {
            const menu = new Menu(this.app);

            // Menu item: Show Tags
            menu.addItem((item) => {
                item
                    .setTitle((this.showTags ? "✓ " : "") + "Show Tags")
                    .onClick(() => {
                        this.showTags = !this.showTags;
                        this.refreshList();
                    });
            });

            // Menu item: Show Score
            menu.addItem((item) => {
                item
                    .setTitle((this.showScore ? "✓ " : "") + "Show Score")
                    .onClick(() => {
                        this.showScore = !this.showScore;
                        this.refreshList();
                    });
            });

            // Show the menu at the mouse event location
            menu.showAtMouseEvent(evt);
        };

        // -- 1) Controls/Filters UI --
        const controls = container.createEl("div", {cls: "related-notes-controls"});

        // Text box for live filtering
        const filterInput = controls.createEl("input", {
            type: "search",
            placeholder: "Filter related notes...",
            cls: "filter-input"
        });
        filterInput.value = this.filterQuery;
        filterInput.style.minWidth = "120px";
        filterInput.oninput = () => {
            this.filterQuery = filterInput.value.trim().toLowerCase();
            this.refreshList(); // re-render note list only
        };

        // -- 2) Container for the note list --
        const listContainer = container.createEl("div", {
            cls: "related-notes-list-container",
        });
        this.renderNoteList(listContainer);
    }

    /**
     * Rerender just the note list portion, preserving the top controls.
     */
    private refreshList() {
        const listContainer = this.containerEl.querySelector(
            ".related-notes-list-container"
        ) as HTMLElement;
        if (listContainer) {
            listContainer.empty();
            this.renderNoteList(listContainer);
        }
    }

    /**
     * Actually render the note items into the given container,
     * applying any filters and toggles.
     */
    private renderNoteList(container: HTMLElement) {
        // Get the raw results from the plugin
        const results = this.plugin.computeRelatedNotes();

        if (!results.length) {
            container.createEl("p", {text: "No related notes found."});
            return;
        }

        // We'll filter them by the current filterQuery:
        const filteredResults = this.applyFilter(results);

        if (!filteredResults.length) {
            container.createEl("p", {text: "No notes match your filter."});
            return;
        }

        // Show top ~10 after filtering
        const topResults = filteredResults.slice(0, 10);
        for (const {notePath, score} of topResults) {
            const item = container.createEl("div", {cls: "related-note-item"});

            const firstRow = item.createEl("div", {cls: "related-note-first-row"});
            // Score (conditionally displayed)
            if (this.showScore) {
                firstRow.createEl("span", {
                    text: `(${score}) `,
                    cls: "related-note-score",
                });
            }

            // Title link
            const noteTitle = this.plugin.tagIndexer["noteTitleMap"].get(notePath) ?? notePath;
            const link = firstRow.createEl("a", {
                cls: "related-note-link",
                text: noteTitle,
            });
            link.title = notePath; // tooltip
            link.onclick = () => {
                const file = this.app.vault.getAbstractFileByPath(notePath);
                if (file instanceof TFile) {
                    this.app.workspace.getLeaf().openFile(file);
                }
            };

            // Optionally show tags
            if (this.showTags) {
                const noteTags = this.plugin.tagIndexer.getNoteTags(notePath);
                if (noteTags.size > 0) {
                    const tagLine = item.createEl("div", {cls: "related-note-tags"});
                    // TODO - move this to the css file
                    tagLine.style.marginLeft = "1.5em"; // indent
                    tagLine.style.marginBottom = "0.5rem";
                    tagLine.style.fontSize = "90%";
                    noteTags.forEach(t => tagLine.createEl("a", {cls: "tag", text: t, attr: {disabled: true}}));
                }
            }
        }
    }

    /**
     * Returns a filtered subset of the raw results, based on `this.filterQuery`,
     * matching either the note title or any of its tags.
     */
    private applyFilter(
        results: Array<{ notePath: string; score: number }>
    ): Array<{ notePath: string; score: number }> {
        // If there's no filter text, return them all
        if (!this.filterQuery) return results;

        const filter = this.filterQuery;
        const output: Array<{ notePath: string; score: number }> = [];

        for (const item of results) {
            const notePath = item.notePath;
            const title = this.plugin.tagIndexer["noteTitleMap"].get(notePath) ?? notePath;
            const noteTags = this.plugin.tagIndexer.getNoteTags(notePath);

            // Check if the title or any tag includes the filter text
            if (title.toLowerCase().includes(filter)) {
                output.push(item);
                continue;
            }

            const hasTagMatch = Array.from(noteTags).some((t) =>
                t.toLowerCase().includes(filter)
            );
            if (hasTagMatch) {
                output.push(item);
            }
        }
        return output;
    }
}
