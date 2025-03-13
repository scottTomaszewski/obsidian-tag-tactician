import {ItemView, WorkspaceLeaf, TFile, Menu, setIcon, IconName} from "obsidian";
import TagTacticianPlugin from "../../main";
import {gatherTagsFromCache, gatherAllPrefixSegmentsForNote, levenshteinSimilarity} from "./TagIndexer";

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

    /** Whether to show each note's tags under its title. */
    private showTags: boolean;

    /** Whether to show each note's score next to it. */
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

    getIcon(): IconName {
        return "git-compare";
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
        const header = container.createEl("div", { cls: "related-notes-header" });
        const titleRow = header.createEl("div", { cls: "related-notes-title-row" });
        titleRow.createEl("h4", { text: "Related Notes" });

        // Single "Options" button that opens a menu
        const optionsBtn = titleRow.createEl("button", { cls: "clickable-icon" });
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

            menu.addSeparator();

            // Menu item: Refresh list
            menu.addItem((item) => {
                item
                    .setTitle("Refresh Notes")
                    .onClick(() => {
                        this.refreshList();
                    });
            });

            menu.showAtMouseEvent(evt);
        };

        // Filter input with clear button
        const controls = header.createEl("div", { cls: "related-notes-controls" });
        const filterWrapper = controls.createEl("div", { cls: "filter-input-container" });
        
        // Create the text input
        const filterInput = filterWrapper.createEl("input", {
            type: "search",
            placeholder: "Filter by name or tag...",
            cls: "filter-input",
        });
        filterInput.value = this.filterQuery;
        
        // Create the clear button
        const clearButton = filterWrapper.createEl("span", { 
            cls: "search-input-clear-button", 
            attr: { 
                "aria-label": "Clear filter" 
            }
        });
        
        // Hide clear button when empty
        clearButton.style.display = this.filterQuery ? "flex" : "none";
        
        // Setup event handlers
        filterInput.oninput = () => {
            this.filterQuery = filterInput.value.trim().toLowerCase();
            clearButton.style.display = this.filterQuery ? "flex" : "none";
            this.refreshList();
        };
        
        clearButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            filterInput.value = "";
            this.filterQuery = "";
            clearButton.style.display = "none";
            this.refreshList();
            filterInput.focus();
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

        // Show top results after filtering
        // TODO - make this slice configurable or infinite scrolling
        const topResults = filteredResults
            .filter(r => r.score >= this.plugin.settings.minimumRelatedNotesScore);
        for (const { notePath, score } of topResults) {
            const noteFile = this.app.vault.getAbstractFileByPath(notePath);
            const item = container.createEl("div", { cls: "related-note-item" });
            const itemContent = item.createEl("div", { cls: "related-note-item-content" });

            // Title row with title and score on the same line
            const titleRow = itemContent.createEl("div", { cls: "related-note-title-row" });

            // Title link
            const noteTitle = notePath.split(/[\\/]/).pop();
            const link = titleRow.createEl("a", {cls: "related-note-link"});

            // Instead of using `setText`, we highlight the filter matches in the title
            link.innerHTML = this.highlightMatches(noteTitle, this.filterQuery);

            // Score (conditionally displayed) - now part of the title row
            if (this.showScore) {
                const scoreEl = titleRow.createEl("span", { cls: "related-note-score" });
                scoreEl.setText(`${score.toPrecision(2)}`);
                
                // Get detailed score calculation
                if (noteFile instanceof TFile) {
                    const currentFile = this.app.workspace.getActiveFile();
                    if (currentFile) {
                        const currFullTags = gatherTagsFromCache(this.app.metadataCache.getFileCache(currentFile));
                        const currSegments = gatherAllPrefixSegmentsForNote(currFullTags);
                        
                        const candTags = gatherTagsFromCache(this.app.metadataCache.getFileCache(noteFile));
                        const candSegments = gatherAllPrefixSegmentsForNote(candTags);
                        
                        // Calculate tag overlap
                        let prefixOverlapScore = 0;
                        const overlappingTags: string[] = [];
                        for (const seg of candSegments) {
                            if (currSegments.has(seg)) {
                                prefixOverlapScore += 1;
                                overlappingTags.push(seg);
                            }
                        }
                        
                        // Get titles for title similarity calculation
                        const currentTitle = currentFile.basename.toLowerCase();
                        const candidateTitle = noteFile.basename.toLowerCase();
                        const titleSimScore = levenshteinSimilarity(currentTitle, candidateTitle);
                        
                        // Path similarity
                        let pathSimScore = 0;
                        if (noteFile.parent.path !== "/" && currentFile.parent.path !== "/") {
                            pathSimScore = levenshteinSimilarity(currentFile.path, notePath);
                        }
                        
                        // Links to each other
                        let linkScore = 0;
                        const candCache = this.app.metadataCache.getFileCache(noteFile);
                        const currCache = this.app.metadataCache.getFileCache(currentFile);
                        
                        if (candCache && currCache) {
                            if (candCache.links?.map(l => l.link).includes(currentFile.basename)) {
                                linkScore++;
                            }
                            if (currCache.links?.map(l => l.link).includes(noteFile.basename)) {
                                linkScore++;
                            }
                        }
                        
                        // Calculate weighted scores
                        const tagWeight = this.plugin.settings.weightTagSimilarity;
                        const titleWeight = this.plugin.settings.weightTitleSimilarity;
                        const pathWeight = this.plugin.settings.weightPathSimilarity;
                        const linkWeight = this.plugin.settings.weightLinkInterconnections;
                        
                        const weightedTagScore = tagWeight * prefixOverlapScore;
                        const weightedTitleScore = titleWeight * titleSimScore;
                        const weightedPathScore = pathWeight * pathSimScore;
                        const weightedLinkScore = linkWeight * linkScore;
                        
                        // Create tooltip text
                        let tooltipText = "Score Breakdown:\n";
                        tooltipText += `• Tag similarity: ${weightedTagScore.toFixed(2)} (${prefixOverlapScore} tag overlaps × ${tagWeight} weight)\n`;
                        if (overlappingTags.length > 0) {
                            tooltipText += `  Overlapping tags: ${overlappingTags.join(", ")}\n`;
                        }
                        tooltipText += `• Title similarity: ${weightedTitleScore.toFixed(2)} (${titleSimScore.toFixed(2)} similarity × ${titleWeight} weight)\n`;
                        tooltipText += `• Path similarity: ${weightedPathScore.toFixed(2)} (${pathSimScore.toFixed(2)} similarity × ${pathWeight} weight)\n`;
                        tooltipText += `• Link interconnections: ${weightedLinkScore.toFixed(2)} (${linkScore} links × ${linkWeight} weight)\n`;
                        tooltipText += `\nTotal score: ${score.toPrecision(3)}`;
                        
                        scoreEl.title = tooltipText;
                    } else {
                        scoreEl.title = "Score: " + score;
                    }
                } else {
                    scoreEl.title = "Score: " + score;
                }
            }

            // tooltip
            link.title = notePath;

            // hover preview
            link.addEventListener("mouseover", (event) => {
                this.app.workspace.trigger("hover-link", {
                    event,
                    linktext: this.app.vault.getAbstractFileByPath(notePath).path,
                    sourcePath: link.pathname,
                    source: RELATED_NOTES_VIEW_TYPE,
                    targetEl: link,
                    hoverParent: itemContent
                });
            });

            // Left-click => open file
            link.addEventListener("click", (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                if (noteFile instanceof TFile) {
                    this.app.workspace.getLeaf().openFile(noteFile);
                } else {
                    console.error(`noteFile at ${notePath} is not a TFile?`)
                }
            });

            // Middle-click => open in new tab without switching to it
            link.addEventListener("auxclick", (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                if (noteFile instanceof TFile) {
                    // Create a new leaf without focusing it
                    this.app.workspace.openLinkText(notePath, "", true, { active: false, eState: {focus:false}});
                }
            });

            // Optionally show tags
            if (this.showTags) {
                const noteTags = gatherTagsFromCache(this.app.metadataCache.getFileCache(noteFile))
                if (noteTags.size > 0) {
                    const tagLine = itemContent.createEl("div", { cls: "related-note-tags" });

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
            const title = notePath;
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
