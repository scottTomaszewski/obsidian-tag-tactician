export type TagListStyle = "hyphens" | "brackets";

export interface TagTacticianSettings {
    showNonMarkdownWarning: boolean;
    tagListStyle: TagListStyle;

    // Whether to show tags by default in Related Notes
    defaultShowTags: boolean;
    // Whether to show scores by default in Related Notes
    defaultShowScore: boolean;
    // Minimum score to show in Related Notes
    minimumRelatedNotesScore: number;
    weightTagSimilarity: number;
    weightTitleSimilarity: number;
    weightPathSimilarity: number;
    weightLinkInterconnections: number;
}

export const DEFAULT_SETTINGS: TagTacticianSettings = {
    showNonMarkdownWarning: true,
    tagListStyle: "hyphens",
    defaultShowTags: true,
    defaultShowScore: true,
    minimumRelatedNotesScore: 1,
    weightTagSimilarity: 1.0,
    weightTitleSimilarity: 1.0,
    weightPathSimilarity: 1.0,
    weightLinkInterconnections: 1.0,
};
