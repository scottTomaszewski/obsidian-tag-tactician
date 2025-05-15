import {App, PluginSettingTab, Setting} from "obsidian";
import TagTacticianPlugin from "../../main";
import {TagNavSortMode} from "./PluginSettings";
import {IconSelectionModal} from "./IconSelectionModal";

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

                    // Save the user's selection
                    .onChange(async (value) => {
                        this.plugin.settings.tagListStyle = value as "hyphens" | "brackets";
                        await this.plugin.saveSettings();
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

        new Setting(containerEl).setName('Related notes score weighting').setHeading();
        containerEl.createEl("p", {text: "Higher values increase importance."});

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
                    .setValue(this.plugin.settings.nbtDefaultSort)
                    .onChange(async (value) => {
                        this.plugin.settings.nbtDefaultSort = value as TagNavSortMode;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName("Tag Group Icon (closed)")
            .setDesc("Select the icon used for a collapsed tag group (default: 'chevron-right')")
            .addButton(btn => {
                    if (this.plugin.settings.nbtTagGroupClosedIcon) {
                        btn.setIcon(this.plugin.settings.nbtTagGroupClosedIcon);
                    } else {
                        btn.setButtonText("Icon...");
                    }
                    return btn
                        .onClick(() => {
                            new IconSelectionModal(
                                this.app,
                                this.plugin.settings.nbtTagGroupClosedIcon,
                                async (selectedIcon: string) => {
                                    if (selectedIcon !== "") {
                                        this.plugin.settings.nbtTagGroupClosedIcon = selectedIcon;
                                        btn.setIcon(selectedIcon);
                                    } else {
                                        this.plugin.settings.nbtTagGroupClosedIcon = undefined;
                                        btn.setButtonText("Icon...")
                                    }
                                    await this.plugin.saveSettings();
                                    // TODO - want to refresh that view so it picks up the changed setting
                                }).open();
                        });
                }
            );
        new Setting(containerEl)
            .setName("Tag Group Icon (open)")
            .setDesc("Select the icon used for an expanded tag group (default: 'chevron-down')")
            .addButton(btn => {
                    if (this.plugin.settings.nbtTagGroupOpenIcon) {
                        btn.setIcon(this.plugin.settings.nbtTagGroupOpenIcon);
                    } else {
                        btn.setButtonText("Icon...");
                    }
                    return btn
                        .onClick(() => {
                            new IconSelectionModal(
                                this.app,
                                this.plugin.settings.nbtTagGroupOpenIcon,
                                async (selectedIcon: string) => {
                                    if (selectedIcon !== "") {
                                        this.plugin.settings.nbtTagGroupOpenIcon = selectedIcon;
                                        btn.setIcon(selectedIcon);
                                    } else {
                                        this.plugin.settings.nbtTagGroupOpenIcon = undefined;
                                        btn.setButtonText("Icon...")
                                    }
                                    await this.plugin.saveSettings();
                                    // TODO - want to refresh that view so it picks up the changed setting
                                }).open();
                        });
                }
            );
        new Setting(containerEl)
            .setName("File Icon")
            .setDesc("Select the icon used for a file (default: '')")
            .addButton(btn => {
                    if (this.plugin.settings.nbtFileIcon) {
                        btn.setIcon(this.plugin.settings.nbtFileIcon);
                    } else {
                        btn.setButtonText("Icon...");
                    }
                    return btn
                        .onClick(() => {
                            new IconSelectionModal(
                                this.app,
                                this.plugin.settings.nbtFileIcon,
                                async (selectedIcon: string) => {
                                    if (selectedIcon !== "") {
                                        this.plugin.settings.nbtFileIcon = selectedIcon;
                                        btn.setIcon(selectedIcon);
                                    } else {
                                        this.plugin.settings.nbtFileIcon = undefined;
                                        btn.setButtonText("Icon...")
                                    }
                                    await this.plugin.saveSettings();
                                    // TODO - want to refresh that view so it picks up the changed setting
                                }).open();
                        });
                }
            );
    }
}
