import { App, IconName, Menu, TFile, setIcon } from "obsidian";
import { gatherTagsFromCache } from "../relatedView/TagIndexer";
import { TagNavSortMode } from "../settings/PluginSettings";

/**
 * Represents the structure of the tag hierarchy.
 */
export interface TagHierarchy {
    [key: string]: {
        files: Set<TFile>;
        children: TagHierarchy;
    };
}

/**
 * Handles the rendering and sorting logic for tag navigation
 */
export class TagNavigationRenderer {
    private app: App;
    private filterQuery: string = "";
    private expandAll: boolean = false;
    private sortMode: TagNavSortMode;

    /**
     * Create a new tag navigation renderer
     */
    constructor(app: App, sortMode: TagNavSortMode) {
        this.app = app;
        this.sortMode = sortMode;
    }

    /**
     * Set the current sort mode
     */
    public setSortMode(mode: TagNavSortMode): void {
        this.sortMode = mode;
    }

    /**
     * Get the current sort mode
     */
    public getSortMode(): TagNavSortMode {
        return this.sortMode;
    }

    /**
     * Set filter query for searching
     */
    public setFilterQuery(query: string): void {
        this.filterQuery = query;
    }

    /**
     * Get current filter query
     */
    public getFilterQuery(): string {
        return this.filterQuery;
    }

    /**
     * Set expand all setting
     */
    public setExpandAll(expand: boolean): void {
        this.expandAll = expand;
    }

    /**
     * Get expand all setting
     */
    public getExpandAll(): boolean {
        return this.expandAll;
    }

    /**
     * Render the sort button with current mode
     */
    public renderSortButton(buttonEl: HTMLButtonElement): void {
        // Clear button content
        buttonEl.empty();
        
        // Add icon and label
        let sortIcon: IconName;
        let sortLabel: string;
        
        switch (this.sortMode) {
            case "alphabetically-descending":
                sortIcon = "arrow-down-az";
                sortLabel = "Alphabetical";
                buttonEl.setAttribute("aria-label", "Sorting alphabetically");
                buttonEl.title = "Current sort: Alphabetically\nClick to change sort method";
                break;
            case "file-count-descending":
                sortIcon = "arrow-down-10";
                sortLabel = "Note Count";
                buttonEl.setAttribute("aria-label", "Sorting by file count");
                buttonEl.title = "Current sort: By note count (highest first)\nClick to change sort method";
                break;
            case "created-time-descending":
                sortIcon = "calendar-plus";
                sortLabel = "Newest First";
                buttonEl.setAttribute("aria-label", "Sorting by newest notes first");
                buttonEl.title = "Current sort: By creation date (newest first)\nClick to change sort method";
                break;
            case "created-time-ascending":
                sortIcon = "calendar-minus";
                sortLabel = "Oldest First";
                buttonEl.setAttribute("aria-label", "Sorting by oldest notes first");
                buttonEl.title = "Current sort: By creation date (oldest first)\nClick to change sort method";
                break;
            case "modified-time-descending":
                sortIcon = "pencil";
                sortLabel = "Recent Edits";
                buttonEl.setAttribute("aria-label", "Sorting by most recently modified");
                buttonEl.title = "Current sort: By modification date (most recent first)\nClick to change sort method";
                break;
            case "modified-time-ascending":
                sortIcon = "pencil-line";
                sortLabel = "Oldest Edits";
                buttonEl.setAttribute("aria-label", "Sorting by least recently modified");
                buttonEl.title = "Current sort: By modification date (oldest first)\nClick to change sort method";
                break;
        }
        
        // Add icon
        const iconSpan = buttonEl.createSpan();
        setIcon(iconSpan, sortIcon);
        
        // Add label
        const labelSpan = buttonEl.createSpan({
            text: sortLabel,
            cls: "sort-btn-label"
        });
    }

    /**
     * Show the sort menu at the given button
     */
    public showSortMenu(sortBtn: HTMLButtonElement, onSortChange: (mode: TagNavSortMode) => void): void {
        const menu = new Menu();
        
        menu.addItem((item) => {
            item.setTitle("Sort alphabetically")
                .setIcon(this.sortMode === "alphabetically-descending" ? "checkmark" : "")
                .onClick(() => {
                    this.sortMode = "alphabetically-descending";
                    onSortChange(this.sortMode);
                });
        });
        
        menu.addItem((item) => {
            item.setTitle("Sort by note count")
                .setIcon(this.sortMode === "file-count-descending" ? "checkmark" : "")
                .onClick(() => {
                    this.sortMode = "file-count-descending";
                    onSortChange(this.sortMode);
                });
        });
        
        menu.addSeparator();
        
        menu.addItem((item) => {
            item.setTitle("Sort by creation date (newest first)")
                .setIcon(this.sortMode === "created-time-descending" ? "checkmark" : "")
                .onClick(() => {
                    this.sortMode = "created-time-descending";
                    onSortChange(this.sortMode);
                });
        });
        
        menu.addItem((item) => {
            item.setTitle("Sort by creation date (oldest first)")
                .setIcon(this.sortMode === "created-time-ascending" ? "checkmark" : "")
                .onClick(() => {
                    this.sortMode = "created-time-ascending";
                    onSortChange(this.sortMode);
                });
        });
        
        menu.addSeparator();
        
        menu.addItem((item) => {
            item.setTitle("Sort by modification date (newest first)")
                .setIcon(this.sortMode === "modified-time-descending" ? "checkmark" : "")
                .onClick(() => {
                    this.sortMode = "modified-time-descending";
                    onSortChange(this.sortMode);
                });
        });
        
        menu.addItem((item) => {
            item.setTitle("Sort by modification date (oldest first)")
                .setIcon(this.sortMode === "modified-time-ascending" ? "checkmark" : "")
                .onClick(() => {
                    this.sortMode = "modified-time-ascending";
                    onSortChange(this.sortMode);
                });
        });
        
        // Calculate position for the menu
        const rect = sortBtn.getBoundingClientRect();
        menu.showAtPosition({ x: rect.left, y: rect.bottom });
    }

