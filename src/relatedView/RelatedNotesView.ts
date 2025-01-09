import { ItemView, WorkspaceLeaf, TFile, Menu, setIcon } from "obsidian";
import TagTacticianPlugin, { TAG_TACTICIAN_ID } from "../../main";

/**
 * Unique ID for the related notes view (shared with main.ts).
 */
export const RELATED_NOTES_VIEW_TYPE = "related-notes-view";

/**
 * A custom view that displays "Related Notes" in the sidebar.
 */
export class RelatedNotesView extends ItemView {
    plugin: TagTacticianPlugin;

    /** User-entered filter text for live filtering notes. */
    private filterQuery: string = "";

    /** Whether to show each note’s tags under its title. */
    private showTags: boolean;

    /** Whether to show each note’s score next to it. */
    private showScore: boolean;

    constructor(leaf: WorkspaceLeaf, plugin: TagTacticianPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.showTags = this.plugin.settings.defaultShowTags;
        this.showScore = this.plugin.settings.defaultShowScore;
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
    }

    /**
     * Rebuilds the entire sidebar content, including controls and the note list.
     */
    public refresh() {
        // Refresh the settings in case the defaults changed
        this.showTags = this.plugin.settings.defaultShowTags;
        this.showScore = this.plugin.settings.defaultShowScore;

        const container = this.containerEl;
        container.addClass("related-notes-container");
        container.empty();

        // Title row (with "Options" gear icon)
        const headerRow = container.createEl("div", { cls: "related-notes-header" });
        headerRow.createEl("h2", { text: "Related Notes" });

        // Single "Options" button that opens a menu
        const optionsBtn = headerRow.createEl("button", { cls: "clickable-icon" });
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

            menu.showAtMouseEvent(evt);
        };

        // Filter input
        const controls = container.createEl("div", { cls: "related-notes-controls" });
        const filterInput = controls.createEl("input", {
            type: "search",
            placeholder: "Filter by name or tag...",
            cls: "filter-input",
        });
        filterInput.value = this.filterQuery;
        filterInput.style.minWidth = "120px";
        filterInput.oninput = () => {
            this.filterQuery = filterInput.value.trim().toLowerCase();
            this.refreshList(); // re-render note list only
        };

        // Container for the note list
        const listContainer = container.createEl("div", { cls: "related-notes-list-container" });
        this.renderNoteList(listContainer);
    }

    /**
     * Rerender just the note list portion, preserving the top controls.
     */
    private refreshList() {
        const listContainer = this.containerEl.querySelector(".related-notes-list-container") as HTMLElement;
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
            container.createEl("p", { text: "No related notes found." });
            return;
        }

        // We'll filter them by the current filterQuery:
        const filteredResults = this.applyFilter(results);

        if (!filteredResults.length) {
            container.createEl("p", { text: "No notes match your filter." });
            return;
        }

        // Show top ~10 after filtering
        const topResults = filteredResults.slice(0, 10);
        for (const { notePath, score } of topResults) {
            const item = container.createEl("div", { cls: "related-note-item" });
            const firstRow = item.createEl("div", { cls: "related-note-first-row" });

            // Score (conditionally displayed)
            if (this.showScore) {
                const scoreEl = firstRow.createEl("span", { cls: "related-note-score" });
                scoreEl.setText(`${score}`);
            }

            // Title link
            const noteTitle = this.plugin.tagIndexer["noteTitleMap"].get(notePath) ?? notePath;
            const link = firstRow.createEl("a", {
                cls: "related-note-link internal-link", // 'internal-link' for Obsidian's hover previews
            });

            // Instead of using `setText`, we highlight the filter matches in the title
            link.innerHTML = this.highlightMatches(noteTitle, this.filterQuery);

            // tooltip
            link.title = notePath;

            link.addEventListener("mouseover", (event) => {
                this.app.workspace.trigger("hover-link", {
                    event,
                    linktext: this.app.vault.getAbstractFileByPath(notePath).path,
                    sourcePath: link.pathname,
                    source: TAG_TACTICIAN_ID,
                    targetEl: link,
                    hoverParent: firstRow
                });
            });

            link.addEventListener("click", (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                const file = this.app.vault.getAbstractFileByPath(notePath);
                if (file instanceof TFile) {
                    this.app.workspace.getLeaf().openFile(file);
                }
            });
            // Middle-click => open in new tab
            link.addEventListener("auxclick", (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                this.app.workspace.openLinkText(notePath, "", true);
            });

            // Optionally show tags
            if (this.showTags) {
                const noteTags = this.plugin.tagIndexer.getNoteTags(notePath);
                if (noteTags.size > 0) {
                    const tagLine = item.createEl("div", { cls: "related-note-tags" });

                    // For each tag, create a small <a> with class="tag"
                    noteTags.forEach((tagString) => {
                        const tagA = tagLine.createEl("a", {
                            cls: "tag",
                            attr: { disabled: true }
                        });
                        // highlight filter matches in tag
                        tagA.innerHTML = this.highlightMatches(tagString, this.filterQuery);
                    });
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

            // If the user typed 'abc', we do a case-insensitive check:
            const lowerTitle = title.toLowerCase();
            if (lowerTitle.includes(filter)) {
                output.push(item);
                continue;
            }

            // check tags
            const hasTagMatch = Array.from(noteTags).some(
                (t) => t.toLowerCase().includes(filter)
            );
            if (hasTagMatch) {
                output.push(item);
            }
        }
        return output;
    }

    /**
     * Utility function that highlights all instances of `filter`
     * inside `text`, wrapping them in <mark>...</mark> (case-insensitive).
     */
    private highlightMatches(text: string, filter: string): string {
        if (!filter) return text;

        // Create a regex that finds all (case-insensitive) occurrences of `filter`
        // and wraps them in <mark>...</mark>.
        const re = new RegExp(`(${this.escapeRegex(filter)})`, "gi");
        return text.replace(re, "<span class='highlight'>$1</span>");
    }

    /**
     * Escape special regex characters in the filter string.
     * e.g. if filter is "foo?", we want to match literal "?",
     * not a wildcard.
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
