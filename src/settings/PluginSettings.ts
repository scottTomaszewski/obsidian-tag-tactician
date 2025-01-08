// src/settings/PluginSettings.ts

export type TagListStyle = "hyphens" | "brackets";

export interface TagTacticianSettings {
    showNonMarkdownWarning: boolean;
    tagListStyle: TagListStyle;
}

export const DEFAULT_SETTINGS: TagTacticianSettings = {
    showNonMarkdownWarning: true,
    tagListStyle: "hyphens",
};
