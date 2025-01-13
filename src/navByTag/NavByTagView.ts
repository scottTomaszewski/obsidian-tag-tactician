import { ItemView, WorkspaceLeaf, TFile, setIcon } from "obsidian";
import TagTacticianPlugin from "../../main";
import { gatherTagsFromCache } from "../relatedView/TagIndexer";

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

    getIcon(): string {
        return "stacked-bars";
    }

    async onOpen() {
        this.refresh();
    }

    async onClose() {}

    /**
     * Refresh the entire view.
     */
    public refresh() {
        const container = this.containerEl;
        container.addClass("tag-navigation-container");
        container.empty();

        const header = container.createEl("div", { cls: "tag-navigation-header" });
        header.createEl("h2", { text: "Tag Navigation" });

        const listContainer = container.createEl("div", { cls: "tag-navigation-list-container" });

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

    /**
     * Recursively add a file to the tag hierarchy.
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
     * Render the tag hierarchy recursively.
     */
    private renderTagGroup(container: HTMLElement, group: TagHierarchy, path: string[] = [], level: number = 0) {
        for (const [key, { files, children }] of Object.entries(group)) {
            // Create a collapsible group for this tag
            const groupContainer = container.createEl("details", { cls: "tag-group" });
            const groupHeader = groupContainer.createEl("summary", { cls: "tag-group-header" });
            groupHeader.createEl("span", { text: key });
            groupHeader.createEl("span", {
                cls: "tag-group-count",
                text: `(${files.size})`
            });

            // Render files under this tag
            const list = groupContainer.createEl("ul", { cls: "tag-group-list" });
            files.forEach((file) => {
                const listItem = list.createEl("li", { cls: "tag-group-note" });
                const link = listItem.createEl("a", {
                    text: file.basename,
                    cls: "internal-link",
                    href: `#${file.path}`
                });
                link.onclick = (evt) => {
                    evt.preventDefault();
                    this.app.workspace.getLeaf().openFile(file);
                };
            });

            // Recursively render child tags
            this.renderTagGroup(groupContainer, children, [...path, key], level++);
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
