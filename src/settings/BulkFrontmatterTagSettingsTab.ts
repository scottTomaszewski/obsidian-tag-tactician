import { App, PluginSettingTab, Setting } from "obsidian";
import BulkFrontmatterTagManager from "../../main";

export class BulkFrontmatterTagSettingsTab extends PluginSettingTab {
    plugin: BulkFrontmatterTagManager;

    constructor(app: App, plugin: BulkFrontmatterTagManager) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Show warning for non-markdown files")
            .setDesc("If enabled, the modal will display a warning for non-markdown files.")
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
                    .addOption("hyphens", "Hyphens (block style)")
                    .addOption("brackets", "Square brackets (inline style)")

                    // Current value from plugin settings
                    .setValue(this.plugin.settings.tagListStyle)

                    // Save the user’s selection
                    .onChange(async (value) => {
                        this.plugin.settings.tagListStyle = value as "hyphens" | "brackets";
                        await this.plugin.saveSettings();
                    });
            });
    }
}
