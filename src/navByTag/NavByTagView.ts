import { ItemView, WorkspaceLeaf, IconName } from "obsidian";
import TagTacticianPlugin from "../../main";
import { TagNavigationRenderer, TagFilterMode } from "./TagNavigationRenderer";

/**
 * Unique ID for the tag-based file navigation view.
 */
export const TAG_NAVIGATION_VIEW_TYPE = "tag-navigation-view";

/**
 * View component for tag-based file navigation.
 */
export class NavByTagView extends ItemView {
    private plugin: TagTacticianPlugin;
    private renderer: TagNavigationRenderer;
    private listContainerEl: HTMLElement | null = null;
    private filterQuery: string = "";

    constructor(leaf: WorkspaceLeaf, plugin: TagTacticianPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.renderer = new TagNavigationRenderer(this.app, plugin.settings.nbtDefaultSort);
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
        // Clean up if needed
    }

    /**
     * Build the view container including controls and list area
     */
    private buildView(): void {
        const container = this.containerEl;
        container.empty();
        container.addClass("tag-navigation-container");

        // Header
        const header = container.createEl("div", { cls: "tag-navigation-header" });
        const titleRow = header.createEl("div", { cls: "tag-navigation-title-row" });
        titleRow.createEl("h4", { text: "Tag Navigation" });

        // Controls row
        const controls = titleRow.createEl("div", { cls: "tag-navigation-controls" });

        // Sort dropdown button
        const sortBtn = controls.createEl("button", { cls: "tag-nav-sort-btn clickable-icon" });
        this.renderer.renderSortButton(sortBtn);
        sortBtn.setAttribute("aria-label", "Sort options");
        sortBtn.title = "Click to open sort options";
        
        sortBtn.onclick = (event) => {
            // Delegate to renderer to show menu
            this.renderer.showSortMenu(sortBtn, (newMode) => {
                this.renderer.renderSortButton(sortBtn);
                this.renderList();
            });
            
            // Prevent default to avoid any parent handlers
            event.preventDefault();
            event.stopPropagation();
        };

        // Expand/Collapse All button
        const expandAllBtn = controls.createEl("button", { cls: "tag-nav-expand-btn clickable-icon" });
        this.renderer.renderExpandButton(expandAllBtn);
        expandAllBtn.onclick = () => {
            // Toggle expand state
            this.renderer.setExpandAll(!this.renderer.getExpandAll());
            this.renderer.renderExpandButton(expandAllBtn);
            this.renderList();
        };

        // Settings button (cog icon)
        const settingsBtn = controls.createEl("button", { cls: "tag-nav-settings-btn clickable-icon" });
        this.renderer.renderSettingsButton(settingsBtn); // Initialize button appearance
        settingsBtn.onclick = (event) => {
            this.renderer.showSettingsMenu(settingsBtn, (newFilterMode) => {
                // The renderer updates its own filterMode via setFilterMode in the menu item's onClick
                // Re-render the button to reflect current state (e.g. if icon changed based on a setting)
                this.renderer.renderSettingsButton(settingsBtn); 
                this.renderList(); // Re-render the list with the new filter mode or other settings applied
            });
            event.preventDefault();
            event.stopPropagation();
        };

        // Filter input with clear button
        this.renderer.createFilterInput(
            header, 
            this.filterQuery, 
            "Filter tags...", 
            (value) => {
                this.filterQuery = value.toLowerCase();
                this.renderer.setFilterQuery(this.filterQuery);
                this.renderList();
            }
        );

        // Create the list container
        this.listContainerEl = container.createEl("div", { cls: "tag-navigation-list-container" });

        // Do initial render
        this.renderList();
    }

    /**
     * Render the tag hierarchy list
     */
    private renderList(): void {
        if (!this.listContainerEl) return;
        
        // Clear existing content
        this.listContainerEl.empty();

        // Use renderer to build, filter, sort and render the tag hierarchy
        const tagHierarchy = this.renderer.buildTagHierarchy();
        const filteredHierarchy = this.renderer.filterHierarchy(tagHierarchy, this.renderer.getFilterQuery());
        const sortedHierarchy = this.renderer.sortHierarchy(filteredHierarchy, this.renderer.getSortMode());
        
        // Render using the renderer
        this.renderer.renderTagGroup(this.listContainerEl, sortedHierarchy, [], (file) => {
            // Handle file opening
            this.app.workspace.getLeaf().openFile(file);
        });
    }
}
