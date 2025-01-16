import { ItemView, WorkspaceLeaf, TFile, setIcon, IconName } from "obsidian";
import TagTacticianPlugin from "../../main";
import { gatherTagsFromCache } from "../relatedView/TagIndexer";

/**
 * Unique ID for the tag-based file navigation view.
 */
export const TAG_NAVIGATION_VIEW_TYPE = "tag-navigation-view";

export class NavByTagView extends ItemView {
    plugin: TagTacticianPlugin;

    /** Current sort mode */
    private sortMode: "alphabetically-descending" | "file-count-descending";

    /** Current filter text for searching tags and their files. */
    private filterQuery: string = "";

    /** Flag indicating whether we should expand all details by default. */
    private expandAll: boolean = false;

    /** Where we’ll store a reference to the list container in the DOM. */
    private listContainerEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: TagTacticianPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.sortMode = plugin.settings.nbtDefaultSort;
    }

    getViewType(): string {
        return TAG_NAVIGATION_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Tag Navigation";
    }

    getIcon(): IconName {
        return "folder-tree";
    }

    async onOpen() {
        this.buildView();
    }

    async onClose() {
        // ...
    }

    /**
     * Build the entire view container (only once).
     * Header, controls, and the container for our list.
     */
    private buildView(): void {
        const container = this.containerEl;
        container.empty(); // just in case

        container.addClass("tag-navigation-container");

        // Header
        const header = container.createEl("div", { cls: "tag-navigation-header" });
        const titleRow = header.createEl("div", { cls: "tag-navigation-title-row" });
        titleRow.createEl("h4", { text: "Tag Navigation" });

        // Controls row
        const controls = titleRow.createEl("div", { cls: "tag-navigation-controls" });

        // Sort toggle button
        const sortBtn = controls.createEl("button", { cls: "tag-nav-sort-btn clickable-icon" });
        this.updateSortButtonLabel(sortBtn);
        sortBtn.onclick = () => {
            this.sortMode =
                this.sortMode === "alphabetically-descending"
                    ? "file-count-descending"
                    : "alphabetically-descending";
            this.updateSortButtonLabel(sortBtn);
            this.renderList();
        };

        // Expand/Collapse All button
        const expandAllBtn = controls.createEl("button", { cls: "tag-nav-expand-btn clickable-icon" });
        this.updateExpandButtonLabel(expandAllBtn);
        expandAllBtn.onclick = () => {
            this.expandAll = !this.expandAll;
            this.updateExpandButtonLabel(expandAllBtn);
            this.renderList();
        };

        // Filter input
        const filterInput = header.createEl("input", {
            type: "search",
            placeholder: "Filter tags...",
            cls: "tag-nav-filter-input",
        });
        filterInput.value = this.filterQuery;
        filterInput.oninput = () => {
            this.filterQuery = filterInput.value.trim().toLowerCase();
            // Instead of redrawing everything, just re-render the list:
            this.renderList();
        };

        // Create the list container and remember it in a class property
        this.listContainerEl = container.createEl("div", { cls: "tag-navigation-list-container" });

        // Now do the initial list render
        this.renderList();
    }

    /**
     * Rebuilds only the hierarchy list portion, preserving the top controls (so we don’t lose focus).
     */
    private renderList(): void {
        // Ensure the container is present
        if (!this.listContainerEl) return;

        // Clear whatever is currently in the list
        this.listContainerEl.empty();

        // Build the full hierarchy
        const tagHierarchy = this.buildTagHierarchy();

        // Apply the filter
        const filteredHierarchy = this.filterHierarchy(tagHierarchy, this.filterQuery);

        // Apply the sorting
        const sortedHierarchy = this.sortHierarchy(filteredHierarchy, this.sortMode);

        // Render it
        this.renderTagGroup(this.listContainerEl, sortedHierarchy);
    }

    /**
     * Build a hierarchical structure of tags and their associated notes.
     */
    private buildTagHierarchy(): TagHierarchy {
        const hierarchy: TagHierarchy = {};
        const allFiles = this.app.vault.getMarkdownFiles();

        for (const file of allFiles) {
            const tags = gatherTagsFromCache(this.app.metadataCache.getFileCache(file));
            if (tags.size === 0) {
                if (!hierarchy["untagged"]) {
                    hierarchy["untagged"] = { files: new Set(), children: {} };
                }
                hierarchy["untagged"].files.add(file);
            } else {
                for (const tag of tags) {
                    this.addToHierarchy(hierarchy, tag.split("/"), file);
                }
            }
        }
        return hierarchy;
    }

    private addToHierarchy(hierarchy: TagHierarchy, segments: string[], file: TFile) {
        const [head, ...rest] = segments;
        if (!hierarchy[head]) {
            hierarchy[head] = { files: new Set(), children: {} };
        }
        if (rest.length === 0) {
            hierarchy[head].files.add(file);
        } else {
            this.addToHierarchy(hierarchy[head].children, rest, file);
        }
    }

    /**
     * Recursively filter the hierarchy so only nodes/files that match `filterQuery` remain.
     */
    private filterHierarchy(hierarchy: TagHierarchy, filterQuery: string): TagHierarchy {
        // If no filter, return the original
        if (!filterQuery) return hierarchy;

        const result: TagHierarchy = {};

        for (const [key, { files, children }] of Object.entries(hierarchy)) {
            const tagNameMatches = key.toLowerCase().includes(filterQuery);
            const matchingFiles = new Set(
                [...files].filter((file) =>
                    file.basename.toLowerCase().includes(filterQuery)
                )
            );
            const filteredChildren = this.filterHierarchy(children, filterQuery);

            // If the tag name itself matches, or some file names match, or children matched
            if (tagNameMatches || matchingFiles.size > 0 || Object.keys(filteredChildren).length > 0) {
                result[key] = {
                    files: new Set([...matchingFiles]),
                    children: filteredChildren,
                };
                // If tagNameMatches but no direct file matches, keep original files
                if (tagNameMatches && matchingFiles.size === 0 && files.size > 0) {
                    result[key].files = new Set([...files]);
                }
            }
        }

        return result;
    }

    /**
     * Sort the hierarchy either alphabetically or by descending total file count.
     */
    private sortHierarchy(
        hierarchy: TagHierarchy,
        mode: "alphabetically-descending" | "file-count-descending"
    ): TagHierarchy {
        const sortedEntries = Object.entries(hierarchy).map(([key, node]) => {
            return [
                key,
                {
                    files: node.files,
                    children: this.sortHierarchy(node.children, mode),
                },
            ] as const;
        });

        if (mode === "alphabetically-descending") {
            sortedEntries.sort((a, b) =>
                a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
            );
        } else {
            sortedEntries.sort((a, b) => {
                const countA = this.getTotalFileCountForNode(a[1]);
                const countB = this.getTotalFileCountForNode(b[1]);
                if (countB === countA) {
                    // tie-break by alphabetical
                    return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
                }
                return countB - countA; // descending
            });
        }

        const result: TagHierarchy = {};
        for (const [k, v] of sortedEntries) {
            result[k] = v;
        }
        return result;
    }

    /**
     * Render the tag hierarchy recursively.
     */
    private renderTagGroup(container: HTMLElement, group: TagHierarchy, path: string[] = []) {
        for (const [key, { files, children }] of Object.entries(group)) {
            // Single-child collapsing check
            const shouldCollapse = Object.keys(children).length === 1 && files.size === 0;
            if (shouldCollapse) {
                const [nextKey, nextValue] = Object.entries(children)[0];
                this.renderTagGroup(container, { [`${key}/${nextKey}`]: nextValue }, path);
                continue;
            }

            // Create a <details> for this tag
            const groupContainer = container.createEl("details", { cls: "tag-group" });
            if (this.expandAll) {
                groupContainer.setAttribute("open", "true");
            }
            const groupHeader = groupContainer.createEl("summary", { cls: "tag-group-header" });

            // Icon
            const icon = groupHeader.createEl("span", { cls: "tag-group-icon" });
            setIcon(icon, groupContainer.open ? "chevron-down" : "chevron-right");
            groupContainer.addEventListener("toggle", () => {
                setIcon(icon, groupContainer.open ? "chevron-down" : "chevron-right");
            });

            // Tag name (highlight filter matches here)
            const tagName = groupHeader.createEl("span");
            // Insert highlighted HTML instead of plain text:
            tagName.innerHTML = this.highlightMatches(key, this.filterQuery);
            // Hover tip
            tagName.title = path.length !== 0 ? `${path}/${key}` : key;

            // Count
            const totalCount = this.getTotalFileCountForNode({ files, children });
            if (totalCount > 0) {
                const count = groupHeader.createEl("span", {
                    cls: "tag-group-count",
                });
                count.innerText = `${totalCount}`;
                count.title = `Files with this tag: ${files.size}\nFiles with subtag: ${totalCount - files.size}`;
            }

            // Recursively render children
            this.renderTagGroup(groupContainer, children, [...path, key]);

            // Render files
            const list = groupContainer.createEl("ul", { cls: "tag-group-list" });
            for (const file of files) {
                const listItem = list.createEl("li", { cls: "tag-group-note" });
                listItem.title = file.path;
                const link = listItem.createEl("a", {
                    cls: "internal-link",
                    href: `#${file.path}`,
                });
                // Insert highlighted basename
                const nameSpan = link.createEl("span");
                nameSpan.innerHTML = this.highlightMatches(file.basename, this.filterQuery);

                link.onclick = (evt) => {
                    evt.preventDefault();
                    this.app.workspace.getLeaf().openFile(file);
                };
            }
        }
    }

    /**
     * Returns the total number of files for a given node (including children).
     */
    private getTotalFileCountForNode(nodeData: { files: Set<TFile>; children: TagHierarchy }): number {
        let count = nodeData.files.size;
        for (const child of Object.values(nodeData.children)) {
            count += this.getTotalFileCountForNode(child);
        }
        return count;
    }

    /**
     * Helper method to highlight all occurrences of `filter` within `original`,
     * wrapping them in <span class="highlight">... </span>. (Case-insensitive)
     */
    private highlightMatches(original: string, filter: string): string {
        if (!filter) return original;

        // Escape regex specials in the filter text
        const escaped = filter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Build a case-insensitive regex
        const regex = new RegExp(`(${escaped})`, "gi");

        // Replace all matches with <span class="highlight">...</span>
        return original.replace(regex, `<span class="highlight">$1</span>`);
    }

    private updateSortButtonLabel(buttonEl: HTMLButtonElement) {
        if (this.sortMode === "alphabetically-descending") {
            setIcon(buttonEl, "arrow-down-az");
            buttonEl.title = "Sorting alphabetically.\nClick to sort by file count";
        } else {
            setIcon(buttonEl, "arrow-down-10");
            buttonEl.title = "Sorting by file count.\nClick to sort alphabetically";
        }
    }

    private updateExpandButtonLabel(buttonEl: HTMLButtonElement) {
        if (this.expandAll) {
            setIcon(buttonEl, "chevrons-down-up");
            buttonEl.title = "Collapse All";
        } else {
            setIcon(buttonEl, "chevrons-up-down");
            buttonEl.title = "Expand All";
        }
    }
}

/**
 * Represents the structure of the tag hierarchy.
 */
interface TagHierarchy {
    [key: string]: {
        files: Set<TFile>;
        children: TagHierarchy;
    };
}
