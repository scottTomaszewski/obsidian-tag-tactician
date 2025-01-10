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

        containerEl.createEl("h3", { text: "Bulk Operation Settings" });

        new Setting(containerEl)
            .setName("Show Warning for Non-Markdown Files")
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
            .setName("Tag List Style")
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

        containerEl.createEl("br");
        containerEl.createEl("br");
        containerEl.createEl("h3", { text: "Related Notes View Settings" });

        new Setting(containerEl)
            .setName("Show Tags by Default")
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
            .setName("Show Score by Default")
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
            .setName("Tag Similarity Weight")
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
            .setName("Title Similarity Weight")
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
            .setName("Path Similarity Weight")
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
            .setName("Link Interconnections Weight")
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
    }
}
