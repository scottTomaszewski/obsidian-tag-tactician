// src/settings/PluginSettings.ts

export type TagListStyle = "hyphens" | "brackets";

export interface BulkFrontmatterTagSettings {
    showNonMarkdownWarning: boolean;
    tagListStyle: TagListStyle;
}

export const DEFAULT_SETTINGS: BulkFrontmatterTagSettings = {
    showNonMarkdownWarning: true,
    tagListStyle: "hyphens",
};
