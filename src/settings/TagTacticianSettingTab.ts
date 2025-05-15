import {App, PluginSettingTab, Setting} from "obsidian";
import TagTacticianPlugin from "../../main";
import {TagNavSortMode} from "./PluginSettings";

export class TagTacticianSettingTab extends PluginSettingTab {
    plugin: TagTacticianPlugin;

    constructor(app: App, plugin: TagTacticianPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        // ==================
        // Batch
        // ==================
        new Setting(containerEl).setName('Bulk tag operations').setHeading();

        new Setting(containerEl)
            .setName("Show warning for non-markdown files")
            .setDesc("If enabled, the modal will display a warning for non-markdown files.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.get().showNonMarkdownWarning)
                    .onChange(async (val) => {
                        await this.plugin.settings.save({showNonMarkdownWarning: val});
                    })
            );

        new Setting(containerEl)
            .setName("Tag list style")
            .setDesc("Choose how frontmatter tags are serialized: hyphen block style or bracket inline style.")
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("hyphens", "Hyphens (block style)")
                    .addOption("brackets", "Square brackets (inline style)")
                    .setValue(this.plugin.settings.get().tagListStyle)
                    .onChange(async (value) => {
                        await this.plugin.settings.save({tagListStyle: value as "hyphens" | "brackets"})
                    });
            });

        // ==================
        // Related Notes
        // ==================
        new Setting(containerEl).setName('Related notes view').setHeading();

        new Setting(containerEl)
            .setName("Show tags by default")
            .setDesc("If enabled, the Related Notes sidebar will initially show tags.")
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.get().defaultShowTags)
                    .onChange(async (val) => {
                        await this.plugin.settings.save({defaultShowTags: val});
                    });
            });

        new Setting(containerEl)
            .setName("Show score by default")
            .setDesc("If enabled, the Related Notes sidebar will initially show note scores.")
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.get().defaultShowScore)
                    .onChange(async (val) => {
                        await this.plugin.settings.save({defaultShowScore: val});
                    });
            });

        new Setting(containerEl)
            .setName("Hide results with score below")
            .setDesc("Hide notes in the Related Notes sidebar with a score below this threshold.")
            .addText((text) => {
                text
                    .setPlaceholder("1")
                    .setValue(this.plugin.settings.get().minimumRelatedNotesScore.toString())
                    .onChange(async (val) => {
                        await this.plugin.settings.save({minimumRelatedNotesScore: Number(val)});
                    });
            });

        new Setting(containerEl).setName('Related notes score weighting').setHeading();
        containerEl.createEl("p", {text: "Higher values increase importance."});

        new Setting(containerEl)
            .setName("Tag similarity weight")
            .setDesc("The weight of tag similarity in the Related Notes score.")
            .addText((text) => {
                text
                    .setPlaceholder("1.0")
                    .setValue(this.plugin.settings.get().weightTagSimilarity.toString())
                    .onChange(async (val) => {
                        await this.plugin.settings.save({weightTagSimilarity: Number(val)});
                    });
            });

        new Setting(containerEl)
            .setName("Title similarity weight")
            .setDesc("The weight of file name similarity in the Related Notes score.")
            .addText((text) => {
                text
                    .setPlaceholder("1.0")
                    .setValue(this.plugin.settings.get().weightTitleSimilarity.toString())
                    .onChange(async (val) => {
                        await this.plugin.settings.save({weightTitleSimilarity: Number(val)});
                    });
            });

        new Setting(containerEl)
            .setName("Path similarity weight")
            .setDesc("The weight of file path similarity in the Related Notes score.")
            .addText((text) => {
                text
                    .setPlaceholder("1.0")
                    .setValue(this.plugin.settings.get().weightPathSimilarity.toString())
                    .onChange(async (val) => {
                        await this.plugin.settings.save({weightPathSimilarity: Number(val)});
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Link interconnections weight")
            .setDesc("The weight of notes having links to each other in the Related Notes score.")
            .addText((text) => {
                text
                    .setPlaceholder("1.0")
                    .setValue(this.plugin.settings.get().weightLinkInterconnections.toString())
                    .onChange(async (val) => {
                        await this.plugin.settings.save({weightLinkInterconnections: Number(val)});
                    });
            });

        // ==================
        // Nav by Tag
        // ==================
        new Setting(containerEl).setName('Tag navigation view').setHeading();

        new Setting(containerEl)
            .setName("Default navigation sorting")
            .setDesc("Choose how tags and notes should be sorted.")
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("alphabetically-descending", "Alphabetically")
                    .addOption("file-count-descending", "By note count")
                    .addOption("created-time-descending", "Newest notes first")
                    .addOption("created-time-ascending", "Oldest notes first")
                    .addOption("modified-time-descending", "Recently modified first")
                    .addOption("modified-time-ascending", "Least recently modified first")
                    .setValue(this.plugin.settings.get().nbtDefaultSort)
                    .onChange(async (value) => {
                        await this.plugin.settings.save({nbtDefaultSort: value as TagNavSortMode});
                    });
            });
    }
}
