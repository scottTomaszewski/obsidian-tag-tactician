export type TagListStyle = "hyphens" | "brackets";

export interface TagTacticianSettings {
    showNonMarkdownWarning: boolean;
    tagListStyle: TagListStyle;

    // Whether to show tags by default in Related Notes
    defaultShowTags: boolean;
    // Whether to show scores by default in Related Notes
    defaultShowScore: boolean;
}

export const DEFAULT_SETTINGS: TagTacticianSettings = {
    showNonMarkdownWarning: true,
    tagListStyle: "hyphens",
    defaultShowTags: true,
    defaultShowScore: true,
};
