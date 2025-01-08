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

        containerEl.createEl("h2", { text: "Tag Tactician Settings" });

        // Existing settings...
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

        // NEW: toggle for defaultShowTags
        new Setting(containerEl)
            .setName("Show Tags by Default (Related Notes)")
            .setDesc("If enabled, the Related Notes sidebar will initially show tags.")
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.defaultShowTags)
                    .onChange(async (val) => {
                        this.plugin.settings.defaultShowTags = val;
                        await this.plugin.saveSettings();
                    });
            });

        // NEW: toggle for defaultShowScore
        new Setting(containerEl)
            .setName("Show Score by Default (Related Notes)")
            .setDesc("If enabled, the Related Notes sidebar will initially show note scores.")
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.defaultShowScore)
                    .onChange(async (val) => {
                        this.plugin.settings.defaultShowScore = val;
                        await this.plugin.saveSettings();
                    });
            });
    }
}
