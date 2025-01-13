import {ItemView, WorkspaceLeaf, TFile, setIcon, IconName} from "obsidian";
import TagTacticianPlugin from "../../main";
import {gatherTagsFromCache} from "../relatedView/TagIndexer";

/**
 * Unique ID for the tag-based file navigation view.
 */
export const TAG_NAVIGATION_VIEW_TYPE = "tag-navigation-view";

/**
 * A custom view that displays notes organized by tags in a directory-like hierarchy.
 */
export class NavByTagView extends ItemView {
    plugin: TagTacticianPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: TagTacticianPlugin) {
        super(leaf);
        this.plugin = plugin;
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
        this.refresh();
    }

    async onClose() {
    }

    /**
     * Refresh the entire view.
     */
    public refresh() {
        const container = this.containerEl;
        container.addClass("tag-navigation-container");
        container.empty();

        const header = container.createEl("div", {cls: "tag-navigation-header"});
        header.createEl("h4", {text: "Tag Navigation"});

        const listContainer = container.createEl("div", {cls: "tag-navigation-list-container"});

        // Get the structured tag hierarchy
        const tagHierarchy = this.buildTagHierarchy();

        // Render the hierarchy
        this.renderTagGroup(listContainer, tagHierarchy);
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
                // Add to the "untagged" group
                if (!hierarchy["untagged"]) {
                    hierarchy["untagged"] = {files: new Set(), children: {}};
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

    /**
     * Recursively add a file to the tag hierarchy.
     */
    private addToHierarchy(hierarchy: TagHierarchy, segments: string[], file: TFile) {
        const [head, ...rest] = segments;

        if (!hierarchy[head]) {
            hierarchy[head] = {files: new Set(), children: {}};
        }

        if (rest.length === 0) {
            hierarchy[head].files.add(file);
        } else {
            this.addToHierarchy(hierarchy[head].children, rest, file);
        }
    }

    /**
     * Render the tag hierarchy recursively.
     * If a tag group has only one child and no files, it will collapse into a single path.
     */
    private renderTagGroup(
        container: HTMLElement,
        group: TagHierarchy,
        path: string[] = []
    ) {
        for (const [key, {files, children}] of Object.entries(group)) {
            const currentPath = [...path, key];

            // Check if this group should be collapsed
            const shouldCollapse =
                Object.keys(children).length === 1 && files.size === 0;

            if (shouldCollapse) {
                const [nextKey, nextValue] = Object.entries(children)[0];
                this.renderTagGroup(container, {[`${key}/${nextKey}`]: nextValue}, path);
                continue;
            }

            // Create a collapsible group for this tag
            const groupContainer = container.createEl("details", {cls: "tag-group"});
            const groupHeader = groupContainer.createEl("summary", {cls: "tag-group-header"});

            // Add icon, name, and total count
            const icon = groupHeader.createEl("span", {cls: "tag-group-icon"});
            setIcon(icon, groupContainer.hasAttribute("open") ? "chevron-down" : "chevron-right");
            groupContainer.addEventListener("toggle", () => {
                setIcon(icon, groupContainer.open ? "chevron-down" : "chevron-right");
            });
            groupHeader.createEl("span", {text: key});

            // <-- Get the total file count recursively, rather than just files.size
            const totalCount = this.getTotalFileCountForNode({files, children});
            if (totalCount > 0) {
                groupHeader.createEl("span", {
                    cls: "tag-group-count",
                    text: `${totalCount}`
                });
            }

            // Recursively render child tags
            this.renderTagGroup(groupContainer, children, currentPath);

            // Render files under this tag
            const list = groupContainer.createEl("ul", {cls: "tag-group-list"});
            files.forEach((file) => {
                const listItem = list.createEl("li", {cls: "tag-group-note"});
                const link = listItem.createEl("a", {
                    cls: "internal-link",
                    href: `#${file.path}`
                });
                link.createEl("span", {text: file.basename});
                link.onclick = (evt) => {
                    evt.preventDefault();
                    this.app.workspace.getLeaf().openFile(file);
                };
            });
        }
    }

    /**
     * Returns the total number of files for a given node (including all children).
     */
    private getTotalFileCountForNode(nodeData: { files: Set<TFile>; children: TagHierarchy }): number {
        let count = nodeData.files.size;
        for (const child of Object.values(nodeData.children)) {
            count += this.getTotalFileCountForNode(child);
        }
        return count;
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