    /**
     * Render the expand button with current state
     */
    public renderExpandButton(buttonEl: HTMLButtonElement): void {
        if (this.expandAll) {
            setIcon(buttonEl, "chevrons-down-up");
            buttonEl.setAttribute("aria-label", "Collapse all tags");
            buttonEl.title = "Currently showing expanded tags\nClick to collapse all tag groups";
        } else {
            setIcon(buttonEl, "chevrons-up-down");
            buttonEl.setAttribute("aria-label", "Expand all tags");
            buttonEl.title = "Currently showing collapsed tags\nClick to expand all tag groups";
        }
    }

    /**
     * Create a filter input with a clear button
     */
    public createFilterInput(container: HTMLElement, initialValue: string, placeholder: string, onChange: (value: string) => void): HTMLInputElement {
        const filterWrapper = container.createEl("div", { cls: "filter-input-container" });
        
        // Create the text input
        const filterInput = filterWrapper.createEl("input", {
            type: "search",
            placeholder: placeholder,
            cls: "filter-input",
        });
        filterInput.value = initialValue;
        
        // Create the clear button
        const clearButton = filterWrapper.createEl("span", { 
            cls: "search-input-clear-button", 
            attr: { 
                "aria-label": "Clear filter" 
            }
        });
        
        // Hide clear button when empty
        clearButton.style.display = initialValue ? "flex" : "none";
        
        // Setup event handlers
        filterInput.oninput = () => {
            const value = filterInput.value.trim();
            clearButton.style.display = value ? "flex" : "none";
            onChange(value);
        };
        
        clearButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            filterInput.value = "";
            clearButton.style.display = "none";
            onChange("");
            filterInput.focus();
        };
        
