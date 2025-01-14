import { App, PluginSettingTab, Setting } from "obsidian";
import TagTacticianPlugin from "../../main";

export class TagTacticianSettingTab extends PluginSettingTab {
    plugin: TagTacticianPlugin;

    constructor(app: App, plugin: TagTacticianPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h1", { text: "Tag Tactician Settings" });

        // ==================
        // Batch
        // ==================
        containerEl.createEl("h3", { text: "Bulk Operation Settings" });

        new Setting(containerEl)
            .setName("Show warning for non-markdown files")
            .setDesc("If enabled, the modal will display a warning for non-Markdown files.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showNonMarkdownWarning)
                    .onChange(async (val) => {
                        this.plugin.settings.showNonMarkdownWarning = val;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Tag list style")
            .setDesc("Choose how frontmatter tags are serialized: hyphen block style or bracket inline style.")
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("hyphens", "Hyphens (Block Style)")
                    .addOption("brackets", "Square Brackets (Inline Style)")
                    .setValue(this.plugin.settings.tagListStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.tagListStyle = value as "hyphens" | "brackets";
                        await this.plugin.saveSettings();
                    });
            });

        // ==================
        // Related Notes
        // ==================
        containerEl.createEl("br");
        containerEl.createEl("br");
        containerEl.createEl("h3", { text: "Related Notes View Settings" });

        new Setting(containerEl)
            .setName("Show tags by default")
            .setDesc("If enabled, the Related Notes sidebar will initially show tags.")
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.defaultShowTags)
                    .onChange(async (val) => {
                        this.plugin.settings.defaultShowTags = val;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Show score by default")
            .setDesc("If enabled, the Related Notes sidebar will initially show note scores.")
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.defaultShowScore)
                    .onChange(async (val) => {
                        this.plugin.settings.defaultShowScore = val;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Hide results with score below")
            .setDesc("Hide notes in the Related Notes sidebar with a score below this threshold.")
            .addText((text) => {
                text
                    .setPlaceholder("1")
                    .setValue(this.plugin.settings.minimumRelatedNotesScore.toString())
                    .onChange(async (val) => {
                        this.plugin.settings.minimumRelatedNotesScore = Number(val);
                        await this.plugin.saveSettings();
                    });
            });

        containerEl.createEl("h4", { text: "Related Notes Score Weighting Adjustments" });
        containerEl.createEl("p", { text: "Higher values increase importance." });

        new Setting(containerEl)
            .setName("Tag similarity weight")
            .setDesc("The weight of tag similarity in the Related Notes score.")
            .addText((text) => {
                text
                    .setPlaceholder("1.0")
                    .setValue(this.plugin.settings.weightTagSimilarity.toString())
                    .onChange(async (val) => {
                        this.plugin.settings.weightTagSimilarity = Number(val);
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Title similarity weight")
            .setDesc("The weight of file name similarity in the Related Notes score.")
            .addText((text) => {
                text
                    .setPlaceholder("1.0")
                    .setValue(this.plugin.settings.weightTitleSimilarity.toString())
                    .onChange(async (val) => {
                        this.plugin.settings.weightTitleSimilarity = Number(val);
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Path similarity weight")
            .setDesc("The weight of file path similarity in the Related Notes score.")
            .addText((text) => {
                text
                    .setPlaceholder("1.0")
                    .setValue(this.plugin.settings.weightPathSimilarity.toString())
                    .onChange(async (val) => {
                        this.plugin.settings.weightPathSimilarity = Number(val);
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Link interconnections weight")
            .setDesc("The weight of notes having links to each other in the Related Notes score.")
            .addText((text) => {
                text
                    .setPlaceholder("1.0")
                    .setValue(this.plugin.settings.weightLinkInterconnections.toString())
                    .onChange(async (val) => {
                        this.plugin.settings.weightLinkInterconnections = Number(val);
                        await this.plugin.saveSettings();
                    });
            });

        // ==================
        // Nav by Tag
        // ==================
        containerEl.createEl("br");
        containerEl.createEl("br");
        containerEl.createEl("h3", { text: "Tag Navigation Settings" });

        new Setting(containerEl)
            .setName("Default navigation sorting")
            .setDesc("Sort alphabetically or by notes with the tag.")
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("alphabetically-descending", "Alphabetically")
                    .addOption("file-count-descending", "By note count")
                    .setValue(this.plugin.settings.nbtDefaultSort)
                    .onChange(async (value) => {
                        this.plugin.settings.nbtDefaultSort = value as "alphabetically-descending" | "file-count-descending";
                        await this.plugin.saveSettings();
                    });
            });

    }
}