        return filterInput;
    }

    /**
     * Build a hierarchical structure of tags and their associated notes.
     */
    public buildTagHierarchy(): TagHierarchy {
        const hierarchy: TagHierarchy = {};
        const allFiles = this.app.vault.getMarkdownFiles();

        for (const file of allFiles) {
            // Get file metadata cache, handle null case
            const fileCache = this.app.metadataCache.getFileCache(file);
            // Only process files with metadata cache
            if (fileCache) {
                const tags = gatherTagsFromCache(fileCache);
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
            } else {
                // Add to untagged if no metadata cache is available
                if (!hierarchy["untagged"]) {
                    hierarchy["untagged"] = { files: new Set(), children: {} };
                }
                hierarchy["untagged"].files.add(file);
            }
        }
        return hierarchy;
    }

    /**
     * Helper method to add a file to the hierarchy at the given path
     */
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
    public filterHierarchy(hierarchy: TagHierarchy, filterQuery: string): TagHierarchy {
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
                    // If tag name matches, show ALL files, otherwise only show matching files
                    files: tagNameMatches ? new Set([...files]) : new Set([...matchingFiles]),
                    children: filteredChildren,
                };
            }
        }

        return result;
    }

    /**
     * Sort the hierarchy using the current sort mode
     */
    public sortHierarchy(
        hierarchy: TagHierarchy,
        mode: TagNavSortMode
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

        switch (mode) {
            case "alphabetically-descending":
                sortedEntries.sort((a, b) =>
                    a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
                );
                break;
                
            case "file-count-descending":
                sortedEntries.sort((a, b) => {
                    const countA = this.getTotalFileCountForNode(a[1]);
                    const countB = this.getTotalFileCountForNode(b[1]);
                    if (countB === countA) {
                        // tie-break by alphabetical
                        return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
                    }
                    return countB - countA; // descending
                });
                break;
                
            case "created-time-descending":
            case "created-time-ascending":
                sortedEntries.sort((a, b) => {
                    const filesA = Array.from(a[1].files);
                    const filesB = Array.from(b[1].files);
                    if (filesA.length === 0 && filesB.length === 0) {
                        return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
                    }
                    // Sort by the most recent or oldest creation time in each tag group
                    const getNewestCtime = (files: TFile[]) => {
                        if (files.length === 0) return 0;
                        return mode === "created-time-descending"
                            ? Math.max(...files.map(f => f.stat.ctime))
                            : Math.min(...files.map(f => f.stat.ctime));
                    };
                    const ctimeA = getNewestCtime(filesA);
                    const ctimeB = getNewestCtime(filesB);
                    if (ctimeA === ctimeB) {
                        return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
                    }
                    return mode === "created-time-descending"
                        ? ctimeB - ctimeA // newest first
                        : ctimeA - ctimeB; // oldest first
                });
                break;
                
            case "modified-time-descending":
            case "modified-time-ascending":
                sortedEntries.sort((a, b) => {
                    const filesA = Array.from(a[1].files);
                    const filesB = Array.from(b[1].files);
                    if (filesA.length === 0 && filesB.length === 0) {
                        return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
                    }
                    // Sort by the most recent or oldest modification time in each tag group
                    const getNewestMtime = (files: TFile[]) => {
                        if (files.length === 0) return 0;
                        return mode === "modified-time-descending"
                            ? Math.max(...files.map(f => f.stat.mtime))
                            : Math.min(...files.map(f => f.stat.mtime));
                    };
                    const mtimeA = getNewestMtime(filesA);
                    const mtimeB = getNewestMtime(filesB);
                    if (mtimeA === mtimeB) {
                        return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
                    }
                    return mode === "modified-time-descending"
                        ? mtimeB - mtimeA // recently modified first
                        : mtimeA - mtimeB; // least recently modified first
                });
                break;
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
    public renderTagGroup(container: HTMLElement, group: TagHierarchy, path: string[] = [], openFileCallback: (file: TFile) => void) {
        for (const [key, { files, children }] of Object.entries(group)) {
            // Single-child collapsing check
            const shouldCollapse = Object.keys(children).length === 1 && files.size === 0;
            if (shouldCollapse) {
                const [nextKey, nextValue] = Object.entries(children)[0];
                this.renderTagGroup(container, { [`${key}/${nextKey}`]: nextValue }, path, openFileCallback);
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
                
                // Create a more descriptive tooltip
                const directFileCount = files.size;
                const childFileCount = totalCount - directFileCount;
                
                let tooltipText = `Total notes: ${totalCount}`;
                if (directFileCount > 0) {
                    tooltipText += `\nDirect tag matches: ${directFileCount}`;
                }
                if (childFileCount > 0) {
                    tooltipText += `\nNotes in subtags: ${childFileCount}`;
                }
                
                count.title = tooltipText;
            }

            // Recursively render children
            this.renderTagGroup(groupContainer, children, [...path, key], openFileCallback);

            // Sort files according to the current sort mode
            let sortedFiles = Array.from(files);
            switch (this.sortMode) {
                case "alphabetically-descending":
                    sortedFiles.sort((a, b) => 
                        a.basename.localeCompare(b.basename, undefined, { sensitivity: "base" })
                    );
                    break;
                    
                case "created-time-descending":
                    sortedFiles.sort((a, b) => b.stat.ctime - a.stat.ctime);
                    break;
                    
                case "created-time-ascending":
                    sortedFiles.sort((a, b) => a.stat.ctime - b.stat.ctime);
                    break;
                    
                case "modified-time-descending":
                    sortedFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
                    break;
                    
                case "modified-time-ascending":
                    sortedFiles.sort((a, b) => a.stat.mtime - b.stat.mtime);
                    break;
                    
                // For file-count-descending, just keep the default order
                // as file count doesn't apply to individual files
            }

            // Render files
            const list = groupContainer.createEl("ul", { cls: "tag-group-list" });
            for (const file of sortedFiles) {
                const listItem = list.createEl("li", { cls: "tag-group-note" });
                listItem.title = file.path;
                const link = listItem.createEl("a", {
                    cls: "internal-link",
                    href: `#${file.path}`,
                });
                // Insert highlighted basename
                const nameSpan = link.createEl("span");
                nameSpan.innerHTML = this.highlightMatches(file.basename, this.filterQuery);

                // Add date/time info based on the sort mode
                if (this.sortMode.includes("time")) {
                    const timeSpan = link.createEl("span", { cls: "tag-note-time" });
                    const date = this.sortMode.includes("created") 
                        ? new Date(file.stat.ctime) 
                        : new Date(file.stat.mtime);
                    
                    // Format the date for display
                    timeSpan.innerText = date.toLocaleDateString();
                    
                    // More descriptive tooltip
                    const dateType = this.sortMode.includes("created") ? "Created" : "Modified";
                    timeSpan.title = `${dateType}: ${date.toLocaleString()}`;
                }

                link.onclick = (evt) => {
                    evt.preventDefault();
                    openFileCallback(file);
                };
            }
        }
    }

    /**
     * Returns the total number of files for a given node (including children).
     */
    public getTotalFileCountForNode(nodeData: { files: Set<TFile>; children: TagHierarchy }): number {
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
    public highlightMatches(original: string, filter: string): string {
        if (!filter) return original;

        // Escape regex specials in the filter text
        const escaped = filter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Build a case-insensitive regex
        const regex = new RegExp(`(${escaped})`, "gi");

        // Replace all matches with <span class="highlight">$1</span>
        return original.replace(regex, `<span class="highlight">$1</span>`);
    }
} 